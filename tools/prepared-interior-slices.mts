import type { PreparedPresentationDefinition, PreparedWrite } from '../src/renderers/css/rendering/prepared-presentation.ts';
import type { PreparedAssets } from '../src/renderers/css/rendering/prepared-residency.ts';
import { preparedSurfaceMean } from './prepared-interior-fill.mts';

/** Slice planes through the body origin: the six axes of an icosahedron, so every view lies within 32° of one slice's normal. */
const PHI = (1 + Math.sqrt(5)) / 2;
export const INTERIOR_SLICE_NORMALS: readonly (readonly [number, number, number])[] =
  [[0, 1, PHI], [0, -1, PHI], [1, PHI, 0], [-1, PHI, 0], [PHI, 0, 1], [PHI, 0, -1]]
    .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] as const; });
/** The side of each slice leaf's square element, before its transform. */
const SLICE_LEAF_SIZE = 512;

type Vec = number[];
const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function matrixOf(style: string) {
  const match = /transform:matrix3d\(([^)]*)\)/u.exec(style), width = /--polycss-atlas-width:([\d.]+)px/u.exec(style), height = /--polycss-atlas-height:([\d.]+)px/u.exec(style);
  if (!match || !width || !height) throw new Error('Interior slices require retained u leaves with prepared sizes.');
  const m = match[1].split(',').map(Number);
  if (m.length !== 16 || !m.every(Number.isFinite) || m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) throw new Error('Interior slices require affine leaves.');
  return { m, w: Number(width[1]), h: Number(height[1]) };
}
const point = (m: Vec, x: number, y: number) => [0, 1, 2].map(i => m[i] * x + m[4 + i] * y + m[12 + i]);

function segmentHitsTriangle(p: Vec, q: Vec, [a, b, c]: Vec[]) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const f = 1 / det, s = sub(p, a), u = f * dot(s, h);
  if (u < 0 || u > 1) return false;
  const r = cross(s, e1), v = f * dot(d, r);
  if (v < 0 || u + v > 1) return false;
  const t = f * dot(e2, r);
  return t >= 0 && t <= 1;
}
const quadHalves = (c: Vec[]) => [[c[0], c[1], c[2]], [c[0], c[2], c[3]]];
export function quadsIntersect(a: Vec[][], b: Vec[][]) {
  return a.some(ta => b.some(tb => [0, 1, 2].some(i => segmentHitsTriangle(ta[i], ta[(i + 1) % 3], tb)) || [0, 1, 2].some(i => segmentHitsTriangle(tb[i], tb[(i + 1) % 3], ta))));
}

/** The loop where the plane through the origin with this normal cuts the leaf triangles, enclosing the origin. Leaf corners are read
 * back through rounded matrices, so neighbouring corners are welded first and each crossing is identified by the welded edge it lies on. */
function sliceOutline(triangles: readonly Vec[][], normal: Vec) {
  const scale = Math.max(...triangles.flat().map(p => Math.hypot(...p))), tolerance = scale * 1e-7, welded: Vec[] = [], cells = new Map<string, number[]>();
  const weld = (p: Vec) => {
    const cell = p.map(v => Math.floor(v / tolerance));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const id of cells.get(`${cell[0] + dx},${cell[1] + dy},${cell[2] + dz}`) ?? []) if (Math.hypot(...sub(welded[id], p)) <= tolerance) return id;
    const id = welded.push(p) - 1, key = cell.join(',');
    cells.set(key, [...cells.get(key) ?? [], id]);
    return id;
  };
  const edgeKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const segments: { ends: [string, string]; points: [Vec, Vec] }[] = [];
  for (const t of triangles) {
    const ids = t.map(weld), d = ids.map(id => dot(normal, welded[id])), crossings: { key: string; point: Vec }[] = [];
    for (let i = 0; i < 3; i++) {
      const a = ids[i], b = ids[(i + 1) % 3], da = d[i], db = d[(i + 1) % 3];
      if ((da < 0) !== (db < 0)) { const s = da / (da - db); crossings.push({ key: edgeKey(a, b), point: welded[a].map((v, k) => v + s * (welded[b][k] - v)) }); }
    }
    if (crossings.length === 2) segments.push({ ends: [crossings[0].key, crossings[1].key], points: [crossings[0].point, crossings[1].point] });
  }
  const byEnd = new Map<string, number[]>();
  segments.forEach((segment, index) => { for (const end of segment.ends) byEnd.set(end, [...byEnd.get(end) ?? [], index]); });
  const used = new Set<number>(), loops: Vec[][] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;
    used.add(start);
    const keys = [...segments[start].ends], points = [...segments[start].points];
    for (;;) {
      const last = keys.at(-1)!, next = (byEnd.get(last) ?? []).find(index => !used.has(index));
      if (next === undefined) break;
      used.add(next);
      const forward = segments[next].ends[0] === last;
      keys.push(segments[next].ends[forward ? 1 : 0]); points.push(segments[next].points[forward ? 1 : 0]);
    }
    if (keys[0] === keys.at(-1)) loops.push(points.slice(0, -1));
  }
  // The retained surface is closed, so the loop around the origin is the one whose fan from the origin winds once.
  const axis = Math.abs(normal[0]) < .9 ? [1, 0, 0] : [0, 1, 0], u = sub(axis, normal.map(v => v * dot(axis, normal))), ul = Math.hypot(...u), U = u.map(v => v / ul), V = cross(normal, U);
  const winding = (loop: Vec[]) => loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + Math.atan2(dot(p, U) * dot(q, V) - dot(q, U) * dot(p, V), dot(p, U) * dot(q, U) + dot(p, V) * dot(q, V)); }, 0) / (2 * Math.PI);
  const enclosing = loops.filter(loop => Math.abs(Math.abs(winding(loop)) - 1) < 1e-6);
  if (enclosing.length !== 1) throw new Error(`Interior slice needs one surface loop around the body origin; found ${enclosing.length}.`);
  const loop = enclosing[0];
  return winding(loop) > 0 ? loop : [...loop].reverse();
}

/** One fan leaf per outline edge: a solid rectangle from the edge to the origin ± half the edge. Its corners are the rectangle's own, so the
 * leaf the clearance test checks is exactly the leaf Chrome draws. */
function fanMatrices(outline: readonly Vec[], normal: Vec, scale: number) {
  return outline.map((p, i) => {
    const a = p.map(v => v * scale), b = outline[(i + 1) % outline.length].map(v => v * scale), apex = a.map((v, k) => -(v + b[k]) / 2);
    return [...sub(b, a).map(v => v / SLICE_LEAF_SIZE), 0, ...apex.map(v => -v / SLICE_LEAF_SIZE), 0, ...normal, 0, ...a.map((v, k) => v + apex[k]), 1];
  });
}
export const fanQuads = (matrices: readonly Vec[]) => matrices.map(m => quadHalves([point(m, 0, 0), point(m, SLICE_LEAF_SIZE, 0), point(m, SLICE_LEAF_SIZE, SLICE_LEAF_SIZE), point(m, 0, SLICE_LEAF_SIZE)]));

/** The slice leaf matrices for each normal, from the retained surface leaves' own styles. */
export function interiorSliceLeaves(leafStyles: readonly string[]) {
  const leaves = leafStyles.map(matrixOf);
  if (leaves.length < 4) throw new Error('Interior slices require a retained leaf mesh.');
  const triangles = leaves.map(({ m, w, h }) => [point(m, 0, h), point(m, w, h), point(m, w / 2, 0)]);
  const boxes = leaves.map(({ m, w, h }) => quadHalves([point(m, 0, 0), point(m, w, 0), point(m, w, h), point(m, 0, h)]));
  const clear = (matrices: readonly Vec[]) => { const quads = fanQuads(matrices); return !quads.some(quad => boxes.some(box => quadsIntersect(quad, box))); };
  const slices: { normal: readonly number[]; matrices: Vec[]; shrink: number }[] = [];
  for (const normal of INTERIOR_SLICE_NORMALS) {
    const outline = sliceOutline(triangles, [...normal]);
    let inside = 0.05, outside = 1;
    if (!clear(fanMatrices(outline, [...normal], inside))) throw new Error('Interior slice cannot clear the surface leaves near the body origin.');
    for (let i = 0; i < 14; i++) { const middle = (inside + outside) / 2; if (clear(fanMatrices(outline, [...normal], middle))) inside = middle; else outside = middle; }
    slices.push({ normal, matrices: fanMatrices(outline, [...normal], inside), shrink: inside });
  }
  return slices;
}

/** Cracks between irregular surface leaves open onto the far side of the body. A slice of the body's own mesh, facing the view, fills them
 * with the surface's mean colour. Each slice is the largest shrink of that section whose leaves intersect no surface leaf box, since Chrome
 * depth-sorts element boxes. The runtime shows the slice whose normal is nearest the view. */
export async function withPreparedInteriorSlices<T extends PreparedPresentationDefinition & { assets?: PreparedAssets }>(
  presentation: T, sceneFromBody: readonly number[], resolveAsset: (url: string) => string,
): Promise<T> {
  const nodes = presentation.tree.nodes, body = nodes.findIndex(node => node.className?.split(/\s+/u).some(name => name.endsWith('-body')));
  if (body < 0 || presentation.viewBindings.some(binding => binding.kind === 'interior-slices')) throw new Error('Interior slices require one retained body without slices.');
  const slices = interiorSliceLeaves(nodes.flatMap(node => node.parent === body && node.tag === 'u' ? [node.style] : []));
  const assets = presentation.assets;
  if (!assets) throw new Error('Interior slices require the prepared asset catalogue.');
  const colors = new Map<string, Promise<string>>(), variants = [];
  for (const variant of presentation.variants) {
    const keys = variant.required.filter(key => key.startsWith('surface:') || key.startsWith('page:') || key.startsWith('shadow:') || key === 'surface');
    if (!keys.length) throw new Error(`Missing prepared surface for ${variant.when.lensId}.`);
    const key = keys.join(',');
    if (!colors.has(key)) colors.set(key, preparedSurfaceMean(keys.map(assetKey => {
      const asset = assets.entries.find(entry => entry.key === assetKey);
      if (!asset || !asset.url.startsWith('/scenes/') || asset.url.includes('..')) throw new Error('Interior slices require local prepared surface pixels.');
      return resolveAsset(asset.url);
    })));
    const writes: PreparedWrite[] = [{ kind: 'style', target: body, name: '--prepared-interior-fill', value: await colors.get(key)! }];
    variants.push({ ...variant, writes: [...variant.writes, ...writes] });
  }
  let next = nodes.length;
  // Solid opaque rectangles, not u triangles: Chrome gives a one-colour layer no raster tiles. Measured on Alphonsina at DPR 2, triangle
  // slices exhausted the GPU raster budget from zoom 1.75 and Chrome dropped surface tiles; rectangles left 0-3 wrong pixels up to zoom 4.
  const added = slices.flatMap(slice => slice.matrices.map(m => ({ parent: body, tag: 'div', className: 'prepared-interior-slice', properties: [], attributes: {},
    style: `position:absolute;left:0;top:0;width:${SLICE_LEAF_SIZE}px;height:${SLICE_LEAF_SIZE}px;transform-origin:0 0;transform:matrix3d(${m.join(',')});background:var(--prepared-interior-fill);backface-visibility:visible;pointer-events:none;display:none` })));
  const bindingSlices = slices.map(slice => ({ normal: [...slice.normal], nodes: slice.matrices.map(() => next++) }));
  return { ...presentation,
    tree: { ...presentation.tree, nodes: [...nodes, ...added] },
    viewBindings: [...presentation.viewBindings, { kind: 'interior-slices', target: body, sceneFromBody: [...sceneFromBody], slices: bindingSlices }],
    variants,
  };
}

/** Recompilation starts from the retained surface: the slice leaves are the final generated nodes. */
export function withoutPreparedInteriorSlices<T extends PreparedPresentationDefinition>(presentation: T): T {
  const binding = presentation.viewBindings.find(entry => entry.kind === 'interior-slices');
  if (!binding) return presentation;
  const first = presentation.tree.nodes.findIndex(node => node.className === 'prepared-interior-slice');
  if (first < 0 || presentation.tree.nodes.slice(first).some(node => node.className !== 'prepared-interior-slice')) throw new Error('Prepared interior slices must remain the final generated leaves.');
  return { ...presentation,
    tree: { ...presentation.tree, nodes: presentation.tree.nodes.slice(0, first) },
    viewBindings: presentation.viewBindings.filter(entry => entry !== binding),
    variants: presentation.variants.map(variant => ({ ...variant, writes: variant.writes.filter(write => !(write.target === binding.target && write.kind === 'style' && write.name === '--prepared-interior-fill')) })),
  };
}

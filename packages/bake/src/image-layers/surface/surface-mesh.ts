import { MeshoptSimplifier } from 'meshoptimizer';
import type { ImageLayerRecipe } from '../config.ts';
import { imageLayerSurfaceCrossings, SURFACE_MOST_CROSSINGS, surfaceOnPicture } from './surface.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

/** How many triangles the published surface is drawn with: the file's 17,101 simplified to about as many leaves as the
 * patches it replaces drew (1,304), so the page costs the same. */
export const SURFACE_MESH_TRIANGLES = 1200;
/** A triangle's texture: texels to a face pixel along its sides, and the most texels a side may have. */
export const MESH_TEXELS_PER_PIXEL = 1, MESH_MOST_TEXELS = 160;
/** How far the receding lobe's light may be raised to the approaching lobe's. */
export const MESH_MOST_GAIN = 3;
/** The shell's opacity: the least, for the brightest faces, and the share of the brightest light from which a face
 * starts to clear. */
export const MESH_OPACITY_FLOOR = 0.55, MESH_CLEAR_FROM = 0.4;
/** The color ramp: the approaching lobe's pixels in this many steps of brightness. */
export const MESH_RAMP_STEPS = 48;
/** Where the picture is a face's own: the face is the nearest crossing of its pixel's sight line (within
 * MESH_VISIBLE_ARCSEC of its depth), clear of the star's glare (none of its light the star's), and turns toward the Sun, its normal's cosine to the sight line
 * above MESH_KNOWN_COS; from MESH_SEEN_COS up the picture alone. */
export const MESH_VISIBLE_ARCSEC = 0.3, MESH_KNOWN_COS = 0.3, MESH_SEEN_COS = 0.5;
/** And the picture is the lobe there: its light around the pixel (`around`) from the first to the second share of the
 * lobes' brightest light, not the dark sky where the published surface reaches past the picture's lobe. */
export const MESH_LOBE_LIGHT = [0.15, 0.3] as const;
/** Inside the star's glare, a face counts as the picture's own where the ultraviolet detail counts this far. */
export const MESH_DETAIL_KNOWN = 0.5;
/** How far either side of the waist (the plane through the star across the pole) the two lobes' fills blend, arcsec. */
export const MESH_WAIST_BLEND_ARCSEC = 0.6;
/** A lobe's chart: the latitudes it spans (the far side from MESH_CHART_FROM_DEG, the face toward the Sun to
 * MESH_CHART_TO_DEG). Quilting: a block's side and overlap in cells, the candidates drawn for each block, how many of
 * the best it picks among, and the sweeps that relax the seams. */
export const MESH_CHART_FROM_DEG = -88, MESH_CHART_TO_DEG = 88, MESH_QUILT_BLOCK = 32, MESH_QUILT_OVERLAP = 10, MESH_QUILT_CANDIDATES = 400, MESH_QUILT_CHOICE = 5, MESH_RELAX_SWEEPS = 300;
/** Dark patches: the lobe's light around a pixel over MESH_PATCH_AROUND face pixels (a box blur, three times) against
 * its light over MESH_PATCH_NEAR; a patch from MESH_PATCH_FROM of that light lost to all of it at MESH_PATCH_TO, and how
 * much of a point's light a full patch takes away. */
export const MESH_PATCH_AROUND = 24, MESH_PATCH_NEAR = 4, MESH_PATCH_FROM = 0.12, MESH_PATCH_TO = 0.45, MESH_PATCH_DARK = 0.75;

/** Texels a triangle reaches past each side, where it meets its neighbour (see edgeShare). */
export const MESH_EDGE_MARGIN = 1;
/** The most triangles one 3D scene holds, and how far a scene reaches from its first triangle at most, as a share of
 * the mesh's longest reach. A browser sorts a scene's leaves by depth against one another and cuts each along the
 * planes of the others; the scenes themselves are painted farthest from the camera first, by their middles. The
 * Homunculus's 1,345 in one scene took Chrome's display compositor 58 ms of each frame of a turn, 18 frames a second;
 * in scenes of 24, 16.5 ms; of 12, 10.9 ms and 57 frames a second (headless Chrome on a GPU, M3 Max, a 1458 by 1202
 * window, 2026-10-12). A scene that spans a jump of the triangles' order has its middle between two places and is
 * painted out of turn. */
export const MESH_SCENE_TRIANGLES = 12, MESH_SCENE_REACH = 0.2;
/** The sizes of the consecutive runs of a mesh's triangles, given their middles in their order, that share a 3D scene:
 * a run ends at MESH_SCENE_TRIANGLES, or before a triangle farther than MESH_SCENE_REACH from the run's first. */
export function meshScenes(middles: readonly (readonly number[])[]): number[] {
  const reach = Math.max(0, ...[0, 1, 2].map(axis => Math.max(...middles.map(middle => middle[axis]!)) - Math.min(...middles.map(middle => middle[axis]!))));
  const scenes: number[] = [];
  for (let first = 0, index = 1; index <= middles.length; index++) {
    if (index < middles.length && index - first < MESH_SCENE_TRIANGLES && Math.hypot(...[0, 1, 2].map(axis => middles[index]![axis]! - middles[first]![axis]!)) <= MESH_SCENE_REACH * reach) continue;
    scenes.push(index - first); first = index;
  }
  return scenes;
}
/** A texel's opacity by its distance in texels inside its triangle's nearest side (negative outside): the face's own
 * opacity a inside, none past half a texel out, and across the half-texel band either side of the side, which the
 * neighbour also draws, 1 - sqrt(1 - a), so the two together are a. */
export function edgeShare(a: number, inside: number): number {
  if (inside >= .5) return a; if (inside <= -.5) return 0; return 1 - Math.sqrt(Math.max(0, 1 - a));
}

/** One triangle of the drawn surface: its corners on the picture (column, row, depth in arcseconds from the star's plane
 * of the sky, negative toward the Sun) and its texture over the parallelogram the corners span (corner 0, then along to
 * corner 1, down to corner 2): clear past the triangle. */
export interface SurfaceTriangle { corners: [[number, number, number], [number, number, number], [number, number, number]]; texture: readonly [number, number]; rgba: Buffer }

/** The file's triangles as one mesh: corners closer than a ten-thousandth of the file's size are one corner. */
function welded(triangles: Float32Array): { positions: Float32Array; indices: Uint32Array } {
  let size = 0; for (const value of triangles) size = Math.max(size, Math.abs(value));
  const grid = size / 1e4 || 1, at = new Map<string, number>(), positions: number[] = [], indices = new Uint32Array(triangles.length / 3);
  for (let corner = 0; corner < triangles.length / 3; corner++) { const x = triangles[3 * corner]!, y = triangles[3 * corner + 1]!, z = triangles[3 * corner + 2]!, key = `${Math.round(x / grid)},${Math.round(y / grid)},${Math.round(z / grid)}`;
    let index = at.get(key); if (index === undefined) { index = positions.length / 3; at.set(key, index); positions.push(x, y, z); } indices[corner] = index; }
  return { positions: Float32Array.from(positions), indices };
}

/** A field's box blur, `radius` pixels each way, clipped at the edges. */
function boxBlur(field: Float32Array, width: number, height: number, radius: number): Float32Array {
  const across = new Float32Array(field.length), out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let sum = 0, n = 0; for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) { sum += field[y * width + k]!; n++; } across[y * width + x] = sum / n; }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let sum = 0, n = 0; for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) { sum += across[k * width + x]!; n++; } out[y * width + x] = sum / n; }
  return out;
}

/** The mesh with every hole closed: each loop of edges that only one triangle holds is filled by a fan of triangles
 * about its middle, turned the way the triangles around it are. */
export function closedMesh(positions: Float32Array, indices: Uint32Array): { positions: Float32Array; indices: Uint32Array; holes: number } {
  // A triangle with two corners at one place (a pole of a sphere's grid) has no area and no edges.
  const faces0: number[] = []; for (let t = 0; t < indices.length; t += 3) { const a = indices[t]!, b = indices[t + 1]!, c = indices[t + 2]!; if (a !== b && b !== c && a !== c) faces0.push(a, b, c); }
  indices = Uint32Array.from(faces0);
  const edges = new Set<string>(); for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) edges.add(`${indices[t + k]},${indices[t + (k + 1) % 3]}`);
  // A hole's edge runs one way in its triangle; the fan runs it the other way.
  const next = new Map<number, number>(); for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) { const a = indices[t + k]!, b = indices[t + (k + 1) % 3]!; if (!edges.has(`${b},${a}`)) next.set(b, a); }
  const points = Array.from(positions), faces = Array.from(indices); let holes = 0;
  while (next.size) { const [start] = next.keys(), loop: number[] = []; let at: number | undefined = start!;
    while (at !== undefined && next.has(at)) { loop.push(at); const to: number = next.get(at)!; next.delete(at); at = to; }
    if (loop.length < 3) continue; holes++;
    const middle = points.length / 3; for (let axis = 0; axis < 3; axis++) points.push(loop.reduce((sum, index) => sum + positions[3 * index + axis]!, 0) / loop.length);
    for (let k = 0; k < loop.length; k++) faces.push(loop[k]!, loop[(k + 1) % loop.length]!, middle); }
  return { positions: Float32Array.from(points), indices: Uint32Array.from(faces), holes };
}

/** A field's values where `weight` is below one, carried in from where it is known (push-pull): each coarser level
 * holds the weighted mean of the four pixels under it, and each finer level takes the coarser one's value in the share
 * of its weight it lacks, so a hole is filled smoothly from its whole rim. */
export function pushPull(values: Float32Array[], weight: Float32Array, width: number, height: number): Float32Array[] {
  if (width <= 1 && height <= 1) return values.map(field => Float32Array.from(field));
  const w2 = Math.ceil(width / 2), h2 = Math.ceil(height / 2), coarseWeight = new Float32Array(w2 * h2), coarse = values.map(() => new Float32Array(w2 * h2));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = y * width + x, q = (y >> 1) * w2 + (x >> 1), w = weight[p]!; coarseWeight[q]! += w; for (const [c, field] of values.entries()) coarse[c]![q]! += w * field[p]!; }
  for (let q = 0; q < w2 * h2; q++) { for (const field of coarse) field[q] = coarseWeight[q]! > 0 ? field[q]! / coarseWeight[q]! : 0; coarseWeight[q] = Math.min(1, coarseWeight[q]!); }
  const filled = pushPull(coarse, coarseWeight, w2, h2);
  // The coarser level read between its pixels (bilinear), so a filled hole shows no squares.
  const coarseAt = (field: Float32Array, x: number, y: number) => { const fx = Math.max(0, Math.min(w2 - 1, (x + .5) / 2 - .5)), fy = Math.max(0, Math.min(h2 - 1, (y + .5) / 2 - .5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w2 - 1, x0 + 1), y1 = Math.min(h2 - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    return (1 - ty) * ((1 - tx) * field[y0 * w2 + x0]! + tx * field[y0 * w2 + x1]!) + ty * ((1 - tx) * field[y1 * w2 + x0]! + tx * field[y1 * w2 + x1]!); };
  return values.map((field, c) => Float32Array.from(field, (value, p) => { const x = p % width, y = (p - x) / width, w = Math.min(1, weight[p]!); return w * value + (1 - w) * coarseAt(filled[c]!, x, y); }));
}

/**
 * A published closed surface drawn as itself (`geometry.surface.closedMesh`): its own triangles, simplified to
 * `SURFACE_MESH_TRIANGLES`, each a leaf with the picture painted on it. Neighbouring triangles share their corners, so
 * the shell is closed from every side. The dark dust is solid and the glowing parts clear (`opacityOf`), each point with the
 * picture's brightness and the approaching lobe's color for it. Holes in the published surface are closed
 * (`closedMesh`). The star's own light, to `starRadiusArcsec` and fading to twice that, is not the shell's: there the
 * shell's color and optical depth are carried in from the lobes around it (`pushPull`).
 */
export async function imageLayerSurfaceMesh(surface: Surface, triangles: Float32Array, photo: Buffer, width: number, height: number, sky: (px: number, py: number) => readonly [number, number], stretch?: (east: number, north: number) => number, filaments?: Float32Array, detail?: { value: Float32Array; weight: Float32Array }, cover?: Float32Array): Promise<SurfaceTriangle[]> {
  await MeshoptSimplifier.ready;
  const open = welded(triangles), { positions, indices } = closedMesh(open.positions, open.indices), [kept, error] = MeshoptSimplifier.simplify(indices, positions, 3, Math.min(indices.length, 3 * SURFACE_MESH_TRIANGLES), 0.05);
  if (!(kept.length >= 3)) throw new RangeError(`The surface (${surface.path}) simplified to no triangles (error ${error}).`);
  const simple = new Float32Array(3 * kept.length); for (const [corner, index] of kept.entries()) for (let axis = 0; axis < 3; axis++) simple[3 * corner + axis] = positions[3 * index + axis]!;
  // Where each pixel's sight line crosses the drawn surface, and which lobe each crossing is on.
  const { depths, lobes } = imageLayerSurfaceCrossings(surface, simple, width, height, sky, stretch), most = SURFACE_MOST_CROSSINGS, count = width * height;
  const crossed = new Uint8Array(count); for (let p = 0; p < count; p++) { let n = 0; while (n < most && !Number.isNaN(depths[most * p + n]!)) n++; crossed[p] = n; }
  const { place, toSun } = surfaceOnPicture(surface, width, height, sky, stretch), arcsecPerPixel = Math.hypot(...sky(1, 0).map((value, k) => value - sky(0, 0)[k]!));
  const starWeight = (px: number, py: number) => { if (!surface.starRadiusArcsec) return 0; const t = Math.max(0, Math.min(1, 2 - Math.hypot(...sky(px, py)) / surface.starRadiusArcsec)); return t * t * (3 - 2 * t); };
  // The picture's color and optical depth, with the star's share replaced by what the lobes around it carry in.
  const known = new Float32Array(count), fields = [0, 1, 2].map(c => Float32Array.from({ length: count }, (_, p) => photo[4 * p + c]!));
  fields.push(Float32Array.from({ length: count }, (_, p) => -Math.log(1 - Math.min(photo[4 * p + 3]! / 255, .998))));
  for (let p = 0; p < count; p++) known[p] = 1 - starWeight(p % width, Math.floor(p / width));
  const filled = pushPull(fields, known, width, height);
  // The surface's look is the approaching lobe's, as the picture shows it. Each point's brightness is the picture's own
  // (mean of the channels times opacity), sharp; dark lanes (the filament map) and dark patches deepen it by their
  // darkness, never brighten it. Its color is the picture's own; where a lane or patch
  // deepens it, it slides to the picture's color for its new brightness on the approaching lobe (`ramp`): dark orange to
  // brown to black. The
  // dust is opaque: a dark point hides what is behind it.
  const light = Float32Array.from({ length: count }, (_, p) => (filled[0]![p]! + filled[1]![p]! + filled[2]![p]!) / 765 * (1 - Math.exp(-filled[3]![p]!)));
  // Inside the star's glare the picture holds no detail, only the fill carried in from around it; where the ultraviolet
  // bands see the lobes (`detail`, in units of each band's scatter) the fill takes their detail, at the picture's own
  // scatter of log brightness over the lobes, and those faces count as the picture's own (MESH_DETAIL_KNOWN).
  if (detail) { const scatter = (() => { const logs = Float32Array.from(light, v => Math.log(Math.max(1e-4, v))), smooth = boxBlur(boxBlur(boxBlur(logs, width, height, 4), width, height, 4), width, height, 4), v: number[] = [];
      for (let p = 0; p < count; p++) if (crossed[p] && known[p] === 1 && light[p]! > .15) v.push(Math.abs(logs[p]! - smooth[p]!)); v.sort((a, b) => a - b); return (v[v.length >> 1] ?? .1) / .6745; })();
    for (let p = 0; p < count; p++) if (known[p]! < 1) light[p] = light[p]! * Math.exp(scatter * detail.value[p]! * detail.weight[p]! * (1 - known[p]!)); }
  const blurred = (field: Float32Array, radius: number, passes: number) => { let out = field; for (let pass = 0; pass < passes; pass++) out = boxBlur(out, width, height, radius); return out; };
  const around = blurred(light, MESH_PATCH_AROUND, 3), near = blurred(light, MESH_PATCH_NEAR, 2);
  const patch = Float32Array.from({ length: count }, (_, p) => { const lost = around[p]! > 0 ? 1 - near[p]! / around[p]! : 0, t = Math.max(0, Math.min(1, (lost - MESH_PATCH_FROM) / (MESH_PATCH_TO - MESH_PATCH_FROM))); return t * t * (3 - 2 * t); });
  const laneDark = surface.filaments?.darkness ?? 0;
  const laned = Float32Array.from(light, (value, p) => value * (1 - laneDark * (filaments?.[p] ?? 0))), shaded = Float32Array.from(laned, (value, p) => value * (1 - MESH_PATCH_DARK * patch[p]!));
  // The ramp: the approaching lobe's pixels where it is the nearest crossing, away from the star, by brightness in
  // MESH_RAMP_STEPS steps up to the 99.5th percentile; each step's color the median share of each channel. A step with no
  // pixels takes its nearest neighbour's.
  const ramp = (() => { const pixels: number[] = []; for (let p = 0; p < count; p++) if (crossed[p] && !lobes[most * p] && known[p] === 1) pixels.push(p);
    const top = pixels.map(p => light[p]!).sort((a, b) => a - b)[Math.floor(pixels.length * .995)] || 1, steps: number[][][] = Array.from({ length: MESH_RAMP_STEPS }, () => [[], [], []]);
    for (const p of pixels) { const r = filled[0]![p]!, g = filled[1]![p]!, b = filled[2]![p]!, total = r + g + b; if (!(total > 0)) continue; const step = Math.min(MESH_RAMP_STEPS - 1, Math.floor(light[p]! / top * MESH_RAMP_STEPS)); steps[step]![0]!.push(r / total); steps[step]![1]!.push(g / total); steps[step]![2]!.push(b / total); }
    const shares = steps.map(step => step[0]!.length ? step.map(values => { values.sort((a, b) => a - b); return values[values.length >> 1]!; }) : null);
    for (let i = 0; i < shares.length; i++) if (!shares[i]) { let d = 1; while (!shares[i - d] && !shares[i + d] && d < shares.length) d++; shares[i] = (shares[i - d] ?? shares[i + d] ?? [1 / 3, 1 / 3, 1 / 3]).slice(); }
    return { top, shares: shares as number[][] }; })();
  // The receding lobe, read where the picture shows it, has its own dust but is dimmed and reddened by the skirt in front
  // of it: its light is raised by the ratio of the two lobes' median light (each where it is the nearest crossing, away
  // from the star, at most MESH_MOST_GAIN), and its color is the approaching lobe's for its brightness (`ramp`).
  const medianWhere = (lobe: number) => { const values: number[] = []; for (let p = 0; p < count; p++) if (crossed[p] && lobes[most * p] === lobe && known[p] === 1) values.push(light[p]!); values.sort((a, b) => a - b); return values[values.length >> 1] ?? 0; };
  const recedingGain = (() => { const front = medianWhere(0), back = medianWhere(1); return back > 0 ? Math.max(1, Math.min(MESH_MOST_GAIN, front / back)) : 1; })();
  // The shell's opacity: the dark dust is solid; a face grows clear as it brightens past MESH_CLEAR_FROM of the
  // brightest light, down to MESH_OPACITY_FLOOR, so the glowing parts let the far wall and the star show through. A
  // lane or patch that darkens a face (`deepened`, the share of its light taken) is dust in front, opaque as far as it
  // darkens. A face keeps its own color; what shows through it adds its light.
  const opacityOf = (value: number, deepened: number) => { const t = Math.max(0, Math.min(1, (value / ramp.top - MESH_CLEAR_FROM) / (1 - MESH_CLEAR_FROM))); return Math.min(1, Math.max(1 - (1 - MESH_OPACITY_FLOOR) * t * t * (3 - 2 * t), deepened)); };
  // The approaching lobe's color for a brightness (`ramp`), as channel shares.
  const toned = (value: number, out: number[]) => { const at = Math.min(MESH_RAMP_STEPS - 1, Math.max(0, value / ramp.top * MESH_RAMP_STEPS - .5)), low = Math.floor(at), high = Math.min(MESH_RAMP_STEPS - 1, low + 1), t = at - low;
    for (let c = 0; c < 3; c++) out[c] = (1 - t) * ramp.shares[low]![c]! + t * ramp.shares[high]![c]!; };
  const tone = [0, 0, 0];
  // A pixel's color, opaque.
  const texel = (x: number, y: number, receding: boolean, out: number[]) => { const cx = Math.max(0, Math.min(width - 1, Math.round(x))), cy = Math.max(0, Math.min(height - 1, Math.round(y))), p = cy * width + cx, value = Math.min(ramp.top, shaded[p]! * (receding ? recedingGain : 1));
    toned(value, tone);
    // The pixel's own color where it is not deepened, sliding to the ramp's for its brightness as it is; the receding
    // lobe's is the ramp's.
    const total = filled[0]![p]! + filled[1]![p]! + filled[2]![p]!, kept = receding ? 0 : light[p]! > 0 ? (shaded[p]! / light[p]!) ** 2 : 1;
    const alpha = opacityOf(value, light[p]! > 0 ? 1 - shaded[p]! / light[p]! : 0);
    for (let c = 0; c < 3; c++) { const own = total > 0 ? filled[c]![p]! / total : 1 / 3; out[c] = Math.min(255, Math.round(765 * value * (kept * own + (1 - kept) * tone[c]!))); }
    out[3] = Math.round(255 * alpha); };
  // The surface's texture. Where the picture shows a face (`MESH_KNOWN_COS`), the face is the picture. The rest (flanks
  // seen edge-on, far sides, faces behind the other lobe, the star's glare) is synthesized on each lobe's chart from what
  // the picture shows of both lobes (`charted`), and takes the approaching lobe's color for its brightness (`ramp`).
  const oz = surface.originUnits[2], recedes = surface.pole.receding === '+z' ? 1 : -1, view = (() => { const length = Math.hypot(...toSun) || 1; return toSun.map(v => v / length); })();
  const lobeOf = (z: number) => (z - oz) * recedes > 0 ? 1 : 0;
  // Each corner's normal, outward: the mean of its faces', the faces turned the way that gives the closed surface a positive volume.
  const vertexNormals = new Float64Array(positions.length); let volume = 0;
  for (let i = 0; i < kept.length; i += 3) { const [a, b, c] = [kept[i]!, kept[i + 1]!, kept[i + 2]!].map(k => [0, 1, 2].map(axis => positions[3 * k + axis]!)) as [number[], number[], number[]];
    const e1 = b.map((v, k) => v - a[k]!), e2 = c.map((v, k) => v - a[k]!), n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    volume += a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) - a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) + a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!);
    for (const k of [kept[i]!, kept[i + 1]!, kept[i + 2]!]) for (let axis = 0; axis < 3; axis++) vertexNormals[3 * k + axis]! += n[axis]!; }
  const outward = volume >= 0 ? 1 : -1, cornerNormal = (corner: number) => { const k = kept[corner]!, n = [0, 1, 2].map(axis => vertexNormals[3 * k + axis]!), length = Math.hypot(...n) || 1; return n.map(v => outward * v / length); };
  const facingCos = (normal: readonly number[]) => (normal[0]! * view[0]! + normal[1]! * view[1]! + normal[2]! * view[2]!) / (Math.hypot(...normal) || 1);
  // How far a point is the picture's own: its pixel, and the share.
  const ownShare = (point: readonly number[], normal: readonly number[], lobe: number) => { const [px, py, depth] = place(point[0]!, point[1]!, point[2]!), cx = Math.round(px), cy = Math.round(py);
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return { px, py, share: 0 }; const p = cy * width + cx;
    if (!crossed[p] || lobes[most * p] !== lobe || Math.abs(depths[most * p]! - depth) > MESH_VISIBLE_ARCSEC) return { px, py, share: 0 };
    const t = Math.max(0, Math.min(1, (facingCos(normal) - MESH_KNOWN_COS) / (MESH_SEEN_COS - MESH_KNOWN_COS))), u = Math.max(0, Math.min(1, (around[p]! * (lobe ? recedingGain : 1) / ramp.top - MESH_LOBE_LIGHT[0]) / (MESH_LOBE_LIGHT[1] - MESH_LOBE_LIGHT[0])));
    return { px, py, share: known[p]! < 1 && !((detail?.weight[p] ?? 0) > MESH_DETAIL_KNOWN) ? 0 : t * t * (3 - 2 * t) * u * u * (3 - 2 * u) * (1 - (cover?.[p] ?? 0)) }; };
  // Each lobe on a chart of its own: a Mercator projection about the sight line from the lobe's middle (latitude from
  // the plane across the sight line, +90 degrees the point facing the Sun; longitude about it), conformal, so the dust
  // keeps its shape and only its scale changes, by sec(latitude), which the synthesis allows for. MESH_CHART_FROM_DEG
  // down to the far pole is a cap the chart does not reach. A chart is as many cells to a radian as its lobe's radius
  // in face pixels.
  const middleOf = (lobe: number) => { const sum = [0, 0, 0]; let n = 0; for (let i = 0; i < positions.length; i += 3) if (lobeOf(positions[i + 2]!) === lobe) { for (let k = 0; k < 3; k++) sum[k]! += positions[i + k]!; n++; } return n ? sum.map(v => v / n) : [...surface.originUnits]; };
  const pxPerUnit = surface.arcsecPerUnit / arcsecPerPixel, middles = [middleOf(0), middleOf(1)];
  const sideways = (() => { const along = view[2]!, e = [0, 0, 1].map((v, k) => v - along * view[k]!), length = Math.hypot(...e) || 1; return e.map(v => v / length); })();
  const third = [view[1]! * sideways[2]! - view[2]! * sideways[1]!, view[2]! * sideways[0]! - view[0]! * sideways[2]!, view[0]! * sideways[1]! - view[1]! * sideways[0]!];
  const radii = [0, 1].map(lobe => { const r: number[] = []; for (let i = 0; i < positions.length; i += 3) if (lobeOf(positions[i + 2]!) === lobe) r.push(Math.hypot(...[0, 1, 2].map(k => positions[i + k]! - middles[lobe]![k]!)) * pxPerUnit); r.sort((x, y) => x - y); return r[r.length >> 1] ?? 100; });
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat / 2)), fromLat = MESH_CHART_FROM_DEG * Math.PI / 180, toLat = MESH_CHART_TO_DEG * Math.PI / 180;
  const charts = radii.map(radius => { const width = Math.round(2 * Math.PI * radius), top = mercator(toLat), height = Math.round((top - mercator(fromLat)) * radius); return { radius, width, height, top }; });
  /** A point's place on its lobe's chart (column, row; may lie off the chart) and its latitude. */
  const onChart = (point: readonly number[], lobe: number) => { const d = point.map((v, k) => v - middles[lobe]![k]!), size = Math.hypot(...d) || 1, chart = charts[lobe]!;
    const lat = Math.asin(Math.max(-1, Math.min(1, (d[0]! * view[0]! + d[1]! * view[1]! + d[2]! * view[2]!) / size))), lon = Math.atan2(d[0]! * third[0]! + d[1]! * third[1]! + d[2]! * third[2]!, d[0]! * sideways[0]! + d[1]! * sideways[1]! + d[2]! * sideways[2]!);
    return { x: ((lon / (2 * Math.PI) + 1) % 1) * chart.width, y: (chart.top - mercator(Math.max(-1.55, Math.min(1.55, lat)))) * chart.radius, lat }; };
  // Each chart cell's point on the surface and its normal: the triangles drawn onto the charts.
  const cells = charts.map(chart => ({ point: new Float32Array(3 * chart.width * chart.height), normal: new Float32Array(3 * chart.width * chart.height), set: new Uint8Array(chart.width * chart.height) }));
  for (let i = 0; i < simple.length; i += 9) { const lobe = lobeOf((simple[i + 2]! + simple[i + 5]! + simple[i + 8]!) / 3), chart = charts[lobe]!, cell = cells[lobe]!, pts = [0, 1, 2].map(k => [0, 1, 2].map(axis => simple[i + 3 * k + axis]!)), nrm = [0, 1, 2].map(k => cornerNormal(i / 3 + k));
    const uv = pts.map(pt => { const c = onChart(pt, lobe); return [c.x, c.y]; }); if (Math.max(...uv.map(c => c[0]!)) - Math.min(...uv.map(c => c[0]!)) > chart.width / 2) for (const c of uv) if (c[0]! < chart.width / 2) c[0]! += chart.width;
    const area = (uv[1]![0]! - uv[0]![0]!) * (uv[2]![1]! - uv[0]![1]!) - (uv[2]![0]! - uv[0]![0]!) * (uv[1]![1]! - uv[0]![1]!); if (Math.abs(area) < 1e-9) continue;
    for (let y = Math.max(0, Math.floor(Math.min(...uv.map(c => c[1]!)))); y <= Math.min(chart.height - 1, Math.ceil(Math.max(...uv.map(c => c[1]!)))); y++) for (let x = Math.floor(Math.min(...uv.map(c => c[0]!))); x <= Math.ceil(Math.max(...uv.map(c => c[0]!))); x++) {
      const cx = x + .5, cy = y + .5, w1 = ((cx - uv[0]![0]!) * (uv[2]![1]! - uv[0]![1]!) - (uv[2]![0]! - uv[0]![0]!) * (cy - uv[0]![1]!)) / area, w2 = ((uv[1]![0]! - uv[0]![0]!) * (cy - uv[0]![1]!) - (cx - uv[0]![0]!) * (uv[1]![1]! - uv[0]![1]!)) / area;
      if (w1 < -1e-6 || w2 < -1e-6 || w1 + w2 > 1 + 1e-6) continue; const at = y * chart.width + ((x % chart.width) + chart.width) % chart.width;
      for (let axis = 0; axis < 3; axis++) { cell.point[3 * at + axis] = pts[0]![axis]! + w1 * (pts[1]![axis]! - pts[0]![axis]!) + w2 * (pts[2]![axis]! - pts[0]![axis]!); cell.normal[3 * at + axis] = nrm[0]![axis]! + w1 * (nrm[1]![axis]! - nrm[0]![axis]!) + w2 * (nrm[2]![axis]! - nrm[0]![axis]!); }
      cell.set[at] = 1; } }
  // The known cells: the picture's brightness (with its lanes; the receding lobe's raised), where the picture is the face's own.
  const known2 = charts.map(chart => new Uint8Array(chart.width * chart.height)), values = charts.map(chart => new Float32Array(chart.width * chart.height));
  for (const [lobe, chart] of charts.entries()) for (let at = 0; at < chart.width * chart.height; at++) { if (!cells[lobe]!.set[at]) continue; const own = ownShare([0, 1, 2].map(k => cells[lobe]!.point[3 * at + k]!), [0, 1, 2].map(k => cells[lobe]!.normal[3 * at + k]!), lobe);
    if (own.share >= 1) { values[lobe]![at] = Math.min(ramp.top, laned[Math.round(own.py) * width + Math.round(own.px)]! * (lobe ? recedingGain : 1)); known2[lobe]![at] = 1; } }
  // Quilting (Efros and Freeman 2001) on the charts: blocks of MESH_QUILT_BLOCK cells, in order from the known cells
  // outward, each the source block (from the known cells of both charts, read at the scale its latitude asks) that best
  // matches what is filled where they overlap, among MESH_QUILT_CANDIDATES drawn at random; pasted only on cells not yet
  // filled. Then the seams relaxed: the filled cells solve Poisson's equation with the pasted texture's own differences
  // inside each block and none across a block's edge, the known cells fixed, so the blocks meet without a step and keep
  // their detail (Pérez, Gangnet and Blake 2003).
  // A small surface takes smaller blocks: a sixth of its smaller lobe's radius, from 8 cells up to MESH_QUILT_BLOCK.
  const block = Math.max(8, Math.min(MESH_QUILT_BLOCK, Math.round(Math.min(...radii) / 6))), overlap = Math.round(block * MESH_QUILT_OVERLAP / MESH_QUILT_BLOCK), random = (() => { let state = 0x5eed; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; }; })();
  const sources: { lobe: number; x: number; y: number; scale: number }[] = [];
  for (const [lobe, chart] of charts.entries()) for (let y = block; y < chart.height - block; y += 2) for (let x = 0; x < chart.width; x += 2) {
    let whole = true; for (let dy = -block; dy <= block && whole; dy += 4) for (let dx = -block; dx <= block; dx += 4) if (!known2[lobe]![(y + dy) * chart.width + ((x + dx) % chart.width + chart.width) % chart.width]) { whole = false; break; }
    if (whole) sources.push({ lobe, x, y, scale: Math.cosh(chart.top - y / chart.radius) }); }
  if (!sources.length) throw new RangeError(`The surface (${surface.path}): no block of ${2 * block} cells is known on either lobe's chart.`);
  const read = (lobe: number, x: number, y: number) => { const chart = charts[lobe]!, yy = Math.max(0, Math.min(chart.height - 1.001, y)), y0 = Math.floor(yy), ty = yy - y0, x0 = Math.floor(x), tx = x - x0, at = (u: number, v: number) => values[lobe]![v * chart.width + ((u % chart.width) + chart.width) % chart.width]!;
    return (1 - ty) * ((1 - tx) * at(x0, y0) + tx * at(x0 + 1, y0)) + ty * ((1 - tx) * at(x0, Math.min(chart.height - 1, y0 + 1)) + tx * at(x0 + 1, Math.min(chart.height - 1, y0 + 1))); };
  const owner = charts.map(chart => new Int32Array(chart.width * chart.height).fill(-1));
  for (const [lobe, chart] of charts.entries()) {
    const done = Uint8Array.from(known2[lobe]!), distance = new Float32Array(chart.width * chart.height).fill(Infinity), centres: number[] = [];
    for (let at = 0; at < done.length; at++) if (done[at]) distance[at] = 0;
    for (let pass = 0; pass < 4; pass++) for (let y = pass % 2 ? chart.height - 1 : 0; pass % 2 ? y >= 0 : y < chart.height; y += pass % 2 ? -1 : 1) for (let x = pass % 2 ? chart.width - 1 : 0; pass % 2 ? x >= 0 : x < chart.width; x += pass % 2 ? -1 : 1) { const at = y * chart.width + x, d = pass % 2 ? 1 : -1, nx = ((x - d) % chart.width + chart.width) % chart.width;
      distance[at] = Math.min(distance[at]!, distance[y * chart.width + nx]! + 1, y - d >= 0 && y - d < chart.height ? distance[(y - d) * chart.width + x]! + 1 : Infinity); }
    const step = block - overlap;
    for (let y = 0; y < chart.height; y += step) for (let x = 0; x < chart.width; x += step) { let needs = false; for (let dy = 0; dy < block && !needs; dy++) for (let dx = 0; dx < block; dx++) { const yy = y + dy; if (yy >= chart.height) break; const at = yy * chart.width + (x + dx) % chart.width; if (cells[lobe]!.set[at] && !done[at]) { needs = true; break; } } if (needs) centres.push(y * chart.width + x); }
    centres.sort((a, b) => distance[a]! - distance[b]!);
    for (const [index, corner] of centres.entries()) { const x = corner % chart.width, y = (corner - x) / chart.width, scale = Math.cosh(chart.top - (y + block / 2) / chart.radius);
      const scored: { source: (typeof sources)[number]; score: number }[] = [];
      for (let k = 0; k < MESH_QUILT_CANDIDATES; k++) { const source = sources[Math.floor(random() * sources.length)]!, ratio = source.scale / scale; let cost = 0, n = 0;
        for (let dy = 0; dy < block; dy += 2) for (let dx = 0; dx < block; dx += 2) { const yy = y + dy; if (yy >= chart.height) continue; const at = yy * chart.width + (x + dx) % chart.width; if (!done[at]) continue;
          const diff = values[lobe]![at]! - read(source.lobe, source.x + (dx - block / 2) * ratio, source.y + (dy - block / 2) * ratio); cost += diff * diff; n++; }
        scored.push({ source, score: n ? cost / n : random() }); }
      // One of the MESH_QUILT_CHOICE best, at random, so no one block repeats over the chart.
      scored.sort((a, b) => a.score - b.score); const best = scored[Math.floor(random() * Math.min(MESH_QUILT_CHOICE, scored.length))]!.source, ratio = best.scale / scale;
      for (let dy = 0; dy < block; dy++) for (let dx = 0; dx < block; dx++) { const yy = y + dy; if (yy >= chart.height) continue; const at = yy * chart.width + (x + dx) % chart.width; if (done[at] || !cells[lobe]!.set[at]) continue;
        values[lobe]![at] = read(best.lobe, best.x + (dx - block / 2) * ratio, best.y + (dy - block / 2) * ratio); owner[lobe]![at] = index; done[at] = 1; } }
    // Poisson relaxation of the filled cells: guidance is the pasted field's own difference to a neighbour of the same block, none across blocks.
    const pasted = Float32Array.from(values[lobe]!), free = Uint8Array.from(owner[lobe]!, (o, at) => o >= 0 && cells[lobe]!.set[at] ? 1 : 0);
    for (let sweep = 0; sweep < MESH_RELAX_SWEEPS; sweep++) for (let y = 0; y < chart.height; y++) for (let x = 0; x < chart.width; x++) { const at = y * chart.width + x; if (!free[at]) continue; let sum = 0, n = 0;
      for (const [nx, ny] of [[(x + 1) % chart.width, y], [(x - 1 + chart.width) % chart.width, y], [x, y + 1], [x, y - 1]] as const) { if (ny < 0 || ny >= chart.height) continue; const q = ny * chart.width + nx; if (!cells[lobe]!.set[q]) continue;
        const guide = owner[lobe]![q] === owner[lobe]![at] ? pasted[at]! - pasted[q]! : 0; sum += values[lobe]![q]! + guide; n++; }
      if (n) values[lobe]![at] = sum / n; }
    // The filled cells' brightness given the known cells' distribution (rank for rank): the fill grows from the known
    // cells' edge, the darker ring where the picture turns edge-on, and would carry that darkness inward.
    const knownValues: number[] = [], filledAt: number[] = []; for (let at = 0; at < done.length; at++) { if (known2[lobe]![at]) knownValues.push(values[lobe]![at]!); else if (free[at]) filledAt.push(at); }
    knownValues.sort((a, b) => a - b); filledAt.sort((a, b) => values[lobe]![a]! - values[lobe]![b]!);
    if (knownValues.length) for (const [rank, at] of filledAt.entries()) values[lobe]![at] = knownValues[Math.min(knownValues.length - 1, Math.floor((rank + .5) / filledAt.length * knownValues.length))]!;
    // Cells no triangle covered take their neighbours' (`pushPull`), so a point reading between them finds no black.
    const [carried] = pushPull([values[lobe]!], Float32Array.from(cells[lobe]!.set), chart.width, chart.height); values[lobe]!.set(carried!); }
  /** A point's brightness from its lobe's chart; past the chart's far edge (the far cap) the chart's nearest row. */
  const charted = (point: readonly number[], lobe: number) => { const c = onChart(point, lobe); return read(lobe, c.x - .5, Math.min(charts[lobe]!.height - 1, c.y - .5)); };
  const synth = [0, 0, 0, 0];
  const surfaceTexel = (point: readonly number[], normal: readonly number[], out: number[]) => { const lobe = lobeOf(point[2]!), own = ownShare(point, normal, lobe);
    texel(own.px, own.py, lobe === 1, out); if (own.share >= 1) return;
    // Across the waist the two lobes' charts blend over MESH_WAIST_BLEND_ARCSEC either side of the plane between them,
    // so their fills meet without a line.
    const across = (point[2]! - oz) * recedes * surface.arcsecPerUnit / MESH_WAIST_BLEND_ARCSEC, w = Math.max(0, Math.min(1, (across + 1) / 2)), receding = w * w * (3 - 2 * w);
    const value = receding <= 0 || receding >= 1 ? charted(point, lobe) : (1 - receding) * charted(point, 0) + receding * charted(point, 1); toned(value, tone); const alpha = opacityOf(value, 0); for (let c = 0; c < 3; c++) synth[c] = Math.min(255, 765 * value * tone[c]!); synth[3] = 255 * alpha;
    for (let c = 0; c < 4; c++) out[c] = own.share * out[c]! + (1 - own.share) * synth[c]!; };
  const made: SurfaceTriangle[] = [];
  for (let index = 0; index < simple.length; index += 9) {
    const corners = [0, 1, 2].map(k => place(simple[index + 3 * k]!, simple[index + 3 * k + 1]!, simple[index + 3 * k + 2]!)) as SurfaceTriangle['corners'];
    // The longest side is the parallelogram's diagonal, so the texture's clear half is as thin as it can be.
    const side = (a: number, b: number) => Math.hypot(corners[a]![0] - corners[b]![0], corners[a]![1] - corners[b]![1], (corners[a]![2] - corners[b]![2]) / arcsecPerPixel);
    const longest = [side(1, 2), side(2, 0), side(0, 1)], apex = longest.indexOf(Math.max(...longest));
    const ordered = [corners[apex]!, corners[(apex + 1) % 3]!, corners[(apex + 2) % 3]!] as SurfaceTriangle['corners'];
    const file = [apex, (apex + 1) % 3, (apex + 2) % 3].map(k => [0, 1, 2].map(axis => simple[index + 3 * k + axis]!));
    const normals = [apex, (apex + 1) % 3, (apex + 2) % 3].map(k => cornerNormal(index / 3 + k));
    const along = side((apex + 1) % 3, apex), down = side((apex + 2) % 3, apex);
    const columns = Math.max(2, Math.min(MESH_MOST_TEXELS, Math.ceil(along * MESH_TEXELS_PER_PIXEL) + 2)), rows = Math.max(2, Math.min(MESH_MOST_TEXELS, Math.ceil(down * MESH_TEXELS_PER_PIXEL) + 2));
    // Every edge is shared: each triangle reaches MESH_EDGE_MARGIN texels past all three of its sides, and the band half
    // a texel either side of a side holds 1 - sqrt(1 - a) of the face's opacity a, so the two triangles over it make a
    // together, opaque or clear: no gap shows the wall behind and no edge is covered twice.
    const m = MESH_EDGE_MARGIN, wide = columns + 2 * m, tall = rows + 2 * m, rgba = Buffer.alloc(4 * wide * tall), across = Math.hypot(1 / columns, 1 / rows);
    for (let row = 0; row < tall; row++) for (let column = 0; column < wide; column++) { const s = (column - m + .5) / columns, t = (row - m + .5) / rows;
      const o = 4 * (row * wide + column), mixed = [0, 0, 0, 0];
      surfaceTexel([0, 1, 2].map(axis => file[0]![axis]! + s * (file[1]![axis]! - file[0]![axis]!) + t * (file[2]![axis]! - file[0]![axis]!)), [0, 1, 2].map(axis => normals[0]![axis]! + s * (normals[1]![axis]! - normals[0]![axis]!) + t * (normals[2]![axis]! - normals[0]![axis]!)), mixed);
      // Color is kept under clear texels too, so the lossy encoding has no dark edge to bleed in.
      for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(mixed[c]!);
      rgba[o + 3] = Math.round(255 * edgeShare(mixed[3]! / 255, Math.min(t * rows, s * columns, (1 - s - t) / across))); }
    const du = ordered[1].map((value, k) => (value - ordered[0][k]!) / columns), dv = ordered[2].map((value, k) => (value - ordered[0][k]!) / rows);
    const origin = ordered[0].map((value, k) => value - m * du[k]! - m * dv[k]!);
    const grown = [origin, origin.map((value, k) => value + wide * du[k]!), origin.map((value, k) => value + tall * dv[k]!)] as SurfaceTriangle['corners'];
    made.push({ corners: grown, texture: [wide, tall], rgba });
  }
  return made;
}

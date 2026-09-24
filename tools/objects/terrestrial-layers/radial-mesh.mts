import type { SimplifierFlags } from 'meshoptimizer/simplifier';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import type { PreparedTriangle, SourceMesh, SourceScalar } from './contracts.mts';
import { removeOppositeFacePairs } from './mesh-face-pairs.mts';
import { repairImageDemDiagonals, measureImageDemReduction } from './image-dem-reduction.mts';
import { validateObservedReduction } from './open-surface.mts';

export interface RadialSimplification {method?: string; targetFaces: number; maximumErrorMeters: number; regularize?: boolean; prune?: boolean;}
export interface TerrainMesh extends SourceMesh {
  coverage?: Record<string, unknown>; lockedPositions?: readonly number[][]; imagePlaneCoordinates?: number[][];
  sourceOrientation?: unknown; heightAt?(x: number, y: number): number | null;
}
export type TerrainGrid = SourceScalar & Partial<TerrainMesh>;
function isTerrainMesh(grid: TerrainGrid): grid is TerrainMesh {
  return grid.positions !== undefined && grid.indices !== undefined && grid.bounds !== undefined && grid.vertices !== undefined && grid.faces !== undefined &&
    grid.hit !== undefined && grid.intersect !== undefined && grid.closestPoint !== undefined;
}
export function requireTerrainMesh(grid: TerrainGrid): TerrainMesh {
  if (!isTerrainMesh(grid)) throw new TypeError('Terrain operation requires a source mesh.');
  return grid;
}

export interface RadialSamplingProfile {latitudeSegments: number; longitudeSegments: number; faceBudget: number;}
export type RadiusSampler = (longitude: number, latitude: number) => number | null;
type UnshadedFace = {vertices: readonly (readonly number[])[]; normal: number[]; estimated?: boolean; vertexNormals?: number[][]};
export type RadialFaces = PreparedTriangle[] & {simplification?: Record<string, unknown>};

const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: readonly number[]) => a.map(v => v / Math.hypot(...a));

/** Simplify the released topology before UV sampling. Original positions are
 * retained; geometry and the simplifier never enter the browser runtime. */
export async function simplifyRadialShape(mesh: TerrainMesh, profile: {faceBudget: number; sourceTopology?: string; simplification: RadialSimplification}, scale: number) {
  const { targetFaces, maximumErrorMeters } = profile.simplification;
  if (!mesh.positions || !mesh.indices || !Number.isInteger(targetFaces) || targetFaces < 4 ||
      !Number.isInteger(profile.faceBudget) || targetFaces > profile.faceBudget || profile.faceBudget > 4000 ||
      !(maximumErrorMeters > 0) || !Number.isFinite(maximumErrorMeters) || !(scale > 0) ||
      (['regularize', 'prune'] as const).some(key => profile.simplification[key] !== undefined && typeof profile.simplification[key] !== 'boolean')) throw new TypeError('Invalid source mesh simplification.');
  await MeshoptSimplifier.ready;
  const preserveSource = profile.simplification.method === 'source-meshoptimizer';
  const open = profile.sourceTopology === 'open';
  if (open && (!preserveSource || profile.simplification.prune)) throw new TypeError('Open observations must retain every source boundary.');
  let sourceIndices = Uint32Array.from(mesh.indices.flat()), positions = mesh.positions;
  if (preserveSource && !open) {
    // ICQ releases duplicate cube-edge positions. Weld before assigning UVs,
    // using the same meshoptimizer remap and physical compaction as Vesta.
    const remap = MeshoptSimplifier.generatePositionRemap(Float32Array.from(positions.flat()), 3);
    sourceIndices = sourceIndices.map(index => remap[index]);
    const [compact, count] = MeshoptSimplifier.compactMesh(sourceIndices);
    const unique = new Array<number[]>(count);
    for (let i = 0; i < compact.length; i++) if (compact[i] !== 0xffffffff) unique[compact[i]] = positions[i];
    positions = unique;
  }
  const flags: SimplifierFlags[] = ['ErrorAbsolute', ...(preserveSource && profile.simplification.regularize ? ['RegularizeLight' as const] : []),
    ...(preserveSource && profile.simplification.prune ? ['Prune' as const] : []), ...(open ? ['LockBorder' as const] : [])];
  // Source-defined junctions must survive reduction. Compare at the same
  // Float32 precision used by the position weld and meshoptimizer.
  const positionKey = (v: readonly number[]) => v.map(Math.fround).join(',');
  const locked = new Set((mesh.lockedPositions ?? []).map(positionKey));
  if (locked.size && (!preserveSource || [...locked].some(key => !positions.some(v => positionKey(v) === key)))) {
    throw new TypeError('Source mesh locks must identify retained source positions.');
  }
  const locks = locked.size ? Uint8Array.from(positions, v => locked.has(positionKey(v)) ? 1 : 0) : null;
  const imagePlane = Boolean(mesh.imageGrid);
  if (imagePlane && (!open || !preserveSource || locks)) throw new TypeError('Image DEMs require open source surface reduction.');
  const packedPositions = Float32Array.from(positions.flat());
  // Collapse in the image plane with scaled height as an attribute. This
  // preserves the height-field orientation, unlike unconstrained 3D collapse.
  const extent = imagePlane ? Math.max(...[0, 1].map(axis => mesh.bounds[1][axis] - mesh.bounds[0][axis])) : 0;
  const [simplified, error] = imagePlane
    ? MeshoptSimplifier.simplifyWithAttributes(sourceIndices,
      Float32Array.from(positions.flatMap(p => [p[0], p[1], 0])), 3,
      Float32Array.from(positions, p => p[2] / extent), 1, [1], null,
      targetFaces * 3, maximumErrorMeters, flags)
    : locks
    ? MeshoptSimplifier.simplifyWithAttributes(sourceIndices, packedPositions, 3,
      new Float32Array(), 0, [], locks, targetFaces * 3, maximumErrorMeters, flags)
    : MeshoptSimplifier.simplify(sourceIndices, packedPositions, 3, targetFaces * 3, maximumErrorMeters, flags);
  // Edge collapses can leave exactly coincident, oppositely wound face pairs
  // (zero-volume fins). Cancel only those exact pairs, then require closure.
  // No positions are moved and no source feature is approximated in cleanup.
  const cleaned = preserveSource ? removeOppositeFacePairs(simplified) : simplified;
  if (imagePlane && !mesh.imagePlaneCoordinates) throw new Error('Image DEM lacks its source plane coordinates.');
  const repaired = imagePlane && mesh.imagePlaneCoordinates ? repairImageDemDiagonals(cleaned, mesh.imagePlaneCoordinates) : null;
  const indices = repaired?.indices ?? cleaned;
  if (!indices.length || indices.length / 3 > targetFaces) throw new Error(`Source mesh reached ${indices.length / 3} faces at ${error} m estimated error; requested ${targetFaces} within ${maximumErrorMeters} m.`);
  const topology = open ? validateObservedReduction(sourceIndices, indices, positions)
    : preserveSource ? validateClosedMesh(indices, positions) : undefined;
  const imageReduction = repaired ? { diagonalFlips: repaired.flips,
    ...measureImageDemReduction(mesh, indices, maximumErrorMeters) } : undefined;
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) triangles.push(Array.from(indices.subarray(i, i + 3),
    index => positions[index].map(value => value * scale)));
  const faces = surfaceTriangles(triangles, preserveSource);
  if (preserveSource) faces.simplification = { method: 'source-meshoptimizer', version: '1.2.0', flags,
    sourceFaces: mesh.indices.length, sourceVertices: mesh.positions.length, weldedVertices: positions.length,
    targetFaces, outputFaces: faces.length, removedOppositeFaces: (simplified.length - indices.length) / 3,
    maximumErrorMeters, ...(imagePlane ? { imageReduction, optimizerError: error,
      optimizerErrorUnits: 'Combined planar and normalized height metric; physical metre deviations measured separately.' }
      : { estimatedErrorMeters: error }), topology,
    ...(locks ? { lockedVertices: locks.reduce((sum, n) => sum + n, 0) } : {}),
    ...(open ? { sourceTopology: 'open', sourceOrientation: mesh.sourceOrientation } : {}) };
  return faces;
}

/** Edge incidents establish orientation without assuming a radial surface or
 * requiring a single component. The signed volume rejects inverted shells. */
export function validateClosedMesh(indices: Uint32Array | readonly number[], positions: readonly (readonly number[])[]) {
  const edges = new Map<string, number[]>(), vertices = new Set<number>(), parents = new Map<number, number>();
  const parent=(v: number)=>{const result=parents.get(v);if(result===undefined)throw new Error('Missing mesh connectivity vertex.');return result;};
  const find = (v: number) => { let root = v; while (parent(root) !== root) root = parent(root); return root; };
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3)), [a, b, c] = triangle.map(index => positions[index]);
    if (triangle.length !== 3 || ![a, b, c].every(v => v?.length === 3 && v.every(Number.isFinite)) ||
        !(Math.hypot(...cross(sub(b, a), sub(c, a))) > 0)) throw new Error('Source mesh has a degenerate face.');
    volume += dot(a, cross(b, c)) / 6;
    for (const v of triangle) { vertices.add(v); if (!parents.has(v)) parents.set(v, v); }
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
      const edge = edges.get(key) ?? [0, 0]; edge[0]++; edge[1] += a < b ? 1 : -1; edges.set(key, edge);
      const rootA = find(a), rootB = find(b); if (rootA !== rootB) parents.set(rootB, rootA);
    }
  }
  if (![...edges.values()].every(([count, winding]) => count === 2 && winding === 0) || !(volume > 0)) {
    throw new Error('Source mesh is not closed and consistently outward wound.');
  }
  return { vertices: vertices.size, edges: edges.size, faces: indices.length / 3,
    components: new Set([...vertices].map(find)).size, eulerCharacteristic: vertices.size - edges.size + indices.length / 3,
    signedVolumeCubicMeters: volume };
}

export function radialTriangles(sample: RadiusSampler, profile: RadialSamplingProfile, scale: number) {
  const { latitudeSegments: rows, longitudeSegments: columns, faceBudget } = profile;
  if (![rows, columns, faceBudget].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > faceBudget || faceBudget > 2000 || !(scale > 0)) throw new TypeError('Invalid radial mesh budget.');
  return sampleRadialTriangles(sample, rows, columns, scale);
}

export function sampleRadialTriangles(sample: RadiusSampler, rows: number, columns: number, scale: number, canonicalPoles = false) {
  if (![rows, columns].every(n => Number.isInteger(n) && n >= 4) ||
      2 * columns * (rows - 1) > 262144 || !Number.isFinite(scale) || !(scale > 0)) throw new TypeError('Invalid radial sampling budget.');
  const point = (row: number, col: number) => {
    const pole = row === 0 || row === rows;
    const latitude = -90 + row * 180 / rows, longitude = canonicalPoles && pole ? 0 : col * 360 / columns;
    const radius = sample(longitude, latitude);
    if (radius === null || !(radius > 0)) throw new Error(`Terrain model has no radius at ${longitude}, ${latitude}; no geometry fallback is supplied.`);
    if (canonicalPoles && pole) return [0, 0, (row === 0 ? -1 : 1) * radius * scale];
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    return [radius * scale * Math.cos(lat) * Math.cos(lon), radius * scale * Math.cos(lat) * Math.sin(lon), radius * scale * Math.sin(lat)];
  };
  const faces: UnshadedFace[] = [];
  function triangle(a: number[], b: number[], c: number[]) {
    let normal = cross(sub(b, a), sub(c, a));
    if (dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    faces.push({ vertices: [a, b, c], normal: unit(normal) });
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = point(row, col), b = point(row, (col + 1) % columns), c = point(row + 1, (col + 1) % columns), d = point(row + 1, col);
    if (row !== 0) triangle(a, b, c);
    if (row !== rows - 1) triangle(a, c, d);
  }
  return shadeRadialFaces(faces);
}

function surfaceTriangles(triangles: readonly number[][][], preserveSourceWinding = false) {
  const faces = triangles.map(([a, b, c]) => {
    let normal = cross(sub(b, a), sub(c, a));
    if (!preserveSourceWinding && dot(normal, a) < 0) { [b, c] = [c, b]; normal = normal.map(x => -x); }
    if (!(Math.hypot(...normal) > 1e-8)) throw new Error('Degenerate terrain face.');
    return { vertices: [a, b, c], normal: unit(normal) };
  });
  return shadeRadialFaces(faces);
}

export function shadeRadialFaces(faces: UnshadedFace[]): RadialFaces {
  // Area-weighted shared normals remove lighting discontinuities without
  // changing any source-derived position or smoothing the physical silhouette.
  const key = (vertex: readonly number[]) => vertex.map(value => Math.round(value * 1e6)).join(',');
  const sums = new Map<string, number[]>();
  for (const face of faces) {
    const normal = cross(sub(face.vertices[1], face.vertices[0]), sub(face.vertices[2], face.vertices[0]));
    for (const vertex of face.vertices) {
      const id = key(vertex), sum = sums.get(id) ?? [0, 0, 0];
      sums.set(id, sum.map((value, axis) => value + normal[axis]));
    }
  }
  for (const face of faces) face.vertexNormals = face.vertices.map(vertex => unit(sums.get(key(vertex)) ?? (() => { throw new Error('Missing accumulated face normal.'); })()));
  // Every input face above now owns its prepared vertex normals; retain the array identity.
  return faces as RadialFaces;
}

/** Simplify before UV/lighting baking so atlas seams cannot constrain collapses. */
export async function simplifyRadialTerrain(sample: RadiusSampler, profile: RadialSamplingProfile & {simplification: RadialSimplification}, scale: number) {
  const options = profile.simplification;
  if (options?.method !== 'meshoptimizer' || !Number.isInteger(options.targetFaces) || options.targetFaces < 4 ||
      !Number.isInteger(profile.faceBudget) || options.targetFaces > profile.faceBudget || profile.faceBudget > 2000 ||
      !Number.isFinite(options.maximumErrorMeters) || options.maximumErrorMeters <= 0 ||
      (options.regularize !== undefined && typeof options.regularize !== 'boolean')) {
    throw new TypeError('Invalid radial meshoptimizer budget or error limit.');
  }
  const dense = sampleRadialTriangles(sample, profile.latitudeSegments, profile.longitudeSegments, scale, true);
  if (dense.length < options.targetFaces) throw new TypeError('Radial source mesh is smaller than its simplification target.');
  await MeshoptSimplifier.ready;
  const sourceVertices = dense.flatMap(face => face.vertices);
  // Exact-position welding removes face duplication and joins the longitude
  // seam and canonical poles. Keep original source positions for final output.
  const remap = MeshoptSimplifier.generatePositionRemap(new Float32Array(sourceVertices.flat()), 3);
  const indices = new Uint32Array(remap);
  const [compact, vertexCount] = MeshoptSimplifier.compactMesh(indices);
  const vertices = new Array<readonly number[]>(vertexCount);
  for (let i = 0; i < compact.length; i++) if (compact[i] !== 0xffffffff) {
    vertices[compact[i]] = sourceVertices[i];
  }
  const positions = new Float32Array(vertices.flat());
  const flags: SimplifierFlags[] = ['ErrorAbsolute', ...(options.regularize ? ['RegularizeLight' as const] : [])];
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3,
    options.targetFaces * 3, options.maximumErrorMeters * scale, flags);
  if (simplified.length / 3 > options.targetFaces || error > options.maximumErrorMeters * scale) {
    throw new Error(`Meshoptimizer reached ${simplified.length / 3} faces at ${(error / scale).toFixed(3)} m estimated error; requested ${options.targetFaces} faces within ${options.maximumErrorMeters} m.`);
  }
  const edges = new Map<string, [number, number]>();
  for (let i = 0; i < simplified.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = simplified[i + j], b = simplified[i + (j + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`, edge = edges.get(key) ?? [0, 0];
    edge[0]++; edge[1] += a < b ? 1 : -1; edges.set(key, edge);
  }
  if ([...edges.values()].some(([count, winding]) => count !== 2 || winding !== 0) ||
      new Set(simplified).size - edges.size + simplified.length / 3 !== 2) {
    throw new Error('Meshoptimizer result is not a closed, consistently wound spherical topology.');
  }
  const faces = [];
  for (let i = 0; i < simplified.length; i += 3) {
    const triangle = [...simplified.subarray(i, i + 3)].map(index => vertices[index]);
    const [a, b, c] = triangle, ab = b.map((v, j) => v - a[j]), ac = c.map((v, j) => v - a[j]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const length = Math.hypot(...normal);
    if (!(length > 1e-8)) {
      throw new Error('Meshoptimizer produced a degenerate face.');
    }
    faces.push({ vertices: triangle, normal: normal.map(v => v / length) });
  }
  return { faces: shadeRadialFaces(faces), report: {
    method: 'meshoptimizer', version: '1.2.0', flags, sourceFaces: dense.length,
    sourceVertices: vertexCount, targetFaces: options.targetFaces, outputFaces: faces.length,
    maximumErrorMeters: options.maximumErrorMeters, estimatedErrorMeters: error / scale,
  } };
}

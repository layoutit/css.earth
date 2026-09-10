import type {SimplifierFlags} from 'meshoptimizer/simplifier';
import type {RadiusSampler, RadialSamplingProfile} from './radial-terrain.mts';
export interface RadialSimplification {method?: string; targetFaces: number; maximumErrorMeters: number; regularize?: boolean; prune?: boolean;}
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { sampleRadialTriangles, shadeRadialFaces } from './radial-terrain.mts';

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

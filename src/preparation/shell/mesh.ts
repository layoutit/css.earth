/** Offline mesh construction; runtime receives only retained transforms and source-derived normals. */
import type { ShellRecipe } from './config.js';
import { record, triple, type Vector3 } from '../volume/config.js';
import { verifiedBytes } from '../volume/source.js';

export interface ShellMesh {
  positionsUnits: Vector3[];
  radialNormals: Vector3[];
  triangles: [number, number, number][];
}
export function unitVector(v: Vector3): Vector3 {
  const length = Math.hypot(...v);
  if (!(length > 0)) throw new TypeError('Shell contains a degenerate direction.');
  return v.map(n => n / length) as Vector3;
}
export function prepareShellMesh(recipe: ShellRecipe): ShellMesh {
  const s = recipe.shape;
  if (s.kind !== 'asymmetric-radial-shell') throw new TypeError('Indexed geometry must be loaded from its pinned source.');
  const rows = s.latitudeSegments, columns = s.longitudeSegments + 1;
  const positionsUnits: Vector3[] = [], radialNormals: Vector3[] = [], triangles: [number, number, number][] = [];
  for (let j = 0; j <= rows; j++) {
    const theta = j * Math.PI / rows, sinTheta = j === 0 || j === rows ? 0 : Math.sin(theta);
    for (let i = 0; i < s.longitudeSegments; i++) {
      const phi = i * 2 * Math.PI / s.longitudeSegments;
      const x = sinTheta === 0 ? 0 : -sinTheta * Math.cos(phi), y = Math.cos(theta);
      const z = sinTheta === 0 ? 0 : sinTheta * Math.sin(phi), tail = Math.max(-x, 0) ** s.tailExponent;
      // Round normalized coordinates before computing radial normals, as the source does.
      const p: Vector3 = [Math.fround(x * (1 + s.tailExtension * tail)),
        Math.fround(y * (s.transverseScale - s.transverseContraction * tail)),
        Math.fround(z * (s.transverseScale - s.transverseContraction * tail) + s.lobeAmplitude * tail * Math.tanh(s.lobeSharpness * z))];
      radialNormals.push(unitVector(p).map(Math.fround) as Vector3);
      positionsUnits.push(p.map(n => n * s.radiusUnits) as Vector3);
    }
    positionsUnits.push([...positionsUnits[j * columns]!]);
    radialNormals.push([...radialNormals[j * columns]!]);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < s.longitudeSegments; i++) {
    const a = j * columns + i, b = a + columns;
    if (j !== 0) triangles.push([a, b, a + 1]);
    if (j !== rows - 1) triangles.push([a + 1, b, b + 1]);
  }
  return { positionsUnits, radialNormals, triangles };
}

/** Reads numeric right-handed geometry. Open meshes remain open: no caps or interpolation are invented. */
export function parseIndexedShellMesh(value: unknown): ShellMesh {
  const source = record(value, 'indexed surface');
  if (source.schema !== 'cssearth-indexed-surface@1' || !Array.isArray(source.positionsUnits) ||
      source.positionsUnits.length < 3 || !Array.isArray(source.triangles) || source.triangles.length < 1 || source.triangles.length > 20_000) {
    throw new TypeError('Indexed surface needs positions and a bounded nonempty triangle list.');
  }
  const positionsUnits = source.positionsUnits.map((v: unknown) => triple(v, 'source vertex'));
  const radialNormals = positionsUnits.map(unitVector);
  const triangles = source.triangles.map((value: unknown): [number, number, number] => {
    if (!Array.isArray(value) || value.length !== 3 || value.some(i => !Number.isInteger(i) || i < 0 || i >= positionsUnits.length) || new Set(value).size !== 3) {
      throw new TypeError('Indexed surface contains an invalid triangle index.');
    }
    const [ia, ib, ic] = value as [number, number, number], a = positionsUnits[ia]!, b = positionsUnits[ib]!, c = positionsUnits[ic]!;
    const ab = b.map((n, axis) => n - a[axis]!) as Vector3, ac = c.map((n, axis) => n - a[axis]!) as Vector3;
    unitVector([ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]);
    return [ia, ib, ic];
  });
  return { positionsUnits, radialNormals, triangles };
}
export async function loadShellMesh(sourceDirectory: string, recipe: ShellRecipe): Promise<ShellMesh> {
  if (recipe.shape.kind === 'asymmetric-radial-shell') return prepareShellMesh(recipe);
  const bytes = await verifiedBytes(sourceDirectory, recipe.shape);
  return parseIndexedShellMesh(JSON.parse(bytes.toString('utf8')) as unknown);
}

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
  if (!(length > 0) || !Number.isFinite(length)) throw new TypeError('Shell contains a degenerate direction.');
  return v.map(n => n / length) as Vector3;
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
  const bytes = await verifiedBytes(sourceDirectory, recipe.shape);
  const input: unknown = JSON.parse(bytes.toString('utf8'));
  return recipe.shape.kind === 'gridded-surface' ? parseGriddedShellMesh(input) : parseIndexedShellMesh(input);
}

/** Connects adjacent published samples; null samples leave holes, including at the grid boundary. */
export function parseGriddedShellMesh(value: unknown): ShellMesh {
  const source = record(value, 'gridded surface'), rows = source.positionsUnits;
  if (source.schema !== 'cssearth-surface-grid@1' || !Array.isArray(rows) || rows.length < 2 ||
      !Array.isArray(rows[0]) || rows[0].length < 2 || rows.length * rows[0].length > 12_000) {
    throw new TypeError('Gridded surface needs a bounded rectangular sample array.');
  }
  const columns = rows[0].length, positionsUnits: Vector3[] = [], radialNormals: Vector3[] = [];
  const indices = rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns) throw new TypeError('Gridded surface rows must have equal length.');
    return row.map(value => {
      if (value === null) return -1;
      const position = triple(value, 'grid vertex'), index = positionsUnits.length;
      positionsUnits.push(position); radialNormals.push(unitVector(position)); return index;
    });
  });
  const triangles: [number, number, number][] = [];
  const connect = (ia: number, ib: number, ic: number) => {
    if (ia < 0 || ib < 0 || ic < 0) return;
    const a = positionsUnits[ia]!, b = positionsUnits[ib]!, c = positionsUnits[ic]!;
    const ab = b.map((n, i) => n - a[i]!) as Vector3, ac = c.map((n, i) => n - a[i]!) as Vector3;
    const normal: Vector3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    // Geographic grids repeat their pole sample; do not create zero-area triangles.
    const scale = Math.max(Math.hypot(...ab), Math.hypot(...ac), Math.hypot(...b.map((n, i) => n - c[i]!)));
    if (scale === 0 || Math.hypot(...normal) <= scale * scale * 1e-12) return;
    const outward = normal.reduce((sum, n, i) => sum + n * a[i]!, 0);
    if (outward === 0) throw new TypeError('Surface grid contains an edge-on radial face.');
    triangles.push(outward > 0 ? [ia, ib, ic] : [ia, ic, ib]);
  };
  for (let row = 0; row < rows.length - 1; row++) for (let column = 0; column < columns - 1; column++) {
    const a = indices[row]![column]!, b = indices[row + 1]![column]!, c = indices[row]![column + 1]!, d = indices[row + 1]![column + 1]!;
    connect(a, b, c); connect(c, b, d);
  }
  if (!triangles.length || triangles.length > 20_000) throw new TypeError('Surface grid has no usable faces or exceeds the prepared face budget.');
  return { positionsUnits, radialNormals, triangles };
}

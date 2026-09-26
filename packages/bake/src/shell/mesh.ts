/** Offline mesh construction; runtime receives only retained transforms and source-derived normals. */
import type { ShellRecipe } from './config.ts';
import { requireRecord as record } from '@cssearth/core';
import { triple, type Vector3 } from '../volume/index.ts';
import { sourceBytes } from '../volume/node/index.ts';

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
  const bytes = await sourceBytes(sourceDirectory, recipe.shape);
  const input: unknown = JSON.parse(bytes.toString('utf8'));
  const mesh = recipe.shape.kind === 'gridded-surface' ? parseGriddedShellMesh(input) : parseIndexedShellMesh(input);
  return recipe.shape.displaySubdivision ? subdivideRadialMesh(mesh, recipe.shape.displaySubdivision.segmentsPerEdge) : mesh;
}

/** Offline radial interpolation: exact samples, shared curved edges, and smooth surface-derived display normals. */
export function subdivideRadialMesh(mesh: ShellMesh, segmentsPerEdge: number): ShellMesh {
  if (!Number.isSafeInteger(segmentsPerEdge) || segmentsPerEdge < 1 || segmentsPerEdge > 8) {
    throw new TypeError('Radial subdivision segments must be an integer from 1 through 8.');
  }
  if (mesh.triangles.length * segmentsPerEdge ** 2 > 20_000) {
    throw new TypeError('Radial subdivision exceeds the prepared face budget.');
  }
  const scale = Math.max(...mesh.positionsUnits.map(position => Math.hypot(...position)));
  const tolerance = Math.max(scale * 1e-12, Number.EPSILON);
  const buckets = new Map<string, number[]>(), canonical = new Uint32Array(mesh.positionsUnits.length);
  const bucketKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (let index = 0; index < mesh.positionsUnits.length; index++) {
    const position = mesh.positionsUnits[index]!;
    const cell = position.map(value => Math.round(value / tolerance));
    let match = -1;
    for (let x = -1; x <= 1 && match < 0; x++) for (let y = -1; y <= 1 && match < 0; y++) for (let z = -1; z <= 1 && match < 0; z++) {
      for (const candidate of buckets.get(bucketKey(cell[0]! + x, cell[1]! + y, cell[2]! + z)) ?? []) {
        if (Math.hypot(...position.map((value, axis) => value - mesh.positionsUnits[candidate]![axis]!)) <= tolerance) { match = candidate; break; }
      }
    }
    canonical[index] = match < 0 ? index : canonical[match]!;
    const key = bucketKey(cell[0]!, cell[1]!, cell[2]!);
    const members = buckets.get(key); if (members) members.push(index); else buckets.set(key, [index]);
  }
  const positionsUnits = mesh.positionsUnits.map(position => [...position] as Vector3);
  const edgeVertices = new Map<string, number>(), triangles: [number, number, number][] = [];
  const point = (sourceTriangle: readonly [number, number, number], weights: readonly [number, number, number], triangleIndex: number): number => {
    const active = weights.flatMap((weight, corner) => weight > 0 ? [corner] : []);
    if (active.length === 1) return canonical[sourceTriangle[active[0]!]!]!;
    let key: string;
    if (active.length === 2) {
      const ia = canonical[sourceTriangle[active[0]!]!]!, ib = canonical[sourceTriangle[active[1]!]!]!;
      const wa = weights[active[0]!]!, wb = weights[active[1]!]!;
      key = ia < ib ? `e:${ia}:${ib}:${wb}` : `e:${ib}:${ia}:${wa}`;
    } else key = `t:${triangleIndex}:${weights.join(':')}`;
    const cached = edgeVertices.get(key); if (cached !== undefined) return cached;
    const direction: Vector3 = [0, 0, 0]; let radius = 0;
    for (let corner = 0; corner < 3; corner++) {
      const position = mesh.positionsUnits[sourceTriangle[corner]!]!, weight = weights[corner]! / segmentsPerEdge;
      const sourceRadius = Math.hypot(...position); radius += weight * sourceRadius;
      for (let axis = 0; axis < 3; axis++) direction[axis] += weight * position[axis]! / sourceRadius;
    }
    const unit = unitVector(direction), index = positionsUnits.length;
    positionsUnits.push(unit.map(value => value * radius) as Vector3); edgeVertices.set(key, index); return index;
  };
  mesh.triangles.forEach((source, triangleIndex) => {
    const grid: number[][] = [];
    for (let i = 0; i <= segmentsPerEdge; i++) {
      grid[i] = [];
      for (let j = 0; j <= segmentsPerEdge - i; j++) grid[i]![j] = point(source,
        [segmentsPerEdge - i - j, i, j], triangleIndex);
    }
    for (let i = 0; i < segmentsPerEdge; i++) for (let j = 0; j < segmentsPerEdge - i; j++) {
      triangles.push([grid[i]![j]!, grid[i + 1]![j]!, grid[i]![j + 1]!]);
      if (j < segmentsPerEdge - i - 1) triangles.push([grid[i + 1]![j]!, grid[i + 1]![j + 1]!, grid[i]![j + 1]!]);
    }
  });
  const sums = positionsUnits.map((): Vector3 => [0, 0, 0]);
  for (const triangle of triangles) {
    const [a, b, c] = triangle.map(index => positionsUnits[index]!) as [Vector3, Vector3, Vector3];
    const ab = b.map((value, axis) => value - a[axis]!) as Vector3, ac = c.map((value, axis) => value - a[axis]!) as Vector3;
    let normal: Vector3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (normal.reduce((sum, value, axis) => sum + value * a[axis]!, 0) < 0) { [triangle[1], triangle[2]] = [triangle[2], triangle[1]]; normal = normal.map(value => -value) as Vector3; }
    for (const index of triangle) for (let axis = 0; axis < 3; axis++) sums[index]![axis] += normal[axis]!;
  }
  const radialNormals = sums.map((normal, index) => Math.hypot(...normal) > 0 ? unitVector(normal) : unitVector(positionsUnits[index]!));
  return { positionsUnits, radialNormals, triangles };
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

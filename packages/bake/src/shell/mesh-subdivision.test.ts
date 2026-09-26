import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseShellRecipe } from './config.ts';
import { subdivideRadialMesh, type ShellMesh } from './mesh.ts';

const source: ShellMesh = { positionsUnits: [[2, 0, 0], [0, 3, 0], [0, 0, 4], [2, 0, 1e-13]],
  radialNormals: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]], triangles: [[0, 1, 2], [3, 2, 1]] };

test('radial display subdivision preserves samples, stitches shared geometry and derives smooth outward normals', () => {
  const mesh = subdivideRadialMesh(source, 4);
  assert.equal(mesh.triangles.length, 32);
  for (const position of source.positionsUnits) assert(mesh.positionsUnits.some(candidate => candidate.every((value, axis) => value === position[axis])));
  const used = new Set(mesh.triangles.flat());
  assert(used.has(0)); assert(!used.has(3), 'coincident source samples must share one topology vertex');
  const counts = new Map<string, number>();
  for (const triangle of mesh.triangles) for (const [a, b] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
    const key = a! < b! ? `${a}:${b}` : `${b}:${a}`; counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shared = [...counts].filter(([key]) => key.split(':').map(Number).every(index => {
    const position = mesh.positionsUnits[index]!; return Math.abs(position[2]!) < 1e-12 && position[0]! >= 0 && position[1]! >= 0;
  }));
  assert.equal(shared.length, 4); assert(shared.every(([, count]) => count === 2), 'both source faces must reuse their refined shared edge');
  for (const [index, normal] of mesh.radialNormals.entries()) {
    assert(Math.abs(Math.hypot(...normal) - 1) < 1e-12);
    if (used.has(index)) assert(normal.reduce((sum, value, axis) => sum + value * mesh.positionsUnits[index]![axis]!, 0) > 0);
  }
  const midpoint = mesh.positionsUnits.find(position => Math.abs(Math.hypot(...position) - 2.5) < 1e-12 && position[0] > 0 && position[1] > 0);
  assert(midpoint); assert(Math.abs(midpoint[0] - midpoint[1]) < 1e-12, 'edge direction follows normalized angular interpolation');
});

test('display subdivision parsing is bounded and omission preserves the legacy recipe shape', () => {
  const base = { schema: 'cssearth-surface-shell-recipe@1', frame: { referenceFrame: 'x', epochJdTt: 1, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-4, -4, -4], max: [4, 4, 4] } },
  shape: { kind: 'indexed-mesh', path: 'mesh.json', sha256: '0'.repeat(64) }, material: { colorLinear: [1, 1, 1], opacity: .2, rimFadeFacing: .1 },
  atlas: { tileSize: 8, columns: 2, frames: 2 }, visibility: { hiddenInsideUnits: 1, fullUntilUnits: 2, hiddenBeyondUnits: 3 },
  unitScale: 1, provenance: { path: 'p.json', sha256: '0'.repeat(64) } };
  assert.equal(parseShellRecipe(base).shape.displaySubdivision, undefined);
  assert.deepEqual(parseShellRecipe({ ...base, shape: { ...base.shape,
    displaySubdivision: { method: 'radial-linear', segmentsPerEdge: 4 } } }).shape.displaySubdivision,
  { method: 'radial-linear', segmentsPerEdge: 4 });
  for (const value of [0, 1.5, 9]) assert.throws(() => parseShellRecipe({ ...base, shape: { ...base.shape,
    displaySubdivision: { method: 'radial-linear', segmentsPerEdge: value } } }));
  assert.throws(() => subdivideRadialMesh({ ...source, triangles: Array(313).fill(source.triangles[0]) }, 8), /face budget/);
});

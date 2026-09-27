import { sourceTest } from '../source-test.mts';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeVtkMesh, loadVtkShape } from '@cssearth/bake/objects/geometry';
import { decodeVtkCategories } from '@cssearth/bake/objects/raster';
const test = sourceTest();
const vtk = '# vtk DataFile Version 2.0\ntetrahedron\nASCII\nDATASET POLYDATA\nPOINTS 4 float\n1 1 1\n-1 -1 1\n-1 1 -1\n1 -1 -1\nPOLYGONS 4 16\n3 0 2 1\n3 0 1 3\n3 0 3 2\n3 1 2 3\n';
const grid = { metersPerUnit: 1000, expectedVertices: 4, expectedFaces: 4 };
const categories = 'CELL_DATA 4\nSCALARS Region integer 1\nLOOKUP_TABLE default\n0 1 2 3\n';

test('VTK geometry and categories share the original Cartesian coordinates and face order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vtk-shape-'));
  try {
    await writeFile(join(dir, 'shape.vtk'), vtk + categories);
    const shape = await loadVtkShape(join(dir, 'shape.vtk'), grid);
    const data = decodeVtkCategories(vtk + categories, { ...grid, field: 'Region' });
    assert.deepEqual(shape.positions, data.positions);
    assert.deepEqual(data.positions[0], [1000, 1000, 1000]);
    assert.deepEqual(data.indices[2], [0, 3, 2]);
    assert.deepEqual([...data.values], [0, 1, 2, 3]);
    assert.equal(shape.closestPoint([1000, 1000, 1000])?.distanceMeters, 0);
    assert.deepEqual(decodeVtkMesh(vtk, grid).indices, data.indices);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('VTK rejects incomplete, transformed, nontriangular or corrupted source records', () => {
  for (const broken of [vtk.replace('ASCII', 'BINARY'), vtk.replace('POINTS 4', 'POINTS 5'),
    vtk.replace('1 1 1', 'NaN 1 1'), vtk.replace('3 0 2 1', '4 0 2 1'), vtk.replace('3 0 2 1', '3 0 4 1'),
    vtk.replace('3 0 2 1', '3 0 0 1'), vtk + categories.replace('0 1 2 3', '0 1 2 2147483648'),
    vtk + categories.replace('CELL_DATA 4', 'CELL_DATA 3'), vtk + categories + 'POINT_DATA 4']) {
    assert.throws(() => decodeVtkMesh(broken, grid));
  }
  assert.throws(() => decodeVtkMesh(vtk, { ...grid, metersPerUnit: 0 }));
});

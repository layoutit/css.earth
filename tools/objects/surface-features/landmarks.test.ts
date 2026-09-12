import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLandmarks, prepareLandmarks } from './landmarks.js';
import type { SurfaceFeaturePreparationContext } from './index.js';

const axes = { prime: [0, 1, 0] as const, east: [1, 0, 0] as const, north: [0, 0, 1] as const };
const entry = { id: '80000000', name: 'Test region', kind: 'region', type: 'Mission region', minimumZoomShare: 0.4,
  description: 'A region with published coordinates.', qualification: 'Approximate representative location.',
  reference: { title: 'Mission map', url: 'https://example.org/mission-map', credit: 'Mission science team' } };
const document = (position: unknown) => ({ schema: 'cssearth-surface-landmarks@1', source: 'Mission map', frame: 'Body-fixed metres', entries: [{ ...entry, position }] });
const context = (sourceDirectory: string): SurfaceFeaturePreparationContext => ({ objectId: 'test', sourceDirectory, publicDirectory: sourceDirectory, outputDirectory: sourceDirectory,
  config: {}, maxEntries: 10, radiusKm: 1, meshRadiusUnits: 1000, tree: { scene: 0, nodes: [{ className: 'body', parent: -1 }] }, declaredLensIds: ['model'],
  hitMesh: { target: 0, triangles: [[[-10, -10, 10], [10, -10, 10], [0, 10, 10]]] } });

test('Cartesian mission points use source axes and preserve qualification without an IAU credit or invented boundary', async () => {
  const result = await prepareLandmarks(document({ pointMeters: [2, 1, 10], maximumDistanceMeters: 0.01 }), context('.'), axes, 0);
  const feature = result.features[0]!;
  assert.deepEqual(feature.anchorUnits, [1, 2, 10]);
  assert.equal(feature.credit, 'Mission science team');
  assert.equal(feature.diameterKm, 0);
  assert.deepEqual(feature.outline, { kind: 'circle', center: [1, 2, 10], east: [0, 0, 0], north: [0, 0, 0] });
  assert.match(feature.note!.text, /Approximate representative location/u);
  assert.equal(feature.origin, '', 'qualification is shown once in the source note');
  await assert.rejects(prepareLandmarks(document({ pointMeters: [2, 1, 50], maximumDistanceMeters: 1 }), context('.'), axes, 0), /No display surface/u);
  await assert.rejects(prepareLandmarks(document({ pointMeters: [2, 1, 10], maximumDistanceMeters: 1 }), context('.'), axes, 180), /zero-longitude/u);
});

test('a small mapped region inside a coarse triangle gets an interior point without changing display geometry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-regions-'));
  try {
    const vtk = '# vtk DataFile Version 2.0\nSmall source region\nASCII\nDATASET POLYDATA\nPOINTS 3 float\n0 0 10\n1 0 10\n0 1 10\nPOLYGONS 1 4\n3 0 1 2\nCELL_DATA 1\nSCALARS Region integer 1\nLOOKUP_TABLE default\n1\n';
    await writeFile(join(directory, 'regions.vtk'), vtk);
    const doc = { ...document({ regionId: 1 }), vtk: { path: 'regions.vtk', bytes: Buffer.byteLength(vtk), sha256: createHash('sha256').update(vtk).digest('hex'),
      grid: { metersPerUnit: 1, expectedVertices: 3, expectedFaces: 1, field: 'Region' }, maximumDistanceMeters: 0.01 } };
    const ctx = context(directory), before = JSON.stringify(ctx.hitMesh);
    const result = await prepareLandmarks(doc, ctx, axes, 0), anchor = result.features[0]!.anchorUnits;
    assert.ok(anchor[0] > 0 && anchor[1] > 0 && anchor[0] + anchor[1] < 1);
    assert.equal(anchor[2], 10);
    assert.equal(result.evidence[0]!.regionId, 1);
    assert.equal(result.evidence[0]!.sourceFace, 0);
    assert.equal(JSON.stringify(ctx.hitMesh), before);
    await assert.rejects(prepareLandmarks({ ...doc, entries: [{ ...entry, position: { regionId: 2 } }] }, ctx, axes, 0), /Unknown mapped region/u);
    await writeFile(join(directory, 'regions.vtk'), vtk.replace('\n1\n', '\n0\n'));
    await assert.rejects(prepareLandmarks(doc, ctx, axes, 0), /region mesh changed/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('landmarks reject unqualified, malformed and unpinned positions', () => {
  assert.throws(() => parseLandmarks(document({ latitudeDeg: 91, longitudeDeg: 0 })), /out of range/u);
  assert.throws(() => parseLandmarks(document({ regionId: 0 })), /pinned source mesh/u);
  assert.throws(() => parseLandmarks(document({ latitudeDeg: 0, longitudeDeg: 0, pointMeters: [0, 0, 1] })), /one position frame/u);
  assert.throws(() => parseLandmarks({ ...document({ latitudeDeg: 0, longitudeDeg: 0 }), entries: [{ ...entry, qualification: '', position: { latitudeDeg: 0, longitudeDeg: 0 } }] }), /qualification/u);
});

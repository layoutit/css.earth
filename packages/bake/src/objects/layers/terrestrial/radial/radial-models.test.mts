import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { fixtureSource } from '../../../sources/fixtures/test-source-fixture.mts';
import { combineRadialModels, loadRadialModels } from './radial-models.ts';
const test = sourceTest();

const tetrahedron = (size: number) => `v ${size} 0 0\nv 0 ${size} 0\nv 0 0 ${size}\nv 0 0 0\nf 1 2 3\nf 1 4 2\nf 2 4 3\nf 3 4 1\n`;
const profile = (path: string) => ({ path, format: 'wavefront-obj', texelsPerFace: 256, grid: { metersPerUnit: 1, expectedVertices: 4, expectedFaces: 4 }, faceBudget: 4,
  simplification: { method: 'source-meshoptimizer', targetFaces: 4, maximumErrorMeters: .001 } });

test('a dataset read from another model of the body draws on the body\'s mesh, and one that is another shape keeps its own', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-radial-models-'));
  try {
    await writeFile(join(directory, 'body.obj'), tetrahedron(1));
    await writeFile(join(directory, 'survey.obj'), tetrahedron(1.01));
    await writeFile(join(directory, 'other.obj'), tetrahedron(2));
    const source = await fixtureSource(directory, ['body', 'survey', 'other'].map(id => ({ id, path: `${id}.obj`, consumers: ['geometry'] })));
    const config = (alternatives: Record<string, unknown>[]) => ({ namespace: 'fixture', presentation: { defaultDataset: 'shape' },
      raster: { observations: [{ id: 'shape' }, { id: 'photograph' }], scientific: [{ id: 'gravity' }, { id: 'slope' }, { id: 'second-shape' }] },
      geometry: { radius: 1, radiusKm: .001, radialTerrain: profile('body.obj'), radialTerrainAlternatives: alternatives } });
    const models = await loadRadialModels({ sourceDirectory: directory, source, config: config([
      { datasetId: 'gravity', additionalDatasetIds: ['slope'], display: 'body-mesh', ...profile('survey.obj') },
      { datasetId: 'second-shape', ...profile('other.obj') }]) });
    // Two meshes are drawn: the body's, which also carries the two maps of the survey model, and the second shape's.
    assert.deepEqual(models.map(model => [model.id, model.datasetIds]), [['shape', ['shape', 'photograph', 'gravity', 'slope']], ['second-shape', ['second-shape']]]);
    const [body] = models, sampled = body!.sampling!;
    assert.deepEqual([...sampled.keys()], ['gravity', 'slope']);
    // The maps are read from the survey model's own surface, not the body's.
    assert.notEqual(sampled.get('gravity')!.grid, body!.radial.grid);
    assert.equal(sampled.get('gravity')!.grid, sampled.get('slope')!.grid);
    assert.equal((sampled.get('gravity')!.config.geometry.radialTerrain as { path: string }).path, 'survey.obj');
    const combined = combineRadialModels(models, 'fixture')!;
    assert.deepEqual(combined.datasetRanges, [...['shape', 'photograph', 'gravity', 'slope'].map(datasetId => ({ datasetId, start: 0, count: 4 })), { datasetId: 'second-shape', start: 4, count: 4 }]);
    // With every other model only read from, the body has one mesh and no ranges to select between.
    const single = await loadRadialModels({ sourceDirectory: directory, source, config: config([{ datasetId: 'gravity', additionalDatasetIds: ['slope'], display: 'body-mesh', ...profile('survey.obj') }]) });
    assert.equal(single.length, 1);
    assert.equal(combineRadialModels(single, 'fixture'), single[0]!.radial);
    await assert.rejects(loadRadialModels({ sourceDirectory: directory, source, config: config([{ datasetId: 'gravity', display: 'elsewhere', ...profile('survey.obj') }]) }), /body-mesh/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

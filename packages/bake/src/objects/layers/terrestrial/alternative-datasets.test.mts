import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { alternativeForDataset, alternativeDatasetIds, radialTerrainForDataset } from '@cssearth/bake/objects/layers/terrestrial';
const test = sourceTest();

test('an alternative mesh serves its own dataset and the datasets it names as sharing its frame', () => {
  const adam = { datasetId: 'zimpol', additionalDatasetIds: ['thermal-inertia', 'dielectric-constant'], path: 'shape/adam.obj' };
  const other = { datasetId: 'osiris', path: 'shape/other.obj' };
  assert.deepEqual(alternativeDatasetIds(adam), ['zimpol', 'thermal-inertia', 'dielectric-constant']);
  assert.deepEqual(alternativeDatasetIds(other), ['osiris']);
  assert.equal(alternativeForDataset([other, adam], 'dielectric-constant'), adam);
  assert.equal(alternativeForDataset([other, adam], 'shape'), undefined);
  const config = { namespace: 'psyche', geometry: { radius: 1, radiusKm: 1, radialTerrain: { path: 'shape/mpcd.obj' }, radialTerrainAlternatives: [other, adam] },
    presentation: { defaultDataset: 'shape' }, raster: {} };
  assert.deepEqual(radialTerrainForDataset(config, 'thermal-inertia'), { path: 'shape/adam.obj' }, 'the dataset fields are not part of the mesh profile');
  assert.deepEqual(radialTerrainForDataset(config, 'shape'), { path: 'shape/mpcd.obj' });
  assert.throws(() => alternativeDatasetIds({ datasetId: 'zimpol', additionalDatasetIds: 'thermal-inertia' }), /Invalid alternative/);
});

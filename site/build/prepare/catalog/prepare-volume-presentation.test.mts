import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseObjectDescriptor, parseVolumePresentationSource, parseVolumeSourceManifest } from '@cssearth/objects';
import { imageLayerDatasetsMatch, volumeLineage } from './prepare-volume-presentation.mts';

const descriptor = (overlays?: Record<string, string[]>) => parseObjectDescriptor({ schema: 'cssearth-object@2', id: 'nebula', type: 'image-layer-bank', properties: {
  frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  preparation: { source: 'source/recipe.json' }, ...(overlays ? { overlays } : {}) } });
const record = (defaultDataset: string, ...ids: string[]) => ({ defaultDataset, datasets: ids.map(id => ({ id })) });

test("an image-layer bank's presentation names its overlays' datasets, in their order, the first its default", () => {
  const nebula = descriptor({ optical: [], 'outer-ejecta': ['outer-ejecta'] });
  assert.equal(imageLayerDatasetsMatch(nebula, record('optical', 'optical', 'outer-ejecta')), true);
  assert.equal(imageLayerDatasetsMatch(nebula, record('outer-ejecta', 'optical', 'outer-ejecta')), false, 'its default is the first dataset');
  assert.equal(imageLayerDatasetsMatch(nebula, record('optical', 'outer-ejecta', 'optical')), false, 'in the descriptor\'s order');
  assert.equal(imageLayerDatasetsMatch(nebula, record('optical', 'optical')), false, 'every dataset the descriptor names');
  assert.equal(imageLayerDatasetsMatch(nebula, record('optical', 'optical', 'outer-ejecta', 'model')), false, 'and no other');
  assert.equal(imageLayerDatasetsMatch(nebula, record('optical', 'optical', 'model')), false);
  assert.equal(imageLayerDatasetsMatch(descriptor(), record('optical', 'optical')), true, 'a bank without overlays has one dataset, optical');
  assert.equal(imageLayerDatasetsMatch(descriptor(), record('infrared', 'infrared')), false);
});

test("the Homunculus's datasets each name their own input and the shared ones: the optical dataset its gas cloud too", async () => {
  const base = new URL('../../../../src/objects/homunculus-nebula-layers/source/', import.meta.url);
  const read = async (name: string) => JSON.parse(await readFile(new URL(name, base), 'utf8')) as unknown;
  const record = parseVolumePresentationSource(await read('presentation.json'));
  const manifest = parseVolumeSourceManifest(await read('manifest.json'), { reader: 'presentation', objectId: record.objectId, policy: 'presentation-source' });
  const products = new Map(volumeLineage(record, manifest, true).products.map(product => [product.id, [...product.inputs].sort()]));
  const shared = ['detail', 'filaments', 'optical', 'regions', 'surface-model'];
  assert.deepEqual([...products.keys()], ['optical', 'outer-shell', 'motions']);
  assert.deepEqual(products.get('optical'), ['cloud', ...shared].sort(), 'the optical dataset draws the gas cloud');
  assert.deepEqual(products.get('outer-shell'), [...shared, 'outer-shell'].sort());
  assert.deepEqual(products.get('motions'), ['motions', ...shared].sort());
});

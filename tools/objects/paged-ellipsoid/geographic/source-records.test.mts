import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePlacesConfig, parsePlacesManifest, parseGeographicScene, parseBodyAttitude, numericSource } from './source-records.mts';

const earth = new URL('../../../../src/objects/earth/', import.meta.url);
async function json(path: string): Promise<unknown> { return JSON.parse(await readFile(new URL(path, earth), 'utf8')); }

test('the places recipe, catalogue manifest and prepared scene decode without dropping fields', async () => {
  const recipe = await json('source/preparation/paged-ellipsoid.json');
  assert.deepEqual(parsePlacesConfig(recipe), recipe);
  const places = await json('source/places/manifest.json');
  assert.deepEqual(parsePlacesManifest(places), places);
  const scene = await json('prepared/scene.json');
  assert.deepEqual(parseGeographicScene(scene), scene);
  assert.equal(numericSource('55'), '55');
  assert.equal(numericSource(55), 55);
  for (const value of ['', 'no reading', Infinity, null]) assert.throws(() => numericSource(value));
});

test('source readers reject malformed scene bands and attitudes before exposing typed values', () => {
  assert.throws(() => parseGeographicScene({ body: { bands: [{ latitudeIndex: 1, leaves: [{ style: 3, leafWidth: 2 }] }] } }));
  assert.throws(() => parseBodyAttitude({ bodyMatrix: [1, 0, 0, 0, 1, 0] }), /3 x 3/);
});

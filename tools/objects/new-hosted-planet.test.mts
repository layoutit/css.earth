import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { scaffoldHostedPlanetFiles } from './new-hosted-planet.mts';

test('the hosted-planet scaffold refuses to invent a uniform synchronous rotation for an eccentric orbit', () => {
  assert.throws(() => scaffoldHostedPlanetFiles(
    { id: 'test-planet', name: 'Test planet', system: 'Test system', description: 'Test', paper: 'https://example.test/paper', paperCredit: 'Test source' },
    { id: 'test-planet', physical: { parent: 'test-star' }, hostedOrbit: { eccentricity: .1 } },
    { id: 'test-star' },
    2451545,
  ), /--rotation unmeasured/);
});

test('a self-luminous planet scaffolds the emissive build Beta Pictoris c was made with', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = async (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const json = async (path: string) => JSON.parse(await read(path)) as Record<string, any>;
  const files = scaffoldHostedPlanetFiles({ id: 'beta-pictoris-c', name: 'Beta Pictoris c', system: 'Beta Pictoris system', description: 'Test', paper: 'https://arxiv.org/abs/2010.04442',
    paperCredit: 'Test source', rotation: 'unmeasured', selfLuminous: { temperatureK: 1250, source: '1250 +/- 50 K, Nowak et al. (2020)' } },
  await json('packages/astronomy/data/bodies/beta-pictoris-c.json'), await json('packages/astronomy/data/bodies/beta-pictoris.json'), 2461041.5);
  const made = (path: string) => JSON.parse(files.get(path)!) as Record<string, any>, o = 'src/objects/beta-pictoris-c';
  assert.equal(files.get('src/renderers/css/styles/beta-pictoris-c-surfaces.css'), await read('src/renderers/css/styles/beta-pictoris-c-surfaces.css'));
  const raster = made(`${o}/source/preparation/raster.json`), shipped = await json(`${o}/source/preparation/raster.json`);
  assert.deepEqual(raster.emission, shipped.emission);
  assert.equal(raster.lighting, undefined);
  assert.equal(raster.surfaces[0].science.qualification, shipped.surfaces[0].science.qualification);
  for (const path of ['source/preparation/celestial.json', 'source/preparation/presentation.json']) assert.deepEqual(made(`${o}/${path}`), await json(`${o}/${path}`), path);
  const object = made(`${o}/object.json`).properties, shippedObject = (await json(`${o}/object.json`)).properties;
  assert.deepEqual([object.preparation.steps, object.recipe.materials, object.recipe.emission, object.recipe.surfaces], [shippedObject.preparation.steps, shippedObject.recipe.materials, shippedObject.recipe.emission, shippedObject.recipe.surfaces]);
  assert.deepEqual(made(`${o}/source/content/object.json`).settings, (await json(`${o}/source/content/object.json`)).settings);
  assert.equal(made(`${o}/source/measurements.json`).effectiveTemperatureK, 1250);
});

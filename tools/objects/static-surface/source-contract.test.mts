import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parseSurfaceGeometry, parseSurfaceRaster, parseCelestialRecipe, parsePhysicalRecipe, parseSurfaceContent, parseTitleRecipe, parseBandLenses, parseEmissiveLenses} from './source-contract.mts';
const read = async (id: string, path: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../../src/planets/${id}/source/${path}`, import.meta.url), 'utf8'));

for (const id of ['moon', 'pluto', 'sun']) {
  test(`${id} source boundaries preserve pinned records and their provenance`, async () => {
    for (const [path, parse] of [['preparation/geometry.json', parseSurfaceGeometry], ['preparation/raster.json', parseSurfaceRaster],
      ['preparation/celestial.json', parseCelestialRecipe], ['preparation/physical.json', parsePhysicalRecipe],
      ['content/static.json', parseSurfaceContent], ['presentation/title-mark.json', parseTitleRecipe]] as const) {
      const value = await read(id, path), bytes = JSON.stringify(value);
      assert.equal(parse(value), value, path);
      assert.equal(JSON.stringify(value), bytes, path);
    }
    const {lenses} = parseSurfaceContent(await read(id, 'content/static.json'));
    assert.equal((id === 'sun' ? parseEmissiveLenses : parseBandLenses)(lenses), lenses);
  });
}

test('camera and material addresses must be numeric and complete before compiling scene leaves', async () => {
  const geometry = parseSurfaceGeometry(await read('pluto', 'preparation/geometry.json'));
  Object.assign(geometry.metadata.camera, {defaultZoom: '1.1'});
  assert.throws(() => parseSurfaceGeometry(geometry), /static surface geometry/);
  const {lenses} = parseSurfaceContent(await read('sun', 'content/static.json'));
  Reflect.deleteProperty(parseEmissiveLenses(lenses).controls[0], 'limbUrl');
  assert.throws(() => parseEmissiveLenses(lenses), /emissive surface lenses/);
});

test('observation variants retain the correlation between measurements and processing', async () => {
  const raster = parseSurfaceRaster(await read('sun', 'preparation/raster.json'));
  assert.ok('variants' in raster);
  const observation = raster.variants.find(value => value.observedFile);
  assert.ok(observation);
  Object.assign(observation, {radius: null});
  assert.throws(() => parseSurfaceRaster(raster), /static surface raster/);
  const continuum = parseSurfaceRaster(await read('sun', 'preparation/raster.json'));
  assert.ok('variants' in continuum);
  Object.assign(continuum.variants[0], {kind: 'fits-map'});
  assert.throws(() => parseSurfaceRaster(continuum), /static surface raster/);
});

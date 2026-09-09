import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mjs';
import {parseTerrestrialProfile} from '../../../../tools/objects/terrestrial-layers/index.mjs';

const source = new URL('../../../../src/planets/titania/source/', import.meta.url).pathname;
const profile = async () => JSON.parse(await readFile(source + 'preparation/terrestrial.json'));

test('historical Titania categories retain named regions, valid black terrain and geographic gaps', async () => {
  const config = parseTerrestrialProfile(await profile());
  const lens = config.raster.scientific.find(lens => lens.id === 'geology');
  const map = await loadScienceSurface(source, lens);
  const unit = (lon, lat) => lens.categories[map.sample(lon, lat)]?.value;
  assert.equal(unit(45.2, -12.4), 'c2cratersshp', 'Ursula remains the archived crater-material unit');
  assert.equal(unit(287.1, -15.8), 'Pm', 'Gertrude remains moderately cratered plains in this historical map');
  // Independent Fiona representative point of darkalbedopatches feature 1,
  // transformed with the independently reviewed registration (not image brightness).
  assert.equal(map.sample(347.77886218083347, -28.47176955247106), 0);
  assert.equal(lens.categories[0].color, '#000000', 'Black categorical material is data, not missing coverage');
  assert.equal(map.sample(45.2, 30), null, 'Unmapped north remains unknown');
  const receipt = JSON.parse(await readFile(source + 'science/geology-2026/categories.receipt.json'));
  const bytes = await readFile(source + lens.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.output.sha256);
  assert.ok(receipt.ambiguousCombinations.length > 0, 'Unresolved source overlaps are retained in the receipt');
});

test('categorical GeoTIFF profiles reject interpolation, relief and a missing code that erases unit zero', async () => {
  for (const change of [{sampling: 'bilinear'}, {relief: {}}, {valueTransform: {scale: 1, offset: 0}}]) {
    const config = await profile();
    Object.assign(config.raster.scientific.find(lens => lens.id === 'geology'), change);
    assert.throws(() => parseTerrestrialProfile(config), /Categorical scientific grids/);
  }
  const config = await profile();
  config.raster.scientific.find(lens => lens.id === 'geology').grid.noData = 0;
  assert.throws(() => parseTerrestrialProfile(config), /Categorical scientific grids/);
});

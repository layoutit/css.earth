import {required} from '../../../../tools/contract/test-values.mts';
import {array,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('titania');
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadScienceSurface} from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import {parseInterpreterRecipe} from '../../../../tools/objects/observation/interpret.mts';

const source = new URL('../../../../src/objects/titania/source/', import.meta.url).pathname;
const recipe = async () => parseInterpreterRecipe(JSON.parse((await readFile(source + 'preparation/raster.json')).toString('utf8')));

test('historical Titania categories retain named regions, valid black terrain and geographic gaps', async () => {
  const lens = required((await recipe()).surfaces.find(surface => surface.id === 'geology')?.science, 'geology science');
  const {path, categories} = shape({path: text, categories: array(shape({value: text, color: text}))})(lens);
  const map = await loadScienceSurface(source, lens);
  const unit = (lon: number, lat: number) => categories[required(map.sample(lon, lat))]?.value;
  assert.equal(unit(45.2, -12.4), 'c2cratersshp', 'Ursula remains the archived crater-material unit');
  assert.equal(unit(287.1, -15.8), 'Pm', 'Gertrude remains moderately cratered plains in this historical map');
  // Independent Fiona representative point of darkalbedopatches feature 1,
  // transformed with the independently reviewed registration (not image brightness).
  assert.equal(map.sample(347.77886218083347, -28.47176955247106), 0);
  assert.equal(categories[0].color, '#000000', 'Black categorical material is data, not missing coverage');
  assert.equal(map.sample(45.2, 30), null, 'Unmapped north remains unknown');
  const receipt = JSON.parse((await readFile(source + 'science/geology-2026/categories.receipt.json')).toString('utf8'));
  const bytes = await readFile(source + path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.output.sha256);
  assert.ok(receipt.ambiguousCombinations.length > 0, 'Unresolved source overlaps are retained in the receipt');
});

test('categorical GeoTIFF surfaces reject interpolation, relief and a missing code that erases unit zero', async () => {
  const {createSurfaceInterpreter} = await import('../../../../tools/objects/observation/interpret.mts');
  const raw = async () => JSON.parse((await readFile(source + 'preparation/raster.json')).toString('utf8')) as unknown;
  const geology = (value: unknown) => {
    const surface = required(parseInterpreterRecipe(value).surfaces.find(entry => entry.id === 'geology'), 'geology surface');
    return {id: surface.id, source: surface.source, science: required(surface.science, 'geology science')};
  };
  const interpreter = await createSurfaceInterpreter({objectId: 'titania', displayName: 'Titania', sourceDirectory: source, recipe: parseInterpreterRecipe(await raw())});
  for (const change of [{sampling: 'bilinear'}, {relief: {referenceRadiusMeters: 788400, lightDirection: [1, 0, 0], ambient: 0.2}}, {valueTransform: {scale: 1, offset: 0}}]) {
    const surface = geology(await raw());
    await assert.rejects(interpreter({...surface, science: {...surface.science, ...change}}, 64, 32, 1), /Categorical scientific grids/);
  }
  const surface = geology(await raw());
  const grid = shape({noData: (value: unknown): value is number => typeof value === 'number'})(surface.science.grid);
  await assert.rejects(interpreter({...surface, science: {...surface.science, grid: {...grid, noData: 0}}}, 64, 32, 1), /Categorical scientific grids/);
});

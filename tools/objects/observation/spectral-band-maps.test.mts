import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { estimateBand, fitsCube, paintCell, parseSpectralBandRecipe, prepareSpectralBandMaps } from './spectral-band-maps.mts';
import { readOracleFixture, assertPinnedInputs, readOracleInput, ORACLE_ROOT } from '../../oracles/fixture.mts';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '../../sources/source-values.mts';

const source = resolve(ORACLE_ROOT, 'src/objects/charon/source');
const recipePath = 'science/leisa/bands.json';
const recipe = parseSpectralBandRecipe(JSON.parse(await readFile(resolve(source, recipePath), 'utf8')));

test('the absorption estimators distinguish depth from continuum ratio and reject missing or nonphysical denominators', () => {
  assert.equal(estimateBand([[10, 1.5, 1], [4, 2, 1], [10, 2.5, 1]], 'linear-band-depth'), .6);
  assert.equal(estimateBand([[4, 4.2, 2], [1, 2.2, 1], [9, 6.8, 3]], 'continuum-ratio'), 2.6);
  assert.equal(estimateBand([[4, 4.2, 2], [0, 2.2, 1], [9, 6.8, 3]], 'continuum-ratio'), null);
  assert.equal(estimateBand([[0, 0, 0], [1, 2.2, 1], [9, 6.8, 3]], 'continuum-ratio'), null);
  assert.equal(estimateBand([[NaN, 4.2, 2], [1, 2.2, 1], [9, 6.8, 3]], 'continuum-ratio'), null);
  assert.throws(() => parseSpectralBandRecipe({ ...recipe, lastBand: 256 }), /Invalid/);
  const changed = structuredClone(recipe); changed.scans[0].cube = '../escape.fit';
  assert.throws(() => parseSpectralBandRecipe(changed), /inside/);
});

function cell(longitude: number) {
  const vector = (lon: number, lat: number): [number, number, number] => {
    const a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
  };
  return { longitude, latitude: 0, value: 1, score: 1, x: 0, y: 0, samples: 1,
    corners: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => vector(longitude + x, y)) };
}
test('surface footprints paint only covered cell centres, including a footprint across the longitude seam', () => {
  const middle = new Set<number>(), seam = new Set<number>();
  paintCell(cell(0), 360, 180, i => middle.add(i));
  paintCell(cell(180), 360, 180, i => seam.add(i));
  assert.deepEqual([...middle].sort((a,b)=>a-b), [89*360+179,89*360+180,90*360+179,90*360+180]);
  assert.deepEqual([...seam].sort((a,b)=>a-b), [89*360,89*360+359,90*360,90*360+359]);
});

test('native planes and Organa cell spectra agree with the independent astropy fixture; maps reproduce their pins', async () => {
  const fixture = await readOracleFixture('fits/charon-leisa.json');
  await assertPinnedInputs(fixture.inputs);
  for (const input of fixture.inputs) await readOracleInput(input);
  const products = requireArray(fixture.cases.products).map(value => requireRecord(value));
  assert.equal(products.length, recipe.scans.length);
  const result = await prepareSpectralBandMaps(source, recipePath);
  const manifest = requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')));
  const pins = [...requireArray(manifest.inputs), ...requireArray(manifest.documents)].map(value => requireRecord(value));
  for (const [id, bytes] of Object.entries(result.products)) {
    const pin = pins.find(p => p.path === `science/leisa/${id}.tif`);
    assert.ok(pin); assert.equal(bytes.length, pin.expectedBytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.expectedSha256);
  }
  assert.deepEqual(result.report, JSON.parse(await readFile(resolve(source, 'science/leisa/preparation.json'), 'utf8')));
  for (const product of products) {
    const scan = recipe.scans.find(s => s.id === product.id); assert.ok(scan);
    const report = result.report.scans.find(s => s.id === product.id); assert.ok(report);
    for (const raw of requireArray(product.raw).map(value => requireRecord(value))) {
      const name = requireString(raw.name); assert.ok(name === 'cube' || name === 'wavelengths' || name === 'geometry');
      const bytes = await readFile(resolve(source, scan[name]));
      const planes = name === 'geometry' ? 5 : 256, decoded = fitsCube(bytes, scan.width, scan.height, planes);
      assert.deepEqual(raw.shape, [planes, scan.height, scan.width]);
      assert.equal(decoded.at(0,0), raw.corner);
      for (const s of requireArray(raw.samples).map(value => requireRecord(value))) assert.equal(decoded.at(requireFiniteNumber(s.plane), requireFiniteNumber(s.index)), s.value);
      assert.throws(() => fitsCube(bytes.subarray(0, bytes.length-1), scan.width, scan.height, planes), /layout|Truncated/);
      assert.throws(() => decoded.at(planes, 0), /outside/);
    }
    for (const rawMap of requireArray(product.maps).map(value => requireRecord(value))) {
      const actual: (typeof report.quantities)[number] | undefined = report.quantities.find(q => q.id === rawMap.id); assert.ok(actual);
      const expected = requireArray(rawMap.cells).map(value => requireRecord(value));
      assert.ok(expected.length >= 5, 'the published Organa neighbourhood has multiple independent source-cell checks');
      assert.equal(actual.anchors.length, expected.length);
      for (const cell of expected) {
        const prepared: { x: number; y: number; longitude: number; latitude: number; value: number } | undefined = actual.anchors.find(c => c.x === cell.x && c.y === cell.y); assert.ok(prepared);
        assert.ok(Math.abs(prepared.value-requireFiniteNumber(cell.value)) < 1e-12);
        assert.ok(Math.abs(prepared.longitude-requireFiniteNumber(cell.longitude)) < 1e-10);
        assert.ok(Math.abs(prepared.latitude-requireFiniteNumber(cell.latitude)) < 1e-10);
      }
    }
  }
});

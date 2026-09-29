import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord } from '@cssearth/core';
import { loadNpyDictionaryMap, readNpyObject, npyArrayAt } from '@cssearth/bake/objects/raster';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { readMeasuredSpectrum } from '@cssearth/bake/objects/charts';

const test = sourceTest('hd-189733b');
const root = resolve(findProjectRoot(import.meta.url), 'src/objects/hd-189733b/source');
const json = async (path: string) => requireRecord(JSON.parse(await readFile(resolve(root, path), 'utf8')));
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('Hubble Table 1 and CHEOPS retain published wavelengths, signs and asymmetric errors', async () => {
  const charts = requireArray((await json('content/charts.json')).charts);
  const hst = await readMeasuredSpectrum(root, charts[0]);
  assert.deepEqual(hst.points.map(p => [p.xLow, p.xHigh, p.x, p.y, p.minus, p.plus]), [
    [290, 340, 325, .45, .55, .55], [340, 390, 368, .39, .27, .27],
    [390, 435, 416, .32, .15, .15], [435, 480, 459, .17, .11, .12],
    [480, 525, 502, -.11, .11, .14], [525, 570, 547, .02, .12, .14],
  ]);
  const cheops = await readMeasuredSpectrum(root, charts[1]);
  assert.deepEqual(cheops.points, [{ x: 725, xLow: 350, xHigh: 1100, y: .076, minus: .016, plus: .016 }]);
  assert.equal(cheops.recipe.mode, 'band');
});
test('Webb archive bins preserve the inter-filter overlap and convert depth and errors to percent', async () => {
  const charts = requireArray((await json('content/charts.json')).charts);
  const data = await readMeasuredSpectrum(root, charts[2]);
  assert.equal(data.points.length, 139);
  near(data.points[0]!.x, 2.404601895877677);
  near(data.points[0]!.y, 2.4079521377848207);
  near(data.points[0]!.plus, .0060354141975453954);
  near(data.points[0]!.xLow, 2.395051169010593);
  near(data.points[82]!.x, 3.9985697426319833);
  near(data.points[83]!.x, 3.8961284393307105);
  near(data.points[138]!.x, 4.97374270544699);
  assert.equal(data.model.length, 224);
  assert.equal(data.model.filter(p => p.y === null).length, 0); // The archive's final NaN lies beyond this chart.
  near(Math.min(...data.model.map(p => p.y!)), 2.403413370351516);
  near(Math.max(...data.model.map(p => p.y!)), 2.4366631203607606);
});
test('uncertainty samples align with the deposited grid and retain exactly the thermal map coverage', async () => {
  const surfaces = requireArray((await json('preparation/raster.json')).surfaces).map(v => requireRecord(v));
  const thermal = await loadNpyDictionaryMap(root, surfaces.find(s => s.id === 'temperature')!.science);
  const uncertainty = await loadNpyDictionaryMap(root, surfaces.find(s => s.id === 'uncertainty')!.science);
  const raw = npyArrayAt(readNpyObject(await readFile(resolve(root, 'science/lally-2025/output_E.npy'))), ['tmap_unc']);
  assert.deepEqual(raw.shape, [12, 24]);
  assert.ok(raw.data instanceof Float64Array);
  near(Math.min(...raw.data), 3.2717356181609953);
  near(Math.max(...raw.data), 9.553727065702903);
  assert.deepEqual(uncertainty.report.visibleLongitudes, thermal.report.visibleLongitudes);
  let shown = 0;
  for (let row = 0; row < 12; row++) for (let column = 0; column < 24; column++) {
    const longitude = -180 + (column + .5) * 15, latitude = -90 + (row + .5) * 15;
    const value = uncertainty.sample(longitude, latitude);
    assert.equal(value === null, thermal.sample(longitude, latitude) === null);
    if (column < 4) assert.equal(value, null);
    else { assert.notEqual(value, null); near(value!, raw.data[row * 24 + column]!); shown++; }
  }
  assert.equal(shown, 240);
});

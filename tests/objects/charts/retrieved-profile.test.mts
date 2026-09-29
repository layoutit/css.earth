import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseRetrievedProfile, readProfileTable, profileWindow, readRetrievedProfile, renderRetrievedProfile } from '@cssearth/bake/objects/charts';
import { bodyLineage } from '@cssearth/bake/objects/lineage';
import { productSourceIds } from '@cssearth/objects/provenance';

const root = resolve(import.meta.dirname, '../../..');
const source = resolve(root, 'src/objects/wasp-18b/source');
const config = JSON.parse(await readFile(resolve(source, 'content/charts.json'), 'utf8'));
const recipe = parseRetrievedProfile(config.charts[0]);

test('reads absolute quantiles, converts Pa to bar, and preserves ascending or descending grids', () => {
  const columns = { pressure: 0, median: 3, lower: 2, upper: 4 };
  const s = { ...recipe.series[0]!, expectedRows: 3, columns };
  const data = '100000 80 90 100 120 140\n10000 180 190 200 240 280\n1000 280 290 300 360 420\n';
  const rows = readProfileTable(data, s);
  assert.deepEqual(rows, [
    { pressure: .01, median: 300, lower: 290, upper: 360 },
    { pressure: .1, median: 200, lower: 190, upper: 240 },
    { pressure: 1, median: 100, lower: 90, upper: 120 },
  ]);
  assert.deepEqual(readProfileTable(data.trim().split('\n').reverse().join('\n'), s), rows);
  const midpoint = profileWindow(rows, Math.sqrt(.001), 1)[0]!;
  assert.ok(Math.abs(midpoint.median - 250) < 1e-10);
  assert.ok(Math.abs(midpoint.lower - 240) < 1e-10);
  assert.ok(Math.abs(midpoint.upper - 300) < 1e-10);
  assert.throws(() => profileWindow(rows, .001, 1), /cover/);
  assert.throws(() => readProfileTable(data.replace('10000 ', '100000 '), s), /monotonic/);
  assert.throws(() => readProfileTable(data.replace('90 100 120', '110 100 120'), s), /quantile/);
  assert.throws(() => readProfileTable(data.replace('90 100 120', '90 NaN 120'), s), /finite/);
  assert.throws(() => readProfileTable(data, { ...s, expectedRows: 4 }), /count/);
});

test('the source tables agree with Figure 4 at independently read pressure and temperature anchors', async () => {
  const result = await readRetrievedProfile(source, recipe);
  // Figure 4 has dashed reference levels at 0.1 and 1 bar. Temperatures read to
  // about 25 K from its 250 K tick spacing; this checks pressure units and columns.
  const anchors = [[3275, 3000], [3200, 2900], [3050, 2875]];
  result.series.forEach((s, i) => {
    const window = profileWindow(s.points, .1, 1);
    assert.ok(Math.abs(window[0]!.median - anchors[i]![0]!) < 25);
    assert.ok(Math.abs(window.at(-1)!.median - anchors[i]![1]!) < 25);
    assert.ok(window[0]!.median > window.at(-1)!.median, 'warmer at lower pressure');
    assert.ok(s.points.every(p => p.lower <= p.median && p.median <= p.upper));
  });
  assert.deepEqual(result.series.map(s => s.source.expectedRows), [50, 81, 50]);
  const svg = renderRetrievedProfile(result);
  assert.equal(svg.match(/class="profile-interval"/g)?.length, 3);
  assert.equal(svg.match(/class="profile-median"/g)?.length, 3);
  assert.match(svg, /viewBox="0 0 306 371"/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<filter|<clipPath|<mask/);
  assert.equal(renderRetrievedProfile(await readRetrievedProfile(source, recipe)), svg);
});

test('rejects unsafe recipes and clipped uncertainties', async () => {
  await assert.rejects(readRetrievedProfile(source, { ...recipe, temperature: { minimum: 2800, maximum: 3500, ticks: [{ value: 2800, label: '2800' }, { value: 3500, label: '3500' }] } }), /clip/);
  for (const path of ['../outside', '/absolute', 'a\\b', '']) assert.throws(() => parseRetrievedProfile({ ...recipe, series: [{ ...recipe.series[0], path }] }), /path/);
  assert.throws(() => parseRetrievedProfile({ ...recipe, series: [{ ...recipe.series[0], pressureUnit: 'mbar' }] }), /unit/);
  assert.throws(() => parseRetrievedProfile({ ...recipe, pressure: { ...recipe.pressure, minimum: 0 } }), /positive/);
  assert.throws(() => readProfileTable('0 0 0 0 0 0\n', recipe.series[0]!), /pressure/);
});

test('the chart lineage binds all three deposited tables', async () => {
  assert.deepEqual(productSourceIds(await bodyLineage(resolve(source, '..')), 'chart:0').sort(), [
    'wasp-18b-hydra-dayside-profile', 'wasp-18b-hydra-hotspot-profile', 'wasp-18b-pyratbay-hotspot-profile',
  ]);
});

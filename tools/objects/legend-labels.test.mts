import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { derivedLegendLabels, legendLabelChanges, withDerivedLegendLabels } from './legend-labels.mts';

const root = resolve(import.meta.dirname, '../..');
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, unknown>;

test('labels are the stretch as a fraction of its top, at the low end, midpoint and top', () => {
  assert.deepEqual(derivedLegendLabels(0.0015528831589285265, 0.003916874544895137), ['0.40', '0.70', '1.00']);
  assert.deepEqual(derivedLegendLabels(0.0003227220598711899, 0.0007212172185613834), ['0.45', '0.72', '1.00']);
});

test('a stale label is found and rewritten in both the legend and its recipe; current labels are left alone', () => {
  const raster = { surfaces: { a: { interpretation: { 1: { display: { low: 1, high: 4 } }, 2: { display: { low: 1, high: 4 } } } }, b: { interpretation: { 1: { display: { low: 1, high: 2 } } } } } };
  const legend = (labels: string[]) => ({ labels, recipe: { palette: [[0, 0, 0], [255, 255, 255]], labels } });
  const content = { lenses: { controls: [{ id: 'a', legend: legend(['0.37', '0.62', '1.00']) }, { id: 'b', legend: legend(['0.50', '0.75', '1.00']) }, { id: 'c' }] } };
  const changes = legendLabelChanges(content, raster);
  assert.deepEqual(changes, [{ lensId: 'a', authored: ['0.37', '0.62', '1.00'], derived: ['0.25', '0.63', '1.00'] }]);
  const refreshed = withDerivedLegendLabels(content, changes) as typeof content;
  assert.deepEqual(refreshed.lenses.controls[0]!.legend, legend(['0.25', '0.63', '1.00']));
  assert.deepEqual(refreshed.lenses.controls[1], content.lenses.controls[1]);
  assert.deepEqual(legendLabelChanges(refreshed, raster), []);
});

test('the prepared stars agree with their reports', async () => {
  for (const id of ['pi1-gruis', 'ce-tauri']) {
    assert.deepEqual(legendLabelChanges(await json(`src/objects/${id}/source/content/object.json`), await json(`src/objects/${id}/prepared/assets.json`)), [], id);
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMeasuredSpectrum, renderMeasuredSpectrum, parseMeasuredSpectrum } from './measured-spectrum.mts';

const recipe = {
  kind: 'measured-spectrum', id: 'fixture', title: 'Measurements', description: 'Published bins',
  output: 'chart.svg', metadata: {}, mode: 'points', notes: [],
  source: { path: 'data.txt', format: 'columns', columns: { x: 0, xError: 1, y: 2, error: 3 }, yScale: 100, expectedRows: 3 },
  x: { label: 'Wavelength', minimum: 0, maximum: 4, ticks: [0, 2, 4] },
  y: { label: 'Depth (%)', minimum: -2, maximum: 4, ticks: [-2, 0, 4] },
};
test('keeps overlapping observations and signed errors; missing model values break the line', async () => {
  const root = await mkdtemp(join(tmpdir(), 'measured-spectrum-'));
  try {
    await writeFile(join(root, 'data.txt'), '# x dx depth error\n1 .1 .01 .002\n3 .2 -.01 .003\n2.9 .2 .02 .004\n');
    await writeFile(join(root, 'model.txt'), '0 .01\n1 .02\n2 nan\n3 .01\n4 .02\n');
    const data = await readMeasuredSpectrum(root, { ...recipe, model: { path: 'model.txt', label: 'Model', yScale: 100, expectedRows: 5 } });
    assert.deepEqual(data.points, [
      { x: 1, xLow: .9, xHigh: 1.1, y: 1, minus: .2, plus: .2 },
      { x: 3, xLow: 2.8, xHigh: 3.2, y: -1, minus: .3, plus: .3 },
      { x: 2.9, xLow: 2.6999999999999997, xHigh: 3.1, y: 2, minus: .4, plus: .4 },
    ]);
    assert.equal(data.model[2]!.y, null);
    const svg = renderMeasuredSpectrum(data);
    assert.equal(svg.match(/class="measurement"/g)?.length, 3);
    const path = svg.match(/class="published-model" d="([^"]*)"/)![1]!;
    assert.equal(path.match(/M/g)?.length, 2);
    assert.equal(path.match(/L/g)?.length, 2);
    await assert.rejects(readMeasuredSpectrum(root, { ...recipe, y: { ...recipe.y, minimum: 0, ticks: [0, 2, 4] } }), /clip/);
    await assert.rejects(readMeasuredSpectrum(root, { ...recipe, source: { ...recipe.source, expectedRows: 2 } }), /count/);
    await writeFile(join(root, 'data.txt'), '1 .1 .01 -.002\n3 .2 -.01 .003\n2.9 .2 .02 .004\n');
    await assert.rejects(readMeasuredSpectrum(root, recipe), /errors/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('retains asymmetric errors and renders an integrated band without a wavelength marker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'measured-band-'));
  try {
    await writeFile(join(root, 'band.json'), JSON.stringify({ schema: 'cssearth-measured-spectrum@1', measurements: [{ xLow: 0, xHigh: 4, y: 1, minus: .1, plus: .2 }] }));
    const data = await readMeasuredSpectrum(root, { ...recipe, mode: 'band', source: { path: 'band.json', format: 'records', yScale: 1, expectedRows: 1 } });
    assert.deepEqual(data.points[0], { x: 2, xLow: 0, xHigh: 4, y: 1, minus: .1, plus: .2 });
    assert.doesNotMatch(renderMeasuredSpectrum(data), /<circle|published-model/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('rejects unsafe paths and malformed scales and axes before reading', () => {
  for (const path of ['../escape', '/absolute', 'a\\b', '']) assert.throws(() => parseMeasuredSpectrum({ ...recipe, source: { ...recipe.source, path } }));
  for (const scale of [-1, 0, Infinity]) assert.throws(() => parseMeasuredSpectrum({ ...recipe, source: { ...recipe.source, yScale: scale } }));
  assert.throws(() => parseMeasuredSpectrum({ ...recipe, x: { ...recipe.x, ticks: [2, 1] } }));
});

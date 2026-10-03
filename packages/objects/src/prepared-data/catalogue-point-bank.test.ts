import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseCataloguePoints, parseCataloguePointSteps } from './catalogue-point-bank.js';
import { catalogueCells, cataloguePointSpread, decodeCatalogueBankBinary } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';

/** What the bake adds to a published bank (catalogue-banks.ts): its spread and its cells, per level. */
const baked = (points: readonly (readonly number[])[], levels?: readonly number[]) => ({ spread: cataloguePointSpread(points), cells: catalogueCells(points, levels) });

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-20, -20, -20], max: [20, 20, 20] } };
const bank = { schema: 'cssearth-catalogue-points@1', id: 'test-stars', frame,
  appearance: { colorCss: '#ffe2a8', radiusPx: .75, opacity: .7 }, points: [[1, 0, -10], [-1, 0, -10]],
  ...baked([[1, 0, -10], [-1, 0, -10]]) };

test('the prepared catalogues the app draws are valid banks of every selected row with a distance', () => {
  // The published banks: what each recipe marks `published: true` and the app fetches. Their inputs (a survey's stars,
  // one catalogue's masers) are bake inputs in output/catalogue-points/, so they are not read here.
  for (const [object, id] of [['milky-way-volume', 'globular-clusters'], ['milky-way-volume', 'dots'], ['milky-way-volume', 'old-star-dots'], ['nuclear-star-cluster', 'dots'], ['nearby-universe-galaxies', 'dots'], ['nearby-universe-galaxies', 'bright-galaxy-dots'],
    ['nearby-universe-galaxies', 'quasar-dots'], ['m31-layers', 'stars'], ['m31-layers', 'dots'], ['m33-layers', 'stars'], ['m33-layers', 'dots'], ['m81-layers', 'dots'], ['ngc-253-layers', 'dots']]) {
    const path = new URL(`../../../../src/objects/${object}/prepared/${id}.bin`, import.meta.url);
    const prepared = decodeCatalogueBankBinary(unpackPreparedBinary(readFileSync(path), path.pathname), path.pathname) as {
      points: number[][]; counts: { points: number; missingDistance?: number; selected?: number }; source?: string; appearance: { levels?: { points: number }[] } };
    const parsed = parseCataloguePoints(prepared);
    assert.equal(parsed.id, id);
    assert.equal(parsed.points.length, prepared.counts.points);
    assert.deepEqual(parsed.spread, cataloguePointSpread(prepared.points), `${object}/${id}: the bake's spread is the one its points trace`);
    const cells = catalogueCells(prepared.points, prepared.appearance.levels?.map(level => level.points));
    assert.deepEqual(([...parsed.cells.of]), cells.of, `${object}/${id}: the bake's cells are the ones its points and levels give`);
    // A merged or stacked bank (packages/bake/cli/merge-catalogue-points.mts, stack.mts) counts only its points; a prepared one also its rows.
    if (prepared.source !== 'merge' && prepared.source !== 'stack') assert.equal((prepared.counts.points + prepared.counts.missingDistance!), prepared.counts.selected);
  }
});

test('a palette bank colors each point by its index and refuses an index outside the palette', () => {
  const colored = { ...bank, appearance: { ...bank.appearance, palette: ['#8ec9ff', '#ffc070'] }, points: [[1, 0, -10, 0], [-1, 0, -10, 1]] };
  assert.deepEqual(parseCataloguePoints(colored).points.map(point => point.colorCss), ['#8ec9ff', '#ffc070']);
  assert.throws(() => parseCataloguePoints({ ...colored, points: [[1, 0, -10, 2]] }), /test-stars: point 0 names palette color 2/);
});

test('catalogue point banks refuse malformed points and appearances, naming the bank', () => {
  assert.throws(() => parseCataloguePoints({ ...bank, points: [[1, 0]] }), /test-stars: point 0/);
  assert.throws(() => parseCataloguePoints({ ...bank, appearance: { ...bank.appearance, colorCss: 'gold' } }), /test-stars: catalogue point appearance/);
  assert.throws(() => parseCataloguePoints({ ...bank, points: [] }), /test-stars: a catalogue point bank holds/);
  const { spread: _spread, ...unspread } = bank;
  const { cells: _cells, ...uncelled } = bank;
  assert.throws(() => parseCataloguePoints(uncelled), /test-stars \(catalogue points\): catalogue point bank field cells must be/);
  assert.throws(() => parseCataloguePoints(unspread), /test-stars \(catalogue points\): catalogue point bank field spread must be .* got undefined/);
  assert.throws(() => parseCataloguePoints({ ...bank, spread: { normal: [1, 1, 0], across: 1, along: 0 } }), /test-stars \(catalogue points\): catalogue point bank field spread/);
  assert.throws(() => parseCataloguePoints({ ...bank, spread: { ...bank.spread, across: -1 } }), /test-stars \(catalogue points\): catalogue point bank field spread/);
});

test('a bank read in steps is the bank read in one call, a few points a step, and refuses the same point', () => {
  const points = Array.from({ length: 10 }, (_, index) => [index, 0, -10, index % 2]);
  const colored = { ...bank, appearance: { ...bank.appearance, palette: ['#8ec9ff', '#ffc070'] }, points, ...baked(points) };
  const steps = parseCataloguePointSteps(colored, 'steps', 4);
  let step = steps.next(), pauses = 0;
  for (; !step.done; step = steps.next()) pauses++;
  // Ten points, four a step: a pause after the fourth and the eighth, and one before the cells are read.
  assert.equal(pauses, 3);
  assert.deepEqual(step.value, parseCataloguePoints(colored, 'steps'));
  const broken = parseCataloguePointSteps({ ...colored, points: points.map((point, index) => index === 9 ? [9, 0, -10, 2] : point) }, 'steps', 4);
  assert.equal(broken.next().done, false);
  assert.equal(broken.next().done, false);
  assert.throws(() => broken.next(), /test-stars: point 9 names palette color 2/);
});

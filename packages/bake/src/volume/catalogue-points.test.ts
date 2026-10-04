import { readFileSync } from 'node:fs';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { decodeCatalogueBankBinary, readCataloguePointBank, parseCatalogueCells } from '@cssearth/objects';
import { unpackPreparedBinary } from '@cssearth/objects/node';
import assert from 'node:assert/strict';
import { catalogueCells, cataloguePointSpread } from './index.ts';

const grid = (count: number) => Array.from({ length: count }, (_, index) => [index % 10, Math.floor(index / 10) % 10, Math.floor(index / 100), index % 3]);

test('cells hold at most their share of points, each point in a box that holds it', () => {
  const points = grid(1000), cells = catalogueCells(points, undefined, 64);
  const sizes = new Map<number, number>();
  cells.of.forEach((cell, index) => {
    sizes.set(cell, (sizes.get(cell) ?? 0) + 1);
    const box = cells.boxes[cell]!;
    for (let axis = 0; axis < 3; axis++) assert.equal((points[index]![axis]! >= box[axis]! && points[index]![axis]! <= box[axis + 3]!), true);
  });
  assert.ok(Math.max(...sizes.values()) <= 64);
  assert.equal(sizes.size, cells.boxes.length);
  assert.deepEqual(catalogueCells(points, undefined, 64), cells, 'the same rows give the same cells');
});

test('a cell never spans two levels, and the parsed cells match the written ones', () => {
  const points = grid(300), cells = catalogueCells(points, [100, 200], 64);
  const levelOf = (index: number) => index < 100 ? 0 : 1, cellLevel = new Map<number, number>();
  cells.of.forEach((cell, index) => { assert.equal((cellLevel.get(cell) ?? levelOf(index)), levelOf(index)); cellLevel.set(cell, levelOf(index)); });
  const parsed = parseCatalogueCells(cells, points, [100, 200], 'bank');
  assert.deepEqual(([...parsed.of]), cells.of);
  assert.deepEqual(([...parsed.boxes]), cells.boxes.flat());
  assert.throws(() => catalogueCells(points, [100, 100]), /Levels of 100 \+ 100 points do not add up to the bank's 300/u);
});


test('the prepared catalogues the app draws are valid banks of every selected row with a distance', () => {
  // The published banks: what each recipe marks `published: true` and the app fetches. Their inputs (a survey's stars,
  // one catalogue's masers) are bake inputs in output/catalogue-points/, so they are not read here.
  for (const [object, id] of [['milky-way-volume', 'globular-clusters'], ['milky-way-volume', 'dots'], ['milky-way-volume', 'old-star-dots'], ['nuclear-star-cluster', 'dots'], ['nearby-universe-galaxies', 'dots'], ['nearby-universe-galaxies', 'bright-galaxy-dots'],
    ['nearby-universe-galaxies', 'quasar-dots'], ['m31-layers', 'stars'], ['m31-layers', 'dots'], ['m33-layers', 'stars'], ['m33-layers', 'dots'], ['m81-layers', 'dots'], ['ngc-253-layers', 'dots']]) {
    const path = new URL(`../../../../src/objects/${object}/prepared/${id}.bin`, import.meta.url);
    const prepared = decodeCatalogueBankBinary(unpackPreparedBinary(readFileSync(path), path.pathname), path.pathname) as {
      points: number[][]; counts: { points: number; missingDistance?: number; selected?: number }; source?: string; appearance: { levels?: { points: number }[] } };
    const parsed = readCataloguePointBank(prepared);
    assert.equal(parsed.id, id);
    assert.equal(parsed.points.length, prepared.counts.points);
    assert.deepEqual(parsed.spread, cataloguePointSpread(prepared.points), `${object}/${id}: the bake's spread is the one its points trace`);
    const cells = catalogueCells(prepared.points, prepared.appearance.levels?.map(level => level.points));
    assert.deepEqual(([...parsed.cells.of]), cells.of, `${object}/${id}: the bake's cells are the ones its points and levels give`);
    // A merged or stacked bank (packages/bake/cli/merge-catalogue-points.mts, stack.mts) counts only its points; a prepared one also its rows.
    if (prepared.source !== 'merge' && prepared.source !== 'stack') assert.equal((prepared.counts.points + prepared.counts.missingDistance!), prepared.counts.selected);
  }
});


test('principal-axis spread prepares the flat-disc reach read by the renderer', () => {
  // A flat disc of radius 10 in the x-y plane.
  const disc = Array.from({ length: 2000 }, (_, i) => [10 * Math.sqrt((i + .5) / 2000) * Math.cos(i * 2.4), 10 * Math.sqrt((i + .5) / 2000) * Math.sin(i * 2.4), 0]);
  const spread = cataloguePointSpread(disc);
  assert.ok(Math.abs(Math.abs(spread.normal[2]) - (1)) < 10 ** -6 / 2, `${Math.abs(spread.normal[2])} is not close to ${1}`);
  assert.ok(spread.across > 9); assert.ok(Math.abs(spread.along - (0)) < 10 ** -6 / 2, `${spread.along} is not close to ${0}`);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceLoad, sourceTest } from '../../tests/objects/source-test.mts';
import { assertPinnedInputs, ORACLE_ROOT, readOracleFixture } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { parseApproachRecipe, spacecraftApproach } from '@cssearth/spice';
import { loadKernelSet } from '@cssearth/spice/node';
import { kernelBankPaths } from '../kernel-banks/kernel-bank.mts';

/**
 * tools/oracles/spice/new-horizons-approach.py runs SpiceyPy over the pinned new-horizons kernel bank with each body's
 * approach recipe; this test reads the same recipes and kernels through tools/spice/ and compares.
 */
const loaded = await sourceLoad(async () => {
  const fixture = await readOracleFixture('spice/new-horizons-approach.json');
  await assertPinnedInputs(fixture.inputs);
  const results = await Promise.all(['pluto', 'charon'].map(async body => {
    const recipe = parseApproachRecipe(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects', body, 'source/preparation/approach.json'), 'utf8')), body);
    return [body, spacecraftApproach(await loadKernelSet(await kernelBankPaths(recipe.kernelSet, recipe.kernels)), recipe)] as const;
  }));
  return { fixture, results };
});
const test = sourceTest(null, loaded);

test('the approach direction and closest approach match SpiceyPy for Pluto and Charon', () => {
  for (const [body, result] of loaded.values.results) {
    const expected = requireRecord(loaded.values.fixture.cases[body], body);
    const direction = requireArray(expected.direction).map(value => requireFiniteNumber(value));
    assert.ok(Math.abs(result.closestApproachEt - requireFiniteNumber(expected.closestApproachEt)) < 0.01, `${body} closest approach`);
    assert.ok(Math.abs(result.rangeKm - requireFiniteNumber(expected.rangeKm)) < 1e-3, `${body} range`);
    // Both searches stop within a millisecond of closest approach; the body turns about 1e-8 radians in that time. 1e-7 is 20
    // milliarcseconds.
    assert.ok(Math.hypot(...result.direction.map((value, axis) => value - direction[axis]!)) < 1e-7, `${body} direction`);
  }
});

test('an approach recipe states its schema, NAIF ids, window and inbound time', () => {
  const valid = { schema: 'cssearth-spacecraft-approach@1', kernelSet: 'new-horizons', kernels: ['lsk/naif0012.tls'], spacecraft: -98, body: 999,
    frame: 'IAU_PLUTO', searchWindowUtc: ['2015-07-14T08:00:00Z', '2015-07-14T16:00:00Z'], inboundHours: 12 };
  assert.equal(parseApproachRecipe(valid, 'pluto').body, 999);
  assert.throws(() => parseApproachRecipe({ ...valid, schema: 'x' }, 'pluto'), /pluto: schema is x/);
  assert.throws(() => parseApproachRecipe({ ...valid, spacecraft: 'NEW HORIZONS' }, 'pluto'), /pluto: spacecraft is NEW HORIZONS/);
  assert.throws(() => parseApproachRecipe({ ...valid, searchWindowUtc: ['2015-07-14T08:00:00Z'] }, 'pluto'), /searchWindowUtc has 1 instants/);
  assert.throws(() => parseApproachRecipe({ ...valid, inboundHours: 0 }, 'pluto'), /inboundHours is 0/);
});

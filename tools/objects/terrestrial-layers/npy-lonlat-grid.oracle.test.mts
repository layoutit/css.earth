import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve } from 'node:path';
import { decodeNpyLonLatGrid, readNpy } from './npy-lonlat-grid.mts';
import { readOracleFixture, assertPinnedInputs, readOracleInput, sampleList } from '../../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../../sources/source-values.mts';

/** numpy as the oracle for the .npy reader and nearest-node lookup over Psyche's ALMA thermal-inertia grid. */
const fixture = await readOracleFixture('npy/psyche-alma.json');
const byName = new Map(await Promise.all(fixture.inputs.map(async input =>
  [input.path.split('/').pop()!.replace('.npy', ''), readNpy(await readOracleInput(input))] as const)));

test('the fixture is bound to the pinned ALMA grids', async () => {
  await assertPinnedInputs(fixture.inputs);
  assert.equal(fixture.inputs.length, 4);
});

test('dtypes, shapes, missing nodes and sampled values match numpy.load', () => {
  let compared = 0;
  for (const [name, expectedValue] of Object.entries(requireRecord(fixture.cases.arrays))) {
    const expected = requireRecord(expectedValue), array = byName.get(name)!;
    assert.equal(array.descr, expected.dtype, name);
    assert.deepEqual(array.shape, requireArray(expected.shape).map(n => requireFiniteNumber(n)), name);
    assert.equal([...array.values].filter(Number.isNaN).length, requireFiniteNumber(expected.missing), name);
    for (const { index, value } of sampleList(expected.samples)) { assert.equal(array.values[index], value, `${name} at ${index}`); compared++; }
  }
  assert.ok(compared >= 200, `${compared} values compared`);
});

test('nearest-node lookups match numpy, including longitudes beyond 180 and both half-cells at the antimeridian', () => {
  const grid = decodeNpyLonLatGrid({ values: byName.get('ThermalInertia_BestFitValue')!,
    longitudes: byName.get('LongitudeArray')!, latitudes: byName.get('LatitudeArray')! }, null);
  const nodes = requireArray(fixture.cases.nodes).map(value => requireRecord(value));
  for (const node of nodes) {
    const value = grid.sample(requireFiniteNumber(node.longitude), requireFiniteNumber(node.latitude));
    assert.equal(value, node.value === null ? null : requireFiniteNumber(node.value), JSON.stringify(node));
  }
  assert.equal(nodes.length, 96);
  assert.ok(nodes.filter(node => node.value !== null).length > 48);
});

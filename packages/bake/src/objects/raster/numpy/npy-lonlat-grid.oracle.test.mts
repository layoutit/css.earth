import { setupBakeOracleInputs } from '../../cameras/oracle-inputs.mts';
await setupBakeOracleInputs();
import assert from 'node:assert/strict';
import { sourceLoad, sourceTest, sourceValues } from '@cssearth/objects/node/source-test';
import { resolve } from 'node:path';
import { decodeNpyLonLatGrid, readNpy } from '@cssearth/bake/objects/raster';
import { readOracleFixture, assertPinnedInputs, readOracleInput, sampleList } from '@cssearth/core/oracle';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

/** numpy as the oracle for the .npy reader and nearest-node lookup over Psyche's ALMA thermal-inertia grid. */
const fixture = await readOracleFixture(new URL('psyche-alma.json', import.meta.url).pathname);
const loaded = await sourceLoad(async () => new Map(await Promise.all(fixture.inputs.map(async input =>
  [input.path.split('/').pop()!.replace('.npy', ''), readNpy(await readOracleInput(input))] as const))));
const test = sourceTest(null, loaded);

test('the fixture is bound to the pinned ALMA grids', async () => {
  await assertPinnedInputs(fixture.inputs);
  assert.equal(fixture.inputs.length, 4);
});

test('dtypes, shapes, missing nodes and sampled values match numpy.load', () => {
  let compared = 0;
  for (const [name, expectedValue] of Object.entries(requireRecord(fixture.cases.arrays))) {
    const expected = requireRecord(expectedValue), array = sourceValues(loaded).get(name)!;
    assert.equal(array.descr, expected.dtype, name);
    assert.deepEqual(array.shape, requireArray(expected.shape).map(n => requireFiniteNumber(n)), name);
    assert.equal([...array.values].filter(Number.isNaN).length, requireFiniteNumber(expected.missing), name);
    for (const { index, value } of sampleList(expected.samples)) { assert.equal(array.values[index], value, `${name} at ${index}`); compared++; }
  }
  assert.ok(compared >= 200, `${compared} values compared`);
});

test('nearest-node lookups match numpy, including longitudes beyond 180 and both half-cells at the antimeridian', () => {
  const grid = decodeNpyLonLatGrid({ values: sourceValues(loaded).get('ThermalInertia_BestFitValue')!,
    longitudes: sourceValues(loaded).get('LongitudeArray')!, latitudes: sourceValues(loaded).get('LatitudeArray')! }, null);
  const nodes = requireArray(fixture.cases.nodes).map(value => requireRecord(value));
  for (const node of nodes) {
    const value = grid.sample(requireFiniteNumber(node.longitude), requireFiniteNumber(node.latitude));
    assert.equal(value, node.value === null ? null : requireFiniteNumber(node.value), JSON.stringify(node));
  }
  assert.equal(nodes.length, 96);
  assert.ok(nodes.filter(node => node.value !== null).length > 48);
});

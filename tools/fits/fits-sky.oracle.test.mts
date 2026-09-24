import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFitsHdus } from '@cssearth/fits';
import { skyDisplayRaster, skyImageAxes } from './fits-sky.mts';
import { readOracleFixture, readOracleInput } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

const fixture = await readOracleFixture('fits/sky-orientation.json');
const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/sky-orientation.fits');
assert.ok(input);
// Read the WCS cards the oracle wrote, not copies of them.
const headers = new Map(readFitsHdus(await readOracleInput(input)).slice(1).map(hdu => [hdu.header.EXTNAME, hdu.header]));

for (const [name, raw] of Object.entries(fixture.cases)) test(`Astropy sky orientation: ${name}`, () => {
  const entry = requireRecord(raw), header = headers.get(name);
  assert.ok(header, `${name} has an extension`);
  if (entry.refused === true) { assert.throws(() => skyImageAxes(header), /rotated or skewed/); return; }
  const axes = skyImageAxes(header), expected = requireArray(entry.scale).map(value => requireFiniteNumber(value));
  assert.equal(axes.eastRight, entry.eastRight);
  assert.equal(axes.northUp, entry.northUp);
  axes.scale.forEach((scale, i) => assert.ok(Math.abs(scale - expected[i]!) <= 1e-6 * expected[i]!, `${name} scale ${i}: ${scale} vs ${expected[i]}`));
  const values = Float64Array.from(requireArray(entry.values).map(value => requireFiniteNumber(value)));
  assert.deepEqual([...skyDisplayRaster(values, 3, 2, axes)], requireArray(entry.display));
});

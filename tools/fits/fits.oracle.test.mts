import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFitsHdus, readFitsImage } from './fits.mts';
import { readOracleFixture, readOracleInput, verifyOracleBytes } from '../oracles/fixture.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';

const fixture = await readOracleFixture('fits/core.json');
for (const [name, raw] of Object.entries(fixture.cases)) test(`Astropy conformance: ${name}`, async () => {
  const entry = requireRecord(raw), path = requireString(entry.path), input = fixture.inputs.find(i => i.path === path);
  assert.ok(input);
  const bytes = await readOracleInput(input), hdus = readFitsHdus(bytes), hdu = hdus[entry.extension === 1 ? 1 : 0];
  assert.ok(hdu);
  assert.deepEqual(hdu.dimensions, requireArray(entry.dimensions).map(v => requireFiniteNumber(v)));
  const values: number[] = [];
  for (let plane = 1; plane <= (hdu.dimensions[2] ?? 1); plane++)
    values.push(...readFitsImage(bytes, { start: entry.extension === 1 ? hdus[0]!.nextOffset : 0, plane }).values);
  assert.deepEqual(values.map(v => Number.isNaN(v) ? null : v), entry.values);
  if (entry.hierarchy) assert.deepEqual(Object.fromEntries(Object.entries(hdu.header).filter(([key]) => key.startsWith('ESO '))), entry.hierarchy);
  if (entry.longString) assert.equal(hdu.header.CPYRIGHT, entry.longString);
  if (entry.units) {
    assert.equal(hdu.header.BUNIT, entry.units); assert.equal(hdu.header.OBSERVER, entry.observer);
    assert.ok(Object.hasOwn(hdu.header, 'UNUSED')); assert.equal(hdu.header.UNUSED, undefined);
  }
});

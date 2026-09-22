import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { readRiceCompressedImage } from './fits-rice.mts';
import { hmiPixel, hmiRecordGeometry } from '../objects/observation/hmi-continuum.mts';
import { ORACLE_ROOT, readOracleFixture, readOracleInput } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';

const fixture = await readOracleFixture('fits/rice.json');
const numbers = (value: unknown) => requireArray(value).map(v => v === null ? NaN : requireFiniteNumber(v));

for (const name of ['rice-int16', 'rice-uint8', 'rice-int32']) test(`Astropy RICE_1 conformance: ${name}`, async () => {
  const entry = requireRecord(fixture.cases[name]), path = requireString(entry.path);
  const input = fixture.inputs.find(candidate => candidate.path === path);
  assert.ok(input);
  const image = readRiceCompressedImage(await readOracleInput(input));
  assert.equal(image.width, requireFiniteNumber(entry.width));
  assert.equal(image.height, requireFiniteNumber(entry.height));
  const raw = numbers(entry.raw), physical = numbers(entry.physical), scale = requireFiniteNumber(entry.bscale), zero = requireFiniteNumber(entry.bzero);
  image.values.forEach((value, index) => {
    // Astropy returns float32 physical values; the raw integers are compared exactly through the declared scaling.
    if (Number.isNaN(physical[index]!)) { assert.ok(Number.isNaN(value), `sample ${index} should be BLANK`); return; }
    assert.equal(value, raw[index]! * scale + zero, `sample ${index}`);
    assert.ok(Math.abs(value - physical[index]!) <= 1e-6 * Math.max(1, Math.abs(value)), `sample ${index} against astropy`);
  });
});

test('Astropy RICE_1 conformance: a truncated tile is refused', async () => {
  const entry = requireRecord(fixture.cases['rice-int16']), input = fixture.inputs.find(candidate => candidate.path === requireString(entry.path));
  assert.ok(input);
  const bytes = await readOracleInput(input);
  assert.throws(() => readRiceCompressedImage(bytes.subarray(0, bytes.length - 2880)), /heap|Truncated/u);
});

test('Astropy WCS conformance: HMI helioprojective pixels under CROTA2', async () => {
  const entry = requireRecord(fixture.cases['hmi-wcs']);
  const response = JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects/sun/source/hmi/continuum/keywords.json'), 'utf8'));
  const geometry = hmiRecordGeometry(response, requireString(entry.record));
  for (const raw of requireArray(entry.pixels)) {
    const point = requireRecord(raw), [x, y] = hmiPixel(geometry, requireFiniteNumber(point.west), requireFiniteNumber(point.north));
    // Our map is linear in arcseconds; astropy applies the TAN projection, 0.013 px apart at the limb.
    assert.ok(Math.abs(x - requireFiniteNumber(point.x)) < 0.02 && Math.abs(y - requireFiniteNumber(point.y)) < 0.02,
      `${point.west}", ${point.north}": ${x}, ${y} vs ${point.x}, ${point.y}`);
  }
});

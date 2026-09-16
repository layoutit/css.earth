import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFitsImage } from '../fits.mts';
import { readOracleFixture, readOracleInput } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../source-values.mts';
import { asinhBandDisplay, encodeAsinhBands } from './color-transfer.mts';

const fixture = await readOracleFixture('fits/lupton-asinh.json');
const input = fixture.inputs.find(entry => entry.path === 'tests/fixtures/fits/lupton-bands.fits');
assert.ok(input);
const cube = await readOracleInput(input);
const planes = [1, 2, 3].map(plane => readFitsImage(cube, { plane }).values);

for (const [name, raw] of Object.entries(fixture.cases)) test(`Astropy make_lupton_rgb bytes: ${name}`, () => {
  const entry = requireRecord(raw), count = planes[0]!.length, missing = new Uint8Array(count);
  for (const index of requireArray(entry.missing)) missing[requireFiniteNumber(index)] = 1;
  const monochrome = entry.monochrome === true, bands = monochrome ? ['green'] : ['red', 'green', 'blue'];
  const values = new Float64Array(count * bands.length);
  for (let pixel = 0; pixel < count; pixel++) {
    if (missing[pixel]) continue;
    if (monochrome) values[pixel] = planes[1]![pixel]!;
    else for (let band = 0; band < 3; band++) values[pixel * 3 + band] = planes[band]![pixel]!;
  }
  const display = asinhBandDisplay(bands, { minimum: entry.minimum, stretch: entry.stretch, softening: entry.softening });
  assert.deepEqual([...encodeAsinhBands(values, missing, display)], requireArray(entry.bytes));
});

test('an asinh display has one common black level, stretch and softening and no other keys', () => {
  assert.throws(() => asinhBandDisplay(['W4', 'W2'], { minimum: 0, stretch: 1, softening: 8 }), /one band or three/);
  assert.throws(() => asinhBandDisplay(['W4', 'W4', 'W1'], { minimum: 0, stretch: 1, softening: 8 }), /one band or three/);
  assert.throws(() => asinhBandDisplay(['W4', 'W2', 'W1'], { minimum: 0, stretch: 0, softening: 8 }), /positive/);
  assert.throws(() => asinhBandDisplay(['W4', 'W2', 'W1'], { minimum: 0, stretch: 1, softening: 8, gains: [1, 2, 1] }), /only minimum/);
  assert.throws(() => encodeAsinhBands(new Float64Array([NaN, 1, 1]), new Uint8Array([0]), asinhBandDisplay(['a', 'b', 'c'], { minimum: 0, stretch: 1, softening: 8 })), /finite/);
  // @ts-expect-error Deliberately exercise the runtime guard against encoded bytes.
  assert.throws(() => encodeAsinhBands(new Uint8Array([1, 2, 3]), new Uint8Array([0]), asinhBandDisplay(['a', 'b', 'c'], { minimum: 0, stretch: 1, softening: 8 })), /floating/);
});

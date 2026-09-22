import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFitsImage } from '../fits/fits.mts';
import { readOracleFixture, readOracleInput } from '../oracles/fixture.mts';
import { requireArray, requireFiniteNumber, requireRecord } from '../sources/source-values.mts';
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
  assert.throws(() => asinhBandDisplay(['W4', 'W3', 'W2', 'W1'], { minimum: 0, stretch: 1, softening: 8 }), /one band, two or three/);
  assert.throws(() => asinhBandDisplay(['W4', 'W4', 'W1'], { minimum: 0, stretch: 1, softening: 8 }), /one band, two or three/);
  assert.throws(() => asinhBandDisplay(['W1', 'W1'], { minimum: 0, stretch: 1, softening: 8 }), /one band, two or three/);
  assert.throws(() => asinhBandDisplay(['W4', 'W2', 'W1'], { minimum: 0, stretch: 0, softening: 8 }), /positive/);
  assert.throws(() => asinhBandDisplay(['W4', 'W2', 'W1'], { minimum: 0, stretch: 1, softening: 8, gains: [1, 2, 1] }), /only minimum/);
  assert.throws(() => encodeAsinhBands(new Float64Array([NaN, 1, 1]), new Uint8Array([0]), asinhBandDisplay(['a', 'b', 'c'], { minimum: 0, stretch: 1, softening: 8 })), /finite/);
  // @ts-expect-error Deliberately exercise the runtime guard against encoded bytes.
  assert.throws(() => encodeAsinhBands(new Uint8Array([1, 2, 3]), new Uint8Array([0]), asinhBandDisplay(['a', 'b', 'c'], { minimum: 0, stretch: 1, softening: 8 })), /floating/);
});

test('two bands display as red and blue with their mean as green, exactly the three-band bytes', () => {
  const settings = { minimum: 0.02, stretch: 0.5, softening: 8 }, red = [0, 0.3, 1.4, 0.05], blue = [0.2, 0.9, 0.1, 0.05];
  const two = new Float64Array(red.flatMap((value, i) => [value, blue[i]!])), three = new Float64Array(red.flatMap((value, i) => [value, (value + blue[i]!) / 2, blue[i]!]));
  const missing = new Uint8Array([0, 0, 0, 1]);
  const bytes = encodeAsinhBands(two, missing, asinhBandDisplay(['W2', 'W1'], settings));
  assert.deepEqual([...bytes], [...encodeAsinhBands(three, missing, asinhBandDisplay(['W2', 'mean', 'W1'], settings))]);
  assert.ok(bytes[6]! > bytes[7]! && bytes[7]! > bytes[8]! && bytes[5]! > bytes[4]! && bytes[4]! > bytes[3]!, 'Green lies between the red and blue bands.');
  assert.deepEqual([...bytes.subarray(9)], [0, 0, 0], 'Missing pixels stay black.');
});

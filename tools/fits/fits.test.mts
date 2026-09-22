import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { fitsCardValue, readFitsHeader, readFitsHdu, readFitsHdus, readFitsImage, fitsImageAccessor, assertUnscaledFitsTable } from './fits.mts';
import { readFitsPrimary, readFitsPlane } from '../objects/observation/fits.mts';
import { card, imageFixture } from '../../tests/fixtures/fits/helpers.mts';

test('quoted slashes, escaped quotes, undefined metadata and D exponents are preserved', () => {
  assert.equal(fitsCardValue(card('BUNIT', "'W/(m^2*sr*um)' / units")), 'W/(m^2*sr*um)');
  assert.equal(fitsCardValue(card('OBJECT', "'O''Brien / field'")), "O'Brien / field");
  assert.equal(fitsCardValue(card('UNUSED', '/ no value')), undefined);
  assert.equal(fitsCardValue(card('BSCALE', '-2.5D-2')), -.025);
  const sdo = imageFixture(16, [0, 1], ["ORIGIN  ='SDO/JSOC-SDP'".padEnd(80)]);
  assert.equal(readFitsHeader(sdo).header.ORIGIN, 'SDO/JSOC-SDP');
  assert.equal(fitsCardValue(card('T_OBS', '2026.5.26_12:30:59_TAI / SDO')), '2026.5.26_12:30:59_TAI');
  assert.throws(() => fitsCardValue(card('BSCALE', '2026.5.26_12:30:59_TAI')), /scalar/);
  const bytes = imageFixture(16, [-2, 0, 1, 3], [card('BSCALE', '2D0'), card('BZERO', '-1D0'), card('UNUSED', '')]);
  assert.deepEqual([...readFitsPrimary(bytes).values], [-5, -1, 1, 5]);
  assert.deepEqual([...readFitsPlane(bytes).values], [-5, -1, 1, 5]);
  assert.equal(readFitsPrimary(imageFixture(16, [0, 1], [card('BUNIT', "'W/m2'")])).header.BUNIT, "'W/m2'");
});

test('integer BLANK is tested before scaling, not confused with zero or negative radiance', () => {
  const image = readFitsImage(imageFixture(16, [-2, 0, 1, 3], [card('BLANK', '-2'), card('BSCALE', '2'), card('BZERO', '-2')]));
  assert.deepEqual([...image.values], [NaN, -2, 0, 4]);
  assert.deepEqual([...readFitsImage(imageFixture(16, [-32768, -1, 0, 32767], [card('BZERO', '32768')])).values], [0, 32767, 32768, 65535]);
  const floatingBlank = readFitsImage(imageFixture(-32, [0, 1], [card('BLANK', '0')]));
  assert.deepEqual([...floatingBlank.values], [0, 1]);
  assert.match(floatingBlank.warnings[0], /BLANK ignored/);
  assert.throws(() => readFitsImage(imageFixture(8, [0, 1], [card('BLANK', '-1')])), /BLANK/);
});

test('supported numeric widths and native row order, including signed int32', () => {
  for (const bits of [8, 16, 32, -32, -64]) {
    const values = bits === 8 ? [0, 128, 255, 1] : [-2, 0, 1, 3];
    assert.deepEqual([...readFitsImage(imageFixture(bits, values)).values], values);
  }
  assert.deepEqual([...readFitsImage(imageFixture(32, [-2147483648, 2147483647])).values], [-2147483648, 2147483647]);
  assert.deepEqual([...readFitsImage(imageFixture(-64, [NaN, Infinity, -Infinity, -0])).values], [NaN, Infinity, -Infinity, -0]);
});

test('duplicate value keys fail, while commentary can repeat and undefined optional cards can survive', () => {
  assert.throws(() => readFitsHeader(imageFixture(16, [0, 1], [card('BITPIX', '16')])), /Duplicate/);
  const extra = ['COMMENT repeated'.padEnd(80), 'COMMENT repeated'.padEnd(80), 'HISTORY once'.padEnd(80), 'HISTORY twice'.padEnd(80), card('UNUSED', '')];
  assert.ok(Object.hasOwn(readFitsHeader(imageFixture(16, [0, 1], extra)).header, 'UNUSED'));
  for (const key of ['BSCALE', 'BZERO', 'BLANK']) assert.throws(() => readFitsImage(imageFixture(16, [0, 1], [card(key, '')])), /Invalid/);
});

test('invalid or unsupported card conventions are explicit errors', () => {
  for (const literal of ["'unclosed", "'closed' junk", '0x10', 'NaN', '(1,2)', '9007199254740993'])
    assert.throws(() => fitsCardValue(card('VALUE', literal)), /FITS/);
  for (const line of ['CONTINUE  continued', 'HIERARCH LONG = 1'])
    assert.throws(() => readFitsHeader(imageFixture(16, [0, 1], [line.padEnd(80)])), /Unsupported/);
});

test('CONTINUE records extend only an ampersand-terminated string that they immediately follow', () => {
  const long = [card('CPYRIGHT', "'IPAC/NASA - &'"), "CONTINUE  'http://example.org/a&'".padEnd(80), "CONTINUE  'b.html' / end".padEnd(80)];
  const header = readFitsHeader(imageFixture(16, [0, 1], long));
  assert.equal(header.header.CPYRIGHT, 'IPAC/NASA - http://example.org/ab.html');
  assert.deepEqual(header.cards.slice(5, 8), long);
  assert.equal(readFitsHeader(imageFixture(16, [0, 1], [card('NOTE', "'ends in &'")])).header.NOTE, 'ends in &');
  for (const records of [[card('NOTE', "'no ampersand'"), long[1]], [long[0], 'COMMENT between'.padEnd(80), long[2]],
    [card('NOTE', '1'), long[2]], [long[0], 'CONTINUE  12'.padEnd(80)], [long[0], "CONTINUE= 'x'".padEnd(80)]])
    assert.throws(() => readFitsHeader(imageFixture(16, [0, 1], records)), /CONTINUE/);
});

test('ESO HIERARCH values retain their full names and original cards', () => {
  const records = ["HIERARCH ESO OBS AIRM = 2D0 / Requested airmass", "HIERARCH ESO INS NAME = 'O''Brien / field'",
    'HIERARCH ESO DET ACTIVE = T', 'HIERARCH ESO DET UNUSED = / undefined'].map(c => c.padEnd(80));
  const image = readFitsImage(imageFixture(-64, [1, 2], records));
  assert.equal(image.header['ESO OBS AIRM'], 2);
  assert.equal(image.header['ESO INS NAME'], "O'Brien / field");
  assert.equal(image.header['ESO DET ACTIVE'], true);
  assert.ok(Object.hasOwn(image.header, 'ESO DET UNUSED'));
  assert.equal(image.header['ESO DET UNUSED'], undefined);
  assert.deepEqual(image.cards.slice(5, 9), records);
  assert.deepEqual([...image.values], [1, 2]);
  assert.throws(() => readFitsImage(imageFixture(16, [0, 1], [...records, records[0]])), /Duplicate/);
  const pipeline = ['HIERARCH PRO DISP COEF0 = 5.35550535653145', 'HIERARCH ESO MET OFFVOLT FC1FTx = -0.0022 / voltage'].map(c => c.padEnd(80));
  const written = readFitsHeader(imageFixture(16, [0, 1], pipeline)).header;
  assert.equal(written['PRO DISP COEF0'], 5.35550535653145);
  assert.equal(written['ESO MET OFFVOLT FC1FTx'], -0.0022);
  assert.equal(fitsCardValue('HIERARCH ESO DET CHIP PXSPACE= 3.000e-05 / Pixel-Pixel Spacing'.padEnd(80)), 3e-5);
  assert.equal(fitsCardValue(card('VALUE', '2.5d2')), 250);
  for (const c of ['HIERARCH ESO BAD', 'HIERARCH ESO BAD.NAME = 1', 'HIERARCH SIMPLE = F', 'HIERARCH eso DET = 1'])
    assert.throws(() => readFitsHeader(imageFixture(16, [0, 1], [c.padEnd(80)])), /HIERARCH/);
});

test('header, data and record truncation fail before reading or allocating pixels', () => {
  const bytes = imageFixture();
  for (const size of [0, 79, 560, 2879, 2880, 2887, 5759]) assert.throws(() => readFitsImage(bytes.subarray(0, size)), /FITS/);
  const noEnd = Buffer.from(bytes); noEnd.fill(32, 5 * 80, 2880);
  assert.throws(() => readFitsHeader(noEnd), /FITS/);
  assert.throws(() => readFitsHeader(bytes, 80), /offset/);
  assert.throws(() => readFitsImage(bytes, { maxDecodedBytes: 31 }), /budget/);
  const enormous = Buffer.from(bytes); enormous.write(card('NAXIS1', '9007199254740991'), 3 * 80);
  assert.throws(() => readFitsImage(enormous), /Unbounded/);
  const fractional = Buffer.from(bytes); fractional.write(card('NAXIS1', '1.5'), 3 * 80);
  assert.throws(() => readFitsImage(fractional), /NAXIS1/);
});

test('HDU identities, unsupported data and cube planes cannot be silently reinterpreted', () => {
  const bytes = imageFixture(), cube = imageFixture(16, [0, 1, 2, 3, 4, 5, 6, 7], [card('NAXIS3', '2')]);
  cube.write(card('NAXIS', '3'), 160); cube.write(card('NAXIS2', '2'), 320);
  assert.deepEqual([...readFitsImage(cube, { plane: 2 }).values], [4, 5, 6, 7]);
  for (const plane of [0, 1.5, 3, NaN]) assert.throws(() => readFitsImage(cube, { plane }), /plane/);
  assert.throws(() => readFitsHdus(Buffer.concat([bytes, bytes])), /sequence/);
  const int64 = Buffer.from(bytes); int64.write(card('BITPIX', '64'), 80);
  assert.throws(() => readFitsImage(int64), /int64/);
  for (const key of ['GROUPS', 'ZIMAGE']) assert.throws(() => readFitsHdu(imageFixture(16, [0, 1], [card(key, 'T')])), /compressed/);
  const at = fitsImageAccessor(bytes);
  for (const i of [-1, .5, 4, NaN]) assert.throws(() => at(i), /outside/);
  for (const key of ['TSCAL1', 'TZERO1', 'TNULL1']) assert.throws(() => assertUnscaledFitsTable({ [key]: 1 }), /scaling or null/);
});

test('degenerate trailing axes are read as the sky image they hold, and a populated fourth axis is not', () => {
  // Every ALMA product declares NAXIS = 4: two sky axes, then one frequency and one Stokes plane.
  const alma = Buffer.concat([
    Buffer.from([card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '4'), card('NAXIS1', '2'), card('NAXIS2', '2'),
      card('NAXIS3', '1'), card('NAXIS4', '1'), 'END'.padEnd(80)].join('').padEnd(2880)),
    (() => { const data = Buffer.alloc(2880); [1, 2, 3, 4].forEach((v, i) => data.writeFloatBE(v, i * 4)); return data; })(),
  ]);
  const image = readFitsImage(alma);
  assert.equal(image.width, 2);
  assert.equal(image.height, 2);
  assert.deepEqual([...image.values], [1, 2, 3, 4]);
  const cube = Buffer.concat([
    Buffer.from([card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '4'), card('NAXIS1', '2'), card('NAXIS2', '2'),
      card('NAXIS3', '1'), card('NAXIS4', '2'), 'END'.padEnd(80)].join('').padEnd(2880)),
    Buffer.alloc(2880),
  ]);
  assert.throws(() => fitsImageAccessor(cube), /Unsupported FITS image/);
});

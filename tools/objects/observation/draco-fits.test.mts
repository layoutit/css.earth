import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDracoIof } from './draco-fits.mts';

const width = 1024, height = 1024, outside = -999;
type HeaderValue = string | number | boolean;

function card(key: string, value: HeaderValue, comment = '') {
  const encoded = typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : String(value);
  return `${key.padEnd(8)}= ${encoded}${comment ? ` / ${comment}` : ''}`.padEnd(80);
}

function dracoFits(overrides: Record<string, HeaderValue> = {}, mutate?: (pixels: Float32Array) => void) {
  const header: Record<string, HeaderValue> = {
    SIMPLE: true, BITPIX: -32, NAXIS: 2, NAXIS1: width, NAXIS2: height,
    MISSION: 'DART', INSTRUME: 'DRACO', BINNING: 'ON', BADIMAGE: 'FALSE', RADIANCE: 'PERFORM', IOVERF: 'PERFORM',
    WINDOWX: 2, WINDOWY: 3, WINDOWW: 2, WINDOWH: 2, EXPTIME: 0.15,
    ACQ_UTC: '2022-09-26T23:14:12.737', TARGET: 'Dimorphos', IMGTMSEC: '401930040', IMGTMSUB: '7',
    MISPXVAL: -1, PXOUTWIN: outside, BADMASKV: -2, SATPXVAL: -3, OORADLUT: -4, IOVRFLAG: -5,
    ...overrides,
  };
  const cards = [...Object.entries(header).map(([key, value]) => card(key, value, key === 'ACQ_UTC' ? 'UTC acquisition time' : '')), 'END'.padEnd(80)];
  const headerBytes = Buffer.from(cards.join('').padEnd(2880), 'ascii');
  const pixels = new Float32Array(width * height).fill(outside);
  pixels[3 * width + 2] = 0;
  pixels[3 * width + 3] = -0.25;
  pixels[4 * width + 2] = -1;
  pixels[4 * width + 3] = Number.NaN;
  mutate?.(pixels);
  const dataBytes = Buffer.alloc(Math.ceil(pixels.byteLength / 2880) * 2880);
  for (let index = 0; index < pixels.length; index++) dataBytes.writeFloatBE(pixels[index]!, index * 4);
  return Buffer.concat([headerBytes, dataBytes]);
}

test('retains zero and negative I/F values inside the declared DRACO detector window', () => {
  const frame = decodeDracoIof(dracoFits());
  assert.deepEqual(frame.window, { x: 2, y: 3, width: 2, height: 2 });
  assert.equal(frame.values[3 * width + 2], 0);
  assert.ok(frame.values[3 * width + 3]! < 0);
  assert.equal(frame.reason(3 * width + 2), null);
  assert.equal(frame.reason(3 * width + 3), null);
  assert.equal(frame.reason(4 * width + 2), 'missing');
  assert.equal(frame.reason(4 * width + 3), 'nonfinite');
  assert.equal(frame.reason(0), 'outside-window');
  assert.equal(frame.reason(-1), 'outside-detector');
  assert.equal(frame.captureId, '0401930040_00007');
  assert.equal(frame.startTime, '2022-09-26T23:14:12.737');
  assert.equal(frame.target, 'Dimorphos');
  assert.equal(frame.report.acceptedPixels, 2);
  assert.equal(frame.report.rejected.missing, 1);
  assert.equal(frame.report.rejected.nonfinite, 1);
});

test('requires every pixel outside the declared window to use PXOUTWIN', () => {
  assert.throws(() => decodeDracoIof(dracoFits({}, pixels => { pixels[0] = 0; })), /window disagrees/u);
});

test('rejects identity and calibration declarations that cannot prove a calibrated DRACO frame', () => {
  assert.throws(() => decodeDracoIof(dracoFits({ MISSION: 'NOT-DART' })), /identity, geometry or calibration/u);
  assert.throws(() => decodeDracoIof(dracoFits({ EXPTIME: 0 })), /exposure/u);
  assert.throws(() => decodeDracoIof(dracoFits({ ACQ_UTC: '2022-09-31T23:14:12.737' })), /acquisition UTC/u);
  assert.throws(() => decodeDracoIof(dracoFits({ WINDOWX: 'not-a-number' })), /numeric field WINDOWX/u);
  assert.throws(() => decodeDracoIof(dracoFits({ SATPXVAL: -1 })), /special values overlap/u);
  assert.throws(() => decodeDracoIof(dracoFits({ BSCALE: 2 })), /scaled encounter FITS plane/u);
});

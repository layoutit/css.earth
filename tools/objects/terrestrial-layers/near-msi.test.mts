import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeNearMsi, mathildeImageCamera, readMathildeImageGeometry } from './near-msi.mts';
import { matrixCamera } from '../surface-observations/cameras.mts';

const table = readFileSync(new URL('../../../src/objects/mathilde/source/reference/253mathimg.tab', import.meta.url), 'utf8');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('released Mathilde table selects a reconstructed camera and rejects missing or ambiguous images', () => {
  const g = readMathildeImageGeometry(table, 42826360);
  assert.equal(g.latitude, 84.87); assert.equal(g.longitudeWest, 63.77); assert.equal(g.rangeKm, 1209.73);
  assert.throws(() => readMathildeImageGeometry(table, 42826361), /No reconstructed/);
  assert.throws(() => readMathildeImageGeometry(table.replace('42826370', '42826360'), 42826360), /Invalid Thomas/);
  assert.throws(() => readMathildeImageGeometry(table.replace('93', '94'), 42826360), /Invalid Thomas/);
});

test('table camera preserves west longitude, rectangular pixels and projected centre', () => {
  const closure = mathildeImageCamera(table, 42826360), camera = matrixCamera('archived-closure', closure);
  const projected = camera.project([0, 0, 0]);
  assert.ok(projected);
  const [x, y, depth] = projected;
  assert.ok(Math.abs(x - 345.7) < 1e-9);
  assert.ok(Math.abs(y - 184.2 * 16 / 27) < 1e-9);
  assert.ok(Math.abs(depth - 1209.73) < 1e-8);
  assert.ok(camera.positionKm[0] > 0 && camera.positionKm[1] < 0 && camera.positionKm[2] > 1200);
  // The ray through the published body centre returns to the origin.
  const ray = camera.ray(x, y);
  assert.ok(Math.hypot(...ray.map((v, i) => camera.positionMeters[i] + v * depth * 1000)) < 1e-6);
  assert.ok(camera.sunDirection);
  assert.ok(Math.abs(Math.asin(camera.sunDirection[2]) * 180 / Math.PI + 1.03) < 1e-10);
});

/** Synthetic detector values exercise unsigned FITS decoding and native masks.
 * These are deliberately not scientific images or registration evidence. */
function fits(raw: boolean, overrides: Record<string, string | number | boolean> = {}) {
  const width = 537, height = 244, bitpix = raw ? 16 : -32;
  const fields: Record<string, string | number | boolean> = { SIMPLE: true, BITPIX: bitpix, NAXIS: 2, NAXIS1: width, NAXIS2: height,
    BSCALE: 1, BZERO: raw ? 32768 : 0, BUNIT: raw ? 'RAW-DN' : 'I/F', 'NEAR-005': 'MSI.004', 'NEAR-047': 'MATHILDE',
    'NEAR-046': 2000253, 'NEAR-017': 42826360, 'NEAR-009': '0', 'NEAR-012': '0', 'NEAR-013': raw ? 0 : 2,
    'NEAR-058': 4095, 'NEAR-059': 1, 'NEAR-010': 20, 'NEAR-008': '20000000', ...overrides };
  const cards = Object.entries(fields).map(([key, value]) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : value}`.padEnd(80));
  const header = cards.join('') + 'END'.padEnd(80), start = Math.ceil(header.length / 2880) * 2880;
  const bytes = Buffer.alloc(start + Math.ceil(width * height * Math.abs(bitpix) / 8 / 2880) * 2880);
  bytes.write(header.padEnd(start, ' '), 0, 'ascii');
  for (let i = 0; i < width * height; i++) {
    if (raw) bytes.writeInt16BE((i === 0 ? 0 : i === 1 ? 4095 : 675) - 32768, start + i * 2);
    else bytes.writeFloatBE(i === 2 ? NaN : i === 3 ? 1e32 : i === 4 ? -.001 : .002, start + i * 4);
  }
  return bytes;
}
const identity = (image: Buffer, raw: Buffer) => ({ met: 42826360, filter: '0', startTime: '1997-06-27T12:55:52.899Z', imageSha256: digest(image), rawSha256: digest(raw) });

test('paired raw DN, not photograph brightness, masks telemetry loss and saturation', () => {
  const image = fits(false), raw = fits(true), decoded = decodeNearMsi(image, raw, identity(image, raw));
  for (const i of [-1, 0, 1, 2, 3, 537 * 244]) assert.equal(decoded.acceptPixel(i), false);
  assert.equal(decoded.acceptPixel(4), true, 'a finite negative calibrated noise sample is not a missing pixel');
  assert.equal(decoded.acceptPixel(5), true);
  assert.equal(decoded.qualityReport.rawMissingPixels, 1);
  assert.equal(decoded.qualityReport.rawSaturatedPixels, 1);
  assert.match(decoded.qualityReport.archiveQualityIndexInterpretation, /Unresolved/);
});

test('calibration, raw exposure identity, compression, hashes and saturation totals fail closed', () => {
  const image = fits(false), raw = fits(true);
  assert.throws(() => decodeNearMsi(image, raw, { ...identity(image, raw), imageSha256: '0'.repeat(64) }), /identity/);
  const overrides: Record<string, string | number | boolean>[] = [{ 'NEAR-017': 42826370 }, { 'NEAR-012': '1' }, { 'NEAR-046': 2000433 }, { BZERO: 0 }, { 'NEAR-008': '10000000' }];
  for (const override of overrides) {
    const changed = fits(true, override);
    assert.throws(() => decodeNearMsi(image, changed, identity(image, changed)), /identity/);
  }
  const changed = fits(true, { 'NEAR-059': 0 });
  assert.throws(() => decodeNearMsi(image, changed, identity(image, changed)), /saturation count/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DISC_INTEGRATED_COLOR_SCHEMA, parseDiscColor, parseDiscColorRecord, parseDiscColorPhotometry } from './disc-integrated-color.js';

const indices = { indices: { 'B-V': { value: .65 }, 'V-R': { value: .35 }, 'V-I': { value: .7 } } };
const record = { schema: DISC_INTEGRATED_COLOR_SCHEMA, object: indices, sun: indices,
  effectiveWavelengths: { nanometres: { B: 440, V: 550, R: 640, I: 790 } }, geometricAlbedo: { band: 'V', value: .5 } };
test('disc color preserves its compiler checks and diagnostics', () => {
  assert.equal(DISC_INTEGRATED_COLOR_SCHEMA, 'cssearth-disc-integrated-color@1');
  assert.equal(parseDiscColorRecord(record).geometricAlbedo, .5);
  assert.throws(() => parseDiscColorRecord({ ...record, schema: 'other' }), { message: 'The disc color record must use cssearth-disc-integrated-color@1.' });
  assert.throws(() => parseDiscColorRecord({ ...record, geometricAlbedo: { band: 'R', value: .5 } }), /V-band/);
  assert.throws(() => parseDiscColorRecord({ ...record, object: { indices: { 'B-V': { value: 1 }, 'V-R': { value: 1 } } } }), /V-I/);
  assert.throws(() => parseDiscColorRecord({ ...record, effectiveWavelengths: { nanometres: { B: 440, V: 440, R: 640, I: 790 } } }), /increase/);
});
test('a published reflectance spectrum replaces the color indices and is rescaled to 1 at its V wavelength', () => {
  const samples = [{ wavelengthNm: 500, value: .9 }, { wavelengthNm: 540, value: 1.1 }, { wavelengthNm: 560, value: 1.3 }, { wavelengthNm: 700, value: 1.8 }];
  const spectrum = (reflectance: unknown) => ({ schema: DISC_INTEGRATED_COLOR_SCHEMA, object: { reflectance }, geometricAlbedo: { band: 'V', value: .05 } });
  const parsed = parseDiscColorRecord(spectrum({ normalizedAtNm: 550, samples }));
  assert.ok('reflectance' in parsed);
  assert.deepEqual(parsed.reflectance.map(([wavelength]) => wavelength), [500, 540, 560, 700]);
  for (const [index, expected] of [.75, 1.1 / 1.2, 1.3 / 1.2, 1.5].entries()) assert.ok(Math.abs(parsed.reflectance[index]![1] - expected) < 1e-12);
  assert.equal(parsed.geometricAlbedo, .05);
  assert.throws(() => parseDiscColorRecord(spectrum({ normalizedAtNm: 550, samples: samples.slice(0, 1) })), /at least two samples/);
  assert.throws(() => parseDiscColorRecord(spectrum({ normalizedAtNm: 550, samples: [...samples].reverse() })), /rise in wavelength/);
  assert.throws(() => parseDiscColorRecord(spectrum({ normalizedAtNm: 550, samples: [{ wavelengthNm: 500, value: 0 }, ...samples.slice(1)] })), /positive/);
  assert.throws(() => parseDiscColorRecord(spectrum({ normalizedAtNm: 650, samples })), /inside the V band/);
  assert.throws(() => parseDiscColorRecord(spectrum({ normalizedAtNm: 550, samples: samples.slice(2) })), /inside its own samples/);
  assert.throws(() => parseDiscColorRecord({ ...spectrum({ normalizedAtNm: 550, samples }), geometricAlbedo: { band: 'R', value: .05 } }), /V-band/);
});
test('public photometry preserves subset admission and numeric coercion', () => {
  const subset = { schema: DISC_INTEGRATED_COLOR_SCHEMA, geometricAlbedo: { band: 'R', value: '2', uncertainty: '.1' },
    object: { system: 'Vega' }, effectiveWavelengths: { nanometres: { R: '640' } } };
  assert.deepEqual(parseDiscColor(subset, { acceptance: 'photometry' }), parseDiscColorPhotometry(subset));
  assert.deepEqual(parseDiscColorPhotometry(subset), { band: 'R', system: 'Vega', effectiveWavelength: 640, value: 2, uncertainty: .1 });
  assert.throws(() => parseDiscColorRecord(subset));
  assert.throws(() => parseDiscColorPhotometry({ ...subset, schema: 'other' }), { message: 'The public photometry executor currently supports the pinned disc-integrated-color schema.' });
  assert.throws(() => parseDiscColorPhotometry({ ...subset, object: [] }), { message: 'object must be an object.' });
  assert.ok(Number.isNaN(parseDiscColorPhotometry({ ...subset, geometricAlbedo: { band: 'R' } }).value));
});

test('both disc policies share envelope admission while preserving diagnostics', () => {
  for (const invalid of [undefined, null, [], 1, 'record', () => {}]) {
    assert.throws(() => parseDiscColor(invalid), { name: 'TypeError', message: 'disc color record must be an object.' });
    assert.throws(() => parseDiscColor(invalid, { acceptance: 'photometry' }), { name: 'TypeError', message: 'photometry member must be an object.' });
  }
  for (const schema of [undefined, null, 'other']) {
    assert.throws(() => parseDiscColor({ schema }), { message: `The disc color record must use ${DISC_INTEGRATED_COLOR_SCHEMA}.` });
    assert.throws(() => parseDiscColor({ schema }, { acceptance: 'photometry' }), { message: 'The public photometry executor currently supports the pinned disc-integrated-color schema.' });
  }
});

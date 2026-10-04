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

import assert from 'node:assert/strict';
import test from 'node:test';
import { WISE_ATLAS_TILES_SCHEMA, WISE_BAND_NAMES, parseTilePins } from './wise-atlas-tiles.js';

const pin = { coaddId: '0544p242_ac51', bytes: 4000 };
const record = { schema: WISE_ATLAS_TILES_SCHEMA, band: 'W4', tiles: [pin] };
test('WISE pins retain all four bands, byte counts, identities and duplicate diagnostics', () => {
  assert.equal(WISE_ATLAS_TILES_SCHEMA, 'cssearth-wise-atlas-tiles@1');
  for (const band of WISE_BAND_NAMES) assert.deepEqual(parseTilePins({ ...record, band }), { ...record, band });
  for (const invalid of [{ ...record, tiles: [] }, { ...record, tiles: [pin, pin] }])
    assert.throws(() => parseTilePins(invalid), { message: 'WISE atlas tiles must be unique and non-empty.' });
  for (const invalid of [{ ...record, schema: 'other' }, { ...record, band: 'W5' }, { ...record, band: 'toString' }])
    assert.throws(() => parseTilePins(invalid), { message: 'Unsupported WISE atlas tile list.' });
  for (const bad of [{ ...pin, bytes: 0 }, { ...pin, bytes: 1.5 }, { ...pin, coaddId: 'bad' }])
    assert.throws(() => parseTilePins({ ...record, tiles: [bad] }), { message: `Invalid WISE atlas tile pin: ${bad.coaddId}` });
  assert.throws(() => parseTilePins({ ...record, tiles: [{ ...pin, bytes: Infinity }] }), TypeError);
});

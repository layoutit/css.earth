import assert from 'node:assert/strict';
import test from 'node:test';
import { PYUVDATA_UVFITS_SCHEMA, parsePyuvdataUvfitsAnswer } from './pyuvdata-uvfits.js';

test('the pyuvdata boundary rejects missing or inverted visibility selections', () => {
  const file = { path: 'fixture.uvfits', bytes: 1 };
  assert.throws(() => parsePyuvdataUvfitsAnswer({}, { operation: 'uvfits-visibility-export', file }), /UVFITS selection/u);
  assert.throws(() => parsePyuvdataUvfitsAnswer({}, { operation: 'uvfits-amplitude-phase-diagnostics', file, selection: { field: 'J1008+0730', timeStartJulianDate: 2, timeEndJulianDate: 1, antenna1: 4, antenna2: 8, rowOffset: 0, rowCount: 1, channelStart: 0, channelCount: 1, polarization: -1 } }), /inverted/u);
});

test('the UVFITS schema and inspected response keep their wire values', () => {
  assert.equal(PYUVDATA_UVFITS_SCHEMA, 'cssearth-pyuvdata-uvfits@1');
  const response = { schema: PYUVDATA_UVFITS_SCHEMA, pyuvdata: '3.2.4', inspection: { telescope: 'VLA', target: 'J1008+0730', rows: 1, channels: 1, polarizations: [-1], samples: 1, frequencyHz: { first: 1e9, increment: 1 } }, notices: [] };
  assert.deepEqual(parsePyuvdataUvfitsAnswer(response, { operation: 'uvfits-visibility-inspect', file: { path: 'fixture.uvfits' } }), response);
  assert.throws(() => parsePyuvdataUvfitsAnswer({ ...response, schema: 'retired' }, { operation: 'uvfits-visibility-inspect', file: { path: 'fixture.uvfits' } }), { message: 'pyuvdata answered with the wrong contract or version.' });
});

import assert from 'node:assert/strict';
import { it as test } from 'vitest';
import { parseAstroqueryAnswer } from './astroquery.js';
import { parsePyuvdataUvfitsAnswer } from './pyuvdata.js';

test('the boundary rejects a response from another operation', async () => {
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', pyvo: '1.9.1', operation: 'tap-query', tap: { queryStatus: 'OK', complete: true }, rows: [] },
    { operation: 'mast-service', service: 'Mast.Caom.Cone', parameters: {} }), /wrong contract/u);
});

test('the boundary rejects a TAP answer from another PyVO version', () => {
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', pyvo: '1.9.0', operation: 'tap-query', tap: { queryStatus: 'OK', complete: true }, rows: [] },
    { operation: 'tap-query', service: 'https://example.org/tap', query: 'SELECT 1' }), /wrong version/u);
});

test('the boundary validates rows before returning them', async () => {
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', operation: 'mast-service', rows: [null] },
    { operation: 'mast-service', service: 'Mast.Caom.Cone', parameters: {} }), /Astroquery row 0/u);
});

test('row operations require rows and TAP preserves server completeness', () => {
  const request = { operation: 'tap-query' as const, service: 'https://example.org/tap', query: 'SELECT 1' };
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', pyvo: '1.9.1', operation: 'tap-query', tap: { queryStatus: 'OK', complete: true } }, request), /no rows field/u);
  assert.deepEqual(parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', pyvo: '1.9.1', operation: 'tap-query',
    tap: { queryStatus: 'OVERFLOW', complete: false }, rows: [{ id: 1 }] }, request).tap, { queryStatus: 'OVERFLOW', complete: false });
});

test('the pyuvdata boundary rejects missing or inverted visibility selections', () => {
  const file = { path: 'fixture.uvfits', bytes: 1, sha256: '0'.repeat(64) };
  assert.throws(() => parsePyuvdataUvfitsAnswer({}, { operation: 'uvfits-visibility-export', file }), /UVFITS selection/u);
  assert.throws(() => parsePyuvdataUvfitsAnswer({}, { operation: 'uvfits-amplitude-phase-diagnostics', file, selection: { field: 'J1008+0730', timeStartJulianDate: 2, timeEndJulianDate: 1, antenna1: 4, antenna2: 8, rowOffset: 0, rowCount: 1, channelStart: 0, channelCount: 1, polarization: -1 } }), /inverted/u);
});

import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseAstroqueryAnswer, VoAccessError } from './astroquery.js';

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

test('VO failures preserve the concise human message, status and detailed saved failure', () => {
  const request = { operation: 'vo-download' as const, url: 'https://example.org/science', destination: '/science.fits', byteLimit: 100, parameters: {} };
  const answer = { schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', operation: 'vo-download',
    failure: { code: 'interrupted', httpStatus: 200, message: 'Download interrupted after 3 attempts.', rawMessage: 'IncompleteRead raw transport detail' } };
  assert.throws(() => parseAstroqueryAnswer(answer, request), error => error instanceof VoAccessError &&
    error.message === answer.failure.message && error.rawMessage === answer.failure.rawMessage && error.httpStatus === 200);
  assert.throws(() => parseAstroqueryAnswer({ ...answer, failure: { ...answer.failure, rawMessage: 3 } }, request), /string/u);
  assert.throws(() => parseAstroqueryAnswer({ ...answer, failure: { code: 'authentication', httpStatus: 403, message: 'Private archive' } }, request),
    error => error instanceof VoAccessError && error.rawMessage === 'Private archive' && error.httpStatus === 403);
});

test('the Astroquery boundary and ownership ledger expose no retired MAST download operation', async () => {
  for (const path of ['astroquery.ts', '../../toolchains/ownership.json']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.equal(source.includes('mast-download'), false, path);
  }
});

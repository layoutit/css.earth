import assert from 'node:assert/strict';
import { it as test } from 'node:test';
import { parseAstroqueryAnswer, tapRows } from './astroquery.js';
import { astroqueryToolchain } from './toolchain/toolchain.js';

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

test('a query run as a job states 32-bit values and large integers as the archive holds them', async t => {
  if (!await astroqueryToolchain().then(() => true, () => false)) { t.skip('the astronomy packages are not installed: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery install'); return; }
  const service = 'https://dc.g-vo.org/tap';
  if (!await fetch(`${service}/availability`, { signal: AbortSignal.timeout(10_000) }).then(response => response.ok, () => false)) { t.skip(`${service} does not answer`); return; }
  // Gaia DR3 3404512999496164736 in GAVO's copy: the identifier is above 2**53, and pmra and parallax are 32-bit columns.
  assert.deepEqual(await tapRows(service, 'SELECT source_id, pmra, parallax FROM gaia.dr3lite WHERE source_id = 3404512999496164736', undefined, 'async'),
    [{ source_id: '3404512999496164736', pmra: '1.06506', parallax: '0.46847552' }]);
});

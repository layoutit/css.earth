import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseMastObservations, type MastServiceResult } from './mast.mts';

const row = () => ({ obs_collection: 'HST', obs_id: 'j96o01010', target_name: 'PLUTO', proposal_id: 10427, instrument_name: 'ACS/WFC', filters: 'F606W',
  t_min: 53505.014585613426, t_max: 53505.08066215278 });
const result = (rows: readonly Record<string, unknown>[]): MastServiceResult => ({ astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', rows });

test('exact MAST observations preserve archive identity and observing metadata', () => {
  assert.deepEqual(parseMastObservations('HST', ['j96o01010'], result([row()])), { astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', observations: [{
    id: 'j96o01010', collection: 'HST', archiveTarget: 'PLUTO', programme: '10427', mode: 'ACS/WFC', filter: 'F606W',
    startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z' }] });
});

test('exact MAST observation lookup refuses incomplete or ambiguous answers', () => {
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([])), /did not return requested observation/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([row(), row()])), /twice/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([{ ...row(), obs_id: 'other' }])), /unrequested observation/u);
  assert.throws(() => parseMastObservations('HST', ['j96o01010'], result([{ ...row(), obs_collection: 'JWST' }])), /requested HST/u);
});
test('MAST responses can be replayed by exact request and digest, never by a mutable latest cache', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os'); const { resolve } = await import('node:path');
  const { preserveMastResponse, replayMastResponse } = await import('./mast.mts');
  const directory = await mkdtemp(resolve(tmpdir(), 'mast-response-'));
  try {
    const request = { service: 'Mast.Caom.Filtered', params: { obs_id: 'j96o01010' } };
    const saved = await preserveMastResponse(request, result([row()]), directory);
    assert.deepEqual((await replayMastResponse(saved.responseRecord!, request)).rows, [row()]);
    await assert.rejects(replayMastResponse(saved.responseRecord!, { ...request, params: { obs_id: 'other' } }), /different request/);
    await writeFile(saved.responseRecord!.path, '{}');
    await assert.rejects(replayMastResponse(saved.responseRecord!, request), /digest mismatch/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('transport failures remain distinct from identity contradictions', async () => {
  const { loadTargetAssociations } = await import('../telescopes/target-associations.mts');
  const { ArchiveTransportError, parseAstroqueryAnswer } = await import('./client.mts');
  const source = { target: 'nix', archive: 'mast' as const, collection: 'HST', observations: ['j96o01010'], evidence: [{ citation: 'paper', locator: 'table', establishes: 'field membership' }] };
  const failures: { collection: string; reason: string }[] = [];
  assert.deepEqual(await loadTargetAssociations([source], { failures, lookup: async () => { throw new ArchiveTransportError('timeout'); } }), []);
  assert.deepEqual(failures, [{ collection: 'HST', reason: 'timeout' }]);
  await assert.rejects(loadTargetAssociations([source], { failures, lookup: async () => { throw new TypeError('wrong collection'); } }), /wrong collection/);
  assert.throws(() => parseAstroqueryAnswer({ schema: 'cssearth-astroquery-answer@2', astroquery: '0.4.11', operation: 'mast-service', transportError: 'timeout' }, { operation: 'mast-service', service: 'x', parameters: {} }), ArchiveTransportError);
});

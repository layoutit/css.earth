import assert from 'node:assert/strict';
import { test } from 'node:test';
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

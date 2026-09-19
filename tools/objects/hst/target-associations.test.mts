import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTargetAssociations, TARGET_ASSOCIATIONS_SCHEMA } from '../telescopes/target-associations.mts';
import { verifyHstAssociationRows } from './target-associations.mts';

const association = () => parseTargetAssociations({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ target: 'nix', archive: 'hst', telescope: 'Hubble', mode: 'ACS/WFC',
  archiveTarget: 'PLUTO', programme: '10427', verified: '2026-09-19', observations: [
    { id: 'j96o01010', startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z', filter: 'F606W' }],
  evidence: [{ citation: 'paper', locator: 'table', establishes: 'Nix is in the field.' }] }] })[0]!;
const row = () => ({ obs_id: 'j96o01010', target_name: 'PLUTO', proposal_id: '10427', instrument_name: 'ACS/WFC', filters: 'F606W',
  t_min: 53505.014585613426, t_max: 53505.08066215278 });

test('the HST verifier requires every archive identity and observing fact to match', () => {
  assert.equal(verifyHstAssociationRows(association(), [row()]), 1);
  assert.throws(() => verifyHstAssociationRows(association(), [{ ...row(), target_name: 'NIX' }]), /MAST archiveTarget is NIX/u);
  assert.throws(() => verifyHstAssociationRows(association(), []), /did not return j96o01010/u);
  assert.throws(() => verifyHstAssociationRows(association(), [row(), { ...row(), obs_id: 'other' }]), /unrequested observation other/u);
});

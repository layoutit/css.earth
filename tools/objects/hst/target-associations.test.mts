import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { hydrateTargetAssociation, parseTargetAssociationSources, TARGET_ASSOCIATIONS_SCHEMA } from '../telescopes/target-associations.mts';

const source = () => parseTargetAssociationSources({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ target: 'nix', archive: 'mast', collection: 'HST',
  observations: ['j96o01010'], evidence: [{ citation: 'paper', locator: 'table', establishes: 'Nix is in the field.' }] }] })[0]!;
const result = () => ({ astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z', observations: [{ id: 'j96o01010', collection: 'HST',
  archiveTarget: 'PLUTO', programme: '10427', mode: 'ACS/WFC', filter: 'F606W', startIso: '2005-05-15T00:21:00.197Z', endIso: '2005-05-15T01:56:09.210Z' }] });

test('a cited target join is hydrated exclusively from MAST observation facts', () => {
  assert.deepEqual(hydrateTargetAssociation(source(), result()), [{ target: 'nix', archive: 'mast', collection: 'HST', telescope: 'Hubble',
    mode: 'ACS/WFC', archiveTarget: 'PLUTO', programme: '10427', astroquery: '0.4.11', queriedAt: '2026-09-19T12:00:00.000Z',
    observations: result().observations, evidence: [{ citation: 'paper', locator: 'table', establishes: 'Nix is in the field.' }] }]);
  assert.throws(() => hydrateTargetAssociation(source(), { ...result(), observations: [{ ...result().observations[0]!, collection: 'JWST' }] }), /requested HST, got JWST/u);
});

test('association sources contain exact unique ids and cited evidence, not copied archive facts', () => {
  const base = { target: 'nix', archive: 'mast', collection: 'HST', observations: ['j96o01010'],
    evidence: [{ citation: 'paper', locator: 'table', establishes: 'Nix is in the field.' }] };
  assert.throws(() => parseTargetAssociationSources({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ ...base, observations: [] }] }), /at least one exact observation/u);
  assert.throws(() => parseTargetAssociationSources({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ ...base, evidence: [] }] }), /no cited evidence/u);
  assert.throws(() => parseTargetAssociationSources({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [base, base] }), /appears twice/u);
  assert.throws(() => parseTargetAssociationSources({ schema: TARGET_ASSOCIATIONS_SCHEMA, associations: [{ ...base, mode: 'ACS\/WFC' }] }), /unsupported|wrong|mode/u);
});

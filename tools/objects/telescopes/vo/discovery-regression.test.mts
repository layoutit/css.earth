import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadVoInputs } from './bridge.mts';
import { explorationAnswer } from '../exploration.mts';
import { parseLimits, type DiscoverySnapshot, type MetadataResponse } from './contracts.mts';
import { associateTarget, instrumentFacetQuery, normalizeSnapshot, SERVICES, targetQuery } from './discovery.mts';

const alma = SERVICES[1]!;
const mast = SERVICES.find(profile => profile.label === 'MAST JWST')!;
const target = { id: 'hr-8799', names: ['HR 8799'], classification: 'star', classificationSource: 'fixture' };
const raw = { path: '/fixture/metadata.xml', bytes: 100, sha256: 'a'.repeat(64) };
const response: MetadataResponse = {
  schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw, effectiveUrl: alma.service, fetchedAt: '2026-09-23T00:00:00Z',
  httpStatus: 200, queryStatus: 'OK', fields: [], resources: [], coordinateSystems: [], timeSystems: [], issues: [], bindings: [],
  rows: [1, 2].map(number => ({ obs_publisher_did: `ivo://alma/${number}`, obs_id: `obs-${number}`, target_name: 'HR-8799',
    dataproduct_type: 'image', access_url: 'https://example.org/datalink', access_format: 'applicati', facility_name: 'ALMA', instrument_name: 'Band 7' })),
  times: [{}, {}],
};
const snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: alma.service, table: alma.table, model: alma.model,
  request: { target: target.id }, query: 'fixture', scope: 'fixture target', sampleLimit: 50, response, completeness: 'bounded-sample' };

test('MAST searches each mission with generic punctuation variants, and archive names remain uniquely associated', () => {
  const query = targetQuery(mast, target.names);
  assert.match(query, /'HR 8799','HR8799','HR-8799'/u);
  assert.match(query, /obs_collection IN \('JWST'\)/u);
  assert.match(instrumentFacetQuery(mast, target.names, { target: target.id }), /SELECT DISTINCT TOP 8 instrument_name/u);
  assert.equal(associateTarget('HR-8799', null, target, [target]).status, 'confirmed');
  const named = { id: 'alpha-centauri', names: ['Alpha Centauri'] };
  assert.equal(associateTarget('Alpha-Centauri', null, named, [named]).status, 'unmatched');
  const observation = normalizeSnapshot(snapshot, alma, target, [target])[0]!;
  assert.equal(observation.facility, 'ALMA'); assert.equal(observation.instrument, 'Band 7');
  assert.equal(observation.telescopeName, 'ALMA');
  assert.equal(observation.access.mime, 'applicati');
});

test('shared truncated-MIME DataLink responses are fetched once; irrelevant SODA does not add a failure', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-shared-links-'));
  const linkResponse: MetadataResponse = { ...response, raw: { ...raw, sha256: 'b'.repeat(64) }, effectiveUrl: 'https://example.org/datalink',
    rows: [{ semantics: '#this', access_url: 'https://example.org/science.fits', content_type: 'application/fits' },
      { semantics: '#cutout', service_def: 'soda' }], times: [{}, {}],
    resources: [{ id: 'soda', type: 'meta', utype: 'adhoc:service', parameters: [{ name: 'standardID', id: null, datatype: 'char', arraysize: '*', unit: null,
      ucd: null, utype: null, xtype: null, ref: null, value: 'ivo://ivoa.net/std/SODA#sync-1.0' }], groups: [] }],
    bindings: [{ row: 1, serviceId: 'soda', url: 'https://example.org/soda', parameters: { ID: 'example' }, error: null }] };
  let calls = 0;
  try {
    const inputs = await loadVoInputs(root, { target: target.id }, [{ id: target.id, name: target.names[0]!, aliases: [], archiveClass: 'star', classificationSource: 'fixture' }],
      undefined, async (_root, profile) => {
        if (profile === alma) return snapshot;
        throw new Error('fixture provider unavailable');
      }, {}, async () => { calls++; return linkResponse; }, async () => { throw new Error('fixture provider unavailable'); });
    assert.equal(calls, 1);
    assert.equal(inputs.records.length, 2);
    assert.ok(inputs.records.every(record => record.products.length === 1));
    assert.ok(inputs.records.every(record => !record.issues.some(issue => issue.includes('No explicit supported SODA subset'))));
    const distinct = { ...snapshot, response: { ...response, rows: [response.rows[0]!,
      { ...response.rows[1]!, access_url: 'https://example.org/another-link' }] } };
    const limited = await loadVoInputs(root, { target: target.id, transferLimits: parseLimits({ metadataRequests: 1 }) },
      [{ id: target.id, name: target.names[0]!, aliases: [], archiveClass: 'star', classificationSource: 'fixture' }], undefined,
      async (_root, profile) => {
        if (profile === alma) return distinct;
        throw new Error('fixture provider unavailable');
      }, {}, async () => linkResponse, async () => { throw new Error('fixture provider unavailable'); });
    assert.equal(limited.services.find(service => service.service === alma.service)?.state, 'overflow');
    assert.ok(limited.records.some(record => record.issues.some(issue => issue.includes('query-wide access-description request limit'))));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('faceted MAST discovery keeps distinct MIRI and NIRCam samples visible to explore', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-mast-facets-'));
  const catalogue = [{ id: target.id, name: target.names[0]!, aliases: [], archiveClass: 'star', classificationSource: 'fixture' }];
  try {
    const inputs = await loadVoInputs(root, { target: target.id }, catalogue, undefined,
      async (_root, profile, request) => {
        if (profile !== mast || !request.instrument) throw new Error('fixture provider unavailable');
        return { ...snapshot, service: profile.service, table: profile.table, model: profile.model, request: { target: target.id, instrument: request.instrument },
          response: { ...response, effectiveUrl: profile.service, rows: [{ ...response.rows[0]!, obs_id: request.instrument,
            target_name: 'HR-8799', obs_collection: 'JWST', facility_name: 'STScI', instrument_name: request.instrument,
            access_url: 'https://example.org/science.fits', access_format: 'application/fits' }], times: [{}] } };
      }, {}, undefined, async (_root, profile) => profile === mast
        ? { names: ['MIRI/CORON', 'NIRCAM/CORON'], complete: true, evidence: 'fixture', issues: [] }
        : { names: [], complete: true, evidence: 'fixture', issues: [] });
    const modes = inputs.records.map(record => record.observation.instrument);
    assert.deepEqual(modes, ['MIRI/CORON', 'NIRCAM/CORON']);
    assert.ok(inputs.records.every(record => record.observation.telescopeName === 'JWST'));
    const answer = explorationAnswer({ target: target.id }, { ledgers: [], capabilities: [], targetCatalogue: catalogue,
      targetAssociations: [], bodyMaps: [], qualifiedProducts: [], vo: inputs });
    assert.deepEqual(answer.choices.map(choice => `${choice.telescope} / ${choice.display.instrument}`).sort(), ['JWST / MIRI/CORON', 'JWST / NIRCAM/CORON']);
    assert.ok(answer.choices.every(choice => choice.archiveService === mast.service));
  } finally { await rm(root, { recursive: true, force: true }); }
});

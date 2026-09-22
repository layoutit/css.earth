import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { choiceKey } from '../session.mts';
import { planAccess } from './access.mts';
import { recordKey, type DiscoverySnapshot, type MetadataResponse } from './contracts.mts';
import { normalizeSnapshot, SERVICES } from './discovery.mts';

const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo');
const target = { id: 'betelgeuse', names: ['Betelgeuse'], classification: 'star', classificationSource: 'fixture catalogue' };
const baseRequest = { target: target.id, wavelengthMicrometres: [0.78, 0.85] as const, kind: 'image' as const, result: 'telescope-product' as const };
const circle = (radiusDegrees: number) => ({ frame: 'icrs' as const, shape: 'circle' as const, raDegrees: 88.792938, decDegrees: 7.407063, radiusDegrees });

async function metadata(file: string, url: string): Promise<MetadataResponse> {
  return (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, file), url, byteLimit: 1e6, timeFormat: 'mjd', timeScale: 'utc' })).vo!;
}
function snapshot(response: MetadataResponse): DiscoverySnapshot {
  const profile = SERVICES[0]!;
  return { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request: baseRequest,
    query: 'fixture', scope: 'bounded fixture', sampleLimit: 1, response, completeness: 'bounded-sample' };
}
async function datalinkObservation() {
  const discovered = snapshot(await metadata('eso-obscore.xml', SERVICES[0]!.service));
  const observation = normalizeSnapshot(discovered, SERVICES[0]!, target, [target])[0]!;
  return { snapshot: discovered, observation: { ...observation, kind: 'image' as const,
    access: { url: 'https://example.org/links', mime: 'application/x-votable+xml; content=datalink', estimatedKilobytes: null } } };
}

test('different subsets and descriptors have separate saved-choice and acquisition identities', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-matrix-'));
  try {
    const { snapshot: discovered, observation } = await datalinkObservation();
    const links = await metadata('eso-links.xml', observation.access.url!);
    const firstRequest = { ...baseRequest, region: circle(0.3 / 3600) };
    const secondRequest = { ...baseRequest, region: circle(0.6 / 3600) };
    const first = await planAccess(root, observation, discovered, firstRequest, async () => links);
    const second = await planAccess(root, observation, discovered, secondRequest, async () => links);
    const descriptor = links.resources.find(resource => resource.parameters.some(parameter => parameter.value === 'ivo://ivoa.net/std/SODA#sync-1.0'))!;
    const changedDescriptor = { ...links, resources: links.resources.map(resource => resource === descriptor ? { ...resource,
      parameters: [...resource.parameters, { name: 'fixtureDescriptorRevision', id: null, datatype: 'char', arraysize: null, unit: null, ucd: null, utype: null, xtype: null, ref: null, value: null }] } : resource) };
    const changed = await planAccess(root, observation, discovered, firstRequest, async () => changedDescriptor);
    assert.equal(first.products.length, 1); assert.equal(second.products.length, 1); assert.equal(changed.products.length, 1);
    assert.notEqual(first.products[0]!.key, second.products[0]!.key);
    assert.notEqual(first.products[0]!.key, changed.products[0]!.key);
    const saved = (key: string) => choiceKey({ acquisitionKey: key, telescope: observation.service, mode: 'native-image', observation: observation.key, program: key });
    assert.notEqual(saved(first.products[0]!.key), saved(second.products[0]!.key));
    assert.notEqual(resolve(root, 'output/telescopes/vo/acquired', first.products[0]!.key), resolve(root, 'output/telescopes/vo/acquired', second.products[0]!.key));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a granule identifier is scoped to its discovery service', async () => {
  const response = await metadata('eso-obscore.xml', SERVICES[0]!.service), row = response.rows[0]!;
  const sameGranuleElsewhere = { ...snapshot(response), service: SERVICES[1]!.service, table: SERVICES[1]!.table, model: SERVICES[1]!.model };
  assert.notEqual(recordKey(snapshot(response), row, ['obs_publisher_did', 'obs_id']), recordKey(sameGranuleElsewhere, row, ['obs_publisher_did', 'obs_id']));
});

test('missing or async-only descriptors, link errors, and nested request caps stay unselectable', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-matrix-'));
  try {
    const { snapshot: discovered, observation } = await datalinkObservation();
    const links = await metadata('eso-links.xml', observation.access.url!);
    const descriptor = links.resources.find(resource => resource.parameters.some(parameter => parameter.value === 'ivo://ivoa.net/std/SODA#sync-1.0'))!;
    const missing = { ...links, resources: [], bindings: [] };
    const asyncOnly = { ...links, resources: links.resources.map(resource => resource === descriptor ? { ...resource,
      parameters: resource.parameters.map(parameter => parameter.name === 'standardID' ? { ...parameter, value: 'ivo://ivoa.net/std/SODA#async-1.0' } : parameter) } : resource) };
    const request = { ...baseRequest, region: circle(0.3 / 3600) };
    const missingPlan = await planAccess(root, observation, discovered, request, async () => missing);
    const asyncPlan = await planAccess(root, observation, discovered, request, async () => asyncOnly);
    assert.equal(missingPlan.products.length, 0); assert.match(missingPlan.issues.join('\n'), /descriptor could not be resolved/u);
    assert.equal(asyncPlan.products.length, 0); assert.match(asyncPlan.issues.join('\n'), /synchronous SODA/u);

    const linkError = { ...links, rows: [{ semantics: '#this', error_message: 'fixture link failure' }] };
    const failed = await planAccess(root, observation, discovered, request, async () => linkError);
    assert.equal(failed.products.length, 0); assert.match(failed.issues.join('\n'), /fixture link failure/u);

    const capped = await planAccess(root, observation, discovered, { ...request, transferLimits: { scienceBytes: 1_073_741_824, metadataBytes: 33_554_432, nestedEdges: 3, metadataRequests: 1, expandedBytes: 1_073_741_824, packageMembers: 1024 } }, async () =>
      ({ ...links, effectiveUrl: 'https://example.org/links', rows: [{ semantics: '#this', access_url: '/nested', content_type: 'application/x-votable+xml; content=datalink' }] }));
    assert.equal(capped.products.length, 0); assert.match(capped.issues.join('\n'), /request bound reached/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

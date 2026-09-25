import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '@cssearth/telescope/node';
import { saveExploration, getSession, type SessionServices } from '../session.mts';
import { loadQualifiedObservations } from '../qualified-observations.mts';
import { listArtifactOutputs } from '../artifact-outputs.mts';
import { executeFamilyOperation } from '../family-operation.mts';
import { explorationAnswer } from '../exploration.mts';
import { parseSnapshot, normalizeSnapshot, SERVICES } from './discovery.mts';
import { planAccess, nativeQualificationRoute } from './access.mts';
import { qualifyVoProduct } from './qualify.mts';

const test = sourceTest();
test('ESO FITS spectra reach native F03 export through saved exploration, get and outputs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-spectrum-session-'));
  const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo');
  const bytes = await readFile(resolve(fixtures, 'eso-spectrum/espresso-excerpt.fits'));
  const server = createServer((_request, response) => { response.setHeader('content-type', 'application/octet-stream'); response.end(bytes); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port.');
  try {
    const args = ['hd-110067', '--kind', 'spectrum'], request = { target: 'hd-110067', kind: 'spectrum' as const };
    const target = { id: request.target, names: ['HD 110067'] }, profile = SERVICES[0]!;
    const raw = (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, 'eso-obscore.xml'), url: profile.service, byteLimit: 1e6 })).vo!;
    const response = { ...raw, rows: [{ ...raw.rows[0]!, target_name: 'HD 110067', dataproduct_type: 'spectrum', obs_publisher_did: 'ivo://eso.org/ID?ADP.2024-03-08T10:41:06.519' }] };
    const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request,
      query: 'captured spectrum fixture', scope: 'fixture replay', sampleLimit: 1, response, completeness: 'bounded-sample' });
    const normalized = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const observation = { ...normalized, access: { url: `http://127.0.0.1:${address.port}/spectrum.fits`, mime: 'application/x-fits-bintable', estimatedKilobytes: 9 } };
    const policy = { allowedPrivateHosts: ['127.0.0.1'] };
    const plan = await planAccess(root, observation, snapshot, request, undefined, policy);
    assert.equal(plan.products.length, 1); assert.equal(nativeQualificationRoute(plan.products[0]!), 'f03-spectrum');
    const explore: SessionServices['explore'] = async (_root, current) => explorationAnswer(current, {
      ledgers: [], capabilities: [], targetCatalogue: [{ id: target.id, name: 'HD 110067', aliases: [] }], targetAssociations: [], bodyMaps: [],
      qualifiedProducts: await loadQualifiedObservations(root, target.id), vo: { services: [], records: [{ observation, snapshot, ...plan }] } });
    const api: SessionServices = { load: async () => { throw new Error('No scientific query requested.'); }, explore,
      qualify: async () => qualifyVoProduct(root, plan.products[0]!, policy) };
    const saved = await saveExploration(root, args, resolve(root, 'exploration'), api);
    assert.equal(saved.choices.length, 1);
    const result = await getSession(root, saved.directory, 1, () => {}, api);
    const outputs = await listArtifactOutputs(result.resultPath);
    assert.ok(outputs.familyOperations?.some(operation => operation.id === 'spectrum-export'));
    assert.equal(outputs.outputs.length, 0);
    const exported = await executeFamilyOperation(String(outputs.source), { operationId: 'spectrum-export' }, resolve(root, 'export'));
    const rows = (await readFile(exported.product, 'utf8')).trim().split('\n');
    assert.equal(rows.length, 15); assert.match(rows[1]!, /^2,1,/u);
    const [qualified] = await loadQualifiedObservations(root, target.id);
    assert.deepEqual(qualified!.facts, { target: target.id, verified: true, kind: 'spectrum', result: 'telescope-product' });
    await assert.rejects(qualifyVoProduct(root, { ...plan.products[0]!, observation: { ...observation, rawTarget: 'Wrong target' } }, policy), /OBJECT/u);
    for (const unsupported of [
      { ...plan.products[0]!, observation: { ...observation, target: { status: 'in-field' as const, target: target.id, reason: 'field overlap only' } } },
      { ...plan.products[0]!, format: 'zip' as const },
      { ...plan.products[0]!, operation: { ...plan.products[0]!.operation, kind: 'soda-sync' as const } },
    ]) assert.equal(nativeQualificationRoute(unsupported), null);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});

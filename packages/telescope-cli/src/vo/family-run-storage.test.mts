import '../test-support/index.mts';
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { mkdir, mkdtemp, readFile, realpath, copyFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as core from '@cssearth/telescope-core/node';
import { jsonValue, type DiscoverySnapshot, type MetadataResponse } from '@cssearth/objects';
import { binaryTableHdu, primaryHdu } from '@cssearth/bake/objects/raster';
let science: Buffer;
mock.module('@cssearth/telescope-core/node', { namedExports: { ...core, astroquery: async (request: core.AstroqueryRequest): Promise<core.AstroqueryAnswer> => {
  assert.equal(request.operation, 'vo-download');
  if (request.operation !== 'vo-download') throw new Error('Fixture permits only download transport');
  await writeFile(request.destination, science, { flag: 'wx' });
  return { schema: 'cssearth-astroquery-answer@2', operation: 'vo-download', astroquery: '0.4.11', transfer: {
    file: { path: request.destination, bytes: science.length }, effectiveUrl: request.url, contentType: 'application/fits', etag: null, lastModified: null } };
} } });
const { planAccess } = await import('./access.mts');
const { qualifyVoProduct } = await import('./qualify.mts');
const { saveExploration, getSession } = await import('../session.mts');
const { loadQualifiedObservations } = await import('../qualification/qualified-observations.mts');
const { listArtifactOutputs } = await import('../delivery/artifact-outputs.mts');
const { executeFamilyOperation } = await import('../family-operation.mts');
const { explorationAnswer } = await import('../exploration.mts');
const { normalizeSnapshot, SERVICES } = await import('./discovery.mts');

for (const kind of ['table', 'spectrum'] as const) test(`resident ${kind} descriptor exports and qualification survives a symlinked run path`, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'family-run-fixture-')), run = resolve(root, 'run');
  try {
    science = kind === 'table' ? Buffer.concat([primaryHdu([['OBJECT', 'Betelgeuse']]), binaryTableHdu('CATALOG', [{ name: 'FLUX', form: 'E' }], [[1.5], [2.5]], [])])
      : await readFile(new URL('./fixtures/telescope-vo/eso-spectrum/espresso-excerpt.fits', import.meta.url));
    const target = kind === 'table' ? { id: 'betelgeuse', names: ['Betelgeuse'] } : { id: 'hd-110067', names: ['HD 110067'] };
    const request = { target: target.id, kind }, profile = SERVICES[0]!;
    const metadata = resolve(root, 'metadata.xml'); await writeFile(metadata, '<VOTABLE/>');
    const response: MetadataResponse = { schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: { path: metadata, bytes: 10 }, effectiveUrl: profile.service,
      fetchedAt: '2026-10-14T00:00:00Z', httpStatus: 200, queryStatus: 'OK', fields: [], resources: [], coordinateSystems: [], timeSystems: [], issues: [], bindings: [], times: [{}],
      rows: [{ obs_publisher_did: `ivo://fixture/${kind}`, obs_id: kind, target_name: target.names[0], dataproduct_type: kind, access_url: 'https://example.org/science.fits', access_format: 'application/fits' }] };
    const snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request: jsonValue(request),
      query: 'fixture', scope: 'fixture', sampleLimit: 1, completeness: 'bounded-sample', response };
    const observation = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const plan = await planAccess(root, observation, snapshot, request); assert.equal(plan.products.length, 1);
    const api = { load: async (): Promise<never> => { throw new Error('unused'); },
      explore: async (_root: string, current: import('../exploration.mts').ExplorationRequest) => explorationAnswer(current, {
        ledgers: [], capabilities: [], targetCatalogue: [{ id: target.id, name: target.names[0]!, aliases: [] }], targetAssociations: [], bodyMaps: [],
        qualifiedProducts: await loadQualifiedObservations(root, target.id), vo: { services: [], records: [{ snapshot, observation, ...plan }] } }),
      qualify: async () => qualifyVoProduct(root, plan.products[0]!) };
    await saveExploration(root, [target.id, '--kind', kind], run, api);
    const delivered = await getSession(root, run, 1, () => {}, api);
    const outputs = await listArtifactOutputs(delivered.resultPath);
    assert.equal(outputs.familyOperations?.find(operation => operation.id === `${kind}-export`)?.available, true);
    assert.equal(await realpath(String(outputs.source)), resolve(delivered.product, '..', 'descriptor.json'), 'Resident descriptor has no files/ prefix');
    const exported = await executeFamilyOperation(String(outputs.source), { operationId: `${kind}-export` }, resolve(root, 'export'));
    assert.ok((await readFile(exported.product)).length > 0);
    const flat = resolve(root, 'flat'); await mkdir(flat);
    const record = JSON.parse(await readFile(delivered.resultPath, 'utf8'));
    const parent = record.outputRoot + '/';
    const localPath = (path: string) => path.startsWith(parent) ? path.slice(parent.length) : path;
    for (const file of record.files) await copyFile(resolve(delivered.resultPath, '..', file.path), resolve(flat, localPath(file.path)));
    const flattened = { ...record, outputRoot: '.', product: localPath(record.product), receipt: localPath(record.receipt), record: localPath(record.record),
      files: record.files.map((file: { path: string; bytes: number }) => ({ ...file, path: localPath(file.path) })) };
    const flatResult = resolve(flat, 'result.json'); await writeFile(flatResult, JSON.stringify(flattened));
    const flatOutputs = await listArtifactOutputs(flatResult);
    assert.equal(flatOutputs.source, resolve(flat, 'descriptor.json'), 'A top-level resident descriptor remains discoverable');
    const alias = resolve(root, 'linked-run'); await symlink(run, alias, 'dir');
    const [qualified] = await core.withAcquisitionDirectory(resolve(alias, 'pick-1'), () => loadQualifiedObservations(root, target.id));
    assert.ok(qualified, 'Canonical files remain admitted through a logical symlink scope');
    assert.equal(qualified.facts.kind, kind);
    assert.equal((await getSession(root, run, 1, () => {}, api, { offline: true })).reused, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

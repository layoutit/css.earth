import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, appendFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { saveSession, getSession, type SessionServices } from '../session.mts';
import { saveExploration } from '../session.mts';
import { loadQualifiedObservations } from '../qualified-observations.mts';
import { delivery, listOutputs, exportOutput } from '../outputs.mts';
import { listArtifactOutputs } from '../artifact-outputs.mts';
import { executeFamilyOperation } from '../family-operation.mts';
import { explorationAnswer } from '../exploration.mts';
import { binaryTableHdu, primaryHdu } from '../../interferometry/fits-table.mts';
import { sessionRequest } from '../session.mts';
import { parseSnapshot, normalizeSnapshot, SERVICES } from './discovery.mts';
import { planAccess } from './access.mts';
import { jsonValue } from './contracts.mts';
import { qualifyVoProduct } from './qualify.mts';
import type { QueryInputs } from '../query.mts';

test('confirmed direct FITS table reaches F08 export through saved exploration and get', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-table-session-'));
  const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo');
  const fits = Buffer.concat([primaryHdu([['OBJECT', 'Betelgeuse']]),
    binaryTableHdu('CATALOG', [{ name: 'FLUX', form: 'E' }], [[1.5], [2.5]], [])]);
  const twoTables = Buffer.concat([fits, binaryTableHdu('OTHER', [{ name: 'FLUX', form: 'E' }], [[3.5]], [])]);
  const server = createServer((request, response) => { response.setHeader('content-type', 'application/fits'); response.end(request.url === '/two.fits' ? twoTables : fits); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port.');
  try {
    const args = ['betelgeuse', '--kind', 'table'], request = { target: 'betelgeuse', kind: 'table' as const };
    const target = { id: request.target, names: ['Betelgeuse'] }, profile = SERVICES[0]!;
    const response = (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, 'eso-obscore.xml'), url: profile.service, byteLimit: 1e6 })).vo!;
    const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request,
      query: 'captured table fixture', scope: 'fixture replay', sampleLimit: 1, response, completeness: 'bounded-sample' });
    const normalized = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const observation = { ...normalized, kind: 'table' as const, access: { url: `http://127.0.0.1:${address.port}/catalog.fits`, mime: 'application/fits', estimatedKilobytes: 6 } };
    const plan = await planAccess(root, observation, snapshot, request, undefined, { allowedPrivateHosts: ['127.0.0.1'] });
    assert.equal(plan.products.length, 1);
    const explore: SessionServices['explore'] = async (_root, current) => explorationAnswer(current, {
      ledgers: [], capabilities: [], targetCatalogue: [{ id: target.id, name: 'Betelgeuse', aliases: [] }], targetAssociations: [], bodyMaps: [],
      qualifiedProducts: await loadQualifiedObservations(root, target.id), vo: { services: [], records: [{ observation, snapshot, ...plan }] } });
    const api: SessionServices = { load: async () => { throw new Error('Scientific query was not requested.'); }, explore,
      qualify: async () => qualifyVoProduct(root, plan.products[0]!, { allowedPrivateHosts: ['127.0.0.1'] }) };
    const saved = await saveExploration(root, args, resolve(root, 'exploration'), api);
    assert.equal(saved.choices.length, 1); assert.equal(saved.choices[0]!.state, 'qualify');
    const result = await getSession(root, saved.directory, 1, () => {}, api), data = await delivery(result.resultPath);
    assert.equal(data.record.schema, 'cssearth-telescope-delivery@3');
    assert.equal(data.record.facts.kind, 'table');
    const outputs = await listArtifactOutputs(result.resultPath);
    assert.ok(outputs.familyOperations?.some(operation => operation.id === 'table-export'));
    assert.equal(outputs.outputs.length, 0);
    const descriptor = outputs.source;
    assert.equal(typeof descriptor, 'string');
    const described = JSON.parse(await readFile(descriptor as string, 'utf8'));
    assert.equal(described.dataset.acquisition.kind, 'archive');
    assert.equal(described.components[0].calibration.state, 'unknown');
    assert.deepEqual(described.members, [{ id: 'science', path: 'science.fits', role: 'science', mediaType: 'application/fits' }]);
    const exported = await executeFamilyOperation(descriptor as string, { operationId: 'table-export' }, resolve(root, 'table-export'));
    assert.match(await readFile(exported.product, 'utf8'), /FLUX\n1\.5\n2\.5\n/u);
    const qualified = await loadQualifiedObservations(root, target.id);
    assert.equal(qualified.length, 1);
    assert.equal(qualified[0]!.facts.angularResolutionArcsec, undefined);
    const wrongTarget = { ...plan.products[0]!, observation: { ...observation, rawTarget: 'Wrong target' } };
    await assert.rejects(qualifyVoProduct(root, wrongTarget, { allowedPrivateHosts: ['127.0.0.1'] }), /FITS identity mismatch for OBJECT/u);
    const ambiguousPlan = await planAccess(root, { ...observation, access: { ...observation.access, url: `http://127.0.0.1:${address.port}/two.fits` } }, snapshot, request,
      undefined, { allowedPrivateHosts: ['127.0.0.1'] });
    await assert.rejects(qualifyVoProduct(root, ambiguousPlan.products[0]!, { allowedPrivateHosts: ['127.0.0.1'] }), /exactly one FITS BINTABLE/u);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});

test('saved VO choice acquires, qualifies, exports through existing owners, and refuses tampered evidence', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-session-'));
  const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo'), fits = await readFile(resolve(fixtures, 'eso-circle.fits'));
  const archive = resolve(root, 'science.zip');
  execFileSync('python3', ['-c', "import sys,zipfile\nwith zipfile.ZipFile(sys.argv[2], 'w') as z:\n z.write(sys.argv[1], 'science.fits')\n z.writestr('labels/product.lbl', '^IMAGE = \\\"../science.fits\\\"\\n')", resolve(fixtures, 'eso-circle.fits'), archive]);
  const packageBytes = await readFile(archive);
  const server = createServer((_request, response) => response.end(packageBytes));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port.');
  try {
    const args = ['--target','betelgeuse','--wavelength','0.78,0.85','--kind','image','--any-time','--min-arcsec','1','--result','telescope-product'];
    const request = sessionRequest(args), target = { id: request.target, names: ['Betelgeuse'] }, profile = SERVICES[0]!;
    const response = (await astroquery({ operation: 'vo-parse', file: resolve(fixtures,'eso-obscore.xml'), url: profile.service, byteLimit: 1e6 })).vo!;
    const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request, query: 'captured fixture', scope: 'fixture replay', sampleLimit: 1, response, completeness: 'bounded-sample' });
    const normalized = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const observation = { ...normalized, access: { url: `http://127.0.0.1:${address.port}/science.zip`, mime: 'application/zip', estimatedKilobytes: 291 } };
    const plan = await planAccess(root, observation, snapshot, request, undefined, { allowedPrivateHosts: ['127.0.0.1'] }); assert.equal(plan.products.length, 1);
    let available = true;
    const load = async (): Promise<QueryInputs> => ({ ledgers: [], capabilities: [], targetCatalogue: [{ id: target.id, name: 'Betelgeuse', aliases: [] }], targetAssociations: [], bodyMaps: [],
      qualifiedProducts: await loadQualifiedObservations(root, target.id), vo: { services: [], records: available ? [{ observation, snapshot, ...plan }] : [] } });
    const api: SessionServices = { load, loadRequest: load, qualify: async (_root, q) => {
      assert.equal(q.configuration.kind, 'archive-acquisition');
      return qualifyVoProduct(root, plan.products[0]!, { allowedPrivateHosts: ['127.0.0.1'] });
    } };
    const directory = resolve(root, 'delivery'), saved = await saveSession(root, args, directory, api);
    assert.equal(saved.choices.length, 1); assert.equal(saved.choices[0]!.state, 'qualify');
    const result = await getSession(root, directory, 1, () => {}, api), data = await delivery(result.resultPath);
    assert.equal(data.record.schema, 'cssearth-telescope-delivery@3'); assert.equal(data.context.kind, 'scientific-request'); assert.equal(data.record.observation, observation.key);
    assert.equal(data.producing.evidence[0]!.kind, 'archive-retrieval-origin');
    assert.ok(data.files.some(f => f.path.endsWith('/acquisition.json'))); assert.ok(data.files.some(f => f.path.endsWith('.xml')));
    assert.ok(data.files.some(f => f.path.endsWith('/archive.zip'))); assert.ok(data.files.some(f => f.path.endsWith('/members/labels/product.lbl')));
    assert.equal(typeof data.record.outputRoot, 'string');
    const originalDelivery = await readFile(result.resultPath, 'utf8');
    await writeFile(result.resultPath, JSON.stringify({ ...data.record, outputRoot: `${String(data.record.outputRoot)}/members` }));
    await assert.rejects(delivery(result.resultPath), /absent or ambiguous/u);
    await writeFile(result.resultPath, originalDelivery);
    const outputs = await listOutputs(result.resultPath); assert.ok(outputs.outputs.some(o => o.kind === 'image' && o.available));
    await exportOutput(result.resultPath, { kind: 'image', hdu: 0 }, resolve(root, 'figure'));
    available = false;
    const replay = await getSession(root, directory, 1, () => {}, api, { offline: true });
    assert.equal(replay.replay, 'pinned-local-artifact');
    await assert.rejects(getSession(root, directory, 1, () => {}, api), /no longer available/u);
    await appendFile(resolve(root, 'output/telescopes/vo/acquired', plan.products[0]!.key, 'science.fits'), 'changed');
    await assert.rejects(qualifyVoProduct(root, plan.products[0]!, { allowedPrivateHosts: ['127.0.0.1'] }), /stale|changed/u);
    const metadata = data.files.find(f => f.path.endsWith('.xml'))!;
    await appendFile(resolve(data.directory, metadata.path), '\nchanged');
    await assert.rejects(delivery(result.resultPath), /content pin mismatch/u);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});

test('two saved SODA subsets of one parent keep separate acquisition, qualification, and delivery records', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-two-subsets-'));
  const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo'), fits = await readFile(resolve(fixtures, 'eso-circle.fits'));
  const requests: string[] = [];
  const server = createServer((request, response) => { requests.push(request.url!); response.end(fits); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port.');
  try {
    const endpoint = `http://127.0.0.1:${address.port}/soda`, profile = SERVICES[0]!;
    const base = ['--target','betelgeuse','--wavelength','0.78,0.85','--kind','image','--any-time','--min-arcsec','1','--result','telescope-product'];
    const firstArgs = [...base, '--icrs-circle', '88.792938,7.407063,0.00008333333333333333'];
    const secondArgs = [...base, '--icrs-circle', '88.792938,7.407063,0.00016666666666666666'];
    const discoveredRequest = sessionRequest(firstArgs), target = { id: discoveredRequest.target, names: ['Betelgeuse'] };
    const response = (await astroquery({ operation: 'vo-parse', file: resolve(fixtures,'eso-obscore.xml'), url: profile.service, byteLimit: 1e6 })).vo!;
    const snapshot = parseSnapshot({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request: discoveredRequest,
      query: 'captured fixture', scope: 'fixture replay', sampleLimit: 1, response, completeness: 'bounded-sample' });
    const normalized = normalizeSnapshot(snapshot, profile, target, [target])[0]!;
    const observation = { ...normalized, access: { url: 'https://example.org/links', mime: 'application/x-votable+xml; content=datalink', estimatedKilobytes: null } };
    const localLinksFile = resolve(root, 'links.xml'), originalLinks = await readFile(resolve(fixtures, 'eso-links.xml'), 'utf8');
    await writeFile(localLinksFile, originalLinks.replaceAll('https://dataportal.eso.org/dataPortal/soda/sync', endpoint).replace('ucd="meta.id;meta.dataset"', 'ucd="meta.ref.url;meta.curation"'));
    const localLinks = (await astroquery({ operation: 'vo-parse', file: localLinksFile, url: endpoint, byteLimit: 1e6 })).vo!;
    const plans = new Map<string, Awaited<ReturnType<typeof planAccess>>>();
    const planFor = async (request: Parameters<typeof planAccess>[3]) => {
      const key = JSON.stringify(request), existing = plans.get(key);
      if (existing) return existing;
      const plan = await planAccess(root, observation, { ...snapshot, request: jsonValue(request) }, request, async () => localLinks, { allowedPrivateHosts: ['127.0.0.1'] });
      assert.equal(plan.products.length, 1, plan.issues.join('\n')); plans.set(key, plan); return plan;
    };
    const load = async (_root: string, request: ReturnType<typeof sessionRequest>): Promise<QueryInputs> => {
      const plan = await planFor(request);
      return { ledgers: [], capabilities: [], targetCatalogue: [{ id: target.id, name: 'Betelgeuse', aliases: [] }], targetAssociations: [], bodyMaps: [], qualifiedProducts: await loadQualifiedObservations(root, target.id),
        vo: { services: [], records: [{ observation, snapshot: { ...snapshot, request: jsonValue(request) }, ...plan }] } };
    };
    const api: SessionServices = { load: async () => load(root, discoveredRequest), loadRequest: load, qualify: async (_root, qualification) => {
      const configuration = qualification.configuration;
      if (configuration.kind !== 'archive-acquisition') throw new Error('Expected an archive subset qualification.');
      const request = configuration.request;
      assert.ok(request.wavelengthMicrometres, 'This scientific subset fixture retains its requested wavelengths.');
      const spec = (await planFor({ ...request, wavelengthMicrometres: request.wavelengthMicrometres })).products.find(product => product.key === configuration.key);
      if (!spec) throw new Error('Saved subset acquisition was not rediscovered.');
      return qualifyVoProduct(root, spec, { allowedPrivateHosts: ['127.0.0.1'] });
    } };
    const firstDirectory = resolve(root, 'first'), secondDirectory = resolve(root, 'second');
    const firstSaved = await saveSession(root, firstArgs, firstDirectory, api), secondSaved = await saveSession(root, secondArgs, secondDirectory, api);
    assert.equal(firstSaved.choices.length, 1); assert.equal(secondSaved.choices.length, 1);
    assert.notEqual(firstSaved.choices[0]!.acquisitionKey, secondSaved.choices[0]!.acquisitionKey);
    const first = await getSession(root, firstDirectory, 1, () => {}, api);
    const second = await getSession(root, secondDirectory, 1, () => {}, api);
    const firstDelivery = await delivery(first.resultPath), secondDelivery = await delivery(second.resultPath);
    assert.notEqual(firstDelivery.record.choice, secondDelivery.record.choice);
    const firstScience = firstDelivery.files.find(file => file.path.endsWith('science.fits'))!, secondScience = secondDelivery.files.find(file => file.path.endsWith('science.fits'))!;
    assert.notEqual(firstScience.path, secondScience.path);
    // Deliveries name files by path and size (PR #531); the two copies are compared byte for byte.
    assert.ok((await readFile(resolve(firstDelivery.directory, firstScience.path))).equals(await readFile(resolve(secondDelivery.directory, secondScience.path))));
    const qualifications = await readdir(resolve(root, 'output/telescopes', target.id, 'qualifications'));
    assert.equal(qualifications.filter(name => name.endsWith('.json')).length, 2);
    assert.ok(requests.some(url => url.includes('CIRCLE=88.792938'))); assert.equal(requests.length, 2);
    const replay = await getSession(root, firstDirectory, 1, () => {}, api);
    assert.equal(replay.reused, true); assert.equal((await delivery(replay.resultPath)).record.choice, firstDelivery.record.choice);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(root, { recursive: true, force: true }); }
});

import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSourceProducts, parseSourceProducts, sourceRun, SOURCE_PRODUCTS_SCHEMA } from './source-products.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { queryCapabilities, selectObservation, type QueryInputs } from './query.mts';
import { selectedProductInput } from './selected-product.mts';
import { saveSession, saveExploration, getSession, sessionRequest, observationChoices, savedChoice, type SessionServices } from './session.mts';
import { explorationAnswer } from './exploration.mts';
import { parseCli } from './cli.mts';
import { SERVICES } from './vo/discovery.mts';

const args = ['--target', 'test-body', '--wavelength', '1,2', '--kind', 'cube', '--any-time', '--min-arcsec', '1', '--result', 'telescope-product'];
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const label = (multiplier = 1) => `Object = IsisCube
  Object = Core
    StartByte = 1
    Format = BandSequential
    Group = Dimensions
      Samples = 1
      Lines = 1
      Bands = 2
    End_Group
    Group = Pixels
      Type = Real
      ByteOrder = Lsb
      Base = 0
      Multiplier = ${multiplier}
    End_Group
  End_Object
  Group = Instrument
    TargetName = TEST-BODY
  End_Group
End_Object
End
`;
async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-')), source = resolve(root, 'src/objects/test-body/source');
  await mkdir(source, { recursive: true });
  const bytes = Buffer.alloc(8); bytes.writeFloatLE(1); bytes.writeFloatLE(2, 4);
  const files = [{ id: 'science', path: 'core.bin', role: 'science', bytes }, { id: 'label', path: 'core.lbl', role: 'label', bytes: Buffer.from(label()) }];
  const manifest = { inputs: files.map(f => ({ id: f.id, path: f.path, origin: `https://example.org/${f.path}` })) };
  const declaration = { schema: SOURCE_PRODUCTS_SCHEMA, target: 'test-body', observations: [{ id: 'cube-1', telescope: 'Test telescope', mode: 'test cube', kind: 'cube',
    archiveProductId: 'archive-cube', decoder: 'isis3', labelPath: 'core.lbl', inputs: files.map(f => ({ input: f.id, role: f.role })), identity: { TargetName: 'TEST-BODY' },
    startIso: '2026-01-01T10:00:00.000Z', endIso: '2026-01-01T10:10:00.000Z',
    units: 'counts', meaning: 'Detector counts', citation: 'https://example.org/', limitations: ['No measured resolution or verified wavelength coverage.'] }] };
  for (const f of files) await writeFile(resolve(source, f.path), f.bytes);
  const writeMetadata = async () => { await writeFile(resolve(source, 'manifest.json'), JSON.stringify(manifest)); await writeFile(resolve(source, 'observations.json'), JSON.stringify(declaration)); };
  await writeMetadata();
  const load = async (): Promise<QueryInputs> => ({ ledgers: [], capabilities: [], targetCatalogue: [{ id: 'test-body', name: 'Test Body', aliases: [] }], targetAssociations: [], bodyMaps: [], sourceProducts: await loadSourceProducts(root, 'test-body') });
  let qualifications = 0;
  const api: SessionServices = { load, qualify: async () => { qualifications++; return qualifySourceProduct(root, parseSourceProducts(declaration, manifest, 'test-body')[0]); } };
  return { root, source, manifest, declaration, writeMetadata, load, api, qualifications: () => qualifications, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('detached label membership is enforced for every decoder, including direct API calls', async () => {
  const f = await fixture(); try {
    const unpinned = structuredClone(f.declaration); unpinned.observations[0].inputs = [{ input: 'science', role: 'science' }];
    assert.throws(() => parseSourceProducts(unpinned, f.manifest, 'test-body'), /pinned input/);
    const legacy = structuredClone(f.declaration); Object.assign(legacy.observations[0], { decoder: 'pds-image', kind: 'image', labelPath: 'other.lbl' });
    assert.throws(() => parseSourceProducts(legacy, f.manifest, 'test-body'), /pinned input/);
    const normalized = structuredClone(f.declaration); normalized.observations[0].labelPath = './core.lbl';
    assert.equal(parseSourceProducts(normalized, f.manifest, 'test-body')[0].labelPath, 'src/objects/test-body/source/core.lbl');
    const attached = structuredClone(f.declaration); attached.observations[0].labelPath = 'core.bin';
    assert.doesNotThrow(() => parseSourceProducts(attached, f.manifest, 'test-body'));
    const product = parseSourceProducts(f.declaration, f.manifest, 'test-body')[0];
    const bypass = { ...product, labelPath: 'src/objects/test-body/source/unpinned.lbl' };
    await assert.rejects(sourceRun(f.root,bypass), /pinned input/); await assert.rejects(qualifySourceProduct(f.root, bypass), /pinned input/);
    await qualifySourceProduct(f.root, product);
    assert.equal((await qualifySourceProduct(f.root, product)).reused, true);
    await writeFile(resolve(f.source, 'core.lbl'), label(10));
    const changed = parseSourceProducts(f.declaration, f.manifest, 'test-body')[0];
    assert.equal((await qualifySourceProduct(f.root, changed)).reused, false);
    const decoded = JSON.parse(await readFile(resolve(f.root, 'output/telescopes/test-body/cube-1/decoded.json'), 'utf8'));
    assert.equal(decoded.decoded.structures[0].maximum, 20);
  } finally { await f.cleanup(); }
});

test('public query and qualification actions agree for equivalent UTC and offset intervals', async () => {
  const f = await fixture(); try {
    const base = sessionRequest(args), inputs = await f.load();
    const utc = queryCapabilities({ ...base, time: { fromIso: '2026-01-01T10:00:00Z', toIso: '2026-01-01T10:10:00Z' } }, inputs);
    const offset = queryCapabilities({ ...base, time: { fromIso: '2026-01-01T07:00:00-03:00', toIso: '2026-01-01T07:10:00-03:00' } }, inputs);
    assert.equal(utc.candidates[0].meetsConstraints.time.answer, 'yes');
    assert.deepEqual(offset.candidates[0].meetsConstraints, utc.candidates[0].meetsConstraints);
    assert.deepEqual(offset.candidates[0].selectionAssessment.qualificationActions, utc.candidates[0].selectionAssessment.qualificationActions);
    assert.equal(offset.candidates[0].selectionAssessment.qualificationActions.length, 1);
    const outside = queryCapabilities({ ...base, time: { fromIso: '2026-01-01T07:11:00-03:00', toIso: '2026-01-01T07:12:00-03:00' } }, inputs);
    assert.equal(outside.candidates[0].meetsConstraints.time.answer, 'no');
    assert.equal(outside.candidates[0].selectionAssessment.qualificationActions.length, 0);
  } finally { await f.cleanup(); }
});

test('source-qualified cube crosses the common exact-artifact handoff without invented science facts', async () => {
  const f = await fixture(); try {
    await f.api.qualify(f.root, { target: 'test-body', telescope: 'Test telescope', mode: 'test cube', observation: 'cube-1', configuration: { kind: 'source-product', id: 'cube-1' } });
    const answer = queryCapabilities(sessionRequest(args), await f.load()), selected = selectObservation(answer, 'Test telescope', 'test cube', 'cube-1');
    assert.ok(selected.product); assert.equal(selected.satisfaction.status, 'unresolved');
    const input = await selectedProductInput(f.root, selected);
    assert.equal(input.file, resolve(f.source, 'core.bin')); assert.equal(input.facts.kind, 'cube');
    assert.equal(input.facts.wavelengthIntervalsMicrometres, undefined);
    await writeFile(input.file, Buffer.alloc(8));
    await assert.rejects(selectedProductInput(f.root, selected), /stale/);
  } finally { await f.cleanup(); }
});

test('saved choices qualify, export complete dependencies, reassess and reuse without repeating reduction', async () => {
  const f = await fixture(); try {
    const out = resolve(f.root, 'delivery'), saved = await saveSession(f.root, args, out, f.api);
    assert.equal(saved.choices[0].state, 'qualify');
    // Serialized commands, configuration and file paths are not used to run anything.
    const altered = { ...saved, choices: saved.choices.map(c => ({ ...c, configuration: { kind: 'unknown' }, product: '/untrusted/file' })) };
    await writeFile(resolve(out, 'query.json'), JSON.stringify(altered));
    const result = await getSession(f.root, out, 1, () => {}, f.api);
    assert.ok('satisfaction' in result);
    assert.equal(result.satisfaction.status, 'unresolved'); assert.equal(f.qualifications(), 1);
    const delivery = JSON.parse(await readFile(result.resultPath, 'utf8'));
    assert.ok(delivery.files.some((f: { path: string }) => f.path.endsWith('core.lbl')));
    assert.ok(delivery.files.some((f: { path: string }) => f.path.endsWith('decoded.json')));
    assert.equal((await getSession(f.root, out, 1, () => {}, f.api)).reused, true); assert.equal(f.qualifications(), 1);
    const copied = resolve(out, 'pick-1', delivery.product), original = await readFile(copied);
    const changed = Buffer.from(original); changed[0] = changed[0] === 0 ? 1 : 0; await writeFile(copied, changed);
    await assert.rejects(getSession(f.root, out, 1, () => {}, f.api, { offline: true }), /content pin mismatch/u);
    await writeFile(copied, original);
    await assert.rejects(saveSession(f.root, args, out, f.api), /already exists/);
    await writeFile(result.product, Buffer.alloc(8));
    await assert.rejects(getSession(f.root, out, 1, () => {}, f.api), /did not match/);
  } finally { await f.cleanup(); }
});

test('a saved number never silently follows reordered or removed observations', async () => {
  const f = await fixture(); try {
    const out = resolve(f.root, 'delivery'); await saveSession(f.root, args, out, f.api);
    const none: SessionServices = { ...f.api, load: async () => ({ ...await f.load(), sourceProducts: [] }) };
    await assert.rejects(getSession(f.root, out, 1, () => {}, none), /no longer available/);
    assert.equal(f.qualifications(), 0);
    await assert.rejects(getSession(f.root, out, 0, () => {}, f.api), /--pick/);
    await writeFile(resolve(out, '.session.lock'), 'owned');
    await assert.rejects(getSession(f.root, out, 1, () => {}, f.api), /Another operation/);
  } finally { await f.cleanup(); }
});

test('exploration is immutable, revalidates its exact choice, and delivers with not-requested context', async () => {
  const f = await fixture(); try {
    const curatedImagery = { service: 'WWT core catalogs', state: 'indexed', revision: '2c7d96f14bae041501943b9281f71a84a5310f6e',
      total: 0, matches: [], limit: 25, scope: 'curated display imagery; title or reference-frame match only' } as const;
    const api: SessionServices = { ...f.api, explore: async (_root, request) => explorationAnswer(request, { ...await f.load(), curatedImagery }) };
    const out = resolve(f.root, 'explore'), saved = await saveExploration(f.root, ['test-body'], out, api);
    assert.equal(saved.choices.length, 1); assert.equal(saved.choices[0]!.state, 'qualify');
    assert.deepEqual(JSON.parse(await readFile(resolve(out, 'explore.json'), 'utf8')).answer.curatedImagery, curatedImagery);
    const altered = { ...saved, choices: saved.choices.map(choice => ({ ...choice, configuration: { kind: 'untrusted' } })) };
    await writeFile(resolve(out, 'explore.json'), JSON.stringify(altered));
    const result = await getSession(f.root, out, 1, () => {}, api);
    assert.equal(result.context.kind, 'exploration'); assert.equal(result.context.assessment.status, 'not-requested');
    const delivery = JSON.parse(await readFile(result.resultPath, 'utf8'));
    assert.equal(delivery.schema, 'cssearth-telescope-delivery@3'); assert.equal(delivery.context.assessment.status, 'not-requested');
    assert.equal((await getSession(f.root, out, 1, () => {}, api, { offline: true })).replay, 'pinned-local-artifact');
    await writeFile(resolve(out, 'query.json'), '{}');
    await assert.rejects(getSession(f.root, out, 1, () => {}, api), /both query\.json and explore\.json/);
  } finally { await f.cleanup(); }
});

test('saved exploration carries its pinned Keck source evidence into the run directory', async () => {
  const f = await fixture(); try {
    const body = `${JSON.stringify({source:'https://koa.ipac.caltech.edu/TAP',request:'SELECT TOP 1 ...',rows:[]})}\n`, pin = digest(body);
    const archive = resolve(f.root, 'output/telescopes/archive-leads');
    await mkdir(archive, {recursive:true}); await writeFile(resolve(archive, `${pin}.json`), body);
    const lead = {service:'https://koa.ipac.caltech.edu/TAP',state:'sampled' as const,scope:'public object frames',reason:'sampled',
      instruments:[],sources:[{table:'koa_nirc2',instrument:'NIRC2',koaid:'N2.20090805.31896.fits',targetName:'test-body',
        filehand:'/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits',dateObs:'2009-08-05',evidence:pin}]};
    const api:SessionServices={...f.api,explore:async(_root,request)=>explorationAnswer(request,{...await f.load(),archiveLeads:[lead]})};
    const out=resolve(f.root,'keck-explore'); await saveExploration(f.root,['test-body'],out,api);
    assert.equal(await readFile(resolve(out,'keck-source-evidence',`${pin}.json`),'utf8'),body);
    await writeFile(resolve(archive,`${pin}.json`),'{}');
    assert.equal(await readFile(resolve(out,'keck-source-evidence',`${pin}.json`),'utf8'),body);
  } finally { await f.cleanup(); }
});

test('CLI rejects typos and ambiguous arguments before archive access', () => {
  for (const input of [['query', 'eris', '--wave', '1,2'], ['get', 'x', '--pick', '1.5'], ['get', 'x', '--pick', '1', '--pick', '2'], ['query', 'eris', '--target', 'io', '--out', 'x']]) assert.throws(() => parseCli(input));
  const parsed = parseCli(['query', 'eris', '--wavelength', '1,2', '--kind', 'cube', '--any-time', '--min-arcsec', '1', '--out', 'x']);
  assert.equal(parsed.command, 'query'); if (parsed.command === 'query') assert.equal(sessionRequest(parsed.requestArgs).result, 'telescope-product');
  assert.throws(() => parseCli(['query', 'eris', '--wavelength', '1,2', '--kind', 'cube', '--any-time', '--min-arcsec', '1', '--result', 'body-map', '--out', 'x']), /retrieve native products/);
  assert.throws(() => sessionRequest(['--target', 'eris', '--wavelength', '1,2', '--result', 'telescope-product']), /State --kind/);
});

test('get finds a saved archive choice by its identity when the service stamps each answer with the query time', () => {
  const choice = (acquisitionKey: string, observation: string, snapshot: string) => {
    const reference = { kind: 'vo-acquisition' as const, acquisitionKey, observation, snapshot };
    return { key: JSON.stringify(reference), reference } as unknown as Parameters<typeof savedChoice>[0][number];
  };
  const saved = choice('acq-1', 'obs-1', 'response-at-10:00'), fresh = [choice('acq-1', 'obs-1', 'response-at-10:05'), choice('acq-2', 'obs-2', 'response-at-10:05')];
  assert.equal(savedChoice(fresh, saved), fresh[0]);
  assert.equal(savedChoice([choice('acq-9', 'obs-1', 'response-at-10:05')], saved), undefined, 'another acquisition of the observation is not the saved choice');
  assert.equal(savedChoice([...fresh, choice('acq-1', 'obs-1', 'response-at-10:06')], saved), undefined, 'an ambiguous identity is refused');
  const indexed = { key: 'indexed', reference: { kind: 'indexed-observation' } };
  assert.equal(savedChoice(fresh, indexed), undefined, 'indexed observations still match by their exact key');
});

test('get scopes archive revalidation to the registered service in its saved choice', async () => {
  const f = await fixture();
  try {
    const out = resolve(f.root, 'archive-explore'), service = SERVICES[0]!.service;
    await mkdir(out);
    const saved = { schema: 'cssearth-telescope-exploration@1', target: 'test-body', arguments: ['test-body'],
      choices: [{ pick: 1, key: 'saved-key', observation: 'archive-obs', archiveService: service,
        reference: { kind: 'vo-acquisition', observation: 'archive-obs', acquisitionKey: 'acq', snapshot: 'first' } }] };
    await writeFile(resolve(out, 'explore.json'), JSON.stringify(saved));
    const api: SessionServices = { ...f.api, explore: async (_root, _request, observation, _progress, selection) => {
      assert.equal(observation, 'archive-obs');
      assert.deepEqual(selection, { archiveService: service });
      throw new Error('scope reached');
    } };
    await assert.rejects(getSession(f.root, out, 1, () => {}, api), /scope reached/u);
    await writeFile(resolve(out, 'explore.json'), JSON.stringify({ ...saved, choices: [{ ...saved.choices[0], archiveService: 'https://example.org/unregistered' }] }));
    await assert.rejects(getSession(f.root, out, 1, () => {}, api), /not registered/u);
  } finally { await f.cleanup(); }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadSourceProducts, parseSourceProducts, sourceRun, SOURCE_PRODUCTS_SCHEMA } from './source-products.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { queryCapabilities, selectObservation, type QueryInputs } from './query.mts';
import { selectedProductInput } from './selected-product.mts';
import { saveSession, saveExploration, getSession, sessionRequest, observationChoices, type SessionServices } from './session.mts';
import { explorationAnswer } from './exploration.mts';
import { parseCli } from './cli.mts';

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
  const manifest = { inputs: files.map(f => ({ id: f.id, path: f.path, origin: `https://example.org/${f.path}`, expectedBytes: f.bytes.length, expectedSha256: digest(f.bytes) })) };
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
    await assert.rejects(sourceRun(bypass), /pinned input/); await assert.rejects(qualifySourceProduct(f.root, bypass), /pinned input/);
    await qualifySourceProduct(f.root, product);
    assert.equal((await qualifySourceProduct(f.root, product)).reused, true);
    await writeFile(resolve(f.source, 'core.lbl'), label(10));
    await assert.rejects(loadSourceProducts(f.root, 'test-body'), /source-manifest pin/);
    await assert.rejects(qualifySourceProduct(f.root, product), /manifest pin/);
    f.manifest.inputs[1].expectedBytes = Buffer.byteLength(label(10)); f.manifest.inputs[1].expectedSha256 = digest(label(10)); await f.writeMetadata();
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
    assert.equal(result.satisfaction.status, 'unresolved'); assert.equal(f.qualifications(), 1);
    const delivery = JSON.parse(await readFile(result.resultPath, 'utf8'));
    assert.ok(delivery.files.some((f: { path: string }) => f.path.endsWith('core.lbl')));
    assert.ok(delivery.files.some((f: { path: string }) => f.path.endsWith('decoded.json')));
    assert.equal((await getSession(f.root, out, 1, () => {}, f.api)).reused, true); assert.equal(f.qualifications(), 1);
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
    const api: SessionServices = { ...f.api, explore: async (_root, request) => explorationAnswer(request, await f.load()) };
    const out = resolve(f.root, 'explore'), saved = await saveExploration(f.root, ['test-body'], out, api);
    assert.equal(saved.choices.length, 1); assert.equal(saved.choices[0]!.state, 'qualify');
    const altered = { ...saved, choices: saved.choices.map(choice => ({ ...choice, configuration: { kind: 'untrusted' } })) };
    await writeFile(resolve(out, 'explore.json'), JSON.stringify(altered));
    const result = await getSession(f.root, out, 1, () => {}, api);
    assert.equal(result.context.kind, 'exploration'); assert.equal(result.context.assessment.status, 'not-requested');
    const delivery = JSON.parse(await readFile(result.resultPath, 'utf8'));
    assert.equal(delivery.schema, 'cssearth-telescope-delivery@2'); assert.equal(delivery.context.assessment.status, 'not-requested');
    assert.equal((await getSession(f.root, out, 1, () => {}, api, { offline: true })).replay, 'pinned-local-artifact');
    await writeFile(resolve(out, 'query.json'), '{}');
    await assert.rejects(getSession(f.root, out, 1, () => {}, api), /both query\.json and explore\.json/);
  } finally { await f.cleanup(); }
});

test('CLI rejects typos and ambiguous arguments before archive access', () => {
  for (const input of [['query', 'eris', '--wave', '1,2'], ['get', 'x', '--pick', '1.5'], ['get', 'x', '--pick', '1', '--pick', '2'], ['query', 'eris', '--target', 'io', '--out', 'x']]) assert.throws(() => parseCli(input));
  const parsed = parseCli(['query', 'eris', '--wavelength', '1,2', '--kind', 'cube', '--any-time', '--min-arcsec', '1', '--out', 'x']);
  assert.equal(parsed.command, 'query'); if (parsed.command === 'query') assert.equal(sessionRequest(parsed.requestArgs).result, 'telescope-product');
  assert.throws(() => parseCli(['query', 'eris', '--wavelength', '1,2', '--kind', 'cube', '--any-time', '--min-arcsec', '1', '--result', 'body-map', '--out', 'x']), /retrieve native products/);
  assert.throws(() => sessionRequest(['--target', 'eris', '--wavelength', '1,2', '--result', 'telescope-product']), /State --kind/);
});

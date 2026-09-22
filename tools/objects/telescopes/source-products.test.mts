import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { card, imageFixture } from '../../../tests/fixtures/fits/helpers.mts';
import { parseSourceProducts, loadSourceProducts, SOURCE_PRODUCTS_SCHEMA } from './source-products.mts';
import { qualifySourceProduct, inspectFits, assertPdsDependencies } from './qualify-source.mts';
import { queryCapabilities, selectObservation, type CapabilityRequest, type QueryInputs } from './query.mts';
import { assessRequest } from './request-satisfaction.mts';
const request: CapabilityRequest = { target: 'test-body', wavelengthMicrometres: [1, 2], time: { any: true }, kind: 'image', result: 'telescope-product', angularResolutionArcsec: 1 };
const fixture = async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'source-qualification-')), source = resolve(root, 'src/objects/test-body/source');
  await mkdir(source, { recursive: true });
  const bytes = imageFixture(16, [-2, 0, 1, 3], [card('OBS_ID', "'exposure-1'")]);
  const manifest = { inputs: [{ id: 'frame', path: 'image.fits', origin: 'https://example.org/image.fits' }] };
  const declaration = { schema: SOURCE_PRODUCTS_SCHEMA, target: 'test-body', observations: [{ id: 'frame-1', telescope: 'New Observatory', mode: 'unknown-mode', kind: 'image', archiveProductId: 'exposure-1', decoder: 'fits-image', inputs: [{ input: 'frame', role: 'science' }], identity: { OBS_ID: 'exposure-1' }, units: 'counts', meaning: 'Native detector counts', citation: 'https://example.org/', limitations: ['No resolution or bandpass qualification.'] }] };
  await writeFile(resolve(source, 'manifest.json'), JSON.stringify(manifest)); await writeFile(resolve(source, 'observations.json'), JSON.stringify(declaration)); await writeFile(resolve(source, 'image.fits'), bytes);
  return { root, source, bytes, manifest, declaration, product: parseSourceProducts(declaration, manifest, 'test-body')[0]! };
};
const queryInputs = async (root: string): Promise<QueryInputs> => ({ ledgers: [], capabilities: [], targetCatalogue: [{ id: 'test-body', name: 'Test Body', aliases: [] }], targetAssociations: [], bodyMaps: [], sourceProducts: await loadSourceProducts(root, 'test-body') });
test('a new telescope and target need no query registry change: actions, exact qualification and honest satisfaction', async () => {
  const f = await fixture(); try {
    const before = queryCapabilities(request, await queryInputs(f.root)), candidate = before.candidates[0]!;
    assert.equal(candidate.selectionAssessment.qualificationActions[0]!.configuration.kind, 'source-product');
    assert.equal(candidate.toolkitSupport.level, 'tool-without-checked-program');
    const result = await qualifySourceProduct(f.root, f.product);
    assert.equal(result.reused, false); assert.equal((await qualifySourceProduct(f.root, f.product)).reused, true);
    const after = queryCapabilities(request, await queryInputs(f.root));
    assert.equal(after.candidates[0]!.toolkitSupport.level, 'source-qualified');
    assert.deepEqual(after.candidates[0]!.toolkitSupport.checked, []); assert.deepEqual(after.candidates[0]!.toolkitSupport.archiveFinalQualified, []);
    const selection = selectObservation(after, f.product.telescope, f.product.mode, f.product.id);
    assert.equal(selection.satisfaction.status, 'unresolved'); assert.equal(selection.satisfaction.constraints.artifact!.answer, 'yes'); assert.equal(selection.satisfaction.constraints.wavelength!.answer, 'unknown');
    const map = queryCapabilities({ ...request, result: 'body-map' }, await queryInputs(f.root));
    assert.ok(map.candidates[0]!.selectionAssessment.blockers.some(b => b.code === 'body-map-author-missing'));
    assert.equal(map.candidates[0]!.observations!.records![0]!.requestSatisfaction!.constraints.result!.answer, 'unknown');
    // Output mutation invalidates even though the run parameters still agree.
    const report = resolve(f.root, 'output/telescopes/test-body/frame-1/decoded.json'); await writeFile(report, '{}');
    assert.equal((await loadSourceProducts(f.root, 'test-body'))[0]!.qualified, false);
    assert.equal((await qualifySourceProduct(f.root, f.product)).reused, false);
    // Inputs are checked before a reuse shortcut.
    await writeFile(resolve(f.source, 'image.fits'), Buffer.alloc(f.bytes.length));
    assert.equal((await loadSourceProducts(f.root, 'test-body'))[0]!.qualified, false);
    await assert.rejects(qualifySourceProduct(f.root, f.product), /manifest pin/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('header identity, complete pins and supported configuration are enforced', async () => {
  const f = await fixture(); try {
    await assert.rejects(qualifySourceProduct(f.root, { ...f.product, identity: { OBS_ID: 'other' } }), /identity mismatch/);
    const bad = structuredClone(f.declaration); bad.observations[0]!.inputs[0]!.input = 'missing';
    assert.throws(() => parseSourceProducts(bad, f.manifest, 'test-body'), /missing manifest input/);
    const traversal = structuredClone(f.manifest); traversal.inputs[0]!.path = '../escape';
    assert.throws(() => parseSourceProducts(f.declaration, traversal, 'test-body'), /escapes/);
    assert.throws(() => parseSourceProducts({ ...f.declaration, observations: [{ ...f.declaration.observations[0], angularResolutionArcsec: 1 }] }, f.manifest, 'test-body'), /resolution basis/);
    const duplicates = { ...f.declaration, observations: [...f.declaration.observations, ...f.declaration.observations] };
    assert.throws(() => parseSourceProducts(duplicates, f.manifest, 'test-body'), /Duplicate/);
    const changed = { ...f.product, meaning: 'Changed estimator' }; await qualifySourceProduct(f.root, f.product);
    assert.equal((await qualifySourceProduct(f.root, changed)).reused, false);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('request satisfaction uses one product, preserves spectral gaps, and separates missing science from valid bytes', () => {
  const facts = { target: request.target, verified: true, kind: 'image' as const, result: 'telescope-product' as const, wavelengthIntervalsMicrometres: [[1, 2]] as const, angularResolutionArcsec: .5 };
  assert.equal(assessRequest(request, facts).status, 'unresolved');
  assert.equal(assessRequest(request, { ...facts, resolutionEvidence: [{ kind: 'measured', receipt: { file: 'fit.json', sha256: 'a'.repeat(64) } }] }).status, 'fulfilled');
  assert.equal(assessRequest(request, { ...facts, wavelengthIntervalsMicrometres: [[1, 1.2], [1.8, 2]] }).status, 'unresolved');
  assert.equal(assessRequest(request, { ...facts, wavelengthIntervalsMicrometres: [[3, 4]] }).status, 'refused');
  assert.equal(assessRequest(request, { ...facts, angularResolutionArcsec: undefined }).constraints.angularResolution!.answer, 'unknown');
  assert.equal(assessRequest(request, { ...facts, verified: false }).status, 'unresolved');
});
test('FITS special samples remain missing rather than becoming measured zero', () => {
  const result = inspectFits(imageFixture(16, [-32768, 0, 1, 2], [card('BLANK', '-32768')]), {});
  assert.throws(() => inspectFits(imageFixture(), {}, 'cube'), /declared cube/);
  assert.deepEqual(result.structures[0], { shape: [2, 2], elements: 4, finite: 3, missing: 1, minimum: 0, maximum: 2 });
});

test('all PDS pointers are pinned, including external format definitions', async () => {
  const f = await fixture(); try {
    const path = 'src/objects/test-body/source/frame.lbl';
    await writeFile(resolve(f.root, path), 'PDS_VERSION_ID = PDS3\n^IMAGE = "IMAGE.FITS"\n^STRUCTURE = "missing.fmt"\nEND\n');
    const product = { ...f.product, files: [...f.product.files, { ...f.product.files[0]!, role: 'label', path }] };
    await assert.rejects(assertPdsDependencies(f.root, product), /Unpinned PDS dependency missing.fmt/);
    await writeFile(resolve(f.root, path), 'PDS_VERSION_ID = PDS3\n^IMAGE = "IMAGE.FITS"\nEND\n');
    await assertPdsDependencies(f.root, product);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('successful decoding never promotes declared wavelength or resolution into verified facts', async () => {
  const f = await fixture(); try {
    const declaration = { ...f.declaration, observations: [{ ...f.declaration.observations[0], wavelengthIntervalsMicrometres: [[1, 2]], angularResolutionArcsec: .5, resolutionBasis: 'An unchecked source declaration' }] };
    await writeFile(resolve(f.source, 'observations.json'), JSON.stringify(declaration));
    const product = parseSourceProducts(declaration, f.manifest, 'test-body')[0]!;
    await qualifySourceProduct(f.root, product);
    const answer = queryCapabilities(request, await queryInputs(f.root));
    const satisfaction = selectObservation(answer, product.telescope, product.mode, product.id).satisfaction;
    assert.equal(satisfaction.constraints.artifact!.answer, 'yes');
    assert.equal(satisfaction.constraints.kind!.answer, 'yes');
    assert.equal(satisfaction.constraints.wavelength!.answer, 'unknown');
    assert.equal(satisfaction.constraints.angularResolution!.answer, 'unknown');
    assert.equal(satisfaction.status, 'unresolved');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a source-qualified cube remains selectable as an intermediate for a supported map author', async () => {
  const f = await fixture(); try {
    const product = { ...f.product, telescope: 'JWST', mode: 'NIRSPEC/IFU', kind: 'cube' as const, qualified: true, receipt: 'fixture.json', facts: { verified: true, target: request.target, kind: 'cube' as const, result: 'telescope-product' as const } };
    const answer = queryCapabilities({ ...request, kind: 'cube', result: 'body-map' }, { ...await queryInputs(f.root), sourceProducts: [product] });
    const selected = selectObservation(answer, product.telescope, product.mode, product.id);
    assert.equal(selected.satisfaction.constraints.kind?.answer, 'yes');
    assert.equal(selected.satisfaction.constraints.result?.answer, 'unknown');
    assert.equal(selected.satisfaction.status, 'unresolved');
    assert.ok(answer.candidates[0]!.selectionAssessment.nextActions.some(action => action.kind === 'select-observation'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

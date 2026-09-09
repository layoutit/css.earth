import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { prepareObjectProvenance } from './objects/provenance.mjs';
import { productSourceIds, validateObjectProvenance } from '../src/platform/object-provenance.mjs';
import { provenanceIdentity } from './prepare-provenance.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => JSON.parse(await readFile(path, 'utf8'));

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-provenance-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, 'source'), outputDirectory = resolve(root, 'prepared'), publicDirectory = resolve(root, 'public');
  await Promise.all([mkdir(resolve(source, 'preparation'), { recursive: true }), mkdir(outputDirectory), mkdir(publicDirectory)]);
  const input = Buffer.from('original observation bytes'), output = Buffer.from('prepared texture bytes');
  const recipe = JSON.stringify({ schema: 'cssearth-static-surface-raster@1', kind: 'observation-lenses',
    lenses: [{ id: 'surface', input: 'observation.dat', qualification: 'Fixture observation' }] });
  const pin = (id, path, bytes) => ({ id, path, expectedSha256: hash(bytes), expectedBytes: bytes.length,
    origin: `https://example.org/${path}`, credit: 'Fixture archive', license: 'CC0', acquisition: 'Exact fixture input', consumers: ['surfaces'] });
  await Promise.all([
    writeFile(resolve(source, 'observation.dat'), input), writeFile(resolve(source, 'unused.dat'), 'unused'),
    writeFile(resolve(publicDirectory, 'surface.webp'), output),
    writeFile(resolve(source, 'preparation/raster.json'), recipe),
    writeFile(resolve(source, 'manifest.json'), JSON.stringify({ inputs: [pin('observation', 'observation.dat', input), pin('unused', 'unused.dat', Buffer.from('unused'))], documents: [], generatedIntermediates: [] })),
    writeFile(resolve(root, 'object.json'), JSON.stringify({ id: 'fixture', properties: { recipe: { sources: [
      { id: 'raster', path: 'source/preparation/raster.json', sha256: hash(recipe) },
    ] } } })),
    writeFile(resolve(root, 'runtime-assets.json'), JSON.stringify({ assets: [{ filename: 'surface.webp', sha256: hash(output), bytes: output.length }] })),
    writeFile(resolve(outputDirectory, 'lenses.json'), JSON.stringify({ controls: [{ id: 'surface', label: 'Surface', surfaceUrl: '/scenes/fixture/surface.webp' }] })),
  ]);
  return { objectDirectory: root, source, outputDirectory, publicDirectory, write: false };
}

test('preparation binds exact input and output bytes and excludes unused archive entries', async t => {
  const context = await fixture(t), document = await prepareObjectProvenance(context);
  assert.equal(document.basis, 'prepared');
  assert.deepEqual(document.sources.map(source => source.id), ['observation']);
  assert.equal(document.sources[0].verification, 'bytes-verified');
  assert.equal(document.products[0].outputs[0].verification, 'bytes-verified');
  assert.deepEqual(productSourceIds(document, 'surface'), ['observation']);
});

test('changed source bytes invalidate provenance even when references and credit text are unchanged', async t => {
  const context = await fixture(t);
  await writeFile(resolve(context.source, 'observation.dat'), 'different scientific input');
  await assert.rejects(prepareObjectProvenance(context), /identity mismatch: observation.dat/u);
});

test('acquired products retain their configuration input and verify its exact bytes', async t => {
  const context = await fixture(t);
  await writeFile(resolve(context.source, 'preparation/acquisition.json'), JSON.stringify({ operations: [
    { kind: 'request-download', path: 'observation.dat', url: 'https://example.org/api', fileSource: 'unused.dat' },
  ] }));
  const document = await prepareObjectProvenance(context);
  assert.deepEqual(new Set(productSourceIds(document, 'surface')), new Set(['observation', 'unused']));
  assert.deepEqual(document.sources.find(source => source.id === 'observation').dependencies, ['unused']);
  await writeFile(resolve(context.source, 'unused.dat'), 'changed acquisition configuration');
  await assert.rejects(prepareObjectProvenance(context), /identity mismatch: unused.dat/u);
});

test('upstream verification requests are recorded without inventing acquisition history', async t => {
  const context = await fixture(t);
  const verification = { kind: 'verify-request', expectedPath: 'observation.dat', url: 'https://example.org/api' };
  await writeFile(resolve(context.source, 'preparation/acquisition.json'), JSON.stringify({ operations: [verification] }));
  const document = await prepareObjectProvenance(context);
  assert.equal(document.sources[0].acquisitionOperation, null);
  assert.deepEqual(document.sources[0].verificationOperations, [verification]);
});

test('changed output bytes invalidate a prepared record', async t => {
  const context = await fixture(t);
  await writeFile(resolve(context.publicDirectory, 'surface.webp'), 'different output');
  await assert.rejects(prepareObjectProvenance(context), /identity mismatch.*surface.webp/u);
});

test('changed recipe bytes cannot retain the old lineage identity', async t => {
  const context = await fixture(t);
  await writeFile(resolve(context.source, 'preparation/raster.json'), '{}');
  await assert.rejects(prepareObjectProvenance(context), /recipe changed/u);
});

test('recovery preserves pins without claiming execution or requiring ignored source downloads', async t => {
  const context = await fixture(t);
  await rm(resolve(context.source, 'observation.dat'));
  const recovered = await prepareObjectProvenance({ ...context, basis: 'recovered' });
  assert.equal(recovered.basis, 'recovered');
  assert.equal(recovered.sources[0].verification, 'manifest-pin');
  assert.throws(() => validateObjectProvenance({ ...recovered, basis: 'prepared' }), /unverified source/u);
});

test('changing a binding or an output identity invalidates an existing preparation record', async t => {
  const context = await fixture(t), prepared = await prepareObjectProvenance(context);
  const recovered = await prepareObjectProvenance({ ...context, basis: 'recovered' });
  assert.equal(provenanceIdentity(prepared), provenanceIdentity(recovered));
  recovered.products[0].outputs[0].sha256 = '0'.repeat(64);
  assert.notEqual(provenanceIdentity(prepared), provenanceIdentity(recovered));
});

test('invalid source edges and cyclic products are rejected', async t => {
  const document = await prepareObjectProvenance(await fixture(t));
  const invalid = structuredClone(document);
  invalid.products[0].inputs.push('unknown');
  assert.throws(() => validateObjectProvenance(invalid), /Unbound/u);
  document.products[0].parents.push('surface');
  assert.throws(() => validateObjectProvenance(document), /Cyclic/u);
});

test('an operation must resolve inside its pinned recipe', async t => {
  const document = await prepareObjectProvenance(await fixture(t));
  document.products[0].selector = '/lenses/999';
  assert.throws(() => validateObjectProvenance(document), /Unbound/u);
});

test('Saturn binds its actual base material and all contributing recipe identities', async () => {
  const document = await prepareObjectProvenance({ objectDirectory: resolve('src/planets/saturn'),
    publicDirectory: resolve('public/scenes/saturn'), basis: 'recovered', write: false });
  for (const id of ['normal', 'ultraviolet', 'methane', 'thermal', 'cross-section']) {
    const sources = productSourceIds(document, id);
    assert.ok(sources.includes('openspace-saturn-surface'), id);
    assert.ok(sources.includes('cassini-pia21611-polar-map'), id);
    assert.ok(sources.includes('openspace-saturn-ring-color'), id);
    assert.ok(document.products.find(product => product.id === id).recipeDependencies.includes('geometry'), id);
  }
  assert.ok(document.recipes.some(recipe => recipe.id === 'rings'));
});

test('Earth globe provenance excludes the retired local noise dataset', async () => {
  const document = await prepareObjectProvenance({ objectDirectory: resolve('src/planets/earth'),
    publicDirectory: resolve('public/scenes/earth'), basis: 'recovered', write: false });
  assert.ok(document.products.some(product => product.id === 'normal'));
  assert.ok(!document.products.some(product => product.id === 'buenos-aires-noise'));
  assert.ok(!document.sources.some(source => source.id.startsWith('buenos-aires-noise')));
});

test('spacecraft photographs bind their image, registration, and source-shape dependencies', async () => {
  for (const id of ['itokawa', 'donaldjohanson', 'comet-81p', 'comet-103p', 'comet-9p']) {
    const objectDirectory = resolve('src/planets', id);
    const descriptor = await read(resolve(objectDirectory, 'object.json'));
    const reference = descriptor.properties.recipe.sources.find(source => source.id === 'terrestrial');
    const recipe = await read(resolve(objectDirectory, reference.path));
    const document = await prepareObjectProvenance({ objectDirectory,
      publicDirectory: resolve('public/scenes', id), basis: 'recovered', write: false });
    for (const observation of recipe.raster.surfaceObservations) {
      const product = document.products.find(product => product.id === observation.id);
      assert.ok(product, id + '/' + observation.id);
      const sourceIds = new Set(productSourceIds(document, product.id));
      const paths = new Set(document.sources.filter(source => sourceIds.has(source.id)).map(source => source.path));
      const frames = observation.frames ?? [observation];
      for (const frame of frames) {
        for (const key of ['path', 'labelPath', 'controlPath', 'cameraPath', 'originalPath']) {
          if (frame[key]) assert.ok(paths.has(frame[key]), id + ': ' + frame[key]);
        }
      }
      assert.ok(paths.has(recipe.geometry.radialTerrain.path), id + ': source shape');
      assert.ok(!document.coverage.unresolved.some(gap => gap.product === observation.id));
    }
  }
});

test('Mercury coverage completion binds all three maps; previews retain their parent lineage', async () => {
  const objectDirectory = resolve('src/planets/mercury');
  const document = await prepareObjectProvenance({ objectDirectory, publicDirectory: resolve('public/scenes/mercury'), basis: 'recovered', write: false });
  assert.deepEqual(new Set(productSourceIds(document, 'enhanced')), new Set([
    'usgs-messenger-enhanced-global-z3', 'usgs-messenger-bdr-global-z3', 'usgs-messenger-topography-z3',
  ]));
  const enhanced = document.products.find(product => product.id === 'enhanced');
  assert.equal(enhanced.interpretation.falseColor, true);
  assert.equal(enhanced.interpretation.coverageCompletion.directEnhancedColorClaim, false);
  assert.equal(enhanced.interpretation.coverageCompletion.filledPixelCount, 295167);
  assert.deepEqual(new Set(productSourceIds(document, 'preview:enhanced')), new Set(enhanced.inputs));
  assert.ok(document.sources.some(source => source.path === 'spectrum/mascs-global-area-weighted-mean.json'));
  assert.ok(!document.sources.some(source => /stars\/|maps\/globe.asset|psg.*rif/iu.test(source.path)));
});

import { preparationEvidenceApplies, recordPreparationEvidence } from '../prepare/preparation-evidence.mts';
import { productInputRoles } from '../../src/platform/product-input-evidence.mts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { prepareObjectProvenance } from '../objects/provenance.mts';
import { productSourceIds, validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';

type PreparationContext = Parameters<typeof prepareObjectProvenance>[0];
type FixtureContext = PreparationContext & { source: string; outputDirectory: string; publicDirectory: string };
type FixturePin = { id: string; path: string; expectedSha256: string; expectedBytes: number; origin: string; sourceBinding: {kind: 'local'; reason: string}; credit: string; license: string; acquisition: string; consumers: string[] };

const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const read = async (path: string): Promise<Record<string, unknown>> => requireRecord(JSON.parse(await readFile(path, 'utf8')), path);
const requireEntry = (value: unknown, label: string): Record<string, unknown> => requireRecord(value, label);
const requireValue = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new TypeError(`${label} is missing.`);
  return value;
};
const requirePresent = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) throw new TypeError(`${label} is missing.`);
  return value;
};
const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean.`);
  return value;
};

async function fixture(t: TestContext): Promise<FixtureContext> {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-provenance-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, 'source'), outputDirectory = resolve(root, 'prepared'), publicDirectory = resolve(root, 'public');
  await Promise.all([mkdir(resolve(source, 'preparation'), { recursive: true }), mkdir(outputDirectory), mkdir(publicDirectory)]);
  const input = Buffer.from('original observation bytes'), output = Buffer.from('prepared texture bytes');
  const recipe = JSON.stringify({ schema: 'cssearth-raster-recipe@1', polesCombined: true, polesOutput: 'poles.webp',
    surfaces: [{ id: 'surface', source: 'observation.dat', output: 'surface{suffix}.webp', thumbnail: 'surface-thumbnail.webp', falseColor: false, science: { coverage: { kind: 'black-fill', southConnected: false } } }] });
  const pin = (id: string, path: string, bytes: Uint8Array): FixturePin => ({ id, path, expectedSha256: hash(bytes), expectedBytes: bytes.length,
    origin: `https://example.org/${path}`, sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, credit: 'Fixture archive', license: 'CC0', acquisition: 'Exact fixture input', consumers: ['surfaces'] });
  await Promise.all([
    writeFile(resolve(source, 'observation.dat'), input), writeFile(resolve(source, 'unused.dat'), 'unused'),
    writeFile(resolve(publicDirectory, 'surface@2x.webp'), output),
    writeFile(resolve(source, 'preparation/raster.json'), recipe),
    writeFile(resolve(source, 'manifest.json'), JSON.stringify({ schema:'cssfixture-authoritative-sources@2', inputs: [pin('observation', 'observation.dat', input), pin('unused', 'unused.dat', Buffer.from('unused'))], documents: [{ path: 'preparation/raster.json', expectedSha256: hash(recipe), expectedBytes: Buffer.byteLength(recipe) }], generatedIntermediates: [] })),
    writeFile(resolve(root, 'object.json'), JSON.stringify({ id: 'fixture', properties: { recipe: { sources: [
      { id: 'raster', path: 'source/preparation/raster.json' },
    ] } } })),
    writeFile(resolve(root, 'inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1', assets: [{ location: 'public', filename: 'surface@2x.webp', sha256: hash(output), bytes: output.length }] })),
    writeFile(resolve(outputDirectory, 'lenses.json'), JSON.stringify({ controls: [{ id: 'surface', label: 'Surface', surfaceUrl: '/scenes/fixture/surface@2x.webp' }] })),
  ]);
  return { objectDirectory: root, source, outputDirectory, publicDirectory, basis: 'prepared', write: false };
}

test('standalone lineage recovery never claims a fresh preparation, including with byte verification', async t => {
  const { basis, ...context } = await fixture(t);
  assert.equal((await prepareObjectProvenance(context)).basis, 'recovered');
  const verified = await prepareObjectProvenance({ ...context, verify: true });
  assert.equal(verified.basis, 'recovered');
  assert.ok(verified.sources.every(source => source.verification === 'bytes-verified'));
});

test('controlled photographic inserts bind every consumed photograph alongside the global base', async t => {
  const context = await fixture(t);
  const recipePath = resolve(context.source, 'preparation/raster.json'), recipe = await read(recipePath);
  const surface = requireRecord(requireArray(recipe.surfaces)[0]);
  surface.science = { kind: 'terrestrial-observation', detailMosaic: {format: 'controlled-geotiff', consumer: 'surfaces',
    profile: { displayRange: [0, 2], filter: 'CLEAR' },levelMatching:{boundaryPixels:4}} };
  const bytes = JSON.stringify(recipe);
  await writeFile(recipePath, bytes);
  // The manifest owns the recipe pin; the descriptor only names the recipe.
  const manifestPath = resolve(context.source, 'manifest.json'), manifest = await read(manifestPath);
  Object.assign(requireRecord(requireArray(manifest.documents)[0]), { expectedSha256: hash(bytes), expectedBytes: Buffer.byteLength(bytes) });
  await writeFile(manifestPath, JSON.stringify(manifest));
  const document = await prepareObjectProvenance(context);
  assert.deepEqual(productSourceIds(document, 'surface').sort(), ['observation', 'unused']);
  assert.ok(document.sources.every(source => source.verification === 'bytes-verified'));
});

test('preparation binds exact input and output bytes and excludes unused archive entries', async t => {
  const context = await fixture(t), document = await prepareObjectProvenance(context);
  assert.equal(document.basis, 'prepared');
  assert.deepEqual(document.sources.map(source => source.id), ['observation']);
  assert.equal(requireValue(document.sources[0], 'fixture source').verification, 'bytes-verified');
  assert.equal(requireValue(requireValue(document.products[0], 'fixture product').outputs[0], 'fixture output').verification, 'bytes-verified');
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
  assert.deepEqual(requireValue(document.sources.find(source => source.id === 'observation'), 'observation source').dependencies, ['unused']);
  await writeFile(resolve(context.source, 'unused.dat'), 'changed acquisition configuration');
  await assert.rejects(prepareObjectProvenance(context), /identity mismatch: unused.dat/u);
});

test('composition lineage follows the pinned conversion recipe to the native archive', async t => {
  const context = await fixture(t), manifestPath = resolve(context.source, 'manifest.json');
  const recipe = JSON.stringify({schema: 'cssearth-mapped-composition@1', target: 'Fixture', referenceRadiusMeters: 100,
    input: 'unused.dat', sha256: hash('unused'), observationName: 'fixture',
    selections: [{id: 'surface', kind: 'posterior', field: 'ice', statistic: 'median'}]});
  await writeFile(resolve(context.source, 'conversion.json'), recipe);
  const manifest = await read(manifestPath);
  manifest.documents = [...requireArray(manifest.documents), {id: 'conversion', path: 'conversion.json', expectedSha256: hash(recipe), expectedBytes: Buffer.byteLength(recipe),
    sourceBinding: {kind: 'local', reason: 'Authored conversion fixture'}, consumers: ['surfaces']}];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(resolve(context.source, 'preparation/acquisition.json'), JSON.stringify({operations: [
    {kind: 'mapped-composition', path: 'observation.dat', recipePath: 'conversion.json', product: 'surface'},
  ]}));
  const document = await prepareObjectProvenance(context);
  assert.deepEqual(new Set(productSourceIds(document, 'surface')), new Set(['observation', 'conversion', 'unused']));
  assert.deepEqual(requireValue(document.sources.find(source => source.id === 'observation'), 'converted grid').dependencies, ['conversion', 'unused']);
  // Recovery needs the checked-in recipe, but not the downloaded original.
  await rm(resolve(context.source, 'unused.dat'));
  assert.deepEqual(new Set(productSourceIds(await prepareObjectProvenance({...context, basis: 'recovered'}), 'surface')), new Set(['observation', 'conversion', 'unused']));
  await writeFile(resolve(context.source, 'conversion.json'), recipe.replace('unused.dat', 'other.dat'));
  await assert.rejects(prepareObjectProvenance({...context, basis: 'recovered'}), /identity mismatch: conversion.json/u);
});

test('upstream verification requests are recorded without inventing acquisition history', async t => {
  const context = await fixture(t);
  const verification = { kind: 'verify-request', expectedPath: 'observation.dat', url: 'https://example.org/api' };
  await writeFile(resolve(context.source, 'preparation/acquisition.json'), JSON.stringify({ operations: [verification] }));
  const document = await prepareObjectProvenance(context);
  assert.equal(requireValue(document.sources[0], 'fixture source').acquisitionOperation, null);
  assert.deepEqual(requireValue(document.sources[0], 'fixture source').verificationOperations, [verification]);
});

test('document storage does not assign project authorship to an archive input', async t => {
  const context = await fixture(t), path = resolve(context.source, 'manifest.json');
  const manifest = await read(path), inputs = requireArray(manifest.inputs, 'fixture inputs');
  const observation = requireEntry(requireValue(inputs[0], 'fixture observation'), 'fixture observation');
  manifest.inputs = inputs.slice(1);
  delete observation.id; delete observation.credit; delete observation.acquisition;
  manifest.documents = [observation, ...requireArray(manifest.documents)];
  await writeFile(path, JSON.stringify(manifest));
  await writeFile(resolve(context.source, 'preparation/acquisition.json'), JSON.stringify({ operations: [
    { kind: 'download', path: requireString(observation.path, 'fixture observation path'), url: requireString(observation.origin, 'fixture observation origin') },
  ] }));
  let document = await prepareObjectProvenance(context);
  assert.equal(document.sources[0].kind, 'source-document');
  assert.equal(document.sources[0].id, 'source-document:observation.dat');
  assert.equal(document.sources[0].credit, 'Credit not recorded in source manifest.');
  assert.equal(document.sources[0].acquisition, 'Acquisition not recorded in source manifest.');
  assert.equal(requirePresent(requireValue(document.sources[0], 'fixture source').acquisitionOperation, 'acquisition operation').kind, 'download');
  Object.assign(observation, { kind: 'provider-label', credit: 'Fixture mission',
    acquisition: 'Original archive label', upstreamLineage: 'Fixture product v1' });
  await writeFile(path, JSON.stringify(manifest));
  document = await prepareObjectProvenance(context);
  assert.equal(document.sources[0].kind, 'provider-label');
  assert.equal(document.sources[0].credit, 'Fixture mission');
  assert.equal(document.sources[0].acquisition, 'Original archive label');
  assert.equal(requireString(requireRecord(requireValue(document.sources[0], 'fixture source'), 'fixture source').upstreamLineage, 'upstream lineage'), 'Fixture product v1');
});

test('authored records and generated intermediates retain their declared ownership', async t => {
  const context = await fixture(t), path = resolve(context.source, 'manifest.json');
  const manifest = await read(path), inputs = requireArray(manifest.inputs, 'fixture inputs');
  const observation = requireEntry(requireValue(inputs[0], 'fixture observation'), 'fixture observation');
  manifest.inputs = inputs.slice(1);
  delete observation.credit; delete observation.acquisition;
  observation.kind = 'authored-document';
  const recipeDocuments = requireArray(manifest.documents);
  manifest.documents = [observation, ...recipeDocuments];
  await writeFile(path, JSON.stringify(manifest));
  assert.equal((await prepareObjectProvenance(context)).sources[0].credit, 'cssEarth contributors');
  manifest.documents = recipeDocuments; manifest.generatedIntermediates = [observation];
  delete observation.kind;
  Object.assign(observation, { generator: 'fixture converter', credit: 'Fixture archive; conversion by fixture author' });
  await writeFile(path, JSON.stringify(manifest));
  const source = (await prepareObjectProvenance(context)).sources[0];
  assert.equal(source.kind, 'generated-intermediate');
  assert.equal(source.acquisition, 'fixture converter');
  assert.equal(source.credit, requireString(observation.credit, 'fixture intermediate credit'));
});

test('changed output bytes invalidate a prepared record', async t => {
  const context = await fixture(t);
  await writeFile(resolve(context.publicDirectory, 'surface@2x.webp'), 'different output');
  await assert.rejects(prepareObjectProvenance(context), /identity mismatch.*surface@2x\.webp/u);
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
  assert.equal(requireValue(recovered.sources[0], 'recovered fixture source').verification, 'manifest-pin');
  assert.throws(() => validateObjectProvenance({ ...recovered, basis: 'prepared' }), /unverified source/u);
});

test('invalid source edges and cyclic products are rejected', async t => {
  const document = await prepareObjectProvenance(await fixture(t));
  const invalid = structuredClone(document);
  const invalidProduct = requireValue(invalid.products[0], 'invalid fixture product');
  Reflect.apply(Array.prototype.push, invalidProduct.inputs, ['unknown']);
  assert.throws(() => validateObjectProvenance(invalid), /Unbound/u);
  const cyclicProduct = requireValue(document.products[0], 'cyclic fixture product');
  Reflect.apply(Array.prototype.push, cyclicProduct.parents, ['surface']);
  assert.throws(() => validateObjectProvenance(document), /Cyclic/u);
});

test('an operation must resolve inside its pinned recipe', async t => {
  const document = await prepareObjectProvenance(await fixture(t));
  assert.equal(Reflect.set(requireValue(document.products[0], 'fixture product'), 'selector', '/lenses/999'), true);
  assert.throws(() => validateObjectProvenance(document), /Unbound/u);
});

test('Saturn binds its actual base material and all contributing recipe identities', async () => {
  const document = await prepareObjectProvenance({ objectDirectory: resolve('src/objects/saturn'),
    publicDirectory: resolve('public/scenes/saturn'), basis: 'recovered', write: false });
  for (const id of ['normal', 'ultraviolet', 'methane', 'thermal', 'cross-section']) {
    const sources = productSourceIds(document, id);
    assert.ok(sources.includes('hubble-opal-saturn-2025a-visible'), id);
    assert.ok(sources.includes('cassini-pia21611-polar-map'), id);
    assert.ok(sources.includes('cassini-uvis-alpvir-2006-285-occultation'), id);
    assert.ok(requireValue(document.products.find(product => product.id === id), `Saturn ${id} product`).recipeDependencies.includes('geometry'), id);
  }
  assert.ok(document.recipes.some(recipe => recipe.id === 'rings'));
});

test('Earth globe provenance excludes the retired local noise dataset', async () => {
  const document = await prepareObjectProvenance({ objectDirectory: resolve('src/objects/earth'),
    publicDirectory: resolve('public/scenes/earth'), basis: 'recovered', write: false });
  assert.ok(document.products.some(product => product.id === 'normal'));
  assert.ok(!document.products.some(product => product.id === 'buenos-aires-noise'));
  assert.ok(!document.sources.some(source => source.id.startsWith('buenos-aires-noise')));
  const structure = requireValue(document.products.find(product => product.id === 'cross-section'), 'Earth cross-section product');
  assert.equal(requireString(requireRecord(requireValue(structure.interpretation, 'Earth cross-section interpretation'), 'Earth cross-section interpretation').kind, 'Earth cross-section kind'), 'schematic-interior');
  assert.ok(!productSourceIds(document, structure.id).includes('glad-m35-vsv'));
  const section = requireValue(document.products.find(product => product.id === 'mantle-tomography'), 'Earth mantle tomography product');
  assert.ok(productSourceIds(document, section.id).includes('glad-m35-vsv'));
  assert.equal(requireString(requireRecord(requireValue(section.interpretation, 'Earth mantle tomography interpretation'), 'Earth mantle tomography interpretation').kind, 'Earth mantle tomography kind'), 'seismic-model-with-schematic-layers');
  assert.ok(section.recipeDependencies.includes('mantle-tomography'));
  for (const filename of ['earth-tomography-section@2x.webp', 'earth-tomography-mantle@2x.webp', 'earth-tomography-mantle-poles@2x.webp', 'earth-tomography-legend.png'])
    assert.ok(section.outputs.some(output => output.url.endsWith('/' + filename)), filename);
});

test('spacecraft photographs bind their image, registration, and source-shape dependencies', async () => {
  for (const id of ['itokawa', 'donaldjohanson', 'comet-81p', 'comet-103p', 'comet-9p']) {
    const objectDirectory = resolve('src/objects', id);
    const descriptor = await read(resolve(objectDirectory, 'object.json'));
    const recipeSources = requireArray(requireRecord(requireRecord(descriptor.properties, `${id} properties`).recipe, `${id} recipe`).sources, `${id} recipe sources`);
    const reference = requireEntry(requireValue(recipeSources.map(source => requireEntry(source, `${id} recipe source`)).find(source => source.id === 'terrestrial'), `${id} terrestrial recipe`), `${id} terrestrial recipe`);
    const recipe = await read(resolve(objectDirectory, requireString(reference.path, `${id} terrestrial recipe path`)));
    const document = await prepareObjectProvenance({ objectDirectory,
      publicDirectory: resolve('public/scenes', id), basis: 'recovered', write: false });
    const raster = requireRecord(recipe.raster, `${id} terrestrial raster`), geometry = requireRecord(recipe.geometry, `${id} terrestrial geometry`);
    for (const observationValue of requireArray(raster.surfaceObservations, `${id} surface observations`)) {
      const observation = requireEntry(observationValue, `${id} surface observation`), observationId = requireString(observation.id, `${id} observation id`);
      const product = document.products.find(product => product.id === observationId);
      assert.ok(product, id + '/' + observation.id);
      const sourceIds = new Set(productSourceIds(document, product.id));
      const paths = new Set(document.sources.filter(source => sourceIds.has(source.id)).map(source => source.path));
      const frames = requireArray(observation.frames, `${id} observation frames`).map(frame => requireEntry(frame, `${id} observation frame`));
      for (const frame of frames) {
        for (const key of ['path', 'labelPath', 'controlPath', 'cameraPath', 'originalPath']) {
          if (typeof frame[key] === 'string') assert.ok(paths.has(frame[key]), id + ': ' + frame[key]);
        }
      }
      assert.ok(paths.has(requireString(requireRecord(geometry.radialTerrain, `${id} radial terrain`).path, `${id} radial terrain path`)), id + ': source shape');
      assert.ok(!document.coverage.unresolved.some(gap => requireRecord(gap, `${id} coverage gap`).product === observationId));
    }
  }
});

test('Mercury coverage completion binds all three maps; previews retain their parent lineage', async () => {
  const objectDirectory = resolve('src/objects/mercury');
  const document = await prepareObjectProvenance({ objectDirectory, publicDirectory: resolve('public/scenes/mercury'), basis: 'recovered', write: false });
  assert.deepEqual(new Set(productSourceIds(document, 'enhanced')), new Set([
    'usgs-messenger-enhanced-global-z3', 'usgs-messenger-bdr-global-z3', 'usgs-messenger-topography-z3',
  ]));
  const enhanced = requireValue(document.products.find(product => product.id === 'enhanced'), 'Mercury enhanced product');
  const interpretation = requireRecord(requireValue(enhanced.interpretation, 'Mercury enhanced interpretation'), 'Mercury enhanced interpretation');
  const coverageCompletion = requireRecord(interpretation.coverageCompletion, 'Mercury coverage completion');
  assert.equal(requireBoolean(interpretation.falseColor, 'Mercury enhanced false color'), true);
  assert.equal(requireBoolean(coverageCompletion.directEnhancedColorClaim, 'Mercury direct enhanced color claim'), false);
  assert.equal(coverageCompletion.filledPixelCount, 295167);
  assert.deepEqual(new Set(productSourceIds(document, 'preview:enhanced')), new Set(enhanced.inputs));
  assert.ok(document.sources.some(source => source.path === 'spectrum/mascs-global-area-weighted-mean.json'));
  assert.ok(!document.sources.some(source => /stars\/|maps\/globe.asset|psg.*rif/iu.test(source.path)));
});


test('a generated record is a function of the package alone, whatever copy of itself is on disk', async t => {
  const context = await fixture(t), prepared = await prepareObjectProvenance({ ...context, write: true });
  assert.ok(prepared.lastPreparation, 'a preparation run records that it verified its bytes');
  assert.equal(preparationEvidenceApplies(prepared), true);
  const beside = await prepareObjectProvenance({ ...context, basis: 'recovered', write: false });
  await rm(resolve(context.outputDirectory, 'provenance.json'));
  const alone = await prepareObjectProvenance({ ...context, basis: 'recovered', write: false });
  assert.deepEqual(beside, alone);
  assert.equal(alone.lastPreparation, undefined, 'a view of the manifest claims no run');
  assert.throws(() => recordPreparationEvidence(alone), /byte-verified preparation/);
  assert.throws(() => validateObjectProvenance({ ...prepared, lastPreparation: { ...prepared.lastPreparation, objectId: 'another' } }), /different object/);
});

test('input roles follow recipe consumption and leave unclassified dependencies unknown', async t => {
  const document = await prepareObjectProvenance(await fixture(t));
  assert.deepEqual(productInputRoles(document, 'surface').get('observation'), ['appearance']);
  const surface = document.products.find(p => p.id === 'surface')!;
  const unknown = { ...document, products: document.products.map(p => ({ ...p, inputEvidence: undefined })) };
  assert.deepEqual(productInputRoles(unknown, 'surface').get('observation'), ['unknown']);
  assert.throws(() => validateObjectProvenance({ ...document, products: [{ ...surface, inputEvidence: [{ sourceId: 'not-consumed', role: 'geometry', evidence: 'Invalid link' }] }] }), /consumed input/);
});


test('Gaspra separates its photographic appearance from the source shape in the same product', async () => {
  const document = validateObjectProvenance(await read('src/objects/gaspra/prepared/provenance.json'));
  const roles = productInputRoles(document, 'normal');
  assert.deepEqual(roles.get('gaspra-normal'), ['appearance']);
  assert.deepEqual(roles.get('gaspra-shape'), ['geometry']);
  assert.deepEqual(productInputRoles(document, 'preview:normal'), roles);
});

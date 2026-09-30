import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { bodyLineage } from '@cssearth/bake/objects/lineage';
import { checkLineage, productInputRoles, productSourceIds } from '@cssearth/objects/provenance';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const read = async (path: string): Promise<Record<string, unknown>> => requireRecord(JSON.parse(await readFile(path, 'utf8')), path);
const present = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new TypeError(`${label} is missing.`);
  return value;
};

/** A one-dataset raster body: an observation it reads, an archive entry it does not, and its recipe. */
async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-lineage-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(root, 'source');
  await Promise.all([mkdir(resolve(source, 'preparation'), { recursive: true }), mkdir(resolve(root, 'prepared'))]);
  const pin = (id: string, path: string) => ({ id, path, origin: `https://example.org/${path}`, sourceBinding: { kind: 'local', reason: 'Authored test fixture' },
    credit: 'Fixture archive', license: 'CC0', acquisition: 'Exact fixture input', consumers: ['surfaces'] });
  await Promise.all([
    writeFile(resolve(source, 'preparation/raster.json'), JSON.stringify({ schema: 'cssearth-raster-recipe@2', polesOutput: 'poles-{id}.webp',
      surfaces: [{ id: 'surface', source: 'observation.dat', output: 'surface{suffix}.webp', thumbnail: 'surface-thumbnail.webp', falseColor: false }] })),
    writeFile(resolve(source, 'manifest.json'), JSON.stringify({ schema: 'cssearth-authoritative-sources@3', inputs: [pin('observation', 'observation.dat'), pin('unused', 'unused.dat')],
      documents: [{ path: 'preparation/raster.json' }], generatedIntermediates: [] })),
    writeFile(resolve(root, 'object.json'), JSON.stringify({ id: 'fixture', properties: { recipe: { sources: [{ id: 'raster', path: 'source/preparation/raster.json' }] } } })),
    writeFile(resolve(root, 'prepared/datasets.json'), JSON.stringify({ controls: [{ id: 'surface', label: 'Surface', surfaceUrl: '/scenes/fixture/surface@2x.webp' }] })),
  ]);
  return { root, source, manifestPath: resolve(source, 'manifest.json'), rasterPath: resolve(source, 'preparation/raster.json') };
}

test('a dataset reads only the sources its recipe consumes, without their bytes', async t => {
  const { root } = await fixture(t), lineage = await bodyLineage(root);
  assert.deepEqual(lineage.sources.map(source => source.id), ['observation']);
  assert.deepEqual(productSourceIds(lineage, 'surface'), ['observation']);
  assert.deepEqual(present(lineage.products[0], 'surface').datasetIds, ['surface']);
});

test('controlled photographic inserts bind every consumed photograph alongside the global base', async t => {
  const { root, rasterPath } = await fixture(t), recipe = await read(rasterPath);
  requireRecord(requireArray(recipe.surfaces)[0]).science = { kind: 'terrestrial-observation', detailMosaic: { format: 'controlled-geotiff', consumer: 'surfaces' } };
  await writeFile(rasterPath, JSON.stringify(recipe));
  assert.deepEqual(productSourceIds(await bodyLineage(root), 'surface').sort(), ['observation', 'unused']);
});

test('an acquired file depends on the file it was built from', async t => {
  const { root, source } = await fixture(t);
  await writeFile(resolve(source, 'preparation/acquisition.json'), JSON.stringify({ operations: [
    { kind: 'request-download', path: 'observation.dat', url: 'https://example.org/api', fileSource: 'unused.dat' }] }));
  const lineage = await bodyLineage(root);
  assert.deepEqual(new Set(productSourceIds(lineage, 'surface')), new Set(['observation', 'unused']));
  assert.deepEqual(present(lineage.sources.find(item => item.id === 'observation'), 'observation').dependencies, ['unused']);
});

test('numeric raster lineage resolves companion grids beside its source and its acquisition recipe', async t => {
  const { root, source, manifestPath, rasterPath } = await fixture(t);
  const manifest = await read(manifestPath), inputs = requireArray(manifest.inputs), base = requireRecord(inputs[0]);
  inputs.push({ ...base, id: 'quantity', path: 'science/quantity.tif' }, { ...base, id: 'quality', path: 'science/quality.tif' });
  requireArray(manifest.documents).push({ id: 'grid-recipe', path: 'science/grid.json' });
  await writeFile(manifestPath, JSON.stringify(manifest));
  const raster = await read(rasterPath), surface = requireRecord(requireArray(raster.surfaces)[0]);
  surface.source = 'science/quantity.tif';
  surface.science = { scientific: { path: 'quantity.tif', qualityMasks: [{ path: 'quality.tif' }] } };
  await writeFile(rasterPath, JSON.stringify(raster));
  await writeFile(resolve(source, 'preparation/acquisition.json'), JSON.stringify({ operations: [
    { kind: 'geotiff-grid', path: 'science/quantity.tif', recipePath: 'science/grid.json' }] }));
  const lineage = await bodyLineage(root);
  assert.deepEqual(new Set(productSourceIds(lineage, 'surface')), new Set(['quantity', 'quality', 'grid-recipe']));
  assert.deepEqual(lineage.sources.find(item => item.id === 'quantity')?.dependencies, ['grid-recipe']);
});

test('composition lineage follows the conversion recipe to the native archive', async t => {
  const { root, source, manifestPath } = await fixture(t);
  const recipe = JSON.stringify({ schema: 'cssearth-mapped-composition@1', input: 'unused.dat' });
  await writeFile(resolve(source, 'conversion.json'), recipe);
  const manifest = await read(manifestPath);
  manifest.documents = [...requireArray(manifest.documents), { id: 'conversion', path: 'conversion.json' }];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(resolve(source, 'preparation/acquisition.json'), JSON.stringify({ operations: [
    { kind: 'mapped-composition', path: 'observation.dat', recipePath: 'conversion.json', product: 'surface' }] }));
  const lineage = await bodyLineage(root);
  assert.deepEqual(new Set(productSourceIds(lineage, 'surface')), new Set(['observation', 'conversion', 'unused']));
  assert.deepEqual(present(lineage.sources.find(item => item.id === 'observation'), 'converted grid').dependencies, ['conversion', 'unused']);
  await writeFile(resolve(source, 'conversion.json'), recipe.replace('unused.dat', 'other.dat'));
  await assert.rejects(bodyLineage(root), /not in the source manifest: fixture\/other\.dat/u);
});

test('documents keep their declared credit; authored records credit the project', async t => {
  const { root, manifestPath } = await fixture(t);
  const manifest = await read(manifestPath), inputs = requireArray(manifest.inputs);
  const observation = requireRecord(inputs[0]);
  manifest.inputs = inputs.slice(1);
  delete observation.id; delete observation.credit;
  manifest.documents = [observation, ...requireArray(manifest.documents)];
  await writeFile(manifestPath, JSON.stringify(manifest));
  let lineage = await bodyLineage(root);
  assert.equal(present(lineage.sources[0], 'document').id, 'source-document:observation.dat');
  assert.equal(present(lineage.sources[0], 'document').credit, 'Credit not recorded in source manifest.');
  observation.kind = 'authored-document';
  await writeFile(manifestPath, JSON.stringify(manifest));
  lineage = await bodyLineage(root);
  assert.equal(present(lineage.sources[0], 'document').credit, 'cssEarth contributors');
  Object.assign(observation, { kind: 'provider-label', credit: 'Fixture mission' });
  await writeFile(manifestPath, JSON.stringify(manifest));
  lineage = await bodyLineage(root);
  assert.equal(present(lineage.sources[0], 'document').id, 'provider-label:observation.dat');
  assert.equal(present(lineage.sources[0], 'document').credit, 'Fixture mission');
});

test('input roles follow recipe consumption; unknown edges and cycles are rejected', async t => {
  const lineage = await bodyLineage((await fixture(t)).root), surface = present(lineage.products[0], 'surface');
  assert.deepEqual(productInputRoles(lineage, 'surface').get('observation'), ['appearance']);
  assert.deepEqual(productInputRoles({ ...lineage, products: [{ ...surface, inputEvidence: undefined }] }, 'surface').get('observation'), ['unknown']);
  assert.throws(() => checkLineage({ ...lineage, products: [{ ...surface, inputs: ['unknown'] }] }), /Unknown product input/u);
  assert.throws(() => checkLineage({ ...lineage, products: [{ ...surface, parents: ['surface'] }] }), /Cyclic/u);
  assert.throws(() => checkLineage({ ...lineage, products: [{ ...surface, inputEvidence: [{ sourceId: 'unused', role: 'geometry', evidence: 'Invalid link' }] }] }), /unread source/u);
});

test('spacecraft photographs bind their image, registration and source-shape dependencies', async () => {
  for (const id of ['itokawa', 'donaldjohanson', 'comet-81p', 'comet-103p', 'comet-9p']) {
    const objectDirectory = resolve('src/objects', id), descriptor = await read(resolve(objectDirectory, 'object.json'));
    const reference = present(requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(item => requireRecord(item))
      .find(item => item.id === 'terrestrial'), `${id} terrestrial recipe`);
    const recipe = await read(resolve(objectDirectory, requireString(reference.path)));
    const lineage = await bodyLineage(objectDirectory), shape = requireString(requireRecord(requireRecord(recipe.geometry).radialTerrain).path);
    for (const value of requireArray(requireRecord(recipe.raster).surfaceObservations)) {
      const observation = requireRecord(value), product = lineage.products.find(item => item.id === observation.id);
      assert.ok(product, `${id}/${String(observation.id)}`);
      const ids = new Set(productSourceIds(lineage, product.id));
      const paths = new Set(lineage.sources.filter(source => ids.has(source.id)).map(source => source.path));
      for (const frame of requireArray(observation.frames).map(item => requireRecord(item)))
        for (const key of ['path', 'labelPath', 'controlPath', 'cameraPath', 'originalPath'])
          if (typeof frame[key] === 'string') assert.ok(paths.has(frame[key]), `${id}: ${frame[key]}`);
      assert.ok(paths.has(shape), `${id}: source shape`);
    }
  }
});

test('Mercury native maps bind their reduction recipes and nothing else', async () => {
  const lineage = await bodyLineage(resolve('src/objects/mercury'));
  assert.deepEqual(new Set(productSourceIds(lineage, 'enhanced')), new Set(['usgs-messenger-enhanced-native', 'mercury-native-enhanced-recipe']));
  assert.deepEqual(new Set(productSourceIds(lineage, 'loi')), new Set(['usgs-messenger-loi-native', 'mercury-native-loi-recipe']));
  assert.ok(lineage.sources.some(source => source.path === 'spectrum/mascs-global-area-weighted-mean.json'));
  assert.ok(!lineage.sources.some(source => /stars\/|maps\/globe.asset|psg.*rif/iu.test(source.path)));
});

test('Gaspra separates its photographic appearance from the source shape in the same product', async () => {
  const roles = productInputRoles(await bodyLineage(resolve('src/objects/gaspra')), 'normal');
  assert.deepEqual(roles.get('gaspra-normal'), ['appearance']);
  assert.deepEqual(roles.get('gaspra-shape'), ['geometry']);
});

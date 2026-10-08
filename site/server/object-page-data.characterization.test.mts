import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import * as objectNode from '@cssearth/objects/node';
import { characterizationRuntime } from '../scene/fixtures/characterization-runtime.mts';
import { mkdtemp, mkdir, rm, writeFile, readFile, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRoot } from '../directory/fixtures/objects.mts';
let incomplete = false;
let pageOverride: unknown;
mock.module('@cssearth/objects/node', { namedExports: { ...objectNode, async preparedPageData(directory: string, id: string) { return pageOverride ?? (incomplete ? { schema: 'cssearth-object-page@1', id, assets: {} } : objectNode.preparedPageData(directory, id)); } } });
const { defaultDatasetBank, loadObjectPageData, preparedDatasetIds, readPreparedDatasetBytes, readPreparedObjectBytes } = await import('./object-page-data.mts');

test('page identities are rejected before reading and missing default banks are null', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const read of [defaultDatasetBank, preparedDatasetIds, loadObjectPageData, readPreparedObjectBytes]) {
    await assert.rejects(read('../saturn', root), /Invalid object page identity/);
  }
  assert.equal(await defaultDatasetBank('absent', root), null);
  await assert.rejects(preparedDatasetIds('absent', root), /ENOENT/);
  const directory = join(root, 'src/objects/body/prepared');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'runtime.json'), JSON.stringify({ controls: { settings: { controls: [] }, datasets: { defaultDataset: 'shape', controls: [{ id: 'shape', label: 'Shape' }] } } }));
  assert.equal(await defaultDatasetBank('body', root), null);
  await writeFile(join(directory, 'runtime.json'), JSON.stringify({ controls: { settings: { controls: [] }, datasets: { defaultDataset: 'image', controls: [
    { id: 'shape', label: 'Shape' },
    { id: 'image', label: 'Image', volume: { objectId: 'cloud', datasetId: 'observation', surface: 'surface' } },
  ] } } }));
  assert.equal(await defaultDatasetBank('body', root), 'cloud');
  await writeFile(join(directory, 'runtime.json'), '{');
  await assert.rejects(defaultDatasetBank('body', root), SyntaxError);
});

async function writeBody(root: string, id: string) {
  const directory = join(root, 'src/objects', id, 'prepared');
  await mkdir(directory, { recursive: true });
  const data = { ...characterizationRuntime(), id };
  const descriptor = { schema: 'cssearth-object@2', id, type: 'layered-body', properties: { page: { metadata: { url: 'prepared/page.json' } } }, prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' } };
  await writeFile(join(directory, '../object.json'), JSON.stringify(descriptor));
  await writeFile(join(directory, 'runtime.json'), JSON.stringify(data));
  return { directory, data, descriptor };
}

test('deferred datasets have separate tables while the default has no separate transport', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-datasets-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeBody(root, 'body');
  assert.deepEqual(await preparedDatasetIds('body', root), ['night']);
  const table: unknown = JSON.parse((await readPreparedDatasetBytes('body', 'night', root)).toString('utf8'));
  assert.ok(table && typeof table === 'object' && 'datasetId' in table);
  assert.equal(table.datasetId, 'night');
  await assert.rejects(readPreparedDatasetBytes('body', 'day', root), { name: 'RangeError', message: 'body: dataset day has no transport of its own.' });
});

test('four cached transports survive descriptor changes; a fifth evicts only the oldest', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-cache-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = await writeBody(root, 'first');
  const initial = await readPreparedObjectBytes('first', root);
  await writeFile(join(first.directory, '../object.json'), '{}');
  for (const id of ['second', 'third', 'fourth']) { await writeBody(root, id); await readPreparedObjectBytes(id, root); }
  assert.equal((await readPreparedObjectBytes('first', root)).bytes, initial.bytes);
  await writeBody(root, 'fifth'); await readPreparedObjectBytes('fifth', root);
  await assert.rejects(readPreparedObjectBytes('first', root), { name: 'TypeError', message: 'Unsupported object schema: undefined.' });
});

test('runtime modified time invalidates transports and missing controls have the page diagnostic', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-invalidation-characterization-'));
  t.after(() => { incomplete = false; return rm(root, { recursive: true, force: true }); });
  const body = await writeBody(root, 'body');
  const initial = await readPreparedObjectBytes('body', root);
  const runtimePath = join(body.directory, 'runtime.json');
  const before = await stat(runtimePath);
  await writeFile(runtimePath, JSON.stringify({ ...body.data, camera: { ...body.data.camera, defaultControlYawDegrees: 20 } }));
  await utimes(runtimePath, before.atime, new Date(before.mtimeMs + 2000));
  assert.notDeepEqual((await readPreparedObjectBytes('body', root)).bytes, initial.bytes);
  incomplete = true;
  await assert.rejects(loadObjectPageData('body', root), { name: 'TypeError', message: 'body: incomplete prepared page data.' });
});

test('wrong page and object transport references are refused separately', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-reference-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'src/objects/saturn');
  await mkdir(join(directory, 'prepared'), { recursive: true });
  const original = await readFile(join(projectRoot, 'src/objects/saturn/object.json'), 'utf8');
  const descriptor: unknown = JSON.parse(original);
  assert.ok(descriptor && typeof descriptor === 'object');
  await writeFile(join(directory, 'prepared/runtime.json'), '{}');
  await writeFile(join(directory, 'object.json'), JSON.stringify({ ...descriptor, prepared: { format: 'cssearth-css-object@5', url: 'prepared/wrong.json' }, properties: {} }));
  await assert.rejects(readPreparedObjectBytes('saturn', root), /saturn: invalid prepared page reference/);
  await assert.rejects(loadObjectPageData('saturn', root), /saturn: invalid prepared page reference/);
});


test('page schema and resource validation reject exact malformed reader outputs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'page-validation-characterization-'));
  t.after(() => { pageOverride = undefined; return rm(root, { recursive: true, force: true }); });
  const { data } = await writeBody(root, 'body');
  pageOverride = { schema: 'wrong-page', id: 'body', assets: data.assets, controls: data.controls };
  await assert.rejects(loadObjectPageData('body', root), { name: 'TypeError', message: 'body: incomplete prepared page data.' });
  pageOverride = { schema: 'cssearth-object-page@1', id: 'body', assets: { ...data.assets, pools: null }, controls: data.controls };
  await assert.rejects(loadObjectPageData('body', root), { name: 'TypeError', message: 'Prepared data: resource pools must be an array.' });
});

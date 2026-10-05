import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseObjectDescriptor } from '@cssearth/objects';
import { assetOrigin, assetHashSplit, assetShaMap, preparedAssetOriginFor, resolveBuildSceneAddress, resolveSceneAddressesDeep, resolveWorldBillboards, rewriteSceneCss, withPreparedAssetOrigin } from './asset-origin.mts';

test('origins trim whitespace but reject paths, uppercase hosts and non-loopback http', () => {
  for (const value of [undefined, '', '  ']) assert.equal(assetOrigin({ ASSET_ORIGIN: value }), null);
  assert.equal(assetOrigin({ ASSET_ORIGIN: ' https://assets.test ' }), 'https://assets.test');
  assert.equal(assetOrigin({ ASSET_ORIGIN: 'http://127.0.0.1:4210' }), 'http://127.0.0.1:4210');
  for (const value of ['https://assets.test/', 'https://Assets.test', 'http://localhost:4210', 'https://assets.test:443']) {
    assert.throws(() => assetOrigin({ ASSET_ORIGIN: value }), /ASSET_ORIGIN must be an https URL/);
  }
});

test('origin rewrites recurse through values and CSS and attach published descriptor metadata', async t => {
  const root = await mkdtemp(join(tmpdir(), 'asset-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const prior = process.env.ASSET_ORIGIN;
  t.after(() => { if (prior === undefined) delete process.env.ASSET_ORIGIN; else process.env.ASSET_ORIGIN = prior; });
  const directory = join(root, 'src/objects/body');
  await mkdir(join(directory, 'prepared'), { recursive: true });
  const digest = 'a'.repeat(64), other = 'b'.repeat(64);
  await writeFile(join(directory, 'inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1', assets: [
    { location: 'public', filename: 'start.webp', bytes: 1, sha256: digest },
    { location: 'public', filename: 'other.webp', bytes: 1, sha256: other },
  ] }));
  await writeFile(join(directory, 'prepared/runtime.json'), JSON.stringify({ assets: { startup: ['start'], entries: [
    { key: 'start', url: '/scenes/body/start.webp' }, { key: 'dataset:other', url: '/scenes/body/other.webp' },
    { key: 'external', url: 'https://external.test/file.webp' },
  ] } }));
  const descriptor = parseObjectDescriptor({ schema: 'cssearth-object@2', id: 'body', type: 'layered-body', properties: {} });
  delete process.env.ASSET_ORIGIN;
  assert.equal(await withPreparedAssetOrigin(descriptor, root), descriptor);
  assert.equal(await preparedAssetOriginFor('body', root), undefined);
  const value = { list: ['/scenes/body/start.webp', 'unchanged', null, 4, false], nested: { image: '/scenes/body/other.webp' } };
  assert.equal(await resolveSceneAddressesDeep(value, root), value);
  assert.equal(await rewriteSceneCss('u{background:url(/scenes/body/start.webp)}', root), 'u{background:url(/scenes/body/start.webp)}');
  process.env.ASSET_ORIGIN = 'https://assets.test';
  const start = `https://assets.test/runtime-assets/${digest}/start.webp`;
  const next = `https://assets.test/runtime-assets/${other}/other.webp`;
  assert.equal(await resolveBuildSceneAddress('/elsewhere/file.webp', root), '/elsewhere/file.webp');
  assert.equal(await resolveBuildSceneAddress('/scenes/body/start.webp', root), start);
  assert.deepEqual(await resolveSceneAddressesDeep(value, root), { list: [start, 'unchanged', null, 4, false], nested: { image: next } });
  assert.equal(await rewriteSceneCss(`u{background:url(\n '/scenes/body/start.webp'\n)} i{background:url(/scenes/body/other.webp)}`, root), `u{background:url('${start}')} i{background:url(${next})}`);
  assert.equal(await rewriteSceneCss('u{color:red}', root), 'u{color:red}');
  assert.deepEqual(await preparedAssetOriginFor('body', root, { every: true }), { origin: 'https://assets.test', assets: { 'start.webp': digest, 'other.webp': other } });
  assert.deepEqual(await preparedAssetOriginFor('body', root, { addresses: ['/scenes/body/other.webp', 'ignored', '/scenes/body/missing.webp'] }), {
    origin: 'https://assets.test', assets: { 'start.webp': digest, 'other.webp': other }, groups: '/objects/body/asset-hashes/',
  });
  assert.deepEqual((await withPreparedAssetOrigin(descriptor, root)).properties.assetOrigin, {
    origin: 'https://assets.test', assets: { 'start.webp': digest }, groups: '/objects/body/asset-hashes/',
  });
  await assert.rejects(resolveWorldBillboards('{"bodies":{"id":["body"],"billboard":[]}}', root), /equal length/);
  assert.deepEqual(await assetHashSplit('absent', root), { embedded: {}, groups: new Map() });
  assert.deepEqual(await assetShaMap('absent', root), {});
});

test('malformed resources and unpublished startup resources identify their owning body', async t => {
  const root = await mkdtemp(join(tmpdir(), 'asset-invalid-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [id, runtime, message] of [
    ['bad', { assets: { entries: [null] } }, /bad: prepared resource entry is invalid/],
    ['missing', { assets: { startup: ['surface'], entries: [{ key: 'surface', url: '/scenes/missing/absent.webp' }] } }, /missing: resource surface names absent.webp/],
  ] as const) {
    const directory = join(root, 'src/objects', id, 'prepared');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'runtime.json'), JSON.stringify(runtime));
    await assert.rejects(assetHashSplit(id, root), message);
  }
});

test('filesystem errors are propagated and empty runtime shapes have empty resource groups', async t => {
  const root = await mkdtemp(join(tmpdir(), 'asset-read-errors-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/objects/bad-inventory/inventory.json'), { recursive: true });
  await assert.rejects(assetShaMap('bad-inventory', root), { code: 'EISDIR' });
  await mkdir(join(root, 'src/objects/bad-runtime/prepared/runtime.json'), { recursive: true });
  await assert.rejects(assetHashSplit('bad-runtime', root), { code: 'EISDIR' });
  for (const [id, value] of [['scalar', 3], ['empty', {}], ['null', null]] as const) {
    const directory = join(root, 'src/objects', id, 'prepared');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'runtime.json'), JSON.stringify(value));
    assert.deepEqual(await assetHashSplit(id, root), { embedded: {}, groups: new Map() });
  }
});

test('resource entries already embedded by markup stay out of deferred groups', async t => {
  const root = await mkdtemp(join(tmpdir(), 'asset-embedded-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'src/objects/body/prepared');
  await mkdir(directory, { recursive: true });
  const digest = 'c'.repeat(64);
  await writeFile(join(directory, '../inventory.json'), JSON.stringify({ schema: 'cssearth-inventory@1', assets: [{ location: 'public', filename: 'shared.webp', bytes: 1, sha256: digest }] }));
  await writeFile(join(directory, 'runtime.json'), JSON.stringify({ markup: 'url(/scenes/body/shared.webp)', assets: { entries: [{ key: 'dataset:night', url: '/scenes/body/shared.webp' }], startup: [] } }));
  const split = await assetHashSplit('body', root);
  assert.deepEqual(split.embedded, { 'shared.webp': digest });
  assert.deepEqual([...split.groups], []);
});

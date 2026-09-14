import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { runtimeAssets, setupObjectIds } from './runtime-assets.mts';
import { installRuntimeAssets } from './setup.mts';
import { assembleRuntimeAssetClosure, validateRuntimeAssetManifest, verifyRuntimeAssetClosure } from '../src/platform/runtime-asset-closure.mts';

const bytes = Buffer.from('prepared fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = { schema: 'csscontext-fixture-runtime-assets@1', resourceRoot: 'prepared', assets: [{ filename: 'levels/catalogue.json', bytes: bytes.length, sha256 }] };

test('nested asset paths require prepared resources and reject every unsafe component', () => {
  assert.equal(validateRuntimeAssetManifest('context-fixture', manifest), true);
  assert.throws(() => validateRuntimeAssetManifest('context-fixture', { ...manifest, resourceRoot: undefined }));
  assert.throws(() => validateRuntimeAssetManifest('context-fixture', { ...manifest, resourceRoot: '../prepared' }));
  assert.throws(() => validateRuntimeAssetManifest('context-fixture', { ...manifest, assets: [{ ...manifest.assets[0], location: 'other' }] }));
  assert.throws(() => validateRuntimeAssetManifest('context-fixture', { ...manifest, resourceRoot: undefined, assets: [{ ...manifest.assets[0], filename: 'flat.json', location: 'public' }] }));
  for (const filename of ['', '../outside', '/absolute', 'levels/../outside', 'levels/./file', 'levels//file', 'levels/', 'levels\\file', 'levels/%2e%2e/file', 'levels/file?x', 'levels/file#x']) {
    assert.throws(() => validateRuntimeAssetManifest('context-fixture', { ...manifest, assets: [{ ...manifest.assets[0], filename }] }), filename);
  }
});

test('explicit context setup uses prepared paths and hash URLs without changing default scenes', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'context-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = resolve(root, 'src/objects/context-fixture');
  await mkdir(resolve(base, 'prepared/levels'), { recursive: true });
  const serialized = JSON.stringify(manifest) + '\n';
  await writeFile(resolve(base, 'runtime-assets.json'), serialized);
  await writeFile(resolve(base, 'prepared/runtime-assets.json'), serialized);
  await writeFile(resolve(base, 'prepared/levels/catalogue.json'), bytes);
  assert.deepEqual(setupObjectIds(['--object=context-fixture'], root), ['context-fixture']);
  assert(!setupObjectIds([], root).includes('context-fixture'));
  assert.throws(() => setupObjectIds(['--object=../context-fixture'], root));
  assert.throws(() => setupObjectIds(['--object=missing-fixture'], root));
  const [asset] = await runtimeAssets(root, ['context-fixture']);
  assert.equal(asset!.file, resolve(base, 'prepared/levels/catalogue.json'));
  assert.equal(asset!.key, `runtime-assets/${sha256}/levels/catalogue.json`);
  await rm(resolve(base, 'prepared/levels'), { recursive: true });
  assert.deepEqual(await installRuntimeAssets([asset!], { fetcher: async url => {
    assert.equal(String(url), asset!.url);
    return new Response(bytes);
  } }), { installed: 1, reused: 0 });
  assert.deepEqual(await installRuntimeAssets([asset!], { fetcher: async () => { throw new Error('Expected prepared file reuse'); } }), { installed: 0, reused: 1 });
  await writeFile(resolve(base, 'prepared/runtime-assets.json'), serialized + ' ');
  await assert.rejects(runtimeAssets(root, ['context-fixture']), /mirrors differ/);
  await rm(resolve(base, 'prepared/runtime-assets.json'));
  await verifyRuntimeAssetClosure({ planetId: 'context-fixture', manifest: { ...manifest, resourceRoot: 'prepared' }, root: resolve(base, 'prepared') });
  await rm(resolve(base, 'prepared/levels'), { recursive: true });
  await symlink(resolve(root), resolve(base, 'prepared/levels'));
  await assert.rejects(runtimeAssets(root, ['context-fixture']), /symbolic link/);
});


test('prepared resources install public dataset previews under their declared public location', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'preview-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = resolve(root, 'src/objects/context-fixture');
  await mkdir(resolve(base, 'prepared'), { recursive: true });
  const mixed = { ...manifest, assets: [...manifest.assets, { filename: 'datasets/preview.webp', location: 'public', bytes: bytes.length, sha256 }] };
  for (const path of ['runtime-assets.json', 'prepared/runtime-assets.json']) await writeFile(resolve(base, path), JSON.stringify(mixed));
  const assets = await runtimeAssets(root, ['context-fixture']);
  assert.equal(assets[1]!.file, resolve(root, 'public/scenes/context-fixture/datasets/preview.webp'));
  assert.deepEqual(await installRuntimeAssets(assets, { fetcher: async () => new Response(bytes) }), { installed: 2, reused: 0 });
  const typedManifest = { ...manifest, resourceRoot: 'prepared' as const, assets: [...manifest.assets, { filename: 'datasets/preview.webp', location: 'public' as const, bytes: bytes.length, sha256 }] };
  const preparedRoot = resolve(base, 'prepared'), publicRoot = resolve(root, 'public/scenes/context-fixture');
  await writeFile(resolve(preparedRoot, 'manifest.json'), 'preparation receipt');
  await assert.rejects(assembleRuntimeAssetClosure({ planetId: 'context-fixture', manifestPath: resolve(base, 'runtime-assets.json'), productionRoot: preparedRoot }), /cannot be assembled/);
  assert.equal(await readFile(resolve(preparedRoot, 'manifest.json'), 'utf8'), 'preparation receipt');
  assert.equal(await readFile(resolve(preparedRoot, 'runtime-assets.json'), 'utf8'), JSON.stringify(mixed));
  await assert.rejects(verifyRuntimeAssetClosure({ planetId: 'context-fixture', manifest: typedManifest, root: preparedRoot }), /explicit publicRoot/);
  assert.equal(await verifyRuntimeAssetClosure({ planetId: 'context-fixture', manifest: typedManifest, root: preparedRoot, publicRoot }), true);
  await writeFile(resolve(publicRoot, 'datasets/preview.webp'), 'drifted public preview');
  await assert.rejects(verifyRuntimeAssetClosure({ planetId: 'context-fixture', manifest: typedManifest, root: preparedRoot, publicRoot }), /runtime asset drifted/);
  await writeFile(resolve(publicRoot, 'datasets/preview.webp'), bytes);
  await writeFile(resolve(preparedRoot, 'undeclared.json'), 'unexpected');
  await assert.rejects(verifyRuntimeAssetClosure({ planetId: 'context-fixture', manifest: typedManifest, root: preparedRoot, publicRoot }), /Undeclared: undeclared.json/);
  assert.equal(await readFile(resolve(preparedRoot, 'undeclared.json'), 'utf8'), 'unexpected');
  await rm(resolve(preparedRoot, 'undeclared.json'));
  assert.deepEqual(await installRuntimeAssets(assets, { fetcher: async () => { throw new Error('Expected reuse'); } }), { installed: 0, reused: 2 });
});

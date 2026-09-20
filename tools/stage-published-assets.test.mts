import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { sha256 } from '../src/platform/sha256.mts';
import { stagePublishedAssets } from './stage-published-assets.mts';

const objectId = 'fixture';
const base = `src/objects/${objectId}`;
const inventoryPath = `${base}/prepared-assets.json`;
const assetPath = `${base}/prepared/levels/data.json`;
const bytes = Buffer.from('{"prepared":true}');
const manifest = { schema: 'cssfixture-prepared-assets@1', resourceRoot: 'prepared',
  assets: [{ filename: 'levels/data.json', bytes: bytes.length, sha256: sha256(bytes) }] };

async function put(root: string, path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(resolve(root, path)), { recursive: true });
  await writeFile(resolve(root, path), content);
}

async function fixture(t: TestContext) {
  const directory = await mkdtemp(resolve(tmpdir(), 'stage-assets-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { root: resolve(directory, 'trusted'), artifactRoot: resolve(directory, 'artifact'),
    sourceRoot: resolve(directory, 'pr'), objectId };
  for (const root of [options.root, options.artifactRoot, options.sourceRoot]) await mkdir(root, { recursive: true });
  for (const root of [options.artifactRoot, options.sourceRoot]) await put(root, inventoryPath, JSON.stringify(manifest));
  await put(options.artifactRoot, assetPath, bytes);
  await put(options.root, 'tools/publish-runtime-assets.mts', 'trusted publisher');
  return options;
}

test('stages pinned nested bytes and inventories without importing arbitrary artifact code', async t => {
  const options = await fixture(t);
  await put(options.artifactRoot, 'tools/publish-runtime-assets.mts', 'untrusted replacement');
  await put(options.artifactRoot, 'package.json', '{"scripts":{"postinstall":"malicious"}}');
  await put(options.root, `${base}/runtime-assets.json`, 'stale inventory from main');
  assert.equal(await stagePublishedAssets(options), 1);
  assert.deepEqual(await readFile(resolve(options.root, assetPath)), bytes);
  assert.equal(await readFile(resolve(options.root, inventoryPath), 'utf8'), JSON.stringify(manifest));
  assert.equal(await readFile(resolve(options.root, 'tools/publish-runtime-assets.mts'), 'utf8'), 'trusted publisher');
  await assert.rejects(readFile(resolve(options.root, 'package.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(resolve(options.root, `${base}/runtime-assets.json`)), { code: 'ENOENT' });
});

test('stages runtime public assets as well as prepared bytes', async t => {
  const options = await fixture(t);
  const runtime = { schema: 'cssfixture-runtime-assets@1', assets: [{ ...manifest.assets[0], filename: 'surface.webp' }] };
  for (const root of [options.artifactRoot, options.sourceRoot]) await put(root, `${base}/runtime-assets.json`, JSON.stringify(runtime));
  await put(options.artifactRoot, 'public/scenes/fixture/surface.webp', bytes);
  assert.equal(await stagePublishedAssets(options), 2);
  assert.deepEqual(await readFile(resolve(options.root, 'public/scenes/fixture/surface.webp')), bytes);
});

test('rejects a bake runner replacing the frozen inventory, even with matching new hashes', async t => {
  const options = await fixture(t);
  const replacement = Buffer.from('hostile bytes');
  await put(options.artifactRoot, assetPath, replacement);
  await put(options.artifactRoot, inventoryPath, JSON.stringify({ ...manifest,
    assets: [{ ...manifest.assets[0], bytes: replacement.length, sha256: sha256(replacement) }] }));
  await assert.rejects(stagePublishedAssets(options), /inventory differs from the PR commit/);
  await assert.rejects(readFile(resolve(options.root, inventoryPath)), { code: 'ENOENT' });
});

test('rejects missing or extra inventories and changed file bytes before mutating the checkout', async t => {
  for (const mutation of ['missing', 'extra', 'bytes'] as const) {
    await t.test(mutation, async child => {
      const options = await fixture(child);
      if (mutation === 'missing') await rm(resolve(options.artifactRoot, inventoryPath));
      if (mutation === 'extra') await put(options.artifactRoot, `${base}/runtime-assets.json`, '{}');
      if (mutation === 'bytes') await put(options.artifactRoot, assetPath, 'changed');
      await assert.rejects(stagePublishedAssets(options), /differs|differ/);
      await assert.rejects(readFile(resolve(options.root, inventoryPath)), { code: 'ENOENT' });
    });
  }
});

test('rejects traversal in committed inventories and object ids', async t => {
  const options = await fixture(t);
  for (const root of [options.artifactRoot, options.sourceRoot]) await put(root, inventoryPath,
    JSON.stringify({ ...manifest, assets: [{ ...manifest.assets[0], filename: '../../../../tools/publish-runtime-assets.mts' }] }));
  await assert.rejects(stagePublishedAssets(options), /invalid runtime asset entry/);
  await assert.rejects(stagePublishedAssets({ ...options, objectId: '../other' }), /Unsafe object id/);
});

test('rejects source, artifact, and destination links without following them', async t => {
  for (const location of ['sourceRoot', 'artifactRoot', 'root'] as const) {
    await t.test(location, async child => {
      const options = await fixture(child);
      const path = location === 'root' ? assetPath : inventoryPath;
      await mkdir(dirname(resolve(options[location], path)), { recursive: true });
      await rm(resolve(options[location], path), { force: true });
      await symlink(resolve(options.root, 'tools/publish-runtime-assets.mts'), resolve(options[location], path));
      await assert.rejects(stagePublishedAssets(options), /regular files and directories/);
      assert.equal(await readFile(resolve(options.root, 'tools/publish-runtime-assets.mts'), 'utf8'), 'trusted publisher');
    });
  }
  await t.test('artifact parent directory', async child => {
    const options = await fixture(child);
    await rm(resolve(options.artifactRoot, `${base}/prepared`), { recursive: true });
    await symlink(options.sourceRoot, resolve(options.artifactRoot, `${base}/prepared`));
    await assert.rejects(stagePublishedAssets(options), /regular files and directories/);
  });
});

test('rejects an empty publication instead of reporting success', async t => {
  const options = await fixture(t);
  for (const root of [options.artifactRoot, options.sourceRoot]) await rm(resolve(root, inventoryPath));
  await assert.rejects(stagePublishedAssets(options), /No committed assets/);
});

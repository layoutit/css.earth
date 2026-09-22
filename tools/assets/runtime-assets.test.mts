import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { inventoriedObjectIds, inventoryAssets } from './runtime-assets.mts';
import { installRuntimeAssets } from './setup.mts';


const bytes = Buffer.from('prepared fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const inventory = { schema: 'cssearth-inventory@1', assets: [
  { location: 'public', filename: 'datasets/preview.webp', bytes: bytes.length, sha256 },
  { location: 'prepared', filename: 'levels/catalogue.json', bytes: bytes.length, sha256 }] };

test('objects are discovered by their inventory; each entry is located by its location and served by its hash', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'inventory-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = resolve(root, 'src/objects/context-fixture');
  await mkdir(resolve(base, 'prepared/levels'), { recursive: true });
  await mkdir(resolve(root, 'src/objects/no-inventory'), { recursive: true });
  await writeFile(resolve(base, 'inventory.json'), JSON.stringify(inventory));
  await writeFile(resolve(base, 'prepared/levels/catalogue.json'), bytes);
  assert.deepEqual(inventoriedObjectIds([], root), ['context-fixture']);
  assert.deepEqual(inventoriedObjectIds(['--object=context-fixture'], root), ['context-fixture']);
  assert.throws(() => inventoriedObjectIds(['--object=../context-fixture'], root));
  assert.throws(() => inventoriedObjectIds(['--object=no-inventory'], root), /inventory\.json/);
  const assets = await inventoryAssets(root, ['context-fixture']);
  assert.deepEqual(assets.map(asset => [asset.location, asset.file, asset.key]), [
    ['public', resolve(root, 'public/scenes/context-fixture/datasets/preview.webp'), `runtime-assets/${sha256}/datasets/preview.webp`],
    ['prepared', resolve(base, 'prepared/levels/catalogue.json'), `runtime-assets/${sha256}/levels/catalogue.json`]]);
  assert.deepEqual((await inventoryAssets(root, ['context-fixture'], { location: 'prepared' })).map(asset => asset.filename), ['levels/catalogue.json']);
  assert.deepEqual((await inventoryAssets(root, ['context-fixture'], { filenames: ['datasets/preview.webp'] })).map(asset => asset.filename), ['datasets/preview.webp']);
  // Restore downloads what is missing, reuses what matches, and restores under the entry's location.
  assert.deepEqual(await installRuntimeAssets(assets, { fetcher: async url => { assert.ok(assets.some(asset => asset.url === String(url))); return new Response(bytes); } }), { installed: 1, reused: 1, skipped: 0 });
  assert.deepEqual(await readFile(resolve(root, 'public/scenes/context-fixture/datasets/preview.webp')), bytes);
  assert.deepEqual(await installRuntimeAssets(assets, { fetcher: async () => { throw new Error('Expected reuse'); } }), { installed: 0, reused: 2, skipped: 0 });
  // Existing symlinks must never redirect installation.
  await rm(resolve(base, 'prepared/levels'), { recursive: true });
  await symlink(resolve(root), resolve(base, 'prepared/levels'));
  await assert.rejects(inventoryAssets(root, ['context-fixture']), /symbolic link/);
});

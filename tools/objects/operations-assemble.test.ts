import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assembleRuntimeAssets } from './runtime-assets.js';
const test = sourceTest();

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('assembly reads the object inventory once and prunes build leftovers', async () => {
  const productionRoot = await mkdtemp(join(tmpdir(), 'cssearth-assemble-'));
  try {
    const texture = Buffer.from('texture'), leftover = Buffer.from('leftover');
    await writeFile(join(productionRoot, 'fixture-surface@2x.webp'), texture);
    await writeFile(join(productionRoot, 'fixture-unused@2x.webp'), leftover);
    const inventory = { schema: 'cssearth-inventory@1', assets: [
      { location: 'public', filename: 'fixture-surface@2x.webp', bytes: texture.length, sha256: sha256(texture) },
    ] };
    const manifest = await assembleRuntimeAssets({ id: 'fixture', inventory, productionRoot });
    assert.deepEqual(manifest.assets.map(asset => asset.filename), ['fixture-surface@2x.webp']);
    assert.deepEqual(await readdir(productionRoot), ['fixture-surface@2x.webp']);
    await assert.rejects(assembleRuntimeAssets({ id: 'fixture', inventory: { assets: inventory.assets }, productionRoot }),
      /fixture inventory is incompatible/);
  } finally {
    await rm(productionRoot, { recursive: true, force: true });
  }
});

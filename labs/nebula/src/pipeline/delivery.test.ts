import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deliveryReady } from './delivery.js';
import { hash, writeAtomic } from './io.js';

test('app preparation rebuilds absent textures and rejects changed textures or reference metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-delivery-'));
  try {
    const texture = 'prepared/test/slices/x/00.webp', metadata = 'object.json';
    const manifest = JSON.stringify({ schema: 'cssearth-volume-lens-manifest@1', outputs: {
      [texture]: { sha256: hash('pixels'), bytes: 6 }, [metadata]: { sha256: hash('{}'), bytes: 2 },
    } });
    const delivery = { directory: 'object', manifest: { path: 'manifest.json', sha256: hash(manifest) } };
    await writeAtomic(join(root, 'manifest.json'), manifest);
    await writeAtomic(join(root, 'object', metadata), '{}');
    assert.equal(await deliveryReady(root, delivery), false);
    await writeAtomic(join(root, 'object', texture), 'pixels');
    assert.equal(await deliveryReady(root, delivery), true);
    await writeAtomic(join(root, 'object', texture), 'broken');
    await assert.rejects(deliveryReady(root, delivery), /Input hash differs/);
    await writeAtomic(join(root, 'object', texture), 'pixels');
    await writeAtomic(join(root, 'object', metadata), '{"changed":true}');
    await assert.rejects(deliveryReady(root, delivery), /Input hash differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

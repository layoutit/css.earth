import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deliveryReady } from './delivery.ts';
import { hash, writeAtomic } from './io.ts';

for (const texture of ['prepared/test/slices/x/00.webp', 'prepared/test/atlases/x.webp']) {
test(`app preparation rebuilds missing ${texture} and rejects changed textures or reference metadata`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-delivery-'));
  try {
    const metadata = 'object.json';
    const manifest = JSON.stringify({ schema: 'cssearth-volume-lens-manifest@1', outputs: {
      [texture]: { sha256: hash('pixels'), bytes: 6 }, [metadata]: { sha256: hash('{}'), bytes: 2 },
    } });
    const delivery = { directory: 'object', manifest: { path: 'manifest.json', sha256: hash(manifest) } };
    await writeAtomic(join(root, 'manifest.json'), manifest);
    await writeAtomic(join(root, 'object', metadata), '{}');
    assert.equal(await deliveryReady(root, delivery), false);
    await writeAtomic(join(root, 'object', texture), 'pixels');
    assert.equal(await deliveryReady(root, delivery), true);
    await writeAtomic(join(root, 'object', texture), 'broken!');
    await assert.rejects(deliveryReady(root, delivery), /Artifact size differs/);
    await writeAtomic(join(root, 'object', texture), 'pixels');
    await writeAtomic(join(root, 'object', metadata), '{"changed":true}');
    await assert.rejects(deliveryReady(root, delivery), /Artifact size differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
}

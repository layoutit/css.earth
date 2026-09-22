import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hash, writeAtomic } from '../../server/workflows/density/io.ts';
import { availableOverlayVariants } from './available-overlay-variants.js';
import { overlayVariantsPath } from './overlay-variants.js';

test('a clean lab offers originals until valid extracted previews exist', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-available-'));
  try {
    const row = { imageId: 'test', originalTextureSha256: 'a'.repeat(64), sourceSha256: 'b'.repeat(64), receiptPath: 'receipts/test.json',
      layers: [
        { id: 'diffuse', label: 'Without stars', texturePath: 'prepared/diffuse.webp', widthPx: 200, heightPx: 100, sha256: hash('pixels') },
        { id: 'stars', label: 'Residual', texturePath: 'prepared/stars.webp', widthPx: 200, heightPx: 100, sha256: hash('residual') },
      ] };
    await writeAtomic(join(root, overlayVariantsPath), JSON.stringify({ schema: 'cssearth-nebula-overlay-variants@1', variants: [row] }));
    assert.deepEqual((await availableOverlayVariants(root)).variants, []);
    await writeAtomic(join(root, 'prepared/diffuse.webp'), 'pixels');
    assert.deepEqual((await availableOverlayVariants(root)).variants, [{ ...row, layers: [row.layers[0]] }]);
    await writeAtomic(join(root, 'prepared/diffuse.webp'), 'broken');
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareAtlasRows } from './atlas-rows.mts';

test('streamed rows preserve every RGBA texel and the scaled frame addresses', async () => {
  const root = await mkdtemp(join(tmpdir(), 'material-rows-'));
  try {
    const width = 14, height = 8, rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba.set([i % 251, (i * 3) % 251, (i * 7) % 251, 128 + i % 128], i);
    await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ lossless: true }).toFile(join(root, 'body-material.webp'));
    const variant = { runtimeAtlas: { assetUrl: '/scenes/body/body-material.webp' }, presentations: Array.from({ length: 6 }, (_, frameIndex) => ({
      frameIndex, rowIndex: Math.floor(frameIndex / 3), backgroundSize: '28px 16px',
      backgroundPosition: `${-2 - frameIndex % 3 * 8}px ${-2 - Math.floor(frameIndex / 3) * 8}px`,
    })) };
    const bank = await prepareAtlasRows({ variant, resource: 'lighting:normal', publicDirectory: root });
    assert.equal(bank.entries.length, 2);
    for (let row = 0; row < 2; row++) {
      const expected = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract({ left: 0, top: row * 4, width: 12, height: 4 }).raw().toBuffer();
      const actual = await sharp(join(root, `body-material-stream-row-${String(row).padStart(2, '0')}.webp`)).ensureAlpha().raw().toBuffer();
      assert.ok(actual.equals(expected), 'RGBA including translucent edge pixels must remain exact');
    }
    assert.deepEqual(bank.frames[4], { resource: 'lighting:normal:row:1', frame: 4, row: 1, backgroundPosition: '-10px -2px', backgroundSize: '24px 8px' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

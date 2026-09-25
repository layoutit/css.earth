import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareAtlasRows, prepareAtlasStill } from './atlas-rows.mts';

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
    // At native size a one-tile box draws the same texels: every length at the atlas's own pixels, the declared scale returned.
    const native = await prepareAtlasRows({ variant, resource: 'lighting:normal', publicDirectory: root, native: true });
    assert.equal(native.presentationScale, 2);
    assert.deepEqual(native.frames[4], { resource: 'lighting:normal:row:1', frame: 4, row: 1, backgroundPosition: '-5px -1px', backgroundSize: '12px 4px' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a still is one frame's whole cell, gutter included, addressed where the frame sat in its row", async () => {
  const root = await mkdtemp(join(tmpdir(), 'material-still-'));
  try {
    const width = 14, height = 8, rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba.set([i % 251, (i * 3) % 251, (i * 7) % 251, 128 + i % 128], i);
    await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ lossless: true }).toFile(join(root, 'body-material.webp'));
    const variant = { runtimeAtlas: { assetUrl: '/scenes/body/body-material.webp' }, presentations: Array.from({ length: 6 }, (_, frameIndex) => ({
      frameIndex, rowIndex: Math.floor(frameIndex / 3), backgroundSize: '28px 16px',
      backgroundPosition: `${-2 - frameIndex % 3 * 8}px ${-2 - Math.floor(frameIndex / 3) * 8}px`,
    })) };
    const still = await prepareAtlasStill({ variant, resource: 'lighting:normal-no-shadows', publicDirectory: root, frame: 4 });
    assert.deepEqual(still.entry, { key: 'lighting:normal-no-shadows:shadowless', url: '/scenes/body/body-material-shadowless.webp' });
    // Frame 4 is row 1, column 1: its 4 x 4 cell starts at (4, 4) and its tile one texel in, drawn at twice the size.
    assert.deepEqual(still.fixed, { resource: 'lighting:normal-no-shadows:shadowless', frame: 4, row: null, backgroundPosition: '-2px -2px', backgroundSize: '8px 8px' });
    const nativeStill = await prepareAtlasStill({ variant, resource: 'lighting:normal-no-shadows', publicDirectory: root, frame: 4, native: true });
    assert.equal(nativeStill.presentationScale, 2);
    assert.deepEqual(nativeStill.fixed, { resource: 'lighting:normal-no-shadows:shadowless', frame: 4, row: null, backgroundPosition: '-1px -1px', backgroundSize: '4px 4px' });
    const expected = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract({ left: 4, top: 4, width: 4, height: 4 }).raw().toBuffer();
    assert.ok((await sharp(join(root, 'body-material-shadowless.webp')).ensureAlpha().raw().toBuffer()).equals(expected), 'the cell must remain exact');
    await assert.rejects(prepareAtlasStill({ variant, resource: 'lighting:normal', publicDirectory: root, frame: 9 }), /Material frame 9 is not in/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

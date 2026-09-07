import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareByteObservation } from './observed-image.mjs';

test('byte-map coverage preserves dark observations and rolls longitude without mirroring', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-byte-map-'));
  try {
    const path = join(directory, 'source.png');
    await sharp(Buffer.from([0, 1, 90, 180, 20, 30, 40, 50]),
      { raw: { width: 4, height: 2, channels: 1 } }).toColourspace('b-w').png().toFile(path);
    const entry = { id: 'observed', width: 4, height: 2 };
    const normal = await prepareByteObservation(path, entry, { noData: 0, centerLongitude: 180 }, 4, 2);
    assert.deepEqual([...normal.missing], [1, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(normal.rgb[3], 1);
    const shifted = await prepareByteObservation(path, entry, { noData: 0, centerLongitude: 0 }, 4, 2);
    assert.deepEqual([...shifted.missing], [0, 0, 1, 0, 0, 0, 0, 0]);
    assert.deepEqual([...shifted.rgb].filter((_, i) => i % 3 === 0), [90, 180, 0, 1, 40, 50, 20, 30]);
    assert.equal(normal.sourceMissingPixels, 1);
    const unmasked = await prepareByteObservation(path, entry, { noData: null, centerLongitude: 180 }, 4, 2);
    assert.equal(unmasked.sourceMissingPixels, 0);
    assert.equal(unmasked.rgb[0], 0, 'Unmasked photographic black is a valid observation');
    const colorPath = join(directory, 'color.png');
    const colors = Buffer.from([0,0,0, 1,20,30, 90,180,20, 30,40,50, 10,11,12, 13,14,15, 16,17,18, 19,20,21]);
    await sharp(colors, {raw:{width:4,height:2,channels:3}}).png().toFile(colorPath);
    const color = await prepareByteObservation(colorPath, entry, {kind:'image-rgb-no-data',noData:null,centerLongitude:180},4,2);
    assert.deepEqual(color.rgb, colors, 'RGB ratios and black pixels survive source preparation');
    assert.equal(color.sourceMissingPixels,0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mergedAlpha, mergeOpticalCopies } from './galaxy-merged-copies.mts';

test('a merged alpha is three coincident copies composited, and keeps transparent and opaque fixed', () => {
  assert.equal(mergedAlpha(0), 0); assert.equal(mergedAlpha(255), 255);
  for (const alpha of [1, 13, 64, 128, 200]) assert.equal(mergedAlpha(alpha), Math.round((1 - (1 - alpha / 255) ** 3) * 255));
  assert.ok(mergedAlpha(13) > 13 && mergedAlpha(13) <= 3 * 13);
});

test('merging rewrites every slice alpha in place and leaves color untouched', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'merged-copies-'));
  try {
    const pixels = Buffer.from([10, 20, 30, 0, 40, 50, 60, 13, 70, 80, 90, 128, 100, 110, 120, 255]);
    for (const axis of ['x', 'y', 'z']) {
      mkdirSync(join(directory, axis));
      writeFileSync(join(directory, axis, '000.png'), await sharp(pixels, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer());
    }
    writeFileSync(join(directory, 'x', 'notes.png'), 'not a slice');
    assert.equal(await mergeOpticalCopies(directory), 3);
    for (const axis of ['x', 'y', 'z']) {
      const { data } = await sharp(readFileSync(join(directory, axis, '000.png'))).raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([...data], [10, 20, 30, 0, 40, 50, 60, mergedAlpha(13), 70, 80, 90, mergedAlpha(128), 100, 110, 120, 255]);
    }
    assert.equal(readFileSync(join(directory, 'x', 'notes.png'), 'utf8'), 'not a slice');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

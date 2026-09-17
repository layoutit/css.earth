import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { encodeWebp } from './webp-cache.mts';

const image = () => sharp(Buffer.from(Array.from({ length: 32 * 32 * 4 }, (_, i) => (i * 37) % 256)), { raw: { width: 32, height: 32, channels: 4 } });

test('a cached encode returns the bytes of a direct encode, and a changed option misses the cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'webp-cache-'));
  try {
    const direct = await image().webp({ lossless: true, effort: 6 }).toBuffer();
    assert.deepEqual(await encodeWebp(image(), { lossless: true, effort: 6 }, root), direct);
    assert.deepEqual(await encodeWebp(image(), { lossless: true, effort: 6 }, root), direct);
    assert.deepEqual(await encodeWebp(image(), { quality: 85, effort: 4 }, root), await image().webp({ quality: 85, effort: 4 }).toBuffer());
    const entries = (await Promise.all((await readdir(root)).map(shard => readdir(join(root, shard))))).flat();
    assert.equal(entries.filter(name => name.endsWith('.webp')).length, 2);
    assert.equal(entries.filter(name => name.endsWith('.tmp')).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

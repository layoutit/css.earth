import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { acquireMastProduct, MAST_PRODUCT_URL } from './sky-band-composite.mts';

test('MAST sky product keeps pinned bytes and retries a dropped stream with Range', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'mast-sky-stream-')), body = Buffer.alloc(4096, 5), product = 'sky.fits';
  const ranges: (string | null)[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, `${MAST_PRODUCT_URL}${product}`);
    ranges.push(new Headers(init?.headers).get('range'));
    if (ranges.length > 1) return new Response(new Uint8Array(body.subarray(1024)), { status: 206,
      headers: { 'content-range': 'bytes 1024-4095/4096', 'content-length': '3072' } });
    let chunks = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (chunks++ === 0) controller.enqueue(body.subarray(0, 1024));
      else controller.error(new Error('socket reset'));
    } }), { headers: { 'content-length': '4096', 'accept-ranges': 'bytes' } });
  };
  try {
    assert.deepEqual(await acquireMastProduct(product, root, { bytes: body.length }, fetcher), { bytes: body.length });
    assert.deepEqual(ranges, [null, 'bytes=1024-']);
    assert.deepEqual(await readFile(resolve(root, 'mast', product)), body);
    assert.deepEqual(await readdir(resolve(root, 'mast')), [product]);
    await assert.rejects(acquireMastProduct('short.fits', root, { bytes: 100 }, async () => new Response(new Uint8Array(99))), /expected 100/u);
    await assert.rejects(readFile(resolve(root, 'mast/short.fits')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

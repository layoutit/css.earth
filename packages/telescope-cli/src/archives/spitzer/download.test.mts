import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { download } from './archive.mts';

test('Spitzer retries incomplete bodies by validated Range and reuses acquired bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'spitzer-stream-retry-')), path = resolve(root, 'image.fits'), body = Buffer.alloc(4096, 6);
  const ranges: (string | null)[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    ranges.push(new Headers(init?.headers).get('range'));
    if (ranges.length > 1) return new Response(new Uint8Array(body.subarray(1024)), { status: 206,
      headers: { 'content-range': 'bytes 1024-4095/4096', 'content-length': '3072' } });
    let chunks = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (chunks++ === 0) controller.enqueue(body.subarray(0, 1024));
      else controller.error(new Error('connection reset'));
    } }), { headers: { 'content-length': '4096', 'accept-ranges': 'bytes' } });
  };
  try {
    assert.deepEqual(await download('https://archive.invalid/image.fits', path, fetcher), { bytes: body.length });
    assert.deepEqual(ranges, [null, 'bytes=1024-']);
    assert.deepEqual(await readFile(path), body);
    assert.deepEqual(await readdir(root), ['image.fits']);
    assert.deepEqual(await download('https://archive.invalid/image.fits', path,
      async () => { throw new Error('Acquired file must not download.'); }), { bytes: body.length });
  } finally { await rm(root, { recursive: true, force: true }); }
});

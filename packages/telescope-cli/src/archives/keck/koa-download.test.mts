import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { koaDownload, lev0Url } from './koa.mts';

test('KOA file transfer resumes dropped bytes and preserves a published pinned file', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'koa-stream-retry-')), path = resolve(root, 'image.fits'), body = Buffer.alloc(4096, 3);
  const ranges: (string | null)[] = [];
  const fetcher = async (_url: string, init: RequestInit) => {
    ranges.push(new Headers(init.headers).get('range'));
    if (ranges.length > 1) return new Response(new Uint8Array(body.subarray(1024)), { status: 206,
      headers: { 'content-range': 'bytes 1024-4095/4096', 'content-length': '3072' } });
    let chunks = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (chunks++ === 0) controller.enqueue(body.subarray(0, 1024));
      else controller.error(new Error('ECONNRESET'));
    } }), { headers: { 'content-length': '4096', 'accept-ranges': 'bytes' } });
  };
  try {
    assert.deepEqual(await koaDownload(lev0Url('/image.fits'), path, body.length, body.length, fetcher), { bytes: body.length });
    assert.deepEqual(ranges, [null, 'bytes=1024-']);
    assert.deepEqual(await readFile(path), body);
    assert.deepEqual(await readdir(root), ['image.fits']);
    assert.deepEqual(await koaDownload(lev0Url('/image.fits'), path, body.length, body.length,
      async () => { throw new Error('Pinned file should not download.'); }), { bytes: body.length });
    await assert.rejects(koaDownload(lev0Url('/image.fits'), path, body.length + 1, body.length + 1,
      async () => { throw new Error('Existing file must not be overwritten.'); }), /already exists/u);
    assert.deepEqual(await readFile(path), body);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('KOA refuses an HTML success page, excess bytes and wrong pinned size before publication', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'koa-stream-bound-')), path = resolve(root, 'image.fits');
  try {
    await assert.rejects(koaDownload(lev0Url('/image.fits'), path, undefined, 20,
      async () => new Response('<html>no file</html>', { headers: { 'content-type': 'text/html' } })), /message, not a file/u);
    await assert.rejects(koaDownload(lev0Url('/image.fits'), path, undefined, 20,
      async () => new Response(new Uint8Array(21))), /transfer bound/u);
    await assert.rejects(koaDownload(lev0Url('/image.fits'), path, 20, 20,
      async () => new Response(new Uint8Array(19))), /expected 20/u);
    assert.deepEqual(await readdir(root), []);
    await writeFile(path, 'preserved');
    await assert.rejects(koaDownload(lev0Url('/image.fits'), path, 20, 20), /already exists/u);
    assert.equal(await readFile(path, 'utf8'), 'preserved');
  } finally { await rm(root, { recursive: true, force: true }); }
});

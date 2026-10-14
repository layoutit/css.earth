import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { downloadToolchainArchive } from './download.mts';

test('managed archive download retries by validated range and publishes only complete pinned bytes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'toolchain-stream-')), body = Buffer.alloc(4096, 17), target = resolve(root, 'kit.tar.gz');
  const ranges: (string | null)[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const range = new Headers(init?.headers).get('range'); ranges.push(range);
    if (ranges.length > 1) {
      assert.equal(range, 'bytes=1024-');
      await assert.rejects(readFile(target), { code: 'ENOENT' });
      return new Response(new Uint8Array(body.subarray(1024)), { status: 206,
        headers: { 'content-range': 'bytes 1024-4095/4096', 'content-length': '3072' } });
    }
    let chunks = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (chunks++ === 0) controller.enqueue(body.subarray(0, 1024));
      else controller.error(new Error('socket reset'));
    } }), { headers: { 'accept-ranges': 'bytes', 'content-length': String(body.length) } });
  };
  try {
    assert.equal(await downloadToolchainArchive('https://archive.invalid/kit.tar.gz', target, body.length, fetcher), target);
    assert.deepEqual(ranges, [null, 'bytes=1024-']);
    assert.deepEqual(await readFile(target), body);
    assert.deepEqual(await readdir(root), ['kit.tar.gz']);
    assert.equal(await downloadToolchainArchive('https://archive.invalid/kit.tar.gz', target, body.length,
      async () => { throw new Error('Pinned cache should not download.'); }), target);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('managed archive refuses a complete but wrong-size response and preserves existing files', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'toolchain-pin-')), target = resolve(root, 'kit.tar.gz');
  try {
    await assert.rejects(downloadToolchainArchive('https://archive.invalid/kit.tar.gz', target, 100,
      async () => new Response(new Uint8Array(99))), /expected 100/u);
    assert.deepEqual(await readdir(root), []);
    await writeFile(target, 'preserved');
    await assert.rejects(downloadToolchainArchive('https://archive.invalid/kit.tar.gz', target, 100,
      async () => { throw new Error('Existing files must not download.'); }), /exists but is not/u);
    assert.equal(await readFile(target, 'utf8'), 'preserved');
  } finally { await rm(root, { recursive: true, force: true }); }
});

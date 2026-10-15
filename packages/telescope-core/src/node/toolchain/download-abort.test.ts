import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { downloadHttpFile } from '../http-download.js';

test('install-owned downloads abort pending reads and leave no published or temporary artifact', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'install-download-')), target = resolve(root, 'archive'), controller = new AbortController();
  let reads = 0;
  try {
    await assert.rejects(downloadHttpFile('https://archive.invalid/kit', target, {
      byteLimit: 10, signal: controller.signal,
      fetcher: async () => new Response(new ReadableStream<Uint8Array>({
        pull() { reads++; controller.abort(); return new Promise<void>(() => {}); },
      }, { highWaterMark: 0 })),
    }), { name: 'AbortError' });
    assert.equal(reads, 1); await assert.rejects(access(target), { code: 'ENOENT' });
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

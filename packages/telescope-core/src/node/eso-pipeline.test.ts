import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test, { mock } from 'node:test';
import { rawFrame } from './eso-pipeline.js';

test('ESO retained transfers preserve plain and compressed frames and acquired artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eso-transfer-')), bytes = Buffer.from('SIMPLE  = fixture science');
  const urls: string[] = [];
  const fetcher = mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url); const body = url.endsWith('compressed') ? gzipSync(bytes) : bytes;
    return new Response(body, { headers: { 'Content-Length': String(body.length) } });
  });
  try {
    for (const id of ['plain', 'compressed']) {
      const path = await rawFrame(id, directory);
      assert.deepEqual(await readFile(path), bytes); assert.equal(await rawFrame(id, directory), path);
    }
    assert.equal(urls.length, 2); assert.deepEqual((await readdir(directory)).sort(), ['compressed.fits', 'plain.fits']);
  } finally { fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});

test('ESO explains repeated authorization refusal after exactly five attempts without publishing bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eso-unauthorized-'));
  const fetcher = mock.method(globalThis, 'fetch', async () => new Response('private', { status: 401 }));
  const originalTimer = globalThis.setTimeout;
  // Backoffs and the default 60 s idle deadline share one scale; the fifth request is at 75 s.
  const timer = mock.method(globalThis, 'setTimeout', (callback: () => void, milliseconds?: number) =>
    originalTimer(callback, milliseconds === undefined ? undefined : milliseconds / 100));
  try {
    await assert.rejects(rawFrame('private', directory), {
      message: 'private: the ESO data portal refused it (401) five times; a frame still in its proprietary period is refused so too.',
    });
    assert.equal(fetcher.mock.callCount(), 5);
    assert.deepEqual(await readdir(directory), []);
  } finally { timer.mock.restore(); fetcher.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});

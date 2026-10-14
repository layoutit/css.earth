import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { downloadSource } from './archive-source.mts';

const body = Buffer.alloc(65_536, 7);
body.write('SIMPLE  =');

for (const rangeAccepted of [true, false]) test(`archive file ${rangeAccepted ? 'resumes' : 'restarts'} a dropped connection`, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-stream-retry-')), ranges: (string | undefined)[] = [];
  const server = createServer((request, response) => {
    ranges.push(request.headers.range);
    const offset = rangeAccepted && request.headers.range ? Number(request.headers.range.slice(6, -1)) : 0;
    response.writeHead(offset ? 206 : 200, { 'content-type': 'image/fits', 'accept-ranges': 'bytes',
      'content-length': body.length - offset, ...(offset ? { 'content-range': `bytes ${offset}-${body.length - 1}/${body.length}` } : {}) });
    if (ranges.length === 1) {
      response.write(body.subarray(0, 16_384));
      setTimeout(() => response.destroy(), 20);
    } else response.end(body.subarray(offset));
  });
  try {
    await new Promise<void>((accept, reject) => {
      server.once('error', reject); server.listen(0, '127.0.0.1', accept);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const path = resolve(root, 'image.fits');
    assert.deepEqual(await downloadSource({ url: `http://127.0.0.1:${address.port}/image.fits`, name: 'image.fits', bytes: body.length },
      path, body.length), { bytes: body.length });
    assert.deepEqual(ranges, [undefined, 'bytes=16384-']);
    assert.deepEqual(await readFile(path), body);
    assert.deepEqual(await readdir(root), ['image.fits']);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>(accept => server.close(() => accept()));
    await rm(root, { recursive: true, force: true });
  }
});

test('archive original-byte checks refuse an encoded replacement after an interruption', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'archive-encoded-retry-'));
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    if (requests > 1) return new Response(new Uint8Array(body), { headers: { 'content-encoding': 'gzip' } });
    let chunks = 0;
    return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (chunks++ === 0) controller.enqueue(body.subarray(0, 1024));
      else controller.error(new Error('connection reset'));
    } }), { headers: { 'accept-ranges': 'bytes', 'content-length': String(body.length) } });
  };
  try {
    await assert.rejects(downloadSource({ url: 'https://archive.invalid/image.fits', name: 'image.fits' },
      resolve(root, 'image.fits'), body.length, fetcher), /original file bytes/u);
    assert.equal(requests, 2);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

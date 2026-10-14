import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadableStream } from 'node:stream/web';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { DownloadInterruptedError, downloadHttpFile } from './http-download.js';
import { DOWNLOAD_BYTES, downloadFixture } from './download-fixture.js';

function steadyStream() {
  let chunks = 0;
  return new ReadableStream<Uint8Array>({ async pull(controller) {
    await delay(20);
    if (chunks++ < 8) controller.enqueue(Buffer.from('x'));
    else controller.close();
  } }, { highWaterMark: 0 });
}
test('idle timeout allows a steady transfer longer than its timeout in total', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-steady-'));
  try {
    const started = performance.now();
    await downloadHttpFile('https://fixture.test/steady', join(directory, 'file'), {
      byteLimit: 8, idleTimeoutMs: 100, attempts: 1,
      fetcher: async () => new Response(steadyStream(), { headers: { 'Content-Length': '8' } }),
    });
    assert.ok(performance.now() - started > 100);
    assert.equal(await readFile(join(directory, 'file'), 'utf8'), 'xxxxxxxx');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('idle timeout interrupts stalled headers and bodies; explicit absolute deadlines still apply', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-timeouts-'));
  try {
    for (const phase of ['headers', 'body', 'absolute'] as const) {
      let signal: AbortSignal | null | undefined;
      await assert.rejects(downloadHttpFile('https://fixture.test/stalled', join(directory, phase), {
        byteLimit: 8, attempts: 1, idleTimeoutMs: phase === 'absolute' ? 100 : 30,
        ...(phase === 'absolute' ? { timeoutMs: 50 } : {}),
        fetcher: async (_url, options) => {
          signal = options.signal;
          if (phase === 'headers') return new Promise<Response>(() => {});
          return new Response(phase === 'absolute' ? steadyStream() : new ReadableStream<Uint8Array>({}), { headers: { 'Content-Length': '8' } });
        },
      }), error => error instanceof DownloadInterruptedError && error.rawMessage.includes(phase === 'absolute' ? 'absolute deadline' : 'stalled'));
      assert.ok(signal?.aborted);
      assert.deepEqual(await readdir(directory), []);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an explicit 180 s deadline accepts first bytes at 90 s without opting into an idle limit', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'http-deadline-policy-'));
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let announceStart: () => void = () => {};
  const started = new Promise<void>(accept => { announceStart = accept; });
  try {
    const destination = join(directory, 'science');
    const transfer = downloadHttpFile('https://fixture.test/late', destination, {
      byteLimit: 4, attempts: 1, timeoutMs: 180_000,
      fetcher: async () => {
        announceStart();
        await new Promise<void>(accept => setTimeout(accept, 90_000));
        return new Response('data');
      },
    });
    // Attach a handler before advancing the clock: a regressed 60 s timer rejects here.
    const completion = transfer.then(value => ({ value }), error => ({ error }));
    await started;
    context.mock.timers.tick(90_000);
    const result = await completion;
    assert.ok('value' in result, `Explicit deadline rejected valid late response: ${'error' in result ? String(result.error) : ''}`);
    assert.equal(result.value.bytes, 4);
    assert.equal(await readFile(destination, 'utf8'), 'data');
  } finally { context.mock.timers.reset(); await rm(directory, { recursive: true, force: true }); }
});

test('retry backoff pauses idle time but cannot pause an explicit absolute deadline', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'http-backoff-policy-'));
  context.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    for (const absolute of [false, true]) {
      let announceBackoff: () => void = () => {};
      const backoffStarted = new Promise<void>(accept => { announceBackoff = accept; });
      const destination = join(directory, absolute ? 'deadline' : 'idle');
      const transfer = downloadHttpFile('https://fixture.test/backoff', destination, {
        byteLimit: 4, attempts: 1, ...(absolute ? { timeoutMs: 60_000 } : {}),
        fetcher: async (_url, _options, waitForBackoff) => {
          const backoff = waitForBackoff(75_000); announceBackoff();
          await backoff;
          return new Response('data');
        },
      });
      const completion = transfer.then(value => ({ value }), error => ({ error }));
      await backoffStarted;
      context.mock.timers.tick(75_000);
      const result = await completion;
      if (absolute) {
        assert.ok('error' in result && result.error instanceof DownloadInterruptedError);
        assert.match(result.error.rawMessage, /absolute deadline/u);
        await assert.rejects(readFile(destination), { code: 'ENOENT' });
      } else {
        assert.ok('value' in result, `Idle clock counted backoff: ${'error' in result ? String(result.error) : ''}`);
        assert.equal(result.value.bytes, 4);
        assert.equal(await readFile(destination, 'utf8'), 'data');
      }
    }
  } finally { context.mock.timers.reset(); await rm(directory, { recursive: true, force: true }); }
});

for (const status of [408, 429, 500, 502, 503, 504, 404]) test(`HTTP ${status} ${status === 404 ? 'fails once' : 'retries then succeeds'} within the attempt budget`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-status-'));
  let requests = 0, validations = 0;
  try {
    const download = downloadHttpFile('https://fixture.test/status', join(directory, 'file'), {
      byteLimit: 4, backoffMs: 0,
      fetcher: async () => ++requests === 1 ? new Response('error', { status }) : new Response('data'),
      validateResponse: response => { validations++; assert.equal(response.status, 200); },
    });
    if (status === 404) { await assert.rejects(download, /HTTP 404/u); assert.equal(requests, 1); assert.equal(validations, 0); }
    else { await download; assert.equal(requests, 2); assert.equal(validations, 1); assert.equal(await readFile(join(directory, 'file'), 'utf8'), 'data'); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('transient statuses stop at the configured attempt budget without publishing bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-status-cap-')); let requests = 0;
  try {
    await assert.rejects(downloadHttpFile('https://fixture.test/status', join(directory, 'file'), {
      byteLimit: 4, attempts: 3, backoffMs: 0, fetcher: async () => { requests++; return new Response('error', { status: 503 }); },
    }), error => error instanceof DownloadInterruptedError && error.rawMessage.includes('HTTP 503') && error.message.includes('after 3 attempts'));
    assert.equal(requests, 3); assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const mode of ['resume', 'ignore', 'invalid-range'] as const) test(`HTTP dropped body ${mode}: local archive preserves exact final bytes`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-download-'));
  let fixture: Awaited<ReturnType<typeof downloadFixture>> | undefined;
  try {
    fixture = await downloadFixture(mode);
    const destination = join(directory, 'science.fits');
    const result = await downloadHttpFile(fixture.url, destination, { byteLimit: DOWNLOAD_BYTES.length, backoffMs: 0 });
    assert.equal(result.bytes, DOWNLOAD_BYTES.length); assert.deepEqual(await readFile(destination), DOWNLOAD_BYTES);
    assert.match(fixture.ranges[1] ?? '', /^bytes=\d+-$/u);
    if (mode === 'invalid-range') assert.equal(fixture.ranges[2], undefined);
    assert.deepEqual(await readdir(directory), ['science.fits']);
  } finally { await fixture?.close(); await rm(directory, { recursive: true, force: true }); }
});

function streamFailure(bytes: Uint8Array) {
  let emitted = false;
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (!emitted) { emitted = true; controller.enqueue(bytes); }
    else controller.error(new Error('deliberate body reset'));
  } }, { highWaterMark: 0 });
}
test('three failures produce one human line and retain the raw error without publishing partial bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-download-failure-'));
  const ranges: (string | null)[] = [];
  try {
    await assert.rejects(downloadHttpFile('https://example.test/science', join(directory, 'science.fits'), {
      byteLimit: 400, backoffMs: 0, fetcher: async (_url, options) => {
        const offset = Number(/^bytes=(\d+)-$/u.exec(new Headers(options.headers).get('range') ?? '')?.[1] ?? 0);
        ranges.push(new Headers(options.headers).get('range'));
        return new Response(streamFailure(new Uint8Array(100)), { status: offset ? 206 : 200,
          headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(400 - offset),
            ...(offset ? { 'Content-Range': `bytes ${offset}-399/400` } : {}) } });
      },
    }), error => error instanceof DownloadInterruptedError &&
      error.message === 'Download interrupted at 0.0 of 0.0 MB after 3 attempts. Run the same command again to retry.' &&
      error.rawMessage === 'deliberate body reset' && !error.message.includes('\n'));
    assert.deepEqual(ranges, [null, 'bytes=100-', 'bytes=200-']); assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('byte limits, expected length, validators and non-overwrite publication remain enforced', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-download-limits-')), destination = join(directory, 'science.fits');
  try {
    await writeFile(destination, 'acquired');
    await assert.rejects(downloadHttpFile('https://example.test', destination, { byteLimit: 20,
      fetcher: async () => new Response('replacement', { headers: { 'Content-Length': '11' } }) }), /EEXIST/u);
    assert.equal(await readFile(destination, 'utf8'), 'acquired');
    await assert.rejects(downloadHttpFile('https://example.test', join(directory, 'large'), { byteLimit: 2,
      fetcher: async () => new Response('large') }), /byte limit/u);
    await assert.rejects(downloadHttpFile('https://example.test', join(directory, 'wrong'), { byteLimit: 10, expectedBytes: 3,
      fetcher: async () => new Response('four') }), /expected 3/u);
    let reads = 0;
    await assert.rejects(downloadHttpFile('https://example.test', join(directory, 'invalid'), { byteLimit: 10,
      fetcher: async () => new Response('untrusted'), validateResponse: () => { reads++; throw new Error('Invalid content type'); } }), /Invalid content type/u);
    assert.equal(reads, 1); assert.deepEqual(await readdir(directory), ['science.fits']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('resumption carries If-Range and ignored ranges restart instead of appending duplicate bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-download-ignore-')), ranges: (string | null)[] = [];
  try {
    const destination = join(directory, 'science');
    await downloadHttpFile('https://example.test', destination, { byteLimit: 8, backoffMs: 0,
      fetcher: async (_url, options) => {
        const headers = new Headers(options.headers); ranges.push(headers.get('range'));
        if (ranges.length === 1) return new Response(streamFailure(Buffer.from('1234')), { headers: { 'Accept-Ranges': 'bytes', ETag: '"fixed"', 'Content-Length': '8' } });
        assert.equal(headers.get('if-range'), '"fixed"');
        return new Response('12345678', { headers: { 'Content-Length': '8' } });
      } });
    assert.deepEqual(ranges, [null, 'bytes=4-']); assert.equal(await readFile(destination, 'utf8'), '12345678');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const mode of ['unsupported', 'invalid-range'] as const) test(`${mode} cannot append an unproven partial response`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'http-download-range-')), ranges: (string | null)[] = [];
  try {
    const destination = join(directory, 'science');
    await downloadHttpFile('https://example.test', destination, { byteLimit: 8, backoffMs: 0,
      fetcher: async (_url, options) => {
        const range = new Headers(options.headers).get('range'); ranges.push(range);
        if (ranges.length === 1) return new Response(streamFailure(Buffer.from('1234')), {
          headers: { 'Content-Length': '8', ...(mode === 'invalid-range' ? { 'Accept-Ranges': 'bytes' } : {}) } });
        if (range) return new Response('5678', { status: 206, headers: { 'Content-Length': '4', 'Content-Range': 'bytes 5-7/8' } });
        return new Response('12345678', { headers: { 'Content-Length': '8' } });
      } });
    assert.deepEqual(ranges, mode === 'invalid-range' ? [null, 'bytes=4-', null] : [null, null]);
    assert.equal(await readFile(destination, 'utf8'), '12345678');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

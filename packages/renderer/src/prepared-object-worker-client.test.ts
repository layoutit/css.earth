import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createPreparedObjectDecoder } from './prepared-object-worker-client.js';

type MockWorker = Worker & { postMessage: ReturnType<typeof mock.fn>; terminate: ReturnType<typeof mock.fn> };

function fixture() {
  const workers: MockWorker[] = [];
  const createWorker = mock.fn(() => {
    const worker = { postMessage: mock.fn(() => {}), terminate: mock.fn(() => {}), onmessage: null, onerror: null, onmessageerror: null } as unknown as MockWorker;
    workers.push(worker); return worker;
  });
  const decoder = createPreparedObjectDecoder(createWorker);
  const request = () => ({ descriptor: { id: 'object' }, bytes: new ArrayBuffer(8) });
  const reply = (data: unknown, worker = workers.at(-1)!) => worker.onmessage!.call(worker, { data } as MessageEvent);
  return { decoder, workers, createWorker, request, reply };
}

test('sequential and queued decoding reuse one worker and transfer each payload only when active', async () => {
  const f = fixture(), a = f.request(), b = f.request();
  const first = f.decoder.decode(a), second = f.decoder.decode(b);
  assert.equal(f.workers[0].postMessage.mock.callCount(), 1); assert.deepEqual(f.workers[0].postMessage.mock.calls[0]!.arguments, [a, [a.bytes]]);
  f.reply({ ok: true, definition: { id: 'first' } });
  assert.deepEqual((await first), { id: 'first' });
  assert.deepEqual(f.workers[0].postMessage.mock.calls.at(-1)?.arguments, [b, [b.bytes]]);
  f.reply({ ok: true, definition: { id: 'second' } }); await second;
  const third = f.decoder.decode(f.request());
  f.reply({ ok: true, definition: { id: 'third' } }); await third;
  assert.equal(f.createWorker.mock.callCount(), 1);
  assert.equal(f.workers[0].terminate.mock.callCount(), 0);
  f.decoder.dispose(); assert.equal(f.workers[0].terminate.mock.callCount(), 1);
});

test('aborting an active decode terminates wasted work and ignores stale results without losing the queued job', async () => {
  const f = fixture(), abort = new AbortController();
  const first = f.decoder.decode(f.request(), { signal: abort.signal });
  const stale = f.workers[0].onmessage!;
  const second = f.decoder.decode(f.request());
  abort.abort(); await assert.rejects(first, { name: 'AbortError' });
  assert.equal(f.createWorker.mock.callCount(), 2);
  stale.call(f.workers[0], { data: { ok: true, definition: { id: 'stale' } } } as MessageEvent);
  f.reply({ ok: true, definition: { id: 'second' } });
  assert.deepEqual((await second), { id: 'second' });
  f.decoder.dispose();
});

test('queued and pre-aborted jobs never transfer bytes or interrupt another active decode', async () => {
  const f = fixture(), abort = new AbortController();
  const first = f.decoder.decode(f.request());
  const second = f.decoder.decode(f.request(), { signal: abort.signal });
  abort.abort(); await assert.rejects(second, { name: 'AbortError' });
  await assert.rejects(f.decoder.decode(f.request(), { signal: abort.signal }), { name: 'AbortError' });
  assert.equal(f.workers[0].terminate.mock.callCount(), 0);
  assert.equal(f.workers[0].postMessage.mock.callCount(), 1);
  f.reply({ ok: true, definition: {} }); await first; f.decoder.dispose();
});

test('validation failures reuse the worker; crashes retire it; disposal rejects active and queued jobs', async () => {
  const f = fixture(), invalid = f.decoder.decode(f.request());
  f.reply({ ok: false, name: 'TypeError', message: 'invalid prepared camera' });
  await assert.rejects(invalid, /invalid prepared camera/);
  const crash = f.decoder.decode(f.request());
  f.workers[0].onerror!.call(f.workers[0], { message: 'worker unavailable' } as ErrorEvent);
  await assert.rejects(crash, /worker unavailable/);
  const active = f.decoder.decode(f.request()), queued = f.decoder.decode(f.request());
  assert.equal(f.createWorker.mock.callCount(), 2);
  f.decoder.dispose();
  await assert.rejects(active, { name: 'AbortError' });
  await assert.rejects(queued, { name: 'AbortError' });
});

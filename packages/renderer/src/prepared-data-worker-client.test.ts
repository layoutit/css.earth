import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createPreparedDataReader } from './prepared-data-worker-client.js';

type MockWorker = Worker & { postMessage: ReturnType<typeof mock.fn>; terminate: ReturnType<typeof mock.fn> };

function fixture() {
  const workers: MockWorker[] = [];
  const createWorker = mock.fn(() => {
    const worker = { postMessage: mock.fn(() => {}), terminate: mock.fn(() => {}), onmessage: null, onerror: null, onmessageerror: null } as unknown as MockWorker;
    workers.push(worker); return worker;
  });
  const decoder = createPreparedDataReader(createWorker);
  const request = () => ({ descriptor: { id: 'object' }, bytes: new ArrayBuffer(8) });
  const posted = (worker = workers.at(-1)!) => worker.postMessage.mock.calls.at(-1)!.arguments[0] as { id: number };
  const reply = (data: object, worker = workers.at(-1)!, id = posted(worker).id) => worker.onmessage!.call(worker, { data: { id, ...data } } as MessageEvent);
  return { decoder, workers, createWorker, request, reply };
}

test('sequential and queued decoding reuse one worker and transfer each payload only when active', async () => {
  const f = fixture(), a = f.request(), b = f.request();
  const first = f.decoder.decode(a), second = f.decoder.decode(b);
  assert.equal(f.workers[0].postMessage.mock.callCount(), 1); assert.deepEqual(f.workers[0].postMessage.mock.calls[0]!.arguments, [{ id: 1, kind: 'object', ...a }, [a.bytes]]);
  f.reply({ ok: true, value: { id: 'first' } });
  assert.deepEqual((await first), { id: 'first' });
  assert.deepEqual(f.workers[0].postMessage.mock.calls.at(-1)?.arguments, [{ id: 2, kind: 'object', ...b }, [b.bytes]]);
  f.reply({ ok: true, value: { id: 'second' } }); await second;
  const third = f.decoder.decode(f.request());
  f.reply({ ok: true, value: { id: 'third' } }); await third;
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
  stale.call(f.workers[0], { data: { id: 1, ok: true, value: { id: 'stale' } } } as MessageEvent);
  f.reply({ ok: true, value: { id: 'second' } });
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
  f.reply({ ok: true, value: {} }); await first; f.decoder.dispose();
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

test('a file read runs beside a decode, and a read the retired worker never answered is asked of the next one', async () => {
  const f = fixture(), abort = new AbortController();
  const decode = f.decoder.decode(f.request(), { signal: abort.signal });
  const first = f.decoder.read<{ stars: number }>('volume-stars', 'https://css.earth/a.bin'), second = f.decoder.read('css-volume', 'https://css.earth/b.json');
  assert.deepEqual(f.workers[0].postMessage.mock.calls.slice(1).map(call => call.arguments[0]),
    [{ id: 2, kind: 'read', reader: 'volume-stars', url: 'https://css.earth/a.bin' }, { id: 3, kind: 'read', reader: 'css-volume', url: 'https://css.earth/b.json' }]);
  f.reply({ ok: true, value: { stars: 3 } }, f.workers[0], 2);
  assert.deepEqual(await first, { stars: 3 });
  // Cancelling the decode retires the worker; the unanswered read goes to its successor.
  abort.abort(); await assert.rejects(decode, { name: 'AbortError' });
  assert.equal(f.workers.length, 2);
  assert.deepEqual(f.workers[1].postMessage.mock.calls.map(call => call.arguments[0]), [{ id: 3, kind: 'read', reader: 'css-volume', url: 'https://css.earth/b.json' }]);
  f.reply({ ok: false, name: 'TypeError', message: 'b.json: stacks must be a list' }, f.workers[1], 3);
  await assert.rejects(second, /b.json: stacks must be a list/u);
  f.decoder.dispose();
});

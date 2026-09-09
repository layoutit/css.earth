import { expect, test, vi } from 'vitest';
import { createPreparedObjectDecoder } from './prepared-object-worker-client.js';

function fixture() {
  const workers: Array<Worker> = [];
  const createWorker = vi.fn(() => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null, onmessageerror: null } as unknown as Worker;
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
  expect(f.workers[0].postMessage).toHaveBeenCalledExactlyOnceWith(a, [a.bytes]);
  f.reply({ ok: true, definition: { id: 'first' } });
  expect(await first).toEqual({ id: 'first' });
  expect(f.workers[0].postMessage).toHaveBeenLastCalledWith(b, [b.bytes]);
  f.reply({ ok: true, definition: { id: 'second' } }); await second;
  const third = f.decoder.decode(f.request());
  f.reply({ ok: true, definition: { id: 'third' } }); await third;
  expect(f.createWorker).toHaveBeenCalledOnce();
  expect(f.workers[0].terminate).not.toHaveBeenCalled();
  f.decoder.dispose(); expect(f.workers[0].terminate).toHaveBeenCalledOnce();
});

test('aborting an active decode terminates wasted work and ignores stale results without losing the queued job', async () => {
  const f = fixture(), abort = new AbortController();
  const first = f.decoder.decode(f.request(), { signal: abort.signal });
  const stale = f.workers[0].onmessage!;
  const second = f.decoder.decode(f.request());
  abort.abort(); await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.createWorker).toHaveBeenCalledTimes(2);
  stale.call(f.workers[0], { data: { ok: true, definition: { id: 'stale' } } } as MessageEvent);
  f.reply({ ok: true, definition: { id: 'second' } });
  expect(await second).toEqual({ id: 'second' });
  f.decoder.dispose();
});

test('queued and pre-aborted jobs never transfer bytes or interrupt another active decode', async () => {
  const f = fixture(), abort = new AbortController();
  const first = f.decoder.decode(f.request());
  const second = f.decoder.decode(f.request(), { signal: abort.signal });
  abort.abort(); await expect(second).rejects.toMatchObject({ name: 'AbortError' });
  await expect(f.decoder.decode(f.request(), { signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.workers[0].terminate).not.toHaveBeenCalled();
  expect(f.workers[0].postMessage).toHaveBeenCalledOnce();
  f.reply({ ok: true, definition: {} }); await first; f.decoder.dispose();
});

test('validation failures reuse the worker; crashes retire it; disposal rejects active and queued jobs', async () => {
  const f = fixture(), invalid = f.decoder.decode(f.request());
  f.reply({ ok: false, name: 'TypeError', message: 'invalid prepared camera' });
  await expect(invalid).rejects.toThrow('invalid prepared camera');
  const crash = f.decoder.decode(f.request());
  f.workers[0].onerror!.call(f.workers[0], { message: 'worker unavailable' } as ErrorEvent);
  await expect(crash).rejects.toThrow('worker unavailable');
  const active = f.decoder.decode(f.request()), queued = f.decoder.decode(f.request());
  expect(f.createWorker).toHaveBeenCalledTimes(2);
  f.decoder.dispose();
  await expect(active).rejects.toMatchObject({ name: 'AbortError' });
  await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
});

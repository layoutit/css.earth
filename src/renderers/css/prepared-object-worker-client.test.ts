import { expect, test, vi } from 'vitest';
import { decodePreparedObjectInWorker } from './prepared-object-worker-client.js';

function fixture() {
  const worker = { postMessage: vi.fn(), terminate: vi.fn(),
    onmessage: null as Worker['onmessage'], onerror: null as Worker['onerror'], onmessageerror: null as Worker['onmessageerror'] };
  const createWorker = vi.fn(() => worker);
  const controller = new AbortController();
  const request = { descriptor: { id: 'object' }, bytes: new ArrayBuffer(8) };
  const start = () => decodePreparedObjectInWorker(request, { createWorker, signal: controller.signal });
  return { worker, createWorker, controller, request, start };
}

test('the browser transfers byte ownership and retires the worker after one validated result', async () => {
  const f = fixture(), result = f.start(), definition = { id: 'object' };
  expect(f.worker.postMessage).toHaveBeenCalledExactlyOnceWith(f.request, [f.request.bytes]);
  f.worker.onmessage!.call(f.worker as unknown as Worker, { data: { ok: true, definition } } as MessageEvent);
  expect(await result).toBe(definition);
  expect(f.worker.terminate).toHaveBeenCalledOnce();
  expect(f.worker.onmessage).toBeNull(); expect(f.worker.onerror).toBeNull();
  f.controller.abort();
  expect(f.worker.terminate).toHaveBeenCalledOnce();
});

test('cancellation terminates decoding immediately and a queued response cannot revive it', async () => {
  const f = fixture(), result = f.start(), staleMessage = f.worker.onmessage!;
  f.controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  staleMessage.call(f.worker as unknown as Worker, { data: { ok: true, definition: {} } } as MessageEvent);
  expect(f.worker.terminate).toHaveBeenCalledOnce();
  const before = fixture(); before.controller.abort();
  await expect(before.start()).rejects.toMatchObject({ name: 'AbortError' });
  expect(before.createWorker).not.toHaveBeenCalled();
});

test('validation, worker and transfer failures reject instead of decoding again on the caller thread', async () => {
  const validation = fixture(), invalid = validation.start();
  validation.worker.onmessage!.call(validation.worker as unknown as Worker,
    { data: { ok: false, name: 'TypeError', message: 'invalid prepared camera' } } as MessageEvent);
  await expect(invalid).rejects.toMatchObject({ name: 'TypeError', message: 'invalid prepared camera' });
  expect(validation.worker.terminate).toHaveBeenCalledOnce();
  const crashed = fixture(), crash = crashed.start();
  crashed.worker.onerror!.call(crashed.worker as unknown as Worker, { message: 'worker unavailable' } as ErrorEvent);
  await expect(crash).rejects.toThrow('worker unavailable');
  expect(crashed.worker.terminate).toHaveBeenCalledOnce();
  const transfer = fixture(); transfer.worker.postMessage.mockImplementation(() => { throw new Error('transfer failed'); });
  await expect(transfer.start()).rejects.toThrow('transfer failed');
  expect(transfer.worker.terminate).toHaveBeenCalledOnce();
});

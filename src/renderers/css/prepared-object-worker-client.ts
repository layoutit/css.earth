import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';

export interface PreparedObjectDecodeRequest { descriptor: unknown; bytes: ArrayBuffer; }
export type PreparedObjectDecodeResult = { ok: true; definition: ObjectRuntimeDefinition } |
  { ok: false; name: string; message: string };
type DecodeWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
const createDecodeWorker = (): DecodeWorker => new Worker(new URL('./prepared-object-worker.js', import.meta.url), {
  type: 'module', name: 'cssearth-prepared-object',
});

/** One cancellable decode job; no renderer DOM or native images enter the worker. */
export function decodePreparedObjectInWorker(request: PreparedObjectDecodeRequest, {
  signal, createWorker = createDecodeWorker,
}: { signal?: AbortSignal; createWorker?: () => DecodeWorker } = {}): Promise<ObjectRuntimeDefinition> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const worker = createWorker();
    let settled = false;
    const finish = (error: unknown, value?: ObjectRuntimeDefinition) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      worker.terminate();
      if (error !== null) reject(error); else resolve(value!);
    };
    const abort = () => finish(signal?.reason ?? new DOMException('Object decoding was cancelled.', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<PreparedObjectDecodeResult>) => {
      const result = event.data;
      if (result.ok) finish(null, result.definition);
      else {
        const ErrorType = result.name === 'TypeError' ? TypeError : result.name === 'RangeError' ? RangeError : Error;
        const error = new ErrorType(result.message); error.name = result.name; finish(error);
      }
    };
    worker.onerror = event => finish(new Error(event.message || 'Prepared object worker failed.'));
    worker.onmessageerror = () => finish(new Error('Prepared object worker response could not be decoded.'));
    try { worker.postMessage(request, [request.bytes]); }
    catch (error) { finish(error); }
  });
}

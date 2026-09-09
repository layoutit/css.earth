import type { ObjectRuntimeDefinition } from './runtime/object-runtime-types.js';

export interface PreparedObjectDecodeRequest { descriptor: unknown; bytes: ArrayBuffer; }
export type PreparedObjectDecodeResult = { ok: true; definition: ObjectRuntimeDefinition } |
  { ok: false; name: string; message: string };
type DecodeWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
const createDecodeWorker = (): DecodeWorker => new Worker(new URL('./prepared-object-worker.js', import.meta.url), {
  type: 'module', name: 'cssearth-prepared-object',
});
type Job = { request: PreparedObjectDecodeRequest; signal?: AbortSignal; abort: () => void;
  resolve: (definition: ObjectRuntimeDefinition) => void; reject: (error: unknown) => void };

/** One retained worker and one active decode. Cancellation retires an active
 * worker so abandoned validation cannot delay the next navigation. */
export function createPreparedObjectDecoder(createWorker = createDecodeWorker) {
  let worker: DecodeWorker | undefined, active: Job | undefined;
  const queue: Job[] = [];
  function retire() {
    if (!worker) return;
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate(); worker = undefined;
  }
  function finish(job: Job, error: unknown, value?: ObjectRuntimeDefinition) {
    if (active !== job) return;
    active = undefined;
    job.signal?.removeEventListener('abort', job.abort);
    if (error !== null) job.reject(error); else job.resolve(value!);
    pump();
  }
  function pump() {
    if (active || !queue.length) return;
    const job = active = queue.shift()!;
    try {
      worker ??= createWorker();
      worker.onmessage = (event: MessageEvent<PreparedObjectDecodeResult>) => {
        if (active !== job) return; // A queued message from a cancelled worker.
        const result = event.data;
        if (result.ok) finish(job, null, result.definition);
        else {
          const ErrorType = result.name === 'TypeError' ? TypeError : result.name === 'RangeError' ? RangeError : Error;
          const error = new ErrorType(result.message); error.name = result.name; finish(job, error);
        }
      };
      worker.onerror = event => {
        if (active !== job) return;
        retire(); finish(job, new Error(event.message || 'Prepared object worker failed.'));
      };
      worker.onmessageerror = () => {
        if (active !== job) return;
        retire(); finish(job, new Error('Prepared object worker response could not be decoded.'));
      };
      worker.postMessage(job.request, [job.request.bytes]);
    } catch (error) { retire(); finish(job, error); }
  }
  return {
    decode(request: PreparedObjectDecodeRequest, { signal }: { signal?: AbortSignal } = {}): Promise<ObjectRuntimeDefinition> {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(signal.reason); return; }
        const job: Job = { request, signal, resolve, reject, abort: () => {
          const reason = signal?.reason ?? new DOMException('Object decoding was cancelled.', 'AbortError');
          if (active === job) { retire(); finish(job, reason); }
          else {
            const index = queue.indexOf(job);
            if (index < 0) return;
            queue.splice(index, 1); signal?.removeEventListener('abort', job.abort); reject(reason);
          }
        } };
        signal?.addEventListener('abort', job.abort, { once: true });
        queue.push(job); pump();
      });
    },
    dispose() {
      const pending = [...queue]; queue.length = 0;
      if (active) pending.push(active);
      active = undefined; retire();
      for (const job of pending) {
        job.signal?.removeEventListener('abort', job.abort);
        job.reject(new DOMException('Object decoder disposed.', 'AbortError'));
      }
    },
  };
}
const decoder = createPreparedObjectDecoder();
globalThis.addEventListener?.('pagehide', () => decoder.dispose());
export const decodePreparedObjectInWorker = decoder.decode;

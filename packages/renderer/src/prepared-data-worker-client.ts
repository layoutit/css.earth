import { type ObjectRuntimeDefinition } from '@cssearth/objects';
import { readPreparedHere } from './prepared-data/readers.js';

export interface PreparedObjectDecodeRequest { descriptor: unknown; bytes: ArrayBuffer; }
/** What the page asks of the data worker: an object's runtime from its bytes, or a file read by its kind's reader. */
export type PreparedDataRequest = { id: number } & ({ kind: 'object' } & PreparedObjectDecodeRequest | { kind: 'read'; reader: string; url: string });
export type PreparedDataResult = { id: number; ok: true; value: unknown } | { id: number; ok: false; name: string; message: string };
type DataWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
const createDataWorker = (): DataWorker => new Worker(new URL('./prepared-data-worker.js', import.meta.url), {
  type: 'module', name: 'cssearth-prepared-data',
});
type Job = { id: number; request: PreparedObjectDecodeRequest; signal?: AbortSignal; abort: () => void;
  resolve: (definition: ObjectRuntimeDefinition) => void; reject: (error: unknown) => void };
type Read = { id: number; reader: string; url: string; resolve: (value: unknown) => void; reject: (error: unknown) => void };

const failure = (result: Extract<PreparedDataResult, { ok: false }>) => {
  const ErrorType = result.name === 'TypeError' ? TypeError : result.name === 'RangeError' ? RangeError : Error;
  const error = new ErrorType(result.message); error.name = result.name; return error;
};

/** One retained worker. An object decodes one at a time: cancelling the active one retires the worker, so abandoned
 * validation cannot delay the next navigation. A file read runs beside it, any number at once; a retired worker's
 * unanswered reads are asked again of the next one. */
export function createPreparedDataReader(createWorker = createDataWorker) {
  let worker: DataWorker | undefined, active: Job | undefined, serial = 0;
  const queue: Job[] = [], reads = new Map<number, Read>();
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
  /** The worker failed as a whole: nothing it was asked can be answered. */
  function crash(error: Error) {
    retire();
    const lost = [...reads.values()]; reads.clear();
    for (const read of lost) read.reject(error);
    if (active) finish(active, error);
  }
  function start(): DataWorker {
    if (worker) return worker;
    const created = worker = createWorker();
    created.onmessage = (event: MessageEvent<PreparedDataResult>) => {
      const result = event.data, read = reads.get(result.id);
      if (read) { reads.delete(result.id); if (result.ok) read.resolve(result.value); else read.reject(failure(result)); return; }
      // Anything else answers the active object, or a cancelled one.
      if (!active || active.id !== result.id) return;
      if (result.ok) finish(active, null, result.value as ObjectRuntimeDefinition); else finish(active, failure(result));
    };
    created.onerror = event => crash(new Error(event.message || 'Prepared data worker failed.'));
    created.onmessageerror = () => crash(new Error('Prepared data worker response could not be decoded.'));
    // A read the retired worker never answered.
    for (const read of reads.values()) created.postMessage({ id: read.id, kind: 'read', reader: read.reader, url: read.url } satisfies PreparedDataRequest);
    return created;
  }
  function pump() {
    if (active || !queue.length) return;
    const job = active = queue.shift()!;
    try { start().postMessage({ id: job.id, kind: 'object', ...job.request } satisfies PreparedDataRequest, [job.request.bytes]); }
    catch (error) { retire(); finish(job, error); }
  }
  return {
    /** Start the worker before the first object's bytes arrive, so its script downloads beside them; the first decode adopts it. */
    prestart() { try { start(); } catch { /* the first request creates it and reports */ } },
    decode(request: PreparedObjectDecodeRequest, { signal }: { signal?: AbortSignal } = {}): Promise<ObjectRuntimeDefinition> {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(signal.reason); return; }
        const job: Job = { id: ++serial, request, signal, resolve, reject, abort: () => {
          const reason = signal?.reason ?? new DOMException('Object decoding was cancelled.', 'AbortError');
          if (active === job) { retire(); finish(job, reason); if (reads.size && !worker) try { start(); } catch (error) { crash(error instanceof Error ? error : new Error(String(error))); } }
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
    /** The file at `url`, read by the reader of `reader` (prepared-readers.ts) off this thread. */
    read<Value>(reader: string, url: string): Promise<Value> {
      return new Promise<unknown>((resolve, reject) => {
        const read: Read = { id: ++serial, reader, url, resolve, reject };
        reads.set(read.id, read);
        try { start().postMessage({ id: read.id, kind: 'read', reader, url } satisfies PreparedDataRequest); }
        catch (error) { reads.delete(read.id); retire(); reject(error); }
      }) as Promise<Value>;
    },
    dispose() {
      const pending = [...queue]; queue.length = 0;
      if (active) pending.push(active);
      active = undefined; retire();
      const reason = new DOMException('Prepared data reader disposed.', 'AbortError');
      for (const job of pending) { job.signal?.removeEventListener('abort', job.abort); job.reject(reason); }
      const lost = [...reads.values()]; reads.clear();
      for (const read of lost) read.reject(reason);
    },
  };
}
const reader = createPreparedDataReader();
globalThis.addEventListener?.('pagehide', () => reader.dispose());
export const decodePreparedObjectInWorker = reader.decode;
export const prestartPreparedObjectDecoding = reader.prestart;

/** The prepared file at `url`, read by its kind's reader: in the data worker in a browser, in place where there is none
 * (Node tools and tests). `url` is absolute or root-relative; the worker resolves it against the page. */
export function readPrepared<Value>(kind: string, url: string): Promise<Value> {
  if (typeof Worker === 'undefined') return readPreparedHere(kind, url).then(reading => reading.value as Value);
  return reader.read<Value>(kind, typeof location === 'undefined' ? url : new URL(url, location.href).href);
}

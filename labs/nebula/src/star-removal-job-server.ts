/** Apply jobs belong to the local server; disconnecting an HTTP observer never cancels them. */
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SamplingProgress, SamplingRequest } from './star-sampling-preparation.js';

type Status = 'queued' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
export interface RemovalJob {
  id: string; imageId: string; status: Status; createdAt: string; updatedAt: string;
  progress?: SamplingProgress; result?: unknown; error?: string;
}
interface SavedJob extends RemovalJob { schema: 'cssearth-star-removal-job@1'; request: SamplingRequest }
type Worker = { controller: AbortController; task: Promise<void> };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const pending = (status: Status) => ['queued', 'running', 'cancelling'].includes(status);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const message = (error: unknown) => error instanceof Error ? error.message : 'Star removal failed.';
class HttpError extends Error { constructor(readonly status: number, text: string) { super(text); } }

export function createStarRemovalJobs(root: string, options: {
  parseRequest: (input: unknown) => SamplingRequest;
  sample: (request: SamplingRequest, signal: AbortSignal, progress: (value: SamplingProgress) => void) => Promise<unknown>;
  validateResult: (result: unknown) => Promise<void>;
}) {
  const directory = resolve(root, '.local/nebula-lab/star-removal-jobs');
  const records = new Map<string, SavedJob>(), workers = new Map<string, Worker>();
  let writes = Promise.resolve(), transactions = Promise.resolve(), closed = false;
  function save(job: SavedJob) {
    const bytes = JSON.stringify(job, null, 2) + '\n', path = resolve(directory, `${job.id}.json`);
    const write = writes.then(async () => { await writeFile(`${path}.pending`, bytes); await rename(`${path}.pending`, path); });
    writes = write.catch(() => {}); return write;
  }
  const ready = (async () => {
    await mkdir(directory, { recursive: true });
    for (const name of await readdir(directory)) {
      if (!name.endsWith('.json') || !uuid(name.slice(0, -5))) continue;
      const job = JSON.parse(await readFile(resolve(directory, name), 'utf8')) as SavedJob;
      if (job.schema !== 'cssearth-star-removal-job@1' || job.id !== name.slice(0, -5) || job.imageId !== job.request?.imageId ||
          options.parseRequest(job.request).action !== 'apply') throw new Error('Saved star removal job is invalid.');
      if (pending(job.status)) {
        job.status = 'interrupted'; job.error = 'The local server stopped before this job completed. Apply again explicitly to start a new job.';
        job.updatedAt = new Date().toISOString(); await save(job);
      }
      records.set(job.id, job);
    }
  })();
  void ready.catch(() => {});
  async function exclusive<T>(operation: () => Promise<T>) {
    const result = transactions.then(async () => { await ready; return operation(); });
    transactions = result.then(() => {}, () => {}); return result;
  }
  async function visible(job: SavedJob): Promise<RemovalJob> {
    if (job.status === 'completed') {
      try { await options.validateResult(job.result); }
      catch (error) {
        job.status = 'failed'; job.error = `Saved result unavailable: ${message(error)}`;
        delete job.result; job.updatedAt = new Date().toISOString(); await save(job);
      }
    }
    const { schema: _schema, request: _request, ...value } = job;
    return structuredClone(value);
  }
  function find(id: unknown) {
    if (!uuid(id)) throw new TypeError('Invalid star removal job identity.');
    const job = records.get(id); if (!job) throw new HttpError(404, 'Saved star removal job is unavailable.'); return job;
  }
  function launch(job: SavedJob) {
    const controller = new AbortController();
    const task = (async () => {
      let lastSaved = 0, lastStage = '', persistenceError: unknown;
      try {
        controller.signal.throwIfAborted();
        job.status = 'running'; job.updatedAt = new Date().toISOString(); await save(job);
        const result = await options.sample(job.request, controller.signal, progress => {
          if (controller.signal.aborted) return;
          job.progress = progress; job.updatedAt = new Date().toISOString();
          if (Date.now() - lastSaved >= 1000 || progress.stage !== lastStage) {
            lastSaved = Date.now(); lastStage = progress.stage;
            void save(job).catch(error => { persistenceError = error; controller.abort(); });
          }
        });
        if (persistenceError) throw persistenceError;
        controller.signal.throwIfAborted(); await options.validateResult(result); controller.signal.throwIfAborted();
        job.result = result; job.status = 'completed';
      } catch (error) {
        if (job.status !== 'interrupted') job.status = controller.signal.aborted && !persistenceError ? 'cancelled' : 'failed';
        job.error = persistenceError ? message(persistenceError) : job.status === 'cancelled' ? 'Star removal cancelled explicitly.' : message(error);
      }
      job.updatedAt = new Date().toISOString(); await save(job);
    })().catch(error => { job.status = 'failed'; job.error = `Could not persist star removal completion: ${message(error)}`; })
      .finally(() => { workers.delete(job.id); });
    workers.set(job.id, { controller, task });
  }
  async function start(input: unknown) {
    if (!object(input) || Object.keys(input).some(key => !['requestId', 'request'].includes(key)) || !uuid(input.requestId))
      throw new TypeError('Expected a saved requestId and an Apply request.');
    const request = options.parseRequest(input.request);
    if (request.action !== 'apply') throw new TypeError('Only explicit Apply requests create durable jobs.');
    return exclusive(async () => {
      const existing = records.get(input.requestId as string);
      if (existing) {
        if (canonical(existing.request) !== canonical(request)) throw new HttpError(409, 'This requestId already belongs to different Apply inputs.');
        return visible(existing);
      }
      if (closed) throw new HttpError(503, 'The local star removal worker is shutting down.');
      if (workers.size >= 4) throw new HttpError(429, 'Star removal is busy; wait for an active job to finish.');
      if (records.size >= 512) throw new HttpError(507, 'The local star removal job history is full.');
      const now = new Date().toISOString(), job: SavedJob = { schema: 'cssearth-star-removal-job@1', id: input.requestId as string,
        imageId: request.imageId, request: structuredClone(request), status: 'queued', createdAt: now, updatedAt: now };
      await save(job); records.set(job.id, job); const response = await visible(job); launch(job); return response;
    });
  }
  async function get(id: unknown) { await ready; return visible(find(id)); }
  async function cancel(id: unknown) {
    return exclusive(async () => {
      const job = find(id);
      if (pending(job.status)) {
        job.status = 'cancelling'; job.updatedAt = new Date().toISOString(); workers.get(job.id)?.controller.abort(); await save(job);
      }
      return visible(job);
    });
  }
  async function shutdown() {
    await exclusive(async () => {
      closed = true;
      for (const [id, worker] of workers) {
        const job = find(id); job.status = 'interrupted'; job.error = 'The local server stopped before this job completed.';
        worker.controller.abort(); await save(job);
      }
    });
    await Promise.all([...workers.values()].map(worker => worker.task));
  }
  async function idle() { await transactions; await Promise.all([...workers.values()].map(worker => worker.task)); await writes; }
  return { start, get, cancel, shutdown, idle };
}

export function starRemovalJobsHandler(jobs: ReturnType<typeof createStarRemovalJobs>) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      if (response.destroyed) return;
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    };
    try {
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
      const path = (request.url ?? '').split('?')[0].replace(/^\/__nebula\/star-removal-jobs/, '');
      const match = /^\/([^/]+)(\/cancel)?$/.exec(path);
      if (request.method === 'GET' && match && !match[2]) { reply(200, { job: await jobs.get(match[1]) }); return; }
      if (request.method !== 'POST') throw new HttpError(405, 'Use POST to start or cancel a job, or GET for its status.');
      if (!request.headers['content-type']?.startsWith('application/json')) throw new TypeError('Expected a local JSON request.');
      let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 16384) throw new TypeError('Apply request is too large.'); }
      if (match?.[2]) { reply(200, { job: await jobs.cancel(match[1]) }); return; }
      if (path !== '' && path !== '/') throw new HttpError(404, 'Unknown star removal job endpoint.');
      reply(202, { job: await jobs.start(JSON.parse(body)) });
    } catch (error) { reply(error instanceof HttpError ? error.status : error instanceof TypeError || error instanceof SyntaxError ? 400 : 500, { error: message(error) }); }
  };
}

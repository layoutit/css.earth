/** Apply jobs belong to the local server; disconnecting an HTTP observer never cancels them. */
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RemovalProgress, RemovalRequest } from '../star-removal/star-removal-types.js';

type Status = 'queued' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
export interface RemovalJob {
  id: string; imageId: string; status: Status; createdAt: string; updatedAt: string;
  progress?: RemovalProgress; result?: unknown; error?: string;
}
interface SavedJob<Request> extends RemovalJob { schema: string; request: Request }
type Worker = { controller: AbortController; task: Promise<void> };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const pending = (status: Status) => ['queued', 'running', 'cancelling'].includes(status);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const message = (error: unknown) => error instanceof Error ? error.message : 'Star removal failed.';
class HttpError extends Error { constructor(readonly status: number, text: string) { super(text); } }

export function createStarRemovalJobs<Request extends { imageId: string; action: string } = RemovalRequest>(root: string, options: {
  namespace?: string; label?: string;
  /** Opt-in resident receipt bound; archived receipts and prepared artifacts remain accessible. */
  history?: { maxRecords: number; retainPerImage: number; preferred: (request: Request) => boolean };
  parseRequest: (input: unknown) => Request;
  sample: (request: Request, signal: AbortSignal, progress: (value: RemovalProgress) => void) => Promise<unknown>;
  validateResult: (result: unknown) => Promise<void>;
}) {
  const namespace = options.namespace ?? 'star-removal-nox', label = options.label ?? 'Star removal';
  if (!/^[a-z0-9-]+$/.test(namespace)) throw new TypeError('Invalid processing job namespace.');
  const history = options.history;
  if (history && (!Number.isInteger(history.maxRecords) || history.maxRecords < 4 || history.maxRecords > 512 ||
      !Number.isInteger(history.retainPerImage) || history.retainPerImage < 1 || history.retainPerImage > history.maxRecords ||
      typeof history.preferred !== 'function')) throw new TypeError('Invalid bounded processing history policy.');
  const schema = namespace === 'star-removal-nox' ? 'cssearth-star-removal-job@1' : `cssearth-${namespace}-job@1`;
  const directory = resolve(root, `.local/nebula-lab/${namespace}-jobs`);
  const archiveDirectory = resolve(directory, 'archive');
  const records = new Map<string, SavedJob<Request>>(), workers = new Map<string, Worker>();
  let writes = Promise.resolve(), transactions = Promise.resolve(), closed = false;
  function save(job: SavedJob<Request>, archived = false) {
    const bytes = JSON.stringify(job, null, 2) + '\n', path = resolve(archived ? archiveDirectory : directory, `${job.id}.json`);
    const write = writes.then(async () => { await writeFile(`${path}.pending`, bytes); await rename(`${path}.pending`, path); });
    writes = write.catch(() => {}); return write;
  }
  function readSavedJob(value: unknown, id: string): SavedJob<Request> {
    if (!object(value) || value.schema !== schema || value.id !== id || typeof value.imageId !== 'string' ||
        typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
        typeof value.status !== 'string' || !['queued', 'running', 'cancelling', 'completed', 'cancelled', 'failed', 'interrupted'].includes(value.status) ||
        (value.error !== undefined && typeof value.error !== 'string')) throw new Error('Saved star removal job is invalid.');
    const request = options.parseRequest(value.request);
    if (value.imageId !== request.imageId || request.action !== 'apply') throw new Error('Saved star removal job is invalid.');
    let progress: RemovalProgress | undefined;
    if (value.progress !== undefined) {
      const item = value.progress;
      if (!object(item) || typeof item.stage !== 'string' || typeof item.message !== 'string' || typeof item.current !== 'number' ||
          !Number.isFinite(item.current) || item.current < 0 || typeof item.total !== 'number' || !Number.isFinite(item.total) || item.total <= 0)
        throw new Error('Saved job progress is invalid.');
      progress = { stage: item.stage, message: item.message, current: item.current, total: item.total };
    }
    // The membership check above constrains the saved status; spell out the discriminator for TypeScript as well.
    const status: Status = value.status === 'queued' || value.status === 'running' || value.status === 'cancelling' || value.status === 'completed' ||
      value.status === 'cancelled' || value.status === 'failed' ? value.status : 'interrupted';
    return { schema, id, imageId: value.imageId, status, createdAt: value.createdAt, updatedAt: value.updatedAt, request,
      ...(progress ? { progress } : {}), ...(value.result === undefined ? {} : { result: value.result }), ...(value.error === undefined ? {} : { error: value.error }) };
  }
  const ready = (async () => {
    await mkdir(directory, { recursive: true });
    if (history) await mkdir(archiveDirectory, { recursive: true });
    for (const name of await readdir(directory)) {
      if (!name.endsWith('.json') || !uuid(name.slice(0, -5))) continue;
      const job = readSavedJob(JSON.parse(await readFile(resolve(directory, name), 'utf8')), name.slice(0, -5));
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
  async function visible(job: SavedJob<Request>, archived = false): Promise<RemovalJob> {
    if (job.status === 'completed') {
      try { await options.validateResult(job.result); }
      catch (error) {
        job.status = 'failed'; job.error = `Saved result unavailable: ${message(error)}`;
        delete job.result; job.updatedAt = new Date().toISOString(); await save(job, archived);
      }
    }
    const { schema: _schema, request: _request, ...value } = job;
    return structuredClone(value);
  }
  async function lookup(id: unknown): Promise<{ job: SavedJob<Request>; archived: boolean } | undefined> {
    if (!uuid(id)) throw new TypeError('Invalid star removal job identity.');
    const job = records.get(id); if (job) return { job, archived: false };
    if (history) {
      try { return { job: readSavedJob(JSON.parse(await readFile(resolve(archiveDirectory, `${id}.json`), 'utf8')), id), archived: true }; }
      catch (error) { if (!(object(error) && error.code === 'ENOENT')) throw error; }
    }
    return undefined;
  }
  async function find(id: unknown) {
    const found = await lookup(id); if (!found) throw new HttpError(404, 'Saved star removal job is unavailable.'); return found;
  }
  async function archiveOldReceipts() {
    if (!history || records.size < history.maxRecords) return;
    const newest = [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.updatedAt.localeCompare(a.updatedAt));
    const protectedIds = new Set(workers.keys()), counts = new Map<string, number>();
    const recentBoundaries = new Map<string, string>(), preferredImages = new Map<string, string>();
    for (const job of newest) {
      const count = counts.get(job.imageId) ?? 0; counts.set(job.imageId, count + 1);
      if (count === history.retainPerImage - 1) recentBoundaries.set(job.imageId, job.createdAt);
      if (pending(job.status) || count < history.retainPerImage || job.createdAt === recentBoundaries.get(job.imageId)) protectedIds.add(job.id);
      if (job.status === 'completed' && history.preferred(job.request) &&
          (!preferredImages.has(job.imageId) || preferredImages.get(job.imageId) === job.createdAt)) {
        protectedIds.add(job.id); preferredImages.set(job.imageId, job.createdAt);
      }
    }
    const eligible = newest.filter(job => !protectedIds.has(job.id)).sort((a, b) =>
      Number(history.preferred(a.request)) - Number(history.preferred(b.request)) || a.createdAt.localeCompare(b.createdAt));
    for (const job of eligible) {
      if (records.size < history.maxRecords) break;
      // Serialize with progress/completion writes. Only terminal, worker-free records reach this point.
      const move = writes.then(() => rename(resolve(directory, `${job.id}.json`), resolve(archiveDirectory, `${job.id}.json`)));
      writes = move.catch(() => {}); await move; records.delete(job.id);
    }
  }
  function launch(job: SavedJob<Request>) {
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
        job.error = persistenceError ? message(persistenceError) : job.status === 'cancelled' ? `${label} cancelled explicitly.` : message(error);
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
      const found = await lookup(input.requestId), existing = found?.job;
      if (existing) {
        if (canonical(existing.request) !== canonical(request)) throw new HttpError(409, 'This requestId already belongs to different Apply inputs.');
        return visible(existing, found.archived);
      }
      if (closed) throw new HttpError(503, 'The local star removal worker is shutting down.');
      if (workers.size >= 4) throw new HttpError(429, `${label} is busy; wait for an active job to finish.`);
      await archiveOldReceipts();
      if (records.size >= (history?.maxRecords ?? 512)) throw new HttpError(507, 'The local star removal job history is full.');
      const now = new Date().toISOString(), job: SavedJob<Request> = { schema, id: input.requestId as string,
        imageId: request.imageId, request: structuredClone(request), status: 'queued', createdAt: now, updatedAt: now };
      await save(job); records.set(job.id, job); const response = await visible(job); launch(job); return response;
    });
  }
  async function get(id: unknown) { return exclusive(async () => { const found = await find(id); return visible(found.job, found.archived); }); }
  async function cancel(id: unknown) {
    return exclusive(async () => {
      const found = await find(id), job = found.job;
      if (pending(job.status)) {
        job.status = 'cancelling'; job.updatedAt = new Date().toISOString(); workers.get(job.id)?.controller.abort(); await save(job);
      }
      return visible(job, found.archived);
    });
  }
  async function shutdown() {
    await exclusive(async () => {
      closed = true;
      for (const [id, worker] of workers) {
        const job = records.get(id)!; job.status = 'interrupted'; job.error = 'The local server stopped before this job completed.';
        worker.controller.abort(); await save(job);
      }
    });
    await Promise.all([...workers.values()].map(worker => worker.task));
  }
  async function idle() { await transactions; await Promise.all([...workers.values()].map(worker => worker.task)); await writes; }
  return { start, get, cancel, shutdown, idle };
}

export function starRemovalJobsHandler(jobs: ReturnType<typeof createStarRemovalJobs>, prefix = '/__nebula/star-removal-jobs') {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      if (response.destroyed) return;
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    };
    try {
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
      const pathname = (request.url ?? '').split('?')[0];
      const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
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

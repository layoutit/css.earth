/** Live progress: every lab command appends JSON lines to `src/objects/<id>/.local/lab/progress.jsonl`; the lab server
 * tails those files and the UI shows one strip per job, whether the CLI or the UI started it. A line is a step event
 * (`stage`, `percent`, `message`) or the job's end (`state`: done, failed or cancelled, with its `result` or `error`).
 * Messages are stage labels, never raw command output. */
import { isRecord } from '@cssearth/core';
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { labDirectory } from './working-copy.ts';

export type ProgressState = 'running' | 'done' | 'failed' | 'cancelled';
export interface ProgressEvent {
  job: string; object: string; step: string; pid: number; at: string;
  stage?: string; percent?: number; message?: string; state?: Exclude<ProgressState, 'running'>; result?: unknown; error?: string;
}
export interface JobProgress { job: string; object: string; step: string; pid: number; stage: string; percent: number; message: string;
  state: ProgressState; result?: unknown; error?: string; startedAt: string; updatedAt: string }

export const progressPath = (root: string, id: string) => resolve(labDirectory(root, id), 'progress.jsonl');

export interface ProgressWriter { job: string; stage(message: string, fraction: number): void; finish(state: Exclude<ProgressState, 'running'>, detail?: { result?: unknown; error?: string }): void }
/** Keeps a progress file short: past 256 KB only its last 200 lines stay. */
function trim(file: string) {
  try {
    if (statSync(file).size < 256 * 1024) return;
    writeFileSync(file, readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-200).join('\n') + '\n');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
/** A job's writer. Repeated identical stage events are dropped, so a chatty command writes a handful of lines. */
export function progressWriter(root: string, id: string, step: string, job = randomUUID()): ProgressWriter {
  const file = progressPath(root, id);
  mkdirSync(labDirectory(root, id), { recursive: true });
  trim(file);
  let last = '';
  const append = (event: Omit<ProgressEvent, 'job' | 'object' | 'step' | 'pid' | 'at'>) =>
    appendFileSync(file, JSON.stringify({ job, object: id, step, pid: process.pid, at: new Date().toISOString(), ...event } satisfies ProgressEvent) + '\n');
  return { job,
    stage(message, fraction) {
      const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100), key = `${message}\u0000${percent}`;
      if (key === last) return;
      last = key; append({ stage: message, percent, message });
    },
    finish(state, detail = {}) { append({ state, percent: state === 'done' ? 100 : undefined, ...detail }); } };
}
/** Runs one step with its events: a start, the step's own stages, and its end. Cancelling is an AbortError. */
export async function withProgress<T>(root: string, id: string, step: string, run: (stage: ProgressWriter['stage']) => Promise<T>,
  summary: (result: T) => unknown = result => result): Promise<T> {
  const writer = progressWriter(root, id, step);
  writer.stage('Starting', 0);
  try {
    const result = await run(writer.stage);
    writer.finish('done', { result: summary(result) });
    return result;
  } catch (error) {
    const cancelled = error instanceof Error && error.name === 'AbortError';
    writer.finish(cancelled ? 'cancelled' : 'failed', { error: error instanceof Error ? error.message.split('\n')[0]!.slice(0, 300) : String(error) });
    throw error;
  }
}

function readEvent(line: string): ProgressEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (!isRecord(value) || typeof value.job !== 'string' || typeof value.object !== 'string' || typeof value.step !== 'string' || typeof value.at !== 'string') return null;
    return value as unknown as ProgressEvent;
  } catch { return null; }
}
/** Folds events into each job's latest state. */
export function foldProgress(jobs: Map<string, JobProgress>, lines: Iterable<string>): Map<string, JobProgress> {
  for (const line of lines) {
    const event = readEvent(line); if (!event) continue;
    const previous = jobs.get(event.job);
    const next: JobProgress = previous ?? { job: event.job, object: event.object, step: event.step, pid: typeof event.pid === 'number' ? event.pid : 0,
      stage: '', percent: 0, message: '', state: 'running', startedAt: event.at, updatedAt: event.at };
    if (typeof event.stage === 'string') next.stage = event.stage;
    if (typeof event.message === 'string') next.message = event.message;
    if (typeof event.percent === 'number') next.percent = event.percent;
    if (event.state === 'done' || event.state === 'failed' || event.state === 'cancelled') { next.state = event.state; next.result = event.result; next.error = event.error; }
    next.updatedAt = event.at;
    jobs.set(event.job, next);
  }
  return jobs;
}
const alive = (pid: number) => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; } };

/** The server's tail of several objects' progress files: each read takes only the bytes appended since the last. */
export function progressTail(root: string, ids: () => readonly string[]) {
  const offsets = new Map<string, number>(), jobs = new Map<string, JobProgress>(), partial = new Map<string, string>(), shownRunning = new Set<string>();
  async function readOne(id: string) {
    const file = progressPath(root, id), size = await stat(file).then(found => found.size, () => -1);
    if (size < 0) return;
    let offset = offsets.get(id) ?? 0;
    if (size < offset) { offset = 0; partial.delete(id); }
    if (size === offset) return;
    const handle = await open(file, 'r');
    try {
      const buffer = Buffer.alloc(size - offset); await handle.read(buffer, 0, buffer.length, offset);
      const text = (partial.get(id) ?? '') + buffer.toString('utf8'), lines = text.split('\n');
      partial.set(id, lines.pop() ?? ''); offsets.set(id, size);
      foldProgress(jobs, lines);
    } finally { await handle.close(); }
  }
  /** Jobs still running, and those that ended within `recentMs`. A running job whose process is gone has failed. */
  return async function read(now = Date.now(), recentMs = 8000): Promise<JobProgress[]> {
    await Promise.all(ids().map(readOne));
    const shown: JobProgress[] = [];
    for (const job of jobs.values()) {
      if (job.state === 'running' && !alive(job.pid)) {
        job.state = 'failed'; job.error = 'The process ended without a result.';
        // A job seen running ends now; one left over from before the server started stays in the past.
        if (shownRunning.has(job.job)) job.updatedAt = new Date(now).toISOString();
      }
      if (job.state === 'running') shownRunning.add(job.job); else shownRunning.delete(job.job);
      if (job.state === 'running' || now - Date.parse(job.updatedAt) < recentMs) shown.push(job);
    }
    return shown.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  };
}

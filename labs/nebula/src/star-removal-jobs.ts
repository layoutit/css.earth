import type { RemovalRequest, StarRemovalResult } from './star-removal-types';
export type { RemovalRequest } from './star-removal-types';

export interface RemovalJob {
  id: string; imageId: string; status: 'queued' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
  progress?: { stage: string; current?: number; total?: number; message: string }; result?: StarRemovalResult; error?: string;
}
type Source = Pick<StarRemovalResult, 'imageId' | 'sourceSha256' | 'sourcePreviewSha256' | 'nativeDimensions'>;
interface SavedJob extends Source { request?: RemovalRequest; id: string; status: RemovalJob['status']; installedResultId?: string; }
const storageKey = (id: string) => `cssearth-star-removal-job-nox-v1:${id}`;
export const removalJobActive = (job: RemovalJob | null) => Boolean(job && ['queued', 'running', 'cancelling'].includes(job.status));
function sameSource(a: Source, b: Source) { return a.imageId === b.imageId && a.sourceSha256 === b.sourceSha256 && a.sourcePreviewSha256 === b.sourcePreviewSha256 && a.nativeDimensions.join() === b.nativeDimensions.join(); }
function read(source: Source): SavedJob | null {
  try { const value = JSON.parse(localStorage.getItem(storageKey(source.imageId)) ?? 'null') as SavedJob | null;
    return value && Array.isArray(value.nativeDimensions) && sameSource(value, source) && /^[a-f0-9-]{36}$/.test(value.id) ? value : null;
  } catch { return null; }
}
function save(value: SavedJob) { localStorage.setItem(storageKey(value.imageId), JSON.stringify(value)); }
/** Server owns processing. Losing this observer never cancels or restarts work. */
export function createStarRemovalJobs(callbacks: {
  onState(job: RemovalJob): void;
  onComplete(result: StarRemovalResult, isCurrent: () => boolean): Promise<void | boolean>;
}) {
  let revision = 0, controller: AbortController | null = null, saved: SavedJob | null = null, starting: Promise<void> | null = null;
  function stop() { revision++; controller?.abort(); controller = null; saved = null; }
  async function response(path: string, init: RequestInit, signal: AbortSignal) {
    const reply = await fetch(path, { ...init, signal }); const body = await reply.json();
    if (!reply.ok) throw Object.assign(new Error(body.error ?? `Removal status unavailable (HTTP ${reply.status}).`), { status: reply.status });
    const job = body.job as RemovalJob;
    if (!job || job.id !== saved?.id || job.imageId !== saved.imageId || !['queued', 'running', 'cancelling', 'completed', 'cancelled', 'failed', 'interrupted'].includes(job.status)) throw new TypeError('Invalid removal job identity.');
    return job;
  }
  async function accept(job: RemovalJob, current: () => boolean) {
    if (!current() || !saved) return;
    saved.status = job.status; save(saved); callbacks.onState(job);
    if (job.status === 'completed' && job.result && saved.installedResultId !== job.result.applied?.resultId) {
      if (!sameSource(saved, job.result) || !job.result.applied) throw new TypeError('Removal result differs from its source image.');
      const installed = await callbacks.onComplete(job.result, current);
      if (current() && installed !== false && saved) { saved.installedResultId = job.result.applied.resultId; save(saved); }
    }
  }
  function wait(signal: AbortSignal) {
    return new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 1000); signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  }
  async function watch(initial?: RemovalJob) {
    if (!saved) return;
    const owner = revision, signal = controller!.signal, current = () => owner === revision && !signal.aborted;
    let job = initial;
    while (current()) {
      try {
        if (!job) {
          try { job = await response(`/__nebula/star-removal-jobs/${saved!.id}`, {}, signal); }
          catch (error) {
            if ((error as { status?: number }).status !== 404 || !saved?.request) throw error;
            job = await response('/__nebula/star-removal-jobs', { method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ requestId: saved.id, request: saved.request }) }, signal);
          }
        }
        await accept(job, current); if (!current() || !removalJobActive(job)) return;
      } catch (error) {
        if (!current() || !saved) return;
        callbacks.onState({ id: saved.id, imageId: saved.imageId, status: saved.status,
          error: removalJobActive({ id: saved.id, imageId: saved.imageId, status: saved.status }) ? 'Connection lost · reconnecting to the same job…' : error instanceof Error ? error.message : String(error) });
        if (!removalJobActive({ id: saved.id, imageId: saved.imageId, status: saved.status })) return;
      }
      await wait(signal); job = undefined;
    }
  }
  return {
    stop,
    resume(source: Source) {
      stop(); saved = read(source); if (!saved) return;
      controller = new AbortController(); callbacks.onState({ id: saved.id, imageId: saved.imageId, status: saved.status });
      void watch();
    },
    async start(source: Source, request: RemovalRequest) {
      const existing = read(source);
      if (existing && removalJobActive({ ...existing })) { this.resume(source); return; }
      stop(); controller = new AbortController(); const owner = revision, signal = controller.signal;
      saved = { ...source, request, id: crypto.randomUUID(), status: 'queued' };
      try { save(saved); } catch { throw new Error('Job persistence is unavailable. Enable local storage before starting removal.'); }
      callbacks.onState({ id: saved.id, imageId: saved.imageId, status: 'queued' });
      starting = (async () => {
        try {
          const job = await response('/__nebula/star-removal-jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: saved!.id, request }) }, signal);
          if (owner === revision) void watch(job);
        } catch (error) {
          if (owner === revision && saved) { callbacks.onState({ id: saved.id, imageId: saved.imageId, status: saved.status, error: 'Connection lost · reconnecting to the same job…' }); void watch(); }
        }
      })();
      await starting; starting = null;
    },
    async cancel() {
      if (starting) await starting; if (!saved || !controller) return;
      const owner = revision, signal = controller.signal;
      try {
        const job = await response(`/__nebula/star-removal-jobs/${saved.id}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, signal);
        await accept(job, () => owner === revision && !signal.aborted);
      } catch (error) {
        if (owner === revision && saved) callbacks.onState({ id: saved.id, imageId: saved.imageId, status: saved.status, error: 'Cancel was not confirmed · retry Cancel.' });
      }
    },
  };
}

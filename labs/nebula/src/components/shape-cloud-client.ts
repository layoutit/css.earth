import { readShapeCloudResult } from '../reconstruction/shape-cloud/result';
import type { ShapeCloudRequest, ShapeCloudResult, ShapeCloudSettings } from '../reconstruction/shape-cloud/types';
import type { PreviewTicket } from './shape-cloud-scheduler';

export interface CloudJob { id: string; imageId: string; status: string; progress?: { current: number; total: number; message: string }; error?: string; result?: unknown }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
class CloudHttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export const activeCloudJob = (job: CloudJob | null) => Boolean(job && ['queued', 'running', 'cancelling'].includes(job.status));
export function readCloudJob(value: unknown, imageId: string): CloudJob {
  if (!object(value) || !object(value.job)) throw new Error('Invalid cloud job response.');
  const job = value.job;
  if (typeof job.id !== 'string' || !/^[a-f0-9-]{36}$/.test(job.id) || job.imageId !== imageId ||
      typeof job.status !== 'string' || !['queued', 'running', 'cancelling', 'completed', 'cancelled', 'failed', 'interrupted'].includes(job.status)) throw new Error('Cloud job does not match this image.');
  let progress: CloudJob['progress'];
  if (job.progress !== undefined) {
    const p = job.progress;
    if (!object(p) || typeof p.current !== 'number' || !Number.isFinite(p.current) || typeof p.total !== 'number' || !Number.isFinite(p.total) ||
        p.current < 0 || p.total <= 0 || typeof p.message !== 'string') throw new Error('Invalid cloud job progress.');
    progress = { current: p.current, total: p.total, message: p.message };
  }
  if (job.error !== undefined && typeof job.error !== 'string') throw new Error('Invalid cloud job error.');
  return { id: job.id, imageId, status: job.status, progress, error: job.error, result: job.result };
}
/** A detached observer never cancels server work. Superseded detailed previews are cancelled explicitly. */
export function createShapeCloudClient(options: {
  request: Omit<ShapeCloudRequest, 'settings' | 'quality'>;
  onJob(job: CloudJob): void;
  save(id: string, ticket: PreviewTicket<ShapeCloudSettings>): void;
}) {
  const controller = new AbortController(); let activeId = '', ready = false, cancelWanted = false, cancelSent = false;
  const api = '/__nebula/shape-cloud-jobs';
  async function fetchJob(path: string, init?: RequestInit) {
    const response = await fetch(`${api}${path}`, { cache: 'no-store', signal: controller.signal, ...init });
    const body: unknown = await response.json();
    if (!response.ok) throw new CloudHttpError(response.status, object(body) && typeof body.error === 'string' ? body.error : `Cloud job unavailable (${response.status}).`);
    return readCloudJob(body, options.request.imageId);
  }
  async function sendCancel() {
    if (!activeId || !ready || cancelSent) return;
    cancelSent = true;
    await fetchJob(`/${activeId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  }
  async function watch(first: CloudJob): Promise<ShapeCloudResult> {
    let job = first;
    while (!controller.signal.aborted) {
      options.onJob(job);
      if (job.status === 'completed') { activeId = ''; return readShapeCloudResult(job.result); }
      if (!activeCloudJob(job)) { activeId = ''; throw new Error(job.error || `Cloud preview ${job.status}.`); }
      if (cancelWanted) await sendCancel();
      await new Promise<void>((resolve, reject) => {
        const finish = () => { controller.signal.removeEventListener('abort', abort); resolve(); };
        const timer = setTimeout(finish, 150);
        const abort = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); reject(new DOMException('Observer detached.', 'AbortError')); };
        controller.signal.addEventListener('abort', abort, { once: true });
      });
      job = await fetchJob(`/${activeId}`);
    }
    throw new DOMException('Observer detached.', 'AbortError');
  }
  return {
    get: (id: string) => fetchJob(`/${id}`),
    async start(ticket: PreviewTicket<ShapeCloudSettings>) {
      // After a transport failure, reconnect before making another job. The server may still be processing.
      if (activeId) {
        try {
          const prior = await fetchJob(`/${activeId}`);
          if (activeCloudJob(prior) || prior.status === 'completed') { ready = true; return watch(prior); }
          activeId = '';
        } catch (reason) { if (reason instanceof CloudHttpError && reason.status === 404) activeId = ''; else throw reason; }
      }
      activeId = crypto.randomUUID(); ready = false; cancelWanted = cancelSent = false;
      options.save(activeId, ticket);
      let job: CloudJob;
      try { job = await fetchJob('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          requestId: activeId, request: { ...options.request, settings: ticket.value, quality: ticket.quality },
        }) });
      } catch (reason) { if (reason instanceof CloudHttpError && reason.status >= 400 && reason.status < 500) activeId = ''; throw reason; }
      ready = true; return watch(job);
    },
    resume(job: CloudJob) { activeId = job.id; ready = true; cancelWanted = cancelSent = false; return watch(job); },
    cancel() { cancelWanted = true; },
    // A replaced geometry cannot contribute to the current cloud. Keep observing only long enough
    // to cancel after the server acknowledges ownership, including a still-pending POST.
    supersede() { if (activeId) cancelWanted = true; else controller.abort(); },
    disconnect() { controller.abort(); },
  };
}

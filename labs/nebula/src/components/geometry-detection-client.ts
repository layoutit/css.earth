import type { DetectionRequest } from '../reconstruction/geometry/jobs-model';
import { readCloudJob, type CloudJob } from './shape-cloud-client';

export type DetectionJob = CloudJob;
export const detectionJobActive = (job: DetectionJob | null) => Boolean(job && ['queued', 'running', 'cancelling'].includes(job.status));
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export class DetectionHttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

/** Detaching a React observer leaves the server-owned detector running. */
export function createDetectionClient(imageId: string) {
  const controller = new AbortController();
  async function request(path: string, body?: unknown): Promise<DetectionJob> {
    const response = await fetch(`/__nebula/geometry-jobs${path}`, { cache: 'no-store', signal: controller.signal,
      ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
    const value: unknown = await response.json();
    if (!response.ok) throw new DetectionHttpError(response.status, record(value) && typeof value.error === 'string' ? value.error : `Detector unavailable (${response.status}).`);
    return readCloudJob(value, imageId);
  }
  function pause(): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = () => { controller.signal.removeEventListener('abort', abort); resolve(); };
      const timer = setTimeout(finish, 250);
      const abort = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); reject(new DOMException('Detector observer detached.', 'AbortError')); };
      controller.signal.addEventListener('abort', abort, { once: true });
    });
  }
  return { signal: controller.signal, get: (id: string) => request(`/${id}`),
    start: (id: string, value: DetectionRequest) => request('', { requestId: id, request: value }),
    cancel: (id: string) => request(`/${id}/cancel`, {}), pause,
    disconnect: () => controller.abort(),
  };
}

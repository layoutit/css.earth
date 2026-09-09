import type { PreparedWorldContext } from './prepared-world-context.js';
import type { PlannedWorldContext, WorldContextView } from './world-context-planner.js';

export interface WorldPlannerWorker {
  onmessage: ((event: MessageEvent<{ ready?: boolean; id?: number; frame?: PlannedWorldContext; error?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}

/** The publication queue owns admission; this transport owns one persistent prepared bank. */
export function createWorldContextPlannerClient(plan: PreparedWorldContext,
  createWorker: () => WorldPlannerWorker = () => new Worker(new URL('./world-context-planner-worker.js', import.meta.url),
    { type: 'module', name: 'cssearth-world-planner' }),
  annotationPriorities: Readonly<Record<string, number>> = {}) {
  const worker = createWorker();
  let resolveReady!: () => void, rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  ready.catch(() => {});
  let destroyed = false, sequence = 0;
  let pending: { id: number; resolve(frame: PlannedWorldContext): void; reject(error: Error): void } | null = null;
  const destroy = (error = new Error('World frame planner was destroyed.')) => {
    if (destroyed) return;
    destroyed = true;
    rejectReady(error); pending?.reject(error); pending = null;
    worker.onmessage = null; worker.onerror = null; worker.terminate();
  };
  worker.onmessage = ({ data }) => {
    if (destroyed) return;
    if (data.error !== undefined) { destroy(new Error(data.error)); return; }
    if (data.ready) { resolveReady(); return; }
    if (!pending || pending.id !== data.id) return;
    if (!data.frame) { destroy(new Error('World frame planner returned no frame.')); return; }
    const complete = pending; pending = null; complete.resolve(data.frame);
  };
  worker.onerror = event => destroy(new Error(event.message));
  worker.postMessage({ plan, annotationPriorities });
  return { async plan(view: WorldContextView): Promise<PlannedWorldContext> {
    await ready;
    if (destroyed) throw new Error('World frame planner was destroyed.');
    if (pending) throw new Error('World frame admission exceeded one in-flight request.');
    return new Promise((resolve, reject) => {
      pending = { id: ++sequence, resolve, reject };
      try { worker.postMessage({ id: sequence, view }); }
      catch (error) { destroy(error instanceof Error ? error : new Error(String(error))); }
    });
  }, destroy };
}

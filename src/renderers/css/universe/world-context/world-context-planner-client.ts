import type { PreparedWorldContext } from '../../prepared-data/world-context.js';
import { worldContextGeometry } from '../../prepared-data/world-context.js';
import type { WorldContextView } from './world-context-planner.js';
import type { WorldContextFrame } from './world-context-frame.js';
import { packWorldBodies } from './world-context-view-transport.js';

export interface WorldPlannerWorker {
  onmessage: ((event: MessageEvent<{ ready?: boolean; id?: number; frame?: WorldContextFrame; error?: string; orbitsLoaded?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(value: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

/** Prepared files the planner worker loads and validates itself, off the main thread. */
export interface WorldPlannerSource {
  /** The same summary the main thread holds. */
  readonly summaryUrl: string;
  /** Where each orbit centre's binary bank lives, as `<orbitBanksUrl><centre id>.bin`: the only copies of the orbit paths
   * in the browser, read by the worker when a frame first needs a centre's orbits. */
  readonly orbitBanksUrl: string;
}

/** The publication queue owns admission; this transport owns one persistent prepared bank.
 * With a `source`, the worker reads the full file itself; the main thread may hold only
 * the summary. Without one, `plan` must be the full context and is cloned to the worker. */
export function createWorldContextPlannerClient(plan: PreparedWorldContext,
  createWorker: () => WorldPlannerWorker = () => new Worker(new URL('./world-context-planner-worker.js', import.meta.url),
    { type: 'module', name: 'cssearth-world-planner' }),
  annotationPriorities: Readonly<Record<string, number>> = {}, source?: WorldPlannerSource, annotationLandmarks: readonly string[] = []) {
  const worker = createWorker();
  let resolveReady!: () => void, rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  ready.catch(() => {});
  let destroyed = false, sequence = 0;
  const orbitListeners = new Set<() => void>();
  let pending: { id: number; resolve(frame: WorldContextFrame): void; reject(error: Error): void } | null = null;
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
    // A centre's paths arrived: the last planned frame drew none of them, so its owner plans again.
    if (data.orbitsLoaded !== undefined) { for (const listener of orbitListeners) listener(); return; }
    if (!pending || pending.id !== data.id) return;
    if (!data.frame) { destroy(new Error('World frame planner returned no frame.')); return; }
    const complete = pending; pending = null; complete.resolve(data.frame);
  };
  worker.onerror = event => destroy(new Error(event.message));
  if (source) worker.postMessage({ source, annotationPriorities, annotationLandmarks });
  else worker.postMessage({ plan: worldContextGeometry(plan), annotationPriorities, annotationLandmarks });
  return { async plan(view: WorldContextView): Promise<WorldContextFrame> {
    await ready;
    if (destroyed) throw new Error('World frame planner was destroyed.');
    if (pending) throw new Error('World frame admission exceeded one in-flight request.');
    return new Promise((resolve, reject) => {
      pending = { id: ++sequence, resolve, reject };
      try {
        const { bodies, ...rest } = view, packed = packWorldBodies(bodies);
        worker.postMessage({ id: sequence, view: rest, bodies: packed }, [packed.buffer as ArrayBuffer]);
      }
      catch (error) { destroy(error instanceof Error ? error : new Error(String(error))); }
    });
  },
  /** Call `listener` whenever an orbit centre's paths arrive after a frame that lacked them; returns the unsubscribe. */
  onOrbitsLoaded(listener: () => void) { orbitListeners.add(listener); return () => { orbitListeners.delete(listener); }; },
  destroy };
}

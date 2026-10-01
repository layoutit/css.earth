import type { PreparedWorldContext, PreparedWorldContextGeometry } from '../../prepared-data/world-context.js';
import { parsePreparedWorldContextPlan, worldContextGeometry } from '../../prepared-data/world-context.js';
import type { WorldContextView } from './world-context-planner.js';
import type { WorldContextFrame } from './world-context-frame.js';
import { packWorldBodies, WORLD_BODY_FIELDS, type PackedWorldContextView } from './world-context-view-transport.js';

export interface WorldPlannerWorker {
  onmessage: ((event: MessageEvent<{ ready?: boolean; id?: number; frame?: WorldContextFrame; error?: string; orbitsLoaded?: string }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(value: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

/** Prepared orbit banks the planner worker loads on demand. */
export interface WorldPlannerSource {
  /** Where each orbit path lives, as `<orbitBanksUrl><body id>.bin`: the only copies of the orbit paths
   * in the browser, read by the worker when a frame first needs that path. */
  readonly orbitBanksUrl: string;
}

/** The worker's first message. `validatedPlan` is never external data: it is the structured clone of a plan this
 * client validated on its own thread, so the worker plans from it without validating it again (a clone loses the
 * validated mark, and a second validation of the 2.3 MB summary cost the worker about 40 ms). A dedicated worker's
 * port is reachable only through the Worker object the client holds, so no fetched file can author this envelope;
 * external bytes the worker reads itself (orbit banks) are validated there. */
export type WorldPlannerInitialise = { readonly annotationPriorities: Readonly<Record<string, number>>; readonly annotationLandmarks: readonly string[] } &
  ({ readonly validatedPlan: PreparedWorldContextGeometry; readonly source?: undefined } |
   { readonly validatedPlan: PreparedWorldContext; readonly source: WorldPlannerSource });

/** A plan with more systems' bodies (`extendWorldContext`), validated by the client like its first plan. The worker adds the
 * bodies it does not hold, after those it does, so every index it planned keeps its body. */
export type WorldPlannerExtend = { readonly validatedExtension: PreparedWorldContext };

/** The publication queue owns admission; this transport owns one persistent prepared bank.
 * With a `source`, the worker receives the main thread's validated summary and
 * reads orbit banks as needed. Without one, `plan` must be the full context. */
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
  // A plan validated on this thread returns at once (its mark); anything else is validated here, before it is vouched for.
  const validatedPlan = parsePreparedWorldContextPlan(plan);
  if (source && validatedPlan.schema !== 'cssearth-world-context-summary@2') throw new TypeError('Orbit banks complete the world context summary only.');
  const initialise: WorldPlannerInitialise = source ? { source, validatedPlan, annotationPriorities, annotationLandmarks }
    : { validatedPlan: worldContextGeometry(validatedPlan), annotationPriorities, annotationLandmarks };
  worker.postMessage(initialise);
  // Bodies the worker holds, and extended plans it has not been sent: each goes just before the first view whose columns
  // hold its bodies, since a view captured before the extension still holds fewer.
  let held = 1 + validatedPlan.bodies.length;
  const extensions: PreparedWorldContext[] = [];
  return { async plan(view: WorldContextView | PackedWorldContextView): Promise<WorldContextFrame> {
    await ready;
    if (destroyed) throw new Error('World frame planner was destroyed.');
    if (pending) throw new Error('World frame admission exceeded one in-flight request.');
    return new Promise((resolve, reject) => {
      pending = { id: ++sequence, resolve, reject };
      try {
        // A retained context sends its columns as they are; a view of objects is packed here.
        const { rest, packed } = 'bodyColumns' in view ? (({ bodyColumns, ...rest }) => ({ rest, packed: bodyColumns }))(view)
          : (({ bodies, ...rest }) => ({ rest, packed: packWorldBodies(bodies) }))(view);
        const count = packed.length / WORLD_BODY_FIELDS;
        while (held < count && extensions.length) {
          const next = extensions.shift()!;
          held = 1 + next.bodies.length;
          worker.postMessage({ validatedExtension: next } satisfies WorldPlannerExtend);
        }
        worker.postMessage({ id: sequence, view: rest, bodies: packed }, [packed.buffer as ArrayBuffer]);
      }
      catch (error) { destroy(error instanceof Error ? error : new Error(String(error))); }
    });
  },
  /** Plan with `next`, an extension of this client's plan, from the first view whose columns hold its bodies. */
  extend(next: PreparedWorldContext) {
    const validated = parsePreparedWorldContextPlan(next);
    if (source && validated.schema !== 'cssearth-world-context-summary@2') throw new TypeError('Orbit banks complete the world context summary only.');
    extensions.push(validated);
  },
  /** Call `listener` whenever an orbit centre's paths arrive after a frame that lacked them; returns the unsubscribe. */
  onOrbitsLoaded(listener: () => void) { orbitListeners.add(listener); return () => { orbitListeners.delete(listener); }; },
  destroy };
}

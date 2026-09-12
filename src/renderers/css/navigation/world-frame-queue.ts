import type { WorldFrameRequest } from './world-frame-presenter.js';

export interface PreparedWorldFrame {
  current(): boolean;
  commit(camera: () => void): void;
}
export interface QueuedRequest extends WorldFrameRequest { cancelled?(): void; presented?(): void; }

/** Complete views cross the worker boundary together. New input replaces only
 * the pending request; normal motion never starves an already planned frame. */
export function createWorldFrameQueue(prepare: (request: WorldFrameRequest) => Promise<PreparedWorldFrame>,
  clock = { request: (callback: FrameRequestCallback) => requestAnimationFrame(callback), cancel: (id: number) => cancelAnimationFrame(id) }) {
  let destroyed = false;
  let running: QueuedRequest | null = null;
  let latest: QueuedRequest | null = null;
  let pending: QueuedRequest | null = null;
  let completed: { request: QueuedRequest; frame: PreparedWorldFrame } | null = null;
  let presentationFrame: number | null = null;
  let requested = 0, committed = 0, superseded = 0, discarded = 0;
  let refreshPending = false;
  const presentCompleted = () => {
    presentationFrame = null;
    const ready = completed; completed = null;
    if (destroyed || !ready) return;
    const { request, frame } = ready;
    try {
      if (!request.current()) { discarded++; request.cancelled?.(); }
      else if (!frame.current()) {
        discarded++; if (!pending && running !== latest) pending = latest ?? request;
        if (pending !== request) request.cancelled?.();
      }
      else {
        frame.commit(request.commit); committed++; request.presented?.();
        // An annotation change that arrived while this frame was planned is
        // published by one more delta frame, not by discarding this one.
        if (refreshPending && !pending && latest?.current()) { requested++; pending = latest; }
      }
    } catch (error) { if (request.current()) request.fail(error); }
    refreshPending = false;
    void pump();
  };
  const pump = async () => {
    if (destroyed || running || completed || !pending) return;
    const request = pending; pending = null;
    if (!request.current()) { discarded++; request.cancelled?.(); return; }
    running = request;
    try {
      const frame = await prepare(request);
      if (!destroyed && request.current()) {
        // The next plan reads this publication's retained label/visibility
        // history. Hold it until presentation, coalescing newer input meanwhile.
        // Camera, annotations and picking commit as one captured view per rAF.
        completed = { request, frame };
        presentationFrame ??= clock.request(presentCompleted);
      } else { discarded++; request.cancelled?.(); }
    } catch (error) {
      if (!destroyed && request.current()) request.fail(error);
    } finally {
      running = null;
      if (!destroyed) void pump();
    }
  };
  const present = (request: QueuedRequest) => {
      if (destroyed) { request.cancelled?.(); return; }
      latest = request;
      requested++; if (pending) { superseded++; if (pending !== request) pending.cancelled?.(); }
      pending = request; void pump();
  };
  return {
    present,
    // A flight without a mounted detail still uses this same queue. Its next
    // checkpoint cannot be claimed as painted until the whole view commits.
    presentAndWait(request: WorldFrameRequest, signal: AbortSignal): Promise<boolean> {
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (shown: boolean, error?: unknown) => {
          if (settled) return;
          settled = true; signal.removeEventListener('abort', cancel);
          if (error !== undefined) reject(error); else resolve(shown);
        };
        const cancel = () => settle(false);
        if (signal.aborted || destroyed) { cancel(); return; }
        signal.addEventListener('abort', cancel, { once: true });
        present({ ...request, current: () => !signal.aborted && request.current(),
          cancelled: cancel, presented: () => settle(true),
          fail(error) { try { request.fail(error); } finally { settle(false, error); } } });
      });
    },
    // Initial mounting commits synchronously. Retain that owner's captured
    // camera so an idle hover/selection can use the same worker as motion.
    remember(request: WorldFrameRequest) { if (!destroyed) latest = request; },
    refresh() {
      if (destroyed || !latest?.current()) return false;
      // A changed presentation revision invalidates an in-flight plan. Let it
      // replan the newest input; never replace pending motion with an old eye.
      if (pending) return true;
      if (running === latest || completed?.request === latest) { refreshPending = true; return true; }
      requested++;
      pending = latest; void pump();
      return true;
    },
    stats: () => ({ requested, committed, superseded, discarded,
      inFlight: Number(running !== null), pending: Number(pending !== null), ready: Number(completed !== null) }),
    destroy() { destroyed = true;
      for (const request of new Set([running, pending, completed?.request, latest])) request?.cancelled?.();
      pending = null; latest = null; completed = null;
      if (presentationFrame !== null) clock.cancel(presentationFrame); presentationFrame = null; },
  };
}

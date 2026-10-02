import { opacityClockFor, type OpacityClock, type OpacityWindow } from '../stars/opacity-clock.js';
import type { WorldFrameRequest } from './world-frame-presenter.js';

export interface PreparedWorldFrame {
  current(): boolean;
  commit(camera: () => void): void;
}
export interface QueuedRequest extends WorldFrameRequest { cancelled?(): void; presented?(): void; }

/** Whether two requests ask for the same view: the same world camera and the same viewport snapshot, value for value. */
export function sameWorldView(a: Pick<WorldFrameRequest, 'world' | 'viewport'>, b: Pick<WorldFrameRequest, 'world' | 'viewport'>): boolean {
  const { world: wa, viewport: va } = a, { world: wb, viewport: vb } = b;
  return wa.referenceFrame === wb.referenceFrame && wa.epochJdTt === wb.epochJdTt && wa.projectionScale === wb.projectionScale
    && wa.pose.positionM.length === wb.pose.positionM.length && wa.pose.positionM.every((value, axis) => value === wb.pose.positionM[axis])
    && wa.pose.orientationXyzw.length === wb.pose.orientationXyzw.length && wa.pose.orientationXyzw.every((value, axis) => value === wb.pose.orientationXyzw[axis])
    && va.focalPixels === vb.focalPixels && va.projectionScale === vb.projectionScale && va.widthPixels === vb.widthPixels && va.heightPixels === vb.heightPixels
    && va.coveredTopPixels === vb.coveredTopPixels
    && va.principalOffsetPixels[0] === vb.principalOffsetPixels[0] && va.principalOffsetPixels[1] === vb.principalOffsetPixels[1];
}

/** Complete views cross the worker boundary together. New input replaces only
 * the pending request; normal motion never starves an already planned frame. */
export function createWorldFrameQueue(prepare: (request: WorldFrameRequest) => Promise<PreparedWorldFrame>,
  /** The document's one frame clock (opacity-clock.ts) by default. */
  clock: Pick<OpacityClock, 'request' | 'cancel'> = opacityClockFor(globalThis as unknown as OpacityWindow)) {
  let destroyed = false;
  let running: QueuedRequest | null = null;
  let latest: QueuedRequest | null = null;
  let pending: QueuedRequest | null = null;
  // `riders`: requests for the same view as a warmed frame, committed and acknowledged with it instead of planning it again.
  let completed: { request: QueuedRequest; frame: PreparedWorldFrame; riders: QueuedRequest[] | null } | null = null;
  // A warm-up plans a view nobody has asked the queue to draw yet. Its frame is used only by the next request for that
  // same view, and only while the presentation it read stands; any other request discards it and plans as it always did.
  // `stale`: a change arrived while nobody owned the view (a refresh before the mounting scene enabled its presenter);
  // like a refresh during a plan, the frame still commits and one more plan follows it with the changed state.
  // The planner admits one plan at a time, so a warm-up in flight is never dropped before its plan returns.
  let warming: { request: QueuedRequest; stale: boolean } | null = null;
  let warmed: { request: QueuedRequest; frame: PreparedWorldFrame; stale: boolean } | null = null;
  let presentationFrame: number | null = null;
  let requested = 0, committed = 0, superseded = 0, discarded = 0, warmPlanned = 0, warmAdopted = 0, warmDiscarded = 0, ridden = 0;
  let refreshPending = false;
  const staleWarm = () => { if (warmed) warmed.stale = true; if (warming) warming.stale = true; };
  const presentCompleted = () => {
    presentationFrame = null;
    const ready = completed; completed = null;
    if (destroyed || !ready) return;
    const { request, frame, riders } = ready;
    const others = riders ?? [];
    try {
      if (!request.current()) {
        discarded++; request.cancelled?.();
        // A rider that is still current is replanned: its owner still waits for this view.
        for (const rider of others) { if (!pending && rider.current()) pending = rider; else rider.cancelled?.(); }
      }
      else if (!frame.current()) {
        discarded++; if (!pending && running !== latest) pending = latest ?? request;
        if (pending !== request) request.cancelled?.();
        for (const rider of others) if (pending !== rider) rider.cancelled?.();
      }
      else {
        const live = others.filter(rider => rider.current());
        for (const rider of others) if (!live.includes(rider)) rider.cancelled?.();
        frame.commit(() => { request.commit(); for (const rider of live) rider.commit(); });
        committed++; ridden += live.length; request.presented?.(); for (const rider of live) rider.presented?.();
        // An annotation change that arrived while this frame was planned is
        // published by one more delta frame, not by discarding this one.
        if (refreshPending && !pending && latest?.current()) { requested++; pending = latest; }
      }
    } catch (error) { if (request.current()) request.fail(error); for (const rider of others) if (rider.current()) rider.fail(error); }
    refreshPending = false;
    void pump();
  };
  const pump = async () => {
    if (destroyed || running || completed || warming || !pending) return;
    const request = pending; pending = null;
    if (!request.current()) { discarded++; request.cancelled?.(); return; }
    const warm = warmed; warmed = null;
    if (warm) {
      // The warmed frame is this request's own plan only for the identical view, read from a presentation nothing has
      // changed since; it then takes the frame's place in the queue and waits for the same presentation frame.
      if (sameWorldView(warm.request, request) && warm.frame.current()) {
        warmAdopted++;
        if (warm.stale) refreshPending = true;
        completed = { request, frame: warm.frame, riders: [] };
        presentationFrame ??= clock.request(presentCompleted);
        return;
      }
      warmDiscarded++; warm.request.cancelled?.();
    }
    running = request;
    try {
      const frame = await prepare(request);
      if (!destroyed && request.current()) {
        // The next plan reads this publication's retained label/visibility
        // history. Hold it until presentation, coalescing newer input meanwhile.
        // Camera, annotations and picking commit as one captured view per rAF.
        completed = { request, frame, riders: null };
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
      requested++;
      // A request for the view a warmed frame already holds, and nothing newer queued, is acknowledged with that frame.
      if (completed?.riders && !pending && sameWorldView(completed.request, request) && completed.request.current() && completed.frame.current()) {
        completed.riders.push(request); return;
      }
      if (pending) { superseded++; if (pending !== request) pending.cancelled?.(); }
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
    /** Plan `request`'s view now, without drawing it, while the queue is idle: the next request for the identical view
     * commits this plan instead of making its own. A failed warm-up is dropped silently; that request plans again and
     * meets the planner's error itself. False when the queue is busy or gone, and nothing was planned. */
    warm(request: QueuedRequest): boolean {
      if (destroyed || running || pending || completed || warming || warmed || !request.current()) { request.cancelled?.(); return false; }
      const slot = { request, stale: false };
      warming = slot; warmPlanned++;
      void (async () => {
        let frame: PreparedWorldFrame | null = null;
        try { frame = await prepare(request); } catch { frame = null; }
        if (warming === slot) warming = null;
        if (!destroyed && frame && request.current()) warmed = { request, frame, stale: slot.stale };
        else if (!destroyed) { warmDiscarded++; request.cancelled?.(); }
        // A request that arrived meanwhile waited for the planner; it goes now.
        if (!destroyed) void pump();
      })();
      return true;
    },
    refresh() {
      // A change with no owner to replan it yet (the mounting scene has not enabled its presenter) follows the warm-up.
      if (destroyed || !latest?.current()) { staleWarm(); return false; }
      // A changed presentation revision invalidates an in-flight plan. Let it
      // replan the newest input; never replace pending motion with an old eye.
      if (pending) return true;
      if (running === latest || completed?.request === latest) { refreshPending = true; return true; }
      requested++;
      pending = latest; void pump();
      return true;
    },
    stats: () => ({ requested, committed, superseded, discarded, warmPlanned, warmAdopted, warmDiscarded, ridden,
      inFlight: Number(running !== null), pending: Number(pending !== null), ready: Number(completed !== null), warm: Number(warming !== null || warmed !== null) }),
    destroy() { destroyed = true;
      for (const request of new Set([running, pending, completed?.request, ...(completed?.riders ?? []), latest, warming?.request, warmed?.request])) request?.cancelled?.();
      pending = null; latest = null; completed = null; warming = null; warmed = null;
      if (presentationFrame !== null) clock.cancel(presentationFrame); presentationFrame = null; },
  };
}

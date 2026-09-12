export interface OpacityWindow {
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
  performance: { now(): number };
}
type Publisher = (time: number, advance: boolean) => boolean;
/** Input (pointer cadence, hover picking) resolves before the presentation that
 * reads it; fades flush after every commit. A lane makes that order explicit
 * instead of leaving it to whichever owner registered its callback first. */
export type FrameLane = 'input' | 'present';

/** `requestAnimationFrame` belongs to the document, so one clock does too: every
 * owner in a scene shares this instance, and the browser services one callback
 * per frame instead of one per owner. The last owner to release it stops it. */
const shared = new WeakMap<OpacityWindow, { clock: ReturnType<typeof createFrameClock>; owners: number }>();
export function createOpacityClock(window: OpacityWindow): OpacityClock {
  const entry = shared.get(window) ?? { clock: createFrameClock(window), owners: 0 };
  entry.owners++; shared.set(window, entry);
  let released = false;
  return Object.freeze({ ...entry.clock, destroy() {
    if (released) return;
    released = true;
    if (--entry.owners > 0) return;
    shared.delete(window); entry.clock.destroy();
  } });
}

/** Camera commits run first; their final alpha values and active fades flush
 * together afterwards. An alpha-only tick never requests a world projection. */
function createFrameClock(window: OpacityWindow) {
  const lanes: Readonly<Record<FrameLane, Map<number, FrameRequestCallback>>> = { input: new Map(), present: new Map() };
  const callbacks = { get size() { return lanes.input.size + lanes.present.size; }, clear() { lanes.input.clear(); lanes.present.clear(); } };
  const dirty = new Set<Publisher>(), active = new Set<Publisher>();
  let next = 0, frame: number | null = null, depth = 0, presenting = false, destroyed = false;
  let timestamp: number | null = null;
  const now = () => timestamp ?? window.performance.now();
  const schedule = () => {
    const needed = callbacks.size > 0 || dirty.size > 0 || active.size > 0;
    if (destroyed || presenting) return;
    if (needed) frame ??= window.requestAnimationFrame(tick);
    else if (frame !== null) { window.cancelAnimationFrame(frame); frame = null; }
  };
  const flush = (advance = false) => {
    // A setter publishes dirty state only. Advancing unrelated active fades
    // here turns a loop of N setters into N scans of the entire fade set.
    const pending = new Set(advance ? [...active, ...dirty] : dirty); dirty.clear();
    for (const publish of pending) {
      if (publish(now(), advance)) active.add(publish); else active.delete(publish);
    }
  };
  const tick = (time: number) => {
    frame = null; presenting = true; timestamp = time;
    const ready = [...lanes.input.values(), ...lanes.present.values()];
    lanes.input.clear(); lanes.present.clear();
    try { for (const callback of ready) callback(time); }
    finally { try { flush(true); } finally { timestamp = null; presenting = false; schedule(); } }
  };
  return {
    now,
    request(callback: FrameRequestCallback, lane: FrameLane = 'present') { const id = ++next; if (!destroyed) { lanes[lane].set(id, callback); schedule(); } return id; },
    cancel(id: number) { lanes.input.delete(id); lanes.present.delete(id); schedule(); },
    changed(publish: Publisher) {
      if (destroyed) return;
      dirty.add(publish);
      if (!presenting && depth === 0) flush();
      schedule();
    },
    remove(publish: Publisher) { dirty.delete(publish); active.delete(publish); schedule(); },
    batch<T>(work: () => T): T {
      depth++;
      try { return work(); }
      finally { if (--depth === 0 && !presenting) { flush(); schedule(); } }
    },
    destroy() {
      destroyed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null; callbacks.clear(); dirty.clear(); active.clear();
    },
  };
}
export type OpacityClock = ReturnType<typeof createFrameClock>;

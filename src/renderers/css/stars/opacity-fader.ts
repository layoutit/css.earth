export interface OpacityFaderWindow {
  readonly requestAnimationFrame: (callback: (time: number) => void) => number;
  readonly cancelAnimationFrame: (handle: number) => void;
  readonly performance: { readonly now: () => number };
}

interface Entry {
  readonly element: HTMLElement;
  current: number;
  target: number;
  from: number;
  started: number;
  duration: number;
}

/** Retained, wall-time opacity interpolation without CSS or Web Animations. */
export function createOpacityFader(windowTarget: OpacityFaderWindow) {
  const entries = new Map<HTMLElement, Entry>();
  let frame: number | null = null;
  let destroyed = false;

  const now = () => windowTarget.performance.now();
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const read = (element: HTMLElement) => {
    const value = Number.parseFloat(element.style.opacity);
    return Number.isFinite(value) ? clamp(value) : 0;
  };
  const write = (entry: Entry, value: number) => {
    entry.current = clamp(value);
    entry.element.style.opacity = String(entry.current);
  };
  const valueAt = (entry: Entry, timestamp: number) => {
    if (entry.current === entry.target || entry.duration <= 0) return entry.current;
    const progress = Math.max(0, Math.min(1, (timestamp - entry.started) / entry.duration));
    return entry.from + (entry.target - entry.from) * progress;
  };
  const schedule = () => {
    if (destroyed || frame !== null) return;
    frame = windowTarget.requestAnimationFrame(tick);
  };
  const hasActive = () => { for (const entry of entries.values()) if (entry.current !== entry.target) return true; return false; };
  const tick = (time: number) => {
    frame = null;
    let active = false;
    for (const entry of entries.values()) {
      if (entry.current === entry.target) continue;
      const progress = entry.duration > 0 ? Math.max(0, Math.min(1, (time - entry.started) / entry.duration)) : 1;
      write(entry, entry.from + (entry.target - entry.from) * progress);
      if (progress < 1) active = true;
    }
    if (active) schedule();
  };

  return Object.freeze({
    set(element: HTMLElement, alpha: number, durationMs = 0, preserveDeadline = false) {
      if (destroyed) return;
      const target = clamp(alpha), duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
      const timestamp = now();
      let entry = entries.get(element);
      if (!entry) {
        entry = { element, current: read(element), target, from: read(element), started: timestamp, duration };
        entries.set(element, entry);
      } else if (entry.target === target && entry.current === target) {
        if (duration === 0 && entry.duration !== 0) {
          entry.from = entry.current;
          entry.started = timestamp;
          entry.duration = 0;
        }
        return;
      } else if (entry.target === target && entry.duration === duration) {
        return;
      } else {
        entry.current = valueAt(entry, timestamp);
        entry.from = entry.current;
        entry.target = target;
        if (preserveDeadline && entry.duration > 0) {
          const deadline = entry.started + entry.duration;
          entry.started = timestamp;
          entry.duration = Math.max(0, deadline - timestamp);
        } else {
          entry.started = timestamp;
          entry.duration = duration;
        }
      }
      if (duration === 0) {
        write(entry, target);
        return;
      }
      schedule();
    },
    cancel(element: HTMLElement) {
      entries.delete(element);
      if (!hasActive() && frame !== null) {
        windowTarget.cancelAnimationFrame(frame);
        frame = null;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      entries.clear();
    },
  });
}

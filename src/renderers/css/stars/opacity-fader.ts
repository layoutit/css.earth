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
  written: number;
}

/** Retained, wall-time opacity interpolation without CSS or Web Animations. */
export function createOpacityFader(windowTarget: OpacityFaderWindow, multiplier?: string) {
  const entries = new Map<HTMLElement, Entry>();
  const active = new Set<Entry>();
  let frame: number | null = null;
  let destroyed = false;

  const now = () => windowTarget.performance.now();
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const read = (element: HTMLElement) => {
    // A cancelled fade can be adopted again from its last published alpha.
    const opacity = element.style.opacity;
    const value = Number.parseFloat(multiplier && opacity.startsWith('calc(') ? opacity.slice(5) : opacity);
    return Number.isFinite(value) ? clamp(value) : 0;
  };
  const write = (entry: Entry, value: number) => {
    entry.current = clamp(value);
    if (entry.written !== entry.current) {
      entry.written = entry.current;
      // Hover policy stays in CSS; changing alpha never changes an inherited
      // custom property or requires a computed-style read.
      entry.element.style.opacity = multiplier
        ? `calc(${entry.current} * ${multiplier})` : String(entry.current);
    }
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
  const cancelIfSettled = () => {
    if (active.size === 0 && frame !== null) {
      windowTarget.cancelAnimationFrame(frame);
      frame = null;
    }
  };
  const tick = (time: number) => {
    frame = null;
    for (const entry of active) {
      const progress = entry.duration > 0 ? Math.max(0, Math.min(1, (time - entry.started) / entry.duration)) : 1;
      write(entry, progress === 1 ? entry.target : entry.from + (entry.target - entry.from) * progress);
      if (progress === 1) active.delete(entry);
    }
    if (active.size > 0) schedule();
  };

  return Object.freeze({
    current(element: HTMLElement) { return entries.get(element)?.current ?? read(element); },
    set(element: HTMLElement, alpha: number, durationMs = 0, preserveDeadline = false) {
      if (destroyed) return;
      const target = clamp(alpha), duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
      let entry = entries.get(element);
      if (entry && entry.target === target && (entry.current === target || entry.duration === duration)) {
        if (duration === 0) entry.duration = 0;
        return;
      }
      const timestamp = now();
      if (!entry) {
        const current = read(element);
        entry = { element, current, written: Number.NaN, target, from: current, started: timestamp, duration };
        entries.set(element, entry);
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
      if (duration === 0 || entry.duration === 0 || entry.current === target) {
        write(entry, target);
        active.delete(entry);
        cancelIfSettled();
        return;
      }
      active.add(entry);
      schedule();
    },
    cancel(element: HTMLElement) {
      const entry = entries.get(element);
      if (entry) { active.delete(entry); entries.delete(element); }
      cancelIfSettled();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== null) windowTarget.cancelAnimationFrame(frame);
      frame = null;
      entries.clear();
      active.clear();
    },
  });
}

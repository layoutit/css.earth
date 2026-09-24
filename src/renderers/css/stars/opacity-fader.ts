import { opacityClockFor, type OpacityClock, type OpacityWindow } from './opacity-clock.js';
export type OpacityFaderWindow = OpacityWindow;
type Track = { from: number; target: number; started: number; duration: number; ease: boolean };
/** Whatever carries an inline opacity: a DOM element, or an owner's adapter that maps it elsewhere. */
export interface FadeTarget { readonly style: { opacity: string; visibility: string } }
interface Entry { element: FadeTarget; alpha: Track; multiplier: Track; suppression: Track; visible: boolean; written: number; }
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const fixed = (value: number): Track => ({ from: value, target: value, started: 0, duration: 0, ease: false });

// The authored CSS `ease` curve: cubic-bezier(.25,.1,.25,1).
function ease(progress: number) {
  let lo = 0, hi = 1, t = progress;
  for (let i = 0; i < 20; i++) {
    const x = .75 * t * (1 - t) + t * t * t;
    if (Math.abs(x - progress) < 1e-7) break;
    if (x < progress) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) ** 2 * t * .1 + 3 * (1 - t) * t * t + t * t * t;
}
const valueAt = (track: Track, time: number) => {
  if (track.duration === 0 || time >= track.started + track.duration) return track.target;
  const p = Math.max(0, (time - track.started) / track.duration);
  return track.from + (track.target - track.from) * (track.ease ? ease(p) : p);
};
const running = (track: Track, time: number) => track.from !== track.target && time < track.started + track.duration;

/** One numeric opacity writer. Independent authored factors are evaluated on
 * one clock, then multiplied once; CSS/WAAPI never re-animate its output. */
export function createOpacityFader(window: OpacityWindow, sharedClock?: OpacityClock) {
  const clock = sharedClock ?? opacityClockFor(window);
  const entries = new Map<FadeTarget, Entry>(), pending = new Set<Entry>(), dirty = new Set<Entry>();
  let destroyed = false, animationEnabled = true;
  const entryFor = (element: FadeTarget) => {
    let entry = entries.get(element);
    if (!entry) {
      const initial = clamp(Number.parseFloat(element.style.opacity));
      entry = { element, alpha: fixed(initial), multiplier: fixed(1), suppression: fixed(1), visible: true, written: Number.NaN };
      entries.set(element, entry);
    }
    return entry;
  };
  const flush = (time: number, advance: boolean) => {
    const publishing = advance ? new Set([...pending, ...dirty]) : new Set(dirty);
    dirty.clear();
    for (const entry of publishing) {
      const alpha = entry.visible ? valueAt(entry.alpha, time) * valueAt(entry.multiplier, time) * valueAt(entry.suppression, time) : 0;
      if (entry.written !== alpha) { entry.element.style.opacity = String(alpha); entry.written = alpha; }
      if (!entry.visible || (entry.suppression.target === 0 && !running(entry.suppression, time)) ||
          !(running(entry.alpha, time) || running(entry.multiplier, time) || running(entry.suppression, time))) pending.delete(entry);
      else pending.add(entry);
    }
    return pending.size > 0;
  };
  const changed = (entry: Entry) => {
    if (entry.visible) dirty.add(entry);
    clock.changed(flush);
  };
  const target = (entry: Entry, track: Track, alpha: number, duration: number, preserveDeadline = false, eased = false) => {
    const value = clamp(alpha), time = clock.now(), ms = animationEnabled && Number.isFinite(duration) ? Math.max(0, duration) : 0;
    if (track.target === value && (ms > 0 || track.duration === 0)) return;
    const current = valueAt(track, time), deadline = track.started + track.duration;
    track.from = current; track.target = value; track.started = time;
    track.duration = preserveDeadline && track.duration > 0 ? Math.max(0, deadline - time) : ms;
    if (ms === 0 || current === value) track.duration = 0;
    track.ease = eased;
    changed(entry);
  };
  return Object.freeze({
    setAnimationEnabled(enabled: boolean) {
      if (destroyed || enabled === animationEnabled) return;
      animationEnabled = enabled;
      if (enabled || pending.size === 0) return;
      // Camera motion adopts the current targets once. No fade clock keeps waking
      // behind the camera, and enabling animation never resumes old tracks.
      for (const entry of pending) {
        for (const track of [entry.alpha, entry.multiplier, entry.suppression]) {
          track.from = track.target; track.duration = 0;
        }
        dirty.add(entry);
      }
      clock.changed(flush);
    },
    current(element: FadeTarget) { const entry = entries.get(element); return entry ? valueAt(entry.alpha, clock.now()) : clamp(Number.parseFloat(element.style.opacity)); },
    set(element: FadeTarget, alpha: number, durationMs = 0, preserveDeadline = false) {
      if (destroyed) return;
      const entry = entryFor(element);
      target(entry, entry.alpha, alpha, durationMs, preserveDeadline);
      if (Number.isNaN(entry.written)) changed(entry);
    },
    multiply(element: FadeTarget, alpha: number, durationMs = 0) {
      if (destroyed) return;
      const entry = entryFor(element); target(entry, entry.multiplier, alpha, durationMs, false, true);
    },
    suppress(element: FadeTarget, suppressed: boolean, durationMs = 0) {
      if (destroyed) return;
      const entry = entryFor(element); target(entry, entry.suppression, suppressed ? 0 : 1, durationMs, false, true);
    },
    visible(element: FadeTarget, visible: boolean) {
      const entry = entries.get(element);
      if (destroyed || !entry || entry.visible === visible) return;
      entry.visible = visible;
      dirty.add(entry); clock.changed(flush);
    },
    cancel(element: FadeTarget) { const entry = entries.get(element); if (entry) { pending.delete(entry); dirty.delete(entry); } entries.delete(element); if (pending.size === 0 && dirty.size === 0) clock.remove(flush); },
    batch: clock.batch,
    stats: () => ({ active: pending.size, retained: entries.size }),
    destroy() { destroyed = true; pending.clear(); dirty.clear(); entries.clear(); clock.remove(flush); },
  });
}

import type { ObjectSharedView } from '../src/renderers/css/runtime/object-scene.js';
import { formatSharedView } from "../src/renderers/css/dist/navigation.js";

// One URL owner in the shared shell. Camera publication only schedules a
// bounded history write; native motion is sampled once per second while on.
export function bindViewUrl({ windowTarget, view, getMotion, replace, onError = () => {} }: {
  windowTarget: Window; view: ObjectSharedView; getMotion(): boolean;
  replace(url: string): void; onError?(error: unknown): void;
}) {
  let timer: number | null = null, dueAt = Infinity, lastChange = -Infinity, destroyed = false, started = false;
  let restored: { incoming: string; captured: string | null } | null = null;
  const now = () => windowTarget.performance.now();
  const clear = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; dueAt = Infinity; };
  const arm = (delay: number, callback: () => void) => { clear(); dueAt = now() + delay; timer = windowTarget.setTimeout(callback, delay); };
  function writeToken(token: string) {
    const url = new URL(windowTarget.location.href);
    if (url.searchParams.get("v") === token) return;
    url.searchParams.set("v", token);
    replace(url.href);
  }
  const captureToken = () => {
    const saved = view.capture(getMotion());
    return saved ? new URLSearchParams(formatSharedView(saved)).get('v') : null;
  };
  function capture() {
    const token = captureToken();
    // Restoring a camera can round-trip through world coordinates. Preserve its
    // incoming bytes while the applied camera/playback state remains unchanged.
    if (restored && token === restored.captured) return restored.incoming;
    restored = null;
    return token;
  }
  function flush() {
    clear();
    if (destroyed || !started) return;
    try {
      const token = capture();
      if (token !== null) writeToken(token);
    } catch (error) { onError(error); }
    if (getMotion() && !destroyed) arm(1000, flush);
  }
  // Camera publication moves a trailing deadline. The pending timer re-arms
  // for the remaining quiet period instead of being replaced on every frame.
  function settle() {
    timer = null; dueAt = Infinity;
    const wait = lastChange + 150 - now();
    if (wait > 0) arm(wait, settle); else flush();
  }
  function schedule() {
    if (destroyed || !started) return;
    lastChange = now();
    if (timer !== null && dueAt <= lastChange + 150) return;
    arm(150, settle);
  }
  // Arrival enables publication only after camera, focus and playback agree.
  // Pin an incoming token to the resulting camera without round-tripping its bytes.
  function start(incoming: string | null = null) {
    if (destroyed || started) return;
    try {
      if (incoming && new URL(windowTarget.location.href).searchParams.get('v') === incoming) {
        restored = { incoming, captured: captureToken() };
      }
    } catch (error) { onError(error); }
    started = true;
    if (getMotion()) arm(1000, flush);
    else if (!new URL(windowTarget.location.href).searchParams.has('v')) schedule();
  }
  const unsubscribe = view.subscribe(schedule);
  return Object.freeze({
    start, capture, schedule, flush,
    destroy() {
      if (destroyed) return;
      destroyed = true; clear(); unsubscribe();
    },
  });
}

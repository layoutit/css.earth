import type { ObjectSharedView } from '@cssearth/renderer/runtime/object-scene.ts';
import { formatSharedView } from "@cssearth/renderer/navigation";

// One URL owner in the shared shell. The URL is written once per interaction, when the camera has come to rest and stayed
// there for a quiet period: a drag after its release and any throw, a run of wheel notches or a pinch after its glide, a
// flight on arrival. While the camera moves nothing is
// written and no timer runs; the renderer announces start and rest as `objectmotionchange` (camera-motion-signal.ts).
// A change at rest that no motion announces (a dataset, a playback toggle, a restore) is written once, after a short quiet
// period. Playback rotation is not written: the URL keeps that motion is on, not the spin angle. Each iPad Safari
// `replaceState` dispatches a navigate event and can re-run Reader detection over the page (up to 24 ms, 2026-09-30).
const QUIET_MS = 150;

export function bindViewUrl({ windowTarget, view, getMotion, replace, onError = () => {} }: {
  windowTarget: Window; view: ObjectSharedView; getMotion(): boolean;
  replace(url: string): void; onError?(error: unknown): void;
}) {
  let timer: number | null = null, destroyed = false, started = false, moving = false, changed = false;
  let restored: { incoming: string; captured: string | null } | null = null;
  const clear = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
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
  /** Write the current view now, if it differs from the URL's. */
  function flush() {
    clear(); changed = false;
    if (destroyed || !started) return;
    try {
      const token = capture();
      if (token !== null) writeToken(token);
    } catch (error) { onError(error); }
  }
  /** A change at rest that no motion announces: one write after a quiet period. */
  function schedule() {
    if (destroyed || !started) return;
    changed = true;
    if (moving) return;
    clear();
    timer = windowTarget.setTimeout(flush, QUIET_MS);
  }
  // Camera changes while it moves only mark the view changed; the write waits for rest. Playback rotation at rest is
  // not an interaction and is not written.
  function viewChanged() {
    if (destroyed || !started) return;
    if (moving) { changed = true; return; }
    if (!getMotion()) schedule();
  }
  const motionChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ active?: unknown }>).detail;
    const active = detail?.active === true;
    if (active === moving) return;
    moving = active;
    if (moving) clear();
    // Rest waits a quiet period before writing: wheel notches, or a drag right after a zoom, each come to rest in
    // between, and the run of them writes once at its end.
    else if (changed) { clear(); timer = windowTarget.setTimeout(flush, QUIET_MS); }
  };
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
    if (!new URL(windowTarget.location.href).searchParams.has('v')) schedule();
  }
  const unsubscribe = view.subscribe(viewChanged);
  windowTarget.document.addEventListener('objectmotionchange', motionChanged, { capture: true });
  return Object.freeze({
    start, capture, schedule, flush,
    destroy() {
      if (destroyed) return;
      destroyed = true; clear(); unsubscribe();
      windowTarget.document.removeEventListener('objectmotionchange', motionChanged, { capture: true });
    },
  });
}

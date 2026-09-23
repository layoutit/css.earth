import type { ObjectSharedView } from '../src/renderers/css/runtime/deferred-object-mount.js';
import { formatSharedView, parseSharedView } from "../src/renderers/css/dist/navigation.js";

// One URL owner in the shared shell. Camera publication only schedules a
// bounded history write; native motion is sampled once per second while on.
export function bindViewUrl({ windowTarget, view, getMotion, setMotion, replace, restoreFocus = () => {}, onError = () => {}, listenToPopState = true }: {
  windowTarget: Window; view: ObjectSharedView; getMotion(): boolean; setMotion(value: boolean): void;
  replace(url: string): void; restoreFocus?(url: string): void | Promise<void>;
  onError?(error: unknown): void; listenToPopState?: boolean;
}) {
  let timer: number | null = null, dueAt = Infinity, lastChange = -Infinity, destroyed = false, restoring = false, revision = 0;
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
    if (destroyed || restoring) return;
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
    if (destroyed || restoring) return;
    lastChange = now();
    if (timer !== null && dueAt <= lastChange + 150) return;
    arm(150, settle);
  }
  async function restore() {
    clear();
    const current = ++revision;
    restoring = true; restored = null;
    const href = windowTarget.location.href;
    const currentRestore = () => !destroyed && current === revision;
    try {
      const query = new URL(href).searchParams;
      let applied = false;
      try {
        if (query.getAll("v").length > 1) throw new TypeError("This URL contains more than one saved view.");
        const saved = query.has("v") ? parseSharedView(`v=${query.get("v")}`) : null;
        if (saved && await view.restore(saved) && currentRestore()) {
          setMotion(saved.playback.motionRequested);
          applied = true;
        }
      } catch (error) { if (currentRestore()) onError(error); }
      if (!currentRestore()) return;
      await restoreFocus(href);
      if (applied && currentRestore() && new URL(windowTarget.location.href).searchParams.get('v') === query.get('v')) {
        restored = { incoming: query.get('v')!, captured: captureToken() };
      }
    } catch (error) { if (!destroyed && current === revision) onError(error); }
    finally {
      if (!destroyed && current === revision) {
        restoring = false;
        // Keep an invalid incoming URL intact for diagnosis until the user
        // moves the camera. Current-format links keep their original token.
        if (getMotion()) arm(1000, flush);
        else if (!new URL(windowTarget.location.href).searchParams.has('v')) schedule();
      }
    }
  }
  const unsubscribe = view.subscribe(schedule);
  const onPopState = () => { void restore(); };
  if (listenToPopState) windowTarget.addEventListener("popstate", onPopState);
  return Object.freeze({
    restore, capture, schedule, flush,
    destroy() {
      if (destroyed) return;
      destroyed = true; revision++; clear(); unsubscribe();
      if (listenToPopState) windowTarget.removeEventListener("popstate", onPopState);
    },
  });
}

import type { ObjectSharedView } from '../src/renderers/css/runtime/deferred-object-mount.js';
import { formatSharedView, parseSharedView } from "../src/renderers/css/dist/navigation.js";

// One URL owner in the shared shell. Camera publication only schedules a
// bounded history write; native motion is sampled once per second while on.
export function bindViewUrl({ windowTarget, view, getMotion, setMotion, onError = () => {}, listenToPopState = true }: { windowTarget: Window; view: ObjectSharedView; getMotion(): boolean; setMotion(value: boolean): void; onError?(error: unknown): void; listenToPopState?: boolean }) {
  let timer: number | null = null, dueAt = Infinity, lastChange = -Infinity, destroyed = false, restoring = false, revision = 0;
  const now = () => windowTarget.performance.now();
  const clear = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; dueAt = Infinity; };
  const arm = (delay: number, callback: () => void) => { clear(); dueAt = now() + delay; timer = windowTarget.setTimeout(callback, delay); };
  function writeToken(token: string) {
    const url = new URL(windowTarget.location.href);
    if (url.searchParams.get("v") === token) return;
    url.searchParams.set("v", token);
    windowTarget.history.replaceState(windowTarget.history.state, "", url.pathname + url.search + url.hash);
  }
  function flush() {
    clear();
    if (destroyed || restoring) return;
    try {
      const saved = view.capture(getMotion());
      if (!saved) return;
      const token = new URLSearchParams(formatSharedView(saved)).get("v");
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
    restoring = true;
    try {
      const query = new URLSearchParams(windowTarget.location.search);
      if (query.getAll("v").length > 1) throw new TypeError("This URL contains more than one saved view.");
      const saved = query.has("v") ? parseSharedView(`v=${query.get("v")}`) : null;
      if (saved && await view.restore(saved) && !destroyed && current === revision) {
        setMotion(saved.playback.motionRequested);
      }
    } catch (error) { if (!destroyed && current === revision) onError(error); }
    finally {
      if (!destroyed && current === revision) {
        restoring = false;
        // Keep an invalid incoming URL intact for diagnosis until the user
        // moves the camera. Current-format links keep their original token.
        if (getMotion()) arm(1000, flush);
      }
    }
  }
  const unsubscribe = view.subscribe(schedule);
  const onPopState = () => { void restore(); };
  if (listenToPopState) windowTarget.addEventListener("popstate", onPopState);
  return Object.freeze({
    restore, schedule, flush,
    destroy() {
      if (destroyed) return;
      destroyed = true; revision++; clear(); unsubscribe();
      if (listenToPopState) windowTarget.removeEventListener("popstate", onPopState);
    },
  });
}

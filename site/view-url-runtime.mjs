import { formatSharedView, parseSharedView } from "../src/platform/view-url.mjs";

// One URL owner in the shared shell. Camera publication only schedules a
// bounded history write; native motion is sampled once per second while on.
export function bindViewUrl({ windowTarget, view, getMotion, setMotion, onError = () => {} }) {
  let timer = null, destroyed = false, restoring = false, revision = 0;
  const clear = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
  function flush() {
    clear();
    if (destroyed || restoring) return;
    try {
      const saved = view.capture(getMotion());
      if (!saved) return;
      const url = new URL(windowTarget.location.href);
      const token = new URLSearchParams(formatSharedView(saved)).get("v");
      if (url.searchParams.get("v") !== token) {
        url.searchParams.set("v", token);
        windowTarget.history.replaceState(windowTarget.history.state, "", url.pathname + url.search + url.hash);
      }
    } catch (error) { onError(error); }
    if (getMotion() && !destroyed) timer = windowTarget.setTimeout(flush, 1000);
  }
  function schedule() {
    if (destroyed || restoring) return;
    clear();
    timer = windowTarget.setTimeout(flush, 150);
  }
  async function restore() {
    clear();
    const current = ++revision;
    restoring = true;
    try {
      const query = new URLSearchParams(windowTarget.location.search);
      if (query.getAll("v").length > 1) throw new TypeError("This URL contains more than one saved view.");
      const saved = query.has("v") ? parseSharedView(`v=${query.get("v")}`) : null;
      if (saved && await view.restore(saved) && !destroyed && current === revision) setMotion(saved.playback.motionRequested);
    } catch (error) { if (!destroyed && current === revision) onError(error); }
    finally {
      if (!destroyed && current === revision) {
        restoring = false;
        // Keep an invalid incoming URL intact for diagnosis until the user
        // moves the camera; opening a valid link does not immediately rewrite it.
        if (getMotion()) timer = windowTarget.setTimeout(flush, 1000);
      }
    }
  }
  const unsubscribe = view.subscribe(schedule);
  const onPopState = () => { void restore(); };
  windowTarget.addEventListener("popstate", onPopState);
  return Object.freeze({
    restore, schedule, flush,
    destroy() {
      if (destroyed) return;
      destroyed = true; revision++; clear(); unsubscribe();
      windowTarget.removeEventListener("popstate", onPopState);
    },
  });
}

import { formatSharedView, parseSharedView } from "../src/platform/view-url.mjs";

// One URL owner in the shared shell. Camera publication only schedules a
// bounded history write; native motion is sampled once per second while on.
export function bindViewUrl({ windowTarget, view, getMotion, setMotion, onError = () => {} }) {
  let timer = null, destroyed = false, restoring = false, revision = 0;
  const clear = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
  function writeToken(token) {
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
      writeToken(token);
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
      if (saved && await view.restore(saved) && !destroyed && current === revision) {
        setMotion(saved.playback.motionRequested);
        // Upgrade existing long links using their saved time, rather than a
        // fresh sample of an animation that may already have resumed.
        const compact = new URLSearchParams(formatSharedView(saved)).get("v");
        if (compact.length < query.get("v").length) writeToken(compact);
      }
    } catch (error) { if (!destroyed && current === revision) onError(error); }
    finally {
      if (!destroyed && current === revision) {
        restoring = false;
        // Keep an invalid incoming URL intact for diagnosis until the user
        // moves the camera. Current-format links keep their original token.
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

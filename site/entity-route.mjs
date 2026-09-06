// Entity and lens identity travel with the body route. The body router still
// owns navigation between objects; these entries reuse the current scene.
export function createEntityRoute({ windowTarget, rootId, apply, read }) {
  const path = windowTarget.location.pathname;
  const events = new AbortController();
  let revision = 0, restoring = false, destroyed = false;
  function write({ replace = false } = {}) {
    if (destroyed || restoring || windowTarget.location.pathname !== path) return;
    const { entityId, lensId, defaultLens } = read();
    const url = new URL(windowTarget.location.href), params = new URLSearchParams();
    if (entityId && entityId !== rootId) params.set("place", entityId);
    if (lensId && lensId !== defaultLens) params.set("lens", lensId);
    url.hash = params.toString();
    if (url.href === windowTarget.location.href) return;
    windowTarget.history[replace ? "replaceState" : "pushState"](windowTarget.history.state, "", url);
  }
  async function restore() {
    const current = ++revision;
    restoring = true;
    const params = new URLSearchParams(windowTarget.location.hash.slice(1));
    try { await apply(params.get("place") ?? rootId, params.get("lens"), () => !destroyed && current === revision); }
    finally { if (current === revision) { restoring = false; write({ replace: true }); } }
  }
  windowTarget.addEventListener("popstate", event => {
    if (windowTarget.location.pathname !== path) return;
    event.stopImmediatePropagation();
    void restore();
  }, { signal: events.signal, capture: true });
  return { write, restore, destroy() { destroyed = true; revision++; events.abort(); } };
}

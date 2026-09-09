/** Preserve exact departed views while object selections create history entries. */
export function createNavigationHistory({ windowTarget, objects, capture, navigate, onError = () => {} }) {
  const snapshots = new Map();
  const prefix = crypto.randomUUID();
  let serial = 0, entry = `${prefix}-${++serial}`, disposed = false;
  const state = () => ({ ...(windowTarget.history.state ?? {}), cssEarthEntry: entry });
  function remember() {
    const url = capture();
    if (url) snapshots.set(entry, url);
    return url;
  }
  function checkpoint() {
    const url = remember();
    if (url) windowTarget.history.replaceState({ ...state(), cssEarthView: url }, '', url);
  }
  const onPopState = event => {
    if (disposed) return;
    // location already names the incoming entry. Capture the old scene without
    // replacing that URL; the router retires its continuous URL writer next.
    remember();
    const targetEntry = typeof event.state?.cssEarthEntry === 'string' ? event.state.cssEarthEntry : `${prefix}-${++serial}`;
    const url = snapshots.get(targetEntry) ?? event.state?.cssEarthView ?? windowTarget.location.href;
    const location = new URL(url, windowTarget.location.href);
    const object = objects.find(object => object.route === location.pathname);
    if (!object) return;
    Promise.resolve(navigate(object.id, { history: 'pop', url: location.href, entry: targetEntry })).catch(onError);
  };
  checkpoint();
  windowTarget.addEventListener('popstate', onPopState);
  return Object.freeze({
    checkpoint, remember,
    commit(url, { history = 'push', entry: targetEntry } = {}) {
      if (disposed) return;
      entry = history === 'pop' ? targetEntry : history === 'push' ? `${prefix}-${++serial}` : entry;
      const value = new URL(url, windowTarget.location.href), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      windowTarget.history[history === 'push' ? 'pushState' : 'replaceState']({ ...state(), cssEarthView: path }, '', path);
    },
    destroy() { if (!disposed) { disposed = true; windowTarget.removeEventListener('popstate', onPopState); } },
  });
}

export function bindNavigationLinks({ documentTarget, windowTarget, objects, supports, navigate, deselect, onError = () => {} }) {
  const available = id => typeof id === 'string' && objects.some(object => object.id === id) && supports(id);
  const query = event => { if (available(event.detail?.objectId)) event.preventDefault(); };
  const select = event => {
    const id = event.detail?.objectId;
    if (!available(id)) return;
    event.preventDefault();
    Promise.resolve(navigate(id, { sceneSelection: true })).catch(onError);
  };
  const click = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, windowTarget.location.href);
    if (url.origin !== windowTarget.location.origin) return;
    const object = objects.find(object => object.route === url.pathname);
    if (!object || !supports(object.id)) return;
    event.preventDefault();
    Promise.resolve(navigate(object.id, url.search || url.hash ? { url: url.href } : { sceneSelection: true })).catch(onError);
  };
  const clear = event => {
    if (!deselect || event.defaultPrevented) return;
    event.preventDefault();
    Promise.resolve(deselect()).catch(onError);
  };
  documentTarget.addEventListener('objectdeselect', clear);
  documentTarget.addEventListener('click', click);
  documentTarget.addEventListener('objectnavigate', select);
  documentTarget.addEventListener('objectnavigationquery', query);
  return () => {
    documentTarget.removeEventListener('objectdeselect', clear);
    documentTarget.removeEventListener('click', click);
    documentTarget.removeEventListener('objectnavigate', select);
    documentTarget.removeEventListener('objectnavigationquery', query);
  };
}

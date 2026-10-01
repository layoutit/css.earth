/** The first view's documents, requested by the page's head script while the HTML still parses, long before the module that
 * reads each one loads (`ObjectLayout.astro`). Each response is taken once by its reader, which fetches it itself when the
 * head did not (a navigation, a later mount, a custom view). WebKit does not reuse `<link rel=preload as=fetch>` for
 * `fetch()`, so the head starts the requests itself. */
type StartupRequests = Map<string, Promise<Response>>;
declare global { interface Window { __cssEarthStartupRequests?: StartupRequests } }

/** Runs in the static document's head: one request per URL, kept for its reader. The object transport is requested only at
 * the default view of the page's own scene (`sceneRoute`, or the site root): a custom view (a query, a catalogue focus's
 * path) may be served other markup (`dataset-response.mts`), so its reader picks the transport itself. */
export function startStartupRequests(window: Window, urls: readonly string[], transportUrl: string, sceneRoute: string) {
  const location = window.location, query = new URLSearchParams(location.search);
  const defaultView = (location.pathname === '/' || location.pathname === sceneRoute) &&
    !['overview', 'view', 'dataset', 'feature', 'v', 'settings', 'q'].some(key => query.has(key));
  const requests = new Map();
  for (const url of defaultView ? [transportUrl, ...urls] : urls) {
    const response = fetch(url);
    // A request nobody reads must not report an unhandled rejection; its reader sees the failure.
    response.catch(() => {});
    requests.set(url, response);
  }
  window.__cssEarthStartupRequests = requests;
}

/** The head script of a body page: its directory entry, its system view when it hosts one, and its object transport, named
 * as `packaged-object-runtime.mts` reads it: a page that ships its body's markup reads the first-view transport, a page with
 * an arrival billboard the full one. */
export function startupRequestsBootstrap({ objectId, serverMarkup, systemView }: { objectId: string; serverMarkup: boolean; systemView: boolean }) {
  const urls = [`/objects/${objectId}/entry.json`, ...systemView ? [`/world/system-views/${objectId}.json`] : []];
  const transportUrl = `/objects/${objectId}/${serverMarkup ? 'first-view' : 'object'}.json`;
  const args = [urls, transportUrl, `/${objectId}/`].map(value => JSON.stringify(value).replace(/</gu, '\\u003c'));
  return `(${startStartupRequests.toString()})(window, ${args.join(', ')});`;
}

/** `fetch(url)`, adopting the head's request for `url` once. */
export function startupFetch(url: string, init?: RequestInit): Promise<Response> {
  const requests = typeof window === 'undefined' ? undefined : window.__cssEarthStartupRequests;
  const started = requests?.get(url);
  if (!started) return fetch(url, init);
  // A cancelled reader leaves the request for the next one.
  init?.signal?.throwIfAborted();
  requests!.delete(url);
  return started;
}

/** Drop requests no reader took, once the first view has settled. */
export function releaseStartupRequests() {
  if (typeof window !== 'undefined') delete window.__cssEarthStartupRequests;
}

/** The first view's documents, requested by the page's head script while the HTML still parses, long before the module that
 * reads each one loads (`ObjectLayout.astro`). Each response is taken once by its reader, which fetches it itself when the
 * head did not (a navigation, a later mount, a custom view). WebKit does not reuse `<link rel=preload as=fetch>` for
 * `fetch()`, so the head starts the requests itself. */
type StartupRequests = Map<string, Promise<Response>>;
declare global { interface Window { __cssEarthStartupRequests?: StartupRequests } }

/** Runs in the static document's head: one request per URL, kept for its reader by absolute URL. The object transport is
 * requested only at the default view of the page's own scene (`sceneRoute`, or the site root): a custom view (a query, a
 * level's path) may be served other markup (`dataset-response.mts`), so its reader picks the transport itself. */
export function startStartupRequests(window: Window, urls: readonly string[], transportUrl: string, sceneRoute: string) {
  const location = window.location, query = new URLSearchParams(location.search);
  const defaultView = (location.pathname === '/' || location.pathname === sceneRoute) &&
    !['dataset', 'feature', 'v', 'settings', 'q'].some(key => query.has(key));
  const requests = new Map();
  for (const url of defaultView ? [transportUrl, ...urls] : urls) {
    const response = fetch(url);
    // A request nobody reads must not report an unhandled rejection; its reader sees the failure.
    response.catch(() => {});
    requests.set(new URL(url, location.href).href, response);
  }
  window.__cssEarthStartupRequests = requests;
}

/** The head script of a body page: the world summary and the page's own holder (`world-context-plan.mts`), the page's directory entry, its system view
 * when it hosts one, and its object transport, named as `packaged-object-runtime.mts` reads it: a page that ships its body's
 * markup reads the first-view transport, a page with an arrival billboard the full one. */
export function startupRequestsBootstrap({ objectId, serverMarkup, systemView, summaryUrl, holder, bankFiles }:
  { objectId: string; serverMarkup: boolean; systemView: boolean; summaryUrl: string;
    /** The holder whose file has the page's body (`/world/systems/<holder>.json`), when the world summary does not. */
    holder?: string;
    /** The file list of the bank the page's default dataset shows (`/world/context-assets/<id>.json`), when it shows one. */
    bankFiles?: string }) {
  const urls = [summaryUrl, ...holder ? [`/world/systems/${holder}.json`] : [], `/objects/${objectId}/entry.json`, ...systemView ? [`/world/system-views/${objectId}.json`] : [], ...bankFiles ? [bankFiles] : []];
  const transportUrl = `/objects/${objectId}/${serverMarkup ? 'first-view' : 'object'}.json`;
  const args = [urls, transportUrl, `/${objectId}/`].map(value => JSON.stringify(value).replace(/</gu, '\\u003c'));
  return `(${startStartupRequests.toString()})(window, ${args.join(', ')});`;
}

/** Requests a flight starts before the step that reads each one: the destination's object transport goes out with its
 * card, entry and system view (`scene-router.mts`) instead of after the card. Only the latest few wait for a reader. */
const flightRequests: StartupRequests = new Map();
export const FLIGHT_REQUEST_CAPACITY = 4;
export function startFlightRequest(url: string) {
  if (typeof window === 'undefined') return;
  const key = new URL(url, window.location.href).href;
  if (flightRequests.has(key) || window.__cssEarthStartupRequests?.has(key)) return;
  const response = fetch(url);
  // A request nobody reads must not report an unhandled rejection; its reader sees the failure.
  response.catch(() => {});
  flightRequests.set(key, response);
  for (const oldest of flightRequests.keys()) {
    if (flightRequests.size <= FLIGHT_REQUEST_CAPACITY) break;
    flightRequests.delete(oldest);
  }
}

/** `fetch(url)`, adopting the head's or a flight's request for `url` once. */
export function startupFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(url, init);
  const key = new URL(url, window.location.href).href;
  const requests = [window.__cssEarthStartupRequests, flightRequests].find(requests => requests?.has(key));
  const started = requests?.get(key);
  if (!started) return fetch(url, init);
  // A cancelled reader leaves the request for the next one.
  init?.signal?.throwIfAborted();
  requests!.delete(key);
  return started;
}

/** Drop requests no reader took, once the first view has settled. */
export function releaseStartupRequests() {
  if (typeof window !== 'undefined') delete window.__cssEarthStartupRequests;
}

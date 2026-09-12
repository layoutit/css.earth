import type { BrowserWindow } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';

/**
 * Destination cards and content come from the static `/navigation/<id>/`
 * fragment. Selection intent fetches it ahead of a click, and the destination
 * load reuses that response. This is not a card bank: only a few recently
 * requested fragments stay resident, and none is fetched until it is wanted.
 * Cached documents are shared; consumers import or clone nodes, never move them.
 */
export interface NavigationFragments {
  /** Start fetching without waiting. A failure is dropped so demand retries it. */
  prefetch(id: string): void;
  /** The parsed fragment when it has already arrived. */
  peek(id: string): Document | null;
  get(id: string, signal?: AbortSignal): Promise<Document>;
}
type FetchPage = (url: string) => Promise<Response>;
interface Entry { promise: Promise<Document>; document: Document | null; }

export const NAVIGATION_FRAGMENT_CAPACITY = 4;
/** Hover and focus sweeps settle before a speculative request starts. */
export const NAVIGATION_INTENT_DWELL_MS = 60;

// A realm-wide key: every copy of this module (for example an HMR-updated
// development module) reaches the same per-window cache.
const SHARED_FRAGMENTS = Symbol.for('cssearth.navigation-fragments');
const isNavigationFragments = (value: unknown): value is NavigationFragments => typeof value === 'object' && value !== null
  && ['prefetch', 'peek', 'get'].every(name => typeof Reflect.get(value, name) === 'function');

/** The document's single fragment cache, shared by the shell and the content transport. */
export function navigationFragments(windowTarget: BrowserWindow): NavigationFragments {
  const existing: unknown = Reflect.get(windowTarget, SHARED_FRAGMENTS);
  if (isNavigationFragments(existing)) return existing;
  const fragments = createNavigationFragments({ windowTarget });
  Object.defineProperty(windowTarget, SHARED_FRAGMENTS, { value: fragments, configurable: true });
  return fragments;
}

export function createNavigationFragments({ windowTarget, fetchPage = url => windowTarget.fetch(url), capacity = NAVIGATION_FRAGMENT_CAPACITY }: {
  windowTarget: BrowserWindow; fetchPage?: FetchPage; capacity?: number;
}): NavigationFragments {
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Navigation fragment capacity must be a positive integer.');
  const entries = new Map<string, Entry>();
  const touch = (id: string, entry: Entry) => {
    entries.delete(id); entries.set(id, entry);
    for (const oldest of entries.keys()) {
      if (entries.size <= capacity) break;
      entries.delete(oldest);
    }
  };
  async function load(id: string) {
    const response = await fetchPage(`/navigation/${encodeURIComponent(id)}/`);
    if (!response.ok) throw new Error(`Object content request failed: ${response.status}.`);
    const source = new windowTarget.DOMParser().parseFromString(await response.text(), 'text/html');
    if (source.body.dataset.objectShell !== id || source.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId !== id) {
      throw new Error('Object route content does not match its registry identity.');
    }
    return source;
  }
  const request = (id: string) => {
    const cached = entries.get(id);
    if (cached) { touch(id, cached); return cached; }
    const entry: Entry = { document: null, promise: load(id) };
    entry.promise = entry.promise.then(document => { entry.document = document; return document; }, (error: unknown) => {
      if (entries.get(id) === entry) entries.delete(id);
      throw error;
    });
    // Speculative requests may never be awaited; their failure is not an application error.
    entry.promise.catch(() => {});
    touch(id, entry);
    return entry;
  };
  return Object.freeze({
    prefetch(id: string) { request(id); },
    peek(id: string) {
      const entry = entries.get(id);
      if (!entry?.document) return null;
      touch(id, entry);
      return entry.document;
    },
    get(id: string, signal?: AbortSignal) {
      const { promise } = request(id);
      if (!signal) return promise;
      if (signal.aborted) return Promise.reject(signal.reason);
      // Cancelling one consumer never aborts the shared request.
      return new Promise<Document>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
    },
  });
}

/**
 * Hover and focus on an object link, or hover on a navigable body in the
 * world, start that object's fragment after a short dwell; a press starts it
 * at once. Only registry routes are requested.
 */
export function bindNavigationIntent({ documentTarget, windowTarget, objects, fragments, skip = () => false }: {
  documentTarget: Document; windowTarget: BrowserWindow; objects: readonly Pick<ObjectEntry, 'id' | 'route'>[];
  fragments: NavigationFragments; skip?(id: string): boolean;
}) {
  const routes = new Map(objects.map(object => [object.route, object.id]));
  const ids = new Set(routes.values());
  const events = new AbortController();
  let timer: number | null = null;
  const cancel = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
  const start = (id: string | null | undefined) => { if (id && ids.has(id) && !skip(id)) fragments.prefetch(id); };
  const soon = (id: string | null | undefined) => {
    cancel();
    if (id) timer = windowTarget.setTimeout(() => { timer = null; start(id); }, NAVIGATION_INTENT_DWELL_MS);
  };
  const linked = (event: Event) => {
    const anchor = event.target instanceof windowTarget.Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof windowTarget.HTMLAnchorElement) || anchor.origin !== windowTarget.location.origin) return null;
    return routes.get(anchor.pathname) ?? null;
  };
  const options = { capture: true, passive: true, signal: events.signal };
  documentTarget.addEventListener('pointerover', event => { const id = linked(event); if (id) soon(id); }, options);
  documentTarget.addEventListener('focusin', event => { const id = linked(event); if (id) soon(id); }, options);
  documentTarget.addEventListener('pointerdown', event => { const id = linked(event); if (id) { cancel(); start(id); } }, options);
  // The world picker marks the hovered body; the event itself does not bubble.
  documentTarget.addEventListener('objecthoverchange', event => {
    const host = event.target instanceof windowTarget.Element ? event.target : null;
    soon(host?.querySelector<HTMLElement>('[data-object-hovered][data-object-navigate]')?.dataset.objectNavigate);
  }, options);
  return Object.freeze({ destroy() { cancel(); events.abort(); } });
}

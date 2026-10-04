import { objectIdAtPath } from '../root-object.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';

/**
 * Destination cards and content come from the static `/navigation/<id>/`
 * fragment. Selection intent fetches it ahead of a click, and the destination
 * load reuses that response. This is not a card bank: only a few recently
 * requested fragments stay resident, and none is fetched until it is wanted.
 * Encoded HTML is shared, and so is its parsed document among the consumers that
 * hold it at the same time: none of them changes it. Each reads it, imports the
 * nodes it needs and releases its lease; the document goes with its last lease.
 */
export interface NavigationFragments {
  /** Start fetching without waiting. A failure is dropped so demand retries it. */
  prefetch(id: string): void;
  /** Whether encoded fragment bytes have already arrived. */
  ready(id: string): boolean;
  /** A lease on the parsed document when encoded bytes have already arrived. */
  peek(id: string): NavigationFragmentLease | null;
  /** A lease on the document parsed from the shared encoded fragment bytes. */
  get(id: string, signal?: AbortSignal): Promise<NavigationFragmentLease>;
  inspect(): NavigationFragmentResidency;
}
type FetchPage = (url: string) => Promise<Response>;
interface Entry { promise: Promise<string>; html: string | null; }
export interface NavigationFragmentLease { readonly document: Document; release(): void; }
export interface NavigationFragmentResidency { readonly encodedEntries: number; readonly inFlightEntries: number;
  readonly activeDocuments: number; readonly parsedDocuments: number; }

export const NAVIGATION_FRAGMENT_CAPACITY = 4;
/** Hover and focus sweeps settle before a speculative request starts. */
export const NAVIGATION_INTENT_DWELL_MS = 60;

// A realm-wide key: every copy of this module (for example an HMR-updated
// development module) reaches the same per-window cache.
const SHARED_FRAGMENTS = Symbol.for('cssearth.navigation-fragments');
const isNavigationFragments = (value: unknown): value is NavigationFragments => typeof value === 'object' && value !== null
  && ['prefetch', 'ready', 'peek', 'get', 'inspect'].every(name => typeof Reflect.get(value, name) === 'function');

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
  let activeDocuments = 0, parsedDocuments = 0;
  const touch = (id: string, entry: Entry) => {
    entries.delete(id); entries.set(id, entry);
    for (const oldest of entries.keys()) {
      if (entries.size <= capacity) break;
      entries.delete(oldest);
    }
  };
  function parse(id: string, html: string) {
    const source = new windowTarget.DOMParser().parseFromString(html, 'text/html');
    if (source.body.dataset.objectShell !== id || source.querySelector<HTMLElement>('.object-stage')?.dataset.objectId !== id) {
      throw new Error('Object route content does not match its registry identity.');
    }
    return source;
  }
  // The leases of one page that are alive together read one parsed document. A hand-over's content and its descriptor
  // lease the page in the same turn: parsed for each, a 250 to 400 KB page was parsed twice in the frame it was handed
  // over in, about 4 ms a parse on an iPad (2026-10-04).
  const parsed = new Map<string, { html: string; document: Document; leases: number }>();
  function lease(id: string, html: string): NavigationFragmentLease {
    let held = parsed.get(id);
    if (!held || held.html !== html) {
      let document: Document;
      // A page that is not the object's own is dropped, so the next demand asks for it again.
      try { document = parse(id, html); } catch (error) { if (entries.get(id)?.html === html) entries.delete(id); throw error; }
      parsedDocuments++;
      parsed.set(id, held = { html, document, leases: 0 });
    }
    let shared: typeof held | null = held;
    shared.leases++; activeDocuments++;
    return Object.freeze({
      get document() {
        if (!shared) throw new Error('Navigation fragment document has been released.');
        return shared.document;
      },
      release() {
        if (!shared) return;
        // Content callbacks can outlive their transition. A released lease must
        // stop retaining the parsed DOM, not merely lower the ownership counter.
        if (--shared.leases === 0 && parsed.get(id) === shared) parsed.delete(id);
        shared = null;
        activeDocuments--;
      },
    });
  }
  async function load(id: string) {
    const response = await fetchPage(`/navigation/${encodeURIComponent(id)}/`);
    if (!response.ok) throw new Error(`Object content request failed: ${response.status}.`);
    // The page is parsed, and its identity checked, when a consumer leases it and never as it arrives: most pages are
    // requested ahead of a hand-over that may not come, and parsing one as it arrived cost 6 to 12 ms of the frame it
    // arrived in, in the middle of a zoom on an iPad (2026-10-04).
    return response.text();
  }
  const request = (id: string) => {
    const cached = entries.get(id);
    if (cached) { touch(id, cached); return cached; }
    const entry: Entry = { html: null, promise: load(id) };
    entry.promise = entry.promise.then(html => { entry.html = html; return html; }, (error: unknown) => {
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
    ready(id: string) {
      const entry = entries.get(id);
      return entry?.html !== null && entry?.html !== undefined;
    },
    peek(id: string) {
      const entry = entries.get(id);
      if (!entry?.html) return null;
      touch(id, entry);
      try { return lease(id, entry.html); } catch { return null; }
    },
    get(id: string, signal?: AbortSignal) {
      const { promise } = request(id);
      const acquire = (html: string) => lease(id, html);
      if (!signal) return promise.then(acquire);
      if (signal.aborted) return Promise.reject(signal.reason);
      // Cancelling one consumer never aborts the shared encoded request.
      return new Promise<string>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      }).then(acquire);
    },
    inspect: () => Object.freeze({ encodedEntries: [...entries.values()].filter(entry => entry.html !== null).length,
      inFlightEntries: [...entries.values()].filter(entry => entry.html === null).length,
      activeDocuments, parsedDocuments }),
  });
}

/**
 * Hover and focus on an object link, or hover on a navigable body in the
 * world, prefetch what a flight to that object reads (its fragment, entry and system view) after a short dwell; a
 * press prefetches at once. Only object routes (`/<id>/`) the app can navigate in place are requested (`navigable`), without the
 * object registry.
 */
export function bindNavigationIntent({ documentTarget, windowTarget, navigable, prefetch, skip = () => false }: {
  documentTarget: Document; windowTarget: BrowserWindow; navigable(id: string): boolean;
  prefetch(id: string): void; skip?(id: string): boolean;
}) {
  const events = new AbortController();
  let timer: number | null = null;
  const cancel = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
  const start = (id: string | null | undefined) => { if (id && navigable(id) && !skip(id)) prefetch(id); };
  const soon = (id: string | null | undefined) => {
    cancel();
    if (id) timer = windowTarget.setTimeout(() => { timer = null; start(id); }, NAVIGATION_INTENT_DWELL_MS);
  };
  const linked = (event: Event) => {
    const anchor = event.target instanceof windowTarget.Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof windowTarget.HTMLAnchorElement) || anchor.origin !== windowTarget.location.origin) return null;
    const id = anchor.pathname === '/' ? undefined : objectIdAtPath(anchor.pathname);
    // An overview keeps the mounted scene (navigation-scope.mts): there is nothing to prefetch.
    return id ?? null;
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

import type { BrowserWindow } from '../browser/browser-types.mts';
import { isRecord } from '@cssearth/core';
import { objectIdAtPath } from '../root-object.mts';
import type { NavigationHistory, NavigationIntent } from './navigation-request.mts';
type Navigate = (id: string, intent: NavigationIntent) => unknown;
interface NavigationAnchor { href: string; target?: string; hasAttribute(name: string): boolean; getAttribute(name: string): string | null; }
function closestAnchor(target: EventTarget | null): NavigationAnchor | null {
  if (!target || !('closest' in target) || typeof target.closest !== 'function') return null;
  const anchor: unknown = target.closest('a[href]');
  if (!isRecord(anchor) || typeof anchor.href !== 'string' || (anchor.target !== undefined && typeof anchor.target !== 'string') || typeof anchor.hasAttribute !== 'function' || typeof anchor.getAttribute !== 'function') return null;
  return anchor as unknown as NavigationAnchor;
}
const navigationId = (event: Event): unknown => 'detail' in event && isRecord(event.detail) ? event.detail.objectId : undefined;
const navigationFeature = (event: Event): string | undefined => 'detail' in event && isRecord(event.detail) && typeof event.detail.feature === 'string' && /^(?:city-)?[0-9]+$/u.test(event.detail.feature) ? event.detail.feature : undefined;

/** The history owner of each window, so scene code reads the URL a deferred write will publish (`navigationHref`). */
const owners = new WeakMap<Window, { href(): string }>();

/** The page's URL as the app knows it: a history write deferred while the camera moves is already this URL. */
export function navigationHref(windowTarget: Window) {
  return owners.get(windowTarget)?.href() ?? windowTarget.location.href;
}

// On the iPad every URL change through the History API costs 20–35 ms of main-thread time: Safari dispatches a navigate
// event and re-runs Reader detection over the page (2026-09-30). Every write is held and applied once the user has paused
// for this long: a handoff in a pinch, a view change in a drag and the writes of one arrival become one, and the cost
// lands in a pause instead of beside the next gesture (150 ms landed between stress gestures on the iPad).
const REST_WRITE_MS = 1000;

/** Standalone scenes replace the current URL without creating application history entries. */
export function replaceNavigationUrl(windowTarget: Window, url: string) {
  windowTarget.history.replaceState(windowTarget.history.state, '', url);
}

/** Preserve exact departed views while object selections create history entries. */
export function createNavigationHistory({ windowTarget, capture, navigate, navigating = () => false, embedded = false, onError = () => {} }: { windowTarget: Window; capture(): string | null; navigate: Navigate; navigating?(): boolean; embedded?: boolean; onError?(error: unknown): void }) {
  const snapshots = new Map<string, string>();
  // The entry each pushed entry was pushed from, so Back during a flight can be recognised.
  const previous = new Map<string, string>();
  // Not randomUUID: it exists only in secure contexts, and a device on the network loads the dev server over plain http.
  const prefix = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  let serial = 0, entry = `${prefix}-${++serial}`, disposed = false;
  const state = () => ({ ...(windowTarget.history.state ?? {}), cssEarthEntry: entry });
  // A write held while the camera moves: whether any held write pushed an entry, and the latest path.
  let moving = false, pending: { push: boolean; path: string } | null = null, restTimer: number | null = null;
  const apply = (push: boolean, path: string) => {
    pending = null;
    windowTarget.history[push ? 'pushState' : 'replaceState']({ ...state(), cssEarthView: path }, '', path);
  };
  // Every push and replace waits for the camera to rest this long, so no handoff or camera frame pays for the write.
  const write = (push: boolean, path: string) => {
    pending = { push: push || (pending?.push ?? false), path };
    if (moving) return;
    if (restTimer !== null) windowTarget.clearTimeout(restTimer);
    restTimer = windowTarget.setTimeout(applyPending, REST_WRITE_MS);
  };
  const applyPending = () => { restTimer = null; if (pending && !disposed) apply(pending.push, pending.path); };
  const onMotion = (event: Event) => {
    const active = isRecord((event as CustomEvent).detail) && (event as CustomEvent<{ active?: unknown }>).detail.active === true;
    if (active === moving) return;
    moving = active;
    if (restTimer !== null) { windowTarget.clearTimeout(restTimer); restTimer = null; }
    if (!moving && pending) restTimer = windowTarget.setTimeout(applyPending, REST_WRITE_MS);
  };
  function remember() {
    const url = capture();
    if (url) snapshots.set(entry, url);
    return url;
  }
  function isCurrentView(url: string) {
    const current: unknown = windowTarget.history.state;
    if (!isRecord(current) || current.cssEarthEntry !== entry || typeof current.cssEarthView !== 'string') return false;
    const href = windowTarget.location.href;
    try { return new URL(url, href).href === href && new URL(current.cssEarthView, href).href === href; }
    catch { return false; }
  }
  function checkpoint() {
    const url = remember();
    // A settled drag already published this entry. Replacing it again fires Safari's
    // native navigation work even with identical state and URL.
    if (url && (pending || !isCurrentView(url))) write(false, url);
  }
  const onPopState = (event: PopStateEvent) => {
    if (disposed) return;
    // The browser moved to another entry: a write held for the one it left no longer applies.
    const unpublished = pending?.push === true;
    pending = null;
    if (restTimer !== null) { windowTarget.clearTimeout(restTimer); restTimer = null; }
    // location already names the incoming entry. Capture the old scene without
    // replacing that URL; the router retires its continuous URL writer next.
    remember();
    const incoming: unknown = event.state;
    const state = isRecord(incoming) ? incoming : {};
    const targetEntry = typeof state.cssEarthEntry === 'string' ? state.cssEarthEntry : `${prefix}-${++serial}`;
    // A flight commits its entry only when it lands, so the current entry is still the view it
    // left. One step Back means "not there after all": fly back to that view as a new entry
    // instead of skipping it for the one before.
    const departure = snapshots.get(entry);
    // Back within the rest period of an arrival: the arrival's entry was never published, so the browser left the entry
    // the flight departed from, one step too far. Step forward to it again; that move restores the departure.
    if (unpublished && previous.has(entry) && previous.get(entry) !== targetEntry) { windowTarget.history.forward(); return; }
    if (navigating() && departure && previous.get(entry) === targetEntry) {
      const location = new URL(departure, windowTarget.location.href);
      // The router loads the object the entry names before it acts, and declines one that is not an object.
      const id = objectIdAtPath(location.pathname);
      if (id) { Promise.resolve(navigate(id, { kind: 'history', url: location.href, history: { history: 'push' } })).catch(onError); return; }
    }
    const url = snapshots.get(targetEntry) ?? (typeof state.cssEarthView === 'string' ? state.cssEarthView : undefined) ?? windowTarget.location.href;
    const location = new URL(url, windowTarget.location.href);
    const id = objectIdAtPath(location.pathname);
    if (!id) return;
    Promise.resolve(navigate(id, { kind: 'history', url: location.href, history: { history: 'pop', entry: targetEntry } })).catch(onError);
  };
  // The page's own entry gets its identity at once: Back reads it before any rest.
  { const url = remember(); if (url && !isCurrentView(url)) apply(false, url); }
  windowTarget.addEventListener('popstate', onPopState);
  windowTarget.document?.addEventListener('objectmotionchange', onMotion, { capture: true });
  const owner = Object.freeze({
    /** The URL this owner has published or holds to publish at rest. */
    href() { return pending ? new URL(pending.path, windowTarget.location.href).href : windowTarget.location.href; },
    checkpoint, remember,
    /** The current entry keeps `url`, a view the camera has since left: a header pill flew out of it, and the entry
     * pushed next must come Back to it rather than to where that flight landed. */
    keep(url: string) {
      if (disposed) return;
      const value = new URL(url, navigationHref(windowTarget)), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      if (restTimer !== null) { windowTarget.clearTimeout(restTimer); restTimer = null; }
      if (!isCurrentView(path)) apply(false, path);
    },
    commit(url: string, action: NavigationHistory = { history: 'push' }) {
      const { history } = action, targetEntry = action.history === 'pop' ? action.entry : undefined;
      if (disposed) return;
      if (history === 'pop' && !targetEntry) throw new TypeError('History restoration requires an entry.');
      // A push still held from the last arrival is its own entry: publish it before this one takes its place, or two
      // flights within the rest period become one entry and Back skips the body between them.
      if (history === 'push' && pending?.push) {
        if (restTimer !== null) { windowTarget.clearTimeout(restTimer); restTimer = null; }
        apply(true, pending.path);
      }
      const from = entry;
      entry = history === 'pop' ? targetEntry! : history === 'push' ? `${prefix}-${++serial}` : entry;
      if (history === 'push' && !embedded) previous.set(entry, from);
      const value = new URL(url, navigationHref(windowTarget)), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      // An embedded scene shares the host page's session history, so it never adds entries of its own.
      const push = history === 'push' && !embedded;
      // A pop is the browser's own move and is never held; it drops any held write (onPopState).
      if (history === 'pop') { if (!isCurrentView(path)) apply(false, path); return; }
      if (push || pending || !isCurrentView(path)) write(push, path);
    },
    destroy() {
      if (disposed) return;
      if (restTimer !== null) { windowTarget.clearTimeout(restTimer); restTimer = null; }
      if (pending) apply(pending.push, pending.path);
      disposed = true; windowTarget.removeEventListener('popstate', onPopState);
      windowTarget.document?.removeEventListener('objectmotionchange', onMotion, { capture: true });
      if (owners.get(windowTarget) === owner) owners.delete(windowTarget);
    },
  });
  owners.set(windowTarget, owner);
  return owner;
}

export function bindNavigationLinks({ documentTarget, windowTarget, navigable, navigate, onError = () => {} }: { documentTarget: Document; windowTarget: BrowserWindow; navigable(id: string): boolean; navigate: Navigate; onError?(error: unknown): void }) {
  // Whether the app can fly to `id` in place, answered now: an object the page has loaded and can reach, or a body of the
  // world it draws (site/scene/scene-router.mts). Anything else is left to an ordinary page load.
  const available = (id: unknown): id is string => typeof id === 'string' && navigable(id);
  const query = (event: Event) => { if (available(navigationId(event))) event.preventDefault(); };
  const select = (event: Event) => {
    const id = navigationId(event);
    if (!available(id)) return;
    event.preventDefault();
    const feature = navigationFeature(event);
    // A feature selection lands on the body and lets its runtime fly to the feature; no system framing first.
    Promise.resolve(navigate(id, feature ? { kind: 'feature', id: feature } : { kind: 'object' })).catch(onError);
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = closestAnchor(event.target);
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, windowTarget.location.href);
    if (url.origin !== windowTarget.location.origin) return;
    // An object route is `/<id>/`; the front page's `/` is left to the browser, as before.
    const id = url.pathname === '/' ? undefined : objectIdAtPath(url.pathname);
    if (!id || !available(id)) return;
    event.preventDefault();
    Promise.resolve(navigate(id, { kind: 'link', url: url.href })).catch(onError);
  };
  documentTarget.addEventListener('click', click);
  documentTarget.addEventListener('objectnavigate', select);
  documentTarget.addEventListener('objectnavigationquery', query);
  return () => {
    documentTarget.removeEventListener('click', click);
    documentTarget.removeEventListener('objectnavigate', select);
    documentTarget.removeEventListener('objectnavigationquery', query);
  };
}

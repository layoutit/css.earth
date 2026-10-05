import type { BrowserWindow } from '../browser/browser-types.mts';
import { isRecord } from '@cssearth/core';
import { objectIdAtPath } from '../model/root-object.mts';
import type { NavigationHistory, NavigationIntent } from './navigation-types.mts';
import { navigationHref, owners } from '../model/navigation-href.mts';
export { navigationHref } from '../model/navigation-href.mts';
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

// On the iPad every URL change through the History API is followed by slow frames that are not our code: with no inspector
// attached, `replaceState` returned in 0 to 12 ms, yet the frame of the write took 29 to 42 ms and another of 26 to 34 ms
// came 0.2 s later (2026-10-04). Written a second after the camera rested, as they were, the two met the next gesture of
// a reader who pauses about that long. So the address bar is not kept current while the reader uses the page. The app
// reads the held address (navigationHref) and the History API hears of it when a write cannot meet a gesture:
//  - A navigation's entry is written when the camera rests after it, with the view the entry it left keeps: Back has
//    to find both.
//  - A view's address is written when the reader leaves the page's content: the window loses focus (the address bar,
//    another tab), a mouse leaves the page, the page is hidden, or a Command, Control or F5 key goes down (a reload
//    or a copy of the address starts there).
//  - With no mouse over the page (a touch screen) nothing tells the page that the reader reaches for the browser's
//    Share button, so there a view is also written once the page has been still this long. The length is a judgement,
//    not a measurement: longer than the pauses inside a run of gestures, shorter than a look before sharing.
const IDLE_WRITE_MS = 3000;

/** A write the History API has not heard of: a view of `entry`, or the push that creates it. */
interface HeldWrite { push: boolean; entry: string; path: string }

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
  // The held writes in the order the History API will hear them: the view an entry keeps, then the push that left it.
  const held: HeldWrite[] = [];
  let moving = false, timer: number | null = null;
  // The reader: a mouse is `over` the page, they `left` its content, or a key says the address is `due`.
  let over = false, left = false, due = false;
  function isCurrentView(url: string, id = entry) {
    const current: unknown = windowTarget.history.state;
    if (!isRecord(current) || current.cssEarthEntry !== id || typeof current.cssEarthView !== 'string') return false;
    const href = windowTarget.location.href;
    try { return new URL(url, href).href === href && new URL(current.cssEarthView, href).href === href; }
    catch { return false; }
  }
  // An entry that already shows this view is left alone: replacing it again fires Safari's native navigation work even
  // with identical state and URL.
  const publish = ({ push, entry: id, path }: HeldWrite) => {
    if (!push && isCurrentView(path, id)) return;
    windowTarget.history[push ? 'pushState' : 'replaceState']({ ...(windowTarget.history.state ?? {}), cssEarthEntry: id, cssEarthView: path }, '', path);
  };
  const flush = () => {
    if (timer !== null) { windowTarget.clearTimeout(timer); timer = null; }
    due = false;
    for (const write of held.splice(0)) publish(write);
  };
  // Every write runs in its own task, with the camera at rest.
  const settle = () => {
    if (timer !== null) { windowTarget.clearTimeout(timer); timer = null; }
    if (!held.length || disposed || moving) return;
    if (left || due || held.some(write => write.push)) timer = windowTarget.setTimeout(flush, 0);
    else if (!over) timer = windowTarget.setTimeout(flush, IDLE_WRITE_MS);
  };
  const hold = (write: HeldWrite) => {
    const last = held[held.length - 1];
    // A view takes the place of the one held for its entry, and of one held for an entry no push left behind.
    if (!write.push && last && (last.entry === write.entry || !last.push)) held[held.length - 1] = { ...write, push: last.push && last.entry === write.entry };
    else held.push(write);
    settle();
  };
  const onMotion = (event: Event) => {
    const active = isRecord((event as CustomEvent).detail) && (event as CustomEvent<{ active?: unknown }>).detail.active === true;
    if (active === moving) return;
    moving = active; settle();
  };
  const leave = () => { left = true; settle(); };
  // Any use of the page: the reader is here, and the still period starts again.
  const use = () => { if (left || timer !== null) { left = false; settle(); } };
  // A wheel is turned with a mouse or a trackpad over the page, even one that has not moved since the page loaded.
  const onWheel = () => { if (!over || left || timer !== null) { over = true; left = false; settle(); } };
  const onPointer = (event: Event) => {
    if ((event as PointerEvent).pointerType !== 'mouse') { if (event.type === 'pointerdown') { over = false; left = false; settle(); } return; }
    over = event.type !== 'pointerleave'; left = !over; settle();
  };
  const onKey = (event: Event) => {
    const { key, repeat } = event as KeyboardEvent;
    if (held.length && !repeat && (key === 'Meta' || key === 'Control' || key === 'F5')) { due = true; settle(); } else use();
  };
  // A hidden page may run no later task: it writes at once, whatever the camera does.
  const onVisibility = () => { if (windowTarget.document?.visibilityState !== 'hidden') { use(); return; } left = true; flush(); };
  function remember() {
    const url = capture();
    if (url) snapshots.set(entry, url);
    return url;
  }
  function checkpoint() {
    const url = remember();
    if (url) hold({ push: false, entry, path: url });
  }
  const onPopState = (event: PopStateEvent) => {
    if (disposed) return;
    // The browser moved to another entry: the writes held for the one it left no longer apply.
    const unpublished = held.some(write => write.push);
    held.length = 0; settle();
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
    // Back before an arrival's entry was written (its camera still flies): the browser left the entry the flight
    // departed from, one step too far. Step forward to it again; that move restores the departure.
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
  { const url = remember(); if (url) publish({ push: false, entry, path: url }); }
  const listening = new AbortController(), { signal } = listening, page = windowTarget.document;
  windowTarget.addEventListener('popstate', onPopState, { signal });
  windowTarget.addEventListener('blur', leave, { signal });
  windowTarget.addEventListener('focus', use, { signal });
  windowTarget.addEventListener('pagehide', flush, { signal });
  windowTarget.addEventListener('keydown', onKey, { capture: true, signal });
  windowTarget.addEventListener('wheel', onWheel, { capture: true, passive: true, signal });
  page?.addEventListener('objectmotionchange', onMotion, { capture: true, signal });
  page?.addEventListener('visibilitychange', onVisibility, { signal });
  page?.addEventListener('pointerdown', onPointer, { capture: true, signal });
  page?.addEventListener('scroll', use, { capture: true, passive: true, signal });
  page?.documentElement?.addEventListener('pointerenter', onPointer, { signal });
  page?.documentElement?.addEventListener('pointerleave', onPointer, { signal });
  const owner = Object.freeze({
    /** The URL this owner has published or holds to publish. */
    href() { const last = held[held.length - 1]; return last ? new URL(last.path, windowTarget.location.href).href : windowTarget.location.href; },
    checkpoint, remember,
    /** The current entry keeps `url`, a view the camera has since left: a header pill flew out of it, and the entry
     * pushed next must come Back to it rather than to where that flight landed. */
    keep(url: string) {
      if (disposed) return;
      const value = new URL(url, navigationHref(windowTarget)), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      hold({ push: false, entry, path });
    },
    commit(url: string, action: NavigationHistory = { history: 'push' }) {
      const { history } = action, targetEntry = action.history === 'pop' ? action.entry : undefined;
      if (disposed) return;
      if (history === 'pop' && !targetEntry) throw new TypeError('History restoration requires an entry.');
      const value = new URL(url, navigationHref(windowTarget)), path = value.pathname + value.search + value.hash;
      const from = entry;
      entry = history === 'pop' ? targetEntry! : history === 'push' ? `${prefix}-${++serial}` : entry;
      if (history === 'push' && !embedded) previous.set(entry, from);
      snapshots.set(entry, path);
      // A pop is the browser's own move and is never held; it drops any held write (onPopState).
      if (history === 'pop') { held.length = 0; settle(); publish({ push: false, entry, path }); return; }
      // An embedded scene shares the host page's session history, so it never adds entries of its own.
      const push = history === 'push' && !embedded, departed = snapshots.get(from);
      // The entry a push leaves keeps the view it was left in, written just before the push.
      if (push && departed !== undefined) hold({ push: false, entry: from, path: departed });
      hold({ push, entry, path });
    },
    destroy() {
      if (disposed) return;
      flush(); disposed = true; listening.abort();
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

import type { ObjectEntry } from '../object-schema.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { record } from '../browser-types.mts';
import { objectIdAtPath } from '../root-object.mts';
import type { NavigationHistory, NavigationIntent } from './navigation-request.mts';
type Navigate = (id: string, intent: NavigationIntent) => unknown;
interface NavigationAnchor { href: string; target?: string; hasAttribute(name: string): boolean; }
function closestAnchor(target: EventTarget | null): NavigationAnchor | null {
  if (!target || !('closest' in target) || typeof target.closest !== 'function') return null;
  const anchor: unknown = target.closest('a[href]');
  if (!record(anchor) || typeof anchor.href !== 'string' || (anchor.target !== undefined && typeof anchor.target !== 'string') || typeof anchor.hasAttribute !== 'function') return null;
  return anchor as unknown as NavigationAnchor;
}
const navigationId = (event: Event): unknown => 'detail' in event && record(event.detail) ? event.detail.objectId : undefined;
const navigationFeature = (event: Event): string | undefined => 'detail' in event && record(event.detail) && typeof event.detail.feature === 'string' && /^(?:city-)?[0-9]+$/u.test(event.detail.feature) ? event.detail.feature : undefined;

/** Standalone scenes replace the current URL without creating application history entries. */
export function replaceNavigationUrl(windowTarget: Window, url: string) {
  windowTarget.history.replaceState(windowTarget.history.state, '', url);
}

/** Preserve exact departed views while object selections create history entries. */
export function createNavigationHistory({ windowTarget, objects, capture, navigate, navigating = () => false, embedded = false, onError = () => {} }: { windowTarget: Window; objects: readonly ObjectEntry[]; capture(): string | null; navigate: Navigate; navigating?(): boolean; embedded?: boolean; onError?(error: unknown): void }) {
  const snapshots = new Map<string, string>();
  // The entry each pushed entry was pushed from, so Back during a flight can be recognised.
  const previous = new Map<string, string>();
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
  const onPopState = (event: PopStateEvent) => {
    if (disposed) return;
    // location already names the incoming entry. Capture the old scene without
    // replacing that URL; the router retires its continuous URL writer next.
    remember();
    const incoming: unknown = event.state;
    const state = record(incoming) ? incoming : {};
    const targetEntry = typeof state.cssEarthEntry === 'string' ? state.cssEarthEntry : `${prefix}-${++serial}`;
    // A flight commits its entry only when it lands, so the current entry is still the view it
    // left. One step Back means "not there after all": fly back to that view as a new entry
    // instead of skipping it for the one before.
    const departure = snapshots.get(entry);
    if (navigating() && departure && previous.get(entry) === targetEntry) {
      const location = new URL(departure, windowTarget.location.href);
      const object = objects.find(object => object.id === objectIdAtPath(location.pathname));
      if (object) { Promise.resolve(navigate(object.id, { kind: 'history', url: location.href, history: { history: 'push' } })).catch(onError); return; }
    }
    const url = snapshots.get(targetEntry) ?? (typeof state.cssEarthView === 'string' ? state.cssEarthView : undefined) ?? windowTarget.location.href;
    const location = new URL(url, windowTarget.location.href);
    const object = objects.find(object => object.id === objectIdAtPath(location.pathname));
    if (!object) return;
    Promise.resolve(navigate(object.id, { kind: 'history', url: location.href, history: { history: 'pop', entry: targetEntry } })).catch(onError);
  };
  checkpoint();
  windowTarget.addEventListener('popstate', onPopState);
  return Object.freeze({
    checkpoint, remember,
    commit(url: string, action: NavigationHistory = { history: 'push' }) {
      const { history } = action, targetEntry = action.history === 'pop' ? action.entry : undefined;
      if (disposed) return;
      if (history === 'pop' && !targetEntry) throw new TypeError('History restoration requires an entry.');
      const from = entry;
      entry = history === 'pop' ? targetEntry! : history === 'push' ? `${prefix}-${++serial}` : entry;
      if (history === 'push' && !embedded) previous.set(entry, from);
      const value = new URL(url, windowTarget.location.href), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      // An embedded scene shares the host page's session history, so it never adds entries of its own.
      const push = history === 'push' && !embedded;
      windowTarget.history[push ? 'pushState' : 'replaceState']({ ...state(), cssEarthView: path }, '', path);
    },
    destroy() { if (!disposed) { disposed = true; windowTarget.removeEventListener('popstate', onPopState); } },
  });
}

export function bindNavigationLinks({ documentTarget, windowTarget, objects, supports, navigate, onError = () => {} }: { documentTarget: Document; windowTarget: BrowserWindow; objects: readonly ObjectEntry[]; supports(id: string): boolean; navigate: Navigate; onError?(error: unknown): void }) {
  const available = (id: unknown): id is string => typeof id === 'string' && objects.some(object => object.id === id) && supports(id);
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
    const object = objects.find(object => object.route === url.pathname);
    if (!object || !supports(object.id)) return;
    const focusId = url.searchParams.get('focus');
    if (focusId && !url.searchParams.has('v') && anchor.hasAttribute('data-prepared-focus-id')) {
      event.preventDefault();
      Promise.resolve(navigate(object.id, { kind: 'focus', id: focusId })).catch(onError);
      return;
    }
    event.preventDefault();
    Promise.resolve(navigate(object.id, { kind: 'link', url: url.href })).catch(onError);
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

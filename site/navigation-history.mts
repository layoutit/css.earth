import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { OverviewScope } from './overview-context.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { BrowserWindow } from './browser-types.mts';
import { record } from './browser-types.mts';
export interface NavigationOptions { history?: 'push' | 'pop' | 'replace'; entry?: string; url?: string; overview?: boolean; overviewScope?: OverviewScope; classification?: string; recenter?: boolean; sceneSelection?: boolean; centerSelection?: boolean; preserveView?: boolean; targetWorldCamera?: WorldCameraPose; targetFocusPositionM?: PositionM; }
type Navigate = (id: string, options: NavigationOptions) => unknown;
interface NavigationAnchor { href: string; target?: string; hasAttribute(name: string): boolean; }
function closestAnchor(target: EventTarget | null): NavigationAnchor | null {
  if (!target || !('closest' in target) || typeof target.closest !== 'function') return null;
  const anchor: unknown = target.closest('a[href]');
  if (!record(anchor) || typeof anchor.href !== 'string' || (anchor.target !== undefined && typeof anchor.target !== 'string') || typeof anchor.hasAttribute !== 'function') return null;
  return anchor as unknown as NavigationAnchor;
}
const navigationId = (event: Event): unknown => 'detail' in event && record(event.detail) ? event.detail.objectId : undefined;
import { overviewScopeFromUrl } from './navigation-scope.mts';
import { solarSystemFocus } from './overview-selection.mts';

/** Preserve exact departed views while object selections create history entries. */
export function createNavigationHistory({ windowTarget, objects, capture, navigate, onError = () => {} }: { windowTarget: Window; objects: readonly ObjectEntry[]; capture(): string | null; navigate: Navigate; onError?(error: unknown): void }) {
  const snapshots = new Map<string, string>();
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
    const url = snapshots.get(targetEntry) ?? (typeof state.cssEarthView === 'string' ? state.cssEarthView : undefined) ?? windowTarget.location.href;
    const location = new URL(url, windowTarget.location.href);
    const object = objects.find(object => object.route === location.pathname);
    if (!object) return;
    Promise.resolve(navigate(object.id, { history: 'pop', url: location.href, entry: targetEntry })).catch(onError);
  };
  checkpoint();
  windowTarget.addEventListener('popstate', onPopState);
  return Object.freeze({
    checkpoint, remember,
    commit(url: string, { history = 'push', entry: targetEntry }: Pick<NavigationOptions, 'history' | 'entry'> = {}) {
      if (disposed) return;
      if (history === 'pop' && !targetEntry) throw new TypeError('History restoration requires an entry.');
      entry = history === 'pop' ? targetEntry! : history === 'push' ? `${prefix}-${++serial}` : entry;
      const value = new URL(url, windowTarget.location.href), path = value.pathname + value.search + value.hash;
      snapshots.set(entry, path);
      windowTarget.history[history === 'push' ? 'pushState' : 'replaceState']({ ...state(), cssEarthView: path }, '', path);
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
    Promise.resolve(navigate(id, { sceneSelection: true })).catch(onError);
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = closestAnchor(event.target);
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, windowTarget.location.href);
    if (url.origin !== windowTarget.location.origin) return;
    const object = objects.find(object => object.route === url.pathname);
    if (!object || !supports(object.id)) return;
    event.preventDefault();
    const scope = overviewScopeFromUrl(url.href);
    const options: NavigationOptions = scope && !url.searchParams.has('v')
      ? { overview: true, overviewScope: scope }
      : url.search || url.hash ? { url: url.href } : { sceneSelection: true };
    Promise.resolve(navigate(object.id, options)).catch(onError);
  };
  // A category pill frames its whole classification around the Solar System.
  const category = (event: Event) => {
    const classification = 'detail' in event && record(event.detail) ? event.detail.classification : undefined;
    const focusId = solarSystemFocus(objects)?.id;
    if (typeof classification !== 'string' || !available(focusId)) return;
    Promise.resolve(navigate(focusId, { overview: true, classification })).catch(onError);
  };
  documentTarget.addEventListener('click', click);
  documentTarget.addEventListener('objectnavigate', select);
  documentTarget.addEventListener('objectnavigationquery', query);
  documentTarget.addEventListener('categorynavigate', category);
  return () => {
    documentTarget.removeEventListener('click', click);
    documentTarget.removeEventListener('objectnavigate', select);
    documentTarget.removeEventListener('objectnavigationquery', query);
    documentTarget.removeEventListener('categorynavigate', category);
  };
}

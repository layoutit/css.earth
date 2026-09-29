import { objectIdAtPath } from '../root-object.mts';

/** A catalogue focus and an overview are two names for the same shared camera,
 * so a URL may carry only one of them. This module owns both: every writer goes
 * through it. A focus's page is `/<focus id>/`, its host scene's page with the
 * focus selected, so a URL names a focus when its path names something other
 * than the scene the page mounts; an overview is the scene page's `overview`. */

/** The catalogue focus a URL names on the page of scene `sceneId`. A focus whose
 * prepared bank is still loading has not reached the runtime yet, so the runtime
 * cannot answer this: the URL is the selection from the moment it is named. */
export function preparedFocusFromUrl(url: string | URL, sceneId: string) {
  const id = objectIdAtPath(new URL(url).pathname);
  return id !== undefined && id !== sceneId ? id : null;
}

/** Parse a selection at either entry point: the focus its page names, and the lens its `dataset` selects, as on any page. */
export function readPreparedFocusSelection(url: URL, sceneId: string): { id: string; lens: string | null } | null {
  const id = preparedFocusFromUrl(url, sceneId);
  if (id === null) return null;
  const lenses = url.searchParams.getAll('dataset');
  if (lenses.length > 1) throw new RangeError('A saved view may have only one prepared focus lens.');
  return { id, lens: lenses[0] ?? null };
}

/** Overview routes share the mounted world and its camera. A focus's page has none: the focus wins. */
export function overviewScopeFromUrl(url: string | URL, sceneId: string) {
  if (preparedFocusFromUrl(url, sceneId) !== null) return null;
  const scope = new URL(url).searchParams.get('overview');
  return scope === 'system' || scope === 'milky-way' || scope === 'local-group' || scope === 'nearby-universe' || scope === 'observable-universe' ? scope : null;
}

/** Satellite systems are selections on a body's route, below the stellar overview. */
export function satelliteSystemFromUrl(url: string | URL) {
  const query = new URL(url).searchParams;
  return !query.has('overview') && query.get('view') === 'satellites';
}

export function withSatelliteSystemView(url: URL, selected: boolean): URL {
  if (selected) {
    url.searchParams.set('view', 'satellites');
    url.searchParams.delete('overview');
  } else url.searchParams.delete('view');
  return url;
}

/** Selects the named catalogue focus and its lens on the page of scene `sceneId`, or clears it back to that scene's
 * page, replacing any overview it supersedes. A focus's page selects its lens with `dataset`, like every page, so the
 * scene's own dataset never crosses into it or back. */
export function withPreparedFocus(url: URL, sceneId: string, id: string | null, lens: string | null): URL {
  const focused = preparedFocusFromUrl(url, sceneId) !== null;
  // The front page (`/`) already names its scene; any other path that is not the focus's becomes the scene's own.
  if (id !== null || objectIdAtPath(url.pathname) !== sceneId) url.pathname = `/${id ?? sceneId}/`;
  if (id !== null && lens) url.searchParams.set('dataset', lens);
  else if (id !== null || focused) url.searchParams.delete('dataset');
  if (id) { url.searchParams.delete('overview'); url.searchParams.delete('view'); }
  return url;
}

/** Selects the named overview. */
export function withOverviewScope(url: URL, scope: string | null): URL {
  if (!scope) {
    url.searchParams.delete('overview');
    return url;
  }
  url.searchParams.set('overview', scope);
  url.searchParams.delete('view');
  return url;
}

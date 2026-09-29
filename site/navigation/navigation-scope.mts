import { objectIdAtPath } from '../root-object.mts';
import { OVERVIEW_TITLES } from '../overview-titles.mts';
import { SOLAR_SYSTEM_ID } from '../object-systems.mts';

/** Every page is `/<id>/`. A page is either a scene (a body, a star) or something the shared world draws around the
 * mounted scene: a catalogue subject (a galaxy, a cluster, a nebula) or an overview (the Milky Way, the Local Group, the
 * nearby universe). The second kind keeps whatever scene is mounted, and a page of it opened cold mounts the world's
 * host. This module owns reading and writing those paths: every writer goes through it. The system overview of a star is
 * the only overview without an id of its own; it is its scene page's `overview=system`. */

/** The scene a drawn page mounts when it is opened cold: the world's host, the star every catalogue subject and overview
 * is placed from (site/build/prepare/prepare-catalog.mts gives each catalogue subject the same host). */
export const WORLD_HOST_ID = SOLAR_SYSTEM_ID;

/** The overviews that are pages. */
export type OverviewPageId = keyof typeof OVERVIEW_TITLES;
export const OVERVIEW_PAGE_IDS = Object.freeze(Object.keys(OVERVIEW_TITLES) as OverviewPageId[]);
export const isOverviewPage = (id: string | null | undefined): id is OverviewPageId => typeof id === 'string' && Object.hasOwn(OVERVIEW_TITLES, id);

/** The page a URL names when it is something the mounted scene `sceneId` draws, not the scene itself; null on the
 * scene's own page. The URL is the selection from the moment it is named, before any bank has loaded. */
export function drawnPageFromUrl(url: string | URL, sceneId: string) {
  const id = objectIdAtPath(new URL(url).pathname);
  return id !== undefined && id !== sceneId ? id : null;
}

/** The catalogue focus a URL names on the page of scene `sceneId`: a drawn page that is not an overview. */
export function preparedFocusFromUrl(url: string | URL, sceneId: string) {
  const id = drawnPageFromUrl(url, sceneId);
  return isOverviewPage(id) ? null : id;
}

/** The page of drawn subject `id` (a catalogue focus or an overview), or of scene `sceneId` when `id` is null. The front
 * page (`/`) already names its scene and keeps its path. A drawn subject's page carries none of the scene's own
 * selections (its `dataset`, `feature`): opened cold it mounts the world's host, which would read them as its own. */
function withPage(url: URL, sceneId: string, id: string | null): URL {
  if (id !== null || objectIdAtPath(url.pathname) !== sceneId) url.pathname = `/${id ?? sceneId}/`;
  if (id !== null) { url.searchParams.delete('dataset'); url.searchParams.delete('feature'); }
  return url;
}

/** Parse a selection at either entry point: the focus its page names, and the lens its `dataset` selects, as on any page. */
export function readPreparedFocusSelection(url: URL, sceneId: string): { id: string; lens: string | null } | null {
  const id = preparedFocusFromUrl(url, sceneId);
  if (id === null) return null;
  const lenses = url.searchParams.getAll('dataset');
  if (lenses.length > 1) throw new RangeError('A saved view may have only one prepared focus lens.');
  return { id, lens: lenses[0] ?? null };
}

/** The overview a URL names: its page's, or on a scene's page `overview=system`. A catalogue focus's page has none. */
export function overviewScopeFromUrl(url: string | URL, sceneId: string) {
  const page = drawnPageFromUrl(url, sceneId);
  if (isOverviewPage(page)) return page;
  if (page !== null) return null;
  return new URL(url).searchParams.get('overview') === 'system' ? 'system' : null;
}

/** Satellite systems are selections on a body's route, below the stellar overview. */
export function satelliteSystemFromUrl(url: string | URL) {
  const query = new URL(url).searchParams;
  return !query.has('overview') && !isOverviewPage(objectIdAtPath(new URL(url).pathname)) && query.get('view') === 'satellites';
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
  withPage(url, sceneId, id);
  if (id !== null && lens) url.searchParams.set('dataset', lens);
  else if (id !== null || focused) url.searchParams.delete('dataset');
  if (id) { url.searchParams.delete('overview'); url.searchParams.delete('view'); }
  return url;
}

/** The page an overview selected on scene `sceneId` is, or null when it is the scene page's `overview=system`. An
 * overview's page is the world host's scene; another star's scene zoomed out past its system (the scopes are measured
 * from the host, so this is at once) stays that star's system overview, so its URL still reopens the scene it shows. */
export function overviewPage(sceneId: string, scope: string | null): OverviewPageId | null {
  return isOverviewPage(scope) && sceneId === WORLD_HOST_ID ? scope : null;
}

/** Selects the named overview on the page of scene `sceneId`: its page, or the scene page's `overview=system`. */
export function withOverviewScope(url: URL, sceneId: string, requested: OverviewPageId | 'system' | null): URL {
  const page = overviewPage(sceneId, requested), scope = page ?? (requested === null ? null : 'system');
  if (page !== null) {
    withPage(url, sceneId, page);
    url.searchParams.delete('overview');
    url.searchParams.delete('view');
    return url;
  }
  // Leaving an overview's page returns to the scene's; a catalogue focus's page keeps its path.
  if (isOverviewPage(objectIdAtPath(url.pathname))) withPage(url, sceneId, null);
  if (!scope) {
    url.searchParams.delete('overview');
    return url;
  }
  url.searchParams.set('overview', scope);
  url.searchParams.delete('view');
  return url;
}

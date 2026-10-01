import { objectIdAtPath } from '../root-object.mts';
import { knownObject } from '../object-directory.mts';
import type { OverviewScope } from '../overview-context.mts';
import { SOLAR_SYSTEM_ID } from '../object-systems.mts';

/** Every page is `/<id>/`. A page is either an object's own scene (a body, a star, a galaxy, a nebula, a cluster) or a level
 * of the zoom ladder the shared world draws around the mounted scene (the Milky Way, the Local Group, the nearby and the
 * observable universe). Both are entries of the one registry (`OBJECTS`). A level keeps whatever scene is mounted, and
 * its page opened cold mounts its host, the world's. This module
 * owns reading and writing those paths: every writer goes through it. The system overview of a star is the only overview
 * without an id of its own; it is its scene page's `overview=system`. */

/** The scene a level's page mounts when it is opened cold: the world's host. */
export const WORLD_HOST_ID = SOLAR_SYSTEM_ID;

/** The overviews that are pages: the registry's overview entries, every level of the zoom ladder above a star's system. */
export type OverviewPageId = Exclude<OverviewScope, 'system'>;
export const isOverviewPage = (id: string | null | undefined): id is OverviewPageId => typeof id === 'string' && knownObject(id)?.zoom !== undefined;

/** The page a URL names when it is something the mounted scene `sceneId` draws, not the scene itself; null on the
 * scene's own page. The URL is the selection from the moment it is named, before any bank has loaded. */
export function drawnPageFromUrl(url: string | URL, sceneId: string) {
  const id = objectIdAtPath(new URL(url).pathname);
  return id !== undefined && id !== sceneId ? id : null;
}

/** The page of level `id`, or of scene `sceneId` when `id` is null. The front
 * page (`/`) already names its scene and keeps its path. A page's `dataset` and `feature` are its own: moving to another
 * page drops them, so a drawn subject's page never carries the scene's (opened cold it mounts the world's host, which
 * would read them as its own), and staying on a page keeps its own (an overview's dataset, page-datasets.mts). */
function withPage(url: URL, sceneId: string, id: string | null): URL {
  const target = id ?? sceneId;
  if (objectIdAtPath(url.pathname) === target) return url;
  url.pathname = `/${target}/`;
  url.searchParams.delete('dataset'); url.searchParams.delete('feature');
  return url;
}

/** Selects dataset `dataset` of drawn page `page` (an overview's, page-datasets.mts) from any URL: that page, keeping the
 * camera (`v`); a page reached from elsewhere carries none of the previous page's selections. */
export function withPageDataset(url: URL, page: string, dataset: string): URL {
  withPage(url, page, page);
  url.searchParams.delete('overview'); url.searchParams.delete('view');
  url.searchParams.set('dataset', dataset);
  return url;
}

/** The overview a URL names: its page's, or on a scene's page `overview=system`. */
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

/** The page an overview selected on scene `sceneId` is, or null when it is the scene page's `overview=system`. An
 * overview's page is the world host's scene; another star's scene zoomed out past its system stays that star's system
 * overview in its URL, so a reload reopens the scene it shows and the zoom recomputes the scope from there. */
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
  // Leaving an overview's page returns to the scene's.
  if (isOverviewPage(objectIdAtPath(url.pathname))) withPage(url, sceneId, null);
  if (!scope) {
    url.searchParams.delete('overview');
    return url;
  }
  url.searchParams.set('overview', scope);
  url.searchParams.delete('view');
  return url;
}

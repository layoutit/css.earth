import { SOLAR_SYSTEM_ID } from '../object-systems.mts';

/** Every page is `/<id>/`, an object's own scene: a body, a star, a galaxy, a nebula, a cluster, or a level of the zoom
 * ladder (the Milky Way, the Local Group, the nearby and the observable universe), which is an object too. The only views of
 * a page without an id of their own are its `overview=system` (a star out to its planetary system) and `view=satellites`
 * (a host out to its moons). This module owns reading and writing those. */

/** The star a level opens centred on when its page is opened cold: the world's host. */
export const WORLD_HOST_ID = SOLAR_SYSTEM_ID;

/** The overview a URL names: `overview=system`, the scene's star seen out to its planetary system. */
export function overviewScopeFromUrl(url: string | URL) {
  return new URL(url).searchParams.get('overview') === 'system' ? 'system' as const : null;
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

/** Selects or clears the system overview on a scene's page. */
export function withOverviewScope(url: URL, system: boolean): URL {
  if (!system) {
    url.searchParams.delete('overview');
    return url;
  }
  url.searchParams.set('overview', 'system');
  url.searchParams.delete('view');
  return url;
}

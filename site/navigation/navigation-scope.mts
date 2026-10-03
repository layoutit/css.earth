import { SOLAR_SYSTEM_ID } from '../object-systems.mts';
import { pageIdAtPath } from '../root-object.mts';
import { systemHostId, systemRoute } from './system-address.mts';

/** Every page is `/<id>/`, an object: a body, a star, a galaxy, a nebula, a cluster, an object seen from inside, or a
 * system (a host with the bodies that orbit it). A system's page mounts its host's scene, seen out to its moons or to its
 * planetary system; this module owns how an address names it. */

/** The star an object seen from inside opens centred on when its page is opened cold: the world's host. */
export const WORLD_HOST_ID = SOLAR_SYSTEM_ID;

/** How far out an object's scene is seen: its body, a planet out to its moons, or a star out to its planetary system. */
export type PageView = 'body' | 'moons' | 'system';

/** Whether an address names a system: an object whose page shows its host out to its members (system-address.mts). The
 * host says which members those are, a planet's moons or a star's planets (scene-selection.mts `selectionTargetFromUrl`). */
export function namesSystem(url: string | URL): boolean {
  return systemHostId(pageIdAtPath(new URL(url).pathname)) !== null;
}

/** The address with `view` selected: the object's own for its body, its system's for its moons or its planetary system.
 * The address keeps its other parameters. */
export function withView(url: URL, view: PageView): URL {
  const id = pageIdAtPath(url.pathname);
  if (id === undefined) return url;
  const host = systemHostId(id) ?? id;
  // The front page (`/`) shows its object's body under its own address.
  if (view === 'body' && url.pathname === '/') return url;
  url.pathname = view === 'body' ? `/${host}/` : systemRoute(host);
  return url;
}

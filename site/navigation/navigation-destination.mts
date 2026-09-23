import { OBJECTS, SCENE_OBJECTS } from '../objects.mts';
import { SOLAR_SYSTEM_ID } from '../object-systems.mts';
import { OVERVIEW_TITLES } from '../prepared-overview-titles.mjs';

/** Where the application opens something, and the catalogue subject to select in
 * place when that destination is a focus on the already mounted world. */
export interface NavigationDestination { readonly href: string; readonly focusId: string | null }

const galacticRoute = SCENE_OBJECTS.find(object => object.id === SOLAR_SYSTEM_ID)!.route;
const pages = new Map(SCENE_OBJECTS.map(object => [object.id, object.route]));
const focuses = new Map(OBJECTS.filter(object => object.kind === 'prepared-focus').map(object => [object.id, object.route]));

/** An object package is not automatically an application destination. A package
 * owns a page only when it owns a scene; otherwise the application reaches its
 * contents through the catalogue subject it details, or through the overview
 * that draws it, and a package with neither is not something we can open. Ask
 * here before linking to anything: the Atlas has a page per package, the
 * application does not, and the two must never borrow each other's routes. */
export function appNavigationDestination(objectId: string, focusId: string | null = null): NavigationDestination | null {
  const page = pages.get(objectId);
  if (page !== undefined) return { href: page, focusId: null };
  const focus = focusId === null ? undefined : focuses.get(focusId);
  if (focus !== undefined) return { href: focus, focusId };
  if (Object.hasOwn(OVERVIEW_TITLES, objectId)) return { href: `${galacticRoute}?overview=${objectId}`, focusId: null };
  return null;
}

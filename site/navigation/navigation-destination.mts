import { OBJECTS, SCENE_OBJECTS } from '../objects.mts';
import { isOverviewPage } from './navigation-scope.mts';

/** Where the application opens something, and the catalogue subject to select in
 * place when that destination is a focus on the already mounted world. */
export interface NavigationDestination { readonly href: string; readonly focusId: string | null }

const pages = new Map(SCENE_OBJECTS.map(object => [object.id, object.route]));
const focuses = new Map(OBJECTS.filter(object => object.kind === 'prepared-focus').map(object => [object.id, object.route]));

/** An object package is not automatically an application destination. A package
 * owns a page only when it owns a scene; otherwise the application reaches its
 * contents through the catalogue subject it details, or through the overview
 * that draws it, and a package with neither is not something we can open. Ask
 * here before linking to any package. */
export function appNavigationDestination(objectId: string, focusId: string | null = null): NavigationDestination | null {
  const page = pages.get(objectId);
  if (page !== undefined) return { href: page, focusId: null };
  const focus = focusId === null ? undefined : focuses.get(focusId);
  if (focus !== undefined) return { href: focus, focusId };
  if (isOverviewPage(objectId)) return { href: `/${objectId}/`, focusId: null };
  return null;
}

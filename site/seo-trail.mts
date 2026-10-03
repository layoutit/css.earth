import { ancestorsOf } from './objects.mts';

/** The pages a page is inside in the object tree, from the Observable Universe down to the page itself: Milky Way, Solar
 * System, Mars system, Phobos. The card's breadcrumbs show a window of the same trail (components/ObjectBreadcrumbs.astro). */
export function pageTrail(page: { readonly id: string; readonly name: string; readonly route: string }) {
  return [...[...ancestorsOf(page.id)].reverse(), page].map(({ name, route }) => ({ name, route }));
}

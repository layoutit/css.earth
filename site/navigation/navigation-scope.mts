import { SOLAR_SYSTEM_ID } from '../object-systems.mts';

/** Every page is `/<id>/`, an object's own scene: a body, a star, a galaxy, a nebula, a cluster, or a level of the zoom
 * ladder. A page shows its object in one of three views: the body, a host out to its moons, or a star out to its planetary
 * system. This module owns the one table of what each view is called in an address and in a selection's identity. */

/** The star a level opens centred on when its page is opened cold: the world's host. */
export const WORLD_HOST_ID = SOLAR_SYSTEM_ID;

export type PageView = 'body' | 'moons' | 'system';
/** Each view's query parameter (none for the body) and the prefix of its selection identity. */
export const PAGE_VIEWS: Readonly<Record<PageView, { readonly query: readonly [name: string, value: string] | null; readonly identity: string }>> = Object.freeze({
  body: { query: null, identity: 'object' },
  moons: { query: ['view', 'satellites'], identity: 'satellite-system' },
  system: { query: ['overview', 'system'], identity: 'overview:system' },
});
const VIEWS = Object.keys(PAGE_VIEWS) as PageView[];

/** The view an address names. The system view wins when an address carries both parameters. */
export function viewFromUrl(url: string | URL): PageView {
  const query = new URL(url).searchParams;
  const named = (view: PageView) => { const parameter = PAGE_VIEWS[view].query; return parameter !== null && query.get(parameter[0]) === parameter[1]; };
  return named('system') ? 'system' : named('moons') && !query.has('overview') ? 'moons' : 'body';
}

/** The address with `view` selected: its parameter set, the other views' cleared. */
export function withView(url: URL, view: PageView): URL {
  for (const other of VIEWS) { const parameter = PAGE_VIEWS[other].query; if (parameter && other !== view) url.searchParams.delete(parameter[0]); }
  const parameter = PAGE_VIEWS[view].query;
  if (parameter) url.searchParams.set(parameter[0], parameter[1]);
  return url;
}

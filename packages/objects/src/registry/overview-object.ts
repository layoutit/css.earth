import { isRecord } from '@cssearth/core';

/**
 * A level above the star systems (the Milky Way, the Local Group, the nearby and the observable universe): an object of
 * the one registry whose page, `/<id>/`, is its host scene's with that overview selected. Like a catalogue focus it has
 * no scene of its own. Its package authors it under `properties.overview`; preparation adds the host.
 */
export interface OverviewObject {
  readonly kind: 'overview';
  readonly id: string;
  readonly name: string;
  /** The card's introduction and the page's description. */
  readonly description: string;
  /** Its place on the zoom ladder, from the nearest level out; breadcrumbs list the levels in this order. */
  readonly order: number;
  readonly route: string;
  readonly sceneHostId: string;
}

const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/** Decode a prepared overview entry, as `prepare:catalog` writes it. */
export function defineOverview(input: unknown): OverviewObject {
  if (!isRecord(input) || Object.keys(input).some(key => !['kind', 'id', 'name', 'description', 'order', 'route', 'sceneHostId'].includes(key)) ||
      input.kind !== 'overview' || typeof input.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(input.id) || input.route !== `/${input.id}/` ||
      !text(input.name) || !text(input.description) || !Number.isSafeInteger(input.order) || Number(input.order) < 1 ||
      typeof input.sceneHostId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(input.sceneHostId)) {
    throw new TypeError(`Invalid overview entry: ${isRecord(input) ? String(input.id) : typeof input}; it needs a name, description, order from 1, its host and the route /<id>/.`);
  }
  return Object.freeze({ kind: 'overview', id: input.id, name: input.name as string, description: input.description as string,
    order: input.order as number, route: input.route, sceneHostId: input.sceneHostId });
}

/** The overview a package's descriptor authors (`properties.overview`), hosted by `sceneHostId`; null when it authors none. */
export function overviewEntry(descriptor: unknown, sceneHostId: string): OverviewObject | null {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.overview === undefined) return null;
  const overview = descriptor.properties.overview;
  if (!isRecord(overview) || Object.keys(overview).some(key => !['name', 'description', 'order'].includes(key))) {
    throw new TypeError(`Invalid overview metadata: ${String(descriptor.id)}; it names only its name, description and order.`);
  }
  return defineOverview({ kind: 'overview', id: descriptor.id, name: overview.name, description: overview.description, order: overview.order,
    route: `/${String(descriptor.id)}/`, sceneHostId });
}

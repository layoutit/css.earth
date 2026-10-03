import { OBJECTS, ancestorsOf, type NavigableObject } from './objects.mts';
import { WORLD_HOST_ID } from './navigation/navigation-scope.mts';
import { catalogueMoons } from './prepare-body-moons.mts';
import { APPLICATION_WORLD_CONTEXT, APPLICATION_WORLD_FILE_OF } from './world-context-plan.mts';

const PARSEC_M = 3.085677581491367e16;
const objects = new Map(OBJECTS.map(object => [object.id, object] as const));
const childIds = new Map<string, string[]>();
for (const object of OBJECTS) if (object.parent) childIds.set(object.parent, [...childIds.get(object.parent) ?? [], object.id]);
/** The bodies the map draws as plain dots, with no name, hover or click (site/build/prepare/prepare-spatial-context.ts). */
const plainDots = new Set(APPLICATION_WORLD_CONTEXT.bodies.flatMap(body => 'plainDot' in body && body.plainDot === true ? [body.id] : []));
/** The bodies the world draws from their record alone, by the object whose file has them (world-holders.ts `placeOf`): each
 * has an orbit and no measured size, so no package and no page yet. */
const recordOnly = new Map<string, { readonly id: string; readonly name: string }[]>();
for (const body of APPLICATION_WORLD_CONTEXT.bodies) {
  if (!('unpackaged' in body) || body.unpackaged !== true) continue;
  const file = APPLICATION_WORLD_FILE_OF.get(body.id);
  if (file === undefined) throw new TypeError(`World body ${body.id} has no package and no file of the world holds it.`);
  recordOnly.set(file, [...recordOnly.get(file) ?? [], { id: body.id, name: body.name }]);
}
/** The objects the world's host is inside: the reader's home in each of them. */
const home = new Set(ancestorsOf(WORLD_HOST_ID).map(object => object.id));

/** A listed child: the body the row shows, and how far it is from the list's reference point, in parsecs. */
export interface ListedChild { readonly object: NavigableObject; readonly distancePc: number }
export interface ObjectChildren {
  /** The object's children that have a page, in list order. */
  readonly rows: readonly ListedChild[];
  /** Bodies inside the object that have no page yet: a moon its host's catalogue names and nobody has packaged, a star or
   * a black hole the world draws from its orbit alone. Rows that open nothing, by name. */
  readonly drafts: readonly { readonly id: string; readonly name: string }[];
  /** The system's host when the object is a system: its rows show search's own distance. */
  readonly host: NavigableObject | undefined;
  /** The galaxy the reader is at home in, when the list holds it: the other rows are measured from its centre. */
  readonly homeGalaxy: NavigableObject | undefined;
}

const distance = (a: NavigableObject, b: NavigableObject) => Math.hypot(...a.worldFrame.originM.map((value, axis) => value - b.worldFrame.originM[axis]!)) / PARSEC_M;

/**
 * What is inside an object, as every card lists it: the objects whose parent it is in the object tree
 * (packages/objects/src/registry/object-tree.ts).
 *
 * - A child that is a system shows as its host: the Solar System lists Jupiter, not the Jupiter system.
 * - A child the map never names is not listed: an asteroid or a star it draws as a plain dot. A plain-dot star is listed in
 *   the system it is inside, where the map names it (application-world-visibility.mts `placedSystemOf`).
 * - A system's host leads. Planets come before other bodies. Then nearest first: from the host in a system, from the centre
 *   of the reader's home galaxy where the list holds it (the view from home), else from the Sun. Then by name.
 * - A body inside it with no page yet closes the list as a row that opens nothing.
 */
export function childrenOf(objectId: string): ObjectChildren {
  const parent = objects.get(objectId);
  if (!parent) throw new TypeError(`${objectId} is no object of the registry.`);
  const host = parent.system ? objects.get(parent.system.host) : undefined;
  const shown = (childIds.get(objectId) ?? []).map(id => {
    const child = objects.get(id)!;
    return child.system ? objects.get(child.system.host) ?? child : child;
  });
  const listed = shown.filter(body => body.id === host?.id || !plainDots.has(body.id) || host !== undefined && body.classification === 'star');
  const homeGalaxy = host ? undefined : listed.find(body => home.has(body.id) && body.classification === 'galaxy');
  const planet = (body: NavigableObject) => body.classification === 'planet' || body.classification === 'exoplanet';
  const rows = listed.map(object => ({ object, distancePc: host ? distance(object, host) : homeGalaxy ? distance(object, homeGalaxy) : object.distance.meters / PARSEC_M }))
    .sort((a, b) => Number(b.object.id === host?.id) - Number(a.object.id === host?.id) || Number(planet(b.object)) - Number(planet(a.object))
      || a.distancePc - b.distancePc || a.object.name.localeCompare(b.object.name, 'en', { numeric: true }));
  const packaged = new Set(listed.map(body => body.id));
  const drafts = [...(host ? catalogueMoons(host.id) : []), ...recordOnly.get(objectId) ?? []].filter(body => !packaged.has(body.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return Object.freeze({ rows: Object.freeze(rows), drafts: Object.freeze(drafts), host, homeGalaxy });
}

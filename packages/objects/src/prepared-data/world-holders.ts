import { systemHostId, systemObjectId } from '../registry/system-address.js';

/** What the rule reads of a world body: the facts every prepared row carries. */
export interface HolderBody {
  readonly id: string;
  readonly classification?: string;
  readonly plainDot?: boolean;
  readonly orbit?: { readonly centerBodyId: string } | null;
  readonly boundTo?: { readonly hostId: string } | null;
}

export interface WorldHolders {
  /** The object whose `prepared/members.json` has the row of `id`: the object it is inside (packages/objects/src/registry/
   * object-tree.ts), and for a body with a system of its own, the object its system is inside, since a system is drawn as
   * its host. A star drawn as a plain dot is in the file of its own system, or of the system it is inside (a companion
   * bound to that system's star); one inside no system is its own holder of one row, which its object entry carries. An
   * asteroid drawn as a plain dot is a dot of the asteroid bank, whose file has its row. Undefined for the world's focus,
   * the Sun, which the world's own file holds. */
  holderOf(id: string): string | undefined;
  /** Whether the holder `id` has a body the map draws from anywhere: one that orbits nothing or the focus and is no plain
   * dot (a planet, a featured star, a galaxy). Every page reads such a file at startup; any other is read when its place
   * comes near or navigation goes to one of its bodies. */
  drawnFromAnywhere(id: string): boolean;
  /** Whether `id`'s row is a plain-dot star inside no system, carried by its own object entry. */
  ownRow(id: string): boolean;
  /** Whether `id` is a star the map draws as a plain dot, of a dot bank (alone, with its system round it, or bound to a
   * system's star). */
  plainDotStar(id: string): boolean;
  /** The object `id`, with the system it hosts, is inside in the object tree: its parent, or its system's parent. A body
   * without a package is in the system its orbit leads to. The runtime reads a system's members from this. */
  insideOf(id: string): string;
}

/** The world's holders, from the object tree (`parentOf`) and the rows the bake prepared. Bake and build share it, so the
 * build keeps no table of holders. */
export function worldHolders(focusId: string, bodies: readonly HolderBody[], parentOf: (id: string) => string | undefined,
  asteroidHolder?: string): WorldHolders {
  const byId = new Map(bodies.map(body => [body.id, body] as const));
  const orbited = new Set(bodies.flatMap(body => body.orbit ? [body.orbit.centerBodyId] : []));
  const hasSystem = (id: string) => parentOf(id) === systemObjectId(id);
  // A plain dot stays one whatever it is bound to: the pair's rows arrive together, in the file of the system they share.
  const plainStar = (body: HolderBody) => body.plainDot === true && body.classification === 'star' && !body.orbit;
  const plainAsteroid = (body: HolderBody) => asteroidHolder !== undefined && body.plainDot === true && body.classification === 'asteroid'
    && body.orbit?.centerBodyId === focusId && !orbited.has(body.id);
  const moon = (body: HolderBody) => {
    const centre = body.orbit ? byId.get(body.orbit.centerBodyId) : undefined;
    return body.classification === 'satellite' && centre !== undefined && centre.classification !== 'star' && centre.classification !== 'black-hole';
  };
  // A body without a package of its own yet is in the system its orbit leads to.
  const placeOf = (body: HolderBody): string => {
    const parent = parentOf(body.id);
    if (parent !== undefined) return parent;
    const centre = body.orbit?.centerBodyId ?? body.boundTo?.hostId;
    if (centre === undefined) throw new TypeError(`World body ${body.id} has no object package, so the object tree does not say what it is inside.`);
    return hasSystem(centre) ? systemObjectId(centre) : centre === focusId ? systemObjectId(focusId) : placeOf(byId.get(centre) ?? { id: centre });
  };
  // The system a plain-dot star without one of its own is inside: its parent when that is a system object, or for a body
  // without a package, the system of the star it is bound to.
  const systemOf = (body: HolderBody): string | undefined => {
    const parent = parentOf(body.id);
    if (parent !== undefined) return systemHostId(parent) === null ? undefined : parent;
    return body.boundTo ? placeOf(body) : undefined;
  };
  const holders = new Map<string, string>();
  const holderOf = (id: string): string | undefined => {
    if (id === focusId) return undefined;
    const known = holders.get(id);
    if (known !== undefined) return known;
    const body = byId.get(id);
    if (!body) throw new TypeError(`${id} is no body of the world.`);
    const holder = plainAsteroid(body) ? asteroidHolder!
      : plainStar(body) ? hasSystem(id) ? systemObjectId(id) : systemOf(body) ?? id
        : hasSystem(id) ? placeOf({ id: systemObjectId(id) }) : placeOf(body);
    holders.set(id, holder);
    return holder;
  };
  const anywhere = new Set(bodies.flatMap(body => {
    const holder = holderOf(body.id);
    return holder !== undefined && !plainStar(body) && !plainAsteroid(body) && !moon(body) && (!body.orbit || body.orbit.centerBodyId === focusId) ? [holder] : [];
  }));
  return { holderOf, drawnFromAnywhere: id => anywhere.has(id),
    ownRow: id => { const body = byId.get(id); return body !== undefined && plainStar(body) && holderOf(id) === id; },
    plainDotStar: id => { const body = byId.get(id); return body !== undefined && plainStar(body); },
    insideOf: id => hasSystem(id) ? placeOf({ id: systemObjectId(id) }) : placeOf(byId.get(id) ?? { id }) };
}

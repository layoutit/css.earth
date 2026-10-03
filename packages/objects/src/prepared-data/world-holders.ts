import { systemObjectId } from '../registry/system-address.js';

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
   * its host. A star drawn as a plain dot with nothing round it is its own holder of one row, which its object entry
   * carries; an asteroid drawn as a plain dot is a dot of the asteroid bank, whose file has its row. Undefined for the
   * world's focus, the Sun, which the world's own file holds. */
  holderOf(id: string): string | undefined;
  /** Whether the holder `id` has a body the map draws from anywhere: one that orbits nothing or the focus and is no plain
   * dot (a planet, a featured star, a galaxy). Every page reads such a file at startup; any other is read when its place
   * comes near or navigation goes to one of its bodies. */
  drawnFromAnywhere(id: string): boolean;
  /** Whether `id`'s row is a plain dot with nothing round it, carried by its own object entry. */
  ownRow(id: string): boolean;
  /** Whether `id` is a star the map draws as a plain dot, of a dot bank (alone, or with its system round it). */
  plainDotStar(id: string): boolean;
}

/** The world's holders, from the object tree (`parentOf`) and the rows the bake prepared. Bake and build share it, so the
 * build keeps no table of holders. */
export function worldHolders(focusId: string, bodies: readonly HolderBody[], parentOf: (id: string) => string | undefined,
  asteroidHolder?: string): WorldHolders {
  const byId = new Map(bodies.map(body => [body.id, body] as const));
  const bound = new Set(bodies.flatMap(body => body.boundTo ? [body.boundTo.hostId] : []));
  const orbited = new Set(bodies.flatMap(body => body.orbit ? [body.orbit.centerBodyId] : []));
  const hasSystem = (id: string) => parentOf(id) === systemObjectId(id);
  const plainStar = (body: HolderBody) => body.plainDot === true && body.classification === 'star' && !body.orbit && !body.boundTo && !bound.has(body.id);
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
  const holders = new Map<string, string>();
  const holderOf = (id: string): string | undefined => {
    if (id === focusId) return undefined;
    const known = holders.get(id);
    if (known !== undefined) return known;
    const body = byId.get(id);
    if (!body) throw new TypeError(`${id} is no body of the world.`);
    const holder = plainAsteroid(body) ? asteroidHolder!
      : plainStar(body) ? hasSystem(id) ? systemObjectId(id) : id
        : hasSystem(id) ? placeOf({ id: systemObjectId(id) }) : placeOf(body);
    holders.set(id, holder);
    return holder;
  };
  const anywhere = new Set(bodies.flatMap(body => {
    const holder = holderOf(body.id);
    return holder !== undefined && !plainStar(body) && !plainAsteroid(body) && !moon(body) && (!body.orbit || body.orbit.centerBodyId === focusId) ? [holder] : [];
  }));
  return { holderOf, drawnFromAnywhere: id => anywhere.has(id),
    ownRow: id => { const body = byId.get(id); return body !== undefined && plainStar(body) && !hasSystem(id); },
    plainDotStar: id => { const body = byId.get(id); return body !== undefined && plainStar(body); } };
}

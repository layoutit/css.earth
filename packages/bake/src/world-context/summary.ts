import { PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, PREPARED_WORLD_SYSTEM_SCHEMA, systemHostId, systemObjectId, worldHolders } from '@cssearth/objects';
import type { PreparedWorldContextData } from '@cssearth/objects';
import { outwardSphere } from './spatial-context.ts';
import type { Vector3 } from './spatial-context.ts';
import type { PreparedSystemView } from '@cssearth/objects';

export type Billboard = { readonly url: string; readonly size: number; readonly focalPixels: number; readonly distanceM: number };
type Facts = Readonly<Record<string, unknown>>;
type Body = PreparedWorldContextData['focus'] | PreparedWorldContextData['bodies'][number];

/** The browser's copy of a prepared world context, split by the object tree (packages/objects/src/registry/object-tree.ts):
 * every body's row is in the file of the object it is inside, and a body with a system of its own is drawn as that system,
 * so its row is in the file of the object its system is inside (Earth's in the Solar System's, the Moon's in the Earth
 * system's, TRAPPIST-1's in the Milky Way's). `worldHolders` in @cssearth/objects is the rule; the build reads the same one.
 * - `summary` (`world-context-summary.json`, read by every page) holds the camera, frame and sky facts and the focus, the
 *   Sun, at the frame's origin. It lists no other body.
 * - `systems` (`src/objects/<object id>/prepared/members.json`) is one object's file each: its bodies, their named orbit
 *   centres and orbit-bank pins. A file whose bodies the map draws from anywhere (`drawnFromAnywhere`: the Solar System's
 *   planets, the Milky Way's featured stars, the galaxies) is read by every page at startup; every page also reads the
 *   files of the objects it is inside. Any other file is read when the camera comes near its place or navigation goes to
 *   one of its bodies (site/world-context-plan.mts).
 * - `places` (`src/objects/<object id>/prepared/places.json`) is, per object, where each file read on approach is: its
 *   system's host star or planet, rounded, and the range its orbits are authored to. A file with places is read at startup.
 * - A star drawn as a plain dot with nothing round it has its row in `index.rows`, which its object entry carries; an
 *   asteroid drawn as a plain dot is a dot of the asteroid dot bank, whose file has its row (`asteroidHolder`).
 * - `index` is the build's own: every body in the full context's order and those rows. It names no holder.
 * Orbit paths and detail levels go to the planner worker as binary orbit banks (`worldOrbitBanks`), which these files pin
 * by byte length; each orbit here keeps its parent, bounds and size. Classification views are build-time only.
 *
 * Each file writes what many bodies repeat once. `expandWorldContextSummary` and `expandWorldSystem` in
 * @cssearth/objects put it back before the renderer validates it:
 * - `bodies` is one column per field, a body's value at its index and `null` where it has none.
 * - A body names its system and discovery record by their place in `systemNames` and `discoveries`.
 * - A billboard writes only what differs from `billboard`, the size, focal length and distance (in body radii) most
 *   billboards share; its address is its own world billboard, `/scenes/<id>/<id>-billboard.webp`, unless it says otherwise.
 * - An orbit leaves out its centre when that is its parent's prepared position (every orbit, as `prepareWorldContext`
 *   places them), and says `lod: true` when its detail levels share its bounds. */
export function summarizeWorldContext(prepared: PreparedWorldContextData, orbitBanks: Readonly<Record<string, number>>,
  /** The object each object is inside (its package's `parent`). */
  parentOf: (id: string) => string | undefined,
  /** The dot bank object whose dots the plain-dot asteroids are: their holder. */
  asteroidHolder?: string) {
  const { classificationViews: _views, focus, bodies, orbitCenters = {}, schema: _schema, ...rest } = prepared;
  const holders = worldHolders(focus.id, bodies.map(body => ({ id: body.id, classification: body.classification, plainDot: body.plainDot,
    orbit: body.orbit ?? null, boundTo: 'boundTo' in body ? body.boundTo ?? null : null })), parentOf, asteroidHolder);
  const positions = new Map<string, Vector3>([...[focus, ...bodies].map(body => [body.id, body.positionM] as const),
    ...Object.entries(orbitCenters).map(([id, centre]) => [id, centre.positionM] as const)]);
  const byId = new Map(bodies.map(body => [body.id, body] as const));
  const files = new Map<string, PreparedWorldContextData['bodies'][number][]>(), rows = new Map<string, PreparedWorldContextData['bodies'][number]>();
  for (const body of bodies) {
    if (holders.ownRow(body.id)) { rows.set(body.id, body); continue; }
    const holder = holders.holderOf(body.id)!;
    (files.get(holder) ?? files.set(holder, []).get(holder)!).push(body);
  }
  // A named orbit centre (a circumbinary planet's barycentre) is in the file of the bodies that orbit it.
  const centreFile = new Map<string, string>();
  for (const body of bodies) if (body.orbit && Object.hasOwn(orbitCenters, body.orbit.centerBodyId) && !centreFile.has(body.orbit.centerBodyId)) {
    centreFile.set(body.orbit.centerBodyId, holders.ownRow(body.id) ? body.id : holders.holderOf(body.id)!);
  }
  for (const id of Object.keys(orbitCenters)) if (!centreFile.has(id)) throw new TypeError(`Named orbit centre ${id} has no body orbiting it.`);
  const centresOf = (file: string) => Object.fromEntries(Object.entries(orbitCenters).filter(([id]) => centreFile.get(id) === file));
  const pinsOf = (members: readonly Body[]) => Object.fromEntries(members.flatMap(body => orbitBanks[body.id] === undefined ? [] : [[body.id, orbitBanks[body.id]!] as const]));
  // Where each file read on approach is: its system's host, in the file of the object that system is inside. A dot bank's
  // file is never approached: its bodies are its dots until one is opened or their category is highlighted.
  const places = new Map<string, { id: string; positionM: Vector3; orbitsWithinM: number | null }[]>();
  for (const id of files.keys()) {
    if (holders.drawnFromAnywhere(id) || id === asteroidHolder) continue;
    // Its host is a body of the world, or a centre the world places without drawing it (a moon's primary that has no row).
    const host = systemHostId(id), body = host === null ? undefined : host === focus.id ? focus : byId.get(host);
    const placeM = host === null ? undefined : positions.get(host), parent = parentOf(id);
    if (!placeM || !parent) throw new TypeError(`World file ${id} is read on approach, so it must be a system whose host the world places and whose package (src/objects/${id}/object.json) names its parent.`);
    // To the nearest 1e12 m: an approach is measured against a system's fade distance, 1e16 m or more.
    (places.get(parent) ?? places.set(parent, []).get(parent)!).push({ id, positionM: placeM.map(value => Math.round(value / APPROACH_ROUNDING_M) * APPROACH_ROUNDING_M) as unknown as Vector3,
      orbitsWithinM: body && 'orbitsWithinM' in body && typeof body.orbitsWithinM === 'number' ? body.orbitsWithinM : null });
  }
  // An object with places has a file, read at startup, so its places are read.
  for (const id of places.keys()) if (!files.has(id)) files.set(id, []);
  const root = encodeBodies([focus], positions);
  const summary = { schema: PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA as typeof PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, ...rest, worldBodyCount: bodies.length,
    orbitBanks: {}, ...root.tables(), focus: root.rows[0]!, bodies: {} };
  // A page reads what a body is inside from the file its row is in (world-context.ts parsePreparedWorldSystem). A file whose
  // bodies are inside another object says which: the asteroid dot bank's are inside the Solar System.
  const insideOf = (id: string, members: readonly Body[]) => {
    const told = members.filter(body => body.id !== id && systemObjectId(body.id) !== id).map(body => holders.insideOf(body.id));
    if (told.every(inside => inside === id)) return undefined;
    if (new Set(told).size > 1) throw new TypeError(`World file ${id} holds bodies inside ${[...new Set(told)].join(' and ')}; a file's bodies are inside one object.`);
    return told[0];
  };
  // A host whose row is in its own system's file does not say what it is inside, and a page does not need it: its system
  // is inside a galaxy. One whose system is inside another system says so (Epsilon Indi Ba, whose system Epsilon Indi B is
  // inside Epsilon Indi A's): a page reads that system's members from it.
  const nested = (id: string, body: Body): Body => {
    const outer = systemObjectId(body.id) === id ? holders.insideOf(body.id) : undefined;
    return outer !== undefined && systemHostId(outer) !== null ? { ...body, inside: outer } : body;
  };
  const encode = (id: string, members: readonly Body[]) => {
    const file = encodeBodies(members.map(body => nested(id, body)), positions), centres = centresOf(id), inside = insideOf(id, members);
    return { schema: PREPARED_WORLD_SYSTEM_SCHEMA as typeof PREPARED_WORLD_SYSTEM_SCHEMA, id, ...(inside === undefined ? {} : { inside }), ...(Object.keys(centres).length ? { orbitCenters: centres } : {}),
      orbitBanks: pinsOf(members), ...file.tables(), bodies: columns(file.rows),
      ...(holders.drawnFromAnywhere(id) || places.has(id) ? { anywhere: true } : {}), ...(places.has(id) ? { places: true } : {}) };
  };
  // From the root of the tree down: a file is read after the files of the objects it is inside, which place its orbits' parents.
  const depth = (id: string) => { let steps = 0; for (let at = parentOf(id); at !== undefined; at = parentOf(at)) steps++; return steps; };
  const ordered = [...files.keys()].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  return { summary, systems: ordered.map(id => ({ id, file: encode(id, files.get(id)!) })),
    /** Per object, its children's files read on approach, as columns (`places.json`). */
    places: [...places].sort(([a], [b]) => a.localeCompare(b)).map(([id, list]) => ({ id, file: { id: list.map(place => place.id),
      positionM: list.map(place => place.positionM), orbitsWithinM: list.map(place => place.orbitsWithinM) } })),
    /** The build's own table (`world-index.json`), never served: every body in the full context's order, every object with
     * a file from the root of the tree down, and the row of each plain-dot star nothing orbits, which its object entry carries. */
    index: { order: bodies.map(body => body.id), files: ordered, rows: Object.fromEntries([...rows].map(([id, body]) => [id, encode(id, [body])])) },
    /** Every star the files leave out, which the map draws from dot banks (plain-star-dots.ts). */
    plainStars: bodies.filter(body => holders.plainDotStar(body.id)),
    /** What each body, with the system it hosts, is inside in the object tree: the full context's rows carry it. */
    insideOf: (id: string) => holders.insideOf(id) };
}

/** The rounding of a place in `places.json`, in metres. */
const APPROACH_ROUNDING_M = 1e12;

/** The world draws every body but its focus as a billboard of a few to a hundred CSS pixels: its arrival photograph at
 * this size (`prepare-world-billboards.mts`), not the 1024-pixel photograph the arrival covers the screen with. */
export const WORLD_BILLBOARD_SIZE = 256;
export const worldBillboardFilename = (id: string) => `${id}-billboard.webp`;
/** A body's billboard in the world: its own photograph at `WORLD_BILLBOARD_SIZE`, with the same optics. A body that borrows
 * another's photograph keeps it as it is. */
export function worldBillboardOf(id: string, arrival: Billboard): Billboard {
  if (arrival.url !== `/scenes/${id}/${id}-arrival.webp`) return arrival;
  const scale = WORLD_BILLBOARD_SIZE / arrival.size;
  return { url: `/scenes/${id}/${worldBillboardFilename(id)}`, size: WORLD_BILLBOARD_SIZE, focalPixels: arrival.focalPixels * scale, distanceM: arrival.distanceM };
}

/** Bodies written with one file's shared tables (see `summarizeWorldContext`). `positions` places every orbit's parent. */
function encodeBodies(bodies: readonly Body[], positions: ReadonlyMap<string, Vector3>) {
  const arrivalOf = (body: { readonly id: string; readonly discovery?: Facts }) => {
    const arrival = (body.discovery?.arrival as { billboard?: Billboard } | undefined)?.billboard;
    return arrival && worldBillboardOf(body.id, arrival);
  };
  // The billboard most bodies share, each part counted on its own; ties go to the smaller value, so a rerun writes the same.
  const common = (values: readonly number[]) => {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  };
  const drawn = bodies.flatMap(body => { const billboard = arrivalOf(body); return billboard ? [{ body, billboard }] : []; });
  const size = common(drawn.map(({ billboard }) => billboard.size));
  const focalPixels = common(drawn.map(({ billboard }) => billboard.focalPixels));
  const distanceRadii = common(drawn.map(({ body, billboard }) => billboard.distanceM / body.radiusM));
  const systemNames: string[] = [], discoveries: Facts[] = [];
  const systemIndex = new Map<string, number>(), discoveryIndex = new Map<string, number>();
  const indexOf = <T>(value: T, key: string, index: Map<string, number>, table: T[]) => {
    let at = index.get(key);
    if (at === undefined) { at = table.length; table.push(value); index.set(key, at); }
    return at;
  };
  const systemName = (name: string) => indexOf(name, name, systemIndex, systemNames);
  // A body's arrival view is its own page's (the object entry carries it); the world only draws its photograph.
  const discovery = (record: Facts) => {
    const { arrival: _arrival, ...facts } = record;
    return indexOf(facts, JSON.stringify(facts), discoveryIndex, discoveries);
  };
  const rows = bodies.map((body): Facts => {
    const { systemName: name, discovery: record, systemView, ...kept } = body, billboard = arrivalOf(body);
    const orbit = 'orbit' in body ? body.orbit : undefined;
    // System views keep their members; their camera candidates are `worldSystemViews`, read when navigation frames one.
    const members = systemView && (({ candidates: _candidates, ...view }: PreparedSystemView) => view)(systemView);
    return { ...kept, ...(members ? { systemView: members } : {}),
      ...(name === undefined ? {} : { system: systemName(name) }),
      ...(record === undefined ? {} : { discovery: discovery(record) }),
      ...(billboard ? { billboard: {
        ...(billboard.url === `/scenes/${body.id}/${worldBillboardFilename(body.id)}` ? {} : { url: billboard.url }),
        ...(billboard.size === size ? {} : { size: billboard.size }),
        ...(billboard.focalPixels === focalPixels ? {} : { focalPixels: billboard.focalPixels }),
        ...(distanceRadii !== undefined && billboard.distanceM === body.radiusM * distanceRadii ? {} : { distanceM: billboard.distanceM }) } } : {}),
      ...(orbit ? { orbit: (() => {
        const { centerBodyId, centerPositionM, verticesM, trail, bounds, lod, closed, displayExtentAu } = orbit;
        const parentM = positions.get(centerBodyId);
        const orbitBounds = outwardSphere(bounds), detailBounds = outwardSphere(lod.bounds);
        const shared = detailBounds.radiusM === orbitBounds.radiusM && detailBounds.centerM.every((value, axis) => value === orbitBounds.centerM[axis]);
        return { centerBodyId, ...(parentM && centerPositionM.every((value, axis) => value === parentM[axis]) ? {} : { centerPositionM }),
          vertexCount: verticesM.length, fullTrail: trail.every(weight => weight === 1),
          bounds: orbitBounds, lod: shared ? true : { bounds: detailBounds }, ...(closed === false ? { closed, displayExtentAu } : {}) };
      })() } : {}) };
  });
  return { rows, systemName, discovery,
    // Read after every row is written: a later caller may still add to the tables.
    tables: () => ({ systemNames, discoveries, billboard: { ...(size === undefined ? {} : { size }),
      ...(focalPixels === undefined ? {} : { focalPixels }), ...(distanceRadii === undefined ? {} : { distanceRadii }) } }) };
}

/** Records as one column per field, `null` where a record has no value. */
function columns(rows: readonly Facts[]): Record<string, unknown[]> {
  const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return Object.fromEntries(fields.map(field => [field, rows.map(row => {
    const value = row[field];
    if (value === null) throw new TypeError(`World context body ${String(row.id)} ${field} is null, which the summary's columns read as absent.`);
    return value ?? null;
  })]));
}

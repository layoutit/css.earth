import { PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, PREPARED_WORLD_SYSTEM_SCHEMA } from '@cssearth/objects';
import type { PreparedWorldContextData as PreparedWorldContext } from '@cssearth/objects';
import { outwardSphere } from './spatial-context.ts';
import type { Vector3 } from './spatial-context.ts';
import type { PreparedSystemView } from '@cssearth/objects';

export type Billboard = { readonly url: string; readonly size: number; readonly focalPixels: number; readonly distanceM: number };
type Facts = Readonly<Record<string, unknown>>;
type Body = PreparedWorldContext['focus'] | PreparedWorldContext['bodies'][number];

/** The browser's copy of a prepared world context, split by the object hierarchy. Every body belongs to the system of the
 * body its orbit chain ends at: a star or black hole that orbits nothing, or the focus (the Sun).
 * - `summary` (`world-context-summary.json`, read by every page) holds the camera and frame facts, the focus's own system
 *   in full, and every body that orbits nothing (each other system's star, drawn from afar as one point), but a star
 *   drawn as a plain dot that nothing orbits: 1,841 of the summary's 3,202 bodies, 78 KB of its 230 KB compressed
 *   (2026-10-02). Those hold no file: `stars` gives each one's row, which the build puts in the star's own object entry
 *   (`/objects/<id>/entry.json`), read when the star is opened; the map draws them from a dot bank. Each body of
 *   another system is only listed (`deferred`): its name, classification, discovery record, the star whose system file
 *   holds it and its place in the full context (`order`), which is what navigation, search and world visibility read before
 *   that system loads, and what puts every body back in its place once it has.
 * - `systems` (`world-systems/<star id>.json`, one per other system) hold that system's orbiting bodies, its named orbit
 *   centres and its orbit-bank pins. A page reads its own system's file at startup and any other when the camera
 *   approaches it or navigation targets it (site/world-context-plan.mts).
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
export function summarizeWorldContext(prepared: PreparedWorldContext, orbitBanks: Readonly<Record<string, number>>) {
  const { classificationViews: _views, focus, bodies, orbitCenters = {}, schema: _schema, ...rest } = prepared;
  const parents = new Map<string, string>([...bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
    ...Object.entries(orbitCenters).map(([id, centre]) => [id, centre.centerBodyId] as const)]);
  const hostOf = (id: string) => {
    let current = id;
    for (let steps = 0; parents.has(current); steps++) {
      if (steps > parents.size) throw new TypeError(`${id} has a cyclic orbit chain.`);
      current = parents.get(current)!;
    }
    return current;
  };
  const positions = new Map<string, Vector3>([...[focus, ...bodies].map(body => [body.id, body.positionM] as const),
    ...Object.entries(orbitCenters).map(([id, centre]) => [id, centre.positionM] as const)]);
  // A star something orbits, or another body is bound to, stays in the summary: its system and its companion read its place.
  const hosts = new Set([...bodies.filter(body => body.orbit).map(body => hostOf(body.id)), ...Object.keys(orbitCenters).map(hostOf),
    ...bodies.flatMap(body => 'boundTo' in body && body.boundTo ? [body.boundTo.hostId] : [])]);
  const plainStar = (body: Body) => body !== focus && !('orbit' in body && body.orbit) && !('boundTo' in body && body.boundTo) && body.plainDot === true
    && body.classification === 'star' && !hosts.has(body.id);
  const local = (body: Body) => !plainStar(body) && (!('orbit' in body && body.orbit) || hostOf(body.id) === focus.id);
  /** The file that holds a body the summary only lists: its star's, or a plain-dot star's own. */
  const fileOf = (body: Body) => plainStar(body) ? body.id : hostOf(body.id);
  const systems = new Map<string, PreparedWorldContext['bodies'][number][]>();
  for (const body of bodies) if (!local(body)) (systems.get(fileOf(body)) ?? systems.set(fileOf(body), []).get(fileOf(body))!).push(body);
  const centresOf = (host: string) => Object.fromEntries(Object.entries(orbitCenters).filter(([id]) => hostOf(id) === host));
  const pinsOf = (members: readonly Body[]) => Object.fromEntries(members.flatMap(body => orbitBanks[body.id] === undefined ? [] : [[body.id, orbitBanks[body.id]!] as const]));
  const rootBodies = bodies.filter(local), rootCentres = centresOf(focus.id);
  const root = encodeBodies([focus, ...rootBodies], positions);
  // Each other system's bodies, listed with what navigation and visibility read, in the root's own tables.
  const deferred = bodies.flatMap((body, order) => local(body) ? [] : [{ id: body.id, name: body.name, order,
    ...(body.systemName === undefined ? {} : { system: root.systemName(body.systemName) }),
    ...(body.classification === undefined ? {} : { classification: body.classification }),
    ...(body.discovery === undefined ? {} : { discovery: root.discovery(body.discovery) }),
    host: fileOf(body), ...(body.plainDot ? { plainDot: true } : {}), ...(body.unpackaged ? { unpackaged: true } : {}) }]);
  const [focusRow, ...rows] = root.rows;
  const summary = { schema: PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA as typeof PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, ...rest, worldBodyCount: bodies.length,
    ...(Object.keys(rootCentres).length ? { orbitCenters: rootCentres } : {}), orbitBanks: pinsOf(rootBodies),
    ...root.tables(), focus: focusRow!, bodies: columns(rows), deferred: columns(deferred) };
  const files = [...systems].map(([id, members]) => {
    const file = encodeBodies(members, positions), centres = centresOf(id);
    return { id, file: { schema: PREPARED_WORLD_SYSTEM_SCHEMA as typeof PREPARED_WORLD_SYSTEM_SCHEMA, id, ...(Object.keys(centres).length ? { orbitCenters: centres } : {}),
      orbitBanks: pinsOf(members), ...file.tables(), bodies: columns(file.rows) } };
  });
  const starIds = new Set(bodies.filter(plainStar).map(body => body.id));
  return { summary, systems: files.filter(system => !starIds.has(system.id)),
    /** Each plain-dot star nothing orbits, as the system of one body its object entry carries. */
    stars: Object.fromEntries(files.filter(system => starIds.has(system.id)).map(system => [system.id, system.file])) };
}

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
    // Read after every row is written: a later caller may still add to the tables (the root's deferred list does).
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

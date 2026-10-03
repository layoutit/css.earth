import { OBJECTS, SCENE_OBJECTS, type ObjectEntry } from './objects.mts';
import { systemObjectId } from './navigation/system-address.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';
import { childrenOf } from './object-children.mts';
import { systemSourceDocumentation } from './source-documentation.mts';
import { APPLICATION_WORLD_CONTEXT } from './world-context-plan.mts';
import overviewFacts from './source/overview-facts.json' with { type: 'json' };

/** Each world body's place in the world's prepared order. */
const worldOrder = new Map(APPLICATION_WORLD_CONTEXT.bodies.map((body, index) => [body.id, index]));
const objects = new Map(OBJECTS.map(object => [object.id, object]));
const bodies = new Map(SCENE_OBJECTS.map(object => [object.id, object]));
const children = new Map<string, string[]>();
for (const object of OBJECTS) if (object.parent) children.set(object.parent, [...children.get(object.parent) ?? [], object.id]);
/** Every body inside `id` in the object tree, at any depth; a system inside it is its bodies. */
const inside = (id: string): ObjectEntry[] => (children.get(id) ?? []).flatMap(child => {
  const body = bodies.get(child);
  return [...(body ? [body] : []), ...inside(child)];
});

/** The card of the system `hostId` hosts, read from the object tree: the system object names it and introduces it, and
 * the card lists what is inside it. Null for a body that hosts no system. */
export function systemCard(hostId: string) {
  const system = objects.get(systemObjectId(hostId)), host = bodies.get(hostId);
  if (!system?.system || !host) return null;
  const members = inside(system.id).filter(body => body.id !== hostId);
  // What the card lists is the one list of what is inside an object (object-children.mts).
  const list = childrenOf(system.id);
  const facts = hostId === SOLAR_SYSTEM_ID ? overviewFacts['solar-system'].facts : undefined;
  // The header names the system's source document: a system opened from a breadcrumb has no row in the lists to name it,
  // and the footer link kept the previous page's (2026-10-02). Its credits name the providers of everything inside it, in
  // the world's prepared order of bodies, which says who is named first.
  const credited = members.map(body => body.id).sort((a, b) => (worldOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (worldOrder.get(b) ?? Number.MAX_SAFE_INTEGER));
  return { system, host, count: list.rows.length + list.drafts.length, facts, source: systemSourceDocumentation({ id: hostId, name: system.name, memberIds: credited }) };
}

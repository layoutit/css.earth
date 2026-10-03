import { OBJECTS, SCENE_OBJECTS, type ObjectEntry } from './objects.mts';
import { systemObjectId } from './navigation/system-address.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';
import { prepareBodyMoons, type MoonListEntry } from './prepare-body-moons.mts';
import { systemSourceDocumentation } from './source-documentation.mts';
import overviewFacts from './source/overview-facts.json' with { type: 'json' };

const objects = new Map(OBJECTS.map(object => [object.id, object]));
const bodies = new Map(SCENE_OBJECTS.map(object => [object.id, object]));
const children = new Map<string, string[]>();
for (const object of OBJECTS) if (object.parent) children.set(object.parent, [...children.get(object.parent) ?? [], object.id]);
/** Every body inside `id` in the object tree, at any depth; a system inside it is its bodies. */
const inside = (id: string): ObjectEntry[] => (children.get(id) ?? []).flatMap(child => {
  const body = bodies.get(child);
  return [...(body ? [body] : []), ...inside(child)];
});

/** Whether a system's card lists a body inside it: its stars, its planets and its featured bodies. Search reaches the
 * rest; the Solar System's card listed all 545 of its bodies, 4,900 elements (2026-10-01). */
export function listedInSystemCard(object: { readonly classification: string; readonly discovery: { readonly featured: boolean } }): boolean {
  return object.classification === 'star' || object.classification === 'planet' || object.classification === 'exoplanet' || object.discovery.featured;
}

/** The card of the system `hostId` hosts, read from the object tree: the system object names it and introduces it, and
 * the card lists what is inside it. Null for a body that hosts no system. */
export function systemCard(hostId: string) {
  const system = objects.get(systemObjectId(hostId)), host = bodies.get(hostId);
  if (!system?.system || !host) return null;
  const members = inside(system.id).filter(body => body.id !== hostId);
  // A row is a body with a page, or a moon its host's catalogue names that has no package yet.
  const row = (object: ObjectEntry): MoonListEntry => ({ id: object.id, name: object.name, object });
  // A planet's or a small body's system lists the host and its moons in its moon catalogue's order (prepare-body-moons.mts).
  // A star's lists the star and, of the bodies inside, its stars, planets and featured bodies: the Solar System's planets lead,
  // each group nearest first; another star's bodies are all one distance from the Sun, which left TRAPPIST-1's as h, g, d,
  // c, the star, b, f, e (2026-10-02), so the star leads, then its bodies by name.
  const rows = system.classification === 'satellite-system' ? [row(host), ...prepareBodyMoons(hostId)]
    : [host, ...members.filter(listedInSystemCard)].sort(hostId === SOLAR_SYSTEM_ID
      ? (a, b) => Number(b.classification === 'planet') - Number(a.classification === 'planet') || a.distance.meters - b.distance.meters
      : (a, b) => Number(b.id === hostId) - Number(a.id === hostId) || a.name.localeCompare(b.name, 'en', { numeric: true })).map(row);
  const facts = hostId === SOLAR_SYSTEM_ID ? overviewFacts['solar-system'].facts : undefined;
  // The header names the system's source document: a system opened from a breadcrumb has no row in the lists to name it,
  // and the footer link kept the previous page's (2026-10-02).
  return { system, host, rows, facts, source: systemSourceDocumentation({ id: hostId, name: system.name, memberIds: members.map(body => body.id) }) };
}

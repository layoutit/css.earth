/**
 * A system is an object: a host with the bodies that orbit it has a package, an address and a page of its own
 * (`src/objects/<host>-system/object.json`; the Sun's is `solar-system`). This writes each one from what the repository
 * already holds: a star's planetary system from the prepared world's orbit graph (site/object-systems.mts), a star system
 * from the stars the records say are bound to a star nothing orbits, a planet's or small body's satellite system from its
 * prepared moons (site/satellite-systems.mts) and its cited introduction (src/navigation/system-text.json). A system
 * places nothing and draws nothing of its own: it shows its host's scene out to its members, and takes its host's place,
 * color and distance. It sits in the object tree where its host sat, and its host sits inside it, with the stars bound to
 * the host: this writes those parents.
 *
 * Usage: node site/build/prepare/system-packages.mts [host id ...]   (no ids: every system)
 */
import { sourceObject } from '@cssearth/objects/sources';
import { readObjectDescriptorRecord, readSystemText, SYSTEM_TEXT_SCHEMA, OBJECT_SCHEMA } from '@cssearth/objects';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../objects.mts';
import { allPlanetarySystems, SOLAR_SYSTEM_ID } from '../../object-systems.mts';
import { allSatelliteSystems } from '../../satellite-systems.mts';
import { systemObjectId } from '../../navigation/system-address.mts';
import { readSourceCatalog } from '@cssearth/bake/sources';
import { prepareSystemIntroductions } from './system-text.mts';
import { APPLICATION_WORLD_CONTEXT } from '../../world-context-plan.mts';

const objectsRoot = resolve(import.meta.dirname, '../../../src/objects');
const only = new Set(process.argv.slice(2));
const bodies = SCENE_OBJECTS.filter(object => !object.system);
const hostOf = (id: string) => { const host = bodies.find(object => object.id === id); if (!host) throw new TypeError(`System host ${id} has no object package.`); return host; };
type Descriptor = { parent?: string; properties: { catalog: Record<string, unknown>; worldFrame: unknown } };
const descriptorOf = async (id: string): Promise<Descriptor> => {
  const descriptor = readObjectDescriptorRecord(JSON.parse(await readFile(resolve(objectsRoot, id, 'object.json'), 'utf8')));
  return { ...descriptor, parent: typeof descriptor.parent === 'string' ? descriptor.parent : undefined, properties: { ...sourceObject(descriptor.properties), catalog: sourceObject(sourceObject(descriptor.properties).catalog), worldFrame: sourceObject(descriptor.properties).worldFrame } };
};
const existing = async (id: string) => descriptorOf(id).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
// Each moon system's cited introduction, checked: its length, and its sources against the source catalogue (system-text.mts).
const introductions = prepareSystemIntroductions({ schema: SYSTEM_TEXT_SCHEMA, satellites: readSystemText(JSON.parse(await readFile(resolve(objectsRoot, '../navigation/system-text.json'), 'utf8'))) },
  allSatelliteSystems().map(system => system.hostId), new Set((await readSourceCatalog(resolve(objectsRoot, '../..'))).records.map(record => record.id)));
/** The Solar System's card sentence. */
const SOLAR_SYSTEM_DESCRIPTION = 'The Sun and the objects bound to it by gravity: eight planets, their moons, dwarf planets, asteroids, trans-Neptunian objects and comets.';

/** The star each star is bound to with no orbit in the record (the astronomy records' `boundTo`), and what each world
 * body is: a member with no package yet (a star drawn from its record) is still a star. */
const boundTo = new Map(APPLICATION_WORLD_CONTEXT.bodies.flatMap(body => body.boundTo ? [[body.id, body.boundTo.hostId] as const] : []));
const classifications = new Map(APPLICATION_WORLD_CONTEXT.bodies.map(body => [body.id, body.classification]));
/** What a member is: its package's classification, or for a body drawn from its record alone, the record's. */
const classificationOf = async (id: string) => classifications.get(id)
  ?? (JSON.parse(await readFile(resolve(objectsRoot, '../../packages/astronomy/data/bodies', `${id}.json`), 'utf8')) as { classification: string }).classification;
const COUNTS = ['two', 'three', 'four', 'five', 'six'];
/** The card sentence of a star nothing orbits with the stars bound to it: its stars by name. Its host's own sentence
 * describes one star; that the stars are bound is each companion's record (`sources.binary`). */
const boundStarsDescription = (hostId: string, memberIds: readonly string[]) => {
  const names = [hostId, ...memberIds].map(id => hostOf(id).name), count = COUNTS[names.length - 2];
  if (!count) throw new TypeError(`src/objects/${systemObjectId(hostId)}/object.json: the system has ${names.length} stars; add its count word to system-packages.mts.`);
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)!} are ${count} stars bound to each other by gravity.`;
};
const stellar = async (ids: readonly string[]) => (await Promise.all(ids.map(classificationOf))).every(classification => classification === 'star' || classification === 'black-hole');

const systems = [
  ...await Promise.all(allPlanetarySystems(bodies).filter(system => system.memberIds.length > 0).map(async system => {
    // A star with only stars inside its system (a companion that orbits it, or one bound to it with no orbit in the
    // record) is a star system; with a planet it is a planetary system.
    const bound = system.memberIds.filter(id => boundTo.get(id) === system.id);
    return { hostId: system.id, name: system.name, bound,
      classification: await stellar(system.memberIds) ? 'star-system' : 'planetary-system',
      // What the system's card has always said: its star's own description; the Solar System's is its own sentence, and so
      // is a system of bound stars alone.
      description: system.id === SOLAR_SYSTEM_ID ? SOLAR_SYSTEM_DESCRIPTION
        : bound.length === system.memberIds.length ? boundStarsDescription(system.id, bound) : hostOf(system.id).description };
  })),
  ...allSatelliteSystems().map(system => {
    return { hostId: system.hostId, name: system.name, bound: [] as string[], classification: 'satellite-system', description: introductions[system.hostId]! };
  }),
];
let written = 0;
for (const system of systems) {
  if (only.size && !only.has(system.hostId)) continue;
  const id = systemObjectId(system.hostId), host = await descriptorOf(system.hostId), catalog = host.properties.catalog;
  // The host is inside its system, and the system sits where the host sat (packages/objects/src/registry/object-tree.ts):
  // a star's system inside its galaxy, a planet's inside its star's system.
  const parent = host.parent === id ? (await existing(id))?.parent : host.parent;
  if (parent === undefined || parent === id) throw new TypeError(`src/objects/${system.hostId}/object.json: the host of ${id} names no parent, so the system has no place in the object tree.`);
  if (host.parent !== id) {
    await writeFile(resolve(objectsRoot, system.hostId, 'object.json'), `${JSON.stringify({ ...host, parent: id }, null, 2)}\n`);
  }
  // A star bound to the host is inside the host's system (`checkBoundStars`, object-tree.ts). One with bodies of its own
  // hosts a system inside this one (Epsilon Indi B): then its system is what is inside it, and the star stays in its own.
  for (const starId of system.bound) {
    const star = await existing(starId);
    const insideId = star?.parent === systemObjectId(starId) ? systemObjectId(starId) : starId, inside = insideId === starId ? star : await existing(insideId);
    if (inside && inside.parent !== id) await writeFile(resolve(objectsRoot, insideId, 'object.json'), `${JSON.stringify({ ...inside, parent: id }, null, 2)}\n`);
  }
  const descriptor = { schema: OBJECT_SCHEMA, id, parent, type: 'system',
    generator: 'site/build/prepare/system-packages.mts',
    properties: {
      system: { host: system.hostId },
      catalog: { name: system.name, systemName: catalog.systemName, classification: system.classification, color: catalog.color, distanceAu: catalog.distanceAu, description: system.description },
      worldFrame: host.properties.worldFrame } };
  await mkdir(resolve(objectsRoot, id), { recursive: true });
  await writeFile(resolve(objectsRoot, id, 'object.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
  written++;
}
console.log(`Wrote ${written} of ${systems.length} system packages (${systems.filter(system => system.classification === 'planetary-system').length} planetary, ${systems.filter(system => system.classification === 'star-system').length} star, ${systems.filter(system => system.classification === 'satellite-system').length} satellite).`);

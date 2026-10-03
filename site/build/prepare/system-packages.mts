/**
 * A system is an object: a host with the bodies that orbit it has a package, an address and a page of its own
 * (`src/objects/<host>-system/object.json`; the Sun's is `solar-system`). This writes each one from what the repository
 * already holds: a star's planetary system from the prepared world's orbit graph (site/object-systems.mts), a planet's or
 * small body's satellite system from its prepared moons (site/satellite-systems.mts) and its cited introduction
 * (src/navigation/system-text.json). A system places nothing and draws nothing of its own: it shows its host's scene out
 * to its members, and takes its host's place, color and distance. It sits in the object tree where its host sat, and its
 * host sits inside it: this writes both parents.
 *
 * Usage: node site/build/prepare/system-packages.mts [host id ...]   (no ids: every system)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../objects.mts';
import { allPlanetarySystems, SOLAR_SYSTEM_ID } from '../../object-systems.mts';
import { allSatelliteSystems } from '../../satellite-systems.mts';
import { systemObjectId } from '../../navigation/system-address.mts';

const objectsRoot = resolve(import.meta.dirname, '../../../src/objects');
const only = new Set(process.argv.slice(2));
const bodies = SCENE_OBJECTS.filter(object => !object.system);
const hostOf = (id: string) => { const host = bodies.find(object => object.id === id); if (!host) throw new TypeError(`System host ${id} has no object package.`); return host; };
type Descriptor = { parent?: string; properties: { catalog: Record<string, unknown>; worldFrame: unknown } };
const descriptorOf = async (id: string) => JSON.parse(await readFile(resolve(objectsRoot, id, 'object.json'), 'utf8')) as Descriptor;
const existing = async (id: string) => descriptorOf(id).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
const texts = JSON.parse(await readFile(resolve(objectsRoot, '../navigation/system-text.json'), 'utf8')) as { satellites: Record<string, { text: string }> };
/** The Solar System's card sentence. */
const SOLAR_SYSTEM_DESCRIPTION = 'The Sun and the objects bound to it by gravity: eight planets, their moons, dwarf planets, asteroids, trans-Neptunian objects and comets.';

const systems = [
  ...allPlanetarySystems(bodies).filter(system => system.memberIds.length > 0).map(system => ({ hostId: system.id, members: 'planets' as const, name: system.name,
    classification: 'planetary-system',
    // What the system's card has always said: its star's own description; the Solar System's is its own sentence.
    description: system.id === SOLAR_SYSTEM_ID ? SOLAR_SYSTEM_DESCRIPTION : hostOf(system.id).description })),
  ...allSatelliteSystems().map(system => {
    const text = texts.satellites[system.hostId]?.text;
    if (!text) throw new TypeError(`src/navigation/system-text.json satellites.${system.hostId}: the ${system.name} has no introduction.`);
    return { hostId: system.hostId, members: 'moons' as const, name: system.name, classification: 'satellite-system', description: text };
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
  const descriptor = { schema: 'cssearth-object@2', id, parent, type: 'system',
    generator: 'site/build/prepare/system-packages.mts',
    properties: {
      system: { host: system.hostId, members: system.members },
      catalog: { name: system.name, systemName: catalog.systemName, classification: system.classification, color: catalog.color, distanceAu: catalog.distanceAu, description: system.description },
      worldFrame: host.properties.worldFrame } };
  await mkdir(resolve(objectsRoot, id), { recursive: true });
  await writeFile(resolve(objectsRoot, id, 'object.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
  written++;
}
console.log(`Wrote ${written} of ${systems.length} system packages (${systems.filter(system => system.members === 'planets').length} planetary, ${systems.filter(system => system.members === 'moons').length} satellite).`);

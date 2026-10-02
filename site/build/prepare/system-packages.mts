/**
 * A system is an object: a host with the bodies that orbit it has a package, an address and a page of its own
 * (`src/objects/<host>-system/object.json`; the Sun's is `solar-system`). This writes each one from what the repository
 * already holds: a star's planetary system from the prepared world's orbit graph (site/object-systems.mts), a planet's or
 * small body's satellite system from its prepared moons (site/satellite-systems.mts) and its cited introduction
 * (src/navigation/system-text.json). A system places nothing and draws nothing of its own: it shows its host's scene out
 * to its members, and takes its host's place, color and distance.
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
const descriptorOf = async (id: string) => JSON.parse(await readFile(resolve(objectsRoot, id, 'object.json'), 'utf8')) as { properties: { catalog: Record<string, unknown>; worldFrame: unknown } };
const texts = JSON.parse(await readFile(resolve(objectsRoot, '../navigation/system-text.json'), 'utf8')) as { satellites: Record<string, { text: string }> };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const systems = [
  ...allPlanetarySystems(bodies).filter(system => system.memberIds.length > 0).map(system => {
    const members = system.memberIds.map(id => bodies.find(object => object.id === id)).filter(member => member !== undefined);
    const planets = members.filter(member => member.classification === 'planet' || member.classification === 'exoplanet').length;
    const host = hostOf(system.id);
    return { hostId: system.id, members: 'planets' as const, name: system.name, classification: 'planetary-system',
      // Counted from the packages this repository holds, not a census of the system.
      description: system.id === SOLAR_SYSTEM_ID ? `The Sun and the ${plural(members.length, 'body', 'bodies')} of its system in this atlas, ${plural(planets, 'planet', 'planets')} among them.`
        : `${host.name} and the ${plural(members.length, 'body', 'bodies')} of its system in this atlas${planets && planets !== members.length ? `, ${plural(planets, 'planet', 'planets')} among them` : ''}.` };
  }),
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
  const descriptor = { schema: 'cssearth-object@2', id, type: 'system',
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

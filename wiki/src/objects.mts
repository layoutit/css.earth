import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/** Reads the checked-in object packages. The wiki prepares nothing and copies no facts out of them. */
export const REPOSITORY = resolve(import.meta.dirname, '../..');
export const OBJECTS_DIRECTORY = resolve(REPOSITORY, 'src/objects');
export const REPOSITORY_URL = 'https://github.com/layoutit/css.earth';

/** Sidebar order only. Labels are the descriptors' own classification values; packages without a catalog entry are context objects. */
const ORDER = ['star', 'planet', 'dwarf-planet', 'satellite', 'trans-neptunian', 'comet', 'asteroid', 'interstellar', 'exoplanet', 'context'];
const classificationLabel = (classification: string) => classification === 'context' ? 'Context objects' :
  classification[0].toLocaleUpperCase('en') + classification.slice(1).replaceAll('-', ' ');
const DISTANCE_ORDERED = new Set(['star', 'planet', 'dwarf-planet']);

export interface ObjectRecord {
  id: string; title: string; group: string; groupLabel: string; system: string | null; distanceAu: number | null;
  catalogued: boolean; readmePath: string; readme: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const text = (value: unknown): string | null => typeof value === 'string' && value.trim().length > 0 ? value : null;
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`${relative(REPOSITORY, path)} is not valid JSON`, { cause: error }); }
}

/** Every package with both a descriptor and a README, in sidebar order. */
export function readObjects(): ObjectRecord[] {
  const objects: ObjectRecord[] = [];
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(OBJECTS_DIRECTORY, entry.name), readmePath = resolve(directory, 'README.md');
    const descriptor = readJson(resolve(directory, 'object.json'));
    if (!isRecord(descriptor) || !existsSync(readmePath)) continue;
    if (descriptor.id !== entry.name) throw new Error(`src/objects/${entry.name}/object.json names a different id.`);
    const readme = readFileSync(readmePath, 'utf8');
    const catalog = isRecord(descriptor.properties) && isRecord(descriptor.properties.catalog) ? descriptor.properties.catalog : null;
    const group = text(catalog?.classification) ?? 'context';
    objects.push({
      id: entry.name, readmePath, readme, catalogued: catalog !== null, group,
      title: text(catalog?.name) ?? /^#\s+(.+)$/mu.exec(readme)?.[1]?.trim() ?? entry.name,
      groupLabel: classificationLabel(group),
      system: text(catalog?.systemName), distanceAu: typeof catalog?.distanceAu === 'number' ? catalog.distanceAu : null,
    });
  }
  return objects.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (DISTANCE_ORDERED.has(a.group) ?
    (a.distanceAu ?? Infinity) - (b.distanceAu ?? Infinity) : a.title.localeCompare(b.title, 'en', { numeric: true })));
}

function groupIndex(group: string) {
  const index = ORDER.indexOf(group);
  return index === -1 ? ORDER.length - 1.5 : index;
}

/** Objects grouped for the sidebar and the main page, keeping readObjects order. */
export function groupObjects(objects: readonly ObjectRecord[]) {
  const groups = new Map<string, { label: string; objects: ObjectRecord[] }>();
  for (const object of objects) {
    const group = groups.get(object.group) ?? { label: object.groupLabel, objects: [] };
    group.objects.push(object);
    groups.set(object.group, group);
  }
  return [...groups.values()];
}

/** Each object's orbit centre, from the prepared world context. The wiki derives nothing; it reads what preparation wrote. */
function orbitParents(): Map<string, string> {
  const context = readJson(resolve(OBJECTS_DIRECTORY, 'sun/prepared/world-context.json'));
  if (!isRecord(context)) throw new Error('src/objects/sun/prepared/world-context.json is missing. Run pnpm prepare:world-context.');
  const parents = new Map<string, string>();
  for (const body of list(context.bodies).filter(isRecord)) {
    const id = text(body.id), center = isRecord(body.orbit) ? text(body.orbit.centerBodyId) : null;
    if (id && center) parents.set(id, center);
  }
  if (!parents.size) throw new Error('The prepared world context lists no orbits.');
  return parents;
}

/** One object and the satellites that orbit it. */
export interface SystemEntry { object: ObjectRecord; satellites: SystemEntry[] }
/** One star's system: the star itself, then its members grouped by classification. */
export interface SystemGroup { id: string; label: string; star: ObjectRecord | null; groups: { label: string; entries: SystemEntry[] }[] }

/** Objects nested by planetary system: the star, its bodies by classification, and each body's satellites under it. */
export function systemGroups(objects: readonly ObjectRecord[]): SystemGroup[] {
  const parents = orbitParents(), byId = new Map(objects.map(object => [object.id, object]));
  const rootOf = (id: string) => {
    const seen = new Set<string>();
    for (let current = id; ; current = parents.get(current)!) {
      if (seen.has(current)) throw new TypeError(`${id} has a cyclic orbit chain.`);
      seen.add(current);
      if (!parents.has(current)) return current;
    }
  };
  const entries = new Map(objects.map(object => [object.id, { object, satellites: [] as SystemEntry[] }]));
  const hosted = new Set<string>();
  // A satellite hangs under the object it orbits; every other object hangs under the star its orbit chain reaches.
  for (const object of objects) {
    const parent = parents.get(object.id);
    if (object.group !== 'satellite' || parent === undefined) continue;
    const host = entries.get(parent);
    if (!host) continue;
    host.satellites.push(entries.get(object.id)!);
    hosted.add(object.id);
  }
  const systems = new Map<string, SystemGroup>();
  const outside: ObjectRecord[] = [];
  for (const object of objects) {
    if (hosted.has(object.id)) continue;
    const root = parents.has(object.id) ? rootOf(object.id) : object.id;
    const star = byId.get(root);
    if (!star || star.group !== 'star' || (root === object.id && !objects.some(member => member.id !== root && parents.has(member.id) && rootOf(member.id) === root))) {
      outside.push(object);
      continue;
    }
    const system = systems.get(root) ?? { id: root, label: star.system ?? star.title, star: null, groups: [] };
    systems.set(root, system);
    if (object.id === root) system.star = object;
    else system.groups.push({ label: object.groupLabel, entries: [entries.get(object.id)!] });
  }
  // Merge each system's per-object rows into one group per classification, keeping readObjects order.
  for (const system of systems.values()) {
    const groups = new Map<string, { label: string; entries: SystemEntry[] }>();
    for (const group of system.groups) {
      const merged = groups.get(group.label) ?? { label: group.label, entries: [] };
      merged.entries.push(...group.entries);
      groups.set(group.label, merged);
    }
    system.groups = [...groups.values()];
  }
  const rest = groupObjects(outside).map(group => ({ label: group.label, entries: group.objects.map(object => entries.get(object.id)!) }));
  return [...systems.values(), ...(rest.length ? [{ id: 'outside', label: 'Outside the systems', star: null, groups: rest }] : [])];
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

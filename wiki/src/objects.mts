import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/** Reads the checked-in object packages. The wiki prepares nothing and copies no facts out of them. */
export const REPOSITORY = resolve(import.meta.dirname, '../..');
export const OBJECTS_DIRECTORY = resolve(REPOSITORY, 'src/objects');
export const REPOSITORY_URL = 'https://github.com/layoutit/css.earth';

/** Reading order of the sidebar. A classification the list does not name lands before the wider universe. */
const GROUPS: readonly { key: string; label: string }[] = [
  { key: 'star', label: 'The Sun and stars' }, { key: 'planet', label: 'Planets' }, { key: 'dwarf-planet', label: 'Dwarf planets' },
  { key: 'satellite', label: 'Moons' }, { key: 'trans-neptunian', label: 'Beyond Neptune' }, { key: 'comet', label: 'Comets' },
  { key: 'asteroid', label: 'Asteroids' }, { key: 'interstellar', label: 'Interstellar visitors' }, { key: 'exoplanet', label: 'Exoplanets' },
  { key: 'universe', label: 'Galaxies, nebulae and beyond' },
];
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
    const group = text(catalog?.classification) ?? 'universe';
    objects.push({
      id: entry.name, readmePath, readme, catalogued: catalog !== null, group,
      title: text(catalog?.name) ?? /^#\s+(.+)$/mu.exec(readme)?.[1]?.trim() ?? entry.name,
      groupLabel: GROUPS.find(candidate => candidate.key === group)?.label ?? group,
      system: text(catalog?.systemName), distanceAu: typeof catalog?.distanceAu === 'number' ? catalog.distanceAu : null,
    });
  }
  return objects.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (DISTANCE_ORDERED.has(a.group) ?
    (a.distanceAu ?? Infinity) - (b.distanceAu ?? Infinity) : a.title.localeCompare(b.title, 'en', { numeric: true })));
}

function groupIndex(group: string) {
  const index = GROUPS.findIndex(candidate => candidate.key === group);
  return index === -1 ? GROUPS.length - 1.5 : index;
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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

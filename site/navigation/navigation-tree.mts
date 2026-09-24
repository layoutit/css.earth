import { orbitRoot } from '../../src/platform/orbit-root.mts';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { appNavigationDestination } from './navigation-destination.mts';
import { projectRoot } from '../../tools/cli/project-root.mts';

/** Reads checked-in packages and prepared context for application navigation. */
export const REPOSITORY = projectRoot(import.meta.url);
const OBJECTS_DIRECTORY = resolve(REPOSITORY, 'src/objects');

/** Sidebar order only. Labels are the descriptors' own classification values, or the prepared catalogue each package belongs to. */
const ORDER = ['star', 'planet', 'dwarf-planet', 'satellite', 'trans-neptunian', 'comet', 'asteroid', 'interstellar', 'exoplanet', 'nebula', 'galaxy', 'galaxy-cluster', 'heliosphere'];
/** Top-level groups read as the app's own plurals. */
const GROUP_LABELS: Record<string, string> = { star: 'Stars', nebula: 'Nebulae', galaxy: 'Galaxies', 'galaxy-cluster': 'Galaxy clusters' };

/** The scene packages the app groups by hand: its own extragalactic sections, its star field and the Sun's heliopause. */
const SCENE_CLASSIFICATIONS: Record<string, string> = {
  // site/components/ExtragalacticOverviews.astro lists the Milky Way with the Local Group under Galaxies,
  // and the nearby-universe cluster catalogue under Galaxy clusters.
  'milky-way': 'galaxy', 'local-group': 'galaxy', 'nearby-universe': 'galaxy-cluster', 'galaxy-clusters': 'galaxy-cluster',
  'stellar-neighbourhood': 'star', heliosphere: 'heliosphere',
};
const classificationLabel = (classification: string) => classification[0].toLocaleUpperCase('en') + classification.slice(1).replaceAll('-', ' ');

/** The Local Group catalogue names the packages it details; each nebula package carries its own classified record.
 * The same rows say which catalogue subject a package details, which is how the application reaches a package
 * that owns no scene of its own: the subject's id, not the package's, names the focus. */
function catalogueSubjects(): { classifications: Map<string, string>; focusIds: Map<string, string> } {
  const classifications = new Map<string, string>(Object.entries(SCENE_CLASSIFICATIONS));
  const focusIds = new Map<string, string>();
  // Every catalogue row that details a package names the subject the application focuses;
  // only some of them also decide the package's classification.
  const detail = (object: Record<string, unknown>, classification: string | null) => {
    const id = text(object.detailedObjectId), subject = text(object.id);
    if (!id) return;
    if (classification) classifications.set(id, classification);
    if (subject) focusIds.set(id, subject);
  };
  const galaxies = readJson(resolve(OBJECTS_DIRECTORY, 'local-group/prepared/catalogue.json'));
  for (const object of list(isRecord(galaxies) ? galaxies.objects : null).filter(isRecord)) detail(object, 'galaxy');
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nebulae = readJson(resolve(OBJECTS_DIRECTORY, entry.name, 'source/nebula.json'));
    if (!isRecord(nebulae) || nebulae.schema !== 'cssearth-nebula-catalog@1') continue;
    for (const object of list(nebulae.objects).filter(isRecord)) detail(object, object.kind === 'nebula' ? 'nebula' : null);
  }
  return { classifications, focusIds };
}
const DISTANCE_ORDERED = new Set(['star', 'planet', 'dwarf-planet']);

interface ObjectRecord {
  id: string; title: string; group: string; groupLabel: string; system: string | null; distanceAu: number | null;
  /** The catalogue subject this package details, when a catalogue names one. */
  focusId: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === 'string' && value.trim().length > 0 ? value : null;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`${relative(REPOSITORY, path)} is not valid JSON`, { cause: error }); }
}

/** Every package with both a descriptor and a README, in sidebar order. */
export function readObjects(): ObjectRecord[] {
  const objects: ObjectRecord[] = [], { classifications: catalogued, focusIds } = catalogueSubjects();
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(OBJECTS_DIRECTORY, entry.name), readmePath = resolve(directory, 'README.md');
    const descriptor = readJson(resolve(directory, 'object.json'));
    if (!isRecord(descriptor) || !existsSync(readmePath)) continue;
    if (descriptor.id !== entry.name) throw new Error(`src/objects/${entry.name}/object.json names a different id.`);
    const readme = readFileSync(readmePath, 'utf8');
    const catalog = isRecord(descriptor.properties) && isRecord(descriptor.properties.catalog) ? descriptor.properties.catalog : null;
    const group = text(catalog?.classification) ?? catalogued.get(entry.name) ?? 'context';
    objects.push({
      id: entry.name, group,
      focusId: focusIds.get(entry.name) ?? null,
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

/** Group packages while preserving navigation order. */
function groupObjects(objects: readonly ObjectRecord[]) {
  const groups = new Map<string, { label: string; objects: ObjectRecord[] }>();
  for (const object of objects) {
    const group = groups.get(object.group) ?? { label: object.groupLabel, objects: [] };
    group.objects.push(object);
    groups.set(object.group, group);
  }
  return [...groups.values()];
}

/** Read the orbits and colours already written by world-context preparation. */
function worldContext() {
  const context = readJson(resolve(OBJECTS_DIRECTORY, 'sun/prepared/world-context.json'));
  if (!isRecord(context)) throw new Error('src/objects/sun/prepared/world-context.json is missing. Run pnpm prepare:world-context.');
  const focus = isRecord(context.focus) ? text(context.focus.id) : null;
  if (!focus) throw new Error('The prepared world context names no focus object.');
  const parents = new Map<string, string>(), colors = new Map<string, string>();
  for (const body of [...list(context.bodies), context.focus].filter(isRecord)) {
    const id = text(body.id);
    if (!id) continue;
    const center = isRecord(body.orbit) ? text(body.orbit.centerBodyId) : null;
    if (center) parents.set(id, center);
    const color = text(body.color);
    if (color) colors.set(id, color);
  }
  if (!parents.size) throw new Error('The prepared world context lists no orbits.');
  return { parents, colors, focus };
}

/** Each object's prepared marker colour, for the shell's navigation markers. */
export const objectColors = (): ReadonlyMap<string, string> => worldContext().colors;

// Prepared helper surfaces can have their own documentation without becoming
// destinations in application navigation. Each one is a prepared
// volume or surface that belongs to a body already in the tree: the Sun's
// heliopause and coronal density, Betelgeuse's circumstellar shells, the
// HD 181327 debris ring and the PDS 70 dust ring.
const NAVIGATION_HIDDEN = new Set(['heliosphere', 'sun-cor1-density', 'betelgeuse-shell', 'hd-181327-disc', 'pds-70-disc']);

/** One object and the satellites that orbit it. */
interface SystemEntry { object: ObjectRecord; satellites: SystemEntry[] }
/** One star's system: the star itself, then its members grouped by classification. */
interface SystemGroup { id: string; label: string; star: SystemEntry | null; groups: { label: string; entries: SystemEntry[] }[] }

/** Objects nested by planetary system: the star, its bodies by classification, and each body's satellites under it. */
function systemGroups(objects: readonly ObjectRecord[]): SystemGroup[] {
  const { parents } = worldContext(), byId = new Map(objects.map(object => [object.id, object]));
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
    const root = parents.has(object.id) ? orbitRoot(object.id, parents) : object.id;
    const star = byId.get(root);
    if (!star || star.group !== 'star' || (root === object.id && !objects.some(member => member.id !== root && parents.has(member.id) && orbitRoot(member.id, parents) === root))) {
      outside.push(object);
      continue;
    }
    const system = systems.get(root) ?? { id: root, label: star.system ?? star.title, star: null, groups: [] };
    systems.set(root, system);
    if (object.id === root) system.star = entries.get(object.id)!;
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
  // Objects that belong to no planetary system keep their own classification as a top-level group.
  const rest = groupObjects(outside).map(group => {
    const id = group.objects[0]!.group;
    return { id, label: GROUP_LABELS[id] ?? group.label, star: null,
      groups: [{ label: group.label, entries: group.objects.map(object => entries.get(object.id)!) }] };
  });
  return [...systems.values(), ...rest];
}

/** The places' names as the app's breadcrumb gives them (site/components/ObjectBreadcrumbs.astro). */
const PLACE_LABELS: Record<string, string> = {
  'nearby-universe': 'Nearby Universe', 'local-group': 'Local Group', 'milky-way': 'Milky Way',
  'galaxy-clusters': 'Galaxy clusters', 'stellar-neighbourhood': 'Stellar neighbourhood',
};

/** A place or group with the application destination it opens; null destinations remain labels. */
export interface TreeNode { key: string; label: string; object: ObjectRecord | null; children: TreeNode[]; href: string | null; focusId: string | null }

/** Where things are, read from here outward: Solar System, Stars, Milky Way, Local Group, Beyond. */
export function navigationTree(objects: readonly ObjectRecord[]): TreeNode[] {
  const visibleObjects = objects.filter(object => !NAVIGATION_HIDDEN.has(object.id));
  const node = (key: string, label: string, object: ObjectRecord | null, children: TreeNode[]): TreeNode => {
    const opens = object ? appNavigationDestination(object.id, object.focusId) : null;
    return { key, label, object, children, href: opens?.href ?? null, focusId: opens?.focusId ?? null };
  };
  const systems = systemGroups(visibleObjects), byId = new Map(visibleObjects.map(object => [object.id, object]));
  // The home system is the one the prepared world context focuses on, so no object id is written here.
  const { focus: homeSystem } = worldContext();
  const placed = new Set<string>();
  const body = (entry: SystemEntry): TreeNode => {
    placed.add(entry.object.id);
    return node(entry.object.id, entry.object.title, entry.object, entry.satellites.map(body));
  };
  const place = (id: string): TreeNode[] => {
    const object = byId.get(id);
    if (!object) return [];
    placed.add(id);
    return [node(id, PLACE_LABELS[id] ?? object.title, object, [])];
  };
  const group = (key: string, label: string, children: TreeNode[]): TreeNode[] => children.length ? [node(key, label, null, children)] : [];
  const entriesOf = (groupId: string) => systems.find(system => system.id === groupId)?.groups.flatMap(item => item.entries) ?? [];
  const loneStars = entriesOf('star').filter(entry => entry.object.id !== 'stellar-neighbourhood');
  const members = (item: SystemGroup): TreeNode[] => {
    const companions = loneStars.filter(entry => entry.object.system === item.label);
    return [...(item.star ? [body(item.star)] : []), ...companions.map(body), ...item.groups.flatMap(member => member.entries.map(body))];
  };
  const solar = systems.find(item => item.id === homeSystem);
  const solarSystem = solar ? group('solar-system', solar.label, [
    ...(solar.star ? [body(solar.star)] : []),
    ...solar.groups.flatMap(member => group(`sun:${member.label}`, member.label, member.entries.map(body))),
  ]) : [];
  const starSystems = systems.filter(item => item.star && item.id !== homeSystem).flatMap(item => group(`system:${item.id}`, item.label, members(item)));
  const stars = group('stars', 'Stars', [...starSystems, ...loneStars.filter(entry => !placed.has(entry.object.id)).map(body)]);
  const milkyWay = group('milky-way-section', 'Milky Way', [...place('milky-way'), ...place('stellar-neighbourhood'), ...entriesOf('nebula').map(body), ...place('lmc'), ...place('smc')]);
  const localGroup = group('local-group-section', 'Local Group', [...place('local-group'), ...place('m31'), ...place('m33')]);
  const beyond = group('beyond', 'Beyond', [...place('nearby-universe'), ...place('galaxy-clusters')]);
  const rest = visibleObjects.filter(object => !placed.has(object.id)).map(object => node(object.id, object.title, object, []));
  return [...solarSystem, ...stars, ...milkyWay, ...localGroup, ...beyond, ...group('other', 'Other', rest)];
}

/** How many objects a node holds, itself included. */
export const treeCount = (node: TreeNode): number => (node.object ? 1 : 0) + node.children.reduce((total, child) => total + treeCount(child), 0);

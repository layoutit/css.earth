import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { projectRoot } from '../../tools/cli/project-root.mts';

/** Package labels and catalogue-subject bindings used by navigation preparation. */
const REPOSITORY = projectRoot(import.meta.url);
const OBJECTS_DIRECTORY = resolve(REPOSITORY, 'src/objects');

/** Sidebar order only. Labels are the descriptors' own classification values, or the prepared catalogue each package belongs to. */
const ORDER = ['star', 'planet', 'dwarf-planet', 'satellite', 'trans-neptunian', 'comet', 'asteroid', 'interstellar', 'exoplanet', 'nebula', 'galaxy', 'galaxy-cluster', 'heliosphere'];
/** The scene packages the app groups by hand: its own extragalactic sections, its star field and the Sun's heliopause. */
const SCENE_CLASSIFICATIONS: Record<string, string> = {
  // site/components/ExtragalacticOverviews.astro lists the Milky Way with the Local Group under Galaxies,
  // and the nearby-universe cluster catalogue under Galaxy clusters.
  'milky-way': 'galaxy', 'local-group': 'galaxy', 'nearby-universe': 'galaxy-cluster', 'galaxy-clusters': 'galaxy-cluster',
  'stellar-neighbourhood': 'star', heliosphere: 'heliosphere',
};
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

export interface NavigationPackage {
  id: string; title: string; group: string; system: string | null; distanceAu: number | null;
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
export function readNavigationPackages(): NavigationPackage[] {
  const objects: NavigationPackage[] = [], { classifications: catalogued, focusIds } = catalogueSubjects();
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(OBJECTS_DIRECTORY, entry.name), readmePath = resolve(directory, 'README.md');
    const descriptor = readJson(resolve(directory, 'object.json'));
    if (!isRecord(descriptor) || !existsSync(readmePath)) continue;
    if (descriptor.id !== entry.name) throw new Error(`src/objects/${entry.name}/object.json names a different id.`);
    const catalog = isRecord(descriptor.properties) && isRecord(descriptor.properties.catalog) ? descriptor.properties.catalog : null;
    const group = text(catalog?.classification) ?? catalogued.get(entry.name) ?? 'context';
    objects.push({
      id: entry.name, group,
      focusId: focusIds.get(entry.name) ?? null,
      title: text(catalog?.name) ?? /^#\s+(.+)$/mu.exec(readFileSync(readmePath, 'utf8'))?.[1]?.trim() ?? entry.name,
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

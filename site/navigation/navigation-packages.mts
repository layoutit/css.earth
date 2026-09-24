import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';

/** Package labels and catalogue-subject bindings used by navigation preparation. */
const REPOSITORY = projectRoot(import.meta.url);
const OBJECTS_DIRECTORY = resolve(REPOSITORY, 'src/objects');

/** Sidebar order only. Labels are the descriptors' own classification values, or the prepared catalogue each package belongs to. */
const ORDER = ['star', 'planet', 'dwarf-planet', 'satellite', 'trans-neptunian', 'comet', 'asteroid', 'interstellar', 'exoplanet', 'black-hole', 'nebula', 'globular-cluster', 'galaxy', 'galaxy-cluster', 'heliosphere'];
/** The scene packages the app groups by hand: its own extragalactic sections, its star field and the Sun's heliopause. */
const SCENE_CLASSIFICATIONS: Record<string, string> = {
  // site/components/ExtragalacticOverviews.astro lists the Milky Way with the Local Group under Galaxies,
  // and the nearby-universe cluster catalogue under Galaxy clusters.
  'milky-way': 'galaxy', 'local-group': 'galaxy', 'nearby-universe': 'galaxy-cluster', 'galaxy-clusters': 'galaxy-cluster',
  'stellar-neighbourhood': 'star', heliosphere: 'heliosphere',
};
/** The Local Group catalogue names the packages it details; each nebula package carries its own classified record.
 * The same rows say which catalogue subject a package details, which is how the application reaches a package
 * that owns no scene of its own: the subject's id, not the package's, names the focus. They also say where the
 * subject is: a galaxy's catalogue membership, and every nebula catalogue row, which lies in the Milky Way. */
function catalogueSubjects(): { classifications: Map<string, string>; focusIds: Map<string, string>; sections: Map<string, NavigationSection> } {
  const classifications = new Map<string, string>(Object.entries(SCENE_CLASSIFICATIONS));
  const focusIds = new Map<string, string>(), sections = new Map<string, NavigationSection>();
  const detail = (object: Record<string, unknown>, classification: string, section: NavigationSection | null) => {
    const id = text(object.detailedObjectId), subject = text(object.id);
    if (!id) return;
    classifications.set(id, classification);
    if (subject) focusIds.set(id, subject);
    if (section) sections.set(id, section);
  };
  const galaxies = readJson(resolve(OBJECTS_DIRECTORY, 'local-group/prepared/catalogue.json'));
  for (const object of list(isRecord(galaxies) ? galaxies.objects : null).filter(isRecord)) {
    const membership = isRecord(object.membership) ? object.membership : {};
    detail(object, 'galaxy', membership.subgroup === 'milky-way' ? 'milky-way' : membership.group === 'local-group' ? 'local-group' : null);
  }
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nebulae = readJson(resolve(OBJECTS_DIRECTORY, entry.name, 'source/nebula.json'));
    if (!isRecord(nebulae) || nebulae.schema !== 'cssearth-nebula-catalog@1') continue;
    for (const object of list(nebulae.objects).filter(isRecord)) {
      const kind = text(object.kind);
      if (!kind) throw new Error(`src/objects/${entry.name}/source/nebula.json: row ${String(object.id)} has no kind.`);
      detail(object, kind, 'milky-way');
    }
  }
  return { classifications, focusIds, sections };
}

/** Volumes a body presents through one of its own lenses: the volume opens as that body on that lens.
 * The body's default lens is chosen when it shows the volume, otherwise its first lens that does. */
function attachedVolumes(): Map<string, { hostId: string; lensId: string }> {
  const attached = new Map<string, { hostId: string; lensId: string }>();
  for (const entry of readdirSync(OBJECTS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const content = readJson(resolve(OBJECTS_DIRECTORY, entry.name, 'source/content/object.json'));
    const lenses = isRecord(content) && isRecord(content.lenses) ? content.lenses : null;
    if (!lenses) continue;
    const controls = list(lenses.controls).filter(isRecord);
    const volumes = new Map<string, string[]>();
    for (const control of controls) {
      const volume = isRecord(control.volume) ? text(control.volume.objectId) : null, id = text(control.id);
      if (volume && id && volume !== entry.name) volumes.set(volume, [...volumes.get(volume) ?? [], id]);
    }
    for (const [volume, lensIds] of volumes) {
      const previous = attached.get(volume);
      if (previous) throw new Error(`src/objects/${volume} is a lens of both ${previous.hostId} and ${entry.name}.`);
      attached.set(volume, { hostId: entry.name, lensId: lensIds.includes(text(lenses.defaultLens) ?? '') ? text(lenses.defaultLens)! : lensIds[0]! });
    }
  }
  return attached;
}
const DISTANCE_ORDERED = new Set(['star', 'planet', 'dwarf-planet']);

/** The application's own sections a catalogued subject belongs in. */
export type NavigationSection = 'milky-way' | 'local-group';

export interface NavigationPackage {
  id: string; title: string; group: string; system: string | null; distanceAu: number | null;
  /** The catalogue subject this package details, when a catalogue names one. */
  focusId: string | null;
  /** Where its catalogue places the subject, when a catalogue does. */
  section: NavigationSection | null;
  /** The body whose lens presents this volume, and that lens. */
  attachedTo: { hostId: string; lensId: string } | null;
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
  const objects: NavigationPackage[] = [], { classifications: catalogued, focusIds, sections } = catalogueSubjects(), attached = attachedVolumes();
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
      focusId: focusIds.get(entry.name) ?? null, section: sections.get(entry.name) ?? null, attachedTo: attached.get(entry.name) ?? null,
      title: text(catalog?.name) ?? /^#\s+(.+)$/mu.exec(readFileSync(readmePath, 'utf8'))?.[1]?.trim() ?? entry.name,
      system: text(catalog?.systemName), distanceAu: typeof catalog?.distanceAu === 'number' ? catalog.distanceAu : null,
    });
  }
  // Distance orders stars and planets; bodies at the same distance, such as the members of one system, by name.
  return objects.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || (DISTANCE_ORDERED.has(a.group) ?
    (a.distanceAu ?? Infinity) - (b.distanceAu ?? Infinity) : 0) || a.title.localeCompare(b.title, 'en', { numeric: true }));
}

function groupIndex(group: string) {
  const index = ORDER.indexOf(group);
  return index === -1 ? ORDER.length - 1.5 : index;
}

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { record } from '../browser-types.mts';
import { discoveryVisibility, isDiscoveryAnchor } from '../object-discovery.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../prepared-navigation-markers.mjs';
import { sidebarThumbnail } from '../sidebar-thumbnails.mts';

/** A development-only census of src/objects. It reads the checked-in packages as they are; it prepares nothing. */
const root = resolve(import.meta.dirname, '../..');
const objectsDirectory = resolve(root, 'src/objects');
export const REPOSITORY_BLOB = 'https://github.com/layoutit/css.earth/blob/main';

/** Reading order of the gallery. A classification the list does not name lands before the deep-sky views. */
const GROUPS: readonly { key: string; label: string }[] = [
  { key: 'star', label: 'The Sun and stars' }, { key: 'planet', label: 'Planets' }, { key: 'dwarf-planet', label: 'Dwarf planets' },
  { key: 'satellite', label: 'Moons' }, { key: 'trans-neptunian', label: 'Beyond Neptune' }, { key: 'comet', label: 'Comets' },
  { key: 'asteroid', label: 'Asteroids' }, { key: 'interstellar', label: 'Interstellar visitors' }, { key: 'exoplanet', label: 'Exoplanets' },
  { key: 'context', label: 'Galaxies, nebulae and the wider universe' },
];
const DISTANCE_ORDERED = new Set(['star', 'planet', 'dwarf-planet']);

export type ObjectStatus = 'imaged' | 'shape' | 'illustration' | 'view';
export const STATUS_LABELS: Record<ObjectStatus, string> = { imaged: 'Imaged', shape: 'Shape only', illustration: 'Illustration', view: 'Sky view' };
export const LEDGER_GROUPS = [
  { status: 'unresolved', label: 'Open questions' },
  { status: 'deferred', label: 'Parked for later' },
  { status: 'included', label: 'What we used' },
  { status: 'excluded', label: 'What we ruled out' },
] as const;

export interface InventorySummary {
  id: string; name: string; group: string; kind: string; image: string | null; color: string;
  status: ObjectStatus; hiddenFromMap: boolean; openQuestions: number; mapCount: number; problems: string[]; distanceMeters: number;
}
export interface InventoryDetail extends InventorySummary {
  systemName: string; facts: { label: string; value: string }[]; introduction: string | null; card: string | null; route: string | null; type: string; provenance: string | null;
  maps: { id: string; label: string; url: string; falseColor: boolean }[];
  ledger: { status: string; subject: string; finding: string; revisitWhen: string | null; checked: string | null; evidence: string[] }[];
  credits: { credit: string; files: number; bytes: number; machines: string[] }[];
  runtimeAssets: number; runtimeBytes: number;
}

const text = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function readJson(path: string, problems: string[]): unknown {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { problems.push(`${path.slice(objectsDirectory.length + 1)} does not parse: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

/** Bodies hidden even with every setting on: today, stars known only by their shape. */
function alwaysHidden() {
  return new Set(discoveryVisibility(SCENE_OBJECTS, { illustrations: true, asteroids: true, asteroidLabels: true }).hiddenBodies);
}

/** The rendered picture the app already prepared for the object, if any. */
function objectImage(id: string): string | null {
  const marker: unknown = Object.getOwnPropertyDescriptor(PREPARED_NAVIGATION_MARKERS, id)?.value;
  const context = record(marker) && record(marker.context) ? text(marker.context.url) : null;
  return context ?? sidebarThumbnail(id)?.url2x ?? null;
}

function readPackage(id: string, hidden: Set<string>): InventoryDetail | null {
  const directory = resolve(objectsDirectory, id), problems: string[] = [];
  const descriptor = readJson(resolve(directory, 'object.json'), problems);
  if (!record(descriptor)) return null;
  const properties = record(descriptor.properties) ? descriptor.properties : {};
  const catalog = record(properties.catalog) ? properties.catalog : null;
  const registered = SCENE_OBJECTS.find(object => object.id === id);
  if (catalog && !registered) problems.push('Not in the app registry yet. Run pnpm prepare:catalog.');

  const ledgerJson = readJson(resolve(directory, 'investigations.json'), problems);
  if (!record(ledgerJson)) problems.push('No investigations.json.');
  const ledger = list(record(ledgerJson) ? ledgerJson.entries : null).filter(record).map(entry => ({
    status: text(entry.status) ?? 'unknown', subject: text(entry.subject) ?? text(entry.id) ?? '', finding: text(entry.finding) ?? '',
    revisitWhen: text(entry.revisitWhen), evidence: list(entry.evidence).filter((item): item is string => typeof item === 'string'),
    checked: list(entry.checked).filter(record).map(check => text(check.date)).filter(date => date !== null).sort().at(-1) ?? null,
  }));
  for (const entry of ledger) if (!LEDGER_GROUPS.some(group => group.status === entry.status)) problems.push(`Investigation "${entry.subject}" has status ${entry.status}.`);

  const lensJson = readJson(resolve(directory, 'prepared/lenses.json'), problems);
  const lenses = list(record(lensJson) ? lensJson.controls : null).filter(record);
  const minimapJson = readJson(resolve(directory, 'prepared/minimaps.json'), problems);
  const maps = list(record(minimapJson) ? minimapJson.images : null).filter(record).flatMap(image => {
    const lensId = text(image.id), path = text(image.path);
    if (!lensId || !path) return [];
    const lens = lenses.find(candidate => candidate.id === lensId);
    return [{ id: lensId, label: text(lens?.label) ?? lensId, url: `/@fs${resolve(directory, 'prepared', path)}`, falseColor: lens?.falseColor === true }];
  });

  const manifest = readJson(resolve(directory, 'source/manifest.json'), problems);
  const credits = new Map<string, { credit: string; files: number; bytes: number; machines: Set<string> }>();
  for (const input of list(record(manifest) ? manifest.inputs : null).filter(record)) {
    const credit = text(input.credit) ?? 'No credit recorded';
    const entry = credits.get(credit) ?? { credit, files: 0, bytes: 0, machines: new Set<string>() };
    entry.files += 1;
    entry.bytes += count(input.expectedBytes);
    for (const item of record(input.capture) ? list(input.capture.attributions).filter(record) : []) {
      const machine = text(item.machineId) ?? text(item.missionId);
      if (machine) entry.machines.add(machine);
    }
    credits.set(credit, entry);
  }

  const runtimeJson = readJson(resolve(directory, 'runtime-assets.json'), problems);
  const runtimeAssets = list(record(runtimeJson) ? runtimeJson.assets : null).filter(record);
  const provenance = readJson(resolve(directory, 'prepared/provenance.json'), problems);
  const textJson = readJson(resolve(directory, 'text.json'), problems);
  const content = readJson(resolve(directory, 'prepared/content.json'), problems);
  const facts = (record(content) ? [...list(content.facts), ...list(content.moreFacts)] : []).filter(record)
    .flatMap(fact => { const label = text(fact.label), value = text(fact.value); return label && value ? [{ label, value }] : []; });

  const discovery = registered?.discovery;
  // The app does not mark anchors (the Sun, planets) by imagery; their prepared maps say whether we have any.
  const anchor = registered !== undefined && isDiscoveryAnchor(registered) && !hidden.has(id);
  const status: ObjectStatus = !catalog ? 'view' : discovery?.illustration ? 'illustration' :
    discovery?.imagery || anchor && maps.length > 0 ? 'imaged' : 'shape';
  const group = text(catalog?.classification) ?? 'context';
  return {
    id, name: text(catalog?.name) ?? id, group, kind: GROUPS.find(candidate => candidate.key === group)?.label ?? group,
    image: objectImage(id), color: text(catalog?.color) ?? '#555', status, hiddenFromMap: hidden.has(id),
    openQuestions: ledger.filter(entry => entry.status === 'unresolved').length, mapCount: maps.length, problems,
    distanceMeters: registered?.distance.meters ?? Number.MAX_VALUE, systemName: text(catalog?.systemName) ?? '', facts,
    introduction: record(textJson) && record(textJson.introduction) ? text(textJson.introduction.text) : null,
    card: record(textJson) && record(textJson.card) ? text(textJson.card.text) : text(catalog?.description),
    route: registered?.route ?? null, type: text(descriptor.type) ?? '?', provenance: record(provenance) ? text(provenance.basis) : null,
    maps, ledger, credits: [...credits.values()].map(entry => ({ ...entry, machines: [...entry.machines] })).sort((a, b) => b.bytes - a.bytes),
    runtimeAssets: runtimeAssets.length, runtimeBytes: runtimeAssets.reduce((sum, asset) => sum + count(asset.bytes), 0),
  };
}

const packageIds = () => readdirSync(objectsDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();

let cache: { stamp: string; groups: { key: string; label: string; objects: InventorySummary[] }[]; folders: string[] } | null = null;

/** Every package summary in gallery order, reread whenever a descriptor, ledger, lens list or text changes on disk. */
export function readInventory() {
  const ids = packageIds();
  const stamp = ids.map(id => ['object.json', 'investigations.json', 'prepared/lenses.json', 'prepared/minimaps.json', 'text.json']
    .map(file => { const path = resolve(objectsDirectory, id, file); return existsSync(path) ? statSync(path).mtimeMs : 0; }).join(',')).join(';');
  if (cache?.stamp === stamp) return cache;
  const hidden = alwaysHidden(), summaries: InventorySummary[] = [], folders: string[] = [];
  for (const id of ids) {
    const detail = readPackage(id, hidden);
    if (!detail) { folders.push(id); continue; }
    const { name, group, kind, image, color, status, hiddenFromMap, openQuestions, mapCount, problems, distanceMeters } = detail;
    summaries.push({ id, name, group, kind, image, color, status, hiddenFromMap, openQuestions, mapCount, problems, distanceMeters });
  }
  const keys = GROUPS.map(group => group.key);
  for (const { group } of summaries) if (!keys.includes(group)) keys.splice(keys.length - 1, 0, group);
  const groups = keys.map(key => ({
    key, label: GROUPS.find(group => group.key === key)?.label ?? key,
    objects: summaries.filter(object => object.group === key).sort((a, b) => DISTANCE_ORDERED.has(key) ?
      a.distanceMeters - b.distanceMeters : a.name.localeCompare(b.name, 'en', { numeric: true })),
  })).filter(group => group.objects.length > 0);
  cache = { stamp, groups, folders };
  return cache;
}

export function readInventoryDetail(id: string): InventoryDetail {
  if (!packageIds().includes(id)) throw new Error(`Unknown object package: ${id}`);
  const detail = readPackage(id, alwaysHidden());
  if (!detail) throw new Error(`Object package has no object.json: ${id}`);
  return detail;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export const plural = (value: number, one: string, many = `${one}s`) => `${value} ${value === 1 ? one : many}`;

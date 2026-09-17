import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { record } from '../browser-types.mts';
import { discoveryDescription, discoveryVisibility, isDiscoveryAnchor } from '../object-discovery.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { objectClassificationLabel } from '../planet-search-objects.mts';

/** A development-only census of src/objects. It reads the checked-in packages as they are; it prepares nothing. */
const root = resolve(import.meta.dirname, '../..');
const objectsDirectory = resolve(root, 'src/objects');
export const REPOSITORY_BLOB = 'https://github.com/layoutit/css.earth/blob/main';

export type InvestigationStatus = 'included' | 'unresolved' | 'excluded' | 'deferred';
export const INVESTIGATION_STATUSES: readonly InvestigationStatus[] = ['included', 'unresolved', 'deferred', 'excluded'];
const isInvestigationStatus = (value: string): value is InvestigationStatus => INVESTIGATION_STATUSES.some(status => status === value);

export interface InventoryLens { id: string; label: string; falseColor: boolean; noData: boolean; thumbnailUrl: string | null; surfaceUrl: string | null; sourceUrl: string | null; }
export interface InventoryInvestigation { id: string; subject: string; status: string; finding: string; revisitWhen: string | null; evidence: string[]; checked: string | null; }
export interface InventorySource { id: string; path: string; origin: string | null; credit: string | null; license: string | null; bytes: number; local: boolean; lensId: string | null; machines: string[]; observedAt: string | null; }
export interface InventorySummary {
  id: string; name: string; type: string; classification: string; classificationLabel: string; systemName: string; description: string;
  color: string; distance: string; route: string | null; order: number;
  discovery: { label: string; anchor: boolean; imagery: boolean; illustration: boolean; featured: boolean; onMap: boolean; labelled: boolean } | null;
  lensCount: number; investigations: Record<InvestigationStatus, number>; sourceCount: number; sourceBytes: number; localSourceCount: number;
  runtimeAssetCount: number; runtimeBytes: number; provenance: string | null; swatch: string | null; problems: string[];
}
export interface InventoryDetail extends InventorySummary {
  card: string | null; introduction: string | null; lenses: InventoryLens[]; ledger: InventoryInvestigation[]; sources: InventorySource[];
  runtimeAssets: { filename: string; bytes: number }[]; swatchBasis: string | null; swatchSourceTitle: string | null; readme: string | null;
}
export interface PackageFolder { id: string; files: string[]; }

const text = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function readJson(path: string, problems: string[]): unknown {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { problems.push(`${path.slice(objectsDirectory.length + 1)}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

function visibility() {
  const hidden = discoveryVisibility(SCENE_OBJECTS, { illustrations: false, asteroids: false, asteroidLabels: false });
  return { bodies: new Set(hidden.hiddenBodies), labels: new Set(hidden.hiddenLabels) };
}

function readPackage(id: string, map: ReturnType<typeof visibility>): InventoryDetail | null {
  const directory = resolve(objectsDirectory, id), problems: string[] = [];
  const descriptor = readJson(resolve(directory, 'object.json'), problems);
  if (!record(descriptor)) return null;
  const properties = record(descriptor.properties) ? descriptor.properties : {};
  const catalog = record(properties.catalog) ? properties.catalog : null;
  const registered = SCENE_OBJECTS.find(object => object.id === id);
  if (catalog && !registered) problems.push('Catalogued package is missing from the scene registry; run pnpm prepare:catalog.');

  const ledgerJson = readJson(resolve(directory, 'investigations.json'), problems);
  if (!record(ledgerJson)) problems.push('No investigations.json ledger.');
  const ledger = list(record(ledgerJson) ? ledgerJson.entries : null).filter(record).map(entry => ({
    id: text(entry.id) ?? '?', subject: text(entry.subject) ?? '', status: text(entry.status) ?? 'unknown', finding: text(entry.finding) ?? '',
    revisitWhen: text(entry.revisitWhen), evidence: list(entry.evidence).filter((item): item is string => typeof item === 'string'),
    checked: list(entry.checked).filter(record).map(check => text(check.date)).filter(date => date !== null).sort().at(-1) ?? null,
  }));
  const investigations: Record<InvestigationStatus, number> = { included: 0, unresolved: 0, deferred: 0, excluded: 0 };
  for (const { id: entryId, status } of ledger) if (isInvestigationStatus(status)) investigations[status] += 1;
  else problems.push(`Investigation ${entryId} has status ${status}.`);

  const lensJson = readJson(resolve(directory, 'prepared/lenses.json'), problems);
  const lenses = list(record(lensJson) ? lensJson.controls : null).filter(record).map(lens => ({
    id: text(lens.id) ?? '?', label: text(lens.label) ?? text(lens.id) ?? '?', falseColor: lens.falseColor === true, noData: lens.noData === true,
    thumbnailUrl: text(lens.thumbnailUrl), surfaceUrl: text(lens.surface2xUrl) ?? text(lens.surfaceUrl),
    sourceUrl: record(lens.source) ? text(lens.source.url) : null,
  }));

  const manifest = readJson(resolve(directory, 'source/manifest.json'), problems);
  const sourceBase = record(manifest) && manifest.pathBase === 'repository' ? root : resolve(directory, 'source');
  const sources = list(record(manifest) ? manifest.inputs : null).filter(record).map(input => {
    const path = text(input.path) ?? '';
    const capture = record(input.capture) ? list(input.capture.attributions).filter(record) : [];
    return { id: text(input.id) ?? path, path, origin: text(input.origin), credit: text(input.credit), license: text(input.license),
      bytes: count(input.expectedBytes), local: path.length > 0 && existsSync(resolve(sourceBase, path)), lensId: text(input.lensId),
      machines: [...new Set(capture.map(item => text(item.machineId) ?? text(item.missionId)).filter(value => value !== null))],
      observedAt: text(input.observedAt) };
  });

  const runtimeJson = readJson(resolve(directory, 'runtime-assets.json'), problems);
  const runtimeAssets = list(record(runtimeJson) ? runtimeJson.assets : null).filter(record)
    .map(asset => ({ filename: text(asset.filename) ?? '?', bytes: count(asset.bytes) }));
  const provenance = readJson(resolve(directory, 'prepared/provenance.json'), problems);
  const swatch = readJson(resolve(directory, 'swatch.json'), problems);
  const textJson = readJson(resolve(directory, 'text.json'), problems);
  const readmePath = resolve(directory, 'README.md');

  // The app never labels an orientation anchor (the Sun, planets) by its imagery; a star kept off the map still is.
  const anchor = registered !== undefined && isDiscoveryAnchor(registered) && !map.bodies.has(id);
  const discovery = registered ? {
    label: anchor ? 'Anchor' : discoveryDescription(registered.discovery) ?? 'Imagery', anchor, imagery: registered.discovery.imagery,
    illustration: registered.discovery.illustration, featured: registered.discovery.featured,
    onMap: !map.bodies.has(id), labelled: !map.labels.has(id),
  } : null;
  const classification = text(catalog?.classification) ?? 'context';
  return {
    id, name: text(catalog?.name) ?? id, type: text(descriptor.type) ?? '?', classification,
    classificationLabel: catalog ? objectClassificationLabel(classification) : 'Context',
    systemName: text(catalog?.systemName) ?? '', description: text(catalog?.description) ?? '', color: text(catalog?.color) ?? '#777',
    distance: registered ? `${Number(registered.distance.value.toFixed(3))} ${registered.distance.unit}` : '',
    route: registered?.route ?? null, order: count(catalog?.order) || Number.MAX_SAFE_INTEGER, discovery,
    lensCount: lenses.length, investigations, sourceCount: sources.length, sourceBytes: sources.reduce((sum, source) => sum + source.bytes, 0),
    localSourceCount: sources.filter(source => source.local).length,
    runtimeAssetCount: runtimeAssets.length, runtimeBytes: runtimeAssets.reduce((sum, asset) => sum + asset.bytes, 0),
    provenance: record(provenance) ? text(provenance.basis) : null, swatch: record(swatch) ? text(swatch.hex) : null, problems,
    card: record(textJson) && record(textJson.card) ? text(textJson.card.text) : null,
    introduction: record(textJson) && record(textJson.introduction) ? text(textJson.introduction.text) : null,
    lenses, ledger, sources, runtimeAssets,
    swatchBasis: record(swatch) ? text(swatch.basis) : null,
    swatchSourceTitle: record(swatch) && record(swatch.source) ? text(swatch.source.title) : null,
    readme: existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null,
  };
}

const packageIds = () => readdirSync(objectsDirectory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();

let cache: { stamp: string; summaries: InventorySummary[]; folders: PackageFolder[] } | null = null;

/** Every package summary, reread whenever a descriptor, ledger, lens list or manifest changes on disk. */
export function readInventory() {
  const ids = packageIds();
  const stamp = ids.map(id => ['object.json', 'investigations.json', 'prepared/lenses.json', 'source/manifest.json', 'runtime-assets.json']
    .map(file => { const path = resolve(objectsDirectory, id, file); return existsSync(path) ? statSync(path).mtimeMs : 0; }).join(',')).join(';');
  if (cache?.stamp === stamp) return cache;
  const map = visibility(), summaries: InventorySummary[] = [], folders: PackageFolder[] = [];
  for (const id of ids) {
    const detail = readPackage(id, map);
    if (!detail) { folders.push({ id, files: readdirSync(resolve(objectsDirectory, id)) }); continue; }
    const { card, introduction, lenses, ledger, sources, runtimeAssets, swatchBasis, swatchSourceTitle, readme, ...summary } = detail;
    summaries.push(summary);
  }
  summaries.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'en'));
  cache = { stamp, summaries, folders };
  return cache;
}

export function readInventoryDetail(id: string): InventoryDetail {
  if (!packageIds().includes(id)) throw new Error(`Unknown object package: ${id}`);
  const detail = readPackage(id, visibility());
  if (!detail) throw new Error(`Object package has no descriptor: ${id}`);
  return detail;
}

/** The filter tags shared by the sidebar and the overview table. */
export function statusTags({ discovery, investigations, problems, localSourceCount, sourceCount }: InventorySummary) {
  return [discovery?.anchor && 'anchor', discovery?.imagery && 'imagery', discovery && !discovery.anchor && !discovery.imagery && !discovery.illustration && 'shape', discovery?.illustration && 'illustration',
    discovery && !discovery.onMap && 'off-map', discovery?.featured && 'featured', investigations.unresolved > 0 && 'unresolved',
    problems.length > 0 && 'problems', localSourceCount < sourceCount && 'missing-sources'].filter(tag => typeof tag === 'string').join(' ');
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

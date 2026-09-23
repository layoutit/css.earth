/** WWT's curated display imagery is a separate lane from qualified telescope observations. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode } from '../../../sources/source-values.mts';
import type { TargetCatalogueEntry } from '../targets.mts';

export const WWT_CATALOG_SCHEMA = 'cssearth-wwt-core-imagesets@1';
const CORE_REPOSITORY = 'WorldWideTelescope/wwt-core-catalogs';
const MAX_MATCHES = 25;

export interface WwtImageSet {
  readonly sourceFile: string; readonly name: string; readonly urlTemplate: string;
  readonly dataSetType: string; readonly referenceFrame: string; readonly bandPass: string; readonly projection: string;
  readonly position: { readonly centerXDegrees: number; readonly centerYDegrees: number; readonly offsetX: number; readonly offsetY: number;
    readonly rotationDegrees: number; readonly baseDegreesPerTile: number; readonly tileLevels: number; readonly bottomsUp: boolean };
  readonly credits: string; readonly creditsUrl: string; readonly thumbnailUrl: string;
}
export interface WwtCatalog {
  readonly schema: typeof WWT_CATALOG_SCHEMA;
  readonly source: { readonly repository: typeof CORE_REPOSITORY; readonly revision: string; readonly license: 'MIT';
    readonly parser: 'wwt-data-formats@0.18.1'; readonly inputs: readonly { readonly path: string; readonly sha256: string }[] };
  readonly imagesets: readonly WwtImageSet[];
}
export interface WwtImageryMatch extends WwtImageSet {
  readonly matchBasis: 'reference-frame' | 'title';
  /** Source metadata, not a science-product or tile-availability receipt. */
  readonly catalogUrl: string;
}
export type WwtImageryResult = {
  readonly service: 'WWT core catalogs'; readonly state: 'indexed'; readonly revision: string;
  readonly total: number; readonly matches: readonly WwtImageryMatch[]; readonly limit: number;
  readonly scope: 'curated display imagery; title or reference-frame match only';
} | { readonly service: 'WWT core catalogs'; readonly state: 'unavailable'; readonly reason: string };

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
};
const string = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  return value;
};
const finite = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
};
const boolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean.`);
  return value;
};
export function parseWwtCatalog(value: unknown): WwtCatalog {
  const catalog = record(value, 'WWT catalog'), source = record(catalog.source, 'WWT source');
  if (catalog.schema !== WWT_CATALOG_SCHEMA || source.repository !== CORE_REPOSITORY || source.license !== 'MIT' ||
      source.parser !== 'wwt-data-formats@0.18.1') throw new TypeError('Unknown WWT catalog source or schema.');
  const revision = string(source.revision, 'WWT revision');
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new TypeError('WWT catalog revision must be a full commit SHA.');
  if (!Array.isArray(source.inputs) || !source.inputs.length) throw new TypeError('WWT catalog needs pinned XML inputs.');
  const paths = new Set<string>(), inputs: { path: string; sha256: string }[] = [];
  for (const raw of source.inputs) {
    const input = record(raw, 'WWT input'), path = string(input.path, 'WWT input path'), digest = string(input.sha256, 'WWT input digest');
    if (!/^imagesets\/[a-z0-9_-]+\.xml$/u.test(path) || !/^[a-f0-9]{64}$/u.test(digest) || paths.has(path)) throw new TypeError('Invalid or duplicate WWT source input.');
    paths.add(path); inputs.push({ path, sha256: digest });
  }
  if (!Array.isArray(catalog.imagesets)) throw new TypeError('WWT imagesets must be an array.');
  const imagesets = catalog.imagesets.map((raw: unknown): WwtImageSet => {
    const image = record(raw, 'WWT imageset'), position = record(image.position, 'WWT position'), row: WwtImageSet = {
      sourceFile: string(image.sourceFile, 'WWT sourceFile'), name: string(image.name, 'WWT name'),
      urlTemplate: string(image.urlTemplate, 'WWT urlTemplate'), dataSetType: string(image.dataSetType, 'WWT dataSetType'),
      referenceFrame: string(image.referenceFrame, 'WWT referenceFrame'), bandPass: string(image.bandPass, 'WWT bandPass'),
      projection: string(image.projection, 'WWT projection'), credits: string(image.credits, 'WWT credits'),
      creditsUrl: string(image.creditsUrl, 'WWT creditsUrl'), thumbnailUrl: string(image.thumbnailUrl, 'WWT thumbnailUrl'),
      position: { centerXDegrees: finite(position.centerXDegrees, 'WWT centerXDegrees'), centerYDegrees: finite(position.centerYDegrees, 'WWT centerYDegrees'),
        offsetX: finite(position.offsetX, 'WWT offsetX'), offsetY: finite(position.offsetY, 'WWT offsetY'),
        rotationDegrees: finite(position.rotationDegrees, 'WWT rotationDegrees'), baseDegreesPerTile: finite(position.baseDegreesPerTile, 'WWT baseDegreesPerTile'),
        tileLevels: finite(position.tileLevels, 'WWT tileLevels'), bottomsUp: boolean(position.bottomsUp, 'WWT bottomsUp') },
    };
    if (!paths.has(`imagesets/${row.sourceFile}`)) throw new TypeError('WWT imageset lacks a pinned source.');
    return row;
  });
  return { schema: WWT_CATALOG_SCHEMA, source: { repository: CORE_REPOSITORY, revision, license: 'MIT', parser: 'wwt-data-formats@0.18.1', inputs }, imagesets };
}

export function parseWwtCatalogLines(contents: string): WwtCatalog {
  const lines = contents.trimEnd().split('\n');
  if (lines.length < 2) throw new TypeError('WWT catalog needs a source header and imagesets.');
  const header = record(JSON.parse(lines[0]!), 'WWT catalog header');
  return parseWwtCatalog({ ...header, imagesets: lines.slice(1).map(line => JSON.parse(line)) });
}

const words = (value: string): string => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
const containsName = (title: string, alias: string): boolean => Boolean(alias) && (` ${title} `).includes(` ${alias} `);

/** A title match is a search lead, not proof that the target lies within the displayed image. */
export function matchWwtImagery(catalog: WwtCatalog, target: TargetCatalogueEntry): WwtImageryResult {
  const aliases = [...new Set([target.id, target.name, ...target.aliases].map(words).filter(Boolean))];
  const matches: WwtImageryMatch[] = [];
  for (const image of catalog.imagesets) {
    if (!/^https?:\/\//u.test(image.urlTemplate) || !image.name.trim()) continue;
    const frame = words(image.referenceFrame), title = words(image.name);
    const matchBasis = frame && aliases.includes(frame) ? 'reference-frame' : aliases.some(alias => containsName(title, alias)) ? 'title' : undefined;
    if (!matchBasis) continue;
    matches.push({ ...image, matchBasis,
      catalogUrl: `https://github.com/${CORE_REPOSITORY}/blob/${catalog.source.revision}/imagesets/${encodeURIComponent(image.sourceFile)}` });
  }
  matches.sort((a, b) => (a.matchBasis === 'reference-frame' ? 0 : 1) - (b.matchBasis === 'reference-frame' ? 0 : 1) ||
    a.name.localeCompare(b.name) || a.urlTemplate.localeCompare(b.urlTemplate));
  return { service: 'WWT core catalogs', state: 'indexed', revision: catalog.source.revision, total: matches.length,
    matches: matches.slice(0, MAX_MATCHES), limit: MAX_MATCHES, scope: 'curated display imagery; title or reference-frame match only' };
}

export async function loadWwtImagery(root: string, target: TargetCatalogueEntry): Promise<WwtImageryResult> {
  try {
    const contents = await readFile(resolve(root, 'data/wwt/core-imagesets.jsonl'), 'utf8');
    return matchWwtImagery(parseWwtCatalogLines(contents), target);
  } catch (error) {
    const reason = hasErrorCode(error, 'ENOENT') ? 'The pinned WWT catalog index is missing from this science checkout.'
      : `The pinned WWT catalog index could not be read: ${(error as Error).message}`;
    return { service: 'WWT core catalogs', state: 'unavailable', reason };
  }
}

/** The short provider index each page's "Sources" link shows and the rows its Sources tab lists, computed once from the prepared source usage when the catalogue
 * is written (site/build/prepare/prepare-facilities.mts). The site reads this file instead of the whole catalogue: with batch 1 of the exoplanets
 * (2026-09-29) `site/prepared-sources.json` reached 41 MB, and importing it put the dev server and the site typecheck past 4 GB.
 * The complete author and institutional credits stay in each body's README, which the link opens. */
import { isRecord } from '@cssearth/core';
import type { SourceKind, SourceRecord, SourceResolver } from '../sources/catalog.js';
import type { SourceUsage, SourceUseKind } from './source-usage.js';

export const SOURCE_CREDITS_SCHEMA = 'cssearth-prepared-source-credits@2';
/** One row of a Sources tab: the published title, what it is and who publishes it, and its landing page. */
export interface SourceCreditRow { readonly title: string; readonly detail: string; readonly url: string }
export interface SourceCredits {
  readonly schema: typeof SOURCE_CREDITS_SCHEMA; readonly providers: Readonly<Record<string, readonly string[]>>;
  /** Each used source once, by catalogue ID; `sources` lists an object's IDs, its inputs before its methods and citations. */
  readonly records: Readonly<Record<string, SourceCreditRow>>; readonly sources: Readonly<Record<string, readonly string[]>>;
}

const KIND_LABELS: Readonly<Record<SourceKind, string>> = { 'data-product': 'Data product', publication: 'Publication', model: 'Model',
  'reference-page': 'Reference page', software: 'Software', artwork: 'Artwork' };
const USE_ORDER: readonly SourceUseKind[] = ['product-input', 'artwork', 'method', 'shared-context', 'citation'];
const creditRow = (source: SourceRecord): SourceCreditRow => {
  const url = (source.links.find(link => link.role === 'landing') ?? source.links[0])?.url;
  if (!url) throw new TypeError(`Source ${source.id} has no link for its Sources row.`);
  // A record without a publisher names the host that serves it.
  const from = source.publisher ?? /^https?:\/\/(?:www\.)?([^/:?#]+)/u.exec(url)?.[1];
  return Object.freeze({ title: source.title, detail: `${KIND_LABELS[source.kind]}${from ? ` · ${from}` : ''}`, url });
};

const COMPACT_PROVIDERS = ['NASA', 'ESA', 'JPL', 'USGS', 'JAXA', 'CSA', 'ISRO', 'STScI', 'ESO', 'NOIRLab', 'NAOJ', 'AMNH', 'CDS', 'OpenSpace', 'DAMIT'];
const compactProvider = new RegExp(`\\b(?:${COMPACT_PROVIDERS.join('|')})\\b`, 'gu');

/** Each object's providers: the compact agency names its recorded credits contain (else the publisher or the credit itself),
 * then the shared context it lends to other objects, in usage order. */
export function sourceCredits(usage: SourceUsage, sources: SourceResolver): SourceCredits {
  const owners = new Set([...Object.keys(usage.byObject),
    ...usage.edges.flatMap(use => use.kind === 'shared-context' ? [/^src\/objects\/([^/]+)\//u.exec(use.ownerPath)?.[1] ?? ''] : []).filter(Boolean)]);
  const providers: Record<string, readonly string[]> = {};
  const records: Record<string, SourceCreditRow> = {}, objectSources: Record<string, readonly string[]> = {};
  for (const objectId of [...owners].sort()) {
    const uses = (usage.byObject[objectId] ?? []).map(index => usage.edges[index]!);
    const ids = [...new Set(USE_ORDER.flatMap(kind => uses.filter(use => use.kind === kind).map(use => use.catalogueId)))];
    for (const id of ids) {
      const source = sources[id];
      if (!source) throw new TypeError(`${objectId} uses unknown source ${id}.`);
      records[id] ??= creditRow(source);
    }
    if (ids.length) objectSources[objectId] = Object.freeze(ids);
    const names = [...new Set([
      ...uses.flatMap(use => {
        const publisher = sources[use.catalogueId]?.publisher;
        const credit = use.credit ?? publisher ?? '';
        return credit.match(compactProvider) ?? (publisher ? [publisher] : credit ? [credit] : []);
      }),
      ...usage.edges.filter(use => use.kind === 'shared-context' && use.ownerPath.startsWith(`src/objects/${objectId}/`)).map(use => use.consumerLabel),
    ])];
    if (names.length) providers[objectId] = Object.freeze(names);
  }
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers), records: Object.freeze(records), sources: Object.freeze(objectSources) });
}

export function parseSourceCredits(input: unknown): SourceCredits {
  if (!isRecord(input) || input.schema !== SOURCE_CREDITS_SCHEMA || !isRecord(input.providers) || !isRecord(input.records) || !isRecord(input.sources))
    throw new TypeError(`Invalid prepared source credits: expected ${SOURCE_CREDITS_SCHEMA} with providers, records and sources. Run node site/build/prepare/prepare-facilities.mts --catalog-only.`);
  const providers: Record<string, readonly string[]> = {};
  const records: Record<string, SourceCreditRow> = {}, sources: Record<string, readonly string[]> = {};
  for (const [id, row] of Object.entries(input.records)) {
    if (!isRecord(row) || typeof row.title !== 'string' || !row.title || typeof row.detail !== 'string' || !row.detail || typeof row.url !== 'string' || !/^https?:\/\//u.test(row.url))
      throw new TypeError(`Invalid prepared source credit row ${id}: it needs a title, a detail and an http(s) url.`);
    records[id] = Object.freeze({ title: row.title, detail: row.detail, url: row.url });
  }
  for (const [objectId, ids] of Object.entries(input.sources)) {
    const missing = Array.isArray(ids) ? ids.find(id => typeof id !== 'string' || !records[id]) : objectId;
    if (!Array.isArray(ids) || missing !== undefined) throw new TypeError(`Invalid prepared source credits for ${objectId}: sources names ${String(missing)}, which records does not hold.`);
    sources[objectId] = Object.freeze([...ids as string[]]);
  }
  for (const [objectId, names] of Object.entries(input.providers)) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(objectId) || !Array.isArray(names) || !names.every(name => typeof name === 'string' && name))
      throw new TypeError(`Invalid prepared source credits for ${objectId}.`);
    providers[objectId] = Object.freeze([...names as string[]]);
  }
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers), records: Object.freeze(records), sources: Object.freeze(sources) });
}

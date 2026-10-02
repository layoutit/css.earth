/** The short provider index each page's "Sources" link shows and the rows its Sources tab lists, computed once from the prepared source usage when the catalogue
 * is written (site/build/prepare/prepare-facilities.mts). The site reads this file instead of the whole catalogue: with batch 1 of the exoplanets
 * (2026-09-29) `site/prepared-sources.json` reached 41 MB, and importing it put the dev server and the site typecheck past 4 GB.
 * The complete author and institutional credits stay in each body's README, which the link opens. */
import { isRecord } from '@cssearth/core';
import type { SourceKind, SourceRecord, SourceResolver } from '../sources/catalog.js';
import type { SourceUsage, SourceUseKind } from './source-usage.js';

export const SOURCE_CREDITS_SCHEMA = 'cssearth-prepared-source-credits@2';
/** One row of a Sources tab: a published work (its title, what it is and who publishes it, its landing page), or the files one
 * credit line supplied (the credit, how many files and the datasets they feed), which links to the first of them. Every link
 * leads to the source's own site; the object's README is the footer's link. */
export interface SourceCreditRow { readonly title: string; readonly detail: string; readonly url: string;
  /** Whose site serves it (`sourceIconKey`): the key of its favicon in `site/source/source-icons.json`. */
  readonly icon: string }
/** The site a source link leads to: its host, or for a DOI the registrant prefix (`doi:10.3847`), since doi.org only redirects
 * to the publisher. */
export function sourceIconKey(url: string): string {
  const doi = /^https?:\/\/(?:dx\.)?doi\.org\/(10\.\d+)\//u.exec(url)?.[1], host = /^https?:\/\/([^/:?#]+)/u.exec(url)?.[1];
  if (!doi && !host) throw new TypeError(`Source link has no host: ${url}.`);
  return doi ? `doi:${doi}` : host!.toLowerCase();
}
export interface SourceCredits {
  readonly schema: typeof SOURCE_CREDITS_SCHEMA; readonly providers: Readonly<Record<string, readonly string[]>>;
  /** Rows by key: a catalogue ID, shared by every object that uses the work, or `<object>#<n>` for one object's files under one
   * credit. `sources` lists an object's keys, its inputs before its methods and citations. */
  readonly records: Readonly<Record<string, SourceCreditRow>>; readonly sources: Readonly<Record<string, readonly string[]>>;
  /** One link to each site the rows lead to, by icon key: where its favicon is looked for. */
  readonly icons: Readonly<Record<string, string>>;
}

const KIND_LABELS: Readonly<Record<SourceKind, string>> = { 'data-product': 'Data product', publication: 'Publication', model: 'Model',
  'reference-page': 'Reference page', software: 'Software', artwork: 'Artwork' };
const USE_ORDER: readonly SourceUseKind[] = ['product-input', 'artwork', 'method', 'shared-context', 'citation'];
const creditRow = (source: SourceRecord): SourceCreditRow => {
  const url = (source.links.find(link => link.role === 'landing') ?? source.links[0])?.url;
  if (!url) throw new TypeError(`Source ${source.id} has no link for its Sources row.`);
  // A record without a publisher names the host that serves it.
  const from = source.publisher ?? /^https?:\/\/(?:www\.)?([^/:?#]+)/u.exec(url)?.[1];
  return Object.freeze({ title: source.title, detail: `${KIND_LABELS[source.kind]}${from ? ` · ${from}` : ''}`, url, icon: sourceIconKey(url) });
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
  const iconLinks: Record<string, string> = {};
  for (const objectId of [...owners].sort()) {
    const uses = (usage.byObject[objectId] ?? []).map(index => usage.edges[index]!);
    // A single file has no published title: its record is named after its manifest input ID (author-source-records.ts). Its
    // manifest entry does carry a credit line, so an object's files are listed once per credit instead of once per file.
    const keys: string[] = [], files = new Map<string, { key: string; ids: Set<string>; datasets: Set<string> }>();
    for (const use of USE_ORDER.flatMap(kind => uses.filter(candidate => candidate.kind === kind))) {
      const source = sources[use.catalogueId];
      if (!source) throw new TypeError(`${objectId} uses unknown source ${use.catalogueId}.`);
      if ((source.kind === 'data-product' || source.kind === 'model') && !source.publisher && use.credit) {
        let group = files.get(use.credit);
        if (!group) { group = { key: `${objectId}#${files.size}`, ids: new Set(), datasets: new Set() }; files.set(use.credit, group); keys.push(group.key); }
        group.ids.add(source.id);
        group.datasets.add(use.consumerLabel.slice(use.consumerLabel.indexOf(' · ') + 3));
      } else if (!keys.includes(source.id)) { records[source.id] ??= creditRow(source); keys.push(source.id); }
    }
    for (const [credit, group] of files) {
      const [first] = group.ids, only = group.ids.size === 1 ? sources[first!]! : null;
      // One file that is a catalogued work of its own keeps its published title.
      if (only && !only.id.startsWith('source-')) { records[only.id] ??= creditRow(only); keys[keys.indexOf(group.key)] = only.id; continue; }
      const datasets = [...group.datasets].join(', ');
      const { url, icon } = creditRow(sources[first!]!);
      records[group.key] = Object.freeze(only ? { title: credit, detail: `${KIND_LABELS[only.kind]} · ${datasets}`, url, icon }
        : { title: credit, detail: `${group.ids.size} files · ${datasets}`, url, icon });
    }
    for (const id of new Set([...keys.filter(key => sources[key]), ...[...files.values()].map(group => [...group.ids][0]!)])) {
      const { url, icon } = creditRow(sources[id]!);
      iconLinks[icon] ??= url;
    }
    const ids = [...new Set(keys)];
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
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers), records: Object.freeze(records), sources: Object.freeze(objectSources), icons: Object.freeze(iconLinks) });
}

export function parseSourceCredits(input: unknown): SourceCredits {
  if (!isRecord(input) || input.schema !== SOURCE_CREDITS_SCHEMA || !isRecord(input.providers) || !isRecord(input.records) || !isRecord(input.sources) || !isRecord(input.icons))
    throw new TypeError(`Invalid prepared source credits: expected ${SOURCE_CREDITS_SCHEMA} with providers, records, sources and icons. Run node site/build/prepare/prepare-facilities.mts --catalog-only.`);
  const providers: Record<string, readonly string[]> = {};
  const records: Record<string, SourceCreditRow> = {}, sources: Record<string, readonly string[]> = {};
  for (const [id, row] of Object.entries(input.records)) {
    if (!isRecord(row) || typeof row.title !== 'string' || !row.title || typeof row.detail !== 'string' || !row.detail || typeof row.icon !== 'string' || !row.icon || typeof row.url !== 'string' || !/^https?:\/\//u.test(row.url))
      throw new TypeError(`Invalid prepared source credit row ${id}: it needs a title, a detail, an icon key and an http(s) url.`);
    records[id] = Object.freeze({ title: row.title, detail: row.detail, url: row.url, icon: row.icon });
  }
  const icons: Record<string, string> = {};
  for (const [key, url] of Object.entries(input.icons)) {
    if (typeof url !== 'string' || !/^https?:\/\//u.test(url)) throw new TypeError(`Invalid prepared source credits: icon ${key} needs an http(s) link.`);
    icons[key] = url;
  }
  const unlinked = Object.entries(records).find(([, row]) => !icons[row.icon]);
  if (unlinked) throw new TypeError(`Invalid prepared source credit row ${unlinked[0]}: its icon ${unlinked[1].icon} has no link in icons.`);
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
  return Object.freeze({ schema: SOURCE_CREDITS_SCHEMA, providers: Object.freeze(providers), records: Object.freeze(records), sources: Object.freeze(sources), icons: Object.freeze(icons) });
}

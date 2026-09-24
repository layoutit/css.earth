// Pin source-backed notes for named surface features: each IAU Gazetteer feature id is joined to its Wikidata item
// (property P2824) and, when an English Wikipedia article exists, to that article's lead summary. The result is a
// repository-pinned document beside the Gazetteer archive; preparation merges it into the feature catalogue and the
// tooltip shows the note with its licence. Run through tools/prepare-feature-notes.mts.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDbf } from './dbf.js';
import { parseSurfaceFeaturesConfig } from './index.js';
import { unzipMember } from './archive.js';
import { FEATURE_NOTES_SCHEMA, parseFeatureNotes, trimExtract, type FeatureNote, type FeatureNotes } from './notes-schema.js';


const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const requireRecord = (value: unknown, label = 'Source value'): Record<string, unknown> => { if (!isRecord(value)) throw new TypeError(`${label} must be an object.`); return value; };
const requireArray = (value: unknown, label = 'Source value'): unknown[] => { if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`); return value; };
const requireString = (value: unknown, label = 'Source value'): string => { if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`); return value; };
const USER_AGENT = 'cssEarth/0.6 (https://github.com/layoutit/css.earth; feature notes preparation)';
const WIKIDATA_QUERY = 'SELECT ?item ?id ?article WHERE { ?item wdt:P2824 ?id . ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }';

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    // Wikipedia and Wikidata rate-limit bursts (429) and stumble (5xx); back off and retry before giving up on one page.
    await new Promise(done => setTimeout(done, 2000 * (attempt + 1)));
  }
  throw new Error(`Fetch failed: ${url}`);
}

/** Wikidata's map of Gazetteer ids to English Wikipedia articles, read from a saved SPARQL result or fetched live. */
export async function loadArticleMap(dumpPath: string | null): Promise<Map<string, { item: string; article: string }>> {
  const result = dumpPath ? JSON.parse(await readFile(dumpPath, 'utf8')) as unknown : await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(WIKIDATA_QUERY)}`);
  const bindings = requireArray(requireRecord(requireRecord(result).results).bindings);
  const map = new Map<string, { item: string; article: string }>();
  for (const value of bindings) {
    const binding = requireRecord(value);
    const id = requireString(requireRecord(binding.id).value), item = requireString(requireRecord(binding.item).value).split('/').at(-1)!, article = requireString(requireRecord(binding.article).value);
    if (!map.has(id)) map.set(id, { item, article });
  }
  return map;
}

export async function prepareFeatureNotes(objectId: string, articles: Map<string, { item: string; article: string }>, retrievedAt: string): Promise<{ path: string; count: number; candidates: number }> {
  const objectDirectory = resolve('src/objects', objectId), sourceDirectory = resolve(objectDirectory, 'source');
  const config = parseSurfaceFeaturesConfig(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/features.json'), 'utf8')));
  if (config.archive === null || config.members === null) throw new TypeError(`${objectId} labels no Gazetteer names; nothing to annotate.`);
  const archive = resolve(sourceDirectory, config.directory, config.archive);
  const table = parseDbf(unzipMember(archive, config.members.attributes));
  const ids = [...new Set(table.rows.map(row => /\/Feature\/(\d+)$/u.exec(row.link ?? '')?.[1]).filter((id): id is string => typeof id === 'string'))];
  const entries: FeatureNote[] = [];
  let candidates = 0;
  const queue = ids.filter(id => articles.has(id));
  candidates = queue.length;
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const { item, article } = articles.get(next)!;
      const title = decodeURIComponent(article.slice('https://en.wikipedia.org/wiki/'.length));
      let summary: unknown;
      try { summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /gu, '_'))}`); }
      catch (error) { console.warn(`${objectId}: no summary for ${title} (${String(error)})`); continue; }
      if (!isRecord(summary) || typeof summary.extract !== 'string' || !summary.extract.trim() || summary.type === 'disambiguation') continue;
      const page = isRecord(summary.content_urls) && isRecord(summary.content_urls.desktop) && typeof summary.content_urls.desktop.page === 'string' ? summary.content_urls.desktop.page : article;
      entries.push({ id: next, item, title: typeof summary.title === 'string' ? summary.title : title, url: page, revision: String(summary.revision ?? ''), extract: trimExtract(summary.extract) });
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  entries.sort((a, b) => Number(a.id) - Number(b.id));
  const notes: FeatureNotes = { schema: FEATURE_NOTES_SCHEMA, source: 'English Wikipedia lead summaries (REST page summary API), joined to the Gazetteer through Wikidata property P2824',
    retrievedAt, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', wikidataQuery: WIKIDATA_QUERY, entries };
  parseFeatureNotes(notes);
  const path = resolve(sourceDirectory, config.directory, config.notes ?? 'notes.json');
  await writeFile(path, `${JSON.stringify(notes, null, 2)}\n`);
  return { path, count: entries.length, candidates };
}


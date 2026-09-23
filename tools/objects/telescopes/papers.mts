/** Paper search for the telescope API: which published works already reduced the data we are about to fetch.
 *
 * OpenAlex lists works whose title or abstract names the target (and instrument); arXiv is a bounded fallback when that
 * index is temporarily unavailable. Each open-access copy is fetched once
 * with a plain GET. A browser challenge is recorded as `blocked` and never worked around. For HTML full texts, figure
 * captions and table titles that describe maps or list observations are reported verbatim so a reader sees at once
 * whether the paper made the product and which frames it used. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { loadTargetCatalogue } from './query.mts';
import { resolveTarget } from './targets.mts';

export const PAPERS_SCHEMA = 'cssearth-telescope-papers@1';
export const OPENALEX_WORKS = 'https://api.openalex.org/works';
export const ARXIV_QUERY = 'https://export.arxiv.org/api/query';
export const MAX_WORKS = 20;
export const MAX_REQUESTS = 25;
export const REQUEST_TIMEOUT_MS = 20_000;
export const CAPTION_LIMIT = 300;
const CANDIDATE_PAGE = 50;
const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';

export interface OpenAlexWork {
  readonly id: string; readonly doi: string | null; readonly title: string; readonly year: number | null;
  readonly type: string | null; readonly authors: readonly string[]; readonly authorCount: number;
  readonly licence: string | null; readonly isOpenAccess: boolean; readonly openAccessUrl: string | null;
  readonly relevance: number | null; readonly abstract: string;
}
export type AccessStatus = 'fetchable' | 'blocked' | 'failed' | 'closed' | 'skipped';
export interface FullTextAccess {
  readonly status: AccessStatus; readonly reason: string; readonly httpStatus?: number; readonly finalUrl?: string; readonly format?: string;
}
export interface PaperCaption { readonly kind: 'figure' | 'table'; readonly label: string | null; readonly text: string }
export interface PaperReport {
  readonly rank: number; readonly title: string; readonly year: number | null; readonly doi: string | null;
  readonly authors: readonly string[]; readonly moreAuthors: boolean; readonly licence: string | null;
  readonly openAccessUrl: string | null; readonly openAlex?: string; readonly arxiv?: string; readonly access: FullTextAccess;
  readonly captionsScanned?: number; readonly captions?: readonly PaperCaption[]; readonly savedFullText?: string;
  /** evidenceScore of the fetched paper; the report is sorted by it. */
  readonly evidence?: number;
}
export interface PaperSearch {
  readonly schema: typeof PAPERS_SCHEMA; readonly target: { readonly id: string; readonly name: string };
  readonly instrument: string | null; readonly query: string; readonly source: 'openalex' | 'arxiv'; readonly sourceIssue?: string;
  readonly candidates: number; readonly requests: number;
  /** Host names a work had to mention besides the target: present for a body on a hosted orbit. */
  readonly hosts?: readonly string[];
  readonly works: readonly PaperReport[];
}
export interface PaperSearchOptions {
  readonly target: string; readonly instrument?: string; readonly directory?: string;
  /** A host name the works must also mention, for a name outside the catalogue; a catalogue body's host is found itself. */
  readonly host?: string;
  readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch;
}

const nullableString = (value: unknown, label: string): string | null => value === null || value === undefined ? null : requireString(value, label);
const nullableNumber = (value: unknown, label: string): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number or null.`);
  return value;
};
const optionalRecord = (value: unknown, label: string): Record<string, unknown> | null => value === null || value === undefined ? null : requireRecord(value, label);

/** OpenAlex ships abstracts as an inverted index (word -> positions). Rebuild the reading order. */
export function abstractText(value: unknown, label = 'abstract_inverted_index'): string {
  if (value === null || value === undefined) return '';
  const index = requireRecord(value, label), words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const position of requireArray(positions, `${label}.${word}`)) {
    if (typeof position !== 'number' || !Number.isSafeInteger(position) || position < 0 || position > 100_000) throw new TypeError(`${label}.${word} positions must be small whole numbers.`);
    words[position] = word;
  }
  return words.filter(word => word !== undefined).join(' ');
}

export function parseOpenAlexWork(value: unknown, label = 'OpenAlex work'): OpenAlexWork {
  const work = requireRecord(value, label), openAccess = requireRecord(work.open_access, `${label}.open_access`);
  const best = optionalRecord(work.best_oa_location, `${label}.best_oa_location`), primary = optionalRecord(work.primary_location, `${label}.primary_location`);
  const title = nullableString(work.title, `${label}.title`) ?? nullableString(work.display_name, `${label}.display_name`);
  if (title === null || !title.trim()) throw new TypeError(`${label} has no title.`);
  if (typeof openAccess.is_oa !== 'boolean') throw new TypeError(`${label}.open_access.is_oa must be a boolean.`);
  const authorships = requireArray(work.authorships ?? [], `${label}.authorships`);
  const authors = authorships.slice(0, 3).map((entry, index) => {
    const authorship = requireRecord(entry, `${label}.authorships[${index}]`), author = requireRecord(authorship.author, `${label}.authorships[${index}].author`);
    return nullableString(author.display_name, `${label}.authorships[${index}].author.display_name`) ?? nullableString(authorship.raw_author_name, `${label}.authorships[${index}].raw_author_name`) ?? 'unknown';
  });
  const licence = (best ? nullableString(best.license, `${label}.best_oa_location.license`) : null) ?? (primary ? nullableString(primary.license, `${label}.primary_location.license`) : null);
  const openAccessUrl = nullableString(openAccess.oa_url, `${label}.open_access.oa_url`)
    ?? (best ? nullableString(best.landing_page_url, `${label}.best_oa_location.landing_page_url`) ?? nullableString(best.pdf_url, `${label}.best_oa_location.pdf_url`) : null);
  return { id: requireString(work.id, `${label}.id`), doi: nullableString(work.doi, `${label}.doi`), title: title.replace(/\s+/gu, ' ').trim(),
    year: nullableNumber(work.publication_year, `${label}.publication_year`), type: nullableString(work.type, `${label}.type`), authors, authorCount: authorships.length,
    licence, isOpenAccess: openAccess.is_oa, openAccessUrl, relevance: nullableNumber(work.relevance_score, `${label}.relevance_score`), abstract: abstractText(work.abstract_inverted_index, `${label}.abstract_inverted_index`) };
}

export function parseOpenAlexResponse(value: unknown): readonly OpenAlexWork[] {
  const response = requireRecord(value, 'OpenAlex response');
  if (typeof response.error === 'string') throw new Error(`OpenAlex refused the query: ${response.error}${typeof response.message === 'string' ? ` (${response.message})` : ''}`);
  return requireArray(response.results, 'OpenAlex response results').map((work, index) => parseOpenAlexWork(work, `OpenAlex work ${index + 1}`));
}

const words = (value: string): string => ` ${value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
/** OpenAlex search stems and matches loosely; keep only works whose title or abstract really names every phrase. */
export function mentions(work: Pick<OpenAlexWork, 'title' | 'abstract'>, phrases: readonly string[]): boolean {
  const text = words(`${work.title} ${work.abstract}`);
  return phrases.every(phrase => text.includes(words(phrase)));
}

/** Open access first, then OpenAlex relevance, then the most recent year: the order in which copies are fetched. */
export function rankWorks(works: readonly OpenAlexWork[], limit = MAX_WORKS): OpenAlexWork[] {
  const order = (value: number | null): number => value ?? Number.NEGATIVE_INFINITY;
  return [...works].sort((left, right) => Number(right.isOpenAccess) - Number(left.isOpenAccess)
    || order(right.relevance) - order(left.relevance) || order(right.year) - order(left.year)).slice(0, limit);
}

/** Filter syntax (`,` `:` `|`) and the `*` wildcard, which OpenAlex rejects with HTTP 400 ("Sagittarius A*"), become spaces. */
const searchText = (value: string): string => value.replace(/[,:|*"()]/gu, ' ').replace(/\s+/gu, ' ').trim();
/** With host names, the search is boolean: the body and any one host name, so "S2" means the star at Sgr A*. */
export function openAlexQuery(name: string, instrument?: string, hosts: readonly string[] = []): string {
  const phrases = [...new Set(hosts.map(searchText).filter(Boolean))];
  const search = phrases.length
    ? [searchText(name), `(${phrases.map(phrase => `"${phrase}"`).join(' OR ')})`, ...instrument ? [searchText(instrument)] : []].join(' AND ')
    : [name, instrument].filter((part): part is string => Boolean(part)).join(' ').replace(/[,:|*]/gu, ' ');
  const parameters = new URLSearchParams({
    filter: `title_and_abstract.search:${search},type:article|review|preprint|letter`,
    'per-page': String(CANDIDATE_PAGE),
    select: 'id,doi,title,display_name,publication_year,type,authorships,open_access,best_oa_location,primary_location,relevance_score,abstract_inverted_index',
  });
  return `${OPENALEX_WORKS}?${parameters.toString()}`;
}

/** arXiv's documented Atom API uses `all:` terms; exact title/abstract and host matching is enforced locally. */
export function arxivQuery(name: string, instrument?: string, hosts: readonly string[] = []): string {
  const term = (value: string) => `all:"${searchText(value)}"`;
  const parts = [term(name), ...hosts.length ? [`(${hosts.map(term).join(' OR ')})`] : [], ...instrument ? [term(instrument)] : []];
  return `${ARXIV_QUERY}?${new URLSearchParams({ search_query: parts.join(' AND '), start: '0', max_results: String(CANDIDATE_PAGE) })}`;
}

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', minus: '−', deg: '°', times: '×', micro: 'µ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}
const atomText = (xml: string, name: string): string | null => {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'iu').exec(xml);
  return match ? decodeEntities(match[1]!.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim() : null;
};
/** Parse only the Atom fields needed by the paper contract; invalid feeds and identities are refused. */
export function parseArxivResponse(xml: string): readonly OpenAlexWork[] {
  if (xml.length > 2_000_000 || !/<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/iu.test(xml)) throw new TypeError('Invalid or oversized arXiv Atom feed.');
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/giu)].map(([_, entry], index) => {
    const rawId = atomText(entry!, 'id'), title = atomText(entry!, 'title'), abstract = atomText(entry!, 'summary') ?? '';
    if (!rawId || !title) throw new TypeError(`arXiv entry ${index + 1} has no id or title.`);
    const id = new URL(rawId);
    if (id.hostname !== 'arxiv.org' || !/^\/abs\/[A-Za-z0-9.\/-]+$/u.test(id.pathname)) throw new TypeError(`arXiv entry ${index + 1} has an invalid identity.`);
    const yearText = atomText(entry!, 'published'), year = yearText && /^\d{4}-\d{2}-\d{2}/u.test(yearText) ? Number(yearText.slice(0, 4)) : null;
    const authors = [...entry!.matchAll(/<author>([\s\S]*?)<\/author>/giu)].map(match => atomText(match[1]!, 'name')).filter((name): name is string => Boolean(name));
    const doi = atomText(entry!, 'arxiv:doi');
    const arxivId = id.pathname.slice('/abs/'.length).replace(/v\d+$/u, '');
    return { id: `https://arxiv.org/abs/${arxivId}`, doi: doi ? `https://doi.org/${doi}` : null, title, year, type: 'preprint',
      authors: authors.slice(0, 3), authorCount: authors.length, licence: null, isOpenAccess: true,
      openAccessUrl: `https://arxiv.org/pdf/${arxivId}`, relevance: null, abstract };
  });
}
// Inline tags join their text; block tags separate it.
const INLINE_TAG = /<\/?(?:a|abbr|b|bold|em|i|italic|span|strong|sub|sup|small|u|mi|mn|mo|mrow|msub|msup|math)\b[^>]*>/giu;
const plainText = (html: string): string => decodeEntities(html.replace(INLINE_TAG, '').replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').replace(/\s+([.,;:)])/gu, '$1').replace(/\(\s+/gu, '(').trim();
const trimCaption = (text: string): string => text.length <= CAPTION_LIMIT ? text : `${text.slice(0, CAPTION_LIMIT - 1).trimEnd()}…`;

const LABEL = /^(fig(?:ure)?\.?|table)\s*([A-Z]?\d+[A-Za-z]?)\s*[.:|]?/iu;
const LABEL_ONLY = /^(fig(?:ure)?\.?|table)\s*([A-Z]?\d+[A-Za-z]?)\s*[.:|]?$/iu;
/** A map, mosaic, radiance, scale or colour bar, or a list of observations (orbit, time, distance). */
export const CAPTION_TOPIC = /\bmaps?\b|\bmapped\b|\bmosaics?\b|\bradiances?\b|\bscales?\b|\bcolou?r[ -]?bars?\b|\borbits?\b|\bperijoves?\b|\btimes?\b|\bdistances?\b/iu;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const labelOf = (match: RegExpExecArray): { readonly kind: 'figure' | 'table'; readonly label: string } => {
  const kind = /^t/iu.test(match[1]!) ? 'table' : 'figure';
  return { kind, label: `${kind === 'table' ? 'Table' : 'Figure'} ${match[2]!}` };
};
const captionContainer = (tag: string, attributes: string): 'figure' | 'table' | 'either' | null => {
  if (tag === 'figcaption') return 'figure';
  if (tag === 'caption') return 'table';
  const classes = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/iu.exec(attributes);
  const names = (classes?.[2] ?? classes?.[3] ?? '').split(/\s+/u);
  if (names.some(name => /caption/iu.test(name))) return 'either';
  // Frontiers-style BEM blocks keep the table caption in a sibling "__description" after the table body.
  if (names.some(name => /(table|figure)__description$/iu.test(name))) return names.some(name => /table__description$/iu.test(name)) ? 'table' : 'figure';
  return null;
};

/** Figure captions and table titles in an HTML full text, in document order, with their nearest label. */
export function extractCaptions(html: string): { readonly scanned: number; readonly captions: readonly PaperCaption[] } {
  const source = html.replace(/<!--[\s\S]*?-->/gu, '').replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '');
  const stack: { tag: string; start: number; container: 'figure' | 'table' | 'either' | null }[] = [];
  const found: { readonly start: number; readonly end: number; readonly container: 'figure' | 'table' | 'either' }[] = [];
  const labels: { readonly at: number; readonly kind: 'figure' | 'table'; readonly label: string }[] = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>/gu;
  let previous = 0;
  for (let match = tagPattern.exec(source); match; match = tagPattern.exec(source)) {
    const text = plainText(source.slice(previous, match.index)), label = LABEL_ONLY.exec(text);
    if (label) labels.push({ at: match.index, ...labelOf(label) });
    previous = tagPattern.lastIndex;
    const closing = match[1] === '/', tag = match[2]!.toLowerCase(), attributes = match[3] ?? '';
    if (closing) {
      const at = stack.map(entry => entry.tag).lastIndexOf(tag);
      if (at < 0) continue;
      for (const entry of stack.splice(at)) if (entry.tag === tag && entry.container && !stack.some(outer => outer.container)) found.push({ start: entry.start, end: match.index, container: entry.container });
      continue;
    }
    if (VOID.has(tag) || attributes.trimEnd().endsWith('/')) continue;
    stack.push({ tag, start: tagPattern.lastIndex, container: captionContainer(tag, attributes) });
  }
  found.sort((left, right) => left.start - right.start);
  const captions: PaperCaption[] = [], seen = new Set<string>();
  for (const block of found) {
    const text = plainText(source.slice(block.start, block.end));
    if (!text || LABEL_ONLY.test(text)) continue;
    const own = LABEL.exec(text), nearest = labels.filter(label => label.at <= block.start).at(-1);
    const named = own ? labelOf(own) : nearest ?? null;
    const kind = named?.kind ?? (block.container === 'table' ? 'table' : 'figure');
    const key = `${named?.label ?? ''}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    captions.push({ kind, label: named?.label ?? null, text: trimCaption(text) });
  }
  return { scanned: captions.length, captions };
}

export function relevantCaptions(captions: readonly PaperCaption[]): PaperCaption[] {
  return captions.filter(caption => CAPTION_TOPIC.test(caption.text));
}

const MAP_CAPTION = /\bmaps?\b|\bmapped\b|\bmosaics?\b|\bcolou?r[ -]?bars?\b|\bcolou?r scales?\b/iu;
const OBSERVATION_TABLE = /\borbits?\b|\bperijoves?\b|\bobservations?\b|\bdistances?\b|\bresolution\b/iu;
/** What a fetched paper shows it did: 3 per map or colour-scale caption, 2 per table listing observations, 2 when the
 * title names the instrument, and 1 when it names the target. Papers that made the product rise above ones that cite it. */
export function evidenceScore(report: Pick<PaperReport, 'title' | 'captions'>, target: string, instrument: string | null): number {
  const captions = report.captions ?? [];
  return 3 * captions.filter(caption => MAP_CAPTION.test(caption.text)).length
    + 2 * captions.filter(caption => caption.kind === 'table' && OBSERVATION_TABLE.test(caption.text)).length
    + (instrument && mentions({ title: report.title, abstract: '' }, [instrument]) ? 2 : 0)
    + (mentions({ title: report.title, abstract: '' }, [target]) ? 1 : 0);
}

const CHALLENGE_TITLE = /<title[^>]*>[^<]*(just a moment|client challenge|captcha|attention required|verify you are human|access denied|bot manager|are you a robot)/iu;
const CHALLENGE_BODY = /challenge-platform|cf-chl-|perfdrive\.com|_Incapsula_Resource|px-captcha/iu;
/** A challenge page is small and says so in its title or by Cloudflare's header. Full articles often embed the same
 * bot-management scripts (Nature does), so script names alone only count on a short page. */
export function isChallenge(headers: Pick<Headers, 'get'>, body: string): boolean {
  return headers.get('cf-mitigated') === 'challenge' || CHALLENGE_TITLE.test(body) || (body.length < 30_000 && CHALLENGE_BODY.test(body));
}

interface Budget { used: number }
async function politeFetch(url: string, budget: Budget, fetcher: typeof fetch, accept: string): Promise<Response> {
  if (budget.used >= MAX_REQUESTS) throw new RangeError(`request budget of ${MAX_REQUESTS} reached`);
  budget.used += 1;
  return fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept, 'user-agent': USER_AGENT } });
}

async function readFullText(url: string, budget: Budget, fetcher: typeof fetch): Promise<{ readonly access: FullTextAccess; readonly html?: string }> {
  let response: Response;
  try {
    response = await politeFetch(url, budget, fetcher, 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { access: error instanceof RangeError ? { status: 'skipped', reason: message } : { status: 'failed', reason: message } };
  }
  const format = (response.headers.get('content-type') ?? 'unknown').split(';')[0]!.trim().toLowerCase();
  const common = { httpStatus: response.status, finalUrl: response.url || url, format };
  if (!format.includes('html')) {
    await response.body?.cancel();
    if (response.headers.get('cf-mitigated') === 'challenge') return { access: { status: 'blocked', reason: 'browser challenge', ...common } };
    return { access: response.ok ? { status: 'fetchable', reason: `plain GET returned ${format}`, ...common } : { status: 'failed', reason: `HTTP ${response.status}`, ...common } };
  }
  const body = await response.text();
  if (isChallenge(response.headers, body)) return { access: { status: 'blocked', reason: 'browser challenge; not attempted further', ...common } };
  if (!response.ok) return { access: { status: 'failed', reason: `HTTP ${response.status}`, ...common } };
  return { access: { status: 'fetchable', reason: 'plain GET returned HTML', ...common }, html: body };
}

/**
 * The names of a hosted body's host: its body record's `physical.parent` when the record carries a `hostedOrbit`, so a short
 * name such as "S2" is searched as the star orbiting Sgr A* rather than the cell line. Moons and planets keep a plain search.
 */
export async function hostNames(root: string, id: string, catalogue: Awaited<ReturnType<typeof loadTargetCatalogue>>): Promise<readonly string[]> {
  const path = resolve(root, 'packages/astronomy/data/bodies', `${id}.json`);
  const text = await readFile(path, 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (text === undefined) return [];
  const record = requireRecord(JSON.parse(text), `${id} body record`);
  if (record.hostedOrbit === undefined) return [];
  const parent = requireString(requireRecord(record.physical, `${id} physical`).parent, `${id} parent`);
  const host = catalogue.find(entry => entry.id === parent);
  if (!host) throw new TypeError(`${id}: host ${parent} is not in the target catalogue.`);
  return [host.name, ...host.aliases];
}

/** A catalogue body is searched by its catalogue name; any other name is searched as written. The literature does not need a
 * package, or even a SIMBAD identifier, to name a star ("S301"). */
export const displayName = (target: string, catalogue: Awaited<ReturnType<typeof loadTargetCatalogue>>): { readonly id: string; readonly name: string } => {
  const resolution = resolveTarget(target, catalogue);
  if (resolution.status === 'resolved') return resolution.canonical;
  if (resolution.status === 'ambiguous') throw new TypeError(`Target is ambiguous: ${resolution.candidates.map(candidate => candidate.id).join(', ')}.`);
  const name = target.trim();
  if (!name) throw new TypeError('Papers requires a target name.');
  return { id: name, name };
};

export async function searchPapers(root: string, options: PaperSearchOptions): Promise<PaperSearch> {
  const fetcher = options.fetcher ?? fetch, progress = options.progress ?? (() => undefined), budget: Budget = { used: 0 };
  const catalogue = await loadTargetCatalogue(root), target = displayName(options.target, catalogue), instrument = options.instrument?.trim() || null;
  const hosts = options.host?.trim() ? [options.host.trim()] : await hostNames(root, target.id, catalogue);
  let query = openAlexQuery(target.name, instrument ?? undefined, hosts), source: PaperSearch['source'] = 'openalex', sourceIssue: string | undefined;
  progress(`Searching OpenAlex for ${target.name}${instrument ? ` with ${instrument}` : ''}…`);
  let found: readonly OpenAlexWork[];
  let response: Response | undefined;
  try { response = await politeFetch(query, budget, fetcher, 'application/json'); }
  catch (error) { sourceIssue = `OpenAlex transport failed: ${error instanceof Error ? error.message : String(error)}`; }
  if (response && !response.ok) {
    if (response.status !== 429 && response.status < 500) throw new Error(`OpenAlex returned HTTP ${response.status}.`);
    sourceIssue = `OpenAlex returned HTTP ${response.status}.`;
    await response.body?.cancel();
  }
  if (sourceIssue) {
    source = 'arxiv'; query = arxivQuery(target.name, instrument ?? undefined, hosts);
    progress(`${sourceIssue} Searching arXiv…`);
    const fallback = await politeFetch(query, budget, fetcher, 'application/atom+xml');
    if (!fallback.ok) throw new Error(`${sourceIssue} arXiv returned HTTP ${fallback.status}.`);
    found = parseArxivResponse(await fallback.text());
  } else if (response) found = parseOpenAlexResponse(await response.json());
  else throw new Error('OpenAlex produced no response.');
  const candidates = found.filter(work => mentions(work, instrument ? [target.name, instrument] : [target.name])
    && (!hosts.length || hosts.some(host => mentions(work, [host]))));
  const ranked = rankWorks(candidates);
  if (options.directory) await mkdir(resolve(options.directory, 'fulltext'), { recursive: true });
  const works: PaperReport[] = [];
  for (const [index, work] of ranked.entries()) {
    const rank = index + 1;
    const base = { rank, title: work.title, year: work.year, doi: work.doi, authors: work.authors, moreAuthors: work.authorCount > work.authors.length,
      licence: work.licence, openAccessUrl: work.openAccessUrl, ...(source === 'openalex' ? { openAlex: work.id } : { arxiv: work.id }) };
    if (!work.openAccessUrl) { works.push({ ...base, access: { status: 'closed', reason: 'no open-access copy listed' } }); continue; }
    progress(`${rank}/${ranked.length} ${work.openAccessUrl}`);
    const fetched = await readFullText(work.openAccessUrl, budget, fetcher);
    if (fetched.html === undefined) { works.push({ ...base, access: fetched.access }); continue; }
    const extracted = extractCaptions(fetched.html);
    let savedFullText: string | undefined;
    if (options.directory) { savedFullText = resolve(options.directory, 'fulltext', `${index + 1}.html`); await writeFile(savedFullText, fetched.html); }
    works.push({ ...base, access: fetched.access, captionsScanned: extracted.scanned, captions: relevantCaptions(extracted.captions), ...(savedFullText ? { savedFullText } : {}) });
  }
  // Fetch order was the catalogue's guess; report order is what the papers turned out to contain.
  const scored = works.map((work, index) => ({ work, index, score: evidenceScore(work, target.name, instrument) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ work, score }, index) => ({ ...work, rank: index + 1, evidence: score }));
  const result: PaperSearch = { schema: PAPERS_SCHEMA, target, instrument, source, ...(sourceIssue ? { sourceIssue } : {}),
    ...hosts.length ? { hosts } : {}, query, candidates: candidates.length, requests: budget.used, works: scored };
  if (options.directory) await writeFile(resolve(options.directory, 'papers.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export function formatPapers(result: PaperSearch, directory?: string): string {
  const lines = [`${result.target.name}${result.hosts ? ` at ${result.hosts[0]}` : ''}${result.instrument ? ` · ${result.instrument}` : ''} · ${result.works.length} of ${result.candidates} matching ${result.source} works · ${result.requests} requests`,
    ...result.sourceIssue ? [`OpenAlex unavailable: ${result.sourceIssue}; searched arXiv instead.`] : [], ''];
  for (const work of result.works) {
    const authors = `${work.authors.join(', ')}${work.moreAuthors ? ' et al.' : ''}`;
    lines.push(`${work.rank}. ${work.title} (${work.year ?? 'year unknown'})${work.evidence ? ` · evidence ${work.evidence}` : ''}`, `   ${authors}`,
      `   DOI: ${work.doi ?? 'none'} · licence: ${work.licence ?? 'unknown'}`,
      `   Open access: ${work.openAccessUrl ?? 'none'}`,
      `   Full text: ${work.access.status}${work.access.format ? ` (${work.access.format})` : ''} · ${work.access.reason}`);
    if (work.captions) {
      if (!work.captions.length) lines.push(`   No map or observation captions among ${work.captionsScanned ?? 0} captions.`);
      for (const caption of work.captions) lines.push(`   ${caption.label ?? (caption.kind === 'table' ? 'Table' : 'Figure')}: ${caption.text}`);
    }
  }
  if (!result.works.length) lines.push('No works name this target in their title or abstract.');
  if (directory) lines.push('', `Saved: ${resolve(directory, 'papers.json')}`);
  return `${lines.join('\n')}\n`;
}

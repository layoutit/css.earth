/** The one way the telescope asks the paper indexes which works name a target: `telescope papers` and the star survey both
 * come through `findWorks`.
 *
 * OpenAlex is asked first, for works whose title or abstract (or, on request, indexed full text) names the target by any of
 * its spellings, together with the instrument, a host name and any one of the subject phrases. It meters use: a search costs
 * 10 credits and a list with no search 1, and a network without an API key has 1,000 credits a day, shared by everyone on it, until midnight UTC
 * (help.openalex.org/access/example-costs, read 2026-10-04). A free key has ten times that; the search sends
 * `OPENALEX_API_KEY` from the environment as a header, never in the address. When OpenAlex refuses or is down, arXiv's
 * documented API answers from titles and abstracts alone. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { anyOf, forms } from './names.mts';
import { decodeEntities, mentions, mentionsAny } from './text.mts';

export const OPENALEX_WORKS = 'https://api.openalex.org/works';
/** Works on one page of an OpenAlex answer, its largest: a request costs the same whatever it returns. */
export const OPENALEX_PAGE = 100;
export const ARXIV_QUERY = 'https://export.arxiv.org/api/query';
export const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** arXiv is asked for half a page. */
const ARXIV_PAGE = 50;
/** Requests to one host are a second apart; arXiv's API terms ask for three. */
const HOST_PAUSE_MS = 1000, ARXIV_PAUSE_MS = 3000;
const WORK_FIELDS = 'id,doi,title,display_name,publication_year,type,authorships,open_access,best_oa_location,primary_location,locations,is_retracted,relevance_score,abstract_inverted_index';

export interface OpenAlexWork {
  readonly id: string; readonly doi: string | null; readonly title: string; readonly year: number | null;
  readonly type: string | null; readonly authors: readonly string[]; readonly authorCount: number;
  readonly licence: string | null; readonly isOpenAccess: boolean; readonly openAccessUrl: string | null;
  readonly relevance: number | null; readonly abstract: string;
  /** The arXiv identifier of a copy the index lists ("2110.11376", "astro-ph/0305259"). */
  readonly arxivId: string | null; readonly retracted: boolean;
  /** The works this one cites, when the request asked for them. */
  readonly references: readonly string[];
}
/** What a search asks for. `about` is any one of the phrases; `hosts` any one of the host's names. */
export interface WorksQuestion {
  readonly names: readonly string[]; readonly instrument?: string | null; readonly hosts?: readonly string[];
  readonly about?: readonly string[]; readonly fulltext?: boolean; readonly newestFirst?: boolean;
}
export interface IndexBudget { readonly remaining: number; readonly limit: number }
export interface WorksAnswer {
  readonly source: 'openalex' | 'arxiv'; readonly sourceIssue?: string; readonly query: string;
  /** Works the index returned, and those of them whose own words name what was asked. */
  readonly returned: number; readonly works: readonly OpenAlexWork[];
}
/** One run's requests: their count against a limit, their pacing by host, and what OpenAlex said of its budget. */
export interface Session {
  used: number; readonly limit: number; readonly fetcher: typeof fetch; readonly pause: (ms: number) => Promise<void>;
  readonly key?: string; readonly last: Map<string, number>; budget?: IndexBudget; refused?: string;
}
export const openSession = (limit: number, options: { readonly fetcher?: typeof fetch; readonly pause?: (ms: number) => Promise<void>; readonly apiKey?: string }): Session => {
  const key = options.apiKey ?? process.env.OPENALEX_API_KEY;
  return { used: 0, limit, fetcher: options.fetcher ?? fetch, pause: options.pause ?? (ms => new Promise(done => { setTimeout(done, ms); })), ...key ? { key } : {}, last: new Map() };
};

export async function politeFetch(session: Session, url: string, accept: string): Promise<Response> {
  if (session.used >= session.limit) throw new RangeError(`request budget of ${session.limit} reached`);
  session.used += 1;
  const host = new URL(url).host, last = session.last.get(host), gap = host === new URL(ARXIV_QUERY).host ? ARXIV_PAUSE_MS : HOST_PAUSE_MS;
  if (last !== undefined && Date.now() - last < gap) await session.pause(gap - (Date.now() - last));
  session.last.set(host, Date.now());
  const openAlex = host === new URL(OPENALEX_WORKS).host;
  const response = await session.fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept, 'user-agent': USER_AGENT, ...openAlex && session.key ? { authorization: `Bearer ${session.key}` } : {} } });
  const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? NaN), limit = Number(response.headers.get('x-ratelimit-limit') ?? NaN);
  if (openAlex && Number.isFinite(remaining) && Number.isFinite(limit)) session.budget = { remaining, limit };
  return response;
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

const ARXIV_COPY = /^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\/([a-z-]+(?:\.[A-Z]{2})?\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?$/iu;
export const arxivIdOf = (url: string | null): string | null => (url ? ARXIV_COPY.exec(url)?.[1] : undefined) ?? null;

export function parseOpenAlexWork(value: unknown, label = 'OpenAlex work'): OpenAlexWork {
  const work = requireRecord(value, label), openAccess = requireRecord(work.open_access, `${label}.open_access`);
  const best = optionalRecord(work.best_oa_location, `${label}.best_oa_location`), primary = optionalRecord(work.primary_location, `${label}.primary_location`);
  const title = nullableString(work.title, `${label}.title`) ?? nullableString(work.display_name, `${label}.display_name`);
  if (title === null || !title.trim()) throw new TypeError(`${label} has no title.`);
  if (typeof openAccess.is_oa !== 'boolean') throw new TypeError(`${label}.open_access.is_oa must be a boolean.`);
  if (work.is_retracted !== undefined && work.is_retracted !== null && typeof work.is_retracted !== 'boolean') throw new TypeError(`${label}.is_retracted must be a boolean.`);
  const authorships = requireArray(work.authorships ?? [], `${label}.authorships`);
  const authors = authorships.slice(0, 3).map((entry, index) => {
    const authorship = requireRecord(entry, `${label}.authorships[${index}]`), author = requireRecord(authorship.author, `${label}.authorships[${index}].author`);
    return nullableString(author.display_name, `${label}.authorships[${index}].author.display_name`) ?? nullableString(authorship.raw_author_name, `${label}.authorships[${index}].raw_author_name`) ?? 'unknown';
  });
  const licence = (best ? nullableString(best.license, `${label}.best_oa_location.license`) : null) ?? (primary ? nullableString(primary.license, `${label}.primary_location.license`) : null);
  const openAccessUrl = nullableString(openAccess.oa_url, `${label}.open_access.oa_url`)
    ?? (best ? nullableString(best.landing_page_url, `${label}.best_oa_location.landing_page_url`) ?? nullableString(best.pdf_url, `${label}.best_oa_location.pdf_url`) : null);
  const copies = requireArray(work.locations ?? [], `${label}.locations`).flatMap((entry, index) => {
    const location = requireRecord(entry, `${label}.locations[${index}]`);
    return [nullableString(location.landing_page_url, `${label}.locations[${index}].landing_page_url`), nullableString(location.pdf_url, `${label}.locations[${index}].pdf_url`)];
  });
  return { id: requireString(work.id, `${label}.id`), doi: nullableString(work.doi, `${label}.doi`), title: title.replace(/\s+/gu, ' ').trim(),
    year: nullableNumber(work.publication_year, `${label}.publication_year`), type: nullableString(work.type, `${label}.type`), authors, authorCount: authorships.length,
    licence, isOpenAccess: openAccess.is_oa, openAccessUrl, relevance: nullableNumber(work.relevance_score, `${label}.relevance_score`), abstract: abstractText(work.abstract_inverted_index, `${label}.abstract_inverted_index`),
    arxivId: [openAccessUrl, ...copies].map(arxivIdOf).find(id => id !== null) ?? null, retracted: work.is_retracted === true,
    references: requireArray(work.referenced_works ?? [], `${label}.referenced_works`).map((reference, index) => requireString(reference, `${label}.referenced_works[${index}]`)) };
}

export function parseOpenAlexResponse(value: unknown): readonly OpenAlexWork[] {
  const response = requireRecord(value, 'OpenAlex response');
  if (typeof response.error === 'string') throw new Error(`OpenAlex refused the query: ${response.error}${typeof response.message === 'string' ? ` (${response.message})` : ''}`);
  return requireArray(response.results, 'OpenAlex response results').map((work, index) => parseOpenAlexWork(work, `OpenAlex work ${index + 1}`));
}

/** The groups a work must name, each any one of its phrases: the target, its host, the instrument and the subject. */
const groups = (question: WorksQuestion, field = ''): string => [anyOf(question.names, field), ...question.hosts?.length ? [anyOf(question.hosts, field)] : [],
  ...question.instrument ? [anyOf([question.instrument], field)] : [], ...question.about?.length ? [anyOf(forms(question.about), field)] : []].join(' AND ');

/** Papers only. With host names "S2" means the star at Sgr A*; with `fulltext` the index's copy of the text is searched too. */
export function openAlexQuery(question: WorksQuestion): string {
  return `${OPENALEX_WORKS}?${new URLSearchParams({ filter: `${question.fulltext ? 'fulltext.search' : 'title_and_abstract.search'}:${groups(question)},type:article|review|preprint|letter`,
    'per-page': String(OPENALEX_PAGE), ...question.newestFirst ? { sort: 'publication_year:desc' } : {}, select: WORK_FIELDS })}`;
}
/** The works that cite any of the given ones, the newest first, each with what it cites. A list with no search costs 1 credit,
 * a tenth of a search, so the caller keeps the works that name the target itself. */
export function citingQuery(ids: readonly string[]): string {
  return `${OPENALEX_WORKS}?${new URLSearchParams({ filter: `cites:${ids.map(id => id.split('/').at(-1)!).join('|')}`,
    'per-page': String(OPENALEX_PAGE), sort: 'publication_year:desc', select: 'id,doi,title,display_name,publication_year,type,open_access,abstract_inverted_index,referenced_works' })}`;
}
/** arXiv's documented Atom API uses `all:` terms over its records, never the full text; exact matching is enforced locally. */
export function arxivQuery(question: WorksQuestion): string {
  return `${ARXIV_QUERY}?${new URLSearchParams({ search_query: groups(question, 'all:'), start: '0', max_results: String(ARXIV_PAGE), ...question.newestFirst ? { sortBy: 'submittedDate', sortOrder: 'descending' } : {} })}`;
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
      openAccessUrl: `https://arxiv.org/pdf/${arxivId}`, relevance: null, abstract, arxivId, retracted: false, references: [] };
  });
}

/** Whether a work's own title or abstract names everything the question asks for. */
export const confirms = (work: Pick<OpenAlexWork, 'title' | 'abstract'>, question: WorksQuestion): boolean => mentionsAny(work, question.names)
  && (!question.instrument || mentions(work, [question.instrument])) && (!question.hosts?.length || mentionsAny(work, question.hosts))
  && (!question.about?.length || mentionsAny(work, forms(question.about)));

/** Works whose title names a subject phrase first, then open access, OpenAlex relevance and the most recent year: the order in
 * which copies are fetched. */
export function rankWorks(works: readonly OpenAlexWork[], limit: number, about: readonly string[] = []): OpenAlexWork[] {
  const order = (value: number | null): number => value ?? Number.NEGATIVE_INFINITY, phrases = forms(about);
  const titled = (work: OpenAlexWork): number => Number(phrases.length > 0 && mentionsAny({ title: work.title, abstract: '' }, phrases));
  return [...works].sort((left, right) => titled(right) - titled(left) || Number(right.isOpenAccess) - Number(left.isOpenAccess)
    || order(right.relevance) - order(left.relevance) || order(right.year) - order(left.year)).slice(0, limit);
}

/** OpenAlex's own account of a request it turned down: a spent budget says when it returns. */
export async function openAlexIssue(response: Response, keyed: boolean): Promise<string> {
  const text = await response.text().catch(() => '');
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = undefined; }
  const seconds = typeof body === 'object' && body !== null && 'retryAfter' in body && typeof body.retryAfter === 'number' ? body.retryAfter : undefined;
  if (response.status !== 429 || seconds === undefined) return `OpenAlex returned HTTP ${response.status}.`;
  return `OpenAlex returned HTTP 429: the daily budget of ${keyed ? 'this API key' : 'this network, shared by everyone on it without an API key,'} is spent and returns in ${Math.floor(seconds / 3600)} h ${Math.round(seconds % 3600 / 60)} min`
    + `${keyed ? '' : '; a free key in OPENALEX_API_KEY has ten times the budget'}.`;
}

/**
 * Ask the indexes once. OpenAlex stems and matches loosely, so a work is kept only when its own title or abstract names what
 * was asked; a full-text answer is kept as the index gives it, because the words are in the text the caller reads next. After
 * OpenAlex has refused once in a session, the rest of the session asks arXiv directly: a refusal does not change until
 * midnight UTC.
 */
export async function findWorks(session: Session, question: WorksQuestion, progress: (line: string) => void = () => undefined): Promise<WorksAnswer> {
  let sourceIssue = session.refused;
  if (!sourceIssue) {
    let response: Response | undefined;
    try { response = await politeFetch(session, openAlexQuery(question), 'application/json'); }
    catch (error) { if (error instanceof RangeError) throw error; sourceIssue = `OpenAlex transport failed: ${error instanceof Error ? error.message : String(error)}`; }
    if (response?.ok) {
      const found = parseOpenAlexResponse(await response.json());
      return { source: 'openalex', query: openAlexQuery(question), returned: found.length, works: question.fulltext ? found : found.filter(work => confirms(work, question)) };
    }
    if (response) {
      if (response.status !== 429 && response.status < 500) { await response.body?.cancel(); throw new Error(`OpenAlex returned HTTP ${response.status}.`); }
      sourceIssue = await openAlexIssue(response, session.key !== undefined);
      if (response.status === 429) session.refused = sourceIssue;
    }
  }
  progress(`${sourceIssue} Searching arXiv${question.fulltext ? ', which reads titles and abstracts only' : ''}…`);
  const query = arxivQuery(question), fallback = await politeFetch(session, query, 'application/atom+xml');
  if (!fallback.ok) { await fallback.body?.cancel(); throw new Error(`${sourceIssue} arXiv returned HTTP ${fallback.status}.`); }
  const found = parseArxivResponse(await fallback.text());
  return { source: 'arxiv', sourceIssue: sourceIssue!, query, returned: found.length, works: found.filter(work => confirms(work, question)) };
}

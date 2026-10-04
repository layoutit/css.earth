/** Paper search for the telescope API: which published works name a target, what they say of it, and what was printed after them.
 *
 * The indexes are asked through `papers/works.mts` (OpenAlex, with arXiv as a bounded fallback) for works that name the target
 * by any spelling of its catalogue names, with an instrument, a host and any one of the subject phrases (`about`). Each
 * open-access copy is fetched once with a plain GET; a copy that is not HTML is read from the arXiv preprint's HTML rendering
 * when there is one. A browser challenge is recorded as `blocked` and never worked around. From an HTML full text the report
 * prints, verbatim, the figure captions and table titles that describe maps or list observations, and, when a subject or the
 * full-text index was asked for, the sentences that name it with the target.
 *
 * Before a paper's numbers are used, what followed it is read (`papers/follow-ups.mts`): each reported work is given the other
 * works published under its title (an erratum is printed that way), whether the index marks it retracted, and the later works
 * that cite it and name the target. Several targets at once are a sweep: one search each, no copies fetched. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { loadTargetCatalogue } from './query.mts';
import { resolveTarget } from '@cssearth/telescope';
import { LATER_NAMED, laterWorks, sameTitleQuery, sameTitleWorks, type LaterWork, type SameTitleWork } from './papers/follow-ups.mts';
import { forms, spellings } from './papers/names.mts';
import { UNREAD, evidenceSentences, mentions, mentionsAny, plainText } from './papers/text.mts';
import { OPENALEX_PAGE, arxivIdOf, citingQuery, confirms, findWorks, openAlexIssue, openSession, parseOpenAlexResponse, politeFetch, rankWorks, type IndexBudget, type OpenAlexWork, type Session, type WorksQuestion } from './papers/works.mts';

export const PAPERS_SCHEMA = 'cssearth-telescope-papers@1';
export const PAPERS_SWEEP_SCHEMA = 'cssearth-telescope-papers-sweep@1';
export const MAX_WORKS = 20;
/** One target: a search (and its arXiv fallback), a copy or two of each work, the citing works and a title lookup for each. */
export const MAX_REQUESTS = 2 + 2 * MAX_WORKS + 1 + MAX_WORKS;
/** Works named for each target of a sweep. */
export const SWEEP_NAMED = 5;
export const CAPTION_LIMIT = 300;
/** arXiv Labs' HTML rendering of arXiv's papers. Its robots.txt lets it be read; arXiv's own asks 15 s between pages (read 2026-10-04). */
export const AR5IV_HTML = 'https://ar5iv.labs.arxiv.org/html';

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
  /** The sentences of the fetched text that name a subject phrase (or, with none asked, the target), as printed. */
  readonly sentences?: readonly string[];
  /** A full-text search only: false when the work's own title and abstract do not name what was asked. */
  readonly namedInAbstract?: boolean;
  /** The index marks the work retracted. */
  readonly retracted?: true;
  /** Other works published under this title: an erratum is printed that way. */
  readonly sameTitle?: readonly SameTitleWork[];
  /** Later works that cite this one and name the target, the newest first, and how many there are. */
  readonly later?: readonly LaterWork[]; readonly laterCount?: number;
  /** evidenceScore of the fetched paper; the report is sorted by it. */
  readonly evidence?: number;
}
export interface PaperSearch {
  readonly schema: typeof PAPERS_SCHEMA; readonly target: { readonly id: string; readonly name: string };
  /** Every spelling the works were asked for. */
  readonly names: readonly string[];
  readonly instrument: string | null; readonly about?: readonly string[]; readonly fulltext?: true;
  readonly query: string; readonly source: 'openalex' | 'arxiv'; readonly sourceIssue?: string;
  readonly candidates: number; readonly requests: number;
  /** Host names a work had to mention besides the target: present for a body on a hosted orbit. */
  readonly hosts?: readonly string[];
  /** OpenAlex credits left for the day after this run, as it reported them. */
  readonly budget?: IndexBudget;
  /** What could not be read of the works' follow-ups, and why. */
  readonly issues?: readonly string[];
  readonly works: readonly PaperReport[];
}
export interface PaperSweep {
  readonly schema: typeof PAPERS_SWEEP_SCHEMA; readonly instrument: string | null; readonly about?: readonly string[]; readonly fulltext?: true;
  readonly requests: number; readonly budget?: IndexBudget;
  readonly targets: readonly { readonly target: { readonly id: string; readonly name: string }; readonly names: readonly string[]; readonly source: 'openalex' | 'arxiv';
    readonly sourceIssue?: string; readonly query: string; readonly candidates: number; readonly works: readonly { readonly year: number | null; readonly title: string; readonly doi: string | null }[] }[];
}
interface SearchSettings {
  readonly instrument?: string; readonly directory?: string;
  /** Subject phrases: a work must name any one of them ("Cepheid", "red supergiant"), singular or plural. */
  readonly about?: readonly string[];
  /** Ask the index for works whose full text names them, not only the title and abstract. */
  readonly fulltext?: boolean;
  readonly progress?: (line: string) => void; readonly fetcher?: typeof fetch;
  /** The wait between requests to one host (tests pass none) and the OpenAlex key (default: OPENALEX_API_KEY). */
  readonly pause?: (ms: number) => Promise<void>; readonly apiKey?: string;
}
export interface PaperSearchOptions extends SearchSettings {
  readonly target: string;
  /** A host name the works must also mention, for a name outside the catalogue; a catalogue body's host is found itself. */
  readonly host?: string;
}
export interface PaperSweepOptions extends SearchSettings { readonly targets: readonly string[] }

const trimCaption = (text: string): string => text.length <= CAPTION_LIMIT ? text : `${text.slice(0, CAPTION_LIMIT - 1).trimEnd()}…`;

const LABEL = /^(fig(?:ure)?\.?|table)\s*([A-Z]?\d+[A-Za-z]?)\s*[.:|]?/iu;
const LABEL_ONLY = /^(fig(?:ure)?\.?|table)\s*([A-Z]?\d+[A-Za-z]?)\s*[.:|]?$/iu;
/** A map, mosaic, radiance, scale or color bar, or a list of observations (orbit, time, distance). */
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
  const source = html.replace(/<!--[\s\S]*?-->/gu, '').replace(UNREAD, '');
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

/** The captions worth quoting: those that name a subject phrase when one was asked, else those about maps or observation lists. */
export function relevantCaptions(captions: readonly PaperCaption[], phrases: readonly string[] = []): PaperCaption[] {
  return captions.filter(caption => phrases.length ? mentionsAny({ title: caption.text, abstract: '' }, phrases) : CAPTION_TOPIC.test(caption.text));
}

const MAP_CAPTION = /\bmaps?\b|\bmapped\b|\bmosaics?\b|\bcolou?r[ -]?bars?\b|\bcolou?r scales?\b/iu;
const OBSERVATION_TABLE = /\borbits?\b|\bperijoves?\b|\bobservations?\b|\bdistances?\b|\bresolution\b/iu;
/** What a fetched paper shows it did: 3 per map or color-scale caption, 2 per table listing observations, 2 per sentence that
 * names the subject, 2 when the title names the instrument, and 1 when it names the target. Papers that made the product, or
 * speak of the subject, rise above ones that cite it. */
export function evidenceScore(report: Pick<PaperReport, 'title' | 'captions' | 'sentences'>, names: readonly string[], instrument: string | null): number {
  const captions = report.captions ?? [];
  return 3 * captions.filter(caption => MAP_CAPTION.test(caption.text)).length
    + 2 * captions.filter(caption => caption.kind === 'table' && OBSERVATION_TABLE.test(caption.text)).length
    + 2 * (report.sentences?.length ?? 0)
    + (instrument && mentions({ title: report.title, abstract: '' }, [instrument]) ? 2 : 0)
    + (mentionsAny({ title: report.title, abstract: '' }, names) ? 1 : 0);
}

const CHALLENGE_TITLE = /<title[^>]*>[^<]*(just a moment|client challenge|captcha|attention required|verify you are human|access denied|bot manager|are you a robot)/iu;
const CHALLENGE_BODY = /challenge-platform|cf-chl-|perfdrive\.com|_Incapsula_Resource|px-captcha/iu;
/** A challenge page is small and says so in its title or by Cloudflare's header. Full articles often embed the same
 * bot-management scripts (Nature does), so script names alone only count on a short page. */
export function isChallenge(headers: Pick<Headers, 'get'>, body: string): boolean {
  return headers.get('cf-mitigated') === 'challenge' || CHALLENGE_TITLE.test(body) || (body.length < 30_000 && CHALLENGE_BODY.test(body));
}

async function readFullText(url: string, session: Session): Promise<{ readonly access: FullTextAccess; readonly html?: string }> {
  let response: Response;
  try {
    response = await politeFetch(session, url, 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5');
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

/** The copy of a work that can be read as text: the open-access copy when it is HTML, else the arXiv preprint as ar5iv renders
 * it. The published text is preferred because the preprint may differ from it; an arXiv PDF is not fetched to be discarded. */
async function readCopy(work: OpenAlexWork, session: Session, progress: (line: string) => void): Promise<{ readonly access: FullTextAccess; readonly html?: string }> {
  const ownCopy = work.openAccessUrl !== null && arxivIdOf(work.openAccessUrl) === null ? work.openAccessUrl : null;
  if (ownCopy) progress(`  ${ownCopy}`);
  const published = ownCopy ? await readFullText(ownCopy, session) : undefined;
  if (published?.html !== undefined || published?.access.status === 'skipped' || work.arxivId === null) return published ?? { access: { status: 'closed', reason: 'no open-access copy listed' } };
  progress(`  ${AR5IV_HTML}/${work.arxivId}`);
  const rendered = await readFullText(`${AR5IV_HTML}/${work.arxivId}`, session);
  if (rendered.html !== undefined && /\bltx_document\b/u.test(rendered.html))
    return { access: { ...rendered.access, reason: `arXiv preprint ${work.arxivId} read as HTML (ar5iv); the published text may differ` }, html: rendered.html };
  if (rendered.access.status === 'skipped') return published ?? rendered;
  return published ?? { access: { status: 'fetchable', reason: `arXiv holds the PDF of ${work.arxivId}; ar5iv has no HTML rendering of it`, finalUrl: `https://arxiv.org/pdf/${work.arxivId}`, format: 'application/pdf' } };
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

interface Asked { readonly target: { readonly id: string; readonly name: string }; readonly names: string[]; readonly hosts: readonly string[] }
/** A catalogue body is asked for by its name and aliases, each in every spelling; any other name as written. */
async function asked(root: string, name: string, catalogue: Awaited<ReturnType<typeof loadTargetCatalogue>>, host?: string): Promise<Asked> {
  const target = displayName(name, catalogue);
  return { target, names: spellings([target.name, ...catalogue.find(entry => entry.id === target.id)?.aliases ?? []]), hosts: host?.trim() ? [host.trim()] : await hostNames(root, target.id, catalogue) };
}
const settings = (options: SearchSettings) => ({ instrument: options.instrument?.trim() || null, about: (options.about ?? []).map(phrase => phrase.trim()).filter(Boolean),
  progress: options.progress ?? (() => undefined) });
const said = (about: readonly string[], fulltext: boolean | undefined, instrument: string | null): string => `${instrument ? ` with ${instrument}` : ''}${about.length ? ` and ${about.join(' or ')}` : ''}${fulltext ? ' in the full text' : ''}`;

/** The other works under each title (Crossref) and the later works that cite the reported ones and name the target (OpenAlex,
 * one list for them all). */
async function followUps(works: readonly PaperReport[], names: readonly string[], source: PaperSearch['source'], session: Session, progress: (line: string) => void): Promise<{ readonly works: PaperReport[]; readonly issues: string[] }> {
  const issues: string[] = [], indexed = works.flatMap(work => work.openAlex ? [work.openAlex] : []);
  let citing: readonly OpenAlexWork[] = [];
  if (source === 'openalex' && indexed.length) {
    progress('Asking OpenAlex for the later works that cite these and name the target…');
    try {
      const response = await politeFetch(session, citingQuery(indexed), 'application/json');
      if (response.ok) {
        const body: unknown = await response.json(), count = requireRecord(requireRecord(body, 'OpenAlex response').meta ?? {}, 'OpenAlex response meta').count;
        citing = parseOpenAlexResponse(body).filter(work => mentionsAny(work, names));
        if (typeof count === 'number' && count > OPENALEX_PAGE) issues.push(`Later works: the newest ${OPENALEX_PAGE} of the ${count} works that cite these were read.`);
      }
      else issues.push(`Later works were not read: ${await openAlexIssue(response, session.key !== undefined)}`);
    } catch (error) { issues.push(`Later works were not read: ${error instanceof Error ? error.message : String(error)}.`); }
  } else if (indexed.length === 0 && works.length) issues.push('Later works were not read: arXiv does not record which works cite a paper.');
  progress('Asking Crossref what else was published under each title…');
  const followed: PaperReport[] = [];
  for (const work of works) {
    let sameTitle: SameTitleWork[] = [];
    try {
      const response = await politeFetch(session, sameTitleQuery(work.title), 'application/json');
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Crossref returned HTTP ${response.status}`); }
      sameTitle = sameTitleWorks(await response.json(), work);
    } catch (error) { issues.push(`Works under the title of "${work.title}" were not read: ${error instanceof Error ? error.message : String(error)}.`); }
    const later = work.openAlex ? laterWorks(citing, work.openAlex) : [];
    followed.push({ ...work, ...sameTitle.length ? { sameTitle } : {}, ...later.length ? { later: later.slice(0, LATER_NAMED), laterCount: later.length } : {} });
  }
  return { works: followed, issues };
}

export async function searchPapers(root: string, options: PaperSearchOptions): Promise<PaperSearch> {
  const session = openSession(MAX_REQUESTS, options), { instrument, about, progress } = settings(options);
  const catalogue = await loadTargetCatalogue(root), { target, names, hosts } = await asked(root, options.target, catalogue, options.host);
  const question: WorksQuestion = { names, instrument, hosts, about, ...options.fulltext ? { fulltext: true } : {} };
  progress(`Searching OpenAlex for ${target.name}${said(about, options.fulltext, instrument)}…`);
  const { source, sourceIssue, query, works: candidates } = await findWorks(session, question, progress);
  const ranked = rankWorks(candidates, MAX_WORKS, about), phrases = forms(about), quoting = phrases.length > 0 || options.fulltext === true;
  if (options.directory) await mkdir(resolve(options.directory, 'fulltext'), { recursive: true });
  const works: PaperReport[] = [];
  for (const [index, work] of ranked.entries()) {
    const rank = index + 1;
    const base = { rank, title: work.title, year: work.year, doi: work.doi, authors: work.authors, moreAuthors: work.authorCount > work.authors.length,
      licence: work.licence, openAccessUrl: work.openAccessUrl, ...(source === 'openalex' ? { openAlex: work.id } : { arxiv: work.id }),
      ...options.fulltext && source === 'openalex' ? { namedInAbstract: confirms(work, question) } : {}, ...work.retracted ? { retracted: true as const } : {} };
    progress(`${rank}/${ranked.length} ${work.title}`);
    const fetched = await readCopy(work, session, progress);
    if (fetched.html === undefined) { works.push({ ...base, access: fetched.access }); continue; }
    const extracted = extractCaptions(fetched.html);
    let savedFullText: string | undefined;
    if (options.directory) { savedFullText = resolve(options.directory, 'fulltext', `${index + 1}.html`); await writeFile(savedFullText, fetched.html); }
    works.push({ ...base, access: fetched.access, captionsScanned: extracted.scanned, captions: relevantCaptions(extracted.captions, phrases),
      ...quoting ? { sentences: evidenceSentences(fetched.html, names, phrases, mentionsAny({ title: work.title, abstract: '' }, names)) } : {}, ...(savedFullText ? { savedFullText } : {}) });
  }
  // Fetch order was the catalogue's guess; report order is what the papers turned out to contain.
  const scored = works.map((work, index) => ({ work, index, score: evidenceScore(work, names, instrument) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ work, score }, index) => ({ ...work, rank: index + 1, evidence: score }));
  const followed = await followUps(scored, names, source, session, progress);
  const result: PaperSearch = { schema: PAPERS_SCHEMA, target, names, instrument, ...about.length ? { about } : {}, ...options.fulltext ? { fulltext: true } : {}, source, ...(sourceIssue ? { sourceIssue } : {}),
    ...hosts.length ? { hosts } : {}, query, candidates: candidates.length, requests: session.used, ...session.budget ? { budget: session.budget } : {},
    ...followed.issues.length ? { issues: followed.issues } : {}, works: followed.works };
  if (options.directory) await writeFile(resolve(options.directory, 'papers.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** Several targets, one search each: which of them the literature names with the subject. No copy is fetched and nothing is
 * followed up; `searchPapers` does that for the targets a sweep finds works for. */
export async function sweepPapers(root: string, options: PaperSweepOptions): Promise<PaperSweep> {
  const session = openSession(2 * options.targets.length, options), { instrument, about, progress } = settings(options);
  const catalogue = await loadTargetCatalogue(root), targets: PaperSweep['targets'][number][] = [];
  for (const [index, name] of options.targets.entries()) {
    const { target, names, hosts } = await asked(root, name, catalogue);
    progress(`${index + 1}/${options.targets.length} ${target.name}${said(about, options.fulltext, instrument)}…`);
    const { source, sourceIssue, query, works } = await findWorks(session, { names, instrument, hosts, about, ...options.fulltext ? { fulltext: true } : {} }, progress);
    targets.push({ target, names, source, ...sourceIssue ? { sourceIssue } : {}, query, candidates: works.length,
      works: rankWorks(works, SWEEP_NAMED, about).map(work => ({ year: work.year, title: work.title, doi: work.doi })) });
  }
  const result: PaperSweep = { schema: PAPERS_SWEEP_SCHEMA, instrument, ...about.length ? { about } : {}, ...options.fulltext ? { fulltext: true } : {},
    requests: session.used, ...session.budget ? { budget: session.budget } : {}, targets };
  if (options.directory) { await mkdir(options.directory, { recursive: true }); await writeFile(resolve(options.directory, 'papers.json'), `${JSON.stringify(result, null, 2)}\n`); }
  return result;
}

const asking = (result: Pick<PaperSearch, 'instrument' | 'about' | 'fulltext'>): string => `${result.instrument ? ` · ${result.instrument}` : ''}${result.about ? ` · about ${result.about.join(' or ')}` : ''}${result.fulltext ? ' · full text' : ''}`;
const credits = (budget: IndexBudget | undefined): string[] => budget ? [`OpenAlex credits left today: ${budget.remaining} of ${budget.limit}; a search costs 10.`] : [];

export function formatPapers(result: PaperSearch, directory?: string): string {
  const lines = [`${result.target.name}${result.hosts ? ` at ${result.hosts[0]}` : ''}${asking(result)} · ${result.works.length} of ${result.candidates} matching ${result.source} works · ${result.requests} requests`,
    ...result.sourceIssue ? [`OpenAlex unavailable: ${result.sourceIssue} Searched arXiv instead${result.fulltext ? ', by title and abstract' : ''}.`] : [], ...credits(result.budget), ...result.issues ?? [], ''];
  for (const work of result.works) {
    const authors = `${work.authors.join(', ')}${work.moreAuthors ? ' et al.' : ''}`;
    lines.push(`${work.rank}. ${work.title} (${work.year ?? 'year unknown'})${work.evidence ? ` · evidence ${work.evidence}` : ''}`, `   ${authors}`,
      `   DOI: ${work.doi ?? 'none'} · licence: ${work.licence ?? 'unknown'}`,
      `   Open access: ${work.openAccessUrl ?? 'none'}`,
      `   Full text: ${work.access.status}${work.access.format ? ` (${work.access.format})` : ''} · ${work.access.reason}`);
    if (work.retracted) lines.push('   RETRACTED, by the index\'s record: do not use its results.');
    if (work.namedInAbstract === false) lines.push('   Its title and abstract do not name what was asked; the index found it in the full text.');
    for (const sentence of work.sentences ?? []) lines.push(`   “${sentence}”`);
    if (work.sentences && !work.sentences.length) lines.push(`   No sentence of the text read names ${result.about ? 'the subject with it' : 'it'}.`);
    if (work.captions) {
      if (!work.captions.length) lines.push(`   No ${result.about ? 'captions that name the subject' : 'map or observation captions'} among ${work.captionsScanned ?? 0} captions.`);
      // A caption that prints its own label is not given it twice.
      for (const caption of work.captions) lines.push(`   ${caption.label && caption.text.startsWith(caption.label) ? '' : `${caption.label ?? (caption.kind === 'table' ? 'Table' : 'Figure')}: `}${caption.text}`);
    }
    for (const other of work.sameTitle ?? []) lines.push(`   Also published under this title: ${other.doi} (${other.year ?? 'year unknown'}, ${other.type}). An erratum is printed this way: read it before using the numbers.`);
    if (work.later) lines.push(`   Later works that cite it and name ${result.target.name}: ${work.laterCount}${work.laterCount! > work.later.length ? `, the newest ${work.later.length}` : ''}`,
      ...work.later.map(later => `     ${later.year ?? '    '}  ${later.title}${later.doi ? `  ${later.doi}` : ''}`));
  }
  if (!result.works.length) lines.push(result.fulltext && result.source === 'openalex' ? 'No indexed full text names this.' : 'No works name this in their title or abstract.');
  if (directory) lines.push('', `Saved: ${resolve(directory, 'papers.json')}`);
  return `${lines.join('\n')}\n`;
}

export function formatSweep(result: PaperSweep, directory?: string): string {
  const lines = [`${result.targets.length} targets${asking(result)} · ${result.requests} requests`, ...credits(result.budget)];
  const issue = result.targets.find(entry => entry.sourceIssue)?.sourceIssue;
  if (issue) lines.push(`OpenAlex unavailable: ${issue} Targets marked arXiv were searched there${result.fulltext ? ', by title and abstract' : ''}.`);
  for (const entry of result.targets) lines.push('', `${entry.target.name}${entry.source === 'arxiv' ? ' (arXiv)' : ''} · ${entry.candidates ? `${entry.candidates} work${entry.candidates === 1 ? '' : 's'}${entry.candidates > entry.works.length ? `, ${entry.works.length} named` : ''}` : 'no work names it'}`,
    ...entry.works.map(work => `  ${work.year ?? '    '}  ${work.title}${work.doi ? `  ${work.doi}` : ''}`));
  if (directory) lines.push('', `Saved: ${resolve(directory, 'papers.json')}`);
  return `${lines.join('\n')}\n`;
}

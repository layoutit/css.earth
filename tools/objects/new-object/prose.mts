/** Quotes for the reader card and introduction, taken verbatim from the lead section of the body's English Wikipedia article.
 *
 * The generator writes no sentence of its own here: it fetches the article's summary (the lead, as the REST API serves it),
 * splits it into sentences and picks two, the first that names the body for the card and the next for the introduction. They
 * are cited as quotes of the article at its revision, under CC BY-SA 4.0, beside the short factual line drafted from the archive
 * numbers. A body with no article, or whose article is a disambiguation page or not about a star or planet, gets no quotes and
 * keeps its `TODO(new-object)` for a person. */
import type { Archive, Publication } from './archives.mts';
import { CHECKED } from './color.mts';
import type { DraftQuotes } from './spec.mts';

export const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
/** A citation quote's ceiling in the reader-text format (site/object-text.mts). */
export const QUOTE_BUDGET = 300;

export interface WikipediaLead { readonly title: string; readonly url: string; readonly revision: string; readonly extract: string; readonly description?: string }
export interface Quotes { readonly url: string; readonly title: string; readonly revision: string; readonly card?: string; readonly introduction?: string }

/** The lead of the article at `title`, or undefined when there is none, when it is a disambiguation page, or when neither its
 * description nor its lead says it is about a star, planet or brown dwarf. */
export async function wikipediaLead(archive: Archive, title: string): Promise<WikipediaLead | undefined> {
  const url = `${WIKIPEDIA_SUMMARY}${encodeURIComponent(title.trim().replace(/ /gu, '_'))}`;
  if (!await archive.exists(url)) return undefined;
  const summary = JSON.parse(await archive.text(url)) as { type?: string; title?: string; extract?: string; description?: string; revision?: string | number; content_urls?: { desktop?: { page?: string } } };
  if (summary.type !== 'standard' || typeof summary.extract !== 'string' || typeof summary.title !== 'string') return undefined;
  const about = `${summary.description ?? ''} ${summary.extract}`.toLowerCase();
  if (!/\b(star|planet|exoplanet|brown dwarf)\b/u.test(about)) return undefined;
  const page = summary.content_urls?.desktop?.page;
  if (typeof page !== 'string' || summary.revision === undefined) return undefined;
  return { title: summary.title, url: page, revision: String(summary.revision), extract: summary.extract, ...(summary.description ? { description: summary.description } : {}) };
}

/** The lead's sentences: split at a full stop, question or exclamation mark followed by a space and a capital, digit,
 * quote or bracket, except after "et al.", "etc.", "vs." or an initial, which leaves citations, names and decimals whole. */
export function sentences(extract: string): string[] {
  return extract.replace(/\s+/gu, ' ').trim().split(/(?<=[.!?])(?<!\bet al\.)(?<!\betc\.)(?<!\bvs\.)(?<!\b[A-Z]\.)\s+(?=["'(A-Z0-9])/u).map(s => s.trim()).filter(Boolean);
}

/** Two sentences of the lead, verbatim: the first that names the body (any of `names`, case-insensitively) for the card,
 * and the sentence after it for the introduction. Without a naming sentence, the lead's first two when the article is the
 * body's own (`mustName` false), and nothing when it is another body's article. Sentences over the quote budget are skipped. */
export function pickQuotes(extract: string, names: readonly string[], mustName = false): { card?: string; introduction?: string } {
  const all = sentences(extract).filter(s => s.length <= QUOTE_BUDGET), lower = names.map(n => n.toLowerCase());
  const at = all.findIndex(s => lower.some(n => s.toLowerCase().includes(n)));
  if (at < 0 && mustName) return {};
  const first = at >= 0 ? at : 0;
  return { ...(all[first] ? { card: all[first] } : {}), ...(all[first + 1] ? { introduction: all[first + 1] } : {}) };
}

/** Quotes for a body: its own article by `titles` in order (a planet's, then its host's, whose lead names the planet), or
 * none. */
export async function wikipediaQuotes(archive: Archive, titles: readonly string[], names: readonly string[]): Promise<Quotes | undefined> {
  for (const [index, title] of titles.entries()) {
    const lead = await wikipediaLead(archive, title);
    if (!lead) continue;
    // The body's own article is the first title, served under that title; a later title, or one that redirects (a planet's
    // name leading to its host's article), is another body's article and must name this one.
    const own = index === 0 && lead.title.toLowerCase() === title.trim().toLowerCase();
    const picked = pickQuotes(lead.extract, names, !own);
    if (!picked.card) continue;
    return { url: lead.url, title: lead.title, revision: lead.revision, ...picked };
  }
  return undefined;
}

/** The Wikipedia quote beside a drafted card or introduction, when the article gave one (prose.mts). */
export function quoteSource(quotes: DraftQuotes | undefined, key: 'card' | 'introduction', publications: ReadonlyMap<string, Publication>) {
  const quote = quotes?.[key];
  if (!quotes || !quote) return [];
  const record = publications.get(quotes.url);
  if (!record) throw new Error(`No publication record for the Wikipedia article ${quotes.url}.`);
  return [{ catalogueId: record.id, url: quotes.url, label: `Wikipedia, "${quotes.title}"`, checked: CHECKED, locator: `Lead section, revision ${quotes.revision}`, quote }];
}


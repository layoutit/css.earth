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
export function wikipediaLead(archive: Archive, title: string): Promise<WikipediaLead | undefined> {
  // One read per title and archive: a host's article is asked for by each of its planets.
  let cache = LEADS.get(archive);
  if (!cache) LEADS.set(archive, cache = new Map());
  let lead = cache.get(title.trim());
  if (!lead) cache.set(title.trim(), lead = readLead(archive, title));
  return lead;
}
const LEADS = new WeakMap<Archive, Map<string, Promise<WikipediaLead | undefined>>>();
async function readLead(archive: Archive, title: string): Promise<WikipediaLead | undefined> {
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
// The IAU's constellation abbreviations and genitives, and the Bayer letters as the archive abbreviates them (alf for Alpha).
const GENITIVE: Readonly<Record<string, string>> = { And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae',
  Boo: 'Bootis', Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris', Cap: 'Capricorni', Car: 'Carinae',
  Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae', Com: 'Comae Berenices', CrA: 'Coronae Australis',
  CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis', Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani',
  For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis',
  LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis', Mus: 'Muscae',
  Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', PsA: 'Piscis Austrini',
  Psc: 'Piscium', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli', Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis',
  Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii', Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris', Vel: 'Velorum',
  Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae' };
const GREEK: Readonly<Record<string, string>> = { alf: 'Alpha', bet: 'Beta', gam: 'Gamma', del: 'Delta', eps: 'Epsilon', zet: 'Zeta', eta: 'Eta', tet: 'Theta', iot: 'Iota',
  kap: 'Kappa', lam: 'Lambda', mu: 'Mu', nu: 'Nu', ksi: 'Xi', omi: 'Omicron', pi: 'Pi', rho: 'Rho', sig: 'Sigma', tau: 'Tau', ups: 'Upsilon', phi: 'Phi', chi: 'Chi', psi: 'Psi', ome: 'Omega' };
/** A catalogue name as Wikipedia titles it: "55 Cnc e" is "55 Cancri e", "eps Ind A" is "Epsilon Indi A", "HU Aqr" is "HU Aquarii". */
export function spelledOut(name: string): string {
  const match = /^(\S+) ([A-Z][A-Za-z]{2})\b(.*)$/u.exec(name.trim());
  const genitive = match && GENITIVE[match[2]!];
  if (!match || !genitive) return name;
  const letter = /^([a-z]+)(\d*)$/u.exec(match[1]!), greek = letter && GREEK[letter[1]!];
  return `${greek ? `${greek}${letter![2]}` : match[1]} ${genitive}${match[3]}`;
}

export async function wikipediaQuotes(archive: Archive, catalogueTitles: readonly string[], catalogueNames: readonly string[]): Promise<Quotes | undefined> {
  // Articles are titled with the constellation spelled out, and often a planet's letter against its star (Kepler-62f); a lead may
  // name the body any of these ways.
  const titles = catalogueTitles.map(spelledOut), joined = (name: string) => name.replace(/ ([a-z])$/u, '$1');
  const names = [...new Set(catalogueNames.flatMap(name => [name, spelledOut(name)]).flatMap(name => [name, joined(name)]))];
  const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gu, ''), host = titles[1] === undefined ? undefined : key(titles[1]);
  for (const [index, title] of titles.entries()) {
    const lead = await wikipediaLead(archive, title);
    if (!lead) continue;
    // The body's own article is the first title, served under that title (spacing aside) or under a longer name of the same
    // host ("55 Cancri e" is served as "55 Cancri Ae"); a later title, or a redirect to the host's article or to anything else,
    // is another body's article and must name this one.
    const served = key(lead.title), own = index === 0 && (served === key(title) || (host !== undefined && served !== host && served.startsWith(host)));
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


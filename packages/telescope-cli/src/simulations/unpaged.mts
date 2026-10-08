/** Planets with no page that a paper's title says have a phase curve or a map, for the leads: pages worth adding, because
 * each would be added with something to draw.
 *
 * Two bulk answers are set against each other, nothing asked planet by planet: the NASA Exoplanet Archive's list of planet
 * names (one request), and DataCite's arXiv records whose TITLE speaks of a phase curve or a map (a few pages). A planet of
 * the archive is unpaged when no object of the catalogue carries its name or an alias of it, compared without spaces,
 * hyphens or case. A planet this repository pages under a name the archive does not use is therefore listed too: the list is
 * read by a person, and a paper named here is a lead like any other, read before anything is drawn. */
import { requireString } from '@cssearth/core';
import { DATACITE_DOIS, parseDatacite, type TitledPaper, type UnpagedPlanet } from './leads.mts';
import { namesObject } from './simulations.mts';

export const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
/** What a title says when its paper holds a longitude map or the curve one is drawn from. */
export const TITLE_TERMS = ['phase curve', 'phase curves', 'phase variations', 'eclipse map', 'eclipse mapping', 'eclipse maps', 'brightness map', 'longitudinal map'];
const PAGE = 200, PAGES = 20, PACE_MS = 400, REQUEST_TIMEOUT_MS = 120_000, USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';

export interface ArchivePlanet { readonly name: string; readonly host: string }

/** A name as it is compared: letters and digits only, lower case. */
export const nameKey = (name: string) => name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '');

/** The archive's composite table as planets: `pl_name,hostname` rows of its CSV answer. */
export function parseArchivePlanets(csv: string): ArchivePlanet[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), cells = (line: string) => line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/u, '$1'));
  if (header === undefined || cells(header).join(',') !== 'pl_name,hostname') throw new TypeError(`The NASA Exoplanet Archive answered ${JSON.stringify((header ?? '').slice(0, 80))}, not a pl_name,hostname table.`);
  return lines.map((line, index) => { const [name, host] = cells(line); return { name: requireString(name, `archive row ${index + 1} pl_name`), host: requireString(host, `archive row ${index + 1} hostname`) }; });
}

export const titleQuery = (page = 1) => `${DATACITE_DOIS}?${new URLSearchParams({ query: `titles.title:(${TITLE_TERMS.map(term => `"${term}"`).join(' OR ')})`, 'client-id': 'arxiv.content', 'page[size]': String(PAGE), 'page[number]': String(page) })}`;

/** The planets without a page that a title names, the ones with the newest paper first. */
export function unpagedPlanets(planets: readonly ArchivePlanet[], paged: readonly string[], papers: readonly TitledPaper[]): UnpagedPlanet[] {
  const known = new Set(paged.map(nameKey));
  return planets.filter(planet => !known.has(nameKey(planet.name))).flatMap(planet => {
    const naming = papers.filter(paper => namesObject({ title: paper.title, description: '' }, [planet.name])).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return naming.length ? [{ ...planet, hostPaged: known.has(nameKey(planet.host)), papers: naming }] : [];
  }).sort((a, b) => (b.papers[0]!.year ?? 0) - (a.papers[0]!.year ?? 0) || a.name.localeCompare(b.name));
}

export interface UnpagedOptions { readonly fetcher?: typeof fetch; readonly wait?: (ms: number) => Promise<void> }
/** Ask both sources and set them against the names the catalogue pages. Returns the rows and the requests made. */
export async function searchUnpaged(paged: readonly string[], options: UnpagedOptions = {}): Promise<{ readonly planets: readonly UnpagedPlanet[]; readonly requests: number }> {
  const fetcher = options.fetcher ?? fetch, wait = options.wait ?? (ms => new Promise<void>(done => { setTimeout(done, ms); })), headers = { 'user-agent': USER_AGENT };
  const ask = async (url: string, accept: string) => { const response = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { ...headers, accept } }); if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}.`); return response; };
  const archive = parseArchivePlanets(await (await ask(`${NASA_TAP}?${new URLSearchParams({ query: 'select pl_name,hostname from pscomppars', format: 'csv' })}`, 'text/csv')).text());
  const papers: TitledPaper[] = [];
  let requests = 1;
  for (let page = 1; page <= PAGES; page++) {
    await wait(PACE_MS); requests++;
    const parsed = parseDatacite(await (await ask(titleQuery(page), 'application/vnd.api+json')).json(), 'paper');
    papers.push(...parsed.records.map(record => ({ year: record.year, title: record.title, url: record.url })));
    if (page >= parsed.pages) break;
  }
  return { planets: unpagedPlanets(archive, paged, papers), requests };
}

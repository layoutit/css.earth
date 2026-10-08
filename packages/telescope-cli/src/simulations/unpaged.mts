/** Planets with no page that would be added with something to draw, for the leads: one a paper's title says has a phase
 * curve or a map, or one the NASA Exoplanet Archive itself holds an eclipse of.
 *
 * Bulk answers are set against each other, nothing asked planet by planet: the archive's composite table of planets with its
 * occultation depth, the names in its emission-spectrum table (one request each), and DataCite's arXiv records whose TITLE
 * speaks of a phase curve or a map (a few pages). A planet of the archive is unpaged when no object of the catalogue carries
 * its name or an alias of it, compared without spaces, hyphens or case. A planet this repository pages under a name the
 * archive does not use is therefore listed too: the list is read by a person, and what is named here is a lead like any
 * other, read before anything is drawn. A catalogue paper that names its planets only in a table is not found this way. */
import { requireString } from '@cssearth/core';
import { DATACITE_DOIS, parseDatacite, type TitledPaper, type UnpagedPlanet } from './leads.mts';
import { namesObject } from './simulations.mts';

export const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
/** What a title says when its paper holds a longitude map or the curve one is drawn from. */
export const TITLE_TERMS = ['phase curve', 'phase curves', 'phase variations', 'eclipse map', 'eclipse mapping', 'eclipse maps', 'brightness map', 'longitudinal map'];
const PAGE = 200, PAGES = 20, PACE_MS = 400, REQUEST_TIMEOUT_MS = 120_000, USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';

export interface ArchivePlanet { readonly name: string; readonly host: string; /** The composite table gives it an occultation depth. */ readonly eclipseDepth: boolean }
const PLANETS_QUERY = 'select pl_name,hostname,pl_occdep from pscomppars', EMISSION_QUERY = 'select plntname from emissionspec';

/** A name as it is compared: letters and digits only, lower case. */
export const nameKey = (name: string) => name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '');

const cells = (line: string) => line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/u, '$1'));
/** A CSV answer of the archive with exactly these columns, as rows of cells; anything else is refused by its first line. */
function archiveRows(csv: string, columns: string): string[][] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header === undefined || cells(header).join(',') !== columns) throw new TypeError(`The NASA Exoplanet Archive answered ${JSON.stringify((header ?? '').slice(0, 80))}, not a ${columns} table.`);
  return lines.map(cells);
}
/** The archive's composite table as planets: `pl_name,hostname,pl_occdep` rows of its CSV answer. */
export function parseArchivePlanets(csv: string): ArchivePlanet[] {
  return archiveRows(csv, 'pl_name,hostname,pl_occdep').map(([name, host, depth], index) => ({ name: requireString(name, `archive row ${index + 1} pl_name`), host: requireString(host, `archive row ${index + 1} hostname`), eclipseDepth: Boolean(depth) }));
}

export const titleQuery = (page = 1) => `${DATACITE_DOIS}?${new URLSearchParams({ query: `titles.title:(${TITLE_TERMS.map(term => `"${term}"`).join(' OR ')})`, 'client-id': 'arxiv.content', 'page[size]': String(PAGE), 'page[number]': String(page) })}`;

/** The planets without a page that a title names or the archive holds an eclipse of: the titled ones first, the newest paper
 * first. `emission` is the planet names of the archive's emission-spectrum table. */
export function unpagedPlanets(planets: readonly ArchivePlanet[], paged: readonly string[], papers: readonly TitledPaper[], emission: readonly string[] = []): UnpagedPlanet[] {
  const known = new Set(paged.map(nameKey)), spectra = new Set(emission.map(nameKey));
  return planets.filter(planet => !known.has(nameKey(planet.name))).flatMap(planet => {
    const naming = papers.filter(paper => namesObject({ title: paper.title, description: '' }, [planet.name])).sort((a, b) => (b.year ?? 0) - (a.year ?? 0)), archiveEclipse = planet.eclipseDepth || spectra.has(nameKey(planet.name));
    return naming.length || archiveEclipse ? [{ name: planet.name, host: planet.host, hostPaged: known.has(nameKey(planet.host)), papers: naming, archiveEclipse }] : [];
  }).sort((a, b) => (b.papers[0]?.year ?? -1) - (a.papers[0]?.year ?? -1) || a.name.localeCompare(b.name));
}

export interface UnpagedOptions { readonly fetcher?: typeof fetch; readonly wait?: (ms: number) => Promise<void> }
/** Ask both sources and set them against the names the catalogue pages. Returns the rows and the requests made. */
export async function searchUnpaged(paged: readonly string[], options: UnpagedOptions = {}): Promise<{ readonly planets: readonly UnpagedPlanet[]; readonly requests: number }> {
  const fetcher = options.fetcher ?? fetch, wait = options.wait ?? (ms => new Promise<void>(done => { setTimeout(done, ms); })), headers = { 'user-agent': USER_AGENT };
  const ask = async (url: string, accept: string) => { const response = await fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { ...headers, accept } }); if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}.`); return response; };
  const table = async (query: string) => (await ask(`${NASA_TAP}?${new URLSearchParams({ query, format: 'csv' })}`, 'text/csv')).text();
  const archive = parseArchivePlanets(await table(PLANETS_QUERY)), emission = archiveRows(await table(EMISSION_QUERY), 'plntname').map(([name]) => name ?? '');
  const papers: TitledPaper[] = [];
  let requests = 2;
  for (let page = 1; page <= PAGES; page++) {
    await wait(PACE_MS); requests++;
    const parsed = parseDatacite(await (await ask(titleQuery(page), 'application/vnd.api+json')).json(), 'paper');
    papers.push(...parsed.records.map(record => ({ year: record.year, title: record.title, url: record.url })));
    if (page >= parsed.pages) break;
  }
  return { planets: unpagedPlanets(archive, paged, papers, emission), requests };
}

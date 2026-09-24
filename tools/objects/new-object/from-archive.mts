/** A spec for a planet host and its transiting planets, written from the NASA Exoplanet Archive `ps` table alone: each planet's
 * default parameter set (one paper, `pl_refname`) gives its orbit, radius and mass; the star's radius, temperature and mass come
 * from the same rows (`st_refname`), with Gaia DR3 FLAME where a row leaves them empty. Planets whose default row is not a transit
 * fit, or lacks the elements the orbit needs, are left out and named, so the README can say so. The card and introduction are
 * drafted from the row's numbers and cite the row's paper; a person edits them, or keeps them. */
import { archiveHostQuery, assembleArchiveOrbit, compositeMass, decodeEntities, NASA_TAP, parseArchiveRows } from './orbit.mts';
import type { Archive } from './archives.mts';
import { wikipediaQuotes } from './prose.mts';

const STAR_COLUMNS = 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag';
const slug = (name: string) => name.toLowerCase().replace(/\s+([a-z])$/u, '$1').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const short = (value: number, digits = 2) => Number(value.toPrecision(digits));
/** The first draft that fits the budget; the last is short by construction. */
const fit = (budget: number, ...drafts: string[]) => drafts.find(draft => draft.length <= budget) ?? drafts.at(-1)!;

interface StarRow { readonly planet: string; readonly host: string; readonly reference: string; readonly label: string; readonly url?: string; readonly rad?: number; readonly radErr?: number; readonly teff?: number; readonly teffErr?: number; readonly mass?: number; readonly massErr?: number; readonly dist?: number; readonly year?: number; readonly method: string; readonly transit: boolean }
function parseStarRows(csv: string): StarRow[] {
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== STAR_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header}.`);
  return lines.filter(line => split(line)[2] === '1').map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]), anchor = c[4]!;
    const label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1]?.replaceAll('%26', '&');
    return { planet: c[0]!, host: c[1]!, reference: /refstr=(\S+)/u.exec(anchor)?.[1] ?? label, label, ...(url ? { url } : {}), rad: n(5), radErr: n(6), teff: n(7), teffErr: n(8), mass: n(9), massErr: n(10), dist: n(11), year: n(12), method: c[13]!, transit: c[14] === '1' };
  });
}

export interface ArchiveSpecResult { readonly spec: Record<string, unknown>; readonly skipped: readonly string[]; readonly notes: readonly string[] }

/** The spec entry for one host: its transiting planets on their default rows. `existing` ids are not generated again. */
export async function archiveSpec(archive: Archive, hostname: string, existing: (id: string) => boolean): Promise<ArchiveSpecResult> {
  const text = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select ${STAR_COLUMNS} from ps where hostname = '${hostname.replaceAll("'", "''")}'`, format: 'csv' })}`);
  const rows = parseStarRows(text);
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no default parameter set for a host named ${hostname}.`);
  const hostId = slug(hostname), skipped: string[] = [], notes: string[] = [];
  // Quotes from the Wikipedia lead (prose.mts): a planet's own article first, then its host's, whose lead names the planet.
  const quotesFor = async (titles: string[], names: string[]) => { const quotes = await wikipediaQuotes(archive, titles, names.filter(Boolean)); if (!quotes) notes.push(`${titles[0]}: no Wikipedia lead to quote`); return quotes ? { quotes } : {}; };
  if (!/^[a-z]/u.test(hostId)) throw new Error(`${hostname}: its id ${hostId} would not start with a letter; give this host a spec by hand.`);
  const orbitRows = parseArchiveRows(await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveHostQuery(hostname), format: 'csv' })}`));
  const cite = (row: StarRow) => `${row.label}, the default parameter set of ${row.planet} in the NASA Exoplanet Archive`;
  const found: { period: number; entry: Record<string, unknown> }[] = [];
  for (const row of rows) {
    const id = slug(row.planet), planetRows = orbitRows.filter(entry => entry.name === row.planet);
    if (!row.transit) { skipped.push(`${row.planet}: found by ${row.method.toLowerCase()}, not a transit fit`); continue; }
    // A TESS or Kepler candidate designation (".01") is not a confirmed planet name; the title mark refuses it too.
    if (/\.\d+$/u.test(row.planet)) { skipped.push(`${row.planet}: a candidate designation, not a confirmed planet name`); continue; }
    if (existing(id)) { notes.push(`${row.planet} is already in the universe as ${id}`); continue; }
    let assembled;
    try { assembled = assembleArchiveOrbit(planetRows, undefined, await compositeMass(archive, row.planet)); } catch (error) { skipped.push((error as Error).message.replace(/\.$/u, '')); continue; }
    const period = assembled.orbit.periodDays, year = row.year ? `, found in ${row.year}` : '', radius = assembled.radius.value, mass = assembled.mass.value;
    const size = radius >= 0.3 ? `${short(radius)} Jupiter radii` : `${short(radius * 71492 / 6371)} Earth radii`;
    const defaultRow = planetRows.find(entry => entry.isDefault)!;
    found.push({ period, entry: { id, name: row.planet, description: `Transiting planet of ${hostname} with a ${short(period, 3)}-day year${year}.`,
      paper: { url: row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: row.label },
      orbit: { archive: 'nasa-ps', reference: defaultRow.reference },
      text: { card: `${row.planet} crosses its star every ${short(period, 3)} days and is ${size} across${year}.`,
        introduction: fit(180, `${row.planet} transits ${hostname} every ${short(period, 3)} days and is ${size} across. Orbit and size follow ${row.label}'s fit, the archive's default.`,
          `${row.planet}: a ${short(period, 3)}-day orbit, ${size} across. Orbit and size follow ${row.label}'s fit, the archive's default.`),
        locator: `NASA Exoplanet Archive ps table, default parameter set (pl_refname ${defaultRow.reference}): pl_orbper ${period}, pl_radj ${radius}, pl_bmassj ${mass}`,
        ...await quotesFor([row.planet, hostname], [row.planet]) } } });
  }
  // Planets in order of their period, innermost first, however the archive lists them.
  const planets = found.sort((a, b) => a.period - b.period).map(item => item.entry);
  const star = rows.find(row => row.planet === planets[0]?.name) ?? rows[0]!;
  if (star.teff === undefined) throw new Error(`${hostname}: the archive's default rows give no stellar temperature; give this host a spec by hand.`);
  const cited = (value: number | undefined, err: number | undefined, key: string) => value === undefined ? 'gaia-flame' : { value, ...(err ? { uncertainty: err } : {}), source: `${star.label}, the stellar ${key} of ${cite(star).split(', ')[1]}`, url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  const n = planets.length, dist = star.dist === undefined ? '' : ` ${short(star.dist, 3)} parsecs away`;
  if (existing(hostId)) notes.push(`${hostname} is already in the universe as ${hostId}`);
  const entry = existing(hostId) ? { host: hostId, planets, notes: skipped } : {
    id: hostId, name: hostname, description: `Star of ${Math.round(star.teff).toLocaleString('en-US')} K${dist} with ${n} transiting planet${n === 1 ? '' : 's'}.`,
    target: hostname, paper: { url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: star.label },
    radius: cited(star.rad, star.radErr, 'radius'), temperature: { value: star.teff, ...(star.teffErr ? { uncertainty: star.teffErr } : {}), source: `${star.label}, the stellar temperature of ${cite(star).split(', ')[1]}`, url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' },
    mass: cited(star.mass, star.massErr, 'mass'),
    text: { card: `${hostname} is a ${Math.round(star.teff).toLocaleString('en-US')} K star${dist} with ${n} known transiting planet${n === 1 ? '' : 's'}.`,
      introduction: fit(180, `${hostname} is a star of ${Math.round(star.teff).toLocaleString('en-US')} K${dist}. ${n === 1 ? `Its planet ${String((planets[0] as { name: string }).name)} crosses it` : `Its planets ${planets.map(p => String((p as { name: string }).name).replace(`${hostname} `, '')).join(', ')} cross it`}, which is how ${n === 1 ? 'it was' : 'they were'} found and sized.`,
        `${hostname} is a star of ${Math.round(star.teff).toLocaleString('en-US')} K${dist}. Its ${n} transiting planet${n === 1 ? '' : 's'} were found and sized as ${n === 1 ? 'it crosses' : 'they cross'} it.`),
      locator: `NASA Exoplanet Archive ps table, default parameter set of ${star.planet} (st_refname ${star.reference}): st_teff ${star.teff}${star.rad !== undefined ? `, st_rad ${star.rad}` : ''}${star.mass !== undefined ? `, st_mass ${star.mass}` : ''}`,
      ...await quotesFor([hostname], [hostname]) },
    planets, notes: skipped };
  if (!n) notes.push(`${hostname}: none of its planets has a transit fit with the elements an orbit needs`);
  return { spec: entry, skipped, notes };
}

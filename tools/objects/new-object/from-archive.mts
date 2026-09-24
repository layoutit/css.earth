/** A spec for a planet host and its transiting planets, written from the NASA Exoplanet Archive `ps` table alone: each planet's
 * default parameter set (one paper, `pl_refname`) gives its orbit, radius and mass; the star's radius, temperature and mass come
 * from the same rows (`st_refname`), with Gaia DR3 FLAME where a row leaves them empty. Planets whose default row is not a transit
 * fit, or lacks the elements the orbit needs, are left out and named, so the README can say so. The card and introduction are
 * drafted from the row's numbers and cite the row's paper; a person edits them, or keeps them. */
import { archiveHostQuery, assembleArchiveOrbit, compositeMass, decodeEntities, NASA_TAP, parseArchiveRows } from './orbit.mts';
import type { Archive } from './archives.mts';
import { duplicateName, hostId as idForHost, planetId, planetPrefix, type Existing } from './identity.mts';
import { wideCompanions } from './companions.mts';
import { wikipediaQuotes } from './prose.mts';
import { thermalFromArchive } from './planet-lenses.mts';

const STAR_COLUMNS = 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum';
const short = (value: number, digits = 2) => Number(value.toPrecision(digits));
/** The first draft that fits the budget; the last is short by construction. */
const fit = (budget: number, ...drafts: string[]) => drafts.find(draft => draft.length <= budget) ?? drafts.at(-1)!;

interface StarRow { readonly isDefault: boolean; readonly refYear: number; readonly circumbinary: boolean; readonly stars: number; readonly letter: string; readonly hd?: string; readonly hip?: string; readonly gaiaDr3?: string; readonly planet: string; readonly host: string; readonly reference: string; readonly label: string; readonly url?: string; readonly rad?: number; readonly radErr?: number; readonly teff?: number; readonly teffErr?: number; readonly mass?: number; readonly massErr?: number; readonly dist?: number; readonly year?: number; readonly method: string; readonly transit: boolean }
function parseStarRows(csv: string): StarRow[] {
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== STAR_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header}.`);
  return lines.filter(line => line.trim()).map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]), anchor = c[4]!;
    const label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1]?.replaceAll('%26', '&');
    const text = (i: number) => c[i]?.trim() || undefined, gaia = /(\d{6,})/u.exec(c[18] ?? '')?.[1];
    return { isDefault: c[2] === '1', refYear: Number(/abs\/(\d{4})/u.exec(url ?? '')?.[1]) || 0, circumbinary: c[19] === '1', stars: Number(c[20]) || 1, letter: c[15] ?? '', ...(text(16) ? { hd: text(16)! } : {}), ...(text(17) ? { hip: text(17)! } : {}), ...(gaia ? { gaiaDr3: gaia } : {}), planet: c[0]!, host: c[1]!, reference: /refstr=(\S+)/u.exec(anchor)?.[1] ?? label, label, ...(url ? { url } : {}), rad: n(5), radErr: n(6), teff: n(7), teffErr: n(8), mass: n(9), massErr: n(10), dist: n(11), year: n(12), method: c[13]!, transit: c[14] === '1' };
  });
}

export interface ArchiveSpecResult { readonly spec: Record<string, unknown>; readonly skipped: readonly string[]; readonly notes: readonly string[];
  /** The host's bound wide companions, as placed stars of its system (companions.mts). */
  readonly companions: readonly Record<string, unknown>[] }

/** The spec entry for one host: its transiting planets on their default rows. A body the universe already holds (by id or by name,
 * identity.mts) is not generated again; a host it holds becomes a host addition. */
export async function archiveSpec(archive: Archive, hostname: string, universe: Existing): Promise<ArchiveSpecResult> {
  const text = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select ${STAR_COLUMNS} from ps where hostname = '${hostname.replaceAll("'", "''")}'`, format: 'csv' })}`);
  // The default row of each planet; every row stays for a stellar value the default row leaves empty.
  const all = parseStarRows(text), rows = all.filter(row => row.isDefault);
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no default parameter set for a host named ${hostname}.`);
  // A planet around both stars of a pair needs the pair's orbit, which only a paper gives: built by hand, as Kepler-16 is.
  if (rows.some(row => row.circumbinary)) throw new Error(`${hostname}: its planets orbit both stars of a pair (circumbinary); the pair's orbit comes from a paper, so build it by hand as Kepler-16 is.`);
  const first = rows[0]!, prefix = planetPrefix(first.planet, first.letter);
  // The host as the universe knows it, by id or name; else its id by the rule (identity.mts).
  const known = [hostname, prefix].flatMap(name => name ? [duplicateName(universe, name)] : []).find(Boolean);
  const hostId = known ?? idForHost({ ...(prefix ? { planetPrefix: prefix } : {}), hostname, ...(first.hd ? { hd: first.hd } : {}), ...(first.hip ? { hip: first.hip } : {}), ...(first.gaiaDr3 ? { gaiaDr3: `Gaia DR3 ${first.gaiaDr3}` } : {}) });
  const skipped: string[] = [], notes: string[] = [], existing = (id: string) => universe.ids.has(id);
  // Quotes from the Wikipedia lead (prose.mts): a planet's own article first, then its host's, whose lead names the planet.
  const quotesFor = async (titles: string[], names: string[]) => { const quotes = await wikipediaQuotes(archive, titles, names.filter(Boolean)); if (!quotes) notes.push(`${titles[0]}: no Wikipedia lead to quote`); return quotes ? { quotes } : {}; };
  const orbitRows = parseArchiveRows(await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveHostQuery(hostname), format: 'csv' })}`));
  const found: { period: number; entry: Record<string, unknown> }[] = [];
  for (const row of rows) {
    const id = planetId(hostId, row.letter), planetRows = orbitRows.filter(entry => entry.name === row.planet), held = duplicateName(universe, row.planet);
    if (!row.transit) { skipped.push(`${row.planet}: found by ${row.method.toLowerCase()}, not a transit fit`); continue; }
    // A TESS or Kepler candidate designation (".01") is not a confirmed planet name; the title mark refuses it too.
    if (/\.\d+$/u.test(row.planet)) { skipped.push(`${row.planet}: a candidate designation, not a confirmed planet name`); continue; }
    if (existing(id) || held) { notes.push(`${row.planet} is already in the universe as ${held ?? id}`); continue; }
    let assembled;
    try { assembled = assembleArchiveOrbit(planetRows, undefined, await compositeMass(archive, row.planet)); } catch (error) { skipped.push((error as Error).message.replace(/\.$/u, '')); continue; }
    const period = assembled.orbit.periodDays, year = row.year ? `, found in ${row.year}` : '', radius = assembled.radius.value, mass = assembled.mass.value;
    const size = radius >= 0.3 ? `${short(radius)} Jupiter radii` : `${short(radius * 71492 / 6371)} Earth radii`;
    const defaultRow = planetRows.find(entry => entry.isDefault)!;
    // A measured dayside temperature in the archive's emission table gives the planet its thermal colour (planet-lenses.mts).
    const { thermal } = await thermalFromArchive(archive, row.planet);
    if (!thermal) notes.push(`${row.planet}: no measured dayside brightness temperature in the archive's emission table; its gray takes the host's light`);
    found.push({ period, entry: { id, name: row.planet, ...(thermal ? { thermal } : {}), description: `Transiting planet of ${hostname} with a ${short(period, 3)}-day year${year}.`,
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
  // Each stellar value from the star's default row, else from the newest other row that gives it, cited to that row (as orbits are).
  const others = all.filter(row => row !== star).sort((a, b) => b.refYear - a.refYear);
  const pick = (key: 'teff' | 'rad' | 'mass', err: 'teffErr' | 'radErr' | 'massErr') => { const row = star[key] !== undefined ? star : others.find(entry => entry[key] !== undefined); return row ? { value: row[key]!, err: row[err], row } : undefined; };
  const teff = pick('teff', 'teffErr'), rad = pick('rad', 'radErr'), mass = pick('mass', 'massErr');
  if (!teff) throw new Error(`${hostname}: no archive row gives a stellar temperature; give this host a spec by hand.`);
  const from = (row: StarRow) => row === star ? `the default parameter set of ${row.planet}` : `${row.planet}'s parameter set from ${row.label} (the default leaves it empty)`;
  const cited = (picked: ReturnType<typeof pick>, key: string) => picked === undefined ? 'gaia-flame' as const : { value: picked.value, ...(picked.err ? { uncertainty: picked.err } : {}), source: `${picked.row.label}, the stellar ${key} of ${from(picked.row)} in the NASA Exoplanet Archive`, url: picked.row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  const n = planets.length, dist = star.dist === undefined ? '' : ` ${short(star.dist, 3)} parsecs away`;
  if (existing(hostId)) notes.push(`${hostname} is already in the universe as ${hostId}`);
  const entry = existing(hostId) ? { host: hostId, planets, notes: skipped } : {
    // The host is named as its planets name it (pi Men for pi Men c), the archive's host name when they match.
    id: hostId, name: prefix ?? hostname, system: `${(prefix ?? hostname).replace(/\s+A$/u, '')} system`, description: `Star of ${Math.round(teff.value).toLocaleString('en-US')} K${dist} with ${n} transiting planet${n === 1 ? '' : 's'}.`,
    target: hostname, ...(star.gaiaDr3 ? { gaia: star.gaiaDr3 } : {}), paper: { url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: star.label },
    radius: cited(rad, 'radius'), temperature: cited(teff, 'temperature'), mass: cited(mass, 'mass'),
    text: { card: `${hostname} is a ${Math.round(teff.value).toLocaleString('en-US')} K star${dist} with ${n} known transiting planet${n === 1 ? '' : 's'}.`,
      introduction: fit(180, `${hostname} is a star of ${Math.round(teff.value).toLocaleString('en-US')} K${dist}. ${n === 1 ? `Its planet ${String((planets[0] as { name: string }).name)} crosses it` : `Its planets ${planets.map(p => String((p as { name: string }).name).replace(`${hostname} `, '')).join(', ')} cross it`}, which is how ${n === 1 ? 'it was' : 'they were'} found and sized.`,
        `${hostname} is a star of ${Math.round(teff.value).toLocaleString('en-US')} K${dist}. Its ${n} transiting planet${n === 1 ? '' : 's'} were found and sized as ${n === 1 ? 'it crosses' : 'they cross'} it.`),
      locator: `NASA Exoplanet Archive ps table (st_refname ${[...new Set([teff, rad, mass].flatMap(picked => picked ? [picked.row.reference] : []))].join(', ')}): st_teff ${teff.value}${rad ? `, st_rad ${rad.value}` : ''}${mass ? `, st_mass ${mass.value}` : ''}`,
      ...await quotesFor([hostname], [hostname]) },
    planets, notes: skipped };
  if (!n) notes.push(`${hostname}: none of its planets has a transit fit with the elements an orbit needs`);
  // The other stars of a multiple system: the wide ones Gaia separates, from El-Badry et al. (2021); the rest are named as missing.
  let companions: Record<string, unknown>[] = [];
  if (star.stars > 1 && star.gaiaDr3) {
    const system = existing(hostId) ? universe.systems?.get(hostId) ?? `${prefix ?? hostname} system` : String((entry as { system?: string }).system);
    const found = await wideCompanions(archive, { gaia: star.gaiaDr3, name: prefix ?? hostname, system }, (gaia, name) => universe.gaia?.get(gaia) ?? duplicateName(universe, name));
    companions = found.companions; notes.push(...found.notes);
    const missing = star.stars - 1 - found.companions.length - found.notes.filter(note => note.includes('already in the universe')).length;
    if (missing > 0) notes.push(`${hostname}: a ${star.stars}-star system; ${missing} of its other stars ${missing === 1 ? 'is' : 'are'} too close to it for Gaia to separate, or not in the wide-binary catalogue, and ${missing === 1 ? 'is' : 'are'} not added`);
  }
  return { spec: entry, skipped, notes, companions };
}

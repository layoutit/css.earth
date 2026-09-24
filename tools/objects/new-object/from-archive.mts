/** A spec for a planet host and its transiting planets, written from the NASA Exoplanet Archive `ps` table alone: each planet's
 * default parameter set (one paper, `pl_refname`) gives its orbit, radius and mass; the star's radius, temperature and mass come
 * from the same rows (`st_refname`), with Gaia DR3 FLAME where every row leaves the radius or mass empty and TIC v8.2 where every
 * row leaves the temperature empty. Planets whose default row is not a transit fit, or lacks the elements the orbit needs, are left
 * out and named, so the README can say so; a host left with no planet to add is left out, not drafted as a lone star. A host the
 * universe holds is found by the Gaia DR3 source its position cites, then by name. The card and introduction are
 * drafted from the row's numbers and cite the row's paper; a person edits them, or keeps them. */
import { archiveHostQuery, assembleArchiveOrbit, compositeMass, decodeEntities, NASA_TAP, parseArchiveRows } from './orbit.mts';
import type { Archive } from './archives.mts';
import { duplicateName, hostId as idForHost, planetId, planetPrefix, type Existing } from './identity.mts';
import { TIC, ticRow, wideCompanions } from './companions.mts';
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
  // The star rows and the orbit rows are read at once: each NASA TAP answer takes about a second.
  const [text, orbitText] = await Promise.all([archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select ${STAR_COLUMNS} from ps where hostname = '${hostname.replaceAll("'", "''")}'`, format: 'csv' })}`),
    archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveHostQuery(hostname), format: 'csv' })}`)]);
  // The default row of each planet; every row stays for a stellar value the default row leaves empty.
  const all = parseStarRows(text), rows = all.filter(row => row.isDefault);
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no default parameter set for a host named ${hostname}.`);
  // A planet around both stars of a pair needs the pair's orbit, which only a paper gives: built by hand, as Kepler-16 is.
  if (rows.some(row => row.circumbinary)) throw new Error(`${hostname}: its planets orbit both stars of a pair (circumbinary); the pair's orbit comes from a paper, so build it by hand as Kepler-16 is.`);
  const first = rows[0]!, prefix = planetPrefix(first.planet, first.letter);
  // The host as the universe knows it, by id or name; else its id by the rule (identity.mts).
  // By the Gaia DR3 source its position cites first: the universe may name it otherwise (eps Indi A for the archive's eps Ind A).
  const known = (first.gaiaDr3 ? universe.gaia?.get(first.gaiaDr3) : undefined) ?? [hostname, prefix].flatMap(name => name ? [duplicateName(universe, name)] : []).find(Boolean);
  const hostId = known ?? idForHost({ ...(prefix ? { planetPrefix: prefix } : {}), hostname, ...(first.hd ? { hd: first.hd } : {}), ...(first.hip ? { hip: first.hip } : {}), ...(first.gaiaDr3 ? { gaiaDr3: `Gaia DR3 ${first.gaiaDr3}` } : {}) });
  const skipped: string[] = [], notes: string[] = [], existing = (id: string) => universe.ids.has(id);
  // Quotes from the Wikipedia lead (prose.mts): a planet's own article first, then its host's, whose lead names the planet.
  const quotesFor = async (titles: string[], names: string[]) => { const quotes = await wikipediaQuotes(archive, titles, names.filter(Boolean)); if (!quotes) notes.push(`${titles[0]}: no Wikipedia lead to quote`); return quotes ? { quotes } : {}; };
  const orbitRows = parseArchiveRows(orbitText);
  type Found = { period: number; planet: string; entry: Record<string, unknown> };
  const found: Found[] = [];
  // Each planet's archive reads run at once; what they report keeps the archive's row order.
  const drafted = await Promise.all(rows.map(async (row): Promise<{ skip?: string; note: string[]; found?: Found }> => {
    // A confirmed planet the archive still lists by its TESS or Kepler number ("TOI-406.01", letter b) is named by its host and the
    // archive's letter; the archive's name stays the one its tables are asked by. A bare candidate number without a letter is refused.
    const listed = /\.\d+$/u.test(row.planet), name = listed ? `${hostname} ${row.letter}` : row.planet;
    const id = planetId(hostId, row.letter), planetRows = orbitRows.filter(entry => entry.name === row.planet), note: string[] = [];
    const held = duplicateName(universe, row.planet) ?? duplicateName(universe, name);
    if (!row.transit) return { skip: `${row.planet}: found by ${row.method.toLowerCase()}, not a transit fit`, note };
    if (listed && !/^[a-z]$/u.test(row.letter)) return { skip: `${row.planet}: a candidate designation with no planet letter in the archive`, note };
    if (listed) note.push(`${name}: listed in the NASA Exoplanet Archive as ${row.planet}; named by its host and the archive's letter ${row.letter}`);
    if (existing(id) || held) return { note: [`${name} is already in the universe as ${held ?? id}`] };
    const [composite, { thermal }] = await Promise.all([compositeMass(archive, row.planet), thermalFromArchive(archive, row.planet)]);
    let assembled;
    try { assembled = assembleArchiveOrbit(planetRows, undefined, composite); } catch (error) { return { skip: (error as Error).message.replace(/\.$/u, ''), note }; }
    const period = assembled.orbit.periodDays, year = row.year ? `, found in ${row.year}` : '', radius = assembled.radius.value, mass = assembled.mass.value;
    const size = radius >= 0.3 ? `${short(radius)} Jupiter radii` : `${short(radius * 71492 / 6371)} Earth radii`;
    const defaultRow = planetRows.find(entry => entry.isDefault)!;
    // A measured dayside temperature in the archive's emission table gives the planet its thermal colour (planet-lenses.mts).
    if (!thermal) note.push(`${name}: no measured dayside brightness temperature in the archive's emission table; its gray takes the host's light`);
    const quotes = await wikipediaQuotes(archive, [name, hostname], [name, row.planet]);
    if (!quotes) note.push(`${name}: no Wikipedia lead to quote`);
    return { note, found: { period, planet: row.planet, entry: { id, name, ...(thermal ? { thermal } : {}), description: `Transiting planet of ${hostname} with a ${short(period, 3)}-day year${year}.`,
      paper: { url: row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: row.label },
      orbit: { archive: 'nasa-ps', reference: defaultRow.reference, ...(listed ? { planetName: row.planet } : {}) },
      text: { card: `${name} crosses its star every ${short(period, 3)} days and is ${size} across${year}.`,
        introduction: fit(180, `${name} transits ${hostname} every ${short(period, 3)} days and is ${size} across. Orbit and size follow ${row.label}'s fit, the archive's default.`,
          `${name}: a ${short(period, 3)}-day orbit, ${size} across. Orbit and size follow ${row.label}'s fit, the archive's default.`),
        locator: `NASA Exoplanet Archive ps table, default parameter set (pl_refname ${defaultRow.reference}): pl_orbper ${period}, pl_radj ${radius}, pl_bmassj ${mass}`,
        ...(quotes ? { quotes } : {}) } } } };
  }));
  for (const result of drafted) { if (result.skip) skipped.push(result.skip); notes.push(...result.note); if (result.found) found.push(result.found); }
  // Planets in order of their period, innermost first, however the archive lists them.
  const sorted = found.sort((a, b) => a.period - b.period), planets = sorted.map(item => item.entry);
  // A host with no planet to add is not drafted: a star alone is not what an archive draft is for.
  if (!planets.length) throw new Error(`${hostname}: no planet to add; ${[...skipped, ...notes.filter(note => note.includes('already in the universe'))].join('; ') || 'the archive lists none'}.`);
  const star = rows.find(row => row.planet === sorted[0]?.planet) ?? rows[0]!;
  // Each stellar value from the star's default row, else from the newest other row that gives it, cited to that row (as orbits are).
  const others = all.filter(row => row !== star).sort((a, b) => b.refYear - a.refYear);
  const pick = (key: 'teff' | 'rad' | 'mass', err: 'teffErr' | 'radErr' | 'massErr') => { const row = star[key] !== undefined ? star : others.find(entry => entry[key] !== undefined); return row ? { value: row[key]!, err: row[err], row } : undefined; };
  const teff = pick('teff', 'teffErr'), rad = pick('rad', 'radErr'), mass = pick('mass', 'massErr');
  // No archive row gives a temperature: the TESS Input Catalog v8.2's for the same Gaia source, as wide companions take theirs.
  const tic = teff || !star.gaiaDr3 ? undefined : await ticRow(archive, star.gaiaDr3);
  if (!teff && !(tic?.TIC && Number(tic.Teff) > 0)) throw new Error(`${hostname}: no archive row gives a stellar temperature${star.gaiaDr3 ? `, nor does TIC v8.2 for Gaia DR3 ${star.gaiaDr3}` : ', and it has no Gaia DR3 source to look up'}; give this host a spec by hand.`);
  const kelvin = teff?.value ?? Number(tic!.Teff), temperature = teff ? undefined : { value: kelvin, ...(Number(tic!.s_Teff) > 0 ? { uncertainty: Number(tic!.s_Teff) } : {}), source: `${TIC.credit}, the effective temperature of TIC ${tic!.TIC} (VizieR IV/39/tic82); no NASA Exoplanet Archive row gives one`, url: TIC.url };
  const from = (row: StarRow) => row === star ? `the default parameter set of ${row.planet}` : `${row.planet}'s parameter set from ${row.label} (the default leaves it empty)`;
  const cited = (picked: ReturnType<typeof pick>, key: string) => picked === undefined ? 'gaia-flame' as const : { value: picked.value, ...(picked.err ? { uncertainty: picked.err } : {}), source: `${picked.row.label}, the stellar ${key} of ${from(picked.row)} in the NASA Exoplanet Archive`, url: picked.row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  const n = planets.length, dist = star.dist === undefined ? '' : ` ${short(star.dist, 3)} parsecs away`;
  if (existing(hostId)) notes.push(`${hostname} is already in the universe as ${hostId}`);
  const entry = existing(hostId) ? { host: hostId, planets, notes: skipped } : {
    // The host is named as its planets name it (pi Men for pi Men c), the archive's host name when they match.
    id: hostId, name: prefix ?? hostname, system: `${(prefix ?? hostname).replace(/\s+A$/u, '')} system`, description: `Star of ${Math.round(kelvin).toLocaleString('en-US')} K${dist} with ${n} transiting planet${n === 1 ? '' : 's'}.`,
    target: hostname, ...(star.gaiaDr3 ? { gaia: star.gaiaDr3 } : {}), paper: { url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: star.label },
    radius: cited(rad, 'radius'), temperature: temperature ?? cited(teff, 'temperature'), mass: cited(mass, 'mass'),
    text: { card: `${hostname} is a ${Math.round(kelvin).toLocaleString('en-US')} K star${dist} with ${n} known transiting planet${n === 1 ? '' : 's'}.`,
      introduction: fit(180, `${hostname} is a star of ${Math.round(kelvin).toLocaleString('en-US')} K${dist}. ${n === 1 ? `Its planet ${String((planets[0] as { name: string }).name)} crosses it` : `Its planets ${planets.map(p => String((p as { name: string }).name).replace(`${hostname} `, '')).join(', ')} cross it`}, which is how ${n === 1 ? 'it was' : 'they were'} found and sized.`,
        `${hostname} is a star of ${Math.round(kelvin).toLocaleString('en-US')} K${dist}. Its ${n} transiting planet${n === 1 ? '' : 's'} were found and sized as ${n === 1 ? 'it crosses' : 'they cross'} it.`),
      locator: `NASA Exoplanet Archive ps table (st_refname ${[...new Set([teff, rad, mass].flatMap(picked => picked ? [picked.row.reference] : []))].join(', ')}): ${teff ? `st_teff ${teff.value}` : `no st_teff; TIC ${tic!.TIC} Teff ${tic!.Teff}`}${rad ? `, st_rad ${rad.value}` : ''}${mass ? `, st_mass ${mass.value}` : ''}`,
      ...await quotesFor([hostname], [hostname]) },
    planets, notes: skipped };
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

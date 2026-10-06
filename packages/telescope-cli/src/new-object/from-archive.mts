/** A spec for a planet host and its transiting planets, written from the NASA Exoplanet Archive `ps` table alone: each planet's
 * default parameter set (one paper, `pl_refname`) gives its orbit, radius and mass; the star's radius, temperature and mass come
 * from the same rows (`st_refname`), with Gaia DR3 FLAME where every row leaves the radius or mass empty and TIC v8.2 where every
 * row leaves the temperature empty. A planet found without a transit is added only when one paper's row measures its whole orbit,
 * inclination included (orbit.mts assembleMeasuredOrbit); its size is then the archive's, a model when calculated from its mass.
 * Planets whose rows lack the elements their orbit needs are left
 * out and named, so the README can say so; a host left with no planet to add is left out, not drafted as a lone star. A host the
 * universe holds is found by the Gaia DR3 source its position cites, then by name. The card and introduction are
 * drafted from the row's numbers and cite the row's paper; a person edits them, or keeps them. */
import { archiveHostQuery, assembleArchiveOrbit, assembleMeasuredOrbit, compositeMass, compositeRadius, NASA_TAP, parseArchiveRows } from './planets/orbit.mts';
import { decodeEntities, fetchGaiaRow, type Archive } from './archives/archives.mts';
import { duplicateName, hostId as idForHost, planetId, planetPrefix, type Existing } from './names/identity.mts';
import { TIC, ticRow, wideCompanions } from './companions.mts';
import { wikipediaQuotes } from './prose.mts';
import { hasArchiveSpectrum, orbitFold, timingSigma } from './planets/planet-charts.mts';
import { detectTransit, type TessArchive } from './planets/transit-chart.mts';
import { thermalFromArchive } from './planets/planet-datasets.mts';

const STAR_COLUMNS = 'pl_name,hostname,default_flag,pl_refname,st_refname,st_rad,st_raderr1,st_teff,st_tefferr1,st_mass,st_masserr1,sy_dist,disc_year,discoverymethod,tran_flag,pl_letter,hd_name,hip_name,gaia_dr3_id,cb_flag,sy_snum,disc_facility,sy_pnum';
const short = (value: number, digits = 2) => Number(value.toPrecision(digits));
/** The first draft that fits the budget; the last is short by construction. */
const fit = (budget: number, ...drafts: string[]) => drafts.find(draft => draft.length <= budget) ?? drafts.at(-1)!;

interface StarRow { readonly isDefault: boolean; readonly refYear: number; readonly circumbinary: boolean; readonly stars: number; readonly letter: string; readonly hd?: string; readonly hip?: string; readonly gaiaDr3?: string; readonly planet: string; readonly host: string; readonly reference: string; readonly label: string; readonly url?: string; readonly rad?: number; readonly radErr?: number; readonly teff?: number; readonly teffErr?: number; readonly mass?: number; readonly massErr?: number; readonly dist?: number; readonly year?: number; readonly method: string; readonly transit: boolean; readonly facility?: string; readonly systemPlanets?: number }
function parseStarRows(csv: string): StarRow[] {
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== STAR_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header}.`);
  return lines.filter(line => line.trim()).map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]), anchor = c[4]!;
    const label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1]?.replaceAll('%26', '&');
    const text = (i: number) => c[i]?.trim() || undefined, gaia = /(\d{6,})/u.exec(c[18] ?? '')?.[1];
    return { isDefault: c[2] === '1', refYear: Number(/abs\/(\d{4})/u.exec(url ?? '')?.[1]) || 0, circumbinary: c[19] === '1', stars: Number(c[20]) || 1, letter: c[15] ?? '', ...(text(16) ? { hd: text(16)! } : {}), ...(text(17) ? { hip: text(17)! } : {}), ...(gaia ? { gaiaDr3: gaia } : {}), planet: c[0]!, host: c[1]!, reference: /refstr=(\S+)/u.exec(anchor)?.[1] ?? label, label, ...(url ? { url } : {}), rad: n(5), radErr: n(6), teff: n(7), teffErr: n(8), mass: n(9), massErr: n(10), dist: n(11), year: n(12), method: c[13]!, transit: c[14] === '1', ...(text(21) ? { facility: text(21)! } : {}), ...(n(22) ? { systemPlanets: n(22)! } : {}) };
  });
}

export interface ArchiveSpecResult { readonly spec: Record<string, unknown>; readonly skipped: readonly string[]; readonly notes: readonly string[];
  /** The host's bound wide companions, as placed stars of its system (companions.mts). */
  readonly companions: readonly Record<string, unknown>[] }

/** The spec entry for one host: its transiting planets on their default rows. A body the universe already holds (by id or by name,
 * identity.mts) is not generated again; a host it holds becomes a host addition. */
/** Why an archive planet has nothing measured to show, or undefined when it has one. A draft adds a planet for a measurement: a
 * dayside temperature (its thermal dataset), an archive spectrum, or its transit in TESS at DETECTION_SIGMA (transit-chart.mts);
 * the orbit is the one the draft assembled. */
export type PlanetEvidence = (planet: string, orbit: { readonly periodDays: number; readonly transitTimeBmjdTdb: number }) => Promise<string | undefined>;
export const measuredEvidence = (archive: Archive, tess: TessArchive): PlanetEvidence => async (planet, orbit) => {
  if (await hasArchiveSpectrum(archive, planet)) return undefined;
  const detected = await detectTransit(archive, planet, tess, await orbitFold(() => orbit), await timingSigma(archive, planet));
  return 'reason' in detected ? detected.reason : undefined;
};

/** `evidence` chooses the planets: without it (a redraft of planets already added) every planet with an orbit is drafted. */
export async function archiveSpec(archive: Archive, hostname: string, universe: Existing, evidence?: PlanetEvidence): Promise<ArchiveSpecResult> {
  // The star rows and the orbit rows are read at once: each NASA TAP answer takes about a second.
  const [text, orbitText] = await Promise.all([archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select ${STAR_COLUMNS} from ps where hostname = '${hostname.replaceAll("'", "''")}'`, format: 'csv' })}`),
    archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveHostQuery(hostname), format: 'csv' })}`)]);
  // The default row of each planet; every row stays for a stellar value the default row leaves empty.
  const all = parseStarRows(text), rows = all.filter(row => row.isDefault);
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no default parameter set for a host named ${hostname}.`);
  // A planet around both stars of a pair needs the pair's orbit, which only a paper gives: built by hand, as Kepler-16 is.
  if (rows.some(row => row.circumbinary)) throw new Error(`${hostname}: its planets orbit both stars of a pair (circumbinary); the pair's orbit comes from a paper, so build it by hand as Kepler-16 is.`);
  // A planet's name prefix names its host, except that a companion's planet (TOI-2267 d, around TOI-2267 B) is named by the system.
  const first = rows[0]!, named = planetPrefix(first.planet, first.letter), prefix = named && hostname.match(/^(.+) [B-D]$/u)?.[1] === named ? undefined : named;
  // The host as the universe knows it, by id or name; else its id by the rule (identity.mts).
  // By the Gaia DR3 source its position cites first: the universe may name it otherwise (eps Indi A for the archive's eps Ind A).
  // A name is matched only to a placed star: TOI-2267 B, the host of TOI-2267 d, is not the planet TOI-2267 b (toi-2267b).
  const placedStar = (id: string | undefined) => id !== undefined && universe.stars.some(placed => placed.id === id) ? id : undefined;
  const known = (first.gaiaDr3 ? universe.gaia?.get(first.gaiaDr3) : undefined) ?? [hostname, prefix].flatMap(name => name ? [placedStar(duplicateName(universe, name))] : []).find(Boolean);
  const hostId = known ?? idForHost({ ...(prefix ? { planetPrefix: prefix } : {}), hostname, ...(first.hd ? { hd: first.hd } : {}), ...(first.hip ? { hip: first.hip } : {}), ...(first.gaiaDr3 ? { gaiaDr3: `Gaia DR3 ${first.gaiaDr3}` } : {}) });
  const skipped: string[] = [], notes: string[] = [], existing = (id: string) => universe.ids.has(id);
  // Quotes from the Wikipedia lead (prose.mts): a planet's own article first, then its host's, whose lead names the planet.
  const quotesFor = async (titles: string[], names: string[]) => { const quotes = await wikipediaQuotes(archive, titles, names.filter(Boolean)); if (!quotes) notes.push(`${titles[0]}: no Wikipedia lead to quote`); return quotes ? { quotes } : {}; };
  const orbitRows = parseArchiveRows(orbitText);
  type Found = { period: number; planet: string; transits: boolean; entry: Record<string, unknown> };
  const found: Found[] = [];
  // Each planet's archive reads run at once; what they report keeps the archive's row order.
  const drafted = await Promise.all(rows.map(async (row): Promise<{ skip?: string; note: string[]; found?: Found }> => {
    // A confirmed planet the archive still lists by its TESS or Kepler number ("TOI-406.01", letter b) is named by its host and the
    // archive's letter; the archive's name stays the one its tables are asked by. A bare candidate number without a letter is refused.
    const listed = /\.\d+$/u.test(row.planet), name = listed ? `${hostname} ${row.letter}` : row.planet;
    const id = planetId(hostId, row.letter), planetRows = orbitRows.filter(entry => entry.name === row.planet), note: string[] = [];
    const held = duplicateName(universe, row.planet) ?? duplicateName(universe, name);
    if (listed && !/^[a-z]$/u.test(row.letter)) return { skip: `${row.planet}: a candidate designation with no planet letter in the archive`, note };
    if (listed) note.push(`${name}: listed in the NASA Exoplanet Archive as ${row.planet}; named by its host and the archive's letter ${row.letter}`);
    if (existing(id) || held) return { note: [`${name} is already in the universe as ${held ?? id}`] };
    // A planet found without a transit takes the measured-orbit route: one paper's whole orbit, or it is left out with the reason.
    const measured = !row.transit, method = row.method.toLowerCase();
    if (measured && !planetRows.length) return { skip: `${row.planet}: found by ${method}, and the archive gives no orbit rows for it`, note };
    const [composite, { thermal, why }, archiveRadius] = await Promise.all([compositeMass(archive, row.planet), thermalFromArchive(archive, row.planet), measured ? compositeRadius(archive, row.planet) : undefined]);
    let assembled;
    // The draft only checks that a measured orbit can be placed; its a/R* is not kept (the spec keeps the route), and generation
    // divides the paper's semi-major axis by the host's recorded radius, which may be Gaia's and unknown here.
    try { assembled = measured ? assembleMeasuredOrbit(planetRows, composite, archiveRadius, all.find(entry => entry.rad !== undefined)?.rad ?? 1) : assembleArchiveOrbit(planetRows, undefined, composite); }
    catch (error) { return { skip: `${(error as Error).message.replace(/\.$/u, '')}${measured ? ` (found by ${method})` : ''}`, note }; }
    // A planet is added for what was measured of it; one with no dayside temperature, spectrum or TESS transit is left out and named.
    const missing = thermal || !evidence ? undefined : await evidence(row.planet, assembled.orbit);
    if (missing) return { skip: `${name}: nothing measured to show (no dayside temperature or archive spectrum; ${missing})`, note };
    const period = assembled.orbit.periodDays, year = row.year ? `, found in ${row.year}` : '', radius = assembled.radius.value, mass = assembled.mass.value;
    const modelSize = assembled.radius.row.reference === 'CALCULATED_VALUE';
    const defaultRow = assembled.row ?? planetRows.find(entry => entry.isDefault)!;
    // A measured dayside temperature in the archive's emission table gives the planet its thermal color (planet-datasets.mts).
    if (!thermal) note.push(`${name}: ${why}; its gray takes the host's light`);
    const quotes = await wikipediaQuotes(archive, [name, hostname], [name, row.planet]);
    if (!quotes) note.push(`${name}: no Wikipedia lead to quote`);
    if (measured) note.push(`${name}: found by ${method}; its whole orbit is ${defaultRow.label}'s fit${defaultRow.isDefault ? ', the archive\'s default' : ''}${modelSize ? ", and its size the archive's model from its mass" : ''}`);
    const massText = assembled.mass.unmeasured ? 'no pl_bmassj in pscomppars' : `pl_bmassj ${mass}`;
    // The factsheet shows the planet's size, mass and year; the text says what it cannot: how and when the planet was found, and
    // how many planets its star has: the planets the archive lists under this host, found by any method. The archive's
    // sy_pnum counts the whole system, so in a pair of stars it also counts the other star's planets (WASP-94 B b).
    // A facility the archive names with its abbreviation reads by it (TESS); "Multiple Observatories" names none.
    const facility = row.facility === undefined || /^multiple observatories$/iu.test(row.facility) ? undefined : /\(([^()]+)\)$/u.exec(row.facility)?.[1] ?? row.facility;
    const discovered = `${row.year ? ` in ${row.year}` : ''}${facility ? ` by ${facility}` : ''}`, system = row.systemPlanets ?? 0, count = system ? rows.length : 0;
    const family = count > 1 ? `It is one of ${count} planets known around ${hostname}.` : count === 1 ? `It is the only planet known around ${hostname}.` : '';
    const facts = `disc_year ${row.year ?? 'none'}, disc_facility ${row.facility ?? 'none'}, sy_pnum ${system || 'none'}${system > count ? `, ${count} of them with hostname ${hostname}` : ''}`;
    const text = measured ? {
      card: fit(110, `${name} was found${discovered} by ${method}; it does not cross its star.`, `${name} was found by ${method}; it does not cross its star.`),
      introduction: fit(180, `${family} Its orbit, tilt included, follows ${defaultRow.label}'s fit${modelSize ? ", and its size is the archive's model from its mass" : ''}.`.trim(),
        `Its orbit follows ${defaultRow.label}'s fit${modelSize ? '; its size is a model' : ''}.`),
      locator: `NASA Exoplanet Archive ps table (pl_refname ${defaultRow.reference}): ${facts}; pl_orbper ${period}, pl_orbincl ${assembled.orbit.inclinationDegrees}, pl_orbtper ${defaultRow.periastronTime}; ${modelSize ? `pscomppars calculated pl_radj ${radius}` : `pl_radj ${radius}`}, ${massText}`,
    } : {
      card: fit(110, `${name} was found${discovered} as it crossed its star.`, `${name} was found as it crossed its star.`),
      introduction: fit(180, `${family} Its orbit and size follow ${row.label}'s fit, the archive's default.`.trim(), `Its orbit and size follow ${row.label}'s fit.`),
      locator: `NASA Exoplanet Archive ps table, default parameter set (pl_refname ${defaultRow.reference}): ${facts}; pl_orbper ${period}, pl_radj ${radius}, ${massText}`,
    };
    return { note, found: { period, planet: row.planet, transits: !measured, entry: { id, name, ...(thermal ? { thermal } : {}),
      description: measured ? `Planet of ${hostname} found by ${method}, with a ${short(period, 3)}-day year${year}.` : `Transiting planet of ${hostname} with a ${short(period, 3)}-day year${year}.`,
      paper: { url: defaultRow.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: defaultRow.label },
      orbit: { archive: 'nasa-ps', ...(measured ? { measured: true } : { reference: defaultRow.reference }), ...(listed ? { planetName: row.planet } : {}) },
      text: { ...text,
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
  // No archive row gives the radius or mass: Gaia DR3 FLAME for the same source, else the TIC v8.2 value, as for the temperature.
  const flame = (rad && mass) || !star.gaiaDr3 ? undefined : (await fetchGaiaRow(archive, star.gaiaDr3)).row;
  const ticFor = async () => tic ?? await ticRow(archive, star.gaiaDr3!);
  const fallback = async (have: unknown, key: 'radiusFlame' | 'massFlame', column: 'Rad' | 'Mass', what: string) => {
    if (have || !flame || flame[key]) return undefined;
    const row = await ticFor();
    return row?.TIC && Number(row[column]) > 0 ? { value: Number(row[column]), ...(Number(row[`s_${column}`]) > 0 ? { uncertainty: Number(row[`s_${column}`]) } : {}), source: `${TIC.credit}, the ${what} of TIC ${row.TIC} (VizieR IV/39/tic82); no NASA Exoplanet Archive row gives one, nor does Gaia DR3 FLAME`, url: TIC.url } : undefined;
  };
  const [ticRadius, ticMass] = [await fallback(rad, 'radiusFlame', 'Rad', 'radius'), await fallback(mass, 'massFlame', 'Mass', 'mass')];
  const cited = (picked: ReturnType<typeof pick>, key: string) => picked === undefined ? 'gaia-flame' as const : { value: picked.value, ...(picked.err ? { uncertainty: picked.err } : {}), source: `${picked.row.label}, the stellar ${key} of ${from(picked.row)} in the NASA Exoplanet Archive`, url: picked.row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  // "a star of 8,450 K" needs no article chosen by the number; the distance is set off by commas mid-sentence.
  const n = planets.length, dist = star.dist === undefined ? '' : `, ${short(star.dist, 3)} parsecs away`, mid = dist ? `${dist},` : '', allTransit = sorted.every(item => item.transits);
  const kind = allTransit ? `transiting planet${n === 1 ? '' : 's'}` : `planet${n === 1 ? '' : 's'}`, names = planets.map(p => String((p as { name: string }).name)), list = names.map(name => name.replace(`${hostname} `, '')).sort((a, b) => a.localeCompare(b)).join(', ');
  if (existing(hostId)) notes.push(`${hostname} is already in the universe as ${hostId}`);
  const entry = existing(hostId) ? { host: hostId, planets, notes: skipped } : {
    // The host is named as its planets name it (pi Men for pi Men c), the archive's host name when they match.
    id: hostId, name: prefix ?? hostname, system: `${(prefix ?? hostname).replace(/\s+[A-D]$/u, '')} system`, parent: 'milky-way', description: `Star of ${Math.round(kelvin).toLocaleString('en-US')} K${mid} with ${n} ${kind}.`,
    target: hostname, ...(star.gaiaDr3 ? { gaia: star.gaiaDr3 } : {}), paper: { url: star.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', credit: star.label },
    radius: ticRadius ?? cited(rad, 'radius'), temperature: temperature ?? cited(teff, 'temperature'), mass: ticMass ?? cited(mass, 'mass'),
    // The factsheet shows the star's size and distance; the text names its planets and whose values the star follows.
    text: { card: fit(110, allTransit ? (n === 1 ? `${names[0]} crosses ${hostname} as seen from Earth, which is how it was found.` : `${n} planets cross ${hostname} as seen from Earth: ${list}.`)
        : n === 1 ? `${hostname}'s planet ${names[0]} is placed on the orbit its paper measured.` : `${hostname}'s planets ${list} are placed on the orbits their papers measured.`,
      `${hostname} has ${n} known ${kind}.`),
      introduction: (([r, t]) => r === t ? `Its radius and temperature follow ${r}.` : `Its radius follows ${r}, and its temperature ${t}.`)([rad ? rad.row.label : ticRadius ? 'the TESS Input Catalog v8.2' : 'Gaia DR3 FLAME', teff ? teff.row.label : 'the TESS Input Catalog v8.2']),
      locator: `NASA Exoplanet Archive ps table (st_refname ${[...new Set([teff, rad, mass].flatMap(picked => picked ? [picked.row.reference] : []))].join(', ')}): ${teff ? `st_teff ${teff.value}` : `no st_teff; TIC ${tic!.TIC} Teff ${tic!.Teff}`}${rad ? `, st_rad ${rad.value}` : ''}${mass ? `, st_mass ${mass.value}` : ''}`,
      ...await quotesFor([hostname], [hostname]) },
    planets, notes: skipped };
  // The other stars of a multiple system: the wide ones Gaia separates, from El-Badry et al. (2021); the rest are named as missing.
  let companions: Record<string, unknown>[] = [];
  if (star.stars > 1 && star.gaiaDr3) {
    const system = existing(hostId) ? universe.systems?.get(hostId) ?? `${prefix ?? hostname} system` : String((entry as { system?: string }).system);
    const found = await wideCompanions(archive, { id: hostId, gaia: star.gaiaDr3, name: prefix ?? hostname, system }, (gaia, name) => universe.gaia?.get(gaia) ?? duplicateName(universe, name));
    companions = found.companions; notes.push(...found.notes);
    const missing = star.stars - 1 - found.companions.length - found.notes.filter(note => note.includes('already in the universe')).length;
    if (missing > 0) notes.push(`${hostname}: a ${star.stars}-star system; ${missing} of its other stars ${missing === 1 ? 'is' : 'are'} too close to it for Gaia to separate, or not in the wide-binary catalogue, and ${missing === 1 ? 'is' : 'are'} not added`);
  }
  return { spec: entry, skipped, notes, companions };
}

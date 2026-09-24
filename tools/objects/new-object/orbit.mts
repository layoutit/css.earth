/** A planet's or companion's hosted orbit (packages/astronomy `hostedOrbit`), from one of three routes, each keeping its source:
 *
 * - `whereistheplanet`: one sample of the orbit paper's own orbitize! posterior (Wang et al. 2021's whereistheplanet), picked by
 *   tools/objects/hosted-orbits/posterior-pick.py with the paper's measured positions; its orbit.json is converted here.
 * - `archive`: one paper's parameter row in the NASA Exoplanet Archive `ps` table (the default row unless the spec names the
 *   reference), for a transiting planet: period, a/R*, inclination, eccentricity and transit time from that one paper.
 * - `elements`: values the spec cites directly.
 *
 * The conversion keeps an imaged orbit at its fitted angular size and places it at the host's Gaia distance, as the imaged planets
 * already shipped do, and stores the argument of periastron as the star's (orbitize!'s is the companion's). */
import type { Archive } from './archives.mts';

export const AU_KM = 149597870.7, DAYS_PER_YEAR = 365.25;
export const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

export interface HostedOrbit {
  readonly periodDays: number; readonly semiMajorAxisStellarRadii: number; readonly inclinationDegrees: number; readonly eccentricity: number;
  readonly argumentOfPeriapsisDegrees?: number; readonly epochDefinition?: 'periastron' | 'inferior-conjunction'; readonly transitTimeBmjdTdb: number;
  readonly ascendingNodePositionAngleDegrees: number; readonly sources: Readonly<Record<string, string>>;
}
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const mod360 = (value: number) => ((value % 360) + 360) % 360;

/** orbitize!'s orbit (tools/objects/hosted-orbits/posterior-pick.py's orbit.json) as a hosted orbit around a host of `hostRadiusKm`
 * at `distanceParsecs`. `citation` names the paper and its posterior; `pick` how the sample was chosen. */
export function orbitizeHostedOrbit(orbitJson: unknown, hostRadiusKm: number, distanceParsecs: number, citation: string, pickPath: string): HostedOrbit {
  const input = orbitJson as { source?: string; rule?: string; samples?: number; tauReferenceMjd?: number; orbit?: Record<string, number> };
  const o = input.orbit, key = (name: string) => { const value = o?.[name]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${pickPath}: orbit.json lacks ${name}.`); return value; };
  const sma = key('sma1'), ecc = key('ecc1'), inc = key('inc1'), aop = key('aop1'), pan = key('pan1'), tau = key('tau1'), plx = key('plx');
  const mass = o?.mtot ?? (typeof o?.m0 === 'number' && typeof o?.m1 === 'number' ? o.m0 + o.m1 : undefined);
  if (mass === undefined) throw new TypeError(`${pickPath}: orbit.json gives neither mtot nor m0 and m1.`);
  const periodDays = Math.sqrt(sma ** 3 / mass) * DAYS_PER_YEAR, angularMas = sma * plx, placedAu = angularMas / 1000 * distanceParsecs;
  const reference = input.tauReferenceMjd ?? 0, periastron = reference + tau * periodDays;
  const picked = `${citation}, distributed as a posterior of ${input.samples ?? '?'} samples by ${input.source ?? 'whereistheplanet'}. Picked with tools/objects/hosted-orbits/posterior-pick.py (${pickPath}): ${input.rule ?? 'see orbit.json'}.`;
  return {
    periodDays: round(periodDays, 1), semiMajorAxisStellarRadii: round(placedAu * AU_KM / hostRadiusKm, 1), inclinationDegrees: round(inc, 4), eccentricity: round(ecc, 5),
    argumentOfPeriapsisDegrees: round(mod360(aop + 180), 4), epochDefinition: 'periastron', transitTimeBmjdTdb: round(periastron, 1), ascendingNodePositionAngleDegrees: round(mod360(pan), 4),
    sources: {
      period: `Derived: Kepler's third law with the sample's semi-major axis ${sma.toFixed(3)} au and total mass ${mass.toFixed(4)} solar masses, ${(periodDays / DAYS_PER_YEAR).toFixed(1)} years of ${DAYS_PER_YEAR} d. ${picked}`,
      shape: `${picked} a ${sma.toFixed(3)} au at the sample's parallax ${plx.toFixed(4)} mas, kept as the angular size ${angularMas.toFixed(1)} mas and placed at the Gaia DR3 distance: ${(placedAu * AU_KM / hostRadiusKm).toFixed(2)} radii of the host's ${Math.round(hostRadiusKm).toLocaleString('en-US')} km; inclination ${inc.toFixed(4)} degrees.`,
      eccentricity: `${picked} e ${ecc.toFixed(5)}.`,
      argumentOfPeriapsis: `${picked} omega ${aop.toFixed(4)} degrees, orbitize!'s argument of periastron of the companion; stored as the star's, ${mod360(aop + 180).toFixed(4)} degrees.`,
      phase: `${picked} tau ${tau.toFixed(5)} of a period after MJD ${reference}; the periastron passage nearest that epoch is MJD ${periastron.toFixed(1)}, taken as BMJD_TDB.`,
      orientation: `${picked} Ascending node ${mod360(pan).toFixed(4)} degrees east of north.`,
    },
  };
}

/** One paper's row of the NASA Exoplanet Archive `ps` table. */
export interface ArchiveRow {
  readonly name: string; readonly reference: string; readonly label: string; readonly bibcode?: string; readonly url?: string; readonly isDefault: boolean;
  readonly period?: number; readonly ratioAR?: number; readonly inclination?: number; readonly eccentricity?: number; readonly periastron?: number;
  readonly transitMid?: number; readonly radiusJupiter?: number; readonly massJupiter?: number;
}
const COLUMNS = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj';
export const archiveQuery = (planet: string) => `select ${COLUMNS} from ps where pl_name = '${planet.replaceAll("'", "''")}'`;
/** The archive's CSV: quoted fields that may hold commas (the reference is an HTML anchor). */
export function parseArchiveRows(csv: string): ArchiveRow[] {
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"')).slice(0, 11);
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header}, not ${COLUMNS}.`);
  return lines.map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]);
    const anchor = c[1]!, label = (/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).replaceAll('&amp;', '&'), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1];
    const bibcode = url ? /abs\/([^/]+)\/?/u.exec(url)?.[1]?.replaceAll('%26', '&') : undefined;
    return { name: c[0]!, reference: /refstr=(\S+)/u.exec(anchor)?.[1] ?? label, label, ...(bibcode ? { bibcode } : {}), ...(url ? { url } : {}), isDefault: c[2] === '1',
      ...Object.fromEntries(([['period', 3], ['ratioAR', 4], ['inclination', 5], ['eccentricity', 6], ['periastron', 7], ['transitMid', 8], ['radiusJupiter', 9], ['massJupiter', 10]] as const)
        .flatMap(([key, i]) => n(i) === undefined || !Number.isFinite(n(i)) ? [] : [[key, n(i)!]])) } as ArchiveRow;
  });
}
export async function archiveRow(archive: Archive, planet: string, reference?: string): Promise<ArchiveRow> {
  const rows = parseArchiveRows(await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveQuery(planet), format: 'csv' })}`));
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no ps row for ${planet}.`);
  const row = reference ? rows.find(entry => entry.reference === reference || entry.label === reference || entry.bibcode === reference) : rows.find(entry => entry.isDefault);
  if (!row) throw new Error(`${planet}: no ps row ${reference ? `from ${reference}` : 'is the default'}; its references are ${rows.map(entry => `${entry.label} (${entry.reference})`).join(', ')}.`);
  return row;
}

/** A transiting planet's hosted orbit from one archive row: that paper's own values; what the row lacks is refused or stated. */
export function archiveHostedOrbit(row: ArchiveRow): { orbit: HostedOrbit; todo?: string } {
  const cite = `${row.label}${row.bibcode ? ` (${row.bibcode})` : ''}, via the NASA Exoplanet Archive ps table (pl_refname ${row.reference})`;
  const missing = (['period', 'ratioAR', 'inclination', 'transitMid'] as const).filter(key => row[key] === undefined);
  if (missing.length) throw new Error(`${row.name}: ${row.label}'s archive row lacks ${missing.join(', ')}; choose a reference whose row has them, or give the elements.`);
  const e = row.eccentricity ?? 0;
  if (e > 0 && row.periastron === undefined) throw new Error(`${row.name}: ${row.label}'s archive row gives e ${e} but no argument of periastron; choose another reference or give the elements.`);
  const todo =  e > 0 ? `${row.name}: check the paper's convention for omega ${row.periastron} (the star's or the planet's)` : undefined;
  return { ...(todo ? { todo } : {}), orbit: {
    periodDays: row.period!, semiMajorAxisStellarRadii: row.ratioAR!, inclinationDegrees: row.inclination!, eccentricity: e,
    ...(e > 0 && row.periastron !== undefined ? { argumentOfPeriapsisDegrees: row.periastron, epochDefinition: 'inferior-conjunction' as const } : {}),
    transitTimeBmjdTdb: round(row.transitMid! - 2400000.5, 6), ascendingNodePositionAngleDegrees: 0,
    sources: { period: `${cite}: P ${row.period} d`, shape: `${cite}: a/R* ${row.ratioAR}, inclination ${row.inclination} degrees`,
      eccentricity: row.eccentricity === undefined ? `${cite} gives no eccentricity; the orbit is taken as circular` : `${cite}: e ${row.eccentricity}`,
      ...(e > 0 && row.periastron !== undefined ? { argumentOfPeriapsis: `${cite}: omega ${row.periastron} degrees` } : {}),
      phase: `${cite}: transit mid-time ${row.transitMid} BJD, taken as BJD_TDB`,
      orientation: 'Display convention: transit photometry does not measure the orbit\'s position angle on the sky, so the ascending node is set at position angle 0 (celestial north).' } } };
}

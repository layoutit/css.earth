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
/** The archive writes reference labels as HTML: accented author names arrive as entities. */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', egrave: 'è', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', szlig: 'ß', oslash: 'ø', aring: 'å', Aacute: 'Á', Eacute: 'É', Oslash: 'Ø', ecirc: 'ê', ocirc: 'ô', acirc: 'â', scaron: 'š', zcaron: 'ž', ccaron: 'č' };
export const decodeEntities = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/gu, (whole, code: string) =>
  code.startsWith('#x') ? String.fromCodePoint(parseInt(code.slice(2), 16)) : code.startsWith('#') ? String.fromCodePoint(Number(code.slice(1))) : NAMED_ENTITIES[code] ?? whole);
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
  readonly name: string; readonly reference: string; readonly label: string; readonly bibcode?: string; readonly url?: string; readonly isDefault: boolean; readonly year: number;
  readonly period?: number; readonly ratioAR?: number; readonly inclination?: number; readonly eccentricity?: number; readonly periastron?: number;
  readonly transitMid?: number; readonly radiusJupiter?: number; readonly massJupiter?: number; readonly massLimitJupiter?: number; readonly semiMajorAxisAu?: number; readonly starRadius?: number; readonly starMass?: number; readonly impactParameter?: number;
}
const COLUMNS = 'pl_name,pl_refname,default_flag,pl_orbper,pl_ratdor,pl_orbincl,pl_orbeccen,pl_orblper,pl_tranmid,pl_radj,pl_bmassj,pl_orbsmax,st_rad,st_mass,pl_bmassjlim,pl_imppar';
const FIELDS = [['period', 3], ['ratioAR', 4], ['inclination', 5], ['eccentricity', 6], ['periastron', 7], ['transitMid', 8], ['radiusJupiter', 9], ['massJupiter', 10], ['semiMajorAxisAu', 11], ['starRadius', 12], ['starMass', 13], ['impactParameter', 15]] as const;
export const archiveQuery = (planet: string) => `select ${COLUMNS} from ps where pl_name = '${planet.replaceAll("'", "''")}'`;
export const archiveHostQuery = (host: string) => `select ${COLUMNS} from ps where hostname = '${host.replaceAll("'", "''")}'`;
/** The archive's CSV: quoted fields that may hold commas (the reference is an HTML anchor). */
export function parseArchiveRows(csv: string): ArchiveRow[] {
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"')).slice(0, COLUMNS.split(',').length);
  const [header, ...lines] = csv.trim().split(/\r?\n/u);
  if (header !== COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header}, not ${COLUMNS}.`);
  return lines.map(line => {
    const c = split(line), n = (i: number) => c[i] === '' || c[i] === undefined ? undefined : Number(c[i]);
    const anchor = c[1]!, label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1];
    const bibcode = url ? /abs\/([^/]+)\/?/u.exec(url)?.[1]?.replaceAll('%26', '&') : undefined;
    // A mass the archive flags as a limit (pl_bmassjlim not 0) is no mass.
    const limited = n(14) !== undefined && n(14) !== 0;
    const fields = Object.fromEntries(FIELDS.flatMap(([key, i]) => n(i) === undefined || !Number.isFinite(n(i)) ? [] : key === 'massJupiter' && limited ? [['massLimitJupiter', n(i)!]] : [[key, n(i)!]]));
    return { name: c[0]!, reference: /refstr=(\S+)/u.exec(anchor)?.[1] ?? label, label, ...(bibcode ? { bibcode } : {}), ...(url ? { url } : {}), isDefault: c[2] === '1', year: Number(bibcode?.slice(0, 4)) || 0, ...fields } as ArchiveRow;
  });
}
export async function archiveRows(archive: Archive, planet: string): Promise<ArchiveRow[]> {
  const rows = parseArchiveRows(await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: archiveQuery(planet), format: 'csv' })}`));
  if (!rows.length) throw new Error(`The NASA Exoplanet Archive has no ps row for ${planet}.`);
  return rows;
}
export const COMPOSITE_CALC = 'https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html';
export interface CompositeMass { readonly value: number; readonly provenance: string; readonly limit: boolean; readonly label: string; readonly url?: string; readonly bibcode?: string }
/** The mass the archive's composite table adopts for a planet: a measurement from one paper, or, when no paper measures one, its
 * own calculated value from the radius (the Chen & Kipping 2017 mass-radius relationship), each named (pl_bmassprov). A value the
 * archive flags as a limit is returned as one. */
export async function compositeMass(archive: Archive, planet: string): Promise<CompositeMass | undefined> {
  const csv = await archive.text(`${NASA_TAP}?${new URLSearchParams({ query: `select pl_name,pl_bmassj,pl_bmassjlim,pl_bmassprov,pl_bmassj_reflink from pscomppars where pl_name = '${planet.replaceAll("'", "''")}'`, format: 'csv' })}`);
  const line = csv.trim().split(/\r?\n/u)[1];
  if (!line) return undefined;
  const cells = [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/gu)].map(m => m[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));
  const value = Number(cells[1]), anchor = cells[4] ?? '';
  if (!cells[1] || !Number.isFinite(value)) return undefined;
  const label = decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url = /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1], bibcode = url ? /abs\/([^/]+)\/?/u.exec(url)?.[1]?.replaceAll('%26', '&') : undefined;
  return { value, provenance: cells[3]!, limit: cells[2] !== '' && Number(cells[2]) !== 0, label, ...(url && url.startsWith('http') ? { url } : {}), ...(bibcode ? { bibcode } : {}) };
}

const SOLAR_RADIUS_AU = 695700 / AU_KM;
/** a/R* by Kepler's third law in solar units: a in au is the cube root of M P^2, P in years. */
export const keplerRatio = (starMass: number, periodDays: number, starRadius: number) => Math.cbrt(starMass * (periodDays / DAYS_PER_YEAR) ** 2) / (starRadius * SOLAR_RADIUS_AU);
/** A stated a/R* and Kepler's third law with the same rows' stellar mass and radius agree within this factor. Measured 2026-09-24 on
 * the 1,567 default transiting rows that give all three: 99% fall between 0.49 and 1.59, and the 23 beyond a factor of 2 include
 * a/R* stored in solar radii (ZTF J1828+2308 b, 0.838 for 63) and an a/R* paired with another paper's giant-star radius (K2-11 b). */
export const KEPLER_AGREEMENT = 2;
export interface AssembledOrbit { readonly orbit: HostedOrbit; readonly radius: { readonly value: number; readonly row: ArchiveRow }; readonly mass: { readonly value: number; readonly row: ArchiveRow; readonly limit?: true }; readonly rows: readonly ArchiveRow[]; readonly todo?: string }

/** A transiting planet's orbit from its archive rows: the chosen row (the default, or the spec's reference) first, and what it
 * lacks from the most recent other row that has it, each value cited to its own row. a/R* missing everywhere is derived from a row's
 * semi-major axis and stellar radius, or from Kepler's third law with its period, stellar mass and radius. Eccentricity and the
 * argument of periastron come from one row together. An inclination missing everywhere is derived from a row's impact parameter
 * (Winn 2010, eq. 7). A missing period or transit time, or an inclination no row gives or allows, refuses the planet. The mass is
 * the composite table's; when that is only an upper limit it is returned as one (`limit`). */
export function assembleArchiveOrbit(rows: readonly ArchiveRow[], reference?: string, composite?: CompositeMass): AssembledOrbit {
  const chosen = reference ? rows.find(entry => entry.reference === reference || entry.label === reference || entry.bibcode === reference) : rows.find(entry => entry.isDefault);
  if (!chosen) throw new Error(`${rows[0]!.name}: no ps row ${reference ? `from ${reference}` : 'is the default'}; its references are ${rows.map(entry => `${entry.label} (${entry.reference})`).join(', ')}.`);
  const others = rows.filter(entry => entry !== chosen).sort((a, b) => b.year - a.year), name = chosen.name;
  const cite = (row: ArchiveRow) => `${row.label}${row.bibcode ? ` (${row.bibcode})` : ''}, via the NASA Exoplanet Archive ps table (pl_refname ${row.reference})`;
  const pick = <K extends keyof ArchiveRow>(key: K) => { const row = chosen[key] !== undefined ? chosen : others.find(entry => entry[key] !== undefined); return row ? { value: row[key] as number, row } : undefined; };
  const period = pick('period'), transit = pick('transitMid'), impact = [chosen, ...others].find(row => row.impactParameter !== undefined);
  const missing = [['period', period], ['inclination', pick('inclination') ?? impact], ['transit time', transit]].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`${name}: no archive row gives its ${missing.join(', ')}.`);
  // a/R*: a row's own, else derived from the same row's semi-major axis and stellar radius, else Kepler's third law.
  let ratio: { value: number; row: ArchiveRow; how: string };
  const own = pick('ratioAR');
  if (own) {
    ratio = { ...own, how: `a/R* ${own.value}` };
    // A stated a/R* must fit the star it is placed around: Kepler's third law with the rows' stellar mass and radius.
    const starMass = pick('starMass'), starRadius = pick('starRadius');
    if (starMass && starRadius) {
      const kepler = keplerRatio(starMass.value, period!.value, starRadius.value), factor = own.value / kepler;
      if (factor > KEPLER_AGREEMENT || factor < 1 / KEPLER_AGREEMENT) throw new Error(`${name}: ${own.row.label}'s a/R* ${own.value} disagrees with Kepler's third law (${kepler.toFixed(2)} from P ${period!.value} d, ${starMass.row.label}'s stellar mass ${starMass.value} and ${starRadius.row.label}'s radius ${starRadius.value} solar units) by a factor of ${(factor > 1 ? factor : 1 / factor).toFixed(1)}, beyond ${KEPLER_AGREEMENT}.`);
    }
  }
  else {
    const byAxis = [chosen, ...others].find(row => row.semiMajorAxisAu !== undefined && row.starRadius !== undefined);
    const byKepler = [chosen, ...others].find(row => row.period !== undefined && row.starMass !== undefined && row.starRadius !== undefined);
    if (byAxis) ratio = { value: byAxis.semiMajorAxisAu! / (byAxis.starRadius! * SOLAR_RADIUS_AU), row: byAxis, how: `a/R* derived from its semi-major axis ${byAxis.semiMajorAxisAu} au and stellar radius ${byAxis.starRadius} solar radii` };
    else if (byKepler) ratio = { value: keplerRatio(byKepler.starMass!, byKepler.period!, byKepler.starRadius!), row: byKepler, how: `a/R* derived by Kepler's third law from its period ${byKepler.period} d, stellar mass ${byKepler.starMass} and radius ${byKepler.starRadius} solar units` };
    else throw new Error(`${name}: no archive row gives a/R*, nor a semi-major axis with a stellar radius, nor a period with stellar mass and radius.`);
    ratio = { ...ratio, value: Number(ratio.value.toFixed(4)) };
  }
  // Eccentricity and omega from one row: the chosen row when it states both (or e = 0), else the newest row that does.
  const shape = [chosen, ...others].find(row => row.eccentricity !== undefined && (row.eccentricity === 0 || row.periastron !== undefined));
  const e = shape?.eccentricity ?? 0, radius = pick('radiusJupiter');
  // The inclination a row states, else the one its impact parameter gives with that row's a/R* (the orbit's when the row has none)
  // and the orbit's e and omega: b = a/R* cos i (1 - e^2) / (1 + e sin omega), Winn (2010) eq. 7.
  let inclination: { value: number; row: ArchiveRow; how?: string } | undefined = pick('inclination');
  if (!inclination) {
    const row = impact!, own = row.ratioAR ?? (row.semiMajorAxisAu !== undefined && row.starRadius !== undefined ? row.semiMajorAxisAu / (row.starRadius * SOLAR_RADIUS_AU) : undefined), aR = own ?? ratio.value;
    const omega = e > 0 ? shape!.periastron! * Math.PI / 180 : 0, cos = row.impactParameter! * (1 + e * Math.sin(omega)) / (aR * (1 - e * e));
    if (!(cos >= 0 && cos < 1)) throw new Error(`${name}: no archive row gives its inclination, and ${row.label}'s impact parameter ${row.impactParameter} with a/R* ${Number(aR.toFixed(4))} allows none (cos i ${cos.toFixed(3)}).`);
    inclination = { value: Number((Math.acos(cos) * 180 / Math.PI).toFixed(3)), row, how: `inclination derived from its impact parameter ${row.impactParameter} with ${own === undefined ? `the orbit's a/R* ${ratio.value}` : `its a/R* ${Number(own.toFixed(4))}`}${e > 0 ? ` and the orbit's e ${e}, omega ${shape!.periastron} degrees` : ''} (Winn 2010, eq. 7)` };
  }
  if (!radius) throw new Error(`${name}: no archive row gives its radius.`);
  // The mass is the one the archive's composite table adopts, so the choice between papers is the archive's, not ours.
  if (!composite) throw new Error(`${name}: the archive's composite table gives no mass.`);
  // An upper limit is kept as one: the record's GM stays 0, its unpublished value, and the limit is shown as a limit.
  // Only 'M-R relationship' is the archive's own model; 'Msini' (a radial-velocity minimum mass, near the mass for a transiting
  // orbit) and 'Msin(i)/sin(i)' are a paper's measurements (pl_bmassprov).
  const calculated = composite.provenance === 'M-R relationship' && !composite.limit, minimum = composite.provenance === 'Msini' && !composite.limit;
  const mass = { value: composite.value, ...(composite.limit ? { limit: true as const } : {}), row: { ...chosen, label: composite.limit ? composite.label : calculated ? `the NASA Exoplanet Archive's calculated value (${composite.provenance}, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement` : minimum ? `${composite.label}, the minimum mass (M sin i) the NASA Exoplanet Archive's composite table adopts` : `${composite.label}, the mass the NASA Exoplanet Archive's composite table adopts`,
    reference: calculated ? 'CALCULATED_VALUE' : composite.label, url: calculated ? COMPOSITE_CALC : composite.url ?? 'https://exoplanetarchive.ipac.caltech.edu/', bibcode: calculated ? undefined : composite.bibcode } as ArchiveRow };
  // The records' own density rule (packages/astronomy bodies.test.ts): between 0.1 and 8.5 g/cm^3 unless a brown dwarf.
  const density = mass.value * 1.89813e30 / (4 / 3 * Math.PI * (radius.value * 7.1492e9) ** 3);
  if (!composite.limit && (!(density > 0.1) || (density > 8.5 && mass.value < 13))) throw new Error(`${name}: ${mass.row.label.split(',')[0]}'s mass ${mass.value} Jupiter masses in ${radius.value} Jupiter radii is ${density.toFixed(1)} g/cm^3, outside what the records accept.`);
  const todo = e > 0 ? `omega ${shape!.periastron} degrees is taken as ${shape!.label} gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e ${e}) about the line of sight` : undefined;
  return { rows, radius, mass, ...(todo ? { todo } : {}), orbit: {
    periodDays: period!.value, semiMajorAxisStellarRadii: ratio.value, inclinationDegrees: inclination.value, eccentricity: e,
    ...(e > 0 ? { argumentOfPeriapsisDegrees: mod360(shape!.periastron!), epochDefinition: 'inferior-conjunction' as const } : {}),
    transitTimeBmjdTdb: round(transit!.value - 2400000.5, 6), ascendingNodePositionAngleDegrees: 0,
    sources: { period: `${cite(period!.row)}: P ${period!.value} d`, shape: `${cite(ratio.row)}: ${ratio.how}; ${cite(inclination.row)}: ${inclination.how ?? `inclination ${inclination.value} degrees`}`,
      eccentricity: shape ? `${cite(shape)}: e ${shape.eccentricity}` : `No archive row states an eccentricity; the orbit is taken as circular`,
      ...(e > 0 ? { argumentOfPeriapsis: `${cite(shape!)}: omega ${shape!.periastron} degrees${shape!.periastron! < 0 || shape!.periastron! >= 360 ? `, stored as ${mod360(shape!.periastron!)}` : ''}` } : {}),
      phase: `${cite(transit!.row)}: transit mid-time ${transit!.value} BJD, taken as BJD_TDB`,
      orientation: 'Display convention: transit photometry does not measure the orbit\'s position angle on the sky, so the ascending node is set at position angle 0 (celestial north).' } } };
}

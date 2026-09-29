/** The S-stars around Sgr A*, read from their publications into hosted-orbit body records.
 *
 * Every value comes from a table: Gillessen et al. (2017, ApJ 837, 30) table3 as VizieR serves it (J/ApJ/837/30) for the
 * orbits, their Sect. 3.4.1 for the stars whose orbits constrain the central mass, GRAVITY Collaboration (2022, A&A 657,
 * L12) Table 1 for the four stars it refits, and Habibi et al. (2017, ApJ 847, 120) Table 3 for radii and masses. The two
 * papers are read from their arXiv LaTeX sources. The host's distance, radius and mass come from its own record. */

/** IAU 2012 Resolution B2. */
export const AU_KM = 149_597_870.7;
/** IAU 2015 Resolution B3 nominal solar radius. */
export const SOLAR_RADIUS_KM = 695_700;
/** Days in a Julian year, the unit the decimal-year epochs and periods are given in. */
export const JULIAN_YEAR_DAYS = 365.25;
/** MJD of J2000.0: a decimal year t is MJD 51544.5 + (t - 2000) x 365.25. */
const J2000_MJD = 51_544.5;

export interface GillessenOrbit {
  readonly star: string; readonly flag: string;
  readonly a: string; readonly eA: string; readonly e: string; readonly eE: string; readonly i: string; readonly eI: string;
  readonly node: string; readonly eNode: string; readonly omega: string; readonly eOmega: string; readonly tp: string; readonly eTp: string;
  readonly period: string; readonly ePeriod: string; readonly spectralType: string; readonly kMagnitude: string;
}
export interface GravityOrbit { readonly star: string; readonly a: string; readonly eA: string; readonly e: string; readonly eE: string;
  readonly i: string; readonly eI: string; readonly node: string; readonly eNode: string; readonly omega: string; readonly eOmega: string;
  readonly tp: string; readonly eTp: string }
export interface HabibiStar { readonly star: string; readonly teff: string; readonly radius: readonly [string, string, string];
  readonly mass: readonly [string, string, string]; readonly spectralType: string }
export interface Host { readonly id: string; readonly distanceParsecs: number; readonly radiusKm: number; readonly massSolar: number }

const finite = (text: string, label: string): number => {
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value)) throw new TypeError(`${label} is not a number: ${JSON.stringify(text)}.`);
  return value;
};

/** VizieR's tab-separated answer: comment lines, a header, a unit line, a dash line, then rows. */
export function parseVizierTsv(text: string): readonly Readonly<Record<string, string>>[] {
  const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const header = lines[0]?.split('\t').map(name => name.trim());
  if (!header?.includes('Star') || !/^-+(\t-+)*/.test(lines[2] ?? '')) throw new TypeError('VizieR answer lacks its header, unit and dash lines.');
  return lines.slice(3).map(line => Object.fromEntries(line.split('\t').map((value, index) => [header[index]!, value.trim()])));
}

export function gillessenOrbits(rows: readonly Readonly<Record<string, string>>[]): readonly GillessenOrbit[] {
  return rows.map(row => {
    const field = (name: string) => { const value = row[name]; if (value === undefined) throw new TypeError(`table3 lacks the ${name} column.`); return value; };
    return { star: field('Star'), flag: field('f_Star'), a: field('a'), eA: field('e_a'), e: field('e'), eE: field('e_e'), i: field('i'), eI: field('e_i'),
      node: field('Omega'), eNode: field('e_Omega'), omega: field('w'), eOmega: field('e_w'), tp: field('Tp'), eTp: field('e_Tp'),
      period: field('Per'), ePeriod: field('e_Per'), spectralType: field('SpT'), kMagnitude: field('Kmag') };
  });
}

/** Gillessen et al. (2017) Sect. 3.4.1: "We selected thus the following 17 stars for a multi-star fit: S2, S1, ..." */
export function multiStarFitStars(tex: string): readonly string[] {
  const match = /We selected thus the following (\d+) stars for a multi-star fit:([^.]*)\./u.exec(tex);
  if (!match) throw new TypeError('Gillessen et al. (2017) no longer names its multi-star fit selection.');
  const stars = match[2]!.split(/,|\band\b/u).map(name => name.trim()).filter(Boolean);
  if (stars.length !== Number(match[1]) || stars.some(name => !/^[SR]\d+$/u.test(name))) throw new TypeError(`The multi-star fit list does not read as ${match[1]} stars: ${stars.join(', ')}.`);
  return stars;
}

/** GRAVITY Collaboration (2022) Table 1: pairs of star columns, each parameter a value and its error. */
export function gravityOrbits(tex: string): readonly GravityOrbit[] {
  const lines = tex.split('\n'), orbits: GravityOrbit[] = [];
  const cells = (line: string) => line.replace(/\\\\\s*$/u, '').split('&').map(cell => cell.trim());
  const labels: readonly [keyof Omit<GravityOrbit, 'star'>, keyof Omit<GravityOrbit, 'star'>, RegExp][] = [
    ['a', 'eA', /^\$a\\,/u], ['e', 'eE', /^\$e\$$/u], ['i', 'eI', /^\$i\\,/u], ['node', 'eNode', /^\$\\Omega\\,/u],
    ['omega', 'eOmega', /^\$\\omega\\,/u], ['tp', 'eTp', /^\$t_\\mathrm\{peri\}/u]];
  for (let index = 0; index < lines.length; index++) {
    const stars = [...lines[index]!.matchAll(/\{\\bf (S\d+)\}/gu)].map(match => match[1]!);
    if (stars.length !== 2) continue;
    const values: Record<string, string>[] = [{ star: stars[0]! }, { star: stars[1]! }];
    for (const [value, error, label] of labels) {
      const row = lines.slice(index + 1, index + 12).map(cells).find(row => label.test(row[0]!));
      if (!row) throw new TypeError(`GRAVITY (2022) Table 1 lacks ${value} for ${stars.join(' and ')}.`);
      const numbers = row.slice(1).filter(Boolean);
      if (numbers.length !== 4) throw new TypeError(`GRAVITY (2022) Table 1 ${value} row for ${stars.join(' and ')} is not two value-error pairs.`);
      values[0]![value] = numbers[0]!; values[0]![error] = numbers[1]!; values[1]![value] = numbers[2]!; values[1]![error] = numbers[3]!;
    }
    for (const orbit of values) orbits.push(orbit as unknown as GravityOrbit);
  }
  if (!orbits.length) throw new TypeError('GRAVITY (2022) Table 1 has no star columns.');
  return orbits;
}

/** Habibi et al. (2017) Table 3: `S1 &$ 27450^{+ 2239}_{- 2569}$& ... & $5.19^{+1.13}_{-0.76}$&$ 12.40^{+2.0}_{-1.7}$& ...&B0--B3&14.8&\\` */
export function habibiStars(tex: string): readonly HabibiStar[] {
  const start = tex.indexOf('Star&$T_{\\mathrm{eff}}$');
  if (start < 0) throw new TypeError('Habibi et al. (2017) Table 3 header not found.');
  const measure = (cell: string, label: string): [string, string, string] => {
    const match = /([\d.]+)\^\{\+\s*([\d.]+)\s*\}_\{-\s*([\d.]+)\s*\}/u.exec(cell);
    if (!match) throw new TypeError(`${label} is not value^{+upper}_{-lower}: ${cell}.`);
    return [match[1]!, match[2]!, match[3]!];
  };
  const stars: HabibiStar[] = [];
  for (const line of tex.slice(start).split('\n').slice(1)) {
    if (line.includes('\\end{tabular}')) break;
    const cells = line.split('&').map(cell => cell.trim());
    if (!/^S\d+$/u.test(cells[0] ?? '')) continue;
    stars.push({ star: cells[0]!, teff: measure(cells[1]!, `${cells[0]} Teff`)[0], radius: measure(cells[4]!, `${cells[0]} radius`),
      mass: measure(cells[5]!, `${cells[0]} mass`), spectralType: cells[8]!.replace('--', '-') });
  }
  if (!stars.length) throw new TypeError('Habibi et al. (2017) Table 3 has no star rows.');
  return stars;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const mjd = (year: number) => round(J2000_MJD + (year - 2000) * JULIAN_YEAR_DAYS, 4);
const JULIAN = 'Decimal year taken as a Julian epoch, MJD = 51544.5 + (year - 2000.0) x 365.25; its time scale is taken as TDB (a difference of about a minute).';
const CONVENTION = 'Orientation mapped by measurement: Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30) table5 positions and radial velocities of S2 (145 positions, 44 radial velocities, 1992-2016) and S1 (161 positions) are reproduced by this package\'s hosted orbit with i and Omega as published and omega + 180 degrees (2.08 and 3.17 mas rms, 31.9 km/s rms for S2); every other mapping is off by 135-594 mas or 1551 km/s. The published omega is the star\'s own argument of periapsis; the hosted-orbit convention stores the host-side one, as the beta-pictoris records do.';
const GILLESSEN = 'Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30), table3';

export interface SStarInputs {
  readonly host: Host; readonly solarGm: number;
  readonly gillessen: readonly GillessenOrbit[]; readonly multiStarFit: readonly string[];
  readonly gravity: readonly GravityOrbit[]; readonly habibi: readonly HabibiStar[];
  /** Existing record orders, kept so a regenerated record does not move in the catalogue. */
  readonly orders: Readonly<Record<string, number>>; readonly firstOrder: number;
}
export interface SStarResult { readonly records: readonly Record<string, unknown>[]; readonly skipped: readonly { readonly star: string; readonly reason: string }[] }

/** One hosted-orbit record per closed table3 orbit; GRAVITY (2022) replaces the elements of the stars it refits. */
export function sStarRecords(inputs: SStarInputs): SStarResult {
  const { host } = inputs, placedAu = (arcsec: number) => arcsec * host.distanceParsecs;
  const millions = Number((host.massSolar / 1e6).toPrecision(10));
  const records: Record<string, unknown>[] = [], skipped: { star: string; reason: string }[] = [];
  let nextOrder = inputs.firstOrder;
  const measured = inputs.habibi.map(star => star.star).join(', ').replace(/, ([^,]*)$/u, ' and $1');
  for (const row of inputs.gillessen) {
    const id = row.star.toLowerCase(), eccentricityText = row.e;
    if (!(finite(eccentricityText, `${row.star} e`) < 1) || !row.period) {
      skipped.push({ star: row.star, reason: `table3 gives e = ${row.e} +/- ${row.eE} and a = ${row.a} arcsec: an unbound path, which a hosted orbit cannot place.` });
      continue;
    }
    const gravity = inputs.gravity.find(orbit => orbit.star === row.star);
    const source = gravity ?? row, a = finite(source.a, `${row.star} a`), au = placedAu(a);
    const period = gravity
      ? { days: round(Math.sqrt(au ** 3 / host.massSolar) * JULIAN_YEAR_DAYS, 4),
        text: `Derived: Kepler's third law with a = ${gravity.a} arcsec x ${host.distanceParsecs} pc = ${au.toFixed(2)} au and the central mass ${millions}e6 solar masses (GRAVITY 2022, Table 1): sqrt(${au.toFixed(2)}^3 / ${millions}e6) = ${Math.sqrt(au ** 3 / host.massSolar).toFixed(4)} yr of 365.25 d. The table prints no period.` }
      : { days: round(finite(row.period, `${row.star} period`) * JULIAN_YEAR_DAYS, 4), text: `${GILLESSEN}: P = ${row.period} +/- ${row.ePeriod} yr of 365.25 d.` };
    const cite = gravity ? 'GRAVITY Collaboration (2022, A&A 657, L12), Table 1' : GILLESSEN, short = gravity ? 'GRAVITY Collaboration (2022), Table 1' : 'Gillessen et al. (2017), table3';
    const omega = finite(source.omega, `${row.star} omega`), stored = round((omega + 180) % 360, 6);
    const radii = round(au * AU_KM / host.radiusKm, 4);
    const trusted = inputs.multiStarFit.includes(row.star) || gravity !== undefined;
    const habibi = inputs.habibi.find(star => star.star === row.star);
    const physical = habibi
      ? { meanRadiusKm: round(finite(habibi.radius[0], `${row.star} radius`) * SOLAR_RADIUS_KM, 1), gm: round(finite(habibi.mass[0], `${row.star} mass`) * inputs.solarGm, 1),
        notes: `Radius ${habibi.radius[0]} (+${habibi.radius[1]}/-${habibi.radius[2]}) solar radii and mass ${habibi.mass[0]} (+${habibi.mass[1]}/-${habibi.mass[2]}) solar masses from Habibi et al. (2017, ApJ 847, 120; arXiv:1708.06353), Table 3, model-atmosphere fit to SINFONI spectra (Teff ${habibi.teff} K, ${habibi.spectralType}), at 695,700 km per solar radius and the JPL solar GM.` }
      : { meanRadiusKm: 0, gm: 0,
        notes: `No radius or mass is measured: ${GILLESSEN} gives only its class (${row.spectralType === 'e' ? 'early' : row.spectralType === 'l' ? 'late' : 'unclassified'}-type) and K = ${row.kMagnitude} mag, and Habibi et al. (2017, ApJ 847, 120) fit spectra of ${measured}. Radius and GM are recorded as 0: not measured.` };
    records.push({ id, classification: 'star', order: inputs.orders[id] ?? nextOrder++,
      physical: { name: row.star, horizonsCode: null, meanRadiusKm: physical.meanRadiusKm, gravitationalParameterKm3PerS2: physical.gm, parent: host.id,
        ...(habibi ? { effectiveTemperatureK: finite(habibi.teff, `${row.star} Teff`) } : {}) },
      physicalNotes: physical.notes,
      hostedOrbit: {
        periodDays: period.days, semiMajorAxisStellarRadii: radii, inclinationDegrees: finite(source.i, `${row.star} i`),
        eccentricity: finite(source.e, `${row.star} e`), argumentOfPeriapsisDegrees: stored, epochDefinition: 'periastron',
        transitTimeBmjdTdb: mjd(finite(source.tp, `${row.star} Tp`)), ascendingNodePositionAngleDegrees: finite(source.node, `${row.star} Omega`),
        ...(trusted ? {} : { weaklyConstrained: true }),
        sources: {
          period: period.text,
          shape: `${cite}: a = ${source.a} +/- ${source.eA} arcsec, placed at ${host.distanceParsecs} pc: ${au.toFixed(1)} au, ${radii.toFixed(1)} shadow radii; e = ${source.e} +/- ${source.eE}; i = ${source.i} +/- ${source.eI} degrees.${gravity ? ' Osculating elements.' : ''}`,
          phase: `${short}: ${gravity ? 't_peri' : 'Tp'} = ${source.tp} +/- ${source.eTp} yr. ${JULIAN}`,
          orientation: `${short}: Omega = ${source.node} +/- ${source.eNode} degrees.${gravity ? ' This is a Keplerian orbit: no relativistic precession is modelled.' : ` Their fit used R0 = 8320 pc; the angular elements are placed at ${host.distanceParsecs} pc like the rest of this system.`} ${CONVENTION}`,
          eccentricity: `${short}: ${source.e} +/- ${source.eE}.`,
          argumentOfPeriapsis: `${short}: omega = ${source.omega} +/- ${source.eOmega} degrees, the star's own; stored as ${stored}.`,
          ...(trusted ? {} : { constraint: `Gillessen et al. (2017), Sect. 3.4.1: an orbit constrains the central mass only with at least 8 measured dynamical quantities including a radial-velocity term; the ${inputs.multiStarFit.length} orbits fitted together are ${inputs.multiStarFit.join(', ')}. ${row.star} is not among them and GRAVITY (2022) does not refit it, so its path is not drawn.` }) } } });
  }
  return { records, skipped };
}

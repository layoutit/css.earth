/** What the catalogues print of one star, as the fields its measurements record keeps (source/measurements.json).
 *
 * A star's record already holds its radius, distance, temperature and gravity, each with its source. This adds what the
 * catalogues give beyond those: spectral type, metallicity, luminosity, age, rotation period and projected rotation speed,
 * and, when the star's page draws no measured axis, the tilt the period, the speed and the radius give together. Every
 * value is written beside the sentence that says where it is printed, as `<field>` and `<field>Source`.
 *
 * Three catalogues are read. The NASA Exoplanet Archive's composite parameters (pscomppars) give each planet host one value
 * for each parameter with the paper it is from. SIMBAD gives any star its spectral type and the rotation speed SIMBAD
 * prefers among its measurements, each with its bibcode. Gaia DR3's FLAME (Creevey et al. 2023, A&A 674, A26) gives a
 * luminosity and an age to the sources whose flags_flame vouches for them, the rule archives/gaia.mts drafts a star by: "00"
 * or "10" for the luminosity (derived from the parallax), and "00" alone for the age, which FLAME marks less sure for a
 * giant. Where two hold a value, the archive's is kept before SIMBAD's and Gaia's: it names a paper.
 *
 * A rotation period no archive row gives is looked for in every catalogue table that prints one (rotation-catalogues.mts).
 * All of them are kept in the record as `rotationPeriodsCatalogued`, each with its table. One is adopted as the star's
 * period only when most agree: the middle value, an entry as printed, when more than half of them lie within
 * PERIOD_AGREEMENT of it. A table's alias or a neighbour's row then does not undo nine that agree, and two that disagree
 * (often one rotation and its half) adopt nothing: choosing between them is not this pass's to do.
 *
 * Nothing is fitted or averaged here, and a value the record already holds is never replaced by a catalogue's. */
import { decodeEntities } from '../archives/archives.mts';
import { SOLAR_RADIUS_KM } from '../hosted.mts';

export const PSCOMPPARS_COLUMNS = 'hostname,gaia_dr3_id,ra,dec,st_spectype,st_spectype_reflink,st_met,st_metratio,st_met_reflink,st_lum,st_lum_reflink,st_age,st_age_reflink,st_vsin,st_vsin_reflink,st_rotp,st_rotp_reflink';
export const PSCOMPPARS_QUERY = `select distinct ${PSCOMPPARS_COLUMNS} from pscomppars`;
/** The fields this pass owns in a measurements record, each with the field that holds its source, named as the record
 * names its others (radiusKm and radiusSource). A field a catalogue no longer gives is removed with its source. */
export const METADATA_FIELDS = { spectralType: 'spectralTypeSource', metallicityDex: 'metallicitySource', luminosityLogSolar: 'luminositySource', ageGyr: 'ageSource',
  rotationPeriodDays: 'rotationPeriodSource', projectedRotationSpeedKmS: 'projectedRotationSpeedSource', spinInclinationDegrees: 'spinInclinationSource' } as const;
/** The list this pass also owns: every catalogued rotation period, adopted or not. */
export const CATALOGUED_PERIODS = 'rotationPeriodsCatalogued';
/** The period this project measured from a star's own light, and where: written by the route that measured it (brightness/brightness.mts), read here. */
export const MEASURED_PERIOD = { days: 'rotationPeriodMeasuredDays', source: 'rotationPeriodMeasuredSource' } as const;
export const measuredPeriod = (record: Readonly<Record<string, unknown>>): CataloguedPeriod | undefined => { const days = record[MEASURED_PERIOD.days], source = record[MEASURED_PERIOD.source];
  return typeof days === 'number' && days > 0 && typeof source === 'string' ? { days, source } : undefined; };
export type StarMetadata = Record<string, string | number | readonly CataloguedPeriod[]>;
/** One table's rotation period of a star, in days, with the table and column it is printed in. */
export interface CataloguedPeriod { readonly days: number; readonly source: string }
/** A catalogued period agrees with the middle one when it lies within this share of it. */
export const PERIOD_AGREEMENT = 0.2;
/** How many of `periods` lie within PERIOD_AGREEMENT of `middle`. */
const agreeing = (periods: readonly CataloguedPeriod[], middle: CataloguedPeriod) => periods.filter(period => Math.abs(period.days - middle.days) <= PERIOD_AGREEMENT * middle.days).length;
/** The period a star adopts from its catalogued ones: the middle one when more than half agree with it, else none. */
export function adoptPeriod(periods: readonly CataloguedPeriod[]): CataloguedPeriod | undefined {
  const sorted = [...periods].sort((a, b) => a.days - b.days), middle = sorted[Math.floor((sorted.length - 1) / 2)];
  return middle && 2 * agreeing(sorted, middle) > sorted.length ? middle : undefined;
}
/** The catalogued periods a record already holds. */
export const recordedPeriods = (record: Readonly<Record<string, unknown>>): CataloguedPeriod[] => Array.isArray(record[CATALOGUED_PERIODS])
  ? (record[CATALOGUED_PERIODS] as unknown[]).flatMap(entry => typeof entry === 'object' && entry !== null && typeof (entry as CataloguedPeriod).days === 'number' && typeof (entry as CataloguedPeriod).source === 'string' ? [{ days: (entry as CataloguedPeriod).days, source: (entry as CataloguedPeriod).source }] : []) : [];

export interface Printed<T> { readonly value: T; /** The paper or catalogue the archive names for it. */ readonly label: string; readonly url?: string }
export interface HostRow { readonly host: string; readonly gaiaDr3?: string; readonly raDegrees: number; readonly decDegrees: number;
  readonly spectralType?: Printed<string>; readonly metallicity?: Printed<number> & { readonly ratio: string }; readonly luminosityLogSolar?: Printed<number>;
  readonly ageGyr?: Printed<number>; readonly vsiniKmS?: Printed<number>; readonly rotationPeriodDays?: Printed<number> }
/** FLAME's values of one source with their 16th and 84th percentiles. */
export interface GaiaRow { readonly sourceId: string; readonly flags: string; readonly luminositySolar?: readonly [number, number, number]; readonly ageGyr?: readonly [number, number, number] }
export const GAIA_FLAME_COLUMNS = 'source_id,flags_flame,lum_flame,lum_flame_lower,lum_flame_upper,age_flame,age_flame_lower,age_flame_upper';
export const gaiaFlameQuery = (sourceIds: readonly string[]) => `SELECT ${GAIA_FLAME_COLUMNS.split(',').join(', ')} FROM gaiadr3.astrophysical_parameters WHERE source_id IN (${sourceIds.join(', ')})`;
export interface SimbadRow { readonly name: string; readonly spectralType?: { readonly value: string; readonly bibcode?: string }; readonly vsiniKmS?: { readonly value: number; readonly bibcode?: string } }

const split = (line: string) => [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/gu)].map(match => match[1]!.replace(/^"|"$/gu, '').replaceAll('""', '"'));
/** The archive's reference cell: an HTML anchor around the paper's short name. */
const reference = (anchor: string) => ({ label: decodeEntities(/>([^<]+)<\/a>/u.exec(anchor)?.[1] ?? anchor).trim(), url: /href=(\S+?)(?:\s|>)/u.exec(anchor)?.[1] });

/** The archive's CSV answer to PSCOMPPARS_QUERY, one row a host. */
export function parseHostRows(csv: string): HostRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), names = PSCOMPPARS_COLUMNS.split(',');
  if (header !== PSCOMPPARS_COLUMNS) throw new TypeError(`The NASA Exoplanet Archive answered with columns ${header?.slice(0, 80)}, not ${PSCOMPPARS_COLUMNS}.`);
  return lines.map(line => { const cells = split(line), cell = (name: string) => cells[names.indexOf(name)] ?? '';
    const printed = <T,>(name: string, read: (text: string) => T | undefined): Printed<T> | undefined => { const value = cell(name) === '' ? undefined : read(cell(name)), from = reference(cell(`${name}_reflink`));
      return value === undefined || !from.label ? undefined : { value, label: from.label, ...(from.url ? { url: from.url } : {}) }; };
    const number = (text: string) => Number.isFinite(Number(text)) ? Number(text) : undefined, positive = (text: string) => Number(text) > 0 ? Number(text) : undefined;
    const metallicity = printed('st_met', number), spectralType = printed('st_spectype', text => text.trim() || undefined), luminosity = printed('st_lum', number), age = printed('st_age', positive), vsini = printed('st_vsin', positive), period = printed('st_rotp', positive);
    return { host: cell('hostname'), ...(/^Gaia DR3 \d+$/u.test(cell('gaia_dr3_id')) ? { gaiaDr3: cell('gaia_dr3_id').slice('Gaia DR3 '.length) } : {}), raDegrees: Number(cell('ra')), decDegrees: Number(cell('dec')),
      ...(spectralType ? { spectralType } : {}), ...(metallicity ? { metallicity: { ...metallicity, ratio: cell('st_metratio') || '[Fe/H]' } } : {}), ...(luminosity ? { luminosityLogSolar: luminosity } : {}),
      ...(age ? { ageGyr: age } : {}), ...(vsini ? { vsiniKmS: vsini } : {}), ...(period ? { rotationPeriodDays: period } : {}) }; });
}

/** The Gaia Archive's CSV answer to gaiaFlameQuery. */
export function parseGaiaRows(csv: string): GaiaRow[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/u), names = (header ?? '').split(',').map(name => name.trim().replace(/^"|"$/gu, ''));
  if (names.join(',') !== GAIA_FLAME_COLUMNS) throw new TypeError(`The Gaia Archive answered with columns ${header?.slice(0, 80)}, not ${GAIA_FLAME_COLUMNS}.`);
  return lines.map(line => { const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/gu, '')), cell = (name: string) => cells[names.indexOf(name)] ?? '';
    const three = (name: string) => { const values = [cell(name), cell(`${name}_lower`), cell(`${name}_upper`)].map(Number); return values.every(value => Number.isFinite(value) && value > 0) && cell(name) !== '' ? values as [number, number, number] : undefined; };
    const luminosity = three('lum_flame'), age = three('age_flame'); return { sourceId: cell('source_id'), flags: cell('flags_flame'), ...(luminosity ? { luminositySolar: luminosity } : {}), ...(age ? { ageGyr: age } : {}) }; });
}

/** The tilt of the spin axis from the line of sight, degrees: sin i = v sin i × P / (2πR). Undefined when the three numbers
 * give a sine of 1 or more, which no tilt satisfies: they were measured apart and do not agree. */
export function spinInclination(periodDays: number, vsiniKmS: number, radiusKm: number): { readonly degrees?: number; readonly sine: number } {
  const sine = vsiniKmS * periodDays * 86400 / (2 * Math.PI * radiusKm);
  return sine > 0 && sine < 1 ? { degrees: Number((Math.asin(sine) * 180 / Math.PI).toFixed(1)), sine } : { sine };
}

const archive = (row: HostRow, what: string, printed: Printed<unknown>) => `NASA Exoplanet Archive, composite parameters of ${row.host} (pscomppars): ${what}, from ${printed.label}${printed.url ? ` (${printed.url})` : ''}`;
const simbad = (row: SimbadRow, what: string, bibcode?: string) => `SIMBAD, ${row.name.split(/\s+/u).join(' ')}: ${what}${bibcode ? ` (${bibcode})` : ''}`;
const flame = (row: GaiaRow, what: string) => `Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26), astrophysical_parameters of Gaia DR3 ${row.sourceId}, flags_flame ${row.flags}: ${what}`;
const trim = (value: number, digits: number) => Number(value.toFixed(digits));

/** The fields a star's record gains. `radiusKm` is the record's own radius; `measuredAxis` says the page already draws a
 * measured tilt, which then stands and no tilt is computed. */
export function starMetadata(star: { readonly radiusKm?: number; readonly measuredAxis: boolean }, host: HostRow | undefined, catalogued: SimbadRow | undefined, gaia?: GaiaRow, periods: readonly CataloguedPeriod[] = [], measured?: CataloguedPeriod): StarMetadata {
  const out: StarMetadata = {};
  if (host?.spectralType) { out.spectralType = host.spectralType.value; out.spectralTypeSource = archive(host, `spectral type ${host.spectralType.value}`, host.spectralType); }
  else if (catalogued?.spectralType) { out.spectralType = catalogued.spectralType.value; out.spectralTypeSource = simbad(catalogued, `spectral type ${catalogued.spectralType.value}`, catalogued.spectralType.bibcode); }
  if (host?.metallicity) { out.metallicityDex = trim(host.metallicity.value, 3); out.metallicitySource = archive(host, `${host.metallicity.ratio} ${host.metallicity.value} dex`, host.metallicity); }
  if (host?.luminosityLogSolar) { out.luminosityLogSolar = trim(host.luminosityLogSolar.value, 3); out.luminositySource = archive(host, `log10 of the luminosity in solar units ${host.luminosityLogSolar.value}`, host.luminosityLogSolar); }
  else if (gaia?.luminositySolar && (gaia.flags === '00' || gaia.flags === '10')) { const [value, lower, upper] = gaia.luminositySolar; out.luminosityLogSolar = trim(Math.log10(value), 3); out.luminositySource = flame(gaia, `lum_flame ${value} solar luminosities (16th to 84th percentiles ${lower} to ${upper}); its log10 is recorded`); }
  if (host?.ageGyr) { out.ageGyr = trim(host.ageGyr.value, 3); out.ageSource = archive(host, `age ${host.ageGyr.value} Gyr`, host.ageGyr); }
  else if (gaia?.ageGyr && gaia.flags === '00') { const [value, lower, upper] = gaia.ageGyr; out.ageGyr = trim(value, 3); out.ageSource = flame(gaia, `age_flame ${value} Gyr (16th to 84th percentiles ${lower} to ${upper})`); }
  if (host?.rotationPeriodDays) { out.rotationPeriodDays = trim(host.rotationPeriodDays.value, 4); out.rotationPeriodSource = archive(host, `rotation period ${host.rotationPeriodDays.value} d`, host.rotationPeriodDays); }
  // A period this project measured from the star's light stands beside the catalogued ones as one more of them.
  else { const all = measured ? [...periods, measured] : periods, adopted = adoptPeriod(all); if (adopted) { out.rotationPeriodDays = trim(adopted.days, 4);
    out.rotationPeriodSource = all.length > 1 ? `${adopted.source}. The middle of ${all.length} ${measured ? 'periods, catalogued and measured here' : 'catalogued periods'}, ${agreeing(all, adopted)} of them within ${PERIOD_AGREEMENT * 100}% of it` : adopted.source; } }
  if (periods.length) out[CATALOGUED_PERIODS] = [...periods].sort((a, b) => a.source.localeCompare(b.source));
  if (host?.vsiniKmS) { out.projectedRotationSpeedKmS = trim(host.vsiniKmS.value, 2); out.projectedRotationSpeedSource = archive(host, `projected rotation speed ${host.vsiniKmS.value} km/s`, host.vsiniKmS); }
  else if (catalogued?.vsiniKmS) { out.projectedRotationSpeedKmS = trim(catalogued.vsiniKmS.value, 2); out.projectedRotationSpeedSource = simbad(catalogued, `projected rotation speed ${trim(catalogued.vsiniKmS.value, 2)} km/s, the measurement SIMBAD prefers`, catalogued.vsiniKmS.bibcode); }
  if (!star.measuredAxis && star.radiusKm && typeof out.rotationPeriodDays === 'number' && typeof out.projectedRotationSpeedKmS === 'number') {
    const tilt = spinInclination(out.rotationPeriodDays, out.projectedRotationSpeedKmS, star.radiusKm);
    if (tilt.degrees !== undefined) { out.spinInclinationDegrees = tilt.degrees;
      out.spinInclinationSource = `Computed here from this record's rotation period, projected rotation speed and radius (${trim(star.radiusKm / SOLAR_RADIUS_KM, 3)} solar radii): sin i = v sin i × P / (2πR) = ${tilt.sine.toFixed(3)}. Not a measurement of the axis: the three numbers come from different papers.`; }
  }
  return out;
}

/** A measurements record with this pass's fields replaced by `fields`, placed before `shape`; other fields keep their order. */
export function withMetadata(record: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const owned = new Set<string>([...Object.entries(METADATA_FIELDS).flat(), CATALOGUED_PERIODS]), out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) { if (key === 'shape') Object.assign(out, fields); if (!owned.has(key)) out[key] = value; }
  return 'shape' in record ? out : { ...out, ...fields };
}

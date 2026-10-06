/** An ESPaDOnS program: one star's polarimetric spectra of one observing run, pinned at the Canadian archive, with what a
 * map of them needs and what a paper printed about the same run.
 *
 * The archive gives the `observations`. The rest is read from catalogues and papers, each value with where it is printed:
 * `atmosphere` holds the temperature, gravity and metallicity the line mask is computed for, `radialVelocity` where the
 * star's lines are looked for, `star` the rotation and the tilt a map cannot find by itself, and `published` the numbers
 * a re-reduction is compared with. A program without `atmosphere` can be pinned but not reduced; one without `star` can be
 * averaged but not mapped. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';
import { archivePrograms } from '../programs.mts';
import { PRODUCT, type ArchivedProduct } from './cadc.mts';

export const PROGRAM_SCHEMA = 'cssearth-espadons-program@1', MAP_SCHEMA = 'cssearth-espadons-map@2';
export const PROGRAMS = resolve(WORKSPACE, archivePrograms('espadons').path), DOWNLOADS = resolve(WORKSPACE, '.local/espadons');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** A number a person read, with where it is printed. */
export interface Cited { readonly value: number; readonly source: string }
/** What a line mask is computed for: effective temperature, log of the surface gravity in cgs, and [M/H] (solar when absent). */
export interface Atmosphere { readonly effectiveTemperatureK: Cited; readonly logGravity: Cited; readonly metallicity?: Cited }
export interface MappedStar { readonly vsiniKmS: Cited; readonly inclinationDegrees: Cited; readonly periodDays: Cited;
  /** How much slower the pole turns than the equator, rad/day; absent for a star mapped as one body. */ readonly shearRadPerDay?: Cited;
  /** Linear limb-darkening coefficient; ZDIpy's own 0.66 when absent. */ readonly limbDarkening?: Cited; readonly maximumDegree: Cited }
export interface PublishedRun { readonly paper: string; readonly url: string;
  /** Longitudinal field of single spectra, each by its printed mid-exposure time in UTC. */ readonly longitudinalFields?: readonly { readonly utc: string; readonly gauss: number; readonly error: number }[]; readonly longitudinalSource?: string;
  readonly meanGauss?: Cited; readonly toroidalPercent?: Cited; readonly spectra?: Cited; readonly note?: string;
  /** True when this program maps the run with another tilt or period than the paper's: its map is set beside the paper's, and benchmark.mts does not count it. */ readonly otherGeometry?: boolean }
export interface EspadonsProgram { readonly schema: typeof PROGRAM_SCHEMA; readonly id: string;
  readonly target: { readonly name: string; readonly object?: string; readonly raDegrees: number; readonly decDegrees: number; readonly radiusDegrees: number };
  readonly span: { readonly fromMjd: number; readonly toMjd: number }; readonly observations: readonly ArchivedProduct[]; readonly atmosphere?: Atmosphere; /** Catalogued radial velocity, km/s. */ readonly radialVelocity?: Cited; readonly star?: MappedStar; readonly published?: PublishedRun }

const cited = (value: unknown, label: string): Cited => { const record = requireRecord(value, label), source = requireString(record.source, `${label}.source`).trim(); if (!source) throw new TypeError(`${label}.source is empty.`); return { value: requireFiniteNumber(record.value, `${label}.value`), source }; };
export function parseProgram(value: unknown): EspadonsProgram {
  const input = requireRecord(value, 'ESPaDOnS program'); if (input.schema !== PROGRAM_SCHEMA) throw new TypeError('Unsupported ESPaDOnS program.');
  const id = requireString(input.id, 'program id'); if (!ID.test(id)) throw new TypeError(`${id} is not a program id (lower case, digits, hyphens).`);
  const target = requireRecord(input.target, 'program target'), span = requireRecord(input.span, 'program span'), number = (record: Record<string, unknown>, key: string, label: string) => requireFiniteNumber(record[key], `${label}.${key}`);
  const observations = requireArray(input.observations, 'program observations').map((entry, i): ArchivedProduct => { const row = requireRecord(entry, `observations[${i}]`), product = requireString(row.product, `observations[${i}].product`);
    if (!PRODUCT.test(product)) throw new TypeError(`${product} is not a polarimetric product id.`); const bytes = number(row, 'bytes', `observations[${i}]`); if (!Number.isInteger(bytes) || bytes <= 0) throw new RangeError(`${product}: ${bytes} bytes.`);
    return { product, uri: requireString(row.uri, `observations[${i}].uri`), bytes, targetName: requireString(row.targetName, `observations[${i}].targetName`), proposal: requireString(row.proposal, `observations[${i}].proposal`), mjdStart: number(row, 'mjdStart', `observations[${i}]`), exposureSeconds: number(row, 'exposureSeconds', `observations[${i}]`) }; });
  if (new Set(observations.map(observation => observation.product)).size !== observations.length) throw new TypeError(`${id}: a product is listed twice.`);
  let atmosphere: Atmosphere | undefined; if (input.atmosphere !== undefined) { const record = requireRecord(input.atmosphere, 'program atmosphere');
    atmosphere = { effectiveTemperatureK: cited(record.effectiveTemperatureK, 'atmosphere.effectiveTemperatureK'), logGravity: cited(record.logGravity, 'atmosphere.logGravity'), ...(record.metallicity === undefined ? {} : { metallicity: cited(record.metallicity, 'atmosphere.metallicity') }) };
    if (!(atmosphere.effectiveTemperatureK.value > 1000 && atmosphere.effectiveTemperatureK.value < 50000) || !(atmosphere.logGravity.value > -1 && atmosphere.logGravity.value < 7)) throw new RangeError(`${id}: the atmosphere needs a temperature in kelvin and a log gravity in cgs.`); }
  const radialVelocity = input.radialVelocity === undefined ? undefined : cited(input.radialVelocity, 'radialVelocity');
  let star: MappedStar | undefined; if (input.star !== undefined) { const record = requireRecord(input.star, 'program star');
    star = { vsiniKmS: cited(record.vsiniKmS, 'star.vsiniKmS'), inclinationDegrees: cited(record.inclinationDegrees, 'star.inclinationDegrees'), periodDays: cited(record.periodDays, 'star.periodDays'), maximumDegree: cited(record.maximumDegree, 'star.maximumDegree'),
      ...(record.shearRadPerDay === undefined ? {} : { shearRadPerDay: cited(record.shearRadPerDay, 'star.shearRadPerDay') }), ...(record.limbDarkening === undefined ? {} : { limbDarkening: cited(record.limbDarkening, 'star.limbDarkening') }) };
    if (!(star.vsiniKmS.value > 0) || !(star.periodDays.value > 0) || !(star.inclinationDegrees.value > 0 && star.inclinationDegrees.value < 90) || !Number.isInteger(star.maximumDegree.value) || star.maximumDegree.value < 1) throw new RangeError(`${id}: the star needs a positive v sin i and period, a tilt between 0 and 90 degrees, and a whole maximum degree.`); }
  let published: PublishedRun | undefined; if (input.published !== undefined) { const record = requireRecord(input.published, 'program published'), optional = (key: string) => record[key] === undefined ? {} : { [key]: cited(record[key], `published.${key}`) };
    published = { paper: requireString(record.paper, 'published.paper'), url: requireString(record.url, 'published.url'), ...optional('meanGauss'), ...optional('toroidalPercent'), ...optional('spectra'),
      ...(record.note === undefined ? {} : { note: requireString(record.note, 'published.note') }), ...(record.otherGeometry === true ? { otherGeometry: true } : {}), ...(record.longitudinalSource === undefined ? {} : { longitudinalSource: requireString(record.longitudinalSource, 'published.longitudinalSource') }),
      ...(record.longitudinalFields === undefined ? {} : { longitudinalFields: requireArray(record.longitudinalFields, 'published.longitudinalFields').map((entry, i) => { const row = requireRecord(entry, `longitudinalFields[${i}]`), utc = requireString(row.utc, `longitudinalFields[${i}].utc`);
        if (!Number.isFinite(Date.parse(`${utc}Z`))) throw new TypeError(`longitudinalFields[${i}].utc ${utc} is not a time.`); return { utc, gauss: number(row, 'gauss', `longitudinalFields[${i}]`), error: number(row, 'error', `longitudinalFields[${i}]`) }; }) }) }; }
  return { schema: PROGRAM_SCHEMA, id, target: { name: requireString(target.name, 'target.name'), ...(target.object === undefined ? {} : { object: requireString(target.object, 'target.object') }), raDegrees: number(target, 'raDegrees', 'target'), decDegrees: number(target, 'decDegrees', 'target'), radiusDegrees: number(target, 'radiusDegrees', 'target') },
    span: { fromMjd: number(span, 'fromMjd', 'span'), toMjd: number(span, 'toMjd', 'span') }, observations, ...(atmosphere ? { atmosphere } : {}), ...(radialVelocity ? { radialVelocity } : {}), ...(star ? { star } : {}), ...(published ? { published } : {}) };
}
export const programPath = (id: string) => { if (!ID.test(id)) throw new TypeError(`${id} is not a program id.`); return resolve(PROGRAMS, `${id}.json`); };
export const readProgram = async (id: string) => parseProgram(JSON.parse(await readFile(programPath(id), 'utf8')));

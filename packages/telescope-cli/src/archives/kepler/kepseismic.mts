/** A star's KEPSEISMIC light curves of the Kepler mission, found through MAST and read as they are published.
 *
 * KEPSEISMIC (Mathur, Santos & García; MAST high-level science product, DOI 10.17909/t9-mrpw-gc07) is the light curve the
 * rotation catalogues of Santos et al. (2019, ApJS 244, 21; 2021, ApJS 255, 17) are measured on. Its authors take the
 * light of a Kepler target from the mission's pixels in an aperture of their own, correct it with KADACS (García et al.
 * 2011, MNRAS 414, L6), join all the star's quarters into one series, and high-pass filter it at 20, 55 and 80 days: three
 * files a star, each one table of the four years. That light curve is what a row of those catalogues is a verdict on
 * (santos.mts), so it is read as it is: nothing is measured here from the pixels of a Kepler star.
 *
 * Three things about the file come from its own description (the product's README at MAST and García et al. 2014, A&A
 * 568, A10, Sect. 3), and one does not:
 * - the series is on a regular grid, each point the nearest image within half a step;
 * - gaps shorter than 20 days are filled in by in-painting (Pires et al. 2015, A&A 574, A18), and for a star with known
 *   transits the transits are taken out and filled in the same way (Santos et al. 2019, Sect. II.1);
 * - a grid point with no image and no filling is "left empty (nought)";
 * - the file's third unit holds one integer for each point, and neither the README nor the papers say what it is. It
 *   was set beside the mission's own files on 2026-10-06. In quarters 2 and 5 of KIC 8120608, each of the 7,806 points it
 *   marks 1 has a flux in the mission's long-cadence light curve (7,802 with no quality flag), and of the 1,182 it marks
 *   2, 1,153 have a flagged image or none. In KIC 10748390's file every point of quarters 7, 11 and 15, which the star
 *   was not observed in, is marked 0 and holds a flux of nought, and no other point is; and of the 1,117 points inside a
 *   transit of its planet, 891 are marked 2 and the rest 0. So it is read here as 0 empty, 1 measured, 2 filled in.
 *   That is this module's reading of the file, not a sentence of its authors.
 *
 * One call to MAST's archive, public and anonymous, through the pace archives/tess keeps for the same host:
 * `Mast.Caom.Filtered.Position`, the KEPSEISMIC time series at a place. A row names its target (`kplr008120608`: the
 * star's number in the Kepler Input Catalog) and its file. */
import { isRecord } from '@cssearth/core';
import { readFitsHdus, type FitsHeader } from '@cssearth/fits';
import { paced } from '../tess/mast.mts';
import { MAST_INVOKE, type Place } from './light-curves.mts';

/** The product's DOI at MAST, and the name MAST files its observations under. */
export const KEPSEISMIC_DOI = '10.17909/t9-mrpw-gc07', PROVENANCE = 'KEPSEISMIC';
/** The cut-off periods of the three high-pass filters, days: one file each. */
export const FILTER_DAYS = [20, 55, 80] as const;
export type FilterDays = typeof FILTER_DAYS[number];
/** How far from a star's place the mission's own target may lie, degrees (4 arcseconds: one of Kepler's pixels). */
export const MATCH_DEGREES = 4 / 3600;
/** The cadence of the light curves, seconds: the mission's long cadence. */
export const LONG_CADENCE_SECONDS = 1800;
/** The zero of the file's clock and of the Kepler mission's own, as barycentric Julian dates: a time on the mission's
 * clock is the file's less their difference. */
export const FILE_TIME_ZERO = 2400000, KEPLER_TIME_ZERO = 2454833;
/** What the file's third unit says of a point (this module's reading; see above). */
export const POINT = { empty: 0, measured: 1, filled: 2 } as const;

/** One filter's light curve of a target, as MAST files it. */
export interface KepseismicLightCurve extends Place { readonly target: string; /** The target's number in the Kepler Input Catalog. */ readonly kic: number; readonly filterDays: FilterDays; readonly filename: string; readonly uri: string }

const FILE = /^mast:HLSP\/kepseismic\/(\d{4})00000\/(\d{5})\/(20|55|80)d-filter\/(hlsp_kepseismic_kepler_phot_kplr(\d{9})-(20|55|80)d_kepler_v1_cor-filt-inp\.fits)$/u;
/** MAST's answer for a place, as the KEPSEISMIC light curves there, by target and then by filter. The power spectra and
 * previews the product also holds are left out, and a row whose folders do not spell its target is refused. */
export function parseKepseismic(body: unknown): KepseismicLightCurve[] {
  if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError('MAST did not answer with a list of observations.');
  return body.data.filter(isRecord).flatMap(row => { const named = FILE.exec(String(row.dataURL ?? ''));
    if (row.provenance_name !== PROVENANCE || Number(row.t_exptime) !== LONG_CADENCE_SECONDS || !named || typeof row.s_ra !== 'number' || typeof row.s_dec !== 'number') return [];
    const [uri, head, tail, folder, filename, target, filter] = named as unknown as [string, string, string, string, string, string, string];
    if (`${head}${tail}` !== target || folder !== filter || row.target_name !== `kplr${target}`) throw new TypeError(`MAST lists ${filename} under another target or filter.`);
    return [{ target: `kplr${target}`, kic: Number(target), filterDays: Number(filter) as FilterDays, filename, uri, raDegrees: row.s_ra, decDegrees: row.s_dec }]; })
    .sort((a, b) => a.kic - b.kic || a.filterDays - b.filterDays);
}

const apart = (a: Place, b: Place) => Math.hypot((a.raDegrees - b.raDegrees) * Math.cos(a.decDegrees * Math.PI / 180), a.decDegrees - b.decDegrees);
/** The KEPSEISMIC light curves of the target at a star's place: up to three, one a filter. A star that moves is given at
 * more than one place (where its record has it, and where the Kepler Input Catalog had it); the target nearest any of
 * them, within a pixel, is the star's, and only its light curves are returned. */
export async function kepseismicAt(places: readonly Place[]): Promise<KepseismicLightCurve[]> {
  const first = places[0];
  if (!first || !places.every(place => Number.isFinite(place.raDegrees) && Number.isFinite(place.decDegrees) && Math.abs(place.decDegrees) <= 90)) throw new RangeError('A place needs a right ascension and a declination in degrees.');
  const reach = MATCH_DEGREES + Math.max(...places.map(place => apart(first, place)));
  const response = await paced(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify({ service: 'Mast.Caom.Filtered.Position', format: 'json', params: { columns: 'obs_id,obs_collection,provenance_name,target_name,t_exptime,s_ra,s_dec,dataURL',
    filters: [{ paramName: 'provenance_name', values: [PROVENANCE] }, { paramName: 'dataproduct_type', values: ['timeseries'] }], position: `${first.raDegrees}, ${first.decDegrees}, ${reach}` } }) }) });
  if (!response.ok) throw new Error(`MAST answered ${response.status}.`);
  const near = (found: KepseismicLightCurve) => Math.min(...places.map(place => apart(place, found))), found = parseKepseismic(await response.json()).filter(one => near(one) <= MATCH_DEGREES);
  const nearest = [...found].sort((a, b) => near(a) - near(b))[0]?.kic;
  return found.filter(one => one.kic === nearest);
}

/** A KEPSEISMIC file, read: what its header says of it, and its series. */
export interface KepseismicSeries { readonly kic: number; readonly filterDays: number; /** The version of KADACS that made it. */ readonly pipeline: string; /** The quarters the star was observed in. */ readonly quarters: readonly number[];
  /** The longest gap its authors filled in, days; 0 when none was. */ readonly filledGapDays: number; /** The step of its regular grid, days. */ readonly stepDays: number;
  /** Each point's time on the Kepler mission's clock (a barycentric Julian date less 2454833), its flux in parts per million about the star's mean, and whether it is empty, measured or filled in (POINT). */
  readonly time: readonly number[]; readonly flux: readonly number[]; readonly state: readonly number[] }

const text = (header: FitsHeader, key: string) => { const value = header[key]; if (typeof value !== 'string' || !value.trim()) throw new TypeError(`The KEPSEISMIC file's header holds no ${key}.`); return value.trim(); };
const number = (header: FitsHeader, key: string) => { const value = header[key]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`The KEPSEISMIC file's header holds no ${key}.`); return value; };

/** A KEPSEISMIC light curve file as MAST serves it. Its first unit is a header, its second a table of two columns (TIME,
 * a barycentric Julian date less 2400000, and FLUX, in parts per million), its third one integer a point. Anything else
 * is refused: a file of another layout is not read as if it were this one. */
export function readKepseismic(bytes: Uint8Array): KepseismicSeries {
  const [primary, table, marks] = readFitsHdus(bytes);
  if (!primary || !table || !marks || text(primary.header, 'DATATYPE') !== 'KADACS') throw new TypeError('Not a KEPSEISMIC light curve: it needs a header, a table and one integer a point, made by KADACS.');
  const rows = table.dimensions[1] ?? 0, columns = [1, 2].map(index => `${text(table.header, `TTYPE${index}`)} ${text(table.header, `TFORM${index}`)} ${text(table.header, `TUNIT${index}`)}`).join(', ');
  if (table.header.XTENSION !== 'BINTABLE' || table.dimensions[0] !== 16 || table.header.TFIELDS !== 2 || columns !== 'TIME D days, FLUX D ppm') throw new TypeError(`A KEPSEISMIC table holds TIME in days and FLUX in ppm, as two 8-byte numbers; this one holds ${columns}.`);
  // The only place the file says what its clock is: the comment MAST wrote on the time column's unit.
  if (!table.cards.some(card => card.startsWith('TUNIT1') && card.includes('BJD - 2400000.0'))) throw new TypeError('The KEPSEISMIC table does not say its times are barycentric Julian dates less 2400000.');
  if (marks.header.XTENSION !== 'IMAGE' || marks.bitpix !== 16 || marks.dimensions.length !== 1 || marks.dimensions[0] !== rows || rows < 2) throw new TypeError('A KEPSEISMIC file holds one 16-bit integer for each point of its table.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), time: number[] = [], flux: number[] = [], state: number[] = [];
  for (let row = 0; row < rows; row += 1) { const at = table.dataOffset + 16 * row, mark = view.getInt16(marks.dataOffset + 2 * row), ppm = view.getFloat64(at + 8);
    if (mark !== POINT.empty && mark !== POINT.measured && mark !== POINT.filled) throw new TypeError(`A KEPSEISMIC point is marked ${mark}, which is neither 0, 1 nor 2.`);
    if (!Number.isFinite(ppm) || (mark === POINT.empty && ppm !== 0)) throw new TypeError('A KEPSEISMIC point marked empty holds a flux, or a point holds none.');
    time.push(Number((view.getFloat64(at) - (KEPLER_TIME_ZERO - FILE_TIME_ZERO)).toFixed(6))); flux.push(ppm); state.push(mark); }
  const stepDays = (time.at(-1)! - time[0]!) / (rows - 1);
  // MAST's own stamp of the first point, a modified Julian date, is the file's first time less half a day: the clock is the one the unit's comment says.
  if (Math.abs(number(primary.header, 'MJD-BEG') + 0.5 - (time[0]! + KEPLER_TIME_ZERO - FILE_TIME_ZERO)) > stepDays) throw new TypeError('The KEPSEISMIC file\'s first time is not the start MAST stamped on it.');
  const quarters = text(primary.header, 'QUARTERS').split(/\s+/u).map(Number);
  if (!quarters.length || !quarters.every(quarter => Number.isInteger(quarter) && quarter >= 0)) throw new TypeError('The KEPSEISMIC file\'s header does not list the quarters observed.');
  return { kic: number(primary.header, 'KEPLERID'), filterDays: number(primary.header, 'TSFILTER'), pipeline: `KADACS ${text(primary.header, 'PIPELINE')}`, quarters, filledGapDays: number(primary.header, 'INPTHRES'), stepDays, time, flux, state };
}

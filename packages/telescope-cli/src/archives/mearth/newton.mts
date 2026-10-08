/** A star's row in the MEarth-South rotation catalogue of Newton et al. (2018): the paper's own verdict on the star.
 *
 * Newton et al. (2018, AJ 156, 217, "New Rotation Period Measurements for M Dwarfs in the Southern Hemisphere") search
 * the MEarth-South light curves of 574 nearby M dwarfs, taken before 2 March 2018, by the method of their northern paper
 * (Newton et al. 2016, ApJ 821, 93, Sect. III.1). To each light curve they fit a baseline magnitude for every segment,
 * a scale of the common mode and a sinusoid, at each period from 0.1 to 1500 days, and take the period with the highest
 * F-test statistic as a candidate. Whether it is a rotation is then decided by eye: "the criteria we use in deciding
 * whether a period is detected are fundamentally qualitative". An inspection cannot be run here, so nothing is judged
 * here. What the paper publishes of each star is its row in its Table 1, and that is what this module reads, in the
 * paper's terms and no further.
 *
 * What a row asserts (2016, Sect. III.1; 2018, Sect. III.2; the table's ReadMe at CDS):
 * - `Type` A or B is a rotator: one of the stars "that we consider to have secure detections of periodic photometric
 *   modulation that we assume to be attributable to stellar rotation". For grade A the authors answer yes to each of
 *   their questions: the signal is seen by eye in the binned, phase-folded light; two or more complete, near-consecutive
 *   cycles are seen; it is uncorrelated with the model's systematics and with the images' width; and light curves taken
 *   at the same time agree. A grade B rotator "does not pass all of our tests", and "most grade B rotators fail only
 *   one criterion". Both are taken: the paper limits its own analysis "to grade A and B rotators".
 * - `Type` U is a "possible or uncertain detection" and N a "non-detection or undetermined detection": no rotation.
 * - `Per` is the star's rotation period and `Amp` the semi-amplitude of the fitted sinusoid, magnitudes.
 * - `Flag` 1 marks "known contamination by a common proper motion companion or background source". Such stars "are
 *   flagged in the table but are not included in the analysis that follows" (2018, Sect. III.2), because unresolved
 *   companions "could also result in spurious period detections" (2016, Sect. III.2). No rotation is taken from a
 *   flagged row: the paper prints its period and does not use it. That is this module's reading of what the paper
 *   presents as a star's rotation.
 * - `NDays` is the "number of days in longest dataset": the star's light curve that is read here (light-curves.mts
 *   `longest`), and `NPts` its points with a successful fit.
 *
 * The northern paper's table (VizieR J/ApJ/821/93) is of the same kind and is not wired: of the stars with a page on
 * 2026-10-08 it grades one a rotator (LSPM J2041+4938, grade A, 104.5 d), and flags that one for a bright contaminant.
 * Its periods for stars it does not grade A or B "should not be used" (2018, Sect. III.2). */
import { VIZIER_TAP } from '../espadons/catalogue.mts';
import type { PublishedVerdict } from '../tess/published.mts';
import type { RotationVerdict } from '../tess/verdict.mts';
import { before, clipped, longest, modelled, nightly, nightsOf, seasonsOf, type MearthLightCurve, type MearthModel, type MearthSeason } from './light-curves.mts';

/** The degree a map of MEarth light is fitted to: one brighter and one darker side. The paper's model of a light curve
 * is one sinusoid, and "sinusoidal patterns dominate the lightcurves of stars with detected rotation periods" (2018,
 * Sect. IV.1); a map of the first degree holds what a sinusoid fixes, the longitude of the darker side and how much
 * darker it is, a season. The light of a few hundred nights from the ground, each good to a few parts in a thousand,
 * does not fix the finer detail a space telescope's does. Measured on 2026-10-08 on five seasons (Proxima Centauri's
 * four and LHS 475's one): fitted to degree 5 as a space telescope's light is, a map took 2 to 15 times the contrast of
 * a map of degree 2, in a pattern of four lobes, for a scatter about the light 1 to 5% smaller; a map of degree 2 left
 * a scatter 16 and 27% smaller than one of degree 1 in two of the seasons and 1 to 3% in the other three. So a second
 * harmonic is in some seasons' light and is not drawn. Fitting to degree 1 is this module's choice; the numbers say
 * what it leaves out, and are not a setting. */
export const MEARTH_MAP_DEGREE = 1;
/** The paper's light: MEarth-South exposures "obtained prior to BJD 2458179.5 (12am March 2 2018 UT)" (Sect. II.1). */
export const NEWTON_2018_LAST_BJD = 2458179.5;
export type Grade = 'A' | 'B' | 'U' | 'N';
/** A star's row, as the columns this module reads. */
export interface NewtonRow { /** The star's 2MASS designation, which names its files in the MEarth release. */ readonly twomass: string; readonly grade: Grade; /** The row's place, J2000 degrees. */ readonly raDegrees: number; readonly decDegrees: number;
  /** The rotation period, days, and the semi-amplitude of the sinusoid and its uncertainty, magnitudes. */ readonly rotationDays?: number; readonly semiAmplitudeMag?: number; readonly semiAmplitudeErrorMag?: number;
  /** The paper flags the star's aperture as contaminated by a companion or a background source. */ readonly contaminated: boolean;
  /** The nights of the star's longest dataset, its points with a successful fit, and the F-test statistic of the period. */ readonly nights: number; readonly points?: number; readonly fTest?: number }

const TABLE = 'J/AJ/156/217/table1', CITATION = 'Newton et al. (2018, AJ 156, 217)', PAPER = 'Newton et al. (2018)';
const cell = (cells: Readonly<Record<string, string>>, column: string) => (cells[column] ?? '').trim();
function numberOf(cells: Readonly<Record<string, string>>, column: string): number | undefined { const printed = cell(cells, column); if (printed === '') return undefined; const value = Number(printed);
  if (!Number.isFinite(value)) throw new TypeError(`${TABLE}: ${column} holds ${printed}, not a number.`); return value; }
/** One row of the table, as the service gives it: every cell text, an empty one blank. */
export function parseNewtonRow(cells: Readonly<Record<string, string>>): NewtonRow {
  const twomass = cell(cells, 'twomass'), grade = cell(cells, 'Type'), needed = (column: string) => { const value = numberOf(cells, column); if (value === undefined) throw new TypeError(`${TABLE}: 2MASS ${twomass} holds no ${column}.`); return value; };
  if (!/^\d{8}[+-]\d{7}$/u.test(twomass)) throw new TypeError(`${TABLE}: a row holds no 2MASS designation.`);
  if (grade !== 'A' && grade !== 'B' && grade !== 'U' && grade !== 'N') throw new TypeError(`${TABLE}: 2MASS ${twomass} has the type "${grade}", which the table's description does not list.`);
  const flag = numberOf(cells, 'Flag'), optional = (key: string, column: string) => { const value = numberOf(cells, column); return value === undefined ? {} : { [key]: value }; };
  if (flag !== undefined && flag !== 1) throw new TypeError(`${TABLE}: 2MASS ${twomass} carries the flag ${flag}, which the table's description does not list.`);
  const rotator = grade === 'A' || grade === 'B', base = { twomass, grade: grade as Grade, raDegrees: needed('RAJ2000'), decDegrees: needed('DEJ2000'), contaminated: flag === 1, nights: needed('NDays'), ...optional('points', 'NPts'), ...optional('fTest', 'ftest') };
  if (!rotator) return base;
  const rotationDays = needed('Per'); if (!(rotationDays > 0)) throw new TypeError(`${TABLE}: 2MASS ${twomass} is graded a rotator without a rotation period.`);
  return { ...base, rotationDays, semiAmplitudeMag: needed('Amp'), ...optional('semiAmplitudeErrorMag', 'e_Amp') };
}

/** A semi-amplitude in magnitudes as the light's whole swing, a share of its mean: twice it, and a magnitude is 2.5
 * times the logarithm of a ratio of light. */
export const swingOf = (semiAmplitudeMag: number) => Number((2 * semiAmplitudeMag * Math.LN10 / 2.5).toFixed(6));

/** What an accepted row holds, in a sentence's words. */
const says = (row: NewtonRow) => `a grade ${row.grade} rotation period of ${row.rotationDays} d, with a sinusoid of semi-amplitude ${row.semiAmplitudeMag} mag in the star's longest dataset, of ${row.nights} nights`;
/** The paper as an entry of the published-verdict kind (tess/published.mts), its rows by the stars' 2MASS designations.
 * Which of the star's seasons the verdict is drawn for is known only from its light (light-curves.mts), so `judge` gives
 * back the windows it is handed for an accepted row. */
export const NEWTON_2018: PublishedVerdict<NewtonRow, string> = { id: 'newton-2018', citation: CITATION, url: 'https://arxiv.org/abs/1807.09365', where: 'Sects. II.1 and III, and Sect. III.1 of Newton et al. (2016, ApJ 821, 93); Table 1', catalogue: 'J/AJ/156/217', table: `VizieR ${TABLE}`,
  service: VIZIER_TAP, query: `SELECT Type, "2MASS" AS twomass, RAJ2000, DEJ2000, Per, Amp, e_Amp, Flag, NPts, NDays, "F-test" AS ftest FROM "${TABLE}"`, missions: ['MEarth'],
  lightCurve: 'the star\'s MEarth-South light curves taken before 2 March 2018, with the segment baselines and the common mode of the paper\'s model fitted beside a sinusoid',
  asks: 'to see the sinusoid of their fit by eye in the star\'s light, over two or more complete cycles and uncorrelated with the systematics of their model (grade A when each of their questions is answered yes, grade B when not all are)',
  reliability: 'The paper estimates the errors of its rotation periods at about 10%.', swing: 'twice the semi-amplitude of the sinusoid the table prints',
  parse(answered) { const rows = new Map<string, NewtonRow>();
    for (const cells of answered) { const row = parseNewtonRow(cells); if (rows.has(row.twomass)) throw new TypeError(`${TABLE}: 2MASS ${row.twomass} is listed twice.`); rows.set(row.twomass, row); }
    return rows; },
  judge(row, windows) { const no = (reason: string) => ({ verdict: { detected: false, reason }, windows: [] });
    if (row.grade === 'N') return no(`${CITATION} list the star as a non-detection.`);
    if (row.grade === 'U') return no(`${CITATION} list the star as a possible or uncertain detection, which they do not count as a rotation.`);
    if (row.contaminated) return { ...no(`${CITATION} list the star with a rotation period of ${row.rotationDays} d (grade ${row.grade}) and flag its aperture as contaminated by a companion or a background source: ${PAPER} leave such stars out of their own analysis, and the period may not be this star's.`), gives: row.rotationDays! };
    return { verdict: { detected: true, periodDays: row.rotationDays!, amplitude: swingOf(row.semiAmplitudeMag!) }, windows, gives: row.rotationDays! }; },
  says, measures: row => ({ rotationDays: row.rotationDays ?? null, semiAmplitudeMag: row.semiAmplitudeMag ?? null, semiAmplitudeErrorMag: row.semiAmplitudeErrorMag ?? null, nights: row.nights, points: row.points ?? null, fTest: row.fTest ?? null }) };
/** The papers read of a star's MEarth light, in the order they are asked. */
export const MEARTH_PAPERS: readonly PublishedVerdict<NewtonRow, string>[] = [NEWTON_2018];

/** The row of a table nearest a place, within `withinArcsec` of it: the table gives each star's J2000 place. */
export function rowAt(rows: Iterable<NewtonRow>, place: { readonly raDegrees: number; readonly decDegrees: number }, withinArcsec: number): NewtonRow | undefined {
  let best: NewtonRow | undefined, least = withinArcsec / 3600;
  for (const row of rows) { const apart = Math.hypot((row.raDegrees - place.raDegrees) * Math.cos(place.decDegrees * Math.PI / 180), row.decDegrees - place.decDegrees); if (apart <= least) { least = apart; best = row; } }
  return best;
}

/** One season of a star's light under the paper's verdict on the star: how many turns of the star it holds, and whether
 * a map is made of it. */
export interface NewtonSeason extends MearthSeason { readonly turns: number; readonly verdict: RotationVerdict }
/** A star under the paper's verdict: which of its light curves was read, what the paper's model fitted to it here, each
 * of its seasons, and what a star's page says of that light. */
export interface NewtonStar { readonly verdict: RotationVerdict; /** The file read, and what its header says of it. */ readonly filename: string; readonly file: { readonly telescope: string; readonly filter: string; readonly aperturePixels?: number; readonly deblended?: boolean };
  /** The nights of the light curve read, and the scale of the common mode and the sinusoid's semi-amplitude, magnitudes, the model fitted to it here. */ readonly fitted: { readonly datasetNights: number; readonly fittedSemiAmplitudeMag: number; readonly commonModeScale: number };
  readonly seasons: readonly NewtonSeason[]; readonly note?: string }
const listed = (items: readonly (string | number)[]) => items.join(', ').replace(/, ([^,]*)$/u, ' and $1');
/** A star's row set beside its light curves in the MEarth release. The light the paper analysed is cut at the paper's
 * last day and clipped as the paper clips it; the longest of the star's datasets is read; the paper's model is fitted
 * to it at the row's period by the paper's authors' code; and the light with the model's baselines and common mode
 * taken off is cut into the star's seasons, one point a night. A season whose nights span less than one turn of the
 * star has no map: not every longitude faced the telescope in it. That limit is no paper's: it is what a map of a
 * whole surface needs, and the one a Kepler star's quarter is held to (kepler/santos.mts). `fit` is `modelled`; a test
 * hands another. */
export async function newtonStar(row: NewtonRow, files: readonly { readonly filename: string; readonly curve: MearthLightCurve }[], place: { readonly raDegrees: number },
  fit: (curve: MearthLightCurve, periodDays: number) => Promise<MearthModel> = modelled): Promise<NewtonStar> {
  const period = row.rotationDays; if (period === undefined || row.contaminated) throw new TypeError(`2MASS ${row.twomass}: its row is no verdict of rotation, and no light is read under it.`);
  const analysed = files.map(one => ({ filename: one.filename, curve: clipped(before(one.curve, NEWTON_2018_LAST_BJD)) })), curve = longest(analysed.map(one => one.curve)), read = analysed.find(one => one.curve === curve);
  if (!curve || !read) throw new Error(`2MASS ${row.twomass}: the MEarth release holds no light of the star from before the paper's last day.`);
  if (curve.twomass !== row.twomass) throw new TypeError(`${read.filename} is the light curve of 2MASS ${curve.twomass}, not of ${row.twomass}.`);
  const model = await fit(curve, period), nights = nightsOf(curve);
  const seasons = seasonsOf(nightly(curve.bjd, model.corrected), place.raDegrees).map((season): NewtonSeason => { const turns = Number((season.spanDays / period).toFixed(2));
    return { ...season, turns, verdict: turns < 1 ? { detected: false, reason: `The star's ${season.season} season holds ${season.spanDays} days of its MEarth light, less than one turn of ${period} d: not every longitude faced the telescope in it.` } : { detected: true, periodDays: period, amplitude: swingOf(row.semiAmplitudeMag!) } }; });
  const mapped = seasons.filter(season => season.verdict.detected), short = seasons.filter(season => !season.verdict.detected);
  const note = [`The light curve mapped is the star's longest dataset in the MEarth release, that of telescope ${curve.telescope.replace(/^tel/u, '')}: ${nights} nights before 2 March 2018, where the paper's table prints ${row.nights} for its longest.`,
    `The paper's model, fitted to it here at ${period} d by its authors' code, gives the sinusoid a semi-amplitude of ${model.semiAmplitude.toFixed(4)} mag, where the table prints ${row.semiAmplitudeMag}.`,
    ...(short.length ? [`The star's ${listed(short.map(season => season.season))} season${short.length === 1 ? ' holds' : 's hold'} less than one turn of it and ${short.length === 1 ? 'has' : 'have'} no map.`] : [])].join(' ');
  const file = { telescope: curve.telescope, filter: curve.filter, ...(curve.aperturePixels === undefined ? {} : { aperturePixels: curve.aperturePixels }), ...(curve.deblended === undefined ? {} : { deblended: curve.deblended }) };
  const fitted = { datasetNights: nights, fittedSemiAmplitudeMag: model.semiAmplitude, commonModeScale: Number(model.commonModeScale.toFixed(4)) };
  return { verdict: mapped.length ? { detected: true, periodDays: period, amplitude: swingOf(row.semiAmplitudeMag!) } : { detected: false, reason: `${CITATION} list the star with a rotation period of ${period} d, and none of its seasons with MEarth holds a turn of it: ${short.map(season => season.verdict.reason).join(' ')}` },
    filename: read.filename, file, fitted, seasons, note };
}

/** The published methods that decide whether a star's light shows it turning, by the kind of star and of data each was
 * made for.
 *
 * Nothing here is this repository's judgement. Each entry carries its paper, the stars and the light curves the paper
 * applies it to, how the paper prepares a light curve, its criteria as printed, and its rule for a star observed more
 * than once. The light curve is the one the paper used, read as its publisher gives it; the periods are computed by
 * published codes (tools.py `rotation`: astropy's generalized Lomb-Scargle, star-privateer's wavelet and
 * autocorrelation). A star or a light curve no entry covers is given no verdict: `methodFor` and `covers` say so in the
 * paper's own terms.
 *
 * To add a kind of star or of data, read the paper that treats it and add its entry; do not widen an entry beyond what
 * its paper says, and do not add a threshold no paper prints. A paper whose code cannot be run here has its own verdict
 * on a star read from its published table instead (published.mts). */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { Mission, RotationVerdict } from './verdict.mts';
import { runTool, toolchainPaths } from './toolchain.mts';

/** A planet's transits across the star, from its published orbit: the period, a mid-transit time as a barycentric Julian
 * date, and how long a transit lasts, days. */
export interface Transit { readonly periodDays: number; readonly epochBjd: number; readonly durationDays: number }
/** What a star's record says of the kind of star it is, and the transits its light holds. */
export interface StarKind { readonly effectiveTemperatureK?: number; readonly surfaceGravityLogg?: number; readonly transits?: readonly Transit[] }
/** What the catalogue a method's paper selects its stars from says of a light curve's target, as the file's own header
 * carries it (tools.py `input-catalogue`): a value the header leaves blank is absent. */
export interface InputCatalogue { readonly tic: number; readonly version: string; readonly effectiveTemperatureK?: number; readonly surfaceGravityLogg?: number }
/** A mission's own light curve of one window, as tools.py `mission-light-curve` read it. */
export interface MissionLightCurve { readonly frames: number; readonly window: number; /** The version of the mission's pipeline that made it, from the file's header. */ readonly pipeline: string; readonly time: readonly number[]; readonly flux: readonly number[] }
/** What tools.py `rotation` measured of one light curve, prepared the way the method's paper prepares it. */
export interface RotationAnalysis { readonly spanDays: number; /** The 95th less the 5th percentile of the light, as a share of its mean. */ readonly variabilityRange: number;
  /** The highest peak of the generalized Lomb-Scargle periodogram, 0 to 1, and its period. */ readonly peakHeight: number; readonly lombScargleDays: number;
  readonly waveletDays: number; readonly autocorrelationDays: number; readonly starPrivateer: string;
  /** The prepared light curve: what the periods were measured on, and what a map is made from. */ readonly time: readonly number[]; readonly flux: readonly number[] }

/** What a method measured and decided of one window's light curve: the numbers its criteria read, those numbers in a
 * sentence's words, its verdict, and the light curve as the method prepared it, which a map is made from. */
export interface WindowResult { readonly window: number; readonly pipeline: string; readonly frames: number; readonly measures: Readonly<Record<string, number | null>>; readonly says: string; readonly verdict: RotationVerdict;
  readonly time: readonly number[]; readonly flux: readonly number[] }
/** A star's windows as a method judged them, what it measured of them all together when its paper asks for that, and its verdict for the star. */
export interface StarResult { readonly windows: readonly WindowResult[]; readonly whole?: { readonly measures: Readonly<Record<string, number | null>>; readonly says: string; readonly verdict: RotationVerdict }; readonly verdict: RotationVerdict }

export interface PeriodMethod { readonly id: string; readonly citation: string; readonly url: string; /** Where in the paper the method and its criteria are printed. */ readonly where: string;
  readonly missions: readonly Mission[]; /** The light curve the paper applies the method to. */ readonly lightCurve: string;
  /** What the paper asks of a light curve to accept a rotation, in a sentence's words. */ readonly asks: string;
  /** What the paper itself measured of its periods' reliability. */ readonly reliability: string;
  /** Why the paper's method is not for this star, when it is not. */ outside(star: StarKind): string | undefined;
  /** The catalogue the paper takes a star's temperature and gravity from, when a light curve's file carries its values. */ readonly catalogue?: { readonly name: string; read(file: string): Promise<InputCatalogue> };
  /** Why the paper does not cover a window of the mission, when it does not. */ covers(window: number): string | undefined;
  /** The paper's method on a star's light curve files, one a window: what it measures of each and of the star, and its verdicts. */
  judge(files: readonly string[], star: StarKind): Promise<StarResult> }

/** Reinhold & Hekker (2020), "Stellar rotation periods from K2 Campaigns 0-18", A&A 635, A43, Sects. 2 and 3. Each light
 * curve is divided by a third-order polynomial, points more than six median absolute deviations from the median are
 * removed, and it is binned to three hours. The Lomb-Scargle peak must be higher than 0.3; the periods of the
 * periodogram, the wavelet power spectrum and the autocorrelation may differ by at most one day under 10 days, two days
 * from 10 to 20 and five days beyond; the rotation period is their mean, longer than a day and shorter than half the time
 * span; stars are between 3250 and 6250 K with log g over 4.2; a variability range over 10% is discarded. The light
 * curves are the mission's own, reduced by its PDC-MAP pipeline, of campaigns 0 to 18 without campaign 9. For a star
 * observed in several campaigns the paper takes the mean of the campaigns' periods and variabilities, and excludes a
 * star whose periods deviate by more than 20% (two periods agree when they differ by under 20% of their mean, Sect. 3.1). */
const RH = { campaigns: [0, 18], leftOut: 9, deviation: 0.2, peakHeight: 0.3, agreementDays: [[10, 1], [20, 2], [Infinity, 5]], shortestDays: 1, spanShare: 2, temperatureK: [3250, 6250], logg: 4.2, variabilityRange: 0.1 } as const;
/** How the paper prepares a light curve: the degree of the polynomial it is divided by, how many median absolute deviations
 * from the median make a point an outlier, and the width of the bins, days. */
const RH_PREPARATION = { trendDegree: 3, outlierDeviations: 6, binDays: 0.125 } as const;
const rhVerdict = (analysis: RotationAnalysis): RotationVerdict => { const { lombScargleDays: peak, waveletDays, autocorrelationDays } = analysis, periods = [peak, waveletDays, autocorrelationDays], two = (days: number) => days.toFixed(2);
  const allowed = RH.agreementDays.find(([under]) => peak < under)![1], mean = Number((periods.reduce((sum, days) => sum + days, 0) / periods.length).toFixed(2));
  if (analysis.peakHeight <= RH.peakHeight) return { detected: false, reason: `The periodogram's highest peak, at ${two(peak)} d, has a height of ${analysis.peakHeight.toFixed(2)}, not over the 0.3 that Reinhold & Hekker (2020) ask of a rotation.` };
  if (Math.max(...periods) - Math.min(...periods) > allowed) return { detected: false, reason: `The three methods of Reinhold & Hekker (2020) do not agree within the ${allowed} d they allow at this period: ${two(peak)} d (periodogram), ${two(waveletDays)} d (wavelet) and ${two(autocorrelationDays)} d (autocorrelation).` };
  if (mean <= RH.shortestDays || mean >= analysis.spanDays / RH.spanShare) return { detected: false, reason: `A period of ${mean} d is outside the range Reinhold & Hekker (2020) accept: longer than a day and shorter than half the ${Math.round(analysis.spanDays)} days of light.` };
  if (analysis.variabilityRange > RH.variabilityRange) return { detected: false, reason: `The light varies by ${(100 * analysis.variabilityRange).toFixed(0)}%, over the 10% beyond which Reinhold & Hekker (2020) discard a light curve as badly reduced.` };
  return { detected: true, periodDays: mean, amplitude: analysis.variabilityRange }; };
/** The paper's rule for a star observed in several campaigns, applied to their verdicts. */
const rhStar = (verdicts: readonly RotationVerdict[]): RotationVerdict => { const seen = verdicts.filter(verdict => verdict.detected && verdict.periodDays !== undefined);
  if (seen.length < 2) return seen[0] ?? verdicts[0] ?? { detected: false, reason: 'No campaign of the star is one Reinhold & Hekker (2020) analyse.' };
  const periods = seen.map(verdict => verdict.periodDays!), mean = periods.reduce((sum, days) => sum + days, 0) / periods.length;
  if (Math.max(...periods) - Math.min(...periods) > RH.deviation * mean) return { detected: false, reason: `The star's campaigns give periods of ${periods.join(' and ')} d, which deviate by more than the 20% beyond which Reinhold & Hekker (2020) exclude a star.` };
  return { detected: true, periodDays: Number(mean.toFixed(2)), amplitude: seen.reduce((sum, verdict) => sum + (verdict.amplitude ?? 0), 0) / seen.length }; };
export const REINHOLD_HEKKER_2020: PeriodMethod & { verdict(analysis: RotationAnalysis): RotationVerdict; star(verdicts: readonly RotationVerdict[]): RotationVerdict } = { id: 'reinhold-hekker-2020', citation: 'Reinhold & Hekker (2020, A&A 635, A43)', url: 'https://arxiv.org/abs/2001.08214', where: 'Sects. 2 and 3', missions: ['K2'], lightCurve: 'the K2 mission\'s long-cadence light curve of a campaign, reduced by its PDC-MAP pipeline',
  asks: 'the periodogram, the wavelet and the autocorrelation to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3',
  reliability: 'Of the paper\'s stars observed in two campaigns, 75.7% gave periods within 20% of each other.',
  outside(star) {
    if (star.effectiveTemperatureK === undefined || star.surfaceGravityLogg === undefined) return 'The star\'s record holds no temperature or no surface gravity, and Reinhold & Hekker (2020) apply their method to stars between 3250 and 6250 K with log g over 4.2.';
    if (star.effectiveTemperatureK <= RH.temperatureK[0] || star.effectiveTemperatureK >= RH.temperatureK[1]) return `At ${Math.round(star.effectiveTemperatureK)} K the star is outside the 3250 to 6250 K that Reinhold & Hekker (2020) apply their method to.`;
    if (star.surfaceGravityLogg <= RH.logg) return `With log g ${star.surfaceGravityLogg} the star is evolved: Reinhold & Hekker (2020) apply their method to stars with log g over 4.2.`;
    return undefined; },
  covers(campaign) { return campaign === RH.leftOut || campaign < RH.campaigns[0] || campaign > RH.campaigns[1] ? `Reinhold & Hekker (2020) analyse campaigns 0 to 18 without campaign 9, not campaign ${campaign}.` : undefined; },
  verdict: rhVerdict, star: rhStar,
  async judge(files) { const windows: WindowResult[] = [];
    for (const file of files) { const curve = await missionLightCurve(file), analysis = await rotationAnalysis(RH_PREPARATION, curve.time, curve.flux), two = (days: number) => days.toFixed(2);
      windows.push({ window: curve.window, pipeline: curve.pipeline, frames: curve.frames, verdict: rhVerdict(analysis), time: analysis.time, flux: analysis.flux,
        measures: { spanDays: Number(analysis.spanDays.toFixed(1)), variabilityRange: analysis.variabilityRange, peakHeight: analysis.peakHeight, lombScargleDays: analysis.lombScargleDays, waveletDays: analysis.waveletDays, autocorrelationDays: analysis.autocorrelationDays },
        says: `periodogram ${two(analysis.lombScargleDays)} d, wavelet ${two(analysis.waveletDays)} d, autocorrelation ${two(analysis.autocorrelationDays)} d; periodogram peak ${analysis.peakHeight.toFixed(2)}` }); }
    return { windows, verdict: rhStar(windows.map(window => window.verdict)) }; } };

/** Holcomb et al. (2022), "SpinSpotter", ApJ 936, 138, Sects. II and III. The light curves are the TESS mission's 2-minute
 * PDC-MAP light curves, binned to 30 minutes, with known transits masked. Stars are dwarfs by the cuts of Ciardi et al.
 * (2011) on the star's temperature and surface gravity: log g at least 3.5 at 6000 K or hotter, at least 4.0 at 4250 K or
 * cooler, and at least 5.2 - 0.00028 T between; a star without either is left out. SpinSpotter is run on each sector and
 * on the stitched light curve. A period is valid when the autocorrelation's peaks have a height over a quarter of their
 * width, a width between 0.4 and 0.6, and a parabola fit over 0.9; a star with several sectors needs a valid period in at
 * least half of them, rounded up, and in the stitched light curve. A star whose light is lopsided (the midpoint of its
 * 5th and 95th percentiles farther than 0.01 from zero) is removed as a possible eclipsing binary.
 *
 * The paper's sample is sectors 1 to 26, and its criteria are stated for "the TESS 2-minute cadence data"; they are
 * applied here to any sector's 2-minute light curve. That is this entry's reading of the paper, not a sentence in it.
 *
 * The paper takes temperature and gravity from the TESS Input Catalog v7 (Sect. III). A star's record is read first
 * here; a value the record lacks is taken from the catalog as the header of the star's own 2-minute light curve carries
 * it (`catalogue`; v8 in the files read, not the paper's v7), and never replaces a value the record holds. */
const HOLCOMB = { binSeconds: 1800, timeZero: 2457000, heightOverWidth: 0.25, width: [0.4, 0.6], fit: 0.9, lopsided: 0.01 } as const;
type Spin = { readonly periodDays: number | null; readonly height: number | null; readonly width: number | null; readonly fit: number | null; readonly centre: number; readonly range: number };
const spinVerdict = (spin: Spin, of: string): RotationVerdict => { const { periodDays, height, width, fit } = spin;
  if (periodDays === null || height === null || width === null || fit === null) return { detected: false, reason: `SpinSpotter finds no repeating peaks in the autocorrelation of ${of}.` };
  if (!(height / width > HOLCOMB.heightOverWidth && width > HOLCOMB.width[0] && width < HOLCOMB.width[1] && fit > HOLCOMB.fit)) return { detected: false, reason: `The autocorrelation of ${of} gives ${periodDays.toFixed(2)} d with peaks of height ${height.toFixed(2)}, width ${width.toFixed(2)} and fit ${fit.toFixed(2)}, outside what Holcomb et al. (2022) accept (a height over a quarter of the width, a width between 0.4 and 0.6, a fit over 0.9).` };
  return { detected: true, periodDays: Number(periodDays.toFixed(2)), amplitude: spin.range }; };
const spinSays = (spin: Spin) => spin.periodDays === null || spin.height === null || spin.width === null || spin.fit === null ? 'no repeating peaks in the autocorrelation' : `a period of ${spin.periodDays.toFixed(2)} d from the autocorrelation, whose peaks have a height of ${spin.height.toFixed(2)}, a width of ${spin.width.toFixed(2)} and a fit of ${spin.fit.toFixed(2)}`;
const spinMeasures = (spin: Spin) => ({ periodDays: spin.periodDays, height: spin.height, width: spin.width, fit: spin.fit, centre: spin.centre, range: spin.range });
/** What tools.py `spinspotter` printed of one light curve. */
function parseSpin(value: unknown, what: string): Spin { const record = requireRecord(value, what), number = (key: string) => record[key] === null ? null : requireFiniteNumber(record[key], `${what} ${key}`);
  return { periodDays: number('periodDays'), height: number('height'), width: number('width'), fit: number('fit'), centre: requireFiniteNumber(record.centre, `${what} centre`), range: requireFiniteNumber(record.range, `${what} range`) }; }
/** The paper's rule for a star: its light not lopsided, a valid period in at least half its sectors and, with several, in the stitched light curve, whose period is the star's. */
export function holcombStar(sectors: readonly { readonly spin: Spin; readonly verdict: RotationVerdict }[], whole: { readonly spin: Spin; readonly verdict: RotationVerdict } | undefined): RotationVerdict {
  const all = whole ?? sectors[0]; if (!all) return { detected: false, reason: 'The star has no TESS 2-minute light curve.' };
  if (Math.abs(all.spin.centre) > HOLCOMB.lopsided) return { detected: false, reason: `The star's light is lopsided (the midpoint of its 5th and 95th percentiles is ${all.spin.centre.toFixed(3)} from its middle, over the 0.01 beyond which Holcomb et al. (2022) remove a star as a possible eclipsing binary).` };
  const valid = sectors.filter(sector => sector.verdict.detected).length, needed = Math.ceil(sectors.length / 2);
  if (valid < needed) return { detected: false, reason: sectors.length === 1 ? sectors[0]!.verdict.reason! : `A valid period is found in ${valid} of the star's ${sectors.length} sectors, and Holcomb et al. (2022) ask for at least ${needed}.` };
  if (!all.verdict.detected) return { detected: false, reason: `The star's sectors together do not give a valid period: ${all.verdict.reason}` };
  return all.verdict; }
export const HOLCOMB_2022: PeriodMethod = { id: 'holcomb-2022', citation: 'Holcomb et al. (2022, ApJ 936, 138)', url: 'https://arxiv.org/abs/2206.10629', where: 'Sects. II and III', missions: ['TESS'],
  lightCurve: 'the TESS mission\'s 2-minute light curve of a sector, reduced by its PDC-MAP pipeline and binned to 30 minutes',
  asks: 'the peaks of the light\'s autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star\'s sectors and in all of them together',
  reliability: 'On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set.',
  outside(star) { const temperature = star.effectiveTemperatureK, gravity = star.surfaceGravityLogg;
    if (temperature === undefined || gravity === undefined) return 'The star\'s record holds no temperature or no surface gravity, and Holcomb et al. (2022) leave such stars out.';
    const least = temperature >= 6000 ? 3.5 : temperature <= 4250 ? 4.0 : 5.2 - 2.8e-4 * temperature;
    return gravity >= least ? undefined : `With log g ${gravity} at ${Math.round(temperature)} K the star is not a dwarf by the cuts Holcomb et al. (2022) apply (log g at least ${Number(least.toFixed(2))} at that temperature).`; },
  covers: () => undefined, catalogue: { name: 'TESS Input Catalog', read: inputCatalogue },
  async judge(files, star) { const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'spin-')), job = join(directory, 'job.json'), transits = star.transits ?? [];
    try { await writeFile(job, JSON.stringify({ files, binSeconds: HOLCOMB.binSeconds, timeZero: HOLCOMB.timeZero, ...(transits.length ? { transit: [transits.map(one => one.periodDays), transits.map(one => one.epochBjd), transits.map(one => one.durationDays)] } : {}) }));
      const printed = requireRecord(runTool(python, ['spinspotter', job]), 'SpinSpotter\'s answer'), numbers = (value: unknown, key: string) => requireArray(value, key).map((entry, index) => requireFiniteNumber(entry, `${key}[${index}]`));
      const sectors = requireArray(printed.sectors, 'sectors').map((entry, index) => { const record = requireRecord(entry, `sector ${index}`), window = requireFiniteNumber(record.sector, 'sector'), spin = parseSpin(record, `sector ${window}`);
        return { spin, window, pipeline: requireString(record.pipeline, 'pipeline'), frames: requireFiniteNumber(record.frames, 'frames'), measures: spinMeasures(spin), says: spinSays(spin), verdict: spinVerdict(spin, `sector ${window}`), time: numbers(record.time, 'time'), flux: numbers(record.flux, 'flux') }; });
      const stitched = printed.stitched === null || printed.stitched === undefined ? undefined : parseSpin(printed.stitched, 'the stitched light curve'), whole = stitched && { spin: stitched, measures: spinMeasures(stitched), says: spinSays(stitched), verdict: spinVerdict(stitched, 'all the sectors together') };
      return { windows: sectors.map(({ spin: _spin, ...window }) => window), ...(whole ? { whole: { measures: whole.measures, says: whole.says, verdict: whole.verdict } } : {}), verdict: holcombStar(sectors, whole) }; }
    finally { await rm(directory, { recursive: true, force: true }); } } };

/** Every method wired, in the order they are tried. */
export const METHODS: readonly PeriodMethod[] = [REINHOLD_HEKKER_2020, HOLCOMB_2022];

/** The method for a star's light from a mission, or why no published method here covers it. */
export function methodFor(mission: Mission, star: StarKind): { readonly method: PeriodMethod } | { readonly reason: string } {
  const made = METHODS.filter(method => method.missions.includes(mission));
  if (!made.length) return { reason: `No published method is wired here for a ${mission === 'K2' ? 'K2 campaign' : 'TESS sector'}.` };
  const reasons: string[] = [];
  for (const method of made) { const reason = method.outside(star); if (reason === undefined) return { method }; reasons.push(reason); }
  return { reason: reasons.join(' ') };
}

/** What tools.py `input-catalogue` printed for a light curve file. */
export function parseInputCatalogue(value: unknown): InputCatalogue {
  const record = requireRecord(value, 'input catalogue'), number = (key: string) => record[key] === null || record[key] === undefined ? undefined : requireFiniteNumber(record[key], key), temperature = number('effectiveTemperatureK'), gravity = number('surfaceGravityLogg');
  // The header prints the catalog's version as a string ("8.2") or as a bare number (8).
  return { tic: requireFiniteNumber(record.tic, 'TIC number'), version: typeof record.version === 'number' ? String(requireFiniteNumber(record.version, 'TIC version')) : requireString(record.version, 'TIC version'), ...(temperature === undefined ? {} : { effectiveTemperatureK: temperature }), ...(gravity === undefined ? {} : { surfaceGravityLogg: gravity }) };
}
/** The TESS Input Catalog's values for the target of a 2-minute light curve, from the file's primary header. */
export async function inputCatalogue(file: string): Promise<InputCatalogue> {
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'catalogue-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ file })); return parseInputCatalogue(runTool(python, ['input-catalogue', job])); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
/** A star's kind with the catalogue's value where its record holds none, and which values those are. A value the record
 * holds is never replaced. */
export function filled(star: StarKind, from: InputCatalogue): { readonly star: StarKind; readonly fills: readonly ('effectiveTemperatureK' | 'surfaceGravityLogg')[] } {
  const fills = (['effectiveTemperatureK', 'surfaceGravityLogg'] as const).filter(key => star[key] === undefined && from[key] !== undefined);
  return { star: { ...star, ...Object.fromEntries(fills.map(key => [key, from[key]])) }, fills };
}
/** How far from a star's place a catalogue's entry, or a mission's target, may lie and still be the star, arcseconds: the
 * metadata pass's own measure for a catalogue's row of a star (new-object/metadata/rotation-catalogues.mts). A light curve
 * is listed within a pixel of a star, 21 arcseconds, and a companion that near is another entry of the catalogue and
 * often no target of its own: the nearest light curve is then its neighbour's. */
export const SAME_STAR_ARCSEC = 3;
/** What the catalogue gives, in a sentence's words: "5023 K and log g 4.58", "4575 K and no surface gravity". */
export const catalogueSays = (from: InputCatalogue) => `${from.effectiveTemperatureK === undefined ? 'no temperature' : `${Math.round(from.effectiveTemperatureK)} K`} and ${from.surfaceGravityLogg === undefined ? 'no surface gravity' : `log g ${Number(from.surfaceGravityLogg.toFixed(2))}`}`;

/** What tools.py printed for a mission's light curve file. */
export function parseMissionLightCurve(value: unknown): MissionLightCurve {
  const record = requireRecord(value, 'mission light curve'), numbers = (key: string) => requireArray(record[key], key).map((entry, index) => requireFiniteNumber(entry, `${key}[${index}]`)), time = numbers('time'), flux = numbers('flux');
  if (time.length !== flux.length || time.length < 2) throw new TypeError('The mission\'s light curve has times and fluxes of different lengths, or none.');
  return { frames: requireFiniteNumber(record.frames, 'frames'), window: requireFiniteNumber(record.window, 'window'), pipeline: requireString(record.pipeline, 'pipeline'), time, flux };
}
/** A mission's light curve file, read as the mission publishes it. */
export async function missionLightCurve(file: string): Promise<MissionLightCurve> {
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'mission-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ file })); return parseMissionLightCurve(runTool(python, ['mission-light-curve', job])); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

/** What tools.py printed for one light curve. */
export function parseAnalysis(value: unknown): RotationAnalysis {
  const record = requireRecord(value, 'rotation analysis'), number = (key: string) => requireFiniteNumber(record[key], key), numbers = (key: string) => requireArray(record[key], key).map((entry, index) => requireFiniteNumber(entry, `${key}[${index}]`));
  const time = numbers('time'), flux = numbers('flux');
  if (time.length !== flux.length || !time.length) throw new TypeError('The prepared light curve has times and fluxes of different lengths.');
  return { spanDays: number('spanDays'), variabilityRange: number('variabilityRange'), peakHeight: number('peakHeight'), lombScargleDays: number('lombScargleDays'), waveletDays: number('waveletDays'),
    autocorrelationDays: number('autocorrelationDays'), starPrivateer: requireString(record.starPrivateer, 'star-privateer version'), time, flux };
}

/** How many trial frequencies the periodogram is computed at, between the time span and the Nyquist frequency. */
export const ANALYSIS_FREQUENCIES = 20000;
/** A light curve's periods by the three methods of Reinhold & Hekker (2020), prepared as `preparation` says. */
export async function rotationAnalysis(preparation: { readonly trendDegree: number; readonly outlierDeviations: number; readonly binDays: number }, time: readonly number[], flux: readonly number[]): Promise<RotationAnalysis> {
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'rotation-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ time, flux, ...preparation, frequencies: ANALYSIS_FREQUENCIES })); return parseAnalysis(runTool(python, ['rotation', job])); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

/** The published methods that decide whether a star's light shows it turning, by the kind of star and of data each was
 * made for.
 *
 * Nothing here is this repository's judgement. Each entry carries its paper, the stars and the data the paper applies it
 * to, how the paper prepares a light curve, and its criteria as printed. The periods are computed by published codes
 * (tools.py `rotation`: astropy's generalized Lomb-Scargle, star-privateer's wavelet and autocorrelation). A star no
 * entry covers is given no verdict: `methodFor` says so in the paper's own terms.
 *
 * To add a kind of star or of data, read the paper that treats it and add its entry; do not widen an entry beyond what
 * its paper says, and do not add a threshold no paper prints. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { Mission, RotationVerdict } from './photometry.mts';
import { runTool, toolchainPaths } from './toolchain.mts';

/** What a star's record says of the kind of star it is. */
export interface StarKind { readonly effectiveTemperatureK?: number; readonly surfaceGravityLogg?: number }
/** What tools.py `rotation` measured of one light curve, prepared the way the method's paper prepares it. */
export interface RotationAnalysis { readonly spanDays: number; /** The 95th less the 5th percentile of the light, as a share of its mean. */ readonly variabilityRange: number;
  /** The highest peak of the generalized Lomb-Scargle periodogram, 0 to 1, and its period. */ readonly peakHeight: number; readonly lombScargleDays: number;
  readonly waveletDays: number; readonly autocorrelationDays: number; readonly starPrivateer: string;
  /** The prepared light curve: what the periods were measured on, and what a map is made from. */ readonly time: readonly number[]; readonly flux: readonly number[] }

export interface PeriodMethod { readonly id: string; readonly citation: string; readonly url: string; /** Where in the paper the method and its criteria are printed. */ readonly where: string;
  readonly missions: readonly Mission[];
  /** How the paper prepares a light curve: the degree of the polynomial it is divided by, how many median absolute
   * deviations from the median make a point an outlier, and the width of the bins, days. */
  readonly preparation: { readonly trendDegree: number; readonly outlierDeviations: number; readonly binDays: number };
  /** What the paper itself measured of its periods' reliability. */ readonly reliability: string;
  /** Why the paper's method is not for this star, when it is not. */ outside(star: StarKind): string | undefined;
  /** The paper's criteria, applied to what was measured. */ verdict(analysis: RotationAnalysis): RotationVerdict }

/** Reinhold & Hekker (2020), "Stellar rotation periods from K2 Campaigns 0-18", A&A 635, A43, Sects. 2 and 3. Each light
 * curve is divided by a third-order polynomial, points more than six median absolute deviations from the median are
 * removed, and it is binned to three hours. The Lomb-Scargle peak must be higher than 0.3; the periods of the
 * periodogram, the wavelet power spectrum and the autocorrelation may differ by at most one day under 10 days, two days
 * from 10 to 20 and five days beyond; the rotation period is their mean, longer than a day and shorter than half the time
 * span; stars are between 3250 and 6250 K with log g over 4.2; a variability range over 10% is discarded. */
const RH = { peakHeight: 0.3, agreementDays: [[10, 1], [20, 2], [Infinity, 5]], shortestDays: 1, spanShare: 2, temperatureK: [3250, 6250], logg: 4.2, variabilityRange: 0.1 } as const;
export const REINHOLD_HEKKER_2020: PeriodMethod = { id: 'reinhold-hekker-2020', citation: 'Reinhold & Hekker (2020, A&A 635, A43)', url: 'https://arxiv.org/abs/2001.08214', where: 'Sects. 2 and 3', missions: ['K2'],
  preparation: { trendDegree: 3, outlierDeviations: 6, binDays: 0.125 },
  reliability: 'Of the paper\'s stars observed in two campaigns, 75.7% gave periods within 20% of each other.',
  outside(star) {
    if (star.effectiveTemperatureK === undefined || star.surfaceGravityLogg === undefined) return 'The star\'s record holds no temperature or no surface gravity, and Reinhold & Hekker (2020) apply their method to stars between 3250 and 6250 K with log g over 4.2.';
    if (star.effectiveTemperatureK <= RH.temperatureK[0] || star.effectiveTemperatureK >= RH.temperatureK[1]) return `At ${Math.round(star.effectiveTemperatureK)} K the star is outside the 3250 to 6250 K that Reinhold & Hekker (2020) apply their method to.`;
    if (star.surfaceGravityLogg <= RH.logg) return `With log g ${star.surfaceGravityLogg} the star is evolved: Reinhold & Hekker (2020) apply their method to stars with log g over 4.2.`;
    return undefined; },
  verdict(analysis) { const { lombScargleDays: peak, waveletDays, autocorrelationDays } = analysis, periods = [peak, waveletDays, autocorrelationDays], two = (days: number) => days.toFixed(2);
    const allowed = RH.agreementDays.find(([under]) => peak < under)![1], mean = Number((periods.reduce((sum, days) => sum + days, 0) / periods.length).toFixed(2));
    if (analysis.peakHeight <= RH.peakHeight) return { detected: false, reason: `The periodogram's highest peak, at ${two(peak)} d, has a height of ${analysis.peakHeight.toFixed(2)}, not over the 0.3 that Reinhold & Hekker (2020) ask of a rotation.` };
    if (Math.max(...periods) - Math.min(...periods) > allowed) return { detected: false, reason: `The three methods of Reinhold & Hekker (2020) do not agree within the ${allowed} d they allow at this period: ${two(peak)} d (periodogram), ${two(waveletDays)} d (wavelet) and ${two(autocorrelationDays)} d (autocorrelation).` };
    if (mean <= RH.shortestDays || mean >= analysis.spanDays / RH.spanShare) return { detected: false, reason: `A period of ${mean} d is outside the range Reinhold & Hekker (2020) accept: longer than a day and shorter than half the ${Math.round(analysis.spanDays)} days of light.` };
    if (analysis.variabilityRange > RH.variabilityRange) return { detected: false, reason: `The light varies by ${(100 * analysis.variabilityRange).toFixed(0)}%, over the 10% beyond which Reinhold & Hekker (2020) discard a light curve as badly reduced.` };
    return { detected: true, periodDays: mean, amplitude: analysis.variabilityRange }; } };

/** Every method wired, in the order they are tried. */
export const METHODS: readonly PeriodMethod[] = [REINHOLD_HEKKER_2020];

/** The method for a star's light from a mission, or why no published method here covers it. */
export function methodFor(mission: Mission, star: StarKind): { readonly method: PeriodMethod } | { readonly reason: string } {
  const made = METHODS.filter(method => method.missions.includes(mission));
  if (!made.length) return { reason: `No published method is wired here for one ${mission === 'Kepler' ? 'Kepler quarter' : mission === 'K2' ? 'K2 campaign' : 'TESS sector'} of light.` };
  const reasons: string[] = [];
  for (const method of made) { const reason = method.outside(star); if (reason === undefined) return { method }; reasons.push(reason); }
  return { reason: reasons.join(' ') };
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
/** A measured light curve's periods by the three methods, prepared as `method`'s paper prepares it. */
export async function rotationAnalysis(method: PeriodMethod, time: readonly number[], flux: readonly number[]): Promise<RotationAnalysis> {
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'rotation-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ time, flux, ...method.preparation, frequencies: ANALYSIS_FREQUENCIES })); return parseAnalysis(runTool(python, ['rotation', job])); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

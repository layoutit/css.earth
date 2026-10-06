/** A star's light curve from its TESS pixels, and the period of its light.
 *
 * The science is not this module's: lightkurve measures the star's light from the pixels and regresses the sky's own
 * variation out of it, and astropy's Lomb-Scargle periodogram finds the period (tools.py holds the calls, toolchain.json
 * pins the codes). What is written here is the job those calls read and the reading of what they print.
 *
 * The choices the codes leave open are the constants below. Each is to be settled against the mission's own light curves
 * of the same stars and sectors (benchmark), not by taste; the values here are the ones the first comparison supports:
 * two sky terms reproduce AB Pictoris's 3.89-day rotation with a correlation of 0.997, and five remove it. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isRecord, requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { runTool, toolchainPaths } from './toolchain.mts';

/** A pixel belongs to the star when it stands this many standard deviations above the cutout's median (lightkurve's threshold mask). */
export const APERTURE_THRESHOLD = 3;
/** How many of the sky pixels' main ways of varying together are regressed out of the star's light. */
export const SKY_TERMS = 2;
/** The light curve is averaged into bins this long before its period is looked for, days. */
export const BIN_DAYS = 1 / 48;
/** The shortest period looked for, days, and how many trial frequencies. */
export const SHORTEST_DAYS = 0.1, FREQUENCIES = 20000;
/** A cutout with a pixel above this is saturated: the star's light has bled along the detector's columns, and an aperture misses it. */
export const SATURATION_ELECTRONS_PER_SECOND = 1.5e5;

export interface Peak { readonly periodDays: number; readonly power: number; /** Peak to peak, as a share of the star's mean light. */ readonly amplitude: number }
export interface SectorLightCurve { readonly frames: number; readonly aperturePixels: number; readonly saturated: boolean; readonly spanDays: number; readonly scatter: number;
  readonly whole: Peak; /** The same search in each of the sector's two orbits, where an orbit holds enough of the curve. */ readonly halves: readonly (Peak | null)[];
  readonly time: readonly number[]; readonly flux: readonly number[] }

/** When one sector's light curve is believed to show the star turning. Settled on our own stars whose rotation the
 * catalogues print and whose light the mission also measured: with these values every period the rule accepted was the
 * mission's or the catalogue's (17 of 17 on the first 37 stars); without the limit on the period, 2 of 19 were wrong, both
 * longer than 9 days, where a sector holds too few turns. */
export const ROTATION_POWER = 0.3, ORBIT_AGREEMENT = 0.2, ONE_SECTOR_DAYS = 9;
export interface RotationVerdict { readonly detected: boolean; readonly periodDays?: number; /** Peak to peak, as a share of the mean light. */ readonly amplitude?: number; readonly reason?: string }

/** Whether a sector's light curve shows the star's rotation, and why not when it does not. */
export function rotationVerdict(curve: SectorLightCurve): RotationVerdict {
  const { whole, halves } = curve, days = Number(whole.periodDays.toFixed(2));
  if (curve.saturated) return { detected: false, reason: 'The star saturates the detector: its light has bled out of the aperture.' };
  if (whole.power < ROTATION_POWER) return { detected: false, reason: `No period stands out: the strongest, ${days} d, has a periodogram power of ${whole.power.toFixed(2)}, under the ${ROTATION_POWER} a rotation asks for.` };
  if (!halves.every(half => half !== null && Math.abs(half.periodDays - whole.periodDays) <= ORBIT_AGREEMENT * whole.periodDays)) return { detected: false, reason: `The sector's two orbits do not show the same period (${halves.map(half => half === null ? 'none' : `${half.periodDays.toFixed(2)} d`).join(' and ')} against ${days} d over both).` };
  if (whole.periodDays > ONE_SECTOR_DAYS) return { detected: false, periodDays: days, reason: `A period of ${days} d is longer than the ${ONE_SECTOR_DAYS} d one sector can vouch for: a second sector has to show it too.` };
  return { detected: true, periodDays: days, amplitude: whole.amplitude };
}

const peak = (value: unknown, what: string): Peak => { const record = requireRecord(value, what); return { periodDays: requireFiniteNumber(record.periodDays, `${what} period`), power: requireFiniteNumber(record.power, `${what} power`), amplitude: requireFiniteNumber(record.amplitude, `${what} amplitude`) }; };

/** What tools.py printed for one cutout; undefined when no pixel stood above the sky at the star. */
export function parseLightCurve(value: unknown): SectorLightCurve | undefined {
  const record = requireRecord(value, 'light curve');
  if (requireFiniteNumber(record.aperturePixels, 'aperture pixels') === 0) return undefined;
  const numbers = (key: string) => requireArray(record[key], key).map((entry, index) => requireFiniteNumber(entry, `${key}[${index}]`)), time = numbers('time'), flux = numbers('flux');
  if (time.length !== flux.length || !time.length) throw new TypeError('The light curve has times and fluxes of different lengths.');
  return { frames: requireFiniteNumber(record.frames, 'frames'), aperturePixels: requireFiniteNumber(record.aperturePixels, 'aperture pixels'), saturated: record.saturated === true, spanDays: requireFiniteNumber(record.spanDays, 'span'),
    scatter: requireFiniteNumber(record.scatter, 'scatter'), whole: peak(record.whole, 'whole sector'), halves: requireArray(record.halves, 'halves').map((half, index) => isRecord(half) ? peak(half, `orbit ${index + 1}`) : null), time, flux };
}

/** One sector's light curve of a star, from the cutout file of its pixels. */
export async function sectorLightCurve(cutoutFile: string): Promise<SectorLightCurve | undefined> {
  const { python } = await toolchainPaths(), directory = await mkdtemp(join(tmpdir(), 'tess-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ cutout: cutoutFile, threshold: APERTURE_THRESHOLD, skyTerms: SKY_TERMS, binDays: BIN_DAYS, shortestDays: SHORTEST_DAYS, frequencies: FREQUENCIES, saturationElectronsPerSecond: SATURATION_ELECTRONS_PER_SECOND }));
    return parseLightCurve(runTool(python, ['light-curve', job])); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

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

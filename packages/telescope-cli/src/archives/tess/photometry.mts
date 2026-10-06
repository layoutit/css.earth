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
 * catalogues print and whose light the mission also measured (76 of them measured from pixels): with these values every
 * period the rule accepted was the catalogue's or the mission's, 24 of 24. Without the floor on the light's swing 3 of 33
 * were wrong, all swinging under 0.7%; and both periods over 9 days that passed the other tests were wrong, a sector
 * holding too few turns and the spacecraft's own 13.7-day orbit leaving its mark in the light. In each star's newest
 * ten-minute sector the rule accepted 20, 19 at the right period and one at half of it (besideCatalogued). */
export const ROTATION_POWER = 0.3, ORBIT_AGREEMENT = 0.2, ONE_SECTOR_DAYS = 9, ROTATION_SWING = 0.007;
export interface RotationVerdict { readonly detected: boolean; readonly periodDays?: number; /** The light's own strongest period, when the rotation is taken as twice it. */ readonly lightPeriodDays?: number; /** Peak to peak, as a share of the mean light. */ readonly amplitude?: number; readonly reason?: string }

/** How closely the light's period and a catalogued rotation period must agree to be one period: the metadata pass's own measure. */
export const CATALOGUE_AGREEMENT = 0.2;
/** A verdict set beside the rotation period the star's record already holds. Two spot groups on opposite sides of a star
 * make its light repeat twice a turn, so the light's strongest period may be half the rotation: when it is half the
 * catalogued period, the star is taken to turn once in two of them. A period that is neither the catalogued one nor its half
 * is not believed: one of the two is wrong, and these pixels cannot say which. */
export function besideCatalogued(verdict: RotationVerdict, cataloguedDays: number | undefined): RotationVerdict {
  if (!verdict.detected || verdict.periodDays === undefined || cataloguedDays === undefined) return verdict;
  const near = (days: number) => Math.abs(verdict.periodDays! - days) <= CATALOGUE_AGREEMENT * days;
  if (near(cataloguedDays)) return verdict;
  if (near(cataloguedDays / 2)) return { ...verdict, periodDays: Number((2 * verdict.periodDays).toFixed(2)), lightPeriodDays: verdict.periodDays };
  return { detected: false, reason: `The light's period, ${verdict.periodDays} d, is neither the star's catalogued rotation period, ${cataloguedDays} d, nor its half.` };
}

/** SIMBAD types whose light changes for a reason that is not the star turning: one star eclipsing or distorting another,
 * matter passing between two, and pulsation. Each names a branch of SIMBAD's tree of types (`otypedef.path`), which a
 * star's record holds as `objectTypePath` (new-object/metadata). SIMBAD files pulsators by what kind of star they are, so
 * the branches are several. */
export const NOT_TURNING = ['EB*', 'El*', 'CV*', 'XB*', 'Sy*', 'Pu*', 'RR*', 'Ce*', 'WV*', 'RV*', 'dS*', 'gD*', 'bC*', 'SX*', 'LP*'] as const;
/** Why a star of this type is not looked at for a rotation, when it is not. */
export const notTurning = (objectType: string | undefined, objectTypePath: string | undefined): string | undefined => objectTypePath !== undefined && NOT_TURNING.some(root => objectTypePath.split(' > ').includes(root))
  ? `SIMBAD lists the star as ${objectType ?? objectTypePath}: its light changes for that reason, and a period in it would not be its turning.` : undefined;

/** A verdict set beside the fastest the star could turn: the period of an orbit at its surface, from its recorded radius and
 * mass. A star turning faster would fly apart, so a shorter period in its light is something else: a pulsation, a close
 * pair, or another star's light. */
export function withinBreakup(verdict: RotationVerdict, fastestTurnDays: number | undefined): RotationVerdict {
  const shortest = verdict.lightPeriodDays ?? verdict.periodDays;
  if (!verdict.detected || shortest === undefined || fastestTurnDays === undefined || (verdict.periodDays ?? 0) >= fastestTurnDays) return verdict;
  return { detected: false, reason: `The light's period, ${shortest} d, is shorter than the ${fastestTurnDays.toFixed(2)} d of an orbit at the star's surface (its recorded radius and mass): the star cannot turn that fast, so the light changes for another reason.` };
}

/** Whether a sector's light curve shows the star's rotation, and why not when it does not. */
export function rotationVerdict(curve: SectorLightCurve): RotationVerdict {
  const { whole, halves } = curve, days = Number(whole.periodDays.toFixed(2));
  if (curve.saturated) return { detected: false, reason: 'The star saturates the detector: its light has bled out of the aperture.' };
  if (whole.power < ROTATION_POWER) return { detected: false, reason: `No period stands out: the strongest, ${days} d, has a periodogram power of ${whole.power.toFixed(2)}, under the ${ROTATION_POWER} a rotation asks for.` };
  if (!halves.every(half => half !== null && Math.abs(half.periodDays - whole.periodDays) <= ORBIT_AGREEMENT * whole.periodDays)) return { detected: false, reason: `The sector's two orbits do not show the same period (${halves.map(half => half === null ? 'none' : `${half.periodDays.toFixed(2)} d`).join(' and ')} against ${days} d over both).` };
  if (whole.periodDays > ONE_SECTOR_DAYS) return { detected: false, reason: `A period of ${days} d is longer than the ${ONE_SECTOR_DAYS} d a sector can vouch for.` };
  if (whole.amplitude < ROTATION_SWING) return { detected: false, reason: `The light swings by ${(100 * whole.amplitude).toFixed(2)}% at ${days} d, under the ${(100 * ROTATION_SWING).toFixed(1)}% at which a period from these pixels can be trusted.` };
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

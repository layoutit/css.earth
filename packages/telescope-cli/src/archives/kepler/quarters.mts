/** The Kepler mission's quarters, and a light curve of the whole mission split into them.
 *
 * Kepler watched one field from May 2009 to May 2013 and turned by a quarter of a circle about every 90 days to keep
 * its solar panels to the Sun: 18 quarters, 0 to 17, of which quarters 0, 1 and 17 are short. A KEPSEISMIC light curve
 * (kepseismic.mts) is one series of all a star's quarters, four years long. A star's spots come and go within months,
 * which is why a brightness map is made of one K2 campaign or one TESS sector; of Kepler it is made of one quarter.
 *
 * The quarters' limits are the mission's own, kept beside this module as `quarters.json`: the mid-times of each
 * quarter's first and last long cadence, from Tables 1 and 2 of the Kepler Data Release 25 Notes (KSCI-19065-002).
 * Those are modified Julian dates on the spacecraft's clock; a KEPSEISMIC time is a barycentric date on a regular grid,
 * each point the nearest image within half a step. The two differ by under a step of 29.4 minutes (the light's travel
 * across Kepler's orbit and the clocks' offset come to under 6 minutes for its field, the grid's rounding to at most 15),
 * and no two quarters are closer than 0.7 days, so a point is given to the quarter whose limits hold its time within one
 * step of the grid. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import { KEPLER_TIME_ZERO, POINT, type KepseismicSeries } from './kepseismic.mts';

/** One quarter: the mid-times of its first and last long cadence, modified Julian dates, and how many long cadences it holds. */
export interface Quarter { readonly quarter: number; readonly firstCadenceMjd: number; readonly lastCadenceMjd: number; readonly cadences: number }

/** The table of quarters, checked: quarters in order from 0, each ending before the next begins. */
export function parseQuarters(value: unknown): Quarter[] {
  const quarters = requireArray(requireRecord(value, 'quarters.json').quarters, 'quarters').map((entry, index) => { const row = requireRecord(entry, `quarter ${index}`);
    return { quarter: requireFiniteNumber(row.quarter, 'quarter'), firstCadenceMjd: requireFiniteNumber(row.firstCadenceMjd, 'firstCadenceMjd'), lastCadenceMjd: requireFiniteNumber(row.lastCadenceMjd, 'lastCadenceMjd'), cadences: requireFiniteNumber(row.cadences, 'cadences') }; });
  if (!quarters.length || !quarters.every((one, index) => one.quarter === index && one.firstCadenceMjd < one.lastCadenceMjd && (index === 0 || quarters[index - 1]!.lastCadenceMjd < one.firstCadenceMjd))) throw new TypeError('quarters.json does not list the quarters in order, each after the one before.');
  return quarters;
}
export const KEPLER_QUARTERS: readonly Quarter[] = parseQuarters(JSON.parse(readFileSync(resolve(import.meta.dirname, 'quarters.json'), 'utf8')) as unknown);

/** A time on the Kepler mission's clock (a barycentric Julian date less 2454833) as a modified Julian date. */
export const mjdOf = (keplerTime: number) => keplerTime + KEPLER_TIME_ZERO - 2400000.5;

/** One quarter's part of a star's light curve: every point of the file that is not empty, in the file's units. */
export interface QuarterLight { readonly quarter: number; readonly time: readonly number[]; /** Parts per million about the star's mean. */ readonly flux: readonly number[]; /** Each point measured or filled in (kepseismic.mts POINT). */ readonly state: readonly number[] }

/** A star's light curve split into the mission's quarters, oldest first. A point between two quarters belongs to
 * neither, and a quarter the star was not observed in, whose points are all empty, is left out. */
export function byQuarter(series: Pick<KepseismicSeries, 'time' | 'flux' | 'state' | 'stepDays'>, quarters: readonly Quarter[] = KEPLER_QUARTERS): QuarterLight[] {
  const parts = quarters.map(one => ({ quarter: one.quarter, time: [] as number[], flux: [] as number[], state: [] as number[] }));
  let at = 0;
  for (const [index, time] of series.time.entries()) { const state = series.state[index]!, mjd = mjdOf(time);
    while (at < quarters.length && mjd > quarters[at]!.lastCadenceMjd + series.stepDays) at += 1;
    const quarter = quarters[at]; if (!quarter || mjd < quarter.firstCadenceMjd - series.stepDays || state === POINT.empty) continue;
    const part = parts[at]!; part.time.push(time); part.flux.push(series.flux[index]!); part.state.push(state); }
  return parts.filter(part => part.time.length > 0);
}

/** The measured points of a quarter's light, as a map is fitted to them: times on the mission's clock, and the light as
 * a share of the star's mean. The points its authors filled in are not measurements, and are left out. */
export function measuredLight(part: QuarterLight): { readonly time: number[]; readonly flux: number[] } {
  const time: number[] = [], flux: number[] = [];
  for (const [index, state] of part.state.entries()) if (state === POINT.measured) { time.push(part.time[index]!); flux.push(Number((1 + part.flux[index]! / 1e6).toFixed(7))); }
  return { time, flux };
}

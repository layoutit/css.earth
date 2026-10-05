/**
 * A model's field on a surface of constant pressure. A climate model stores its fields on its own levels, and where those
 * are heights the pressure on one level differs between the day side and the night side; its papers draw their maps at one
 * pressure. The recipe names the level dimension, the variable holding each cell's pressure, and the pressure to read at:
 *
 *   "isobar": { "along": "level_height_0", "pressure": "air_pressure", "pressureUnits": "Pa", "at": 100 }
 *
 * - `pressure` lies on the field's own grid and `pressureUnits` is its `units` attribute, letter for letter.
 * - `at` is in those units.
 *
 * In each column the value is taken between the two levels whose pressures lie either side of `at`, linearly in the
 * logarithm of pressure. A column whose levels do not reach `at`, or that has no value on one of those two levels, has
 * none: nothing is extrapolated. A model's pressure can waver from level to level near its top; that is accepted away from
 * `at`, and a column whose pressure passes `at` more than once is refused, because no one surface there has that pressure.
 */
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export interface Isobar { readonly along: string; readonly pressure: string; readonly pressureUnits: string; readonly at: number }

export function parseIsobar(value: unknown, label: string): Isobar {
  const isobar = requireRecord(value, label), at = requireFiniteNumber(isobar.at, `${label}.at`);
  if (!(at > 0)) throw new RangeError(`${label}.at must be a pressure above zero.`);
  return { along: requireString(isobar.along, `${label}.along`), pressure: requireString(isobar.pressure, `${label}.pressure`), pressureUnits: requireString(isobar.pressureUnits, `${label}.pressureUnits`), at };
}

/** One column's value at the pressure `at`, or NaN when it has none. `field` gives NaN for a level without a value. */
export function isobarValue(levels: number, pressure: (level: number) => number, field: (level: number) => number, at: number, label: string): number {
  let value = NaN, crossings = 0;
  for (let level = 0, here = pressure(0); level < levels; level++) {
    const next = level + 1 < levels ? pressure(level + 1) : here;
    if (!(here > 0 && Number.isFinite(here))) throw new TypeError(`${label}: level ${level} of a column has no pressure.`);
    // On a level exactly, the value is that level's own; between two, it is taken along the logarithm of pressure.
    if (here === at) { crossings++; value = field(level); }
    else if (next !== at && (here - at) * (next - at) < 0) { crossings++; value = field(level) + (field(level + 1) - field(level)) * Math.log(at / here) / Math.log(next / here); }
    here = next;
  }
  if (crossings > 1) throw new TypeError(`${label}: a column's pressure passes ${at} ${crossings} times along its levels, so no one surface there has that pressure.`);
  return value;
}

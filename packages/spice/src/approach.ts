/**
 * The side of a body a flyby spacecraft approached: the reverse of the spacecraft's velocity relative to the body on its way in,
 * expressed in the body-fixed frame at closest approach. A fast flyby watches this hemisphere for days and images it best, so a
 * default camera can face it (`prepareDefaultCameraAngles`, observation). Closest approach is found in the recipe's search
 * window from the kernels themselves; the inbound leg is straight, so any sample hours before closest approach gives the same
 * direction (New Horizons at Pluto and Charon: within 1 degree from 6 to 48 hours out). The kernels come in loaded: the recipe's
 * bank and kernels name them, and `@cssearth/spice/node` reads them (`loadKernelSet`).
 */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { Matrix3 } from './ck.js';
import type { Ephemeris } from './geometry.js';
import { utcToEt, type LeapSeconds } from './lsk.js';

export interface ApproachRecipe {
  readonly kernelSet: string; readonly kernels: readonly string[];
  /** NAIF ids of the spacecraft and the body, and the body-fixed frame the direction is stated in. */
  readonly spacecraft: number; readonly body: number; readonly frame: string;
  /** UTC instants that bracket one closest approach. */
  readonly searchWindowUtc: readonly [string, string];
  /** Hours before closest approach at which the inbound velocity is read. */
  readonly inboundHours: number;
}

export function parseApproachRecipe(value: unknown, label: string): ApproachRecipe {
  const recipe = requireRecord(value, label);
  if (recipe.schema !== 'cssearth-spacecraft-approach@1') throw new TypeError(`${label}: schema is ${String(recipe.schema)}, not cssearth-spacecraft-approach@1.`);
  const integer = (key: string) => { const n = recipe[key]; if (!Number.isInteger(n)) throw new TypeError(`${label}: ${key} is ${String(n)}, not a NAIF integer id.`); return n as number; };
  const window = requireArray(recipe.searchWindowUtc, `${label} searchWindowUtc`).map((entry, index) => requireString(entry, `${label} searchWindowUtc[${index}]`));
  if (window.length !== 2) throw new TypeError(`${label}: searchWindowUtc has ${window.length} instants, not 2.`);
  const inboundHours = recipe.inboundHours;
  if (typeof inboundHours !== 'number' || !(inboundHours > 0)) throw new TypeError(`${label}: inboundHours is ${String(inboundHours)}, not a positive number.`);
  return Object.freeze({ kernelSet: requireString(recipe.kernelSet, `${label} kernelSet`),
    kernels: Object.freeze(requireArray(recipe.kernels, `${label} kernels`).map((entry, index) => requireString(entry, `${label} kernels[${index}]`))),
    spacecraft: integer('spacecraft'), body: integer('body'), frame: requireString(recipe.frame, `${label} frame`),
    searchWindowUtc: Object.freeze([window[0]!, window[1]!] as const), inboundHours });
}

/** What the search reads from a loaded kernel set: states, leap seconds and the J2000-to-frame rotation. */
export interface ApproachKernels {
  readonly ephemeris: Ephemeris; readonly leapSeconds: LeapSeconds;
  readonly rotation: (frame: string | number, et: number) => Matrix3;
}

/** The body-fixed unit direction toward the approaching spacecraft, and the closest-approach instant (TDB seconds past J2000),
 * from the recipe's kernels loaded in its order. */
export function spacecraftApproach(set: ApproachKernels, recipe: ApproachRecipe): { direction: readonly number[]; closestApproachEt: number; rangeKm: number } {
  const range = (et: number) => Math.hypot(...set.ephemeris.state(recipe.spacecraft, recipe.body, et).position);
  let low = utcToEt(set.leapSeconds, recipe.searchWindowUtc[0]), high = utcToEt(set.leapSeconds, recipe.searchWindowUtc[1]);
  if (!(high > low)) throw new TypeError(`Approach search window ${recipe.searchWindowUtc.join(' to ')} is empty.`);
  // Ternary search: range has one minimum inside a window that brackets one flyby.
  while (high - low > 1e-3) {
    const a = low + (high - low) / 3, b = high - (high - low) / 3;
    if (range(a) < range(b)) high = b; else low = a;
  }
  const closestApproachEt = (low + high) / 2;
  const inbound = set.ephemeris.state(recipe.spacecraft, recipe.body, closestApproachEt - recipe.inboundHours * 3600).velocity;
  const rotation = set.rotation(recipe.frame, closestApproachEt);
  const toward = [0, 1, 2].map(row => -(rotation[row]![0]! * inbound[0] + rotation[row]![1]! * inbound[1] + rotation[row]![2]! * inbound[2]));
  const length = Math.hypot(...toward);
  if (!(length > 0)) throw new Error(`Spacecraft ${recipe.spacecraft} has no inbound velocity relative to body ${recipe.body}.`);
  return { direction: toward.map(value => value / length), closestApproachEt, rangeKm: range(closestApproachEt) };
}

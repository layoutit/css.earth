/** A planet's temperature map drawn from a published energy-balance fit: the paper's own fitted parameters, no refit.
 *
 * The model is Cowan & Agol (2011, ApJ 726, 82) for a planet on a circular orbit that keeps one face to its star, in the notation
 * of Hu et al. (2015), as Jansen & Kipping (2020, MNRAS 494, 4077, section 4, Out-of-Transit Phase Curve Model) fit it to a phase curve:
 *
 *   T(xi, theta) = f T0 cos(theta)^(1/4) P(xi),   T0 = T_star (R_star / a)^(1/2) (1 - A_B)^(1/4),
 *   dP/dxi = (max(cos xi, 0) - P^4) / epsilon,
 *
 * where xi is the longitude east of the point under the star, theta the latitude, A_B the Bond albedo, epsilon the ratio of the
 * radiative to the advective timescale (positive for winds that blow east, the way a prograde planet turns) and f a factor the fit
 * multiplies the whole map by. P is the periodic solution of that equation, which the paper also solves numerically; here it is
 * integrated with fourth-order Runge-Kutta over whole turns until it repeats. epsilon 0 is the limit with no transport,
 * P = max(cos xi, 0)^(1/4), and a negative epsilon mirrors the map west.
 *
 * Over one turn the mean of P^4 equals the mean of max(cos xi, 0), 1/pi, whatever epsilon is: the energy a longitude absorbs
 * over a day it emits. The map's report gives its hottest and coldest points on the equator and the longitude of the hottest,
 * beside the paper's printed values. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const cell = (value: unknown, label: string) => requireFiniteNumber(requireRecord(value, label).value, `${label}.value`);

export interface EnergyBalanceModel {
  readonly kind: 'cowan-agol-2011'; readonly starTemperatureK: number; readonly semiMajorAxisStellarRadii: number;
  readonly bondAlbedo: number; readonly redistribution: number; readonly intrinsicFactor: number;
}
export interface PublishedEnergyBalanceMap {
  readonly source: string; readonly model: EnergyBalanceModel;
  readonly reported: { readonly maximumK?: number; readonly minimumK?: number; readonly hotspotDegreesEast?: number; readonly equilibriumK?: number };
}

/** Reads `cssearth-published-energy-balance-map@1`: every number is a cell `{ value, cell, where }` whose source the record names. */
export function parsePublishedEnergyBalanceMap(value: unknown): PublishedEnergyBalanceMap {
  const input = requireRecord(value, 'published energy-balance map');
  if (input.schema !== 'cssearth-published-energy-balance-map@1') throw new TypeError('A published energy-balance map uses cssearth-published-energy-balance-map@1.');
  const model = requireRecord(input.model, 'model'), reported = requireRecord(input.reported, 'reported');
  if (model.kind !== 'cowan-agol-2011') throw new TypeError(`Unknown energy-balance model ${String(model.kind)}.`);
  const parsed: EnergyBalanceModel = { kind: 'cowan-agol-2011', starTemperatureK: cell(model.starTemperatureK, 'model.starTemperatureK'),
    semiMajorAxisStellarRadii: cell(model.semiMajorAxisStellarRadii, 'model.semiMajorAxisStellarRadii'), bondAlbedo: cell(model.bondAlbedo, 'model.bondAlbedo'),
    redistribution: cell(model.redistribution, 'model.redistribution'), intrinsicFactor: cell(model.intrinsicFactor, 'model.intrinsicFactor') };
  if (!(parsed.starTemperatureK > 0 && parsed.semiMajorAxisStellarRadii > 1 && parsed.intrinsicFactor > 0)) throw new RangeError('The star\'s temperature, a/R_star above 1 and the factor f are positive.');
  if (!(parsed.bondAlbedo >= 0 && parsed.bondAlbedo < 1)) throw new RangeError('The Bond albedo lies from 0 up to 1.');
  const optional = (key: string) => reported[key] === undefined ? {} : { [key]: cell(reported[key], `reported.${key}`) };
  return { source: requireString(input.source, 'source'), model: parsed,
    reported: { ...optional('maximumK'), ...optional('minimumK'), ...optional('hotspotDegreesEast'), ...optional('equilibriumK') } };
}

/** P at `steps` longitudes from -180 degrees eastward, one turn: the periodic solution of Cowan & Agol (2011, eq. 10). */
export function thermalPhaseFunction(epsilon: number, steps = 7200) {
  const values = new Float64Array(steps), h = 2 * Math.PI / steps, longitude = (i: number) => -Math.PI + i * h;
  if (epsilon === 0) { for (let i = 0; i < steps; i++) values[i] = Math.max(Math.cos(longitude(i)), 0) ** 0.25; return values; }
  const e = Math.abs(epsilon), rate = (xi: number, p: number) => (Math.max(Math.cos(xi), 0) - p ** 4) / e;
  // Their starting value, P at dawn (Cowan & Agol 2011, appendix), then whole turns until the turn ends where it began.
  let p = (Math.PI + (3 * Math.PI / e) ** (4 / 3)) ** -0.25;
  for (let turn = 0; turn < 1000; turn++) {
    const start = p;
    for (let i = 0; i < steps; i++) {
      const xi = longitude(i); values[i] = p;
      const k1 = rate(xi, p), k2 = rate(xi + h / 2, p + h / 2 * k1), k3 = rate(xi + h / 2, p + h / 2 * k2), k4 = rate(xi + h, p + h * k3);
      p += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    if (Math.abs(p - start) < 1e-13) break;
  }
  // Winds blowing west mirror the map: P for -epsilon at xi is P for epsilon at -xi.
  return epsilon > 0 ? values : Float64Array.from({ length: steps }, (_, i) => values[(steps - i) % steps]!);
}

/** The map of a parsed record, as `loadPublishedEnergyBalanceMap` reads it from a file. */
export function publishedEnergyBalanceMap(record: PublishedEnergyBalanceMap) {
  const { model } = record, steps = 7200, phase = thermalPhaseFunction(model.redistribution, steps);
  const scale = model.intrinsicFactor * model.starTemperatureK * model.semiMajorAxisStellarRadii ** -0.5 * (1 - model.bondAlbedo) ** 0.25;
  const at = (longitudeDegrees: number) => {
    const x = (((longitudeDegrees + 180) % 360 + 360) % 360) / 360 * steps, i = Math.floor(x) % steps, w = x - Math.floor(x);
    return phase[i]! * (1 - w) + phase[(i + 1) % steps]! * w;
  };
  let hottest = 0;
  for (let i = 1; i < steps; i++) if (phase[i]! > phase[hottest]!) hottest = i;
  const maximum = Math.max(...phase), minimum = Math.min(...phase);
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      return scale * Math.max(Math.cos(latitude * Math.PI / 180), 0) ** 0.25 * at(longitude);
    },
    report: { format: 'published-energy-balance-map', units: 'K', source: record.source, model: model.kind, parameters: model,
      derived: { substellarScaleK: scale, maximumK: scale * maximum, minimumK: scale * minimum, hotspotDegreesEast: -180 + hottest * 360 / steps,
        equilibriumK: model.starTemperatureK * (2 * model.semiMajorAxisStellarRadii) ** -0.5 },
      reported: record.reported },
  };
}

export async function loadPublishedEnergyBalanceMap(root: string, value: unknown) {
  const dataset = requireRecord(value, 'published energy-balance dataset'), path = requireString(dataset.path, 'path');
  if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('A published energy-balance map must be inside the source directory.');
  return publishedEnergyBalanceMap(parsePublishedEnergyBalanceMap(JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown));
}

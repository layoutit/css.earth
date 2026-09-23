/** A planet's brightness-temperature map drawn from a published phase-curve fit: the paper's own model and table values, no refit.
 *
 * Two published model forms are read:
 * - `two-term-sinusoid`: F_p(t) = A1 cos[2 pi (t - t1)/p] + A2 cos[4 pi (t - t2)/p] + c, with c set so that F_p at mid-eclipse is the
 *   eclipse depth (the planet's whole day side). Cowan & Agol (2008, ApJ 678, L129, eq. 5) give the unique longitudinal map of such a
 *   curve for an edge-on orbit: each map sinusoid of order j makes a light-curve sinusoid of the same order and phase, scaled by
 *   2 (j = 0), pi/2 (j = 1) and 2/3 (j = 2). The map carries no latitude information and is drawn the same at every latitude.
 * - `spiderman-spherical`: the fit's SPIDERMAN spherical-harmonic coefficients, evaluated by SPIDERMAN itself
 *   (`astronomy-packages/spiderman.mts`).
 *
 * Both give the planet's intensity relative to the star's disc-averaged intensity, r. A uniform planet of intensity ratio r shows the
 * star a flux ratio rp^2 r, so the sinusoid map is r = 2 J / rp^2 in Cowan & Agol's units and the SPIDERMAN map r = pi v (1 + dilution) /
 * rp^2 (the same relation Rauscher et al. 2018 give, eq. 8). Brightness temperature is the Planck temperature at the band's wavelength
 * whose ratio to the star's band brightness temperature is r. The star's band temperature is the one the paper's own conversion
 * implies: the value at which its eclipse depth and radius ratio give its dayside temperature. The paper's nightside temperature,
 * converted the same way from the model's flux at mid-transit, is then an independent check, and the report carries both. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { planckRadiance } from '../eclipse-map/eigenmap-fit.mts';
import { spidermanMapGrid, spidermanPhaseCurve, type SpidermanSphericalMap } from '../astronomy-packages/spiderman.mts';

const cell = (value: unknown, label: string) => requireFiniteNumber(requireRecord(value, label).value, `${label}.value`);

export interface TwoTermSinusoid { readonly kind: 'two-term-sinusoid'; readonly periodDays: number; readonly a1: number; readonly t1: number; readonly a2: number; readonly t2: number; readonly eclipseTime: number }
export interface SpidermanModel { readonly kind: 'spiderman-spherical'; readonly map: SpidermanSphericalMap; readonly dilution: number;
  readonly orbit: { readonly periodDays: number; readonly semiMajorAxisAu: number; readonly semiMajorAxisStellarRadii: number; readonly inclinationDegrees: number } }
export interface PublishedPhaseCurve {
  readonly source: string; readonly wavelengthMicrons: number; readonly eclipseDepth: number; readonly radiusRatio: number;
  readonly model: TwoTermSinusoid | SpidermanModel;
  readonly reported: { readonly daysideK: number; readonly nightsideK: number; readonly offsetDegrees: number; readonly amplitude?: number; readonly semiAmplitude?: number };
}

/** Reads `cssearth-published-phase-curve@1`: every number is a table cell `{ value, cell }` whose source the record names. */
export function parsePublishedPhaseCurve(value: unknown): PublishedPhaseCurve {
  const input = requireRecord(value, 'published phase curve');
  if (input.schema !== 'cssearth-published-phase-curve@1') throw new TypeError('A published phase curve uses cssearth-published-phase-curve@1.');
  const model = requireRecord(input.model, 'model'), reported = requireRecord(input.reported, 'reported');
  const optional = (key: string) => reported[key] === undefined ? undefined : cell(reported[key], `reported.${key}`);
  let parsed: TwoTermSinusoid | SpidermanModel;
  if (model.kind === 'two-term-sinusoid') {
    parsed = { kind: 'two-term-sinusoid', periodDays: cell(model.periodDays, 'model.periodDays'), a1: cell(model.a1, 'model.a1'), t1: cell(model.t1, 'model.t1'),
      a2: cell(model.a2, 'model.a2'), t2: cell(model.t2, 'model.t2'), eclipseTime: cell(model.eclipseTime, 'model.eclipseTime') };
  } else if (model.kind === 'spiderman-spherical') {
    const map = requireRecord(model.spiderman, 'model.spiderman'), orbit = requireRecord(model.orbit, 'model.orbit');
    parsed = { kind: 'spiderman-spherical', dilution: cell(model.dilution, 'model.dilution'),
      map: { degree: requireFiniteNumber(map.degree, 'model.spiderman.degree'), la0: requireFiniteNumber(map.la0, 'model.spiderman.la0'), lo0: requireFiniteNumber(map.lo0, 'model.spiderman.lo0'),
        sph: requireArray(map.sph, 'model.spiderman.sph').map((entry, i) => cell(entry, `model.spiderman.sph[${i}]`)) },
      orbit: { periodDays: cell(orbit.periodDays, 'model.orbit.periodDays'), semiMajorAxisAu: cell(orbit.semiMajorAxisAu, 'model.orbit.semiMajorAxisAu'),
        semiMajorAxisStellarRadii: cell(orbit.semiMajorAxisStellarRadii, 'model.orbit.semiMajorAxisStellarRadii'), inclinationDegrees: cell(orbit.inclinationDegrees, 'model.orbit.inclinationDegrees') } };
  } else throw new TypeError(`Unknown published phase-curve model ${String(model.kind)}.`);
  return { source: requireString(input.source, 'source'), wavelengthMicrons: requireFiniteNumber(input.wavelengthMicrons, 'wavelengthMicrons'),
    eclipseDepth: cell(input.eclipseDepth, 'eclipseDepth'), radiusRatio: cell(input.radiusRatio, 'radiusRatio'), model: parsed,
    reported: { daysideK: cell(reported.daysideK, 'reported.daysideK'), nightsideK: cell(reported.nightsideK, 'reported.nightsideK'),
      offsetDegrees: cell(reported.offsetDegrees, 'reported.offsetDegrees'), amplitude: optional('amplitude'), semiAmplitude: optional('semiAmplitude') } };
}

/** Temperature whose Planck radiance at `wavelengthMicrons` is `ratio` times that of `referenceK`; null when the ratio is not positive. */
export function brightnessTemperature(ratio: number, referenceK: number, wavelengthMicrons: number) {
  if (!(ratio > 0)) return null;
  const x = 14387.768775 / (wavelengthMicrons * referenceK); // hc/k = 14387.768775 um K (CODATA 2018)
  return 14387.768775 / (wavelengthMicrons * Math.log1p(Math.expm1(x) / ratio));
}

/** The star's band brightness temperature at which depth = rp^2 B(T_day) / B(T_star). */
export function impliedStellarTemperature(eclipseDepth: number, radiusRatio: number, daysideK: number, wavelengthMicrons: number) {
  const target = radiusRatio ** 2 * planckRadiance(wavelengthMicrons, daysideK) / eclipseDepth;
  let low = 500, high = 100000;
  for (let i = 0; i < 200; i++) { const mid = (low + high) / 2; if (planckRadiance(wavelengthMicrons, mid) < target) low = mid; else high = mid; }
  return (low + high) / 2;
}

/** Fourier terms of the sinusoid in the angle xi = 2 pi (t - t_eclipse) / p, and the Cowan & Agol (2008, eq. 5) map terms. At xi the
 * observer faces longitude -xi, with longitude 0 at the substellar point and increasing eastward (the direction of rotation). */
export function sinusoidMap(model: TwoTermSinusoid, eclipseDepth: number) {
  const xi1 = 2 * Math.PI * (model.t1 - model.eclipseTime) / model.periodDays, xi2 = 4 * Math.PI * (model.t2 - model.eclipseTime) / model.periodDays;
  const c1 = model.a1 * Math.cos(xi1), d1 = model.a1 * Math.sin(xi1), c2 = model.a2 * Math.cos(xi2), d2 = model.a2 * Math.sin(xi2);
  const f0 = eclipseDepth - c1 - c2;
  const map = { a0: f0 / 2, a1: c1 / (Math.PI / 2), b1: -d1 / (Math.PI / 2), a2: c2 / (2 / 3), b2: -d2 / (2 / 3) };
  const flux = (xi: number) => f0 + c1 * Math.cos(xi) + d1 * Math.sin(xi) + c2 * Math.cos(2 * xi) + d2 * Math.sin(2 * xi);
  const slice = (longitudeDegrees: number) => { const phi = longitudeDegrees * Math.PI / 180;
    return map.a0 + map.a1 * Math.cos(phi) + map.b1 * Math.sin(phi) + map.a2 * Math.cos(2 * phi) + map.b2 * Math.sin(2 * phi); };
  return { map, flux, slice };
}

/** Samples of a periodic function of xi: its maximum, minimum and the xi of the maximum. */
function extremes(flux: (xi: number) => number, steps = 72000) {
  let max = -Infinity, min = Infinity, at = 0;
  for (let i = 0; i < steps; i++) { const xi = -Math.PI + 2 * Math.PI * i / steps, f = flux(xi); if (f > max) { max = f; at = xi; } if (f < min) min = f; }
  return { max, min, peakXi: at };
}

export async function loadPublishedPhaseCurveMap(root: string, value: unknown) {
  const lens = requireRecord(value, 'published phase-curve lens'), path = requireString(lens.path, 'path');
  if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError('A published phase curve must be inside the source directory.');
  const record = parsePublishedPhaseCurve(JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown);
  const { wavelengthMicrons: wavelength, radiusRatio: k, eclipseDepth } = record;
  const starK = impliedStellarTemperature(eclipseDepth, k, record.reported.daysideK, wavelength);
  const toK = (ratio: number) => brightnessTemperature(ratio, starK, wavelength);
  const common = { format: 'published-phase-curve-map', units: 'K', source: record.source, wavelengthMicrons: wavelength, stellarBandTemperatureK: starK };

  if (record.model.kind === 'two-term-sinusoid') {
    const { map, flux, slice } = sinusoidMap(record.model, eclipseDepth), { max, min, peakXi } = extremes(flux);
    const nightFlux = flux(Math.PI);
    return {
      sample(longitude: number, latitude: number) {
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
        return toK(2 * slice(longitude) / k ** 2);
      },
      report: { ...common, model: 'two-term-sinusoid, Cowan & Agol (2008) longitudinal map, uniform in latitude', mapTerms: map,
        derived: { daysideK: toK(eclipseDepth / k ** 2), nightsideK: toK(nightFlux / k ** 2), hottestHemisphereK: toK(max / k ** 2),
          amplitude: (max - min) / max, peakDegreesBeforeEclipse: -peakXi * 180 / Math.PI },
        reported: record.reported },
    };
  }
  const model = record.model, step = 1, latitudes: number[] = [], longitudes: number[] = [];
  for (let lat = -90; lat <= 90; lat += step) latitudes.push(lat);
  for (let lon = -180; lon <= 180; lon += step) longitudes.push(lon);
  const grid = spidermanMapGrid(model.map, latitudes, longitudes);
  const scale = Math.PI * (1 + model.dilution) / k ** 2;
  const orbit = { ...model.orbit, radiusRatio: k };
  // The phase curve SPIDERMAN integrates from the same map, sampled away from transit and eclipse (phase 0 is mid-transit).
  const phases = Array.from({ length: 721 }, (_, i) => i / 720).filter(phase => Math.abs(phase - 0.5) > 0.05 && phase > 0.05 && phase < 0.95);
  const curve = spidermanPhaseCurve(model.map, orbit, phases).map(value => value * (1 + model.dilution));
  // Least squares c + A cos + B sin in the angle from eclipse gives the day side, night side, amplitude and peak of the model curve.
  let s = [0, 0, 0, 0, 0, 0, 0, 0, 0], y = [0, 0, 0];
  phases.forEach((phase, i) => { const x = 2 * Math.PI * (phase - 0.5), row = [1, Math.cos(x), Math.sin(x)];
    for (let a = 0; a < 3; a++) { y[a]! += row[a]! * curve[i]!; for (let b = 0; b < 3; b++) s[a * 3 + b]! += row[a]! * row[b]!; } });
  const [c, a, b] = solve3(s, y), semi = Math.hypot(a, b);
  let negative = 0, cells = 0;
  for (let row = 0; row < latitudes.length; row++) for (let column = 0; column < longitudes.length - 1; column++) {
    const weight = Math.cos(latitudes[row]! * Math.PI / 180); cells += weight; if (grid.values[row]![column]! <= 0) negative += weight;
  }
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const x = (((longitude + 180) % 360 + 360) % 360) / step, yy = (latitude + 90) / step;
      const x0 = Math.min(longitudes.length - 2, Math.floor(x)), y0 = Math.min(latitudes.length - 2, Math.floor(yy)), dx = x - x0, dy = yy - y0;
      const v = grid.values[y0]![x0]! * (1 - dx) * (1 - dy) + grid.values[y0]![x0 + 1]! * dx * (1 - dy) + grid.values[y0 + 1]![x0]! * (1 - dx) * dy + grid.values[y0 + 1]![x0 + 1]! * dx * dy;
      return toK(v * scale);
    },
    report: { ...common, model: 'spiderman-spherical', spiderman: grid.spiderman, numpy: grid.numpy, spidermanMap: model.map, dilution: model.dilution,
      derived: { daysideFlux: c + semi, nightsideFlux: c - semi, semiAmplitude: semi, peakDegreesAfterEclipse: Math.atan2(b, a) * 180 / Math.PI,
        daysideK: toK((c + semi) / k ** 2), nightsideK: toK((c - semi) / k ** 2), nonPositiveAreaFraction: negative / cells },
      reported: record.reported },
  };
}

function solve3(m: number[], v: number[]): [number, number, number] {
  const a = [[m[0]!, m[1]!, m[2]!, v[0]!], [m[3]!, m[4]!, m[5]!, v[1]!], [m[6]!, m[7]!, m[8]!, v[2]!]];
  for (let i = 0; i < 3; i++) {
    const p = a.slice(i).reduce((best, row, j) => Math.abs(row[i]!) > Math.abs(a[best]![i]!) ? i + j : best, i); [a[i], a[p]] = [a[p]!, a[i]!];
    for (let j = i + 1; j < 3; j++) { const f = a[j]![i]! / a[i]![i]!; for (let k = i; k < 4; k++) a[j]![k]! -= f * a[i]![k]!; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) x[i] = (a[i]![3]! - a[i]!.slice(i + 1, 3).reduce((sum, value, j) => sum + value * x[i + 1 + j]!, 0)) / a[i]![i]!;
  return x as [number, number, number];
}

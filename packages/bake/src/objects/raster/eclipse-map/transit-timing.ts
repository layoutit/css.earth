/** When a transit happened in a light curve, against a package orbit's prediction. batman evaluates the quadratic limb-darkened
 * transit on the source-backed orbit; SciPy fits its time, radius ratio, limb darkening and quadratic baseline. The eclipse-map fit's
 * longitudes trade against eclipse timing, so the timing a map assumes has to be checked against the data. */
import type { HostedOrbit } from '@cssearth/astronomy';
import { fitTransit } from '@cssearth/telescope/node';

/** Mid-transit time in a light curve relative to the orbit's prediction, in seconds. The reported standard error is the local
 * Jacobian covariance scaled by reduced chi-squared, under the fixed orbit and quadratic baseline. Only samples within
 * `windowDays` of the predicted transit are used. `exposureSeconds`, when supplied by the product, enables batman's seven-sample
 * exposure integration; an absent duration is retained as absent rather than inferred from cadence. */
export function measureTransitShift(curve: { time: Float64Array; flux: Float64Array; error: Float64Array }, orbit: HostedOrbit,
  _host: { rightAscensionDegrees: number; declinationDegrees: number }, planetRadiusStellarRadii: number,
  { windowDays = 0.12, rangeSeconds = 120, exposureSeconds }: { windowDays?: number; rangeSeconds?: number; exposureSeconds?: number } = {}) {
  const middle = curve.time[curve.time.length >> 1]!, epoch = Math.round((middle - orbit.transitTimeBmjdTdb) / orbit.periodDays);
  const predicted = orbit.transitTimeBmjdTdb + epoch * orbit.periodDays;
  const keep = Array.from(curve.time.keys()).filter(i => Math.abs(curve.time[i]! - predicted) < windowDays &&
    Number.isFinite(curve.time[i]) && Number.isFinite(curve.flux[i]) && Number.isFinite(curve.error[i]) && curve.error[i]! > 0);
  if (keep.length < 100) throw new RangeError('The light curve does not cover the predicted transit.');
  const request = { timeDaysFromPrediction: keep.map(i => curve.time[i]! - predicted), flux: keep.map(i => curve.flux[i]!), error: keep.map(i => curve.error[i]!),
    periodDays: orbit.periodDays, semiMajorAxisStellarRadii: orbit.semiMajorAxisStellarRadii, inclinationDegrees: orbit.inclinationDegrees,
    eccentricity: orbit.eccentricity, argumentOfPeriapsisDegrees: orbit.argumentOfPeriapsisDegrees ?? 90, startRadiusRatio: planetRadiusStellarRadii,
    windowDays, rangeSeconds, ...(exposureSeconds === undefined ? {} : { exposureSeconds }) };
  const fit = fitTransit(request), uncertainty = fit.shiftStandardErrorSeconds;
  if (uncertainty === null || !(uncertainty > 0)) throw new Error('The transit timing uncertainty is unavailable.');
  return { shiftSeconds: fit.shiftSeconds, low: fit.shiftSeconds - uncertainty, high: fit.shiftSeconds + uncertainty, uncertaintySeconds: uncertainty,
    reducedChiSquared: fit.reducedChiSquared, samples: fit.samples, radiusRatio: fit.radiusRatio, limbDarkening: fit.limbDarkening,
    modelFlux: fit.modelFlux, residualFlux: fit.residualFlux, fit,
    chiSquaredAt: (shift: number) => fitTransit({ ...request, fixedShiftSeconds: shift }).chiSquared - fit.chiSquared };
}

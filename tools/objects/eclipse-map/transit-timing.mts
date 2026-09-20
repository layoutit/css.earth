/** When a transit happened in a light curve, against a package orbit's prediction: a quadratic limb-darkened transit on the
 * orbit's own sky geometry, with the radius ratio and limb darkening fitted and a quadratic baseline solved at each trial time.
 * The eclipse-map fit's longitudes trade against eclipse timing, so the timing a map assumes has to be checked against the data. */
import { hostSkyFrame, hostedOrbitStateRelativeBmjdTdb, type HostedOrbit } from '@cssearth/astronomy';

/** Fraction of a quadratic limb-darkened star's light left when a disc of radius `p` (stellar radii) sits `d` from its centre. The
 * blocked light is the stellar intensity integrated over the overlap, ring by ring: each ring of radius r contributes its arc inside
 * the planet's disc. */
export function transitFlux(d: number, p: number, u1: number, u2: number, steps = 400) {
  if (d >= 1 + p) return 1;
  const intensity = (r: number) => { const mu = Math.sqrt(Math.max(0, 1 - r * r)); return 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2; };
  const total = Math.PI * (1 - u1 / 3 - u2 / 6), low = Math.max(0, d - p), high = Math.min(1, d + p);
  let blocked = 0;
  // Even ring spacing: 400 steps stay within 4.5 ppm of 20,000 for WASP-43b's radius ratio at any separation, against ~340 ppm scatter.
  const dr = (high - low) / steps;
  for (let k = 0; k < steps; k++) {
    const r = low + (k + 0.5) * dr;
    let arc: number;
    if (r <= p - d) arc = 2 * Math.PI * r;
    else if (d === 0) arc = r <= p ? 2 * Math.PI * r : 0;
    else arc = 2 * r * Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - p * p) / (2 * r * d))));
    blocked += intensity(r) * arc * dr;
  }
  return 1 - blocked / total;
}

function solve(matrix: number[][], rhs: number[]) {
  const n = rhs.length, a = matrix.map(row => [...row]), b = [...rhs];
  for (let k = 0; k < n; k++) {
    let pivot = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i]![k]!) > Math.abs(a[pivot]![k]!)) pivot = i;
    [a[k], a[pivot]] = [a[pivot]!, a[k]!]; [b[k], b[pivot]] = [b[pivot]!, b[k]!];
    for (let i = k + 1; i < n; i++) { const f = a[i]![k]! / a[k]![k]!; for (let j = k; j < n; j++) a[i]![j]! -= f * a[k]![j]!; b[i]! -= f * b[k]!; }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]!; for (let j = i + 1; j < n; j++) s -= a[i]![j]! * x[j]!; x[i] = s / a[i]![i]!; }
  return x;
}

/** Chi-squared of the transit at one trial shift of the predicted mid-transit, with radius ratio and limb darkening refined by
 * Gauss-Newton and a quadratic baseline in time solved linearly at every step. */
function transitChiSquared(time: Float64Array, flux: Float64Array, error: Float64Array, separation: (t: number) => number, start: [number, number, number]) {
  const n = time.length, t0 = time[n >> 1]!, d = Float64Array.from(time, separation);
  const residuals = (p: readonly number[]) => {
    const model = Float64Array.from(d, dist => transitFlux(dist, p[0]!, p[1]!, p[2]!));
    // Baseline c0 + c1 x + c2 x^2 multiplies the transit; linear given the transit shape.
    const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rhs = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const w = 1 / error[i]! ** 2, x = time[i]! - t0, row = [model[i]!, model[i]! * x, model[i]! * x * x];
      for (let a = 0; a < 3; a++) { rhs[a]! += w * row[a]! * flux[i]!; for (let b = 0; b < 3; b++) normal[a]![b]! += w * row[a]! * row[b]!; }
    }
    const c = solve(normal, rhs);
    return Float64Array.from(time, (t, i) => (model[i]! * (c[0]! + c[1]! * (t - t0) + c[2]! * (t - t0) ** 2) - flux[i]!) / error[i]!);
  };
  let p = [...start], r = residuals(p), chi = r.reduce((s, v) => s + v * v, 0);
  for (let iteration = 0; iteration < 12; iteration++) {
    const steps = [1e-5, 1e-3, 1e-3], jacobian = steps.map((h, k) => { const q = [...p]; q[k]! += h; const rq = residuals(q); return Float64Array.from(rq, (v, i) => (v - r[i]!) / h); });
    const normal = jacobian.map(a => jacobian.map(b => a.reduce((s, v, i) => s + v * b[i]!, 0))), rhs = jacobian.map(a => -a.reduce((s, v, i) => s + v * r[i]!, 0));
    const delta = solve(normal, rhs), next = p.map((v, k) => v + delta[k]!), rn = residuals(next), chiNext = rn.reduce((s, v) => s + v * v, 0);
    if (!(chiNext < chi)) break;
    const improvement = chi - chiNext; p = next; r = rn; chi = chiNext;
    if (improvement < 1e-3) break;
  }
  return { chiSquared: chi, radiusRatio: p[0]!, limbDarkening: [p[1]!, p[2]!] as const };
}

/** Mid-transit time in a light curve relative to the orbit's prediction, in seconds: scanned in 5 s steps over +/-`rangeSeconds`,
 * then 0.5 s steps around the best. The 1-sigma interval uses chi-squared scaled by its reduced value, since light-curve errors
 * rarely describe the scatter exactly. Only samples within `windowDays` of the predicted transit are used. */
export function measureTransitShift(curve: { time: Float64Array; flux: Float64Array; error: Float64Array }, orbit: HostedOrbit,
  host: { rightAscensionDegrees: number; declinationDegrees: number }, planetRadiusStellarRadii: number, { windowDays = 0.12, rangeSeconds = 120 } = {}) {
  const middle = curve.time[curve.time.length >> 1]!, epoch = Math.round((middle - orbit.transitTimeBmjdTdb) / orbit.periodDays);
  const predicted = orbit.transitTimeBmjdTdb + epoch * orbit.periodDays;
  const keep = Array.from(curve.time.keys()).filter(i => Math.abs(curve.time[i]! - predicted) < windowDays && [curve.time[i], curve.flux[i], curve.error[i]].every(Number.isFinite));
  if (keep.length < 100) throw new RangeError('The light curve does not cover the predicted transit.');
  const pick = (values: Float64Array) => Float64Array.from(keep, i => values[i]!), time = pick(curve.time), flux = pick(curve.flux), error = pick(curve.error);
  const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees);
  const at = (shiftSeconds: number) => {
    const shifted = { ...orbit, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb + shiftSeconds / 86400 };
    return (t: number) => {
      const r = hostedOrbitStateRelativeBmjdTdb(shifted, host, 1, t).positionKm;
      // Behind the star there is no transit; place the planet out of contact.
      if (r[0] * z[0] + r[1] * z[1] + r[2] * z[2] < 0) return 10;
      return Math.hypot(r[0] * x[0] + r[1] * x[1] + r[2] * x[2], r[0] * y[0] + r[1] * y[1] + r[2] * y[2]);
    };
  };
  const start: [number, number, number] = [planetRadiusStellarRadii, 0.1, 0.1];
  const scan = (shifts: number[]) => shifts.map(shift => ({ shift, ...transitChiSquared(time, flux, error, at(shift), start) }));
  const coarse = scan(Array.from({ length: Math.round(2 * rangeSeconds / 5) + 1 }, (_, k) => -rangeSeconds + 5 * k));
  const centre = coarse.reduce((best, trial) => trial.chiSquared < best.chiSquared ? trial : best).shift;
  const fine = scan(Array.from({ length: 25 }, (_, k) => centre - 6 + 0.5 * k)), best = fine.reduce((b, trial) => trial.chiSquared < b.chiSquared ? trial : b);
  const reduced = best.chiSquared / (time.length - 7), inside = fine.filter(trial => (trial.chiSquared - best.chiSquared) / reduced <= 1).map(trial => trial.shift);
  return { shiftSeconds: best.shift, low: Math.min(...inside), high: Math.max(...inside), reducedChiSquared: reduced, samples: time.length, radiusRatio: best.radiusRatio,
    limbDarkening: best.limbDarkening, chiSquaredAt: (shift: number) => transitChiSquared(time, flux, error, at(shift), start).chiSquared - best.chiSquared };
}

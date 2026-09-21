/** A bare rock fitted to a light curve: a planet with no atmosphere and no heat transport, where each patch of ground re-radiates
 * the starlight it absorbs. Its temperature is T(z) = T_ss cos(z)^(1/4) at zenith angle z from the substellar point and nothing on
 * the night side: the equilibrium temperature of Cowan & Agol (2011, ApJ 726, 82, eq. 3), which a surface with no heat capacity
 * or transport follows. T_ss is the one planetary parameter, fitted by profile likelihood: at each T_ss the map's light curve is
 * fixed, and the stellar normalisation and the recipe's linear systematics are solved by weighted least squares, as the eigencurve
 * fit solves them. */
import type { HostedOrbit } from '@cssearth/astronomy';
import { mapBasisCurves, type LightTravel } from './phase-curve.mts';
import { equalAngleGrid } from './eigenmap-fit.mts';
import type { bandTemperatureTable } from './light-curve-map.mts';

type BandTable = Pick<ReturnType<typeof bandTemperatureTable>, 'ratio'>;

/** The bare rock's temperature at a body-fixed point; longitude 0 faces the star. */
export function bareRockTemperature(substellarK: number, longitude: number, latitude: number) {
  const mu = Math.cos(latitude * Math.PI / 180) * Math.cos(longitude * Math.PI / 180);
  return mu > 0 ? substellarK * mu ** 0.25 : 0;
}

/** Weighted least squares of `target` on the columns (a constant first, then the systematics); returns chi-squared and the solution. */
function linearFit(target: Float64Array, error: Float64Array, columns: readonly ArrayLike<number>[]) {
  const p = columns.length, normal = new Float64Array(p * p), rhs = new Float64Array(p);
  for (let t = 0; t < target.length; t++) {
    const w = 1 / error[t]! ** 2;
    for (let i = 0; i < p; i++) { rhs[i] += w * columns[i]![t]! * target[t]!; for (let j = 0; j < p; j++) normal[i * p + j] += w * columns[i]![t]! * columns[j]![t]!; }
  }
  // Gaussian elimination with partial pivoting: a dozen columns at most.
  const a = Float64Array.from(normal), x = Float64Array.from(rhs);
  for (let c = 0; c < p; c++) {
    let pivot = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(a[r * p + c]!) > Math.abs(a[pivot * p + c]!)) pivot = r;
    if (!(Math.abs(a[pivot * p + c]!) > 0)) throw new RangeError('The systematics columns are degenerate.');
    for (let k = 0; k < p; k++) [a[c * p + k], a[pivot * p + k]] = [a[pivot * p + k]!, a[c * p + k]!];
    [x[c], x[pivot]] = [x[pivot]!, x[c]!];
    for (let r = c + 1; r < p; r++) { const f = a[r * p + c]! / a[c * p + c]!; for (let k = c; k < p; k++) a[r * p + k] -= f * a[c * p + k]!; x[r] -= f * x[c]!; }
  }
  for (let r = p - 1; r >= 0; r--) { let s = x[r]!; for (let k = r + 1; k < p; k++) s -= a[r * p + k]! * x[k]!; x[r] = s / a[r * p + r]!; }
  let chiSquared = 0;
  for (let t = 0; t < target.length; t++) { let model = 0; for (let i = 0; i < p; i++) model += x[i]! * columns[i]![t]!; chiSquared += ((target[t]! - model) / error[t]!) ** 2; }
  return { chiSquared, solution: x };
}

export interface BareRockSamples { readonly time: Float64Array; readonly flux: Float64Array; readonly error: Float64Array; readonly systematics: readonly Float64Array[] }

/** Fits T_ss between `minimumK` and `maximumK`: a scan in `scanStepK`, then golden-section refinement to 0.01 K. The standard
 * uncertainty is where chi-squared rises by 1 on either side. Map intensities are in the eigencurve fit's units (a uniform map of
 * 1/pi shows flux 1), so the planet-to-star flux of a cell at T is ratio(T) rp^2 / (pi (1 + s_corr)). */
export function fitBareRock(samples: BareRockSamples, table: BandTable, orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number },
  planetRadiusStellarRadii: number, { gridHeight, lightTravel = {}, minimumK = 100, maximumK = 1000, scanStepK = 10 }: { gridHeight: number; lightTravel?: LightTravel; minimumK?: number; maximumK?: number; scanStepK?: number }) {
  const { time, flux, error, systematics } = samples, n = time.length;
  if (!n || flux.length !== n || error.length !== n || systematics.some(column => column.length !== n)) throw new RangeError('Samples and systematics must share one length.');
  if (!Number.isSafeInteger(gridHeight) || gridHeight < 2) throw new RangeError('The fit grid needs a whole height of at least 2.');
  const grid = equalAngleGrid(gridHeight, 2 * gridHeight), cells = grid.width * grid.height;
  // The map's shape changes with T_ss (Planck emission is not linear in T), so each trial temperature integrates its own map.
  const planetCurve = (substellarK: number) => {
    const map = new Float64Array(cells);
    for (let c = 0; c < cells; c++) { const t = bareRockTemperature(substellarK, grid.longitudes[c]!, grid.latitudes[c]!); map[c] = t > 0 ? table.ratio(t) * planetRadiusStellarRadii ** 2 / Math.PI : 0; }
    return mapBasisCurves([map], grid, orbit, host, planetRadiusStellarRadii, time, undefined, lightTravel)[0]!;
  };
  const columns = [new Float64Array(n).fill(1), ...systematics];
  const evaluate = (substellarK: number) => {
    const curve = planetCurve(substellarK);
    // s_corr scales the planet's contribution by 1 / (1 + s_corr); it is of order 1e-3, so two passes settle it.
    let stellarCorrection = 0, result = linearFit(Float64Array.from(flux, (f, t) => f - 1 - curve[t]!), error, columns);
    for (let pass = 0; pass < 2; pass++) {
      stellarCorrection = result.solution[0]!;
      result = linearFit(Float64Array.from(flux, (f, t) => f - 1 - curve[t]! / (1 + stellarCorrection)), error, columns);
    }
    return { chiSquared: result.chiSquared, stellarCorrection: result.solution[0]!, systematics: result.solution.slice(1) };
  };
  const cache = new Map<number, ReturnType<typeof evaluate>>(), at = (k: number) => { let v = cache.get(k); if (!v) { v = evaluate(k); cache.set(k, v); } return v; };
  const chi = (k: number) => at(k).chiSquared;
  let best = minimumK;
  for (let k = minimumK; k <= maximumK; k += scanStepK) if (chi(k) < chi(best)) best = k;
  if (best === minimumK || best + scanStepK > maximumK) throw new RangeError(`The best substellar temperature sits at the edge of ${minimumK}..${maximumK} K.`);
  const golden = (low: number, high: number, f: (k: number) => number) => {
    const ratio = (Math.sqrt(5) - 1) / 2;
    let a = high - ratio * (high - low), b = low + ratio * (high - low), fa = f(a), fb = f(b);
    while (high - low > 0.01) {
      if (fa < fb) { high = b; b = a; fb = fa; a = high - ratio * (high - low); fa = f(a); }
      else { low = a; a = b; fa = fb; b = low + ratio * (high - low); fb = f(b); }
    }
    return (low + high) / 2;
  };
  const substellarK = golden(best - scanStepK, best + scanStepK, chi), fit = at(substellarK);
  // The chi-squared + 1 crossings, by bisection on each side of the minimum.
  const crossing = (outward: number) => {
    let inner = substellarK, outer = substellarK + outward;
    while (chi(outer) < fit.chiSquared + 1) { inner = outer; outer += outward; if (outer < minimumK || outer > maximumK) throw new RangeError('The uncertainty runs past the scanned range.'); }
    while (Math.abs(outer - inner) > 0.01) { const middle = (inner + outer) / 2; if (chi(middle) < fit.chiSquared + 1) inner = middle; else outer = middle; }
    return (inner + outer) / 2;
  };
  const lower = crossing(-scanStepK), upper = crossing(scanStepK);
  return { substellarK, lowerK: lower, upperK: upper, chiSquared: fit.chiSquared, stellarCorrection: fit.stellarCorrection, systematics: fit.systematics,
    samples: n, parameters: 1 + columns.length, bic: fit.chiSquared + (1 + columns.length) * Math.log(n) };
}

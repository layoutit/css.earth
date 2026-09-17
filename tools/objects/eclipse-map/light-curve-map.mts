/** A temperature map from a light curve, end to end: the eigencurve fit of `eigenmap-fit.mts` with the analyst's systematics, then
 * brightness temperature over the instrument band the light curve summed.
 *
 * The band conversion follows how a time-series light curve is made: counts summed over detector pixels (or filter samples). With
 * C_i the star's counts in sample i and I_i its intensity there, the planet-to-star count ratio of a planet emitting B(lambda, T) is
 * sum_i C_i B(lambda_i, T) / I_i over sum_i C_i. The map value times pi (1 + s_corr) / rp^2 is that ratio (Rauscher et al. 2018,
 * eq. 8, over a band), so the temperature is the T at which the two agree. Photon counting enters through C_i: a measured count
 * spectrum already carries it, and a filter curve is weighted by lambda. */
import type { HostedOrbit } from '@cssearth/astronomy';
import { continuousHotspot, eigenBasis, equalAngleGrid, evaluateFit, fitEigenmap, planckRadiance, type EigenBasis, type EigenFit } from './eigenmap-fit.mts';

export interface LightCurve { readonly time: Float64Array; readonly flux: Float64Array; readonly error: Float64Array; readonly columns: ReadonlyMap<string, Float64Array> }

export type Systematic =
  | { readonly kind: 'time' }
  | { readonly kind: 'exponential-ramp'; readonly timeConstantsDays: readonly number[] }
  | { readonly kind: 'column'; readonly column: string };

export interface FitRecipe {
  /** Candidate models: every degree with every eigencurve count it has. */
  readonly degrees: readonly number[]; readonly eigencurves: readonly number[]; readonly positive: boolean;
  /** Samples within this orbital phase of mid-transit are dropped: the transit measures the star, not the map. */
  readonly transitExclusionPhase: number;
  readonly systematics: readonly Systematic[];
  readonly gridHeight: number;
}

/** Fits the map, choosing the model by BIC. Linear systematics are columns; an exponential ramp's time constant is profiled over
 * its grid by chi-squared on the simplest candidate (lowest degree, fewest eigencurves) and then held for every candidate. Time-like columns start at the first sample; other columns are centred on their median over the fitted
 * samples. Models within 2 of the lowest BIC are not distinguished by the data, so the one with fewest parameters, then the
 * lowest degree, is taken. */
export function fitLightCurveMap(curve: LightCurve, recipe: FitRecipe, orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number },
  planetRadiusStellarRadii: number) {
  const n = curve.time.length;
  if (![curve.flux, curve.error].every(values => values.length === n) || [...curve.columns.values()].some(values => values.length !== n)) throw new RangeError('Light-curve columns must share one length.');
  if (!recipe.degrees.length || !recipe.eigencurves.length || [...recipe.degrees, ...recipe.eigencurves].some(v => !Number.isSafeInteger(v) || v < 1)) throw new RangeError('Candidate degrees and eigencurve counts must be positive whole numbers.');
  const keep: number[] = [];
  for (let i = 0; i < n; i++) {
    const phase = (((curve.time[i]! - orbit.transitTimeBmjdTdb) / orbit.periodDays) % 1 + 1) % 1;
    if (Math.min(phase, 1 - phase) >= recipe.transitExclusionPhase && [curve.time[i], curve.flux[i], curve.error[i]].every(Number.isFinite) && curve.error[i]! > 0) keep.push(i);
  }
  const pick = (values: Float64Array) => Float64Array.from(keep, i => values[i]!);
  const time = pick(curve.time), flux = pick(curve.flux), error = pick(curve.error), start = curve.time[0]!;
  const median = (values: Float64Array) => { const sorted = Float64Array.from(values).sort(); return sorted[Math.floor(sorted.length / 2)]!; };
  const ramps = recipe.systematics.filter(s => s.kind === 'exponential-ramp');
  if (ramps.length > 1) throw new TypeError('A fit takes at most one exponential ramp.');
  const columns = (tau: number | null) => recipe.systematics.map(s => {
    if (s.kind === 'time') return Float64Array.from(time, t => t - start);
    if (s.kind === 'exponential-ramp') return Float64Array.from(time, t => Math.exp(-(t - start) / tau!));
    const values = curve.columns.get(s.column);
    if (!values) throw new TypeError(`The light curve has no ${s.column} column.`);
    const picked = pick(values), centre = median(picked);
    return picked.map(v => v - centre);
  });
  const taus = ramps.length ? ramps[0]!.timeConstantsDays : [null];
  const degrees = [...recipe.degrees].sort((a, b) => a - b), counts = [...recipe.eigencurves].sort((a, b) => a - b);
  const bases = new Map(degrees.map(degree => [degree, eigenBasis(degree, equalAngleGrid(recipe.gridHeight, 2 * recipe.gridHeight), orbit, host, planetRadiusStellarRadii, time)]));
  const fitWith = (basis: EigenBasis, count: number, tau: number | null) => fitEigenmap(basis, count, flux, error, () => true, { positive: recipe.positive, systematics: columns(tau) });
  let tau = taus[0]!;
  if (taus.length > 1) {
    const simplest = bases.get(degrees[0]!)!, count = counts.find(c => c <= simplest.curves.length);
    if (count === undefined) throw new RangeError('No candidate eigencurve count fits the lowest degree.');
    let lowest = Infinity;
    for (const candidate of taus) { const chi = fitWith(simplest, count, candidate).chiSquared; if (chi < lowest) { lowest = chi; tau = candidate; } }
  }
  const candidates: { basis: EigenBasis; fit: EigenFit; tau: number | null }[] = [];
  for (const degree of degrees) {
    const basis = bases.get(degree)!;
    for (const count of counts) {
      if (count > basis.curves.length) continue;
      const fit = fitWith(basis, count, tau);
      if (!recipe.positive || fit.positive) candidates.push({ basis, fit, tau });
    }
  }
  if (!candidates.length) throw new Error('No candidate model fits with positive emission.');
  const lowest = Math.min(...candidates.map(c => c.fit.bic));
  const chosen = candidates.filter(c => c.fit.bic <= lowest + 2).sort((a, b) => a.fit.parameters - b.fit.parameters || a.basis.lmax - b.basis.lmax || a.fit.bic - b.fit.bic)[0]!;
  return { basis: chosen.basis, fit: chosen.fit, rampTimeConstantDays: chosen.tau, samples: keep.length, hotspot: continuousHotspot(chosen.basis, chosen.fit, 0.05),
    candidates: candidates.map(c => ({ degree: c.basis.lmax, eigencurves: c.fit.ncurves, chiSquared: c.fit.chiSquared, bic: c.fit.bic, rampTimeConstantDays: c.tau })) };
}

export interface BandSamples { readonly wavelengthMicrons: Float64Array; readonly counts: Float64Array; readonly stellarIntensity: Float64Array }

/** Brightness temperature over a counted band, tabulated once so a map converts cell by cell without a root search per cell. The
 * table spans `minimumK`..`maximumK` in 0.25 K steps; ratios outside it return NaN. */
export function bandTemperatureTable(band: BandSamples, { minimumK = 50, maximumK = 6000 } = {}) {
  const n = band.wavelengthMicrons.length;
  if (n < 1 || band.counts.length !== n || band.stellarIntensity.length !== n) throw new RangeError('A band needs matching wavelengths, counts and stellar intensities.');
  if ([...band.counts].some(c => !(c >= 0)) || [...band.stellarIntensity].some(i => !(i > 0))) throw new RangeError('Band counts must be non-negative and stellar intensities positive.');
  const total = band.counts.reduce((sum, c) => sum + c, 0);
  const ratio = (temperature: number) => { let sum = 0; for (let i = 0; i < n; i++) sum += band.counts[i]! * planckRadiance(band.wavelengthMicrons[i]!, temperature) / band.stellarIntensity[i]!; return sum / total; };
  const step = 0.25, size = Math.round((maximumK - minimumK) / step) + 1, table = Float64Array.from({ length: size }, (_, k) => ratio(minimumK + k * step));
  return {
    ratio,
    /** The temperature whose band count ratio equals `pi * value * (1 + s_corr) / rp^2`. */
    temperature(value: number, planetRadiusStellarRadii: number, stellarCorrection = 0) {
      const target = Math.PI * value * (1 + stellarCorrection) / planetRadiusStellarRadii ** 2;
      if (!(target >= table[0]!) || !(target <= table[size - 1]!)) return NaN;
      let low = 0, high = size - 1;
      while (high - low > 1) { const middle = (low + high) >> 1; if (table[middle]! < target) low = middle; else high = middle; }
      // Planck emission is steep in T, so interpolate in log ratio between neighbouring rows.
      const a = Math.log(table[low]!), b = Math.log(table[high]!), f = b > a ? (Math.log(target) - a) / (b - a) : 0;
      return minimumK + (low + f) * step;
    },
  };
}

/** Mean of a finely sampled spectrum over each sample's extent (half-way to its neighbours), so a model resolved to 0.1 A meets a
 * detector pixel or filter sample on equal terms. Wavelengths must increase. */
export function binAverage(spectrum: { wavelengthMicrons: Float64Array; values: Float64Array }, centres: Float64Array) {
  const w = spectrum.wavelengthMicrons, v = spectrum.values;
  for (let i = 1; i < w.length; i++) if (!(w[i]! > w[i - 1]!)) throw new RangeError('Spectrum wavelengths must increase.');
  if (centres.length < 2) throw new RangeError('Bin averages need at least two samples to know their extents.');
  for (let i = 1; i < centres.length; i++) if (!(centres[i]! > centres[i - 1]!)) throw new RangeError('Sample wavelengths must increase.');
  // Prefix trapezoid integral, then the average over each [low, high] by interpolating the integral.
  const integral = new Float64Array(w.length);
  for (let i = 1; i < w.length; i++) integral[i] = integral[i - 1]! + 0.5 * (v[i]! + v[i - 1]!) * (w[i]! - w[i - 1]!);
  const at = (x: number) => {
    if (!(x >= w[0]! && x <= w[w.length - 1]!)) throw new RangeError(`The spectrum does not cover ${x} microns.`);
    let low = 0, high = w.length - 1;
    while (high - low > 1) { const middle = (low + high) >> 1; if (w[middle]! <= x) low = middle; else high = middle; }
    const f = (x - w[low]!) / (w[high]! - w[low]!), value = v[low]! + f * (v[high]! - v[low]!);
    return integral[low]! + 0.5 * (v[low]! + value) * (x - w[low]!);
  };
  return Float64Array.from(centres, (c, i) => {
    const low = i > 0 ? (c + centres[i - 1]!) / 2 : c - (centres[1]! - c) / 2, high = i < centres.length - 1 ? (c + centres[i + 1]!) / 2 : c + (c - centres[i - 1]!) / 2;
    return (at(high) - at(low)) / (high - low);
  });
}

/** Temperatures on an equal-angle grid (south to north, west to east from -180 degrees); cells whose fitted intensity is not
 * positive, or that no sampled time showed, have no temperature. */
export function temperatureGrid(basis: EigenBasis, fit: EigenFit, table: ReturnType<typeof bandTemperatureTable>, planetRadiusStellarRadii: number, height: number) {
  const grid = equalAngleGrid(height, 2 * height), values = evaluateFit(basis, fit, grid.latitudes, grid.longitudes);
  const coarse = basis.grid, temperatures = new Float64Array(values.length);
  for (let c = 0; c < values.length; c++) {
    const row = Math.min(coarse.height - 1, Math.floor((grid.latitudes[c]! + 90) / 180 * coarse.height)), column = Math.min(coarse.width - 1, Math.floor((grid.longitudes[c]! + 180) / 360 * coarse.width));
    temperatures[c] = basis.visible[row * coarse.width + column] && values[c]! > 0 ? table.temperature(values[c]!, planetRadiusStellarRadii, fit.stellarCorrection) : NaN;
  }
  return { ...grid, temperatures };
}

/** Brightness temperature of the hemisphere centred on `centreLongitude` at the equator (0: the dayside, 180: the nightside), from
 * the planet-to-star flux that hemisphere shows: intensity weighted by the cosine to the centre, integrated on a 0.5 degree grid.
 * A uniform map of intensity 1/pi shows flux 1, so the flux over pi is the equivalent uniform map value. */
export function hemisphereTemperature(basis: EigenBasis, fit: EigenFit, table: ReturnType<typeof bandTemperatureTable>, planetRadiusStellarRadii: number, centreLongitude: number) {
  const grid = equalAngleGrid(360, 720), intensity = evaluateFit(basis, fit, grid.latitudes, grid.longitudes), cell = (Math.PI / 360) ** 2;
  let flux = 0;
  for (let c = 0; c < intensity.length; c++) {
    const latitude = grid.latitudes[c]! * Math.PI / 180, mu = Math.cos(latitude) * Math.cos((grid.longitudes[c]! - centreLongitude) * Math.PI / 180);
    if (mu > 0) flux += intensity[c]! * mu * Math.cos(latitude) * cell;
  }
  return { flux, temperature: table.temperature(flux / Math.PI, planetRadiusStellarRadii, fit.stellarCorrection) };
}

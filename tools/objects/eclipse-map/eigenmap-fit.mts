/** Eclipse mapping by eigencurves, independent of starry: the method of Rauscher et al. (2018) as ThERESA implements it
 * (Challener & Rauscher 2022), on this repository's own orbit, synchronous rotation and occultation geometry.
 *
 * 1. Each real spherical harmonic Y_lm (1 <= l <= lmax), with positive and negative sign, is integrated into a light curve.
 * 2. An eigen-decomposition of those curves (the right singular vectors ThERESA's truncated SVD computes) orders them into
 *    orthogonal eigencurves; each has an eigenmap, a combination of harmonics.
 * 3. The system flux is modelled as 1 + s_corr + C0 * uniform(t) + sum_k c_k * eigencurve_k(t), a linear model fitted by
 *    weighted least squares, with the brightness of every cell that faced the observer kept positive.
 *
 * Because the planet turns with the orbit's own synchronous rotation, its spin axis is the orbit normal: the axis tilt of the
 * public ThERESA code (map inclination left at 90 degrees) cannot occur here. */
import type { HostedOrbit } from '@cssearth/astronomy';
import { mapBasisCurves, type LightTravel } from './phase-curve.mts';
import { harmonicOrder, realSphericalHarmonics } from './spherical-harmonics.mts';

export interface MapGrid { readonly width: number; readonly height: number; readonly latitudes: Float64Array; readonly longitudes: Float64Array }
export interface EigenBasis {
  readonly lmax: number; readonly grid: MapGrid;
  /** Uniform planet (Y_00 = 1, intensity 1/pi everywhere) light curve: planet-to-star flux 1 when a full hemisphere shows. */
  readonly uniform: Float64Array;
  /** Eigencurves, strongest first: rows [curve][time]. */
  readonly curves: readonly Float64Array[];
  /** Eigenmap intensities on the grid: rows [curve][cell], each in the same units as the uniform map's 1/pi. */
  readonly maps: readonly Float64Array[];
  /** Eigenvalues of the harmonic curve Gram matrix, strongest first. */
  readonly eigenvalues: readonly number[];
  /** Harmonic coefficients of each eigenmap, rows [curve][harmonic] in `harmonicOrder(lmax)`: the maps on any grid. */
  readonly harmonicCoefficients: readonly Float64Array[];
  /** 1 for each cell that faced the observer at some sampled time. */
  readonly visible: Uint8Array;
}

/** An equal-angle cell-centred grid: rows run south to north, columns west to east from -180 degrees. */
export function equalAngleGrid(height: number, width: number): MapGrid {
  const latitudes = new Float64Array(height * width), longitudes = new Float64Array(height * width);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    latitudes[row * width + column] = -90 + (row + 0.5) * 180 / height;
    longitudes[row * width + column] = -180 + (column + 0.5) * 360 / width;
  }
  return { width, height, latitudes, longitudes };
}

/** Eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi rotations: columns of `vectors` pair with `values`. */
export function symmetricEigen(matrix: Float64Array, n: number) {
  const a = Float64Array.from(matrix), v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let sweep = 0; sweep < 100; sweep++) {
    // Measure convergence relative to the matrix itself. An absolute floor would declare a uniformly small, still non-diagonal
    // matrix converged; scale before squaring so a uniformly large finite matrix cannot overflow the norm either.
    let scale = 0;
    for (const value of a) scale = Math.max(scale, Math.abs(value));
    if (scale === 0) break;
    let off = 0, norm = 0;
    for (let p = 0; p < n; p++) for (let q = 0; q < n; q++) {
      const scaled = a[p * n + q]! / scale;
      norm += scaled * scaled;
      if (q > p) off += scaled * scaled;
    }
    if (off < 1e-30 * norm) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p * n + q]!;
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q * n + q]! - a[p * n + p]!) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k * n + p]!, akq = a[k * n + q]!;
        a[k * n + p] = c * akp - s * akq; a[k * n + q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p * n + k]!, aqk = a[q * n + k]!;
        a[p * n + k] = c * apk - s * aqk; a[q * n + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k * n + p]!, vkq = v[k * n + q]!;
        v[k * n + p] = c * vkp - s * vkq; v[k * n + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j * n + j]! - a[i * n + i]!);
  return { values: order.map(i => a[i * n + i]!), vectors: order.map(i => Float64Array.from({ length: n }, (_, k) => v[k * n + i]!)) };
}

/** Decompose harmonic light curves with ThERESA's `[+L, -L]` truncated-SVD convention. The Gram eigenvalues are the squared
 * singular values; coefficient and curve signs are arbitrary but paired. Exported so the numerical basis can be checked directly. */
export function eigencurveBasis(harmonicCurves: readonly Float64Array[]) {
  const h = harmonicCurves.length, samples = harmonicCurves[0]?.length ?? 0;
  if (!h || !samples || harmonicCurves.some(curve => curve.length !== samples)) throw new RangeError('Harmonic curves must be a non-empty rectangular matrix.');
  if (harmonicCurves.some(curve => curve.some(value => !Number.isFinite(value)))) throw new RangeError('Harmonic curves must contain only finite values.');
  // ThERESA stacks each curve with its negative (2 per harmonic) and takes the right singular vectors of that matrix. The Gram
  // matrix of [+L, -L] is [[G, -G], [-G, G]]; its eigenvectors are exactly those singular vectors.
  const n = 2 * h, gram = new Float64Array(n * n);
  for (let i = 0; i < h; i++) for (let j = i; j < h; j++) {
    let dot = 0;
    const a = harmonicCurves[i]!, b = harmonicCurves[j]!;
    for (let t = 0; t < samples; t++) dot += a[t]! * b[t]!;
    for (const [si, sj, sign] of [[0, 0, 1], [0, 1, -1], [1, 0, -1], [1, 1, 1]] as const) {
      gram[(2 * i + si) * n + 2 * j + sj] = sign * dot; gram[(2 * j + sj) * n + 2 * i + si] = sign * dot;
    }
  }
  if (gram.some(value => !Number.isFinite(value))) throw new RangeError('Harmonic-curve Gram matrix overflowed.');
  const { values, vectors } = symmetricEigen(gram, n);
  // Rank is at most the number of harmonics; round-off eigenvalues below this relative floor carry no curve.
  const floor = Math.max(...values) * 1e-12;
  const curves: Float64Array[] = [], eigenvalues: number[] = [], harmonicCoefficients: Float64Array[] = [];
  for (let k = 0; k < n; k++) {
    // A curve with no weight on the difference of a +/- pair is identically zero (the symmetric half of the spectrum).
    const coefficients = Float64Array.from({ length: h }, (_, i) => vectors[k]![2 * i]! - vectors[k]![2 * i + 1]!);
    if (coefficients.every(value => Math.abs(value) < 1e-9) || !(values[k]! > floor)) continue;
    const curve = new Float64Array(samples);
    for (let i = 0; i < h; i++) for (let t = 0; t < samples; t++) curve[t] += coefficients[i]! * harmonicCurves[i]![t]!;
    curves.push(curve); eigenvalues.push(values[k]!); harmonicCoefficients.push(coefficients);
  }
  return { curves, eigenvalues, harmonicCoefficients };
}

/** Harmonic light curves, their eigencurves and eigenmaps for one observation. */
/** `longitudeSymmetric` keeps only harmonics even in longitude about the substellar meridian (m >= 0): a map whose hot spot
 * sits on the substellar point, for data that measure the dayside and nightside but not an offset. */
export function eigenBasis(lmax: number, grid: MapGrid, orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number },
  planetRadiusStellarRadii: number, timesBmjd: ArrayLike<number>, lightTravel: LightTravel = {}, { longitudeSymmetric = false } = {}): EigenBasis {
  const order = harmonicOrder(lmax), harmonics = realSphericalHarmonics(lmax, grid.latitudes, grid.longitudes);
  const cells = grid.width * grid.height, uniformMap = new Float64Array(cells).fill(1 / Math.PI), visible = new Uint8Array(cells);
  // Intensity of a map with coefficient 1 on Y_lm is Y_lm / pi, the convention in which a uniform map with Y_00 = 1 gives flux 1.
  const intensity = harmonics.map(row => row.map(value => value / Math.PI));
  const [uniform, ...harmonicCurves] = mapBasisCurves([uniformMap, ...intensity], grid, orbit, host, planetRadiusStellarRadii, timesBmjd, visible, lightTravel);
  // A harmonic odd in longitude (m < 0, sin m*lon) contributes no curve, so no eigencurve carries it and its coefficient is 0.
  if (longitudeSymmetric) order.forEach(([, m], index) => { if (m < 0) harmonicCurves[index]!.fill(0); });
  const { curves, eigenvalues, harmonicCoefficients } = eigencurveBasis(harmonicCurves), maps = harmonicCoefficients.map(coefficients => {
    const map = new Float64Array(cells);
    for (let i = 0; i < coefficients.length; i++) for (let c = 0; c < cells; c++) map[c] += coefficients[i]! * intensity[i]![c]!;
    return map;
  });
  return { lmax, grid, uniform, curves, maps, eigenvalues, harmonicCoefficients, visible };
}

export interface EigenFit {
  /** Weighted normal equations of the linear model (parameters c_1..c_n, C0, s_corr): chi2(x) = x'Ax - 2b'x + dataSquares. */
  readonly normal: { readonly dimension: number; readonly matrix: Float64Array; readonly rhs: Float64Array; readonly dataSquares: number };
  readonly ncurves: number; readonly coefficients: Float64Array; readonly uniformAmplitude: number; readonly stellarCorrection: number;
  /** Coefficients of the systematics columns, in the order given. */
  readonly systematics: Float64Array;
  readonly chiSquared: number; readonly samples: number; readonly parameters: number; readonly bic: number; readonly positive: boolean;
  /** Planet-to-star flux per unit intensity on the grid (the ThERESA fmap units). */
  readonly map: Float64Array;
}

function factorPositiveDefinite(matrix: Float64Array, n: number) {
  if (!Number.isInteger(n) || n < 1 || matrix.length !== n * n) throw new RangeError('Linear-system dimensions do not match.');
  if (matrix.some(value => !Number.isFinite(value))) throw new RangeError('Linear system must contain only finite values.');
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = matrix[i * n + j]!, b = matrix[j * n + i]!;
    const scale = Math.max(1, Math.abs(a), Math.abs(b), Math.sqrt(Math.abs(matrix[i * n + i]!)) * Math.sqrt(Math.abs(matrix[j * n + j]!)));
    if (Math.abs(a - b) > 1e-12 * scale) throw new RangeError('Linear-system matrix must be symmetric.');
  }
  // Cholesky factorization. A nonpositive pivot means the supplied system is not positive definite; silently replacing it with a
  // tiny number would change the system and can amplify an invalid fit into enormous finite-looking output.
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let sum = matrix[i * n + j]!;
    for (let k = 0; k < j; k++) sum -= l[i * n + k]! * l[j * n + k]!;
    if (i === j) {
      if (!(sum > 0) || !Number.isFinite(sum)) throw new RangeError(`Linear-system matrix is not positive definite at pivot ${i}.`);
      l[i * n + i] = Math.sqrt(sum);
    } else {
      l[i * n + j] = sum / l[j * n + j]!;
      if (!Number.isFinite(l[i * n + j]!)) throw new RangeError('Linear-system factorization produced a non-finite value.');
    }
  }
  return l;
}

function solve(matrix: Float64Array, rhs: Float64Array, n: number) {
  if (rhs.length !== n) throw new RangeError('Linear-system dimensions do not match.');
  if (rhs.some(value => !Number.isFinite(value))) throw new RangeError('Linear system must contain only finite values.');
  const l = factorPositiveDefinite(matrix, n);
  const y = new Float64Array(n), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { let sum = rhs[i]!; for (let k = 0; k < i; k++) sum -= l[i * n + k]! * y[k]!; y[i] = sum / l[i * n + i]!; }
  for (let i = n - 1; i >= 0; i--) { let sum = y[i]!; for (let k = i + 1; k < n; k++) sum -= l[k * n + i]! * x[k]!; x[i] = sum / l[i * n + i]!; }
  if (x.some(value => !Number.isFinite(value))) throw new RangeError('Linear solve produced a non-finite value.');
  for (let i = 0; i < n; i++) {
    let product = 0, scale = Math.abs(rhs[i]!);
    for (let j = 0; j < n; j++) { const term = matrix[i * n + j]! * x[j]!; product += term; scale += Math.abs(term); }
    if (!Number.isFinite(product) || Math.abs(product - rhs[i]!) > 1e-10 * Math.max(1, scale)) throw new RangeError(`Linear solve residual is too large in row ${i}.`);
  }
  return x;
}

/** Fit the first `ncurves` eigencurves. Parameters: c_1..c_n, C0, s_corr, then one coefficient per `systematics` column (an
 * instrument baseline, ramp or decorrelation vector sampled at the data times, zero outside its visit). With `positive`, every
 * visible cell keeps a positive intensity (C0/pi + sum c_k map_k > 0), solved by a log-barrier Newton method from the uniform map. */
export function fitEigenmap(basis: EigenBasis, ncurves: number, data: ArrayLike<number>, errors: ArrayLike<number>, use: (index: number) => boolean,
  { positive = true, systematics = [] as readonly ArrayLike<number>[], fixStellarCorrection = false } = {}): EigenFit {
  if (!(ncurves >= 1 && ncurves <= basis.curves.length)) throw new RangeError(`ncurves must be 1..${basis.curves.length}.`);
  if (errors.length !== data.length || basis.uniform.length !== data.length || basis.curves.slice(0, ncurves).some(curve => curve.length !== data.length)) throw new RangeError('Data, errors and model curves must have matching lengths.');
  if (systematics.some(column => column.length !== data.length)) throw new RangeError('Systematics columns must sample every data point.');
  const p = ncurves + 2 + systematics.length, columns = [...basis.curves.slice(0, ncurves), basis.uniform, null, ...systematics];
  // `fixStellarCorrection` holds s_corr at 0, as ThERESA does for an already normalized light curve: a stiff prior row pins it,
  // so the parameter layout and the sampler stay the same, and at exactly 0 it adds nothing to chi-squared.
  const normal = new Float64Array(p * p), rhs = new Float64Array(p);
  let samples = 0, dataSquares = 0;
  const row = new Float64Array(p);
  for (let t = 0; t < data.length; t++) {
    if (!use(t)) continue;
    if (!Number.isFinite(data[t]!) || !Number.isFinite(errors[t]!) || !(errors[t]! > 0)) throw new RangeError(`Used data and errors must be finite, with a positive error (sample ${t}).`);
    const w = 1 / errors[t]! ** 2, target = data[t]! - 1;
    for (let k = 0; k < p; k++) row[k] = columns[k] ? columns[k]![t]! : 1;
    if (row.some(value => !Number.isFinite(value))) throw new RangeError(`Model curves must be finite at used sample ${t}.`);
    for (let i = 0; i < p; i++) { rhs[i] += w * row[i]! * target; for (let j = 0; j < p; j++) normal[i * p + j] += w * row[i]! * row[j]!; }
    dataSquares += w * target * target; samples++;
  }
  if (!Number.isFinite(dataSquares)) throw new RangeError('Normal equations contain non-finite weighted data.');
  if (fixStellarCorrection) normal[(ncurves + 1) * p + ncurves + 1] += 1e30;
  const chi2 = (x: Float64Array) => {
    let value = dataSquares;
    for (let i = 0; i < p; i++) { value -= 2 * x[i]! * rhs[i]!; for (let j = 0; j < p; j++) value += x[i]! * normal[i * p + j]! * x[j]!; }
    return value;
  };
  const cells = basis.visible.length, visibleCells = Array.from({ length: cells }, (_, c) => c).filter(c => basis.visible[c]);
  // Constraint rows: intensity(c) = sum_k x_k map_k(c) + x_n / pi.
  const constraint = (x: Float64Array, c: number) => { let value = x[ncurves]! / Math.PI; for (let k = 0; k < ncurves; k++) value += x[k]! * basis.maps[k]![c]!; return value; };
  const minimum = (x: Float64Array) => visibleCells.reduce((low, c) => Math.min(low, constraint(x, c)), Infinity);
  let x = solve(normal, rhs, p);
  if (positive && !(minimum(x) > 0)) {
    // Feasible start: the best uniform planet (coefficients zero), then barrier Newton steps with a growing weight.
    x = new Float64Array(p);
    // Best uniform planet with the systematics free: solve the sub-system without the eigencurve coefficients.
    const free = Array.from({ length: p - ncurves }, (_, i) => ncurves + i), q = free.length, reduced = new Float64Array(q * q);
    free.forEach((a, i) => free.forEach((b, j) => { reduced[i * q + j] = normal[a * p + b]!; }));
    const start = solve(reduced, Float64Array.from(free, a => rhs[a]!), q);
    free.forEach((a, i) => { x[a] = start[i]!; });
    x[ncurves] = Math.max(x[ncurves]!, 1e-6);
    const a = visibleCells.map(c => { const r = new Float64Array(p); r[ncurves] = 1 / Math.PI; for (let k = 0; k < ncurves; k++) r[k] = basis.maps[k]![c]!; return r; });
    const objective = (candidate: Float64Array, weight: number) => {
      let barrier = 0;
      for (const r of a) { let v = 0; for (let k = 0; k < p; k++) v += r[k]! * candidate[k]!; if (!(v > 0)) return Infinity; barrier -= Math.log(v); }
      return weight * chi2(candidate) + barrier;
    };
    for (let weight = 1e-6; weight < 1e12; weight *= 8) {
      for (let iteration = 0; iteration < 60; iteration++) {
        const gradient = new Float64Array(p), hessian = new Float64Array(p * p);
        for (let i = 0; i < p; i++) { let s = 0; for (let j = 0; j < p; j++) s += normal[i * p + j]! * x[j]!; gradient[i] = 2 * weight * (s - rhs[i]!); for (let j = 0; j < p; j++) hessian[i * p + j] = 2 * weight * normal[i * p + j]!; }
        for (const r of a) {
          let v = 0; for (let k = 0; k < p; k++) v += r[k]! * x[k]!;
          for (let i = 0; i < p; i++) { gradient[i] -= r[i]! / v; for (let j = 0; j < p; j++) hessian[i * p + j] += r[i]! * r[j]! / (v * v); }
        }
        const step = solve(hessian, gradient, p);
        let decrement = 0; for (let i = 0; i < p; i++) decrement += step[i]! * gradient[i]!;
        if (decrement / 2 < 1e-10) break;
        const current = objective(x, weight);
        let size = 1, next = x;
        for (let tries = 0; tries < 60; tries++, size /= 2) {
          next = x.map((value, i) => value - size * step[i]!);
          if (objective(next, weight) <= current - 0.25 * size * decrement) break;
        }
        x = next;
      }
      if (visibleCells.length / weight < 1e-3) break;
    }
  }
  const map = new Float64Array(cells);
  for (let c = 0; c < cells; c++) map[c] = constraint(x, c);
  const chiSquared = chi2(x);
  return { normal: { dimension: p, matrix: normal, rhs, dataSquares }, ncurves, coefficients: x.slice(0, ncurves), uniformAmplitude: x[ncurves]!, stellarCorrection: x[ncurves + 1]!,
    systematics: x.slice(ncurves + 2), chiSquared, samples, parameters: p - (fixStellarCorrection ? 1 : 0),
    bic: chiSquared + (p - (fixStellarCorrection ? 1 : 0)) * Math.log(samples), positive: minimum(x) > 0, map };
}

/** A fitted map evaluated anywhere: intensity C0/pi + sum_k c_k * eigenmap_k at each (latitude, longitude) in degrees. */
export function evaluateFit(basis: EigenBasis, fit: EigenFit, latitudesDegrees: ArrayLike<number>, longitudesDegrees: ArrayLike<number>) {
  const harmonics = realSphericalHarmonics(basis.lmax, latitudesDegrees, longitudesDegrees), values = new Float64Array(latitudesDegrees.length).fill(fit.uniformAmplitude / Math.PI);
  for (let k = 0; k < fit.ncurves; k++) for (let i = 0; i < harmonics.length; i++) {
    const weight = fit.coefficients[k]! * basis.harmonicCoefficients[k]![i]! / Math.PI;
    if (weight === 0) continue;
    for (let p = 0; p < values.length; p++) values[p] += weight * harmonics[i]![p]!;
  }
  return values;
}

/** The maximum of a fitted map on the dayside it was observed on, located to `resolutionDegrees` by a coarse search refined around the best cell. */
export function continuousHotspot(basis: EigenBasis, fit: EigenFit, resolutionDegrees = 0.1) {
  const { width, height } = basis.grid;
  if (!Number.isFinite(resolutionDegrees) || !(resolutionDegrees > 0)) throw new RangeError('Hotspot resolution must be positive and finite.');
  if (!(width > 0 && height > 0) || basis.visible.length !== width * height) throw new RangeError('Visibility mask dimensions must match the map grid.');
  const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180;
  // Extend the grid's observed-cell mask to continuous coordinates by assigning each point to its containing equal-angle cell.
  const observed = (latitude: number, longitude: number) => {
    const row = Math.min(height - 1, Math.max(0, Math.floor((latitude + 90) * height / 180)));
    const column = Math.min(width - 1, Math.floor((wrapLongitude(longitude) + 180) * width / 360));
    return basis.visible[row * width + column] !== 0;
  };
  const search = (latitudes: number[], longitudes: number[]) => {
    const lat: number[] = [], lon: number[] = [];
    for (const a of latitudes) for (const b of longitudes) if (observed(a, b)) { lat.push(a); lon.push(wrapLongitude(b)); }
    if (lat.length === 0) throw new RangeError('Hotspot refinement has no points in the observed region.');
    const values = evaluateFit(basis, fit, lat, lon);
    let best = 0; for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
    return { latitude: lat[best]!, longitude: lon[best]!, value: values[best]! };
  };
  const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
  // The observed dayside: the eclipse map constrains longitudes the observer saw; start from the hottest visible grid cell.
  const start = hotspot(fit.map, basis.grid, basis.visible);
  let best = start, step = Math.max(basis.grid.width > 0 ? 360 / basis.grid.width : 4, resolutionDegrees * 2);
  while (step > resolutionDegrees) {
    const next = step / 4;
    best = search(range(Math.max(-90, best.latitude - 2 * step), Math.min(90, best.latitude + 2 * step), next), range(best.longitude - 2 * step, best.longitude + 2 * step, next));
    step = next;
  }
  return best;
}

/** The hottest visible cell of a map, by latitude and longitude of its centre. */
export function hotspot(map: ArrayLike<number>, grid: MapGrid, visible?: Uint8Array) {
  const cells = grid.width * grid.height;
  if (map.length !== cells || grid.latitudes.length !== cells || grid.longitudes.length !== cells || (visible && visible.length !== cells)) throw new RangeError('Map, coordinates and visibility mask must match the grid dimensions.');
  let best = -1;
  for (let c = 0; c < map.length; c++) if ((!visible || visible[c]) && (best < 0 || map[c]! > map[best]!)) best = c;
  if (best < 0) throw new RangeError('Hotspot search has no visible map cells.');
  return { latitude: grid.latitudes[best]!, longitude: grid.longitudes[best]!, value: map[best]! };
}

/** Brightness temperature from a flux map at one effective wavelength (Rauscher et al. 2018, eq. 8; ThERESA fmap_to_tmap). */
export function brightnessTemperature(flux: number, wavelengthMicrons: number, planetRadiusStellarRadii: number, stellarTemperatureK: number, stellarCorrection = 0) {
  const h = 6.62607015e-34, c = 299792458, k = 1.380649e-23, wavelength = wavelengthMicrons * 1e-6;
  const ptemp = h * c / (wavelength * k);
  return ptemp / Math.log(1 + planetRadiusStellarRadii ** 2 * Math.expm1(ptemp / stellarTemperatureK) / (Math.PI * flux * (1 + stellarCorrection)));
}

/** A small deterministic generator (mulberry32) so posterior runs are reproducible. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  const uniform = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = () => { let u = 0; while (u === 0) u = uniform(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform()); };
  return { uniform, normal };
}

/** Posterior samples of the linear eigenmap model: Metropolis steps with the Gaussian proposal of the unconstrained covariance,
 * and positive intensity on every visible cell as a hard prior (ThERESA's posflux). Returns `keep` evenly thinned samples. */
export function sampleEigenmap(basis: EigenBasis, fit: EigenFit, { steps = 200000, burn = 5000, keep = 2000, seed = 1 } = {}) {
  const n = fit.ncurves, { dimension: p, matrix, rhs, dataSquares } = fit.normal;
  if (!Number.isInteger(p) || p < 1 || matrix.length !== p * p || rhs.length !== p) throw new RangeError('Stored normal-equation dimensions do not match.');
  if (!Number.isInteger(fit.parameters) || fit.parameters < 0 || fit.parameters > p) throw new RangeError('Free-parameter count must fit within the stored parameter dimension.');
  const initial = Float64Array.from([...fit.coefficients, fit.uniformAmplitude, fit.stellarCorrection, ...fit.systematics]);
  if (initial.length !== p) throw new RangeError('Fitted parameter layout does not match the stored normal-equation dimension.');
  if (!Number.isFinite(dataSquares) || initial.some(value => !Number.isFinite(value))) throw new RangeError('Posterior inputs must contain only finite values.');
  const chi2 = (x: Float64Array) => { let v = dataSquares; for (let i = 0; i < p; i++) { v -= 2 * x[i]! * rhs[i]!; let row = 0; for (let j = 0; j < p; j++) row += matrix[i * p + j]! * x[j]!; v += x[i]! * row; } return v; };
  // If A = L L^T, then L^-T z has covariance A^-1 for standard-normal z.
  // Reuse the normal matrix's factorization; forming A^-1 and factoring it again adds rounding and duplicate machinery.
  const lower = factorPositiveDefinite(matrix, p);
  const visible = Array.from(basis.visible.keys()).filter(c => basis.visible[c]);
  const feasible = (x: Float64Array) => { for (const c of visible) { let v = x[n]! / Math.PI; for (let k = 0; k < n; k++) v += x[k]! * basis.maps[k]![c]!; if (!(v > 0)) return false; } return true; };
  const random = seededRandom(seed), scale = 2.38 / Math.sqrt(p);
  let x = initial, current = chi2(x), accepted = 0;
  if (!Number.isFinite(current)) throw new RangeError('Initial posterior chi-squared is not finite.');
  const samples: Float64Array[] = [], interval = Math.max(1, Math.floor((steps - burn) / keep)), chains: number[] = [];
  const z = new Float64Array(p), delta = new Float64Array(p), proposal = new Float64Array(p);
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < p; i++) z[i] = random.normal();
    for (let i = p - 1; i >= 0; i--) {
      let value = z[i]!;
      for (let j = i + 1; j < p; j++) value -= lower[j * p + i]! * delta[j]!;
      delta[i] = value / lower[i * p + i]!;
      proposal[i] = x[i]! + scale * delta[i]!;
    }
    const next = chi2(proposal);
    if (Math.log(random.uniform()) < (current - next) / 2 && feasible(proposal)) { x = Float64Array.from(proposal); current = next; accepted++; }
    if (step >= burn && (step - burn) % interval === 0 && samples.length < keep) { samples.push(Float64Array.from(x)); chains.push(current); }
  }
  return { samples, chiSquared: chains, acceptance: accepted / steps };
}

/** Median and 16th/84th percentiles. */
export function percentiles(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b), at = (q: number) => { const i = q * (sorted.length - 1), lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo); };
  return { median: at(0.5), low: at(0.16), high: at(0.84) };
}

const PLANCK = 6.62607015e-34, LIGHT = 299792458, BOLTZMANN = 1.380649e-23;
/** Planck spectral radiance per wavelength, W m^-3 sr^-1, at a wavelength in microns. */
export function planckRadiance(wavelengthMicrons: number, temperatureK: number) {
  const wavelength = wavelengthMicrons * 1e-6;
  return 2 * PLANCK * LIGHT ** 2 / (wavelength ** 5 * Math.expm1(PLANCK * LIGHT / (wavelength * BOLTZMANN * temperatureK)));
}

export interface Band { readonly wavelengthMicrons: ArrayLike<number>; readonly response: ArrayLike<number> }

/** Brightness temperature over a band: the temperature whose Planck emission, weighted by the band response, matches the planet's
 * intensity. A map value is planet-to-star flux per unit intensity, so the planet-to-star intensity ratio is pi * value / rp^2 (as in
 * Rauscher et al. 2018, eq. 8); the star's band intensity is its spectrum on the band's wavelengths (`stellarIntensity`, any
 * consistent units, e.g. a PHOENIX surface intensity) or a blackbody at `stellarTemperatureK`. Solved by bisection. */
export function bandBrightnessTemperature(flux: number, band: Band, planetRadiusStellarRadii: number,
  star: { readonly stellarTemperatureK: number } | { readonly stellarIntensity: ArrayLike<number> }, stellarCorrection = 0) {
  const n = band.wavelengthMicrons.length;
  if (n < 2 || band.response.length !== n) throw new RangeError('A band needs matching wavelengths and responses.');
  const integrate = (value: (i: number) => number) => {
    let sum = 0;
    for (let i = 1; i < n; i++) sum += 0.5 * (value(i) * band.response[i]! + value(i - 1) * band.response[i - 1]!) * (band.wavelengthMicrons[i]! - band.wavelengthMicrons[i - 1]!);
    return sum;
  };
  const stellar = 'stellarTemperatureK' in star ? integrate(i => planckRadiance(band.wavelengthMicrons[i]!, star.stellarTemperatureK))
    : integrate(i => star.stellarIntensity[i]!);
  const target = Math.PI * flux * (1 + stellarCorrection) / planetRadiusStellarRadii ** 2 * stellar;
  if (!(target > 0)) return NaN;
  let low = 10, high = 50000;
  for (let iteration = 0; iteration < 100; iteration++) {
    const middle = Math.sqrt(low * high);
    if (integrate(i => planckRadiance(band.wavelengthMicrons[i]!, middle)) < target) low = middle; else high = middle;
    if (high / low < 1 + 1e-10) break;
  }
  return Math.sqrt(low * high);
}

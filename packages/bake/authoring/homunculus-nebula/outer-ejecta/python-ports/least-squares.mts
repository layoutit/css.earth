/**
 * Bounded nonlinear least squares, as SciPy 1.18.1's `scipy.optimize.least_squares(method='trf')` solves it with
 * bounds (Branch, Coleman and Li 1999's Trust Region Reflective algorithm, scipy/optimize/_lsq/trf.py `trf_bounds`),
 * and `curveFit`, `scipy.optimize.curve_fit` with bounds on top of it. The outer ejecta's chain fits two things with it:
 * the Carina nebula's own H-beta line under each knot (a Gaussian, ./knots.mts) and Mehner et al. (2016)'s bent tube to the
 * MUSE points (soft L1 loss, ./tube.mts).
 *
 * It follows SciPy step by step: the Jacobian by forward differences that turn back at a bound
 * (scipy/optimize/_numdiff.py, step `sqrt(eps) * sign(x) * max(1, |x|)`), Coleman and Li's scaling, the exact trust-region
 * solve on the singular value decomposition of the scaled, regularized Jacobian (Moré's iteration on the
 * Levenberg-Marquardt parameter), the reflective step choice, `make_strictly_feasible`, and the same termination tests
 * and statuses. What cannot be matched bit for bit is the floating-point rounding of LAPACK's SVD and BLAS's dot
 * products: the iterates agree with SciPy's to rounding, which a long run on a non-smooth residual can amplify.
 *
 * Only bounded problems are solved: SciPy runs a different routine (`trf_no_bounds`) when every bound is infinite, and
 * that one is not ported.
 */

const EPS = 2 ** -52;

/** The residuals at a parameter vector. */
export type Residuals = (x: Float64Array) => ArrayLike<number>;
export type Loss = 'linear' | 'soft_l1';
export interface LeastSquaresOptions {
  /** Lower and upper bounds, one number for every parameter or one each; -Infinity and Infinity for none. */
  lower?: number | ArrayLike<number>; upper?: number | ArrayLike<number>;
  loss?: Loss; fScale?: number; ftol?: number; xtol?: number; gtol?: number;
  /** The most residual evaluations the iteration may spend (SciPy's `max_nfev`, not counting the Jacobian's); 100 times the parameter count by default. */
  maxNfev?: number;
}
export interface LeastSquaresResult {
  x: Float64Array; cost: number; fun: Float64Array; optimality: number; nfev: number; njev: number;
  /** 0 the evaluations ran out, 1 gtol, 2 ftol, 3 xtol, 4 ftol and xtol (SciPy's statuses). */
  status: 0 | 1 | 2 | 3 | 4; success: boolean;
}

/** NumPy's sum of a double array: pairwise in blocks of 128, eight running sums within a block. */
export function pairwiseSum(a: ArrayLike<number>, start = 0, n = a.length - start): number {
  if (n < 8) { let res = 0; for (let i = 0; i < n; i++) res += a[start + i]!; return res; }
  if (n <= 128) {
    const r = [0, 1, 2, 3, 4, 5, 6, 7].map(j => a[start + j]!); let i = 8;
    for (; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j]! += a[start + i + j]!;
    let res = ((r[0]! + r[1]!) + (r[2]! + r[3]!)) + ((r[4]! + r[5]!) + (r[6]! + r[7]!));
    for (; i < n; i++) res += a[start + i]!;
    return res;
  }
  let n2 = Math.floor(n / 2); n2 -= n2 % 8;
  return pairwiseSum(a, start, n2) + pairwiseSum(a, start + n2, n - n2);
}
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!; return s; };
const norm = (a: ArrayLike<number>) => Math.sqrt(dot(a, a));
/** The next double after `x` toward `toward` (C's nextafter). */
export function nextAfter(x: number, toward: number): number {
  if (Number.isNaN(x) || Number.isNaN(toward)) return NaN;
  if (x === toward) return toward;
  if (x === 0) return toward > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x);
  const bits = view.getBigUint64(0), up = (toward > x) === (x > 0);
  view.setBigUint64(0, up ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

/** Which parameters sit on a bound (-1 lower, 1 upper), within `rtol` times max(1, |bound|) (SciPy's `find_active_constraints`). */
function activeConstraints(x: Float64Array, lb: Float64Array, ub: Float64Array, rtol: number): Int8Array {
  const active = new Int8Array(x.length);
  for (let i = 0; i < x.length; i++) {
    if (rtol === 0) { if (x[i]! <= lb[i]!) active[i] = -1; if (x[i]! >= ub[i]!) active[i] = 1; continue; }
    const lowerDist = x[i]! - lb[i]!, upperDist = ub[i]! - x[i]!;
    if (Number.isFinite(lb[i]!) && lowerDist <= Math.min(upperDist, rtol * Math.max(1, Math.abs(lb[i]!)))) active[i] = -1;
    if (Number.isFinite(ub[i]!) && upperDist <= Math.min(lowerDist, rtol * Math.max(1, Math.abs(ub[i]!)))) active[i] = 1;
  }
  return active;
}
/** A point moved just inside the bounds it touches (SciPy's `make_strictly_feasible`). */
export function makeStrictlyFeasible(x: Float64Array, lb: Float64Array, ub: Float64Array, rstep = 1e-10): Float64Array {
  const out = Float64Array.from(x), active = activeConstraints(x, lb, ub, rstep);
  for (let i = 0; i < x.length; i++) {
    if (active[i] === -1) out[i] = rstep === 0 ? nextAfter(lb[i]!, ub[i]!) : lb[i]! + rstep * Math.max(1, Math.abs(lb[i]!));
    else if (active[i] === 1) out[i] = rstep === 0 ? nextAfter(ub[i]!, lb[i]!) : ub[i]! - rstep * Math.max(1, Math.abs(ub[i]!));
    if (out[i]! < lb[i]! || out[i]! > ub[i]!) out[i] = 0.5 * (lb[i]! + ub[i]!);
  }
  return out;
}

/** The Jacobian (m by n, row-major) by forward differences, each step turned back where it would leave the bounds (SciPy's '2-point' with `_adjust_scheme_to_bounds`, one-sided). */
export function forwardDifferenceJacobian(fun: (x: Float64Array) => Float64Array, x0: Float64Array, f0: Float64Array, lb: Float64Array, ub: Float64Array): Float64Array {
  const n = x0.length, m = f0.length, J = new Float64Array(m * n), rstep = Math.sqrt(EPS), bounded = Array.from(lb).some(v => v !== -Infinity) || Array.from(ub).some(v => v !== Infinity);
  for (let i = 0; i < n; i++) {
    let h = rstep * (x0[i]! >= 0 ? 1 : -1) * Math.max(1, Math.abs(x0[i]!));
    if (bounded) {
      const lowerDist = x0[i]! - lb[i]!, upperDist = ub[i]! - x0[i]!, x = x0[i]! + h, violated = x < lb[i]! || x > ub[i]!, fitting = Math.abs(h) <= Math.max(lowerDist, upperDist);
      if (violated && fitting) h = -h;
      else if (!fitting) h = upperDist >= lowerDist ? upperDist : -lowerDist;
    }
    const x1 = Float64Array.from(x0); x1[i] = x0[i]! + h;
    const dx = (x0[i]! + h) - x0[i]!, f1 = fun(x1);
    for (let k = 0; k < m; k++) J[k * n + i] = (f1[k]! - f0[k]!) / dx;
  }
  return J;
}

/**
 * The thin singular value decomposition of a tall matrix (`rows` by `n`, row-major, rows >= n): Householder QR, then
 * one-sided Jacobi on R. Returns the singular values in decreasing order, V (n by n, row-major, columns the right
 * singular vectors), and Uᵀ b for a given b (only what the trust-region step needs).
 */
export function thinSvdSolveParts(A: Float64Array, rows: number, n: number, b: Float64Array): { s: Float64Array; V: Float64Array; ub: Float64Array } {
  if (rows < n) throw new RangeError(`thinSvdSolveParts needs at least as many rows as columns (${rows} < ${n}).`);
  const R = Float64Array.from(A), qb = Float64Array.from(b);
  for (let k = 0; k < n; k++) {
    let alpha = 0; for (let i = k; i < rows; i++) alpha += R[i * n + k]! ** 2; alpha = Math.sqrt(alpha);
    if (alpha === 0) continue;
    if (R[k * n + k]! > 0) alpha = -alpha;
    const v = new Float64Array(rows - k); for (let i = k; i < rows; i++) v[i - k] = R[i * n + k]!; v[0]! -= alpha;
    const vv = dot(v, v); if (vv === 0) continue;
    for (let j = k; j < n; j++) { let s = 0; for (let i = k; i < rows; i++) s += v[i - k]! * R[i * n + j]!; s = 2 * s / vv; for (let i = k; i < rows; i++) R[i * n + j]! -= s * v[i - k]!; }
    let s = 0; for (let i = k; i < rows; i++) s += v[i - k]! * qb[i]!; s = 2 * s / vv; for (let i = k; i < rows; i++) qb[i]! -= s * v[i - k]!;
  }
  // One-sided Jacobi on the n-by-n R: rotate column pairs until every pair is orthogonal; V accumulates the rotations.
  const W = new Float64Array(n * n), V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) { V[i * n + i] = 1; for (let j = i; j < n; j++) W[i * n + j] = R[i * n + j]!; }
  for (let sweep = 0; sweep < 100; sweep++) {
    let rotated = false;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      let a = 0, bb = 0, c = 0; for (let i = 0; i < n; i++) { a += W[i * n + p]! ** 2; bb += W[i * n + q]! ** 2; c += W[i * n + p]! * W[i * n + q]!; }
      if (c === 0 || Math.abs(c) <= EPS * Math.sqrt(a * bb)) continue;
      rotated = true;
      const zeta = (bb - a) / (2 * c), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)), cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
      for (let i = 0; i < n; i++) {
        const wp = W[i * n + p]!, wq = W[i * n + q]!; W[i * n + p] = cs * wp - sn * wq; W[i * n + q] = sn * wp + cs * wq;
        const vp = V[i * n + p]!, vq = V[i * n + q]!; V[i * n + p] = cs * vp - sn * vq; V[i * n + q] = sn * vp + cs * vq;
      }
    }
    if (!rotated) break;
  }
  const sigma = Float64Array.from({ length: n }, (_, j) => { let s = 0; for (let i = 0; i < n; i++) s += W[i * n + j]! ** 2; return Math.sqrt(s); });
  const order = Array.from({ length: n }, (_, j) => j).sort((x, y) => sigma[y]! - sigma[x]!);
  const s = new Float64Array(n), Vs = new Float64Array(n * n), ubOut = new Float64Array(n);
  for (const [k, j] of order.entries()) {
    s[k] = sigma[j]!;
    for (let i = 0; i < n; i++) Vs[i * n + k] = V[i * n + j]!;
    // U = Q [W / s]: Uᵀ b = (W / s)ᵀ (Qᵀ b)[0..n). A zero singular value has no left vector; it adds nothing.
    let u = 0; if (sigma[j]! > 0) for (let i = 0; i < n; i++) u += W[i * n + j]! / sigma[j]! * qb[i]!; ubOut[k] = u;
  }
  return { s, V: Vs, ub: ubOut };
}

/** The trust-region step from the SVD (SciPy's `solve_lsq_trust_region`): the Gauss-Newton step if it fits within `Delta`, else Moré's iteration on the Levenberg-Marquardt parameter. */
function solveLsqTrustRegion(n: number, m: number, uf: Float64Array, s: Float64Array, V: Float64Array, Delta: number, initialAlpha: number | undefined): { p: Float64Array; alpha: number } {
  const suf = Float64Array.from(s, (v, i) => v * uf[i]!);
  const phiAndDerivative = (alpha: number) => {
    const q = Float64Array.from(suf, (v, i) => v / (s[i]! ** 2 + alpha)), pNorm = norm(q);
    let sum = 0; for (let i = 0; i < n; i++) sum += suf[i]! ** 2 / (s[i]! ** 2 + alpha) ** 3;
    return [pNorm - Delta, -sum / pNorm] as const;
  };
  const vTimes = (w: Float64Array) => Float64Array.from({ length: n }, (_, i) => { let t = 0; for (let k = 0; k < n; k++) t += V[i * n + k]! * w[k]!; return t; });
  const fullRank = m >= n ? s[n - 1]! > EPS * m * s[0]! : false;
  if (fullRank) { const p = vTimes(Float64Array.from(uf, (v, i) => -v / s[i]!)); if (norm(p) <= Delta) return { p, alpha: 0 }; }
  let alphaUpper = norm(suf) / Delta, alphaLower = 0;
  if (fullRank) { const [phi, phiPrime] = phiAndDerivative(0); alphaLower = -phi / phiPrime; }
  let alpha = initialAlpha === undefined || (!fullRank && initialAlpha === 0) ? Math.max(0.001 * alphaUpper, Math.sqrt(alphaLower * alphaUpper)) : initialAlpha;
  for (let it = 0; it < 10; it++) {
    if (alpha < alphaLower || alpha > alphaUpper) alpha = Math.max(0.001 * alphaUpper, Math.sqrt(alphaLower * alphaUpper));
    const [phi, phiPrime] = phiAndDerivative(alpha);
    if (phi < 0) alphaUpper = alpha;
    const ratio = phi / phiPrime;
    alphaLower = Math.max(alphaLower, alpha - ratio);
    alpha -= (phi + Delta) * ratio / Delta;
    if (Math.abs(phi) < 0.01 * Delta) break;
  }
  const p = vTimes(Float64Array.from(suf, (v, i) => -v / (s[i]! ** 2 + alpha))), scale = Delta / norm(p);
  for (let i = 0; i < n; i++) p[i]! *= scale;
  return { p, alpha };
}

/** J_h s for J_h = J diag(d) (m by n). */
const jacTimes = (J: Float64Array, d: Float64Array, m: number, n: number, s: ArrayLike<number>) => Float64Array.from({ length: m }, (_, k) => { let t = 0; for (let i = 0; i < n; i++) t += J[k * n + i]! * d[i]! * s[i]!; return t; });
function buildQuadratic1d(J: Float64Array, d: Float64Array, m: number, n: number, g: Float64Array, s: Float64Array, diag: Float64Array, s0?: Float64Array): [number, number, number] {
  const v = jacTimes(J, d, m, n, s); let a = dot(v, v);
  a += dot(Float64Array.from(s, (x, i) => x * diag[i]!), s); a *= 0.5;
  let b = dot(g, s);
  if (!s0) return [a, b, 0];
  const u = jacTimes(J, d, m, n, s0); b += dot(u, v);
  let c = 0.5 * dot(u, u) + dot(g, s0);
  const s0d = Float64Array.from(s0, (x, i) => x * diag[i]!); b += dot(s0d, s); c += 0.5 * dot(s0d, s0);
  return [a, b, c];
}
function minimizeQuadratic1d(a: number, b: number, lb: number, ub: number, c = 0): [number, number] {
  const t = [lb, ub]; if (a !== 0) { const extremum = -0.5 * b / a; if (lb < extremum && extremum < ub) t.push(extremum); }
  // NumPy's argmin: the first of the smallest.
  let best = t[0]!, bestY = best * (a * best + b) + c;
  for (let k = 1; k < t.length; k++) { const y = t[k]! * (a * t[k]! + b) + c; if (y < bestY) { best = t[k]!; bestY = y; } }
  return [best, bestY];
}
function evaluateQuadratic(J: Float64Array, d: Float64Array, m: number, n: number, g: Float64Array, s: Float64Array, diag: Float64Array): number {
  const Js = jacTimes(J, d, m, n, s); let q = dot(Js, Js); q += dot(Float64Array.from(s, (x, i) => x * diag[i]!), s);
  return 0.5 * q + dot(s, g);
}
/** How far along `s` from `x` the first bound lies, and which components reach it with which sign (SciPy's `step_size_to_bound`). */
function stepSizeToBound(x: Float64Array, s: Float64Array, lb: Float64Array, ub: Float64Array): [number, Int8Array] {
  const steps = Float64Array.from(x, () => Infinity);
  for (let i = 0; i < x.length; i++) if (s[i] !== 0) steps[i] = Math.max((lb[i]! - x[i]!) / s[i]!, (ub[i]! - x[i]!) / s[i]!);
  let min = Infinity; for (const v of steps) if (v < min) min = v;
  return [min, Int8Array.from(steps, (v, i) => v === min ? Math.sign(s[i]!) : 0)];
}
function intersectTrustRegion(x: Float64Array, s: Float64Array, Delta: number): [number, number] {
  const a = dot(s, s); if (a === 0) throw new RangeError('intersectTrustRegion: `s` is zero.');
  const b = dot(x, s), c = dot(x, x) - Delta ** 2; if (c > 0) throw new RangeError('intersectTrustRegion: `x` is not within the trust region.');
  const d = Math.sqrt(b * b - a * c), q = -(b + (b < 0 || Object.is(b, -0) ? -d : d)), t1 = q / a, t2 = c / q;
  return t1 < t2 ? [t1, t2] : [t2, t1];
}
const inBounds = (x: Float64Array, lb: Float64Array, ub: Float64Array) => Array.from(x).every((v, i) => v >= lb[i]! && v <= ub[i]!);

/** The Trust Region Reflective step choice (SciPy's `select_step`): the trust-region step if it stays within the bounds; else the best of that step cut at the bound (by `theta`), its reflection off the bound, and the scaled anti-gradient. */
function selectStep(x: Float64Array, J: Float64Array, dJ: Float64Array, m: number, n: number, diagH: Float64Array, gH: Float64Array, p0: Float64Array, pH0: Float64Array, d: Float64Array, Delta: number, lb: Float64Array, ub: Float64Array, theta: number): [Float64Array, Float64Array, number] {
  const p = Float64Array.from(p0), pH = Float64Array.from(pH0);
  if (inBounds(Float64Array.from(x, (v, i) => v + p[i]!), lb, ub)) return [p, pH, -evaluateQuadratic(J, dJ, m, n, gH, pH, diagH)];
  const [pStride, hits] = stepSizeToBound(x, p, lb, ub);
  let rH = Float64Array.from(pH, (v, i) => hits[i] ? -v : v), r = Float64Array.from(rH, (v, i) => d[i]! * v);
  for (let i = 0; i < n; i++) { p[i]! *= pStride; pH[i]! *= pStride; }
  const xOnBound = Float64Array.from(x, (v, i) => v + p[i]!), toTr = intersectTrustRegion(pH, rH, Delta)[1], toBound = stepSizeToBound(xOnBound, r, lb, ub)[0];
  let rStride = Math.min(toBound, toTr), rStrideL: number, rStrideU: number;
  if (rStride > 0) { rStrideL = (1 - theta) * pStride / rStride; rStrideU = rStride === toBound ? theta * toBound : toTr; } else { rStrideL = 0; rStrideU = -1; }
  let rValue = Infinity;
  if (rStrideL <= rStrideU) {
    const [a, b, c] = buildQuadratic1d(J, dJ, m, n, gH, rH, diagH, pH);
    [rStride, rValue] = minimizeQuadratic1d(a, b, rStrideL, rStrideU, c);
    rH = Float64Array.from(rH, (v, i) => v * rStride + pH[i]!); r = Float64Array.from(rH, (v, i) => v * d[i]!);
  }
  for (let i = 0; i < n; i++) { p[i]! *= theta; pH[i]! *= theta; }
  const pValue = evaluateQuadratic(J, dJ, m, n, gH, pH, diagH);
  const agH = Float64Array.from(gH, v => -v), ag = Float64Array.from(agH, (v, i) => d[i]! * v), agToTr = Delta / norm(agH), agToBound = stepSizeToBound(x, ag, lb, ub)[0];
  const [a, b] = buildQuadratic1d(J, dJ, m, n, gH, agH, diagH), [agStride, agValue] = minimizeQuadratic1d(a, b, 0, agToBound < agToTr ? theta * agToBound : agToTr);
  for (let i = 0; i < n; i++) { agH[i]! *= agStride; ag[i]! *= agStride; }
  if (pValue < rValue && pValue < agValue) return [p, pH, -pValue];
  if (rValue < pValue && rValue < agValue) return [r, rH, -rValue];
  return [ag, agH, -agValue];
}

const toBounds = (value: number | ArrayLike<number> | undefined, n: number, fallback: number, name: string) => {
  const out = typeof value === 'number' || value === undefined ? new Float64Array(n).fill(value ?? fallback) : Float64Array.from(value);
  if (out.length !== n || out.some(Number.isNaN)) throw new TypeError(`least squares: ${name} must be a number or ${n} numbers.`);
  return out;
};

/** SciPy's `least_squares(fun, x0, bounds=(lower, upper), method='trf', loss, f_scale, max_nfev)` with a '2-point' Jacobian, x_scale 1 and the exact trust-region solver. */
export function leastSquares(fun: Residuals, x0In: ArrayLike<number>, options: LeastSquaresOptions = {}): LeastSquaresResult {
  const n = x0In.length, loss = options.loss ?? 'linear', fScale = options.fScale ?? 1, ftol = options.ftol ?? 1e-8, xtol = options.xtol ?? 1e-8, gtol = options.gtol ?? 1e-8, maxNfev = options.maxNfev ?? 100 * n;
  if (!n || Array.from(x0In).some(v => !Number.isFinite(v))) throw new TypeError('least squares: x0 must be finite numbers.');
  if (loss !== 'linear' && loss !== 'soft_l1') throw new TypeError(`least squares: loss ${String(loss)} is not ported.`);
  if (!(fScale > 0) || !Number.isInteger(maxNfev) || maxNfev <= 0) throw new TypeError('least squares: f_scale must be positive and max_nfev a positive integer.');
  for (const t of [ftol, xtol, gtol]) if (!(t >= EPS)) throw new TypeError('least squares: the tolerances must be at least machine epsilon.');
  const lb = toBounds(options.lower, n, -Infinity, 'lower'), ub = toBounds(options.upper, n, Infinity, 'upper');
  if (lb.some((v, i) => v >= ub[i]!)) throw new RangeError('least squares: each lower bound must be strictly less than its upper bound.');
  if (lb.every(v => v === -Infinity) && ub.every(v => v === Infinity)) throw new RangeError('least squares: only bounded problems are ported (SciPy runs trf_no_bounds otherwise).');
  let x: Float64Array = Float64Array.from(x0In);
  if (!inBounds(x, lb, ub)) throw new RangeError('least squares: the initial guess is outside the bounds.');
  x = makeStrictlyFeasible(x, lb, ub);
  const evaluate = (at: Float64Array) => Float64Array.from(fun(Float64Array.from(at)));
  let f: Float64Array = evaluate(x); const m = f.length;
  if (!m || f.some(v => !Number.isFinite(v))) throw new RangeError('least squares: residuals are not finite at the initial point.');
  // The loss: rho and its first two derivatives at z = (f / f_scale)², scaled as SciPy's construct_loss_function does.
  const lossCost = (r: Float64Array) => { if (loss === 'linear') return 0.5 * dot(r, r); const rho0 = Float64Array.from(r, v => 2 * (Math.sqrt(1 + (v / fScale) ** 2) - 1)); return 0.5 * fScale ** 2 * pairwiseSum(rho0); };
  const robust = (Jm: Float64Array, r: Float64Array) => {
    if (loss === 'linear') return { J: Jm, f: r };
    const Js = Float64Array.from(Jm), fs = Float64Array.from(r);
    for (let k = 0; k < m; k++) {
      const t = 1 + (r[k]! / fScale) ** 2, rho1 = t ** -0.5, rho2 = -0.5 * t ** -1.5 / fScale ** 2;
      let scale = rho1 + 2 * rho2 * r[k]! ** 2; if (scale < EPS) scale = EPS; scale = Math.sqrt(scale);
      fs[k] = r[k]! * (rho1 / scale); for (let i = 0; i < n; i++) Js[k * n + i]! *= scale;
    }
    return { J: Js, f: fs };
  };
  const gradient = (Jm: Float64Array, r: Float64Array) => Float64Array.from({ length: n }, (_, i) => { let t = 0; for (let k = 0; k < m; k++) t += Jm[k * n + i]! * r[k]!; return t; });
  const clScaling = (at: Float64Array, g: Float64Array) => { const v = new Float64Array(n).fill(1), dv = new Float64Array(n);
    for (let i = 0; i < n; i++) { if (g[i]! < 0 && Number.isFinite(ub[i]!)) { v[i] = ub[i]! - at[i]!; dv[i] = -1; } if (g[i]! > 0 && Number.isFinite(lb[i]!)) { v[i] = at[i]! - lb[i]!; dv[i] = 1; } }
    return { v, dv }; };

  let fTrue: Float64Array = Float64Array.from(f), nfev = 1, njev = 1, cost = lossCost(f);
  let { J, f: fScaled } = robust(forwardDifferenceJacobian(evaluate, x, f, lb, ub), f);
  let g = gradient(J, fScaled);
  let { v } = clScaling(x, g);
  let Delta = norm(Float64Array.from(x, (value, i) => value / Math.sqrt(v[i]!))); if (Delta === 0) Delta = 1;
  let gNorm = 0, alpha = 0, status: LeastSquaresResult['status'] | undefined;
  for (;;) {
    const scaling = clScaling(x, g); v = scaling.v; const dv = scaling.dv;
    gNorm = 0; for (let i = 0; i < n; i++) gNorm = Math.max(gNorm, Math.abs(g[i]! * v[i]!));
    if (gNorm < gtol) status = 1;
    if (status !== undefined || nfev === maxNfev) break;
    const d = Float64Array.from(v, value => Math.sqrt(value)), diagH = Float64Array.from(g, (value, i) => value * dv[i]!), gH = Float64Array.from(g, (value, i) => d[i]! * value);
    // The augmented system [J diag(d); diag(sqrt(diag_h))] and [f; 0], decomposed once per outer iteration.
    const aug = new Float64Array((m + n) * n), fAug = new Float64Array(m + n);
    for (let k = 0; k < m; k++) { fAug[k] = fScaled[k]!; for (let i = 0; i < n; i++) aug[k * n + i] = J[k * n + i]! * d[i]!; }
    for (let i = 0; i < n; i++) aug[(m + i) * n + i] = Math.sqrt(diagH[i]!);
    const { s, V, ub: uf } = thinSvdSolveParts(aug, m + n, n, fAug), theta = Math.max(0.995, 1 - gNorm);
    let actualReduction = -1, xNew: Float64Array = x, fNew: Float64Array = f, costNew = cost;
    while (actualReduction <= 0 && nfev < maxNfev) {
      const solved = solveLsqTrustRegion(n, m, uf, s, V, Delta, alpha), pH = solved.p; alpha = solved.alpha;
      const p = Float64Array.from(pH, (value, i) => d[i]! * value);
      const [step, stepH, predictedReduction] = selectStep(x, J, d, m, n, diagH, gH, p, pH, d, Delta, lb, ub, theta);
      xNew = makeStrictlyFeasible(Float64Array.from(x, (value, i) => value + step[i]!), lb, ub, 0);
      fNew = evaluate(xNew); nfev++;
      const stepHNorm = norm(stepH);
      if (fNew.some(value => !Number.isFinite(value))) { Delta = 0.25 * stepHNorm; continue; }
      costNew = lossCost(fNew); actualReduction = cost - costNew;
      // update_tr_radius
      const ratio = predictedReduction > 0 ? actualReduction / predictedReduction : predictedReduction === actualReduction && actualReduction === 0 ? 1 : 0;
      let DeltaNew = Delta; if (ratio < 0.25) DeltaNew = 0.25 * stepHNorm; else if (ratio > 0.75 && stepHNorm > 0.95 * Delta) DeltaNew = Delta * 2;
      // check_termination
      const stepNorm = norm(step), ftolOk = actualReduction < ftol * cost && ratio > 0.25, xtolOk = stepNorm < xtol * (xtol + norm(x));
      status = ftolOk && xtolOk ? 4 : ftolOk ? 2 : xtolOk ? 3 : undefined;
      if (status !== undefined) break;
      alpha *= Delta / DeltaNew; Delta = DeltaNew;
    }
    if (actualReduction > 0) {
      x = xNew; f = fNew; fTrue = Float64Array.from(f); cost = costNew;
      ({ J, f: fScaled } = robust(forwardDifferenceJacobian(evaluate, x, f, lb, ub), f)); njev++;
      g = gradient(J, fScaled);
    }
  }
  const finalStatus = status ?? 0;
  return { x, cost, fun: fTrue, optimality: gNorm, nfev, njev, status: finalStatus, success: finalStatus > 0 };
}

/** SciPy's `curve_fit(model, xdata, ydata, p0, bounds=(lower, upper))`: least squares on model(xdata, p) - ydata by the bounded Trust Region Reflective method, 100 times the parameter count evaluations at most; throws, as curve_fit raises, when no optimum was found. */
export function curveFit(model: (xdata: Float64Array, p: Float64Array) => ArrayLike<number>, xdata: ArrayLike<number>, ydata: ArrayLike<number>, p0: ArrayLike<number>,
  bounds: readonly [number | ArrayLike<number>, number | ArrayLike<number>], maxNfev?: number): Float64Array {
  const xs = Float64Array.from(xdata), ys = Float64Array.from(ydata);
  if (xs.length !== ys.length || ys.some(value => !Number.isFinite(value))) throw new TypeError('curveFit: xdata and ydata must be finite and of one length.');
  const result = leastSquares(p => { const y = model(xs, p); return Float64Array.from({ length: ys.length }, (_, k) => y[k]! - ys[k]!); }, p0, { lower: bounds[0], upper: bounds[1], ...(maxNfev === undefined ? {} : { maxNfev }) });
  if (!result.success) throw new Error(`curveFit: optimal parameters not found: the maximum number of function evaluations (${result.nfev}) is exceeded.`);
  return result.x;
}

/**
 * The downhill simplex of Nelder and Mead (1965), as SciPy 1.18.1's `scipy.optimize.minimize(method='Nelder-Mead')`
 * runs it without bounds and with the standard coefficients (`_minimize_neldermead`, adaptive=False): reflection 1,
 * expansion 2, contraction 0.5, shrink 0.5; the first simplex the start and, for each parameter, the start with that
 * parameter 5% larger (0.00025 where it is zero). The outer ejecta's chain registers heic1912a on the sky with it
 * (./heic-registration.mts).
 *
 * The simplex is reordered by value after every iteration with a stable sort. SciPy calls NumPy's default argsort, which
 * for four or fewer values (three parameters) is an insertion sort and so also stable; equal values in a larger simplex
 * could be ordered differently.
 */
export interface NelderMeadOptions {
  /** Stop when every vertex is within `xatol` of the best in every parameter and every value within `fatol` of the best. */
  xatol?: number; fatol?: number;
  /** The most iterations, and function evaluations (SciPy's defaults: 200 per parameter for both when neither is given; with only `maxiter`, evaluations are unlimited). */
  maxiter?: number; maxfev?: number;
}
export interface NelderMeadResult { x: Float64Array; fun: number; nit: number; nfev: number; status: 0 | 1 | 2; success: boolean }

class MaxFunctionCalls extends Error {}

export function nelderMead(func: (x: Float64Array) => number, x0In: ArrayLike<number>, options: NelderMeadOptions = {}): NelderMeadResult {
  const N = x0In.length, x0 = Float64Array.from(x0In), xatol = options.xatol ?? 1e-4, fatol = options.fatol ?? 1e-4;
  if (!N || x0.some(v => !Number.isFinite(v))) throw new TypeError('nelderMead: x0 must be finite numbers.');
  if (!(xatol >= 0) || !(fatol >= 0)) throw new TypeError('nelderMead: xatol and fatol must not be negative.');
  let maxiter = options.maxiter, maxfun = options.maxfev;
  if (maxiter === undefined && maxfun === undefined) { maxiter = N * 200; maxfun = N * 200; }
  else if (maxiter === undefined) maxiter = maxfun === Infinity ? N * 200 : Infinity;
  else if (maxfun === undefined) maxfun = maxiter === Infinity ? N * 200 : Infinity;
  const maxIter = maxiter!, maxFun = maxfun!;
  const rho = 1, chi = 2, psi = 0.5, sigma = 0.5, nonzdelt = 0.05, zdelt = 0.00025;
  let sim: Float64Array[] = [Float64Array.from(x0)];
  for (let k = 0; k < N; k++) { const y = Float64Array.from(x0); y[k] = y[k] !== 0 ? (1 + nonzdelt) * y[k]! : zdelt; sim.push(y); }
  let fsim = new Float64Array(N + 1).fill(Infinity), fcalls = 0;
  const call = (x: Float64Array) => {
    if (fcalls >= maxFun) throw new MaxFunctionCalls('Too many function calls');
    fcalls++; const value = func(Float64Array.from(x));
    if (typeof value !== 'number') throw new TypeError('nelderMead: the objective must return a number.');
    return value;
  };
  const sortSimplex = () => {
    const order = Array.from({ length: N + 1 }, (_, i) => i);
    // Insertion sort (stable), as NumPy's argsort orders so few values.
    for (let i = 1; i < order.length; i++) { const key = order[i]!; let j = i - 1; while (j >= 0 && fsim[order[j]!]! > fsim[key]!) { order[j + 1] = order[j]!; j--; } order[j + 1] = key; }
    sim = order.map(i => sim[i]!); fsim = Float64Array.from(order, i => fsim[i]!);
  };
  try { for (let k = 0; k <= N; k++) fsim[k] = call(sim[k]!); } catch (error) { if (!(error instanceof MaxFunctionCalls)) throw error; }
  sortSimplex();
  let iterations = 1;
  const combine = (a: number, xbar: Float64Array, b: number, worst: Float64Array) => Float64Array.from(xbar, (v, i) => a * v - b * worst[i]!);
  while (fcalls < maxFun && iterations < maxIter) {
    try {
      let xSpread = 0, fSpread = 0;
      for (let j = 1; j <= N; j++) { fSpread = Math.max(fSpread, Math.abs(fsim[0]! - fsim[j]!)); for (let i = 0; i < N; i++) xSpread = Math.max(xSpread, Math.abs(sim[j]![i]! - sim[0]![i]!)); }
      if (xSpread <= xatol && fSpread <= fatol) break;
      // The centroid of all but the worst vertex: summed vertex by vertex, as NumPy's add.reduce down the first axis.
      const xbar = new Float64Array(N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) xbar[i]! += sim[j]![i]!; for (let i = 0; i < N; i++) xbar[i]! /= N;
      const worst = sim[N]!, xr = combine(1 + rho, xbar, rho, worst), fxr = call(xr);
      let doshrink = false;
      if (fxr < fsim[0]!) {
        const xe = combine(1 + rho * chi, xbar, rho * chi, worst), fxe = call(xe);
        if (fxe < fxr) { sim[N] = xe; fsim[N] = fxe; } else { sim[N] = xr; fsim[N] = fxr; }
      } else if (fxr < fsim[N - 1]!) { sim[N] = xr; fsim[N] = fxr; }
      else if (fxr < fsim[N]!) {
        const xc = combine(1 + psi * rho, xbar, psi * rho, worst), fxc = call(xc);
        if (fxc <= fxr) { sim[N] = xc; fsim[N] = fxc; } else doshrink = true;
      } else {
        const xcc = Float64Array.from(xbar, (v, i) => (1 - psi) * v + psi * worst[i]!), fxcc = call(xcc);
        if (fxcc < fsim[N]!) { sim[N] = xcc; fsim[N] = fxcc; } else doshrink = true;
      }
      if (doshrink) for (let j = 1; j <= N; j++) { sim[j] = Float64Array.from(sim[0]!, (v, i) => v + sigma * (sim[j]![i]! - v)); fsim[j] = call(sim[j]!); }
      iterations++;
    } catch (error) { if (!(error instanceof MaxFunctionCalls)) throw error; }
    sortSimplex();
  }
  let fun = Infinity; for (const v of fsim) if (v < fun) fun = v;
  const status = fcalls >= maxFun ? 1 : iterations >= maxIter ? 2 : 0;
  return { x: sim[0]!, fun, nit: iterations, nfev: fcalls, status, success: status === 0 };
}

/**
 * Mehner et al. (2016)'s outer shell, a bent tube about the Homunculus, fitted to the MUSE H-beta emission of the 1840s
 * material.
 *
 * The points (./muse-hbeta.mts `emissionPoints`): those faster than 450 km/s along the line of sight, less those on a sky
 * spot whose detections spread over more than 1,200 km/s (leftover starlight or a spike, not a wall crossing; spots of
 * 0.2 arcsec), less those within 1.3 arcsec of a Hubble tile dated before 1780 (the 1250 and 1550 ejecta; any tile
 * measured well, its date rho / mu). Each weighs the square root of its signal-to-noise (at most 30).
 *
 * The tube: a centreline through (ox, oy, oz) along the axis at position angle `pa` and `tilt` from the line of sight
 * (toward the receding end), bent by `bend` 1e-3 per arcsec squared toward `bendDir` about the axis, sampled every half
 * arcsec from -60 to 60; its radius goes from `rNear` (approaching end) to `rFar` (receding) between -15 and +15 arcsec.
 * A point's residual is its distance to the nearest centreline sample less the radius there, times its weight; the fit
 * is SciPy's bounded least squares with a soft L1 loss (scale 2 arcsec), 300 evaluations at most, from 12 starts (bend
 * -5, 0, 5 toward four directions) about the pole's position angle less 10 degrees (Mehner et al.) and 41 degrees of
 * tilt; the lowest cost wins, its bend written positive. Unseen wall costs nothing: only points pull on it.
 */
import { leastSquares } from './python-ports/least-squares.mts';
import { MOTION_EPOCH } from './knots.mts';
import { HALF, PIX } from './sky-grid.mts';

const RAD = Math.PI / 180;
/** arcsec per parsec at 2.3 kpc. */
export const ARCSEC_PER_PC = 206265 / 2300;
/** The centreline samples (arcsec along the axis): numpy.linspace(-60, 60, 241). */
export const SAMPLES = Float64Array.from({ length: 241 }, (_, i) => -60 + i * 0.5);
/** The parameters' order and bounds: pa, tilt (radians), bend, bendDir (radians), ox, oy, oz (arcsec), rNear, rFar (arcsec). */
export const LOWER = [250 * RAD, 25 * RAD, -20, -Math.PI, -8, -8, -8, 5, 4], UPPER = [360 * RAD, 60 * RAD, 20, Math.PI, 8, 8, 8, 30, 25];

type Vec = [number, number, number];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** The tube's frame: its axis toward the receding end, and two directions across it. */
export function frame(pa: number, tilt: number): { a: Vec; u: Vec; w: Vec } {
  const a: Vec = [Math.sin(tilt) * Math.sin(pa), Math.sin(tilt) * Math.cos(pa), Math.cos(tilt)], c = cross(a, [0, 0, 1]), n = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]), u: Vec = [c[0] / n, c[1] / n, c[2] / n];
  return { a, u, w: cross(a, u) };
}
/** The centreline at the samples (east, north, depth arcsec). */
export function centreline(q: ArrayLike<number>, samples: Float64Array = SAMPLES): Vec[] {
  const [pa, tilt, bend, bendDir, ox, oy, oz] = Array.from(q) as number[], { a, u, w } = frame(pa!, tilt!);
  const b: Vec = [0, 1, 2].map(i => Math.cos(bendDir!) * u[i]! + Math.sin(bendDir!) * w[i]!) as Vec, o: Vec = [ox!, oy!, oz!];
  return Array.from(samples, s => [0, 1, 2].map(i => o[i]! + s * a[i]! + bend! * 1e-3 * (s * s) * b[i]!) as Vec);
}
/** The wall's radius at a sample: rNear to rFar between -15 and 15 arcsec. */
export function radius(q: ArrayLike<number>, s: number): number { const t = Math.min(1, Math.max(0, (s + 15) / 30)); return q[7]! * (1 - t) + q[8]! * t; }

/** The points the tube is fitted to and their weights. */
export function tubePoints(points: Float32Array, fit: readonly ArrayLike<number>[]): { X: Float64Array; W: Float64Array; count: { all: number; fast: number; kept: number } } {
  const n = points.length / 5, old: [number, number][] = [];
  // Each row's motion: mu from the pixel motion, then to arcsec.
  for (const row of fit) {
    const [x, y, vx, vy, sig, , , rms] = Array.from(row) as number[], east = -(x! - HALF) * PIX, north = (y! - HALF) * PIX, mu = Math.hypot(vx!, vy!) * PIX;
    if (sig! * PIX < 0.006 && rms! < 2.5 && MOTION_EPOCH - Math.hypot(east, north) / Math.max(mu, 1e-9) < 1780) old.push([east, north]);
  }
  // Sky spots of 0.2 arcsec (numpy.round of float32 east and north times 5: halves to even) and the speeds detected on each.
  const spot = (value: number) => { const x = Math.fround(value * 5), f = Math.floor(x), rest = x - f; return rest > 0.5 || rest === 0.5 && f % 2 !== 0 ? f + 1 : f; };
  const keys = new Map<string, { lo: number; hi: number }>(), keyOf = (i: number) => `${spot(points[5 * i]!)},${spot(points[5 * i + 1]!)}`;
  for (let i = 0; i < n; i++) { const key = keyOf(i), v = points[5 * i + 3]!, range = keys.get(key); if (range) { range.lo = Math.min(range.lo, v); range.hi = Math.max(range.hi, v); } else keys.set(key, { lo: v, hi: v }); }
  const X: number[] = [], W: number[] = []; let fast = 0;
  for (let i = 0; i < n; i++) {
    const range = keys.get(keyOf(i))!, isFast = Math.abs(points[5 * i + 3]!) >= 450 && !(range.hi - range.lo > 1200); if (isFast) fast++;
    if (!isFast) continue;
    let nearest = Infinity; for (const [e, nn] of old) nearest = Math.min(nearest, Math.hypot(points[5 * i]! - e, points[5 * i + 1]! - nn));
    if (nearest < 1.3) continue;
    X.push(points[5 * i]!, points[5 * i + 1]!, points[5 * i + 2]!); W.push(Math.fround(Math.sqrt(Math.min(30, Math.max(0, points[5 * i + 4]!)))));
  }
  return { X: Float64Array.from(X), W: Float64Array.from(W), count: { all: n, fast, kept: W.length } };
}

/** Each point's weighted distance to the wall. */
export function tubeResiduals(q: ArrayLike<number>, X: Float64Array, W: Float64Array): Float64Array {
  const C = centreline(q), out = new Float64Array(W.length);
  for (let i = 0; i < W.length; i++) {
    const x = X[3 * i]!, y = X[3 * i + 1]!, z = X[3 * i + 2]!; let best = Infinity, at = 0;
    for (let k = 0; k < C.length; k++) { const c = C[k]!, dx = x - c[0], dy = y - c[1], dz = z - c[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < best) { best = d; at = k; } }
    out[i] = W[i]! * (best - radius(q, SAMPLES[at]!));
  }
  return out;
}

/** The fitted tube (tube.npy) and its cost. */
export function fitTube(X: Float64Array, W: Float64Array): { q: Float64Array; cost: number; within3: number } {
  const q0 = [300 * RAD, 41 * RAD, 0, 0, 0, 0, 0, 0.175 * ARCSEC_PER_PC, 0.11 * ARCSEC_PER_PC];
  let best: { x: Float64Array; cost: number } | undefined;
  for (const bend0 of [-5, 0, 5]) for (const bendDir0 of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const start = [...q0]; start[2] = bend0; start[3] = bendDir0;
    const result = leastSquares(q => tubeResiduals(q, X, W), start, { lower: LOWER, upper: UPPER, loss: 'soft_l1', fScale: 2, maxNfev: 300 });
    if (!best || result.cost < best.cost) best = result;
  }
  // A bend b toward d is the bend -b toward d + pi: written with the bend positive, the direction in -pi..pi.
  const q = Float64Array.from(best!.x); if (q[2]! < 0) { q[2] = -q[2]!; q[3] = q[3]! + Math.PI > Math.PI ? q[3]! - Math.PI : q[3]! + Math.PI; }
  const res = tubeResiduals(q, X, W); let within = 0; for (let i = 0; i < res.length; i++) if (Math.abs(res[i]! / W[i]!) < 3) within++;
  return { q, cost: best!.cost, within3: within / res.length };
}

/**
 * Gas as cloud points (the Homunculus lane). Dots are drawn from each emitter's own finite density, clusters
 * are k-means in 3D, and a cell is the l36 emission of its dots: graded and toned as the model tones it, then split into the
 * straight color and alpha of its share of the region's toned picture. The gains in the delivery record hold its light near the calibration. Clipping the toned red gives the pink core; no color is authored.
 */
import { density, type VolumeObject } from '../catalogue-volume.mts';
import { tone, type Grade } from '../grade.mts';
import { add, dot as dot3, mul, type V3 } from '../geometry.mts';
import { need } from '../inputs.mts';
import type { GasRegion } from './regions.mts';

export const CELL = 128;
/** Dots a billboard holds on average, and how much wider a sampled dot is than its share of the emitter. */
const DOT_SPREAD = 1.5, ITERATIONS = 30;
/** The smallest dot radius, a share of its region's width: a clump smaller than this reads as a spark, not as gas. */
const SOFTEST = 1 / 45;
/** The Homunculus dot profile. */
export const dotShape = (r: number) => r >= 1 ? 0 : Math.exp(-r * r / (2 * .397 * .397)) * Math.min(1, (1 - r) / .15);
const srgb = (x: number) => { const v = Math.min(1, Math.max(0, x)); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
export const luma = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;

export function randomStream(start: number) { let seed = start; return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
interface Axes { right: V3; up: V3; }
export interface Dot { at: V3; radius: number; light: V3; }

/** A point of an emitter's unit-integral density, by rejection in its own ellipsoid. A half shell's peak is on its kept side. */
function samplePoint(o: VolumeObject, random: () => number): V3 {
  const point = () => { let u = [0, 0, 0]; do u = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]; while (u[0]! ** 2 + u[1]! ** 2 + u[2]! ** 2 > 1); let p: V3 = o.center; for (let k = 0; k < 3; k++) p = add(p, mul(o.basis[k]!, u[k]! * o.axes[k]!)); return p; };
  let peak = density(o, o.center); for (let i = 0; i < 64; i++) peak = Math.max(peak, density(o, point()));
  need(peak > 0, 'An emitter with no density: ' + o.id);
  for (let tries = 0; tries < 4000; tries++) { const p = point(), d = density(o, p); if (d > 0 && random() * peak <= d) return p; }
  throw Error('No point found inside ' + o.id);
}
export { samplePoint };

export function regionDots(region: GasRegion, grade: Grade, count: number): Dot[] {
  const random = randomStream(region.id.length * 7919 + 13), floor = SOFTEST * Math.hypot(...region.box.max.map((v: number, a: number) => v - region.box.min[a]!)), total = region.emitters.reduce((n, e) => n + e.object.weight * e.amplitude, 0), dots: Dot[] = [];
  for (const { object: o, amplitude } of region.emitters) {
    const L = o.weight * amplitude, share = L / total, n = Math.max(1, Math.round(share * count)), size = Math.cbrt(o.axes[0] * o.axes[1] * o.axes[2]);
    const light: V3 = [0, 1, 2].map(c => L / n * o.color[c]! * grade.coefficients[3]![c]!) as V3;
    for (let i = 0; i < n; i++) dots.push({ at: n === 1 && o.kind === 'ball' ? o.center : samplePoint(o, random), radius: Math.max(floor, n === 1 ? size : DOT_SPREAD * size / Math.cbrt(n)), light });
  }
  return dots;
}

export function clusterDots(dots: readonly Dot[], wanted: number, random: () => number): Dot[][] {
  const d2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2, k = Math.min(wanted, dots.length);
  const centres: V3[] = [dots[Math.floor(random() * dots.length)]!.at], nearest = dots.map(d => d2(d.at, centres[0]!));
  while (centres.length < k) { let pick = random() * nearest.reduce((a, b) => a + b, 0), i = 0; while (i < dots.length - 1 && (pick -= nearest[i]!) > 0) i++; const at = dots[i]!.at; centres.push(at); dots.forEach((d, j) => { nearest[j] = Math.min(nearest[j]!, d2(d.at, at)); }); }
  const label = new Int32Array(dots.length);
  for (let step = 0; step < ITERATIONS; step++) {
    dots.forEach((d, j) => { let best = 0, bestD = Infinity; centres.forEach((c, m) => { const v = d2(d.at, c); if (v < bestD) { bestD = v; best = m; } }); label[j] = best; });
    const sum = centres.map(() => [0, 0, 0, 0]); dots.forEach((d, j) => { const s = sum[label[j]!]!; s[0]! += d.at[0]; s[1]! += d.at[1]; s[2]! += d.at[2]; s[3]!++; });
    sum.forEach((s, m) => { if (s[3]) centres[m] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!]; });
  }
  return centres.map((_, m) => dots.filter((__, j) => label[j] === m)).filter(list => list.length);
}

export interface Board { center: V3; half: number; dots: Dot[]; }
export const boardOf = (list: Dot[]): Board => { const center = [0, 1, 2].map(k => list.reduce((a, d) => a + d.at[k]!, 0) / list.length) as V3; return { center, dots: list, half: 1.02 * list.reduce((most, d) => Math.max(most, Math.hypot(d.at[0] - center[0], d.at[1] - center[1], d.at[2] - center[2]) + d.radius), 0) }; };

/** A dot's surface brightness over the texels it reaches. */
function deposit(light: Float64Array, side: number, d: Dot, u: number, v: number, r: number, area: number) {
  const x0 = Math.max(0, Math.floor(u - r)), x1 = Math.min(side, Math.ceil(u + r)), y0 = Math.max(0, Math.floor(v - r)), y1 = Math.min(side, Math.ceil(v + r)), weights: [number, number][] = []; let sum = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const w = dotShape(Math.hypot(x + .5 - u, y + .5 - v) / r); if (w > 0) { weights.push([(y * side + x) * 3, w]); sum += w; } }
  if (sum > 0) for (const [o, w] of weights) for (let k = 0; k < 3; k++) light[o + k]! += d.light[k]! * w / sum / area;
}
/** The whole region's light as the camera's axes see it. A cell takes its share of this one toned picture, so billboards add up to the model's brightness instead of each reaching its own plateau. */
export interface RegionLight { light: Float64Array; side: number; texel: number; center: V3; }
export function regionLight(dots: readonly Dot[], center: V3, width: number, c: Axes, side = 512): RegionLight {
  const texel = width / side, light = new Float64Array(side * side * 3);
  for (const d of dots) { const off = add(d.at, mul(center, -1)); deposit(light, side, d, (dot3(off, c.right) + width / 2) / texel, (width / 2 - dot3(off, c.up)) / texel, Math.max(d.radius / texel, .75), texel * texel); }
  return { light, side, texel, center };
}
/** A billboard's cell: its share of the region's toned emission, as straight RGBA. */
export function drawCell(board: Board, c: Axes, grade: Grade, gain: number, whole: RegionLight): Float64Array {
  const light = new Float64Array(CELL * CELL * 3), texel = 2 * board.half / CELL, area = texel * texel, origin = add(board.center, mul(whole.center, -1)), ox = dot3(origin, c.right), oy = dot3(origin, c.up);
  for (const d of board.dots) { const off = add(d.at, mul(board.center, -1)); deposit(light, CELL, d, (dot3(off, c.right) + board.half) / texel, (board.half - dot3(off, c.up)) / texel, Math.max(d.radius / texel, .75), area); }
  const rgba = new Float64Array(CELL * CELL * 4), width = whole.side * whole.texel;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const p = y * CELL + x, own = luma(light[p * 3]!, light[p * 3 + 1]!, light[p * 3 + 2]!); if (!(own > 0)) continue;
    const X = Math.floor((ox + (x + .5) * texel - board.half + width / 2) / whole.texel), Y = Math.floor((width / 2 - oy + (y + .5) * texel - board.half) / whole.texel);
    const q = X >= 0 && Y >= 0 && X < whole.side && Y < whole.side ? (Y * whole.side + X) * 3 : -1, R = q < 0 ? light[p * 3]! : whole.light[q]!, G = q < 0 ? light[p * 3 + 1]! : whole.light[q + 1]!, B = q < 0 ? light[p * 3 + 2]! : whole.light[q + 2]!;
    const share = Math.min(1, own / Math.max(own, luma(R, G, B))), e = tone(R * gain, G * gain, B * gain, grade.stretch, grade.saturation), s = [srgb(e[0]), srgb(e[1]), srgb(e[2])], peak = Math.max(s[0]!, s[1]!, s[2]!), A = Math.min(.995, Math.max(e[0], e[1], e[2]));
    // Coverage follows linear light, so a faint edge stays faint and only the core turns opaque and pink.
    // Each share as the alpha whose source-over product over all billboards is the region's own alpha.
    if (A > 0) { rgba[p * 4] = s[0]! / peak; rgba[p * 4 + 1] = s[1]! / peak; rgba[p * 4 + 2] = s[2]! / peak; rgba[p * 4 + 3] = 1 - (1 - A) ** share; }
  }
  return rgba;
}


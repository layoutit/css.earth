/** Continuous published density shapes plus source-derived surfaces. No image samples. */
import { DISTANCE, DEG } from './geometry.mts';
export const SIGMA_DISC = (7416.5 / 3600) * DEG * DISTANCE;
export const HEIGHT_DISC = 0.23 * SIGMA_DISC;
export const BAR_RATIO = 0.38,
  BAR_VERTICAL_RATIO = 0.23;
// Preserve the physical scale of Kacharov's adopted deprojection, then rotate it.
export function projectedBarAxes(p: number, q: number, inclination: number, tip: number): [number, number] {
  // Binney projection in Kacharov equation 5; eigenvalues of the projected covariance.
  const s = Math.sin(tip),
    c = Math.cos(tip),
    ci = Math.cos(inclination),
    si = Math.sin(inclination);
  const a = s * s + p * p * c * c,
    b = ci * ci * (c * c + p * p * s * s) + q * q * si * si,
    off = ci * s * c * (1 - p * p);
  const delta = Math.hypot(a - b, 2 * off);
  return [Math.sqrt((a + b + delta) / 2), Math.sqrt((a + b - delta) / 2)];
}
const projectedMajor = projectedBarAxes(BAR_RATIO, BAR_VERTICAL_RATIO, 25 * DEG, -61.3 * DEG)[0];
export const SIGMA_BAR = ((4271.76 / 3600) * DEG * DISTANCE) / projectedMajor;
export const BAR_LUMINOSITY = (117.02 * 4271.76 ** 2 * 0.37) / (55.54 * 7416.5 ** 2 * 0.91);
const SQRT2PI = Math.sqrt(2 * Math.PI);
export const EXTINCTION_RGB = [0.75, 1, 1 + 1 / 3.41];
export const FOREGROUND_EBV = 0.06; // Chen foreground mean; fixed proxy, not a retrieved spatial foreground map.
export const gaussian = (z: number, s: number) => Math.exp(-0.5 * (z / s) ** 2) / (SQRT2PI * s);
export const smoothstep = (t: number) => {
  const q = Math.max(0, Math.min(1, t));
  return q * q * (3 - 2 * q);
};
export function discSurface(r: number): number {
  return Math.exp(-0.5 * (r / SIGMA_DISC) ** 2) / (2 * Math.PI * SIGMA_DISC ** 2);
}
// The observed outer power law is continued inward with the measured disc scale
// as a core. This interpolation is assumed; it creates no independent inner hole.
function outerRaw(r: number): number {
  return ((r * r + SIGMA_DISC ** 2) / (11.3 ** 2 + SIGMA_DISC ** 2)) ** -1.1 * (1 - smoothstep((r - 18) / 1));
}
let outerNorm = 0;
for (let r = 11.31; r < 19; r += 0.02) outerNorm += outerRaw(r) * 2 * Math.PI * r * 0.02;
export function outerSurface(r: number): number {
  return Math.max(0, (0.004 * (1 + BAR_LUMINOSITY) * outerRaw(r)) / outerNorm - discSurface(r));
}

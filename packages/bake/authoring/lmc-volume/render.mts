/** The shared picture and camera shapes of the model projector. */
import type { V3 } from './geometry.mts';
export interface Basis {
  width: number;
  height: number;
  planes: Float64Array[];
  dustGain: number;
}
export interface Camera {
  name: string;
  width: number;
  height: number;
  ray(col: number, row: number): { origin: V3; direction: V3 };
  foreground: boolean;
  pixelOf?: (p: V3) => [number, number] | null;
  areaAt?: (p: V3) => number;
}
export function boundsInterval(origin: V3, direction: V3): [number, number] | null {
  let lo = 0,
    hi = Infinity;
  for (let c = 0; c < 3; c++) {
    const bound = c === 2 ? 12 : 20;
    if (Math.abs(direction[c]) < 1e-12) {
      if (Math.abs(origin[c]) > bound) return null;
      continue;
    }
    let a = (-bound - origin[c]) / direction[c],
      b = (bound - origin[c]) / direction[c];
    if (a > b) [a, b] = [b, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, b);
  }
  return lo < hi ? [lo, hi] : null;
}

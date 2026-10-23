import type { VolumeLocalCamera } from '../../volume/types.js';
import { cssViewFromOrientation } from '@cssearth/engine';
import type { PreparedCssVolume, VolumeVector } from '@cssearth/objects';

export interface FlightSample {
  camera: VolumeLocalCamera;
  weights: number[];
  separation: number[];
  fades: number[];
  light: number;
  dots: Set<string>;
  coastWrites: string[];
}
export const flightLimits = { jump: .025, stripe: 1, cross: 1, reversal: 1e-8, blink: 0, coast: 0 };
export type FlightMetric = keyof typeof flightLimits;
export interface FlightWorst { value: number; step: number }

/** A tile on the viewport's central ray, inside the prepared bounds, nearest the frame center.
 * This keeps an off-screen Galactic center from manufacturing a stripe risk during a Sun approach. */
export function centralFlightTile(camera: VolumeLocalCamera, bounds: PreparedCssVolume['frame']['boundsUnits']): VolumeVector | null {
  const back = cssViewFromOrientation(camera.orientationXyzw).slice(6), center = bounds.min.map((v, i) => (v + bounds.max[i]!) / 2);
  let near = 0, far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const direction = -back[axis]!, p = camera.positionUnits[axis]!;
    if (Math.abs(direction) < 1e-12) { if (p < bounds.min[axis]! || p > bounds.max[axis]!) return null; continue; }
    const ends = [(bounds.min[axis]! - p) / direction, (bounds.max[axis]! - p) / direction].sort((a, b) => a - b);
    near = Math.max(near, ends[0]!); far = Math.min(far, ends[1]!);
  }
  if (far < near) return null;
  const t = Math.max(near, Math.min(far, center.reduce((sum, v, i) => sum + (camera.positionUnits[i]! - v) * back[i]!, 0)));
  return camera.positionUnits.map((v, i) => v - t * back[i]!) as [number, number, number];
}

/** Exact perspective projection of the centers of adjacent parallel sheets at a named tile.
 * Translation is relative to the camera in the volume frame, never a subtraction of world positions.
 * The central tile is deliberately optimistic: a visible gap here already fails the bank. */
export function sheetSeparations(camera: VolumeLocalCamera, stacks: PreparedCssVolume['stacks'], focal: number,
  tile: VolumeVector): number[] {
  const view = cssViewFromOrientation(camera.orientationXyzw);
  const project = (p: readonly number[]) => {
    const delta = p.map((v, i) => v - camera.positionUnits[i]!);
    const dot = (offset: number) => delta.reduce((sum, v, i) => sum + v * view[offset + i]!, 0);
    const depth = -dot(6);
    return depth > 0 ? [focal * dot(0) / depth, focal * dot(3) / depth] : null;
  };
  return ['x', 'y', 'z'].map((axis, index) => {
    const stack = stacks.find(s => s.axis === axis)!;
    const centers = [...new Set(stack.leaves.map(l => l.centerUnits[index]!))].sort((a, b) => a - b);
    let nearest = 0;
    for (let i = 1; i < centers.length; i++) if (centers[i - 1]! <= tile[index]! && centers[i]! >= tile[index]!) { nearest = i; break; }
    if (!nearest) return 0;
    const points = [centers[nearest - 1]!, centers[nearest]!].map(value => {
      const p = [...tile]; p[index] = value; return project(p);
    });
    return points[0] && points[1] ? Math.hypot(points[0][0]! - points[1][0]!, points[0][1]! - points[1][1]!) : 0;
  });
}

export function measureFlight(samples: readonly FlightSample[], approach: boolean): Record<FlightMetric, FlightWorst> {
  const result = Object.fromEntries(Object.keys(flightLimits).map(key => [key, { value: 0, step: 0 }])) as Record<FlightMetric, FlightWorst>;
  const put = (key: FlightMetric, value: number, step: number) => { if (value > result[key].value) result[key] = { value, step }; };
  const values = (s: FlightSample) => [...s.weights, ...s.fades, s.light];
  const directions: number[] = [], previousDiff: number[] = [];
  samples.forEach((s, step) => {
    s.weights.forEach((w, i) => put('stripe', w * s.separation[i]!, step));
    const resolved = s.weights.flatMap((w, i) => w > 1e-6 && s.separation[i]! > 1 ? [s.separation[i]!] : []).sort((a, b) => b - a);
    if (resolved.length > 1) put('cross', resolved[1]!, step);
    put('coast', s.coastWrites.length, step);
    if (step) values(s).forEach((value, i) => {
      const diff = value - values(samples[step - 1]!)[i]!;
      put('jump', Math.abs(diff), step);
      if (approach && i >= 3 && Math.abs(diff) > 1e-10) {
        if (directions[i] === -1 && diff > 0) put('reversal', Math.min(Math.abs(diff), Math.abs(previousDiff[i] ?? diff)), step);
        directions[i] = Math.sign(diff); previousDiff[i] = diff;
      }
    });
    if (step > 1) for (const id of s.dots) if (samples[step - 2]!.dots.has(id) && !samples[step - 1]!.dots.has(id)) put('blink', result.blink.value + 1, step);
  });
  return result;
}
export function flightFailures(result: ReturnType<typeof measureFlight>): FlightMetric[] {
  return (Object.keys(flightLimits) as FlightMetric[]).filter(key => result[key].value > flightLimits[key]);
}

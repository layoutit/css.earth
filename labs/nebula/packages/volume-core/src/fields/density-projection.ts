import {createIntegratedSignalSampler} from './cloud-density.ts';
import type {ObservationPhoto} from '../contracts/observation-photo.ts';
import type {Bounds3} from '../contracts/volume-recipe.ts';
export interface DensityProjectionSource {bounds:Bounds3;depth:number;exposureGain:number;densityAt(x:number,y:number,z:number):number}
type Vec2 = [number, number];
export function prepareDensityProjection(source: DensityProjectionSource, distance: number, width = 256) {
  const bounds = source.bounds;
  if (!(distance > 0) || bounds.min[2] <= -distance || !Number.isInteger(width) || width < 16 || width > 1024)
    throw new TypeError('Density projection requires a finite observer and bounded image width.');
  const corners = [bounds.min[2], bounds.max[2]].flatMap(z => [bounds.min[0], bounds.max[0]].flatMap(x =>
    [bounds.min[1], bounds.max[1]].map(y => [x / (1 + z / distance), y / (1 + z / distance)])));
  const rectangle = { min: [0, 1].map(i => Math.min(...corners.map(p => p[i]))) as Vec2,
    max: [0, 1].map(i => Math.max(...corners.map(p => p[i]))) as Vec2 };
  const height = Math.round(width * (rectangle.max[1] - rectangle.min[1]) / (rectangle.max[0] - rectangle.min[0]));
  const signal = new Float32Array(width * height), rgb = new Uint8Array(width * height * 3);
  const densityAt=source.densityAt;
  const samples = source.depth * 2, step = (bounds.max[2] - bounds.min[2]) / samples;
  let maximum = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tx = rectangle.min[0] + (x + .5) / width * (rectangle.max[0] - rectangle.min[0]);
    const ty = rectangle.max[1] - (y + .5) / height * (rectangle.max[1] - rectangle.min[1]);
    let column = 0;
    for (let zi = 0; zi < samples; zi++) {
      const z = bounds.min[2] + (zi + .5) * step, scale = 1 + z / distance;
      column += densityAt(tx * scale, ty * scale, z) * step;
    }
    const value = -Math.expm1(-column * Math.hypot(1, tx / distance, ty / distance) * source.exposureGain);
    signal[y * width + x] = value; maximum = Math.max(maximum, value);
  }
  if (!(maximum > 0)) throw new TypeError('Density projection has no support.');
  for (let i = 0; i < signal.length; i++) {
    // One global display normalization, never independent per column or depth slice.
    const value = Math.round(255 * signal[i] / maximum); rgb.fill(value, i * 3, i * 3 + 3); signal[i] = value / 255;
  }
  const photo: ObservationPhoto = { width, height, rgb, intensity: signal, coveredPixels: signal.filter(v => v > 0).length };
  return { photo, boundsUnits: rectangle, distanceUnits: distance, densityAt,
    sampleSignal: createIntegratedSignalSampler({ values: signal, width, height, bounds: rectangle, observerDistance: distance }) };
}

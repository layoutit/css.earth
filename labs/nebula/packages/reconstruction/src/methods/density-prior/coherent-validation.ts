/** Offline numerical gates for an authored field, independent of the CSS renderer. */
import type { CoherentVolumeSampler } from './coherent-volume.ts';

type Vec3 = [number, number, number];
type Bounds = { min: Vec3; max: Vec3 };

/** Check every bank's depth quadrature separately from slab spacing and texture resolution. */
export function validateCoherentAxisSampling(options: {
  sampler: Pick<CoherentVolumeSampler, 'sample'>; bounds: Bounds;
  samples: { x: number; y: number; z: number }; exposureGain: number;
}) {
  const results: Record<string, { rays: number; samples: number[]; maximumDisplayDifference: number }> = {};
  const rgb: Vec3 = [0, 0, 0];
  for (const [axis, name] of (['x', 'y', 'z'] as const).entries()) {
    const others = [0, 1, 2].filter(value => value !== axis), count = options.samples[name];
    let maximum = 0;
    for (let row = 0; row < 11; row++) for (let col = 0; col < 11; col++) {
      const p: Vec3 = [0, 0, 0];
      for (const [i, t] of [(row + .5) / 11, (col + .5) / 11].entries()) {
        const k = others[i]!;
        p[k] = options.bounds.min[k]! + t * (options.bounds.max[k]! - options.bounds.min[k]!);
      }
      const outputs: Vec3[] = [];
      for (const steps of [count, count * 2]) {
        const integral: Vec3 = [0, 0, 0], ds = (options.bounds.max[axis]! - options.bounds.min[axis]!) / steps;
        for (let index = 0; index < steps; index++) {
          p[axis] = options.bounds.min[axis]! + (index + .5) * ds;
          options.sampler.sample(p[0], p[1], p[2], rgb);
          for (let channel = 0; channel < 3; channel++) integral[channel] += rgb[channel]! * ds;
        }
        const peak = Math.max(...integral), signal = -Math.expm1(-options.exposureGain * peak);
        outputs.push(integral.map(value => peak ? value / peak * signal : 0) as Vec3);
      }
      for (let channel = 0; channel < 3; channel++) maximum = Math.max(maximum,
        Math.abs(outputs[0]![channel]! - outputs[1]![channel]!));
    }
    if (maximum > .008) throw new Error(`${name} quadrature has not converged: ${maximum}`);
    results[name] = { rays: 121, samples: [count, count * 2], maximumDisplayDifference: maximum };
  }
  return results;
}

/** Sample native pixel centres, including bright pixels; do not dodge thin default profiles. */
export function validateCoherentColumns(options: {
  sampler: CoherentVolumeSampler; rgba: Uint8Array; width: number; height: number;
  bounds: Bounds; samples: number; exposureGain: number; maxDisplaySignal: number;
}) {
  const { sampler, rgba, width, height, bounds, exposureGain: exposure, maxDisplaySignal: cap } = options;
  const indices = new Set<number>();
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
    indices.add(Math.min(height - 1, Math.floor(y / 16 * (height - 1))) * width +
      Math.min(width - 1, Math.floor(x / 16 * (width - 1))));
  }
  let brightest = 0;
  for (let p = 0; p < width * height; p++) {
    if (Math.max(...rgba.subarray(p * 4, p * 4 + 3)) > Math.max(...rgba.subarray(brightest * 4, brightest * 4 + 3))) brightest = p;
  }
  indices.add(brightest);
  const errors = [0, 0], convergence = [0, 0, 0];
  const rgb: Vec3 = [0, 0, 0];
  let clippedPixels = 0;
  for (let p = 0; p < width * height; p++) if (Math.max(rgba[4 * p]!, rgba[4 * p + 1]!, rgba[4 * p + 2]!) /
    255 * rgba[4 * p + 3]! / 255 > cap) clippedPixels++;
  for (const pixel of indices) {
    const x = bounds.min[0] + ((pixel % width) + .5) / width * (bounds.max[0] - bounds.min[0]);
    const y = bounds.max[1] - (Math.floor(pixel / width) + .5) / height * (bounds.max[1] - bounds.min[1]);
    const peak = Math.max(rgba[4 * pixel]!, rgba[4 * pixel + 1]!, rgba[4 * pixel + 2]!) / 255 * rgba[4 * pixel + 3]! / 255;
    const outputs: Vec3[] = [];
    for (const [run, steps] of [options.samples, options.samples * 2].entries()) {
      const integral: Vec3 = [0, 0, 0], ds = (bounds.max[2] - bounds.min[2]) / steps;
      for (let z = 0; z < steps; z++) {
        sampler.sample(x, y, bounds.min[2] + (z + .5) * ds, rgb);
        for (let c = 0; c < 3; c++) integral[c] += rgb[c]! * ds;
      }
      const opticalPeak = Math.max(...integral), signal = -Math.expm1(-exposure * opticalPeak);
      const output = integral.map(value => opticalPeak ? value / opticalPeak * signal : 0) as Vec3;
      outputs.push(output);
      for (let c = 0; c < 3; c++) {
        const expected = peak ? rgba[4 * pixel + c]! / 255 * rgba[4 * pixel + 3]! / 255 / peak * Math.min(cap, peak) : 0;
        errors[run] = Math.max(errors[run]!, Math.abs(output[c]! - expected));
      }
    }
    for (let c = 0; c < 3; c++) convergence[c] = Math.max(convergence[c]!, Math.abs(outputs[0]![c]! - outputs[1]![c]!));
  }
  if (errors[0]! > .002 || errors[1]! > .002 || Math.max(...convergence) > .001)
    throw new Error(`Coherent field is undersampled or loses source columns: ${JSON.stringify({ errors, convergence })}`);
  return { testedNativeColumns: indices.size, zSamples: [options.samples, options.samples * 2],
    maximumDisplayChannelError: errors, maximumDisplayConvergenceDifference: convergence,
    clippedSourcePixels: clippedPixels, maxDisplaySignal: cap,
    interpretation: 'Numerical reference-column and Z-integration gate before image quantization. Does not validate segmentation, perspective views, or physical depth.' };
}

/** Offline, coverage-normalized local contrast on the registered starless image. */
import type { ObservationMapping } from '../contracts/observation-mapping.ts';
import type { ObservationPhoto } from '../contracts/observation-photo.ts';
import { parseCloudAppearance, type CloudAppearance } from './cloud-appearance.ts';

export const CLOUD_DETAIL_METHOD = 'masked-local-material-contrast@1';

/** A separable sliding box costs O(pixels), independent of the requested radius. */
function blur(source: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(source.length), output = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += source[y * width + x];
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / (Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1);
      if (x - radius >= 0) sum -= source[y * width + x - radius];
      if (x + radius + 1 < width) sum += source[y * width + x + radius + 1];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += horizontal[y * width + x];
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / (Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1);
      if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x];
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x];
    }
  }
  return output;
}

export function prepareCloudDetail(photo: ObservationPhoto, mapping: ObservationMapping, input?: CloudAppearance) {
  const appearance = parseCloudAppearance(input), { width, height } = photo;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width * height > 4_194_304 || photo.rgb.length !== width * height * 3)
    throw new TypeError('Cloud detail requires a bounded registered RGB image.');
  const gain = new Float32Array(width * height).fill(1);
  if (appearance.detailStrength === 0) return gain;
  const signal = new Float32Array(gain.length), mask = new Float32Array(gain.length);
  const { min, max } = mapping.boundsUnits;
  let sum = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x;
    if (!mapping.uvAtTangent(min[0] + (x + .5) / width * (max[0] - min[0]),
        max[1] - (y + .5) / height * (max[1] - min[1]))) continue;
    const light = (.2126 * photo.rgb[p * 3] + .7152 * photo.rgb[p * 3 + 1] + .0722 * photo.rgb[p * 3 + 2]) / 255;
    if (!(light > 0)) continue; // Missing/zero-color pixels remain neutral, as in the existing material baker.
    signal[p] = light; mask[p] = 1; sum += light; count++;
  }
  if (!count) return gain;
  // Scale refers to a 1024px registered plane, so preview resolution cannot change feature size.
  const radius = Math.max(1, Math.round(appearance.detailScale * width / 1024));
  let smoothSignal: Float32Array = signal, smoothMask: Float32Array = mask;
  for (let pass = 0; pass < 3; pass++) {
    smoothSignal = blur(smoothSignal, width, height, radius);
    smoothMask = blur(smoothMask, width, height, radius);
  }
  const floor = Math.max(1 / 255, sum / count * .05);
  for (let p = 0; p < gain.length; p++) {
    if (!mask[p] || smoothMask[p] <= 1e-6) continue;
    const local = smoothSignal[p] / smoothMask[p];
    // Retain highlight headroom: deepen local dark structure, never overexpose bright knots.
    // A 20% lower bound and signal floor limit dark noise/halos; opacity is not involved.
    gain[p] = Math.max(.2, Math.min(1, ((signal[p] + floor) / (local + floor)) ** appearance.detailStrength));
  }
  return gain;
}

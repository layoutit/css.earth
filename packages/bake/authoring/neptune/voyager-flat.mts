/**
 * Blemishes fixed in the camera: dust rings and reseau scars that sit at the same detector pixels in every frame.
 *
 * Each frame is divided by its own local mean, which leaves the planet's large shading out and keeps small marks. Clouds
 * fall on different pixels in every frame and the marks do not, so the mean of those ratios over many frames, with the
 * values far from it dropped, is the camera's own pattern. Frames are divided by it before they are placed on the map.
 */
import type { NeptuneFrame } from './voyager-frames.mts';

export const FLAT = { windowPixels: 31, minimumFrames: 10, clip: 0.03, minimumFactor: 0.85, maximumFactor: 1.15 } as const;

/** A frame over its local mean, NaN wherever the window is not wholly usable disc. */
function localRatio(frame: NeptuneFrame, window: number) {
  const { width, height, values, usable } = frame, stride = width + 1, half = Math.floor(window / 2);
  const sum = new Float64Array(stride * (height + 1)), good = new Int32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0, rowGood = 0;
    for (let x = 0; x < width; x++) {
      if (usable[y * width + x]) { rowSum += values[y * width + x]!; rowGood++; }
      sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1]! + rowSum; good[(y + 1) * stride + x + 1] = good[y * stride + x + 1]! + rowGood;
    }
  }
  const ratio = new Float32Array(width * height).fill(NaN), full = window * window;
  for (let y = half; y < height - half; y++) for (let x = half; x < width - half; x++) {
    const a = (y - half) * stride + x - half, b = (y - half) * stride + x + half + 1, c = (y + half + 1) * stride + x - half, d = (y + half + 1) * stride + x + half + 1;
    if (good[d]! - good[b]! - good[c]! + good[a]! !== full) continue;
    ratio[y * width + x] = values[y * width + x]! / ((sum[d]! - sum[b]! - sum[c]! + sum[a]!) / full);
  }
  return ratio;
}

/** The camera pattern from a set of frames: 1 where fewer than `minimumFrames` frames cover a pixel. */
export function cameraPattern(frames: readonly NeptuneFrame[]) {
  const cells = frames[0]!.width * frames[0]!.height, ratios = frames.map(frame => localRatio(frame, FLAT.windowPixels));
  const mean = new Float32Array(cells), count = new Uint16Array(cells);
  for (const ratio of ratios) for (let i = 0; i < cells; i++) { const v = ratio[i]!; if (!Number.isNaN(v)) { mean[i]! += v; count[i]!++; } }
  for (let i = 0; i < cells; i++) if (count[i]) mean[i]! /= count[i]!;
  const pattern = new Float32Array(cells).fill(1), kept = new Uint16Array(cells), sum = new Float32Array(cells);
  for (const ratio of ratios) for (let i = 0; i < cells; i++) { const v = ratio[i]!; if (!Number.isNaN(v) && Math.abs(v - mean[i]!) <= FLAT.clip) { sum[i]! += v; kept[i]!++; } }
  let corrected = 0;
  for (let i = 0; i < cells; i++) if (kept[i]! >= FLAT.minimumFrames) { pattern[i] = Math.min(FLAT.maximumFactor, Math.max(FLAT.minimumFactor, sum[i]! / kept[i]!)); corrected++; }
  return { pattern, coveredShare: corrected / cells };
}

export function applyCameraPattern(frame: NeptuneFrame, pattern: Float32Array): NeptuneFrame {
  const values = new Float32Array(frame.values.length);
  for (let i = 0; i < values.length; i++) values[i] = frame.values[i]! / pattern[i]!;
  return { ...frame, values };
}

/** Connected isophote boundaries, with local gradient normals. No crop edges or hand-specified centers. */
import { blur, type RidgeField, type RidgePoint } from './ridges.js';
export interface Contour { points: RidgePoint[]; level: number; smoothing: number }
export function contourField(contour: Contour, width: number, height: number): RidgeField {
  const strength = new Float32Array(width * height), nx = new Float32Array(width * height), ny = new Float32Array(width * height);
  for (const point of contour.points) {
    const p = Math.floor(point.y) * width + Math.floor(point.x);
    strength[p] = point.strength; nx[p] = point.nx; ny[p] = point.ny;
  }
  return { width, height, strength, nx, ny, points: contour.points };
}
export function extractContours(rgb: Uint8Array, width: number, height: number, minimumRadius: number, sensitivity = 1): Contour[] {
  if (!Number.isFinite(sensitivity) || sensitivity < .25 || sensitivity > 4) throw new TypeError('Contour sensitivity must be between 0.25 and 4.');
  const length = width * height, luminance = new Float32Array(length);
  for (let p = 0; p < length; p++) luminance[p] = (.2126 * rgb[p * 3]! + .7152 * rgb[p * 3 + 1]! + .0722 * rgb[p * 3 + 2]!) / 255;
  const scale = Math.min(width, height) / 768, contours: Contour[] = [];
  for (const sigma of [3, 7, 14].map(n => Math.max(1, n * scale))) {
    const smooth = blur(luminance, width, height, sigma), sorted = Array.from(smooth).sort((a, b) => a - b);
    const background = sorted[Math.floor(length * .2)]!, peak = sorted[Math.floor(length * .995)]!;
    if (peak - background < .008 / sensitivity) continue;
    const gradients: number[] = [];
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const p = y * width + x;
      gradients.push(Math.hypot(smooth[p + 1]! - smooth[p - 1]!, smooth[p + width]! - smooth[p - width]!));
    }
    gradients.sort((a, b) => a - b);
    const normalizer = Math.max(1e-6, gradients[Math.floor(gradients.length * .99)]!);
    const baselineLevels = [.06, .1, .16, .24, .34, .46, .60, .75];
    // Keep all original bright levels. Sensitivity adds lower levels; it does not
    // replace the source or introduce a local-background/compactness heuristic.
    const fractions = sensitivity > 1 ? [...new Set([...baselineLevels, ...baselineLevels.slice(0, 3).map(level => level / sensitivity)])] : baselineLevels;
    for (const fraction of fractions) {
      // Do not promote quantization/background variations into large connected object contours.
      // This is a display-RGB contrast floor, not a calibrated flux threshold.
      if ((peak - background) * fraction < .012 / sensitivity) continue;
      const level = background + (peak - background) * fraction, boundary = new Uint8Array(length), seen = new Uint8Array(length);
      for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
        const p = y * width + x;
        if (smooth[p]! >= level && [p - 1, p + 1, p - width, p + width].some(n => smooth[n]! < level)) boundary[p] = 1;
      }
      for (let start = 0; start < length; start++) {
        if (!boundary[start] || seen[start]) continue;
        const queue = [start]; seen[start] = 1;
        let left = width, right = 0, top = height, bottom = 0;
        for (let head = 0; head < queue.length; head++) {
          const p = queue[head]!, x = p % width, y = Math.floor(p / width);
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy; if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) continue;
            const n = ny * width + nx;
            if (boundary[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
          }
        }
        if (queue.length < minimumRadius * 3 || Math.min(right - left, bottom - top) < minimumRadius * 1.5) continue;
        const points: RidgePoint[] = [];
        for (const p of queue) {
          const gx = smooth[p + 1]! - smooth[p - 1]!, gy = smooth[p + width]! - smooth[p - width]!, norm = Math.hypot(gx, gy);
          if (norm < 1e-7) continue;
          points.push({ x: p % width + .5, y: Math.floor(p / width) + .5, nx: gx / norm, ny: gy / norm, strength: Math.min(1, Math.sqrt(norm / normalizer)) });
        }
        if (points.length >= 5) contours.push({ points, level, smoothing: sigma });
      }
    }
  }
  return contours;
}

/** Offline smoothing and oriented boundary evidence sampling. */
export interface RidgePoint { x: number; y: number; strength: number; nx: number; ny: number }
export interface RidgeField { width: number; height: number; strength: Float32Array; nx: Float32Array; ny: Float32Array; points: RidgePoint[] }
export function blur(input: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 3), kernel = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-.5 * ((i - radius) / sigma) ** 2));
  const sum = kernel.reduce((a, b) => a + b, 0); for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const tmp = new Float32Array(input.length), out = new Float32Array(input.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    for (let k = -radius; k <= radius; k++) value += input[y * width + Math.max(0, Math.min(width - 1, x + k))]! * kernel[k + radius]!;
    tmp[y * width + x] = value;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    for (let k = -radius; k <= radius; k++) value += tmp[Math.max(0, Math.min(height - 1, y + k)) * width + x]! * kernel[k + radius]!;
    out[y * width + x] = value;
  }
  return out;
}
/** Nearest oriented evidence around a predicted ellipse point; empty/off-frame pixels never count as support. */
export function ridgeEvidence(field: RidgeField, x: number, y: number, nx: number, ny: number, tolerance: number): { strength: number; pixel: number } {
  let best = 0, pixel = -1;
  const ix = Math.floor(x), iy = Math.floor(y), radius = Math.ceil(tolerance);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const px = ix + dx, py = iy + dy; if (px < 0 || px >= field.width || py < 0 || py >= field.height) continue;
    const p = py * field.width + px, signal = field.strength[p]!; if (!signal) continue;
    const distance = Math.hypot(px + .5 - x, py + .5 - y); if (distance > tolerance) continue;
    const alignment = Math.abs(field.nx[p]! * nx + field.ny[p]! * ny);
    if (alignment < .8) continue;
    const value = signal * alignment * alignment * Math.exp(-.5 * (distance / (tolerance * .65)) ** 2);
    if (value > best) { best = value; pixel = p; }
  }
  return { strength: best, pixel };
}

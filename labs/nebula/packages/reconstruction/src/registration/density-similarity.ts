/** Bounded model-only similarity fitting; observation pixels and source particles remain immutable. */
export type Similarity = { offset: [number, number]; rotationDeg: number; scale: number };
export interface DensityFitInput { particles: Float32Array; pivot: [number, number, number]; distance: number; target: Float32Array; mask: Uint8Array; size: number; extent: number }
function smooth(a: Float32Array, n: number): Float32Array {
  const b = new Float32Array(a.length), c = new Float32Array(a.length), kernel = [1, 4, 6, 4, 1];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let k = -2; k <= 2; k++) b[y * n + x]! += a[y * n + Math.max(0, Math.min(n - 1, x + k))]! * kernel[k + 2]! / 16;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let k = -2; k <= 2; k++) c[y * n + x]! += b[Math.max(0, Math.min(n - 1, y + k)) * n + x]! * kernel[k + 2]! / 16;
  return c;
}
export function projectSimilarity(input: DensityFitInput, fit: Similarity, stride = 1): Float32Array {
  const { particles, pivot, distance, size, extent } = input, out = new Float32Array(size * size), a = fit.rotationDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < particles.length; i += 4 * stride) {
    const x = (particles[i]! - pivot[0]) * fit.scale, y = (particles[i + 1]! - pivot[1]) * fit.scale;
    const z = (particles[i + 2]! - pivot[2]) * fit.scale, denominator = distance + z;
    if (denominator <= 0) continue;
    const px = ((c * x - s * y + fit.offset[0]) * distance / denominator / extent + .5) * size - .5;
    const py = ((s * x + c * y + fit.offset[1]) * distance / denominator / extent + .5) * size - .5;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) if (ix + dx >= 0 && ix + dx < size && iy + dy >= 0 && iy + dy < size) out[(iy + dy) * size + ix + dx]! += particles[i + 3]! * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
  }
  return smooth(smooth(out, size), size);
}
export function fitScore(model: Float32Array, target: Float32Array, mask: Uint8Array): number {
  let aa = 0, bb = 0, ab = 0, a = 0, b = 0, count = 0;
  for (let i = 0; i < model.length; i++) if (mask[i]) { const x = model[i]!, y = target[i]!; a += x; b += y; aa += x * x; bb += y * y; ab += x * y; count++; }
  return (ab - a * b / count) / Math.sqrt(Math.max(1e-30, (aa - a * a / count) * (bb - b * b / count)));
}
export function fitDensitySimilarity(input: DensityFitInput, initialOffset: [number, number]) {
  if (input.particles.length % 4 || input.target.length !== input.size ** 2 || input.mask.length !== input.target.length || input.distance <= 0) throw new Error('Invalid density fit input.');
  let evaluations = 0;
  const evaluate = (fit: Similarity) => { evaluations++; return fitScore(projectSimilarity(input, fit, 5), input.target, input.mask); };
  let best: Similarity = { offset: initialOffset, scale: .4, rotationDeg: 0 }, bestScore = -Infinity;
  for (let rotationDeg = -180; rotationDeg < 180; rotationDeg += 30) for (const scale of [.2, .3, .45, .65, .9]) { const p: Similarity = { offset: [...initialOffset], rotationDeg, scale }, score = evaluate(p); if (score > bestScore) { best = p; bestScore = score; } }
  for (const [offsetStep, rotationStep, scaleStep] of [[1, 15, .12], [.4, 6, .05], [.15, 2, .02], [.05, .7, .007]]) {
    for (let round = 0; round < 12; round++) {
      let improved = false;
      for (let variable = 0; variable < 4; variable++) for (const sign of [-1, 1]) {
        const p: Similarity = { offset: [...best.offset], rotationDeg: best.rotationDeg, scale: best.scale };
        if (variable < 2) p.offset[variable]! += sign * offsetStep!; else if (variable === 2) p.rotationDeg += sign * rotationStep!; else p.scale += sign * scaleStep!;
        if (p.scale < .1 || p.scale > 1.5 || Math.abs(p.offset[0]) > 10 || Math.abs(p.offset[1]) > 10) continue;
        const score = evaluate(p); if (score > bestScore) { best = p; bestScore = score; improved = true; }
      }
      if (!improved) break;
    }
  }
  return { best, score: fitScore(projectSimilarity(input, best), input.target, input.mask), evaluations };
}

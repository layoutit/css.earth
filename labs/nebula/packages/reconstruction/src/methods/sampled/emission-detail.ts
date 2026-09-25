/** Image-space candidates with bounded 3D support; line-of-sight modes come from the spatial prior. */
import type { PreparedSampledField, SampledEmissionFit, DiffuseAtom } from '@cssearth/bake/volume';

export function finiteDetailAtoms(prepared: PreparedSampledField, recipe: SampledEmissionFit,
  target: Float32Array, chroma: Float32Array, covered: Uint8Array, xs: Float64Array, ys: Float64Array, signal?: AbortSignal): DiffuseAtom[] {
  if (!recipe.detail) return [];
  const n = recipe.imageWidth, pixel = Math.abs(xs[1]! - xs[0]!), candidates: { at: number; sigma: number; score: number }[] = [];
  for (const sigma of recipe.detail.scalesArcsec) {
    const radius = Math.max(1, Math.ceil(2 * sigma / pixel));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const at = y * n + x; if (!covered[at] || !(target[at]! > 0)) continue;
      let mean = 0, color = 0, count = 0;
      // A bounded local footprint estimates structural contrast, not a new depth estimate.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx * radius, py = y + dy * radius;
        if (px < 0 || py < 0 || px >= n || py >= n || !covered[py * n + px]) continue;
        mean += target[py * n + px]!; color += chroma[py * n + px]!; count++;
      }
      const score = (Math.max(0, target[at]! - mean / count) + target[at]! * Math.abs(chroma[at]! - color / count)) / sigma;
      if (score > .002) candidates.push({ at, sigma, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.sigma - b.sigma || a.at - b.at);
  const atoms: DiffuseAtom[] = [], accepted: { at: number; sigma: number }[] = [], value: [number, number, number] = [0, 0, 0];
  const prior = prepared.field({ ejecta: 1, pwn: 1 }), nz = prepared.size[2];
  for (const candidate of candidates) {
    signal?.throwIfAborted();
    if (atoms.length >= recipe.detail.maximumAtoms) break;
    const x = xs[candidate.at]!, y = ys[candidate.at]!, sigma = candidate.sigma;
    if (accepted.some(a => (xs[a.at]! - x) ** 2 + (ys[a.at]! - y) ** 2 < Math.min(a.sigma, sigma) ** 2 * 1.2)) continue;
    if (x - 4 * sigma < prepared.bounds.min[0] || x + 4 * sigma > prepared.bounds.max[0] ||
      y - 4 * sigma < prepared.bounds.min[1] || y + 4 * sigma > prepared.bounds.max[1]) continue;
    let best = 0, depth = 0;
    for (let iz = 0; iz < nz; iz++) {
      const z = prepared.bounds.min[2] + iz * prepared.pitch;
      if (z - 4 * sigma < prepared.bounds.min[2] || z + 4 * sigma > prepared.bounds.max[2]) continue;
      let sum = 0;
      for (const [dx, dy, weight] of [[0, 0, 1], [-.5, 0, .5], [.5, 0, .5], [0, -.5, .5], [0, .5, .5]]) {
        prior.sampleEmission(x + dx! * sigma, y + dy! * sigma, z, value); sum += weight! * value[0];
      }
      if (sum > best) { best = sum; depth = z; }
    }
    // Unsupported regions stay with the declared broad prior: never invent a texture-derived sheet.
    if (!(best > 1e-8)) continue;
    atoms.push({ centerArcsec: [x, y, depth], sigmaArcsec: sigma }); accepted.push(candidate);
  }
  return atoms;
}

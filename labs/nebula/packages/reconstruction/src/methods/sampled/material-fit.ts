/** Fit the colors of finite emitters with a fixed, depth-aware Beer–Lambert transport operator. */
import { type MaterialImage as CompilerImage, type EmissionVector3, type PreparedSampledField, type SampledRecipe, type ComponentWeights, prepareSampledMaterial, diffuseMaterialColors, type SampledMaterialFit } from '@cssearth/bake/volume';
import { diffuseAtomEmission } from '@cssearth/nebula-reconstruction/methods/sampled/emission-fit';
import { fitMaterialColors, type MaterialColumn } from '@cssearth/nebula-reconstruction/methods/sampled/material-solver';

export function fitSampledMaterialColors(values: Float32Array, recipe: SampledRecipe, prepared: PreparedSampledField,
  image: Pick<CompilerImage, 'id' | 'sampleRgb'>, weights: ComponentWeights, fit: SampledMaterialFit, signal?: AbortSignal) {
  const { size, bounds, pitch } = prepared, [nx, ny, nz] = size, plane = nx * ny;
  const baseWeights = { ejecta: weights.ejecta * fit.ejectaGain, pwn: weights.pwn };
  const base = prepareSampledMaterial(values, recipe, prepared, image, baseWeights, undefined, signal);
  const factors = new Float32Array(prepared.ejecta.length), fixed = new Float32Array(plane * 3), target = new Float32Array(plane * 3);
  const covered = new Uint8Array(plane), rgb: EmissionVector3 = [0, 0, 0];
  for (let y = 0; y < ny; y++) {
    signal?.throwIfAborted();
    for (let x = 0; x < nx; x++) {
      const p = y * nx + x, available = image.sampleRgb(bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, rgb);
      if (available && rgb.some(n => !Number.isFinite(n) || n < 0 || n > 255)) throw new TypeError('Invalid material-fit source pixel.');
      if (!available) continue;
      covered[p] = 1; for (let c = 0; c < 3; c++) target[p * 3 + c] = rgb[c]! / 255;
      let transmission = 1;
      for (let z = 0; z < nz; z++) {
        const i = z * plane + p, baseDensity = baseWeights.ejecta * prepared.ejecta[i]! + baseWeights.pwn * prepared.pwn[i]!;
        const density = baseDensity + fit.diffuse[i]!; if (!(density > 0)) continue;
        const attenuation = Math.exp(-density * pitch), factor = transmission * (1 - attenuation) / density;
        factors[i] = factor; transmission *= attenuation;
        for (let c = 0; c < 3; c++) fixed[p * 3 + c] += factor * baseDensity * base.gridMaterial[i * 4 + c]! / 255;
      }
    }
  }
  const initial = diffuseMaterialColors(image, fit.atoms).map(color => color.rgb);
  const columns: MaterialColumn[] = fit.atoms.map((atom, a) => {
    signal?.throwIfAborted(); const indices: number[] = [], coefficients: number[] = [], gain = fit.coefficients[a]!;
    const lo = atom.centerArcsec.map((n, i) => Math.max(0, Math.floor((n - 4 * atom.sigmaArcsec - bounds.min[i]!) / pitch)));
    const hi = atom.centerArcsec.map((n, i) => Math.min(size[i]! - 1, Math.ceil((n + 4 * atom.sigmaArcsec - bounds.min[i]!) / pitch)));
    if (gain > 0) for (let y = lo[1]!; y <= hi[1]!; y++) for (let x = lo[0]!; x <= hi[0]!; x++) {
      const p = y * nx + x; if (!covered[p]) continue; let coefficient = 0;
      for (let z = lo[2]!; z <= hi[2]!; z++) coefficient += factors[z * plane + p]! * gain *
        diffuseAtomEmission(atom, bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, bounds.min[2] + z * pitch);
      if (coefficient > 0) { indices.push(p); coefficients.push(coefficient); }
    }
    return { indices: Uint32Array.from(indices), values: Float32Array.from(coefficients) };
  });
  const result = fitMaterialColors(columns, target, fixed, covered, initial, { iterations: 150, regularization: .001 }, signal);
  return { colors: result.colors, receipt: { method: 'fixed-geometry-depth-aware-rgb-fit@1', sourceId: image.id,
    beforeRmse: result.beforeRmse, afterRmse: result.afterRmse, validationBeforeRmse: result.validationBeforeRmse,
    validationAfterRmse: result.validationAfterRmse, samples: { width: nx, height: ny, depth: nz, pitchArcsec: pitch },
    colors: result.colors, interpretation: 'The exact existing neutral grid determines near-to-far attenuation. Fixed measured-point and wind colors are retained; only bounded RGB colors on finite diffuse/detail atoms are fitted. No position, alpha, support or star changes in this step. Held-out pixels test image interpolation, not true depth; tracer association, finite-grid transport and front/back ambiguity remain conditional.' } };
}

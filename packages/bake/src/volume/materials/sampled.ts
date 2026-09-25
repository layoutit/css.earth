/** Attach chromaticity to finite 3D emitters before splatting; never project a photograph through a finished volume. */
import type { EmissionVector3 } from '../contracts/emission.ts';
import type { MaterialImage } from './component-material.ts';
import type { Cancellation } from '../contracts/cancellation.ts';
import { analyticEmission, mapSample, type PreparedSampledField } from '../fields/sampled.ts';
import { diffuseAtomEmission, diffuseAtomProjection, type DiffuseAtom } from '../fields/diffuse-atoms.ts';
import type { SampledRecipe, ComponentWeights, SampleTerm } from '../contracts/sampled-recipe.ts';

type Image = MaterialImage;
export type SampledColor = { rgb: EmissionVector3; covered: boolean };
export interface SampledMaterialFit { atoms: DiffuseAtom[]; coefficients: number[]; ejectaGain: number; diffuse: Float32Array; colors?: EmissionVector3[] }
function chromaticity(image: Image, x: number, y: number): SampledColor {
  const rgb: EmissionVector3 = [0, 0, 0], observed = image.sampleRgb(x, y, rgb);
  if (observed && rgb.some(n => !Number.isFinite(n) || n < 0 || n > 255)) throw new TypeError('Invalid emitter material pixel.');
  const peak = observed ? Math.max(...rgb) : 0;
  return { rgb: peak > 0 ? rgb.map(n => n / peak) as EmissionVector3 : [1, 1, 1], covered: peak > 0 };
}
/** An image assigns one color to a whole bounded component, not different repeated pixels to its depth samples. */
function projectedColor(image: Image, min: [number, number], max: [number, number], projection: (x: number, y: number) => number): SampledColor {
  const rgb: EmissionVector3 = [0, 0, 0]; let total = 0, covered = 0;
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
    const px = min[0] + (x + .5) / 17 * (max[0] - min[0]), py = min[1] + (y + .5) / 17 * (max[1] - min[1]);
    const weight = projection(px, py); if (!(weight > 0)) continue;
    const color = chromaticity(image, px, py); total += weight; if (color.covered) covered += weight;
    for (let c = 0; c < 3; c++) rgb[c] += weight * color.rgb[c]!;
  }
  return { rgb: total > 0 ? rgb.map(n => n / total) as EmissionVector3 : [1, 1, 1], covered: covered > 0 };
}
function termColor(term: SampleTerm, image: Image): SampledColor {
  const center = term.kind === 'jet' ? term.startArcsec.map((n, i) => (n + term.endArcsec[i]!) / 2) as EmissionVector3 : term.centerArcsec;
  const extent = term.kind === 'ellipsoid' ? term.sigmaArcsec.map(s => 4 * s) : term.kind === 'torus' ?
    [0, 1, 2].map(() => term.radiusArcsec + 4 * term.sigmaArcsec) :
    term.startArcsec.map((n, i) => Math.abs(n - term.endArcsec[i]!) / 2 + 4 * term.sigmaArcsec);
  return projectedColor(image, [center[0] - extent[0]!, center[1] - extent[1]!], [center[0] + extent[0]!, center[1] + extent[1]!], (x, y) => {
    let total = 0; const dz = 2 * extent[2]! / 32;
    for (let z = 0; z < 32; z++) total += analyticEmission(term, x, y, center[2] - extent[2]! + (z + .5) * dz) * dz;
    return total;
  });
}
export function diffuseMaterialColors(image: Image, atoms: DiffuseAtom[]): SampledColor[] {
  return atoms.map(atom => projectedColor(image,
    [atom.centerArcsec[0] - 4 * atom.sigmaArcsec, atom.centerArcsec[1] - 4 * atom.sigmaArcsec],
    [atom.centerArcsec[0] + 4 * atom.sigmaArcsec, atom.centerArcsec[1] + 4 * atom.sigmaArcsec],
    (x, y) => diffuseAtomProjection(atom, x, y)));
}

export function prepareSampledMaterial(values: Float32Array, recipe: SampledRecipe, prepared: PreparedSampledField,
  image: Image, weights: ComponentWeights, fit?: SampledMaterialFit, signal?: Cancellation, retained?: { pointColors: Float64Array; windColors: SampledColor[]; atomColors: SampledColor[] }) {
  if (values.length !== recipe.source.width * recipe.source.height) throw new TypeError('Material source count differs from qualified samples.');
  if (fit && (fit.atoms.length !== fit.coefficients.length || fit.coefficients.some(n => !Number.isFinite(n) || n < 0) ||
    !Number.isFinite(fit.ejectaGain) || fit.ejectaGain <= 0)) throw new TypeError('Invalid material component fit.');
  if (fit?.colors && (fit.colors.length !== fit.atoms.length || fit.colors.some(rgb => rgb.length !== 3 || rgb.some(n => !Number.isFinite(n) || n < 0 || n > 1))))
    throw new TypeError('Invalid fitted component RGB.');
  if (retained && (retained.pointColors.length !== recipe.source.height * 4 || retained.windColors.length !== recipe.terms.length || retained.atomColors.length !== (fit?.atoms.length ?? 0))) throw new TypeError('Retained emitter colors differ from spatial components.');
  const { size, pitch, bounds } = prepared, [nx, ny, nz] = size, count = nx * ny * nz;
  if (fit && fit.diffuse.length !== count) throw new TypeError('Material fit grid shape differs.');
  // Three emission-weighted channels plus observed-coverage emission; no new density field.
  const grid = new Float32Array(count * 4), sigma = recipe.grid.blurSigmaCells, radius = Math.ceil(3 * sigma);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const kernelSum = kernel.reduce((a, b) => a + b, 0) ** 3, ejectaGain = weights.ejecta * (fit?.ejectaGain ?? 1);
  const [cx, cy, cz, cw] = recipe.source.columns, stride = recipe.source.width;
  let observedPoints = 0, uncoveredPoints = 0;
  const add = (index: number, emission: number, color: SampledColor) => {
    const at = index * 4;
    for (let c = 0; c < 3; c++) grid[at + c] += emission * color.rgb[c]!;
    if (color.covered) grid[at + 3] += emission;
  };
  if (ejectaGain > 0) for (let row = 0; row < recipe.source.height; row++) {
    if ((row & 4095) === 0) signal?.throwIfAborted();
    const flux = values[row * stride + cw]!; if (!(flux > 0)) continue;
    const point = mapSample(recipe.rawToArcsec, values[row * stride + cx]!, values[row * stride + cy]!, values[row * stride + cz]!);
    const color: SampledColor = retained ? { rgb: [retained.pointColors[row * 4]!, retained.pointColors[row * 4 + 1]!, retained.pointColors[row * 4 + 2]!], covered: retained.pointColors[row * 4 + 3] === 1 } : chromaticity(image, point[0], point[1]); if (color.covered) observedPoints++; else uncoveredPoints++;
    const ix = Math.round((point[0] - bounds.min[0]) / pitch), iy = Math.round((point[1] - bounds.min[1]) / pitch), iz = Math.round((point[2] - bounds.min[2]) / pitch);
    const weight = Math.pow(flux, recipe.grid.weightExponent) / kernelSum * prepared.evidence.normalization * ejectaGain;
    for (let kz = 0; kz < kernel.length; kz++) for (let ky = 0; ky < kernel.length; ky++) for (let kx = 0; kx < kernel.length; kx++) {
      const x = ix + kx - radius, y = iy + ky - radius, z = iz + kz - radius;
      if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) throw new Error('Material emitter kernel was clipped.');
      add((z * ny + y) * nx + x, weight * kernel[kx]! * kernel[ky]! * kernel[kz]!, color);
    }
  }
  const windColors = retained?.windColors ?? recipe.terms.map(term => termColor(term, image));
  if (weights.pwn > 0) for (let z = 0; z < nz; z++) {
    signal?.throwIfAborted();
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const index = (z * ny + y) * nx + x; if (!(prepared.pwn[index]! > 0)) continue;
      recipe.terms.forEach((term, i) => add(index, weights.pwn * analyticEmission(term, bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, bounds.min[2] + z * pitch), windColors[i]!));
    }
  }
  const atomColors = retained?.atomColors ?? diffuseMaterialColors(image, fit?.atoms ?? []).map((color, i) =>
    ({ ...color, rgb: fit?.colors ? [...fit.colors[i]!] as EmissionVector3 : color.rgb }));
  fit?.atoms.forEach((atom, i) => {
    signal?.throwIfAborted(); const coefficient = fit.coefficients[i]!; if (!(coefficient > 0)) return;
    const lo = atom.centerArcsec.map((n, a) => Math.max(0, Math.floor((n - 4 * atom.sigmaArcsec - bounds.min[a]!) / pitch)));
    const hi = atom.centerArcsec.map((n, a) => Math.min(size[a]! - 1, Math.ceil((n + 4 * atom.sigmaArcsec - bounds.min[a]!) / pitch)));
    for (let z = lo[2]!; z <= hi[2]!; z++) for (let y = lo[1]!; y <= hi[1]!; y++) for (let x = lo[0]!; x <= hi[0]!; x++) {
      const emission = coefficient * diffuseAtomEmission(atom, bounds.min[0] + x * pitch, bounds.min[1] + y * pitch, bounds.min[2] + z * pitch);
      if (emission > 0) add((z * ny + y) * nx + x, emission, atomColors[i]!);
    }
  });
  // Keep a compact normalized material grid; its coverage byte does not alter geometry alpha.
  const material = new Uint8Array(grid.length);
  const density = (i: number) => ejectaGain * prepared.ejecta[i]! + weights.pwn * prepared.pwn[i]! + (fit?.diffuse[i] ?? 0);
  for (let i = 0; i < count; i++) {
    const total = density(i); if (!(total > 0)) continue;
    for (let c = 0; c < 4; c++) material[i * 4 + c] = Math.round(255 * Math.max(0, Math.min(1, grid[i * 4 + c]! / total)));
  }
  function sampleMaterial(x: number, y: number, z: number, out: EmissionVector3): boolean {
    out.fill(0);
    const px = (x - bounds.min[0]) / pitch, py = (y - bounds.min[1]) / pitch, pz = (z - bounds.min[2]) / pitch;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx - 1 || iy >= ny - 1 || iz >= nz - 1) return false;
    const fx = px - ix, fy = py - iy, fz = pz - iz; let total = 0, covered = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = ((iz + dz) * ny + iy + dy) * nx + ix + dx;
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz) * density(i);
      total += weight; covered += weight * material[i * 4 + 3]!;
      for (let c = 0; c < 3; c++) out[c] += weight * material[i * 4 + c]!;
    }
    if (!(total > 0) || !(covered > 0)) return false;
    for (let c = 0; c < 3; c++) out[c] = Math.max(0, Math.min(255, out[c]! / total));
    return true;
  }
  return { sampleMaterial, gridMaterial: material, receipt: { method: 'finite-emitter-chromaticity@1', sourceId: image.id,
    observedPoints, uncoveredPoints, gridSize: size, materialBytes: material.byteLength,
    windColors: recipe.terms.map((term, i) => ({ id: term.id, ...windColors[i]! })),
    diffuseColors: atomColors,
    interpretation: 'Each qualified point receives one registered color before its finite XYZ kernel is splatted. Each finite wind/diffuse component receives a footprint-weighted color. Mixtures follow those components in three dimensions; the source image is never sampled at a baked voxel. Color associations remain inferred where components overlap in projection; missing coverage stays neutral. Density, geometry and stars are unchanged.' } };
}

/** Compact per-emitter colors are independent of source image resolution and slicing. */
export function sampledPointColors(values: Float32Array, recipe: SampledRecipe, image: Image): Float64Array {
  const colors = new Float64Array(recipe.source.height * 4);
  const [cx, cy, cz, cw] = recipe.source.columns, stride = recipe.source.width;
  for (let row = 0; row < recipe.source.height; row++) {
    if (!(values[row * stride + cw]! > 0)) continue;
    const point = mapSample(recipe.rawToArcsec, values[row * stride + cx]!, values[row * stride + cy]!, values[row * stride + cz]!);
    const color = chromaticity(image, point[0], point[1]);
    colors.set([...color.rgb, Number(color.covered)], row * 4);
  }
  return colors;
}

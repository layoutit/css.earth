/** Offline axis-aligned density slabs and straight-alpha raster preparation. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeVolumeRaster } from './raster.ts';
import { gradePremultipliedDisplayRgb, type Axis, type Bounds3, type DisplayColorMatrix, type Vector3, type RadialEmission, type VolumeRecipe, type VolumeSlices, type VolumeSliceQuad } from '@cssearth/bake/volume';
import { loadVolumeSource, sampleEncoded, type VolumeSource } from '../compact-inputs/density-grid.ts';
import { sha256 } from '@cssearth/core/node';
export type { VolumeSlices, VolumeSliceQuad } from '@cssearth/bake/volume';
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (lo: number, hi: number, value: number): number => {
  const t = clamp((value - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
/** Authored projected radial profile, supported within unit radius. */
function projectedRadialProfile(radius: number, component: RadialEmission): number {
  return Math.exp(-component.falloff * ((radius * radius * component.radialScale ** 2 + component.inner ** 2) ** component.exponent - 1)) *
    (1 - smoothstep(component.radialTaper[0], component.radialTaper[1], radius));
}
/**
 * Abel inversion j(r)=-1/pi ∫ S'(sqrt(r²+t²))/sqrt(r²+t²) dt.
 * This derives positive radial emissivity from the authored projected profile.
 * Scaling by 1/z0 preserves its face-on line integral in an untruncated ellipsoid.
 */
export function prepareRadialDensity(component: RadialEmission, resolution = 1024): Float64Array {
  const result = new Float64Array(resolution);
  const quadrature = 128, derivativeStep = 1e-5;
  for (let index = 0; index < resolution; index++) {
    const radius = index / (resolution - 1), end = Math.sqrt(1 - radius * radius);
    let integral = 0;
    for (let step = 0; step < quadrature; step++) {
      const t = (step + 0.5) / quadrature * end;
      const projectedRadius = Math.hypot(radius, t);
      const lo = Math.max(0, projectedRadius - derivativeStep), hi = Math.min(1, projectedRadius + derivativeStep);
      const derivative = (projectedRadialProfile(hi, component) - projectedRadialProfile(lo, component)) / (hi - lo);
      integral -= derivative / Math.max(projectedRadius, 1e-10);
    }
    result[index] = Math.max(0, integral * end / quadrature / Math.PI / component.flattening);
  }
  return result;
}
function radialSample(table: Float64Array, radius: number): number {
  if (radius >= 1) return 0;
  const coordinate = Math.max(0, radius) * (table.length - 1), lo = Math.floor(coordinate);
  return (table[lo] ?? 0) * (1 - coordinate + lo) + (table[lo + 1] ?? 0) * (coordinate - lo);
}
function point(axis: Axis, depth: number, u: number, v: number): Vector3 {
  if (axis === 'x') return [depth, u, v];
  if (axis === 'y') return [u, depth, v];
  return [u, v, depth];
}
export function slabStepSize(recipe: VolumeRecipe, axis: Axis, slabWidth: number): number {
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const metric = recipe.material.stepMetric === 'texture' ? 1 / (recipe.grid.bounds.max[index] - recipe.grid.bounds.min[index]) : 1;
  return slabWidth / recipe.bake.samplesPerSlab * recipe.material.stepScale * recipe.bake.opticalWeight * metric;
}
export function withinVolumeSupport(recipe: VolumeRecipe, position: Vector3): boolean {
  const support = recipe.material.cylinderSupport;
  if (!support) return true;
  const axial = support.axis === 'x' ? 0 : support.axis === 'y' ? 1 : 2;
  let squared = 0;
  for (let axis = 0; axis < 3; axis++) if (axis !== axial) {
    const coordinate = 2 * ((position[axis]! - recipe.grid.bounds.min[axis]!) /
      (recipe.grid.bounds.max[axis]! - recipe.grid.bounds.min[axis]!)) - 1;
    squared += coordinate * coordinate;
  }
  return squared <= support.radiusSquared;
}
export function channelDensity(encoded: number, encoding: VolumeRecipe['grid']['encoding'], decodedPower = 1): number {
  return encoded ** ((encoding === 'sqrt-density-unorm8' ? 2 : 1) * decodedPower);
}
export function bakeSlab(source: VolumeSource, axis: Axis, depth: number, slabWidth: number, width: number, height: number,
  radialTable: Float64Array | undefined): { rgba: Buffer; alphaCoverage: number } {
  const { material, bake, grid } = source.recipe;
  if (material.emissionTransfer === 'shared-opacity' && material.absorption.length > 0) throw new TypeError('Shared-opacity emission does not support absorption.');
  const pixels = Buffer.alloc(width * height * 4);
  const encoded: [number, number, number, number] = [0, 0, 0, 0];
  const emission: Vector3 = [0, 0, 0], tau: Vector3 = [0, 0, 0];
  const horizontal = axis === 'x' ? 1 : 0, vertical = axis === 'z' ? 1 : 2;
  const uMin = grid.bounds.min[horizontal], uMax = grid.bounds.max[horizontal];
  const vMin = grid.bounds.min[vertical], vMax = grid.bounds.max[vertical];
  const samples = bake.samplesPerSlab, ds = slabStepSize(source.recipe, axis, slabWidth);
  let nonzero = 0;
  for (let row = 0; row < height; row++) {
    const v = vMax - (vMax - vMin) * (row + 0.5) / height;
    for (let column = 0; column < width; column++) {
      const u = uMin + (uMax - uMin) * (column + 0.5) / width;
      emission[0] = emission[1] = emission[2] = tau[0] = tau[1] = tau[2] = 0;
      for (let sample = 0; sample < samples; sample++) {
        const d = depth + slabWidth * ((sample + 0.5) / samples - 0.5);
        const [x, y, z] = point(axis, d, u, v);
        if (!withinVolumeSupport(source.recipe, [x, y, z])) continue;
        sampleEncoded(source, x, y, z, encoded);
        const profile = material.radialEmission;
        const radialDensity = profile && radialTable ? radialSample(radialTable, Math.hypot(x, y, z / profile.flattening)) *
          (1 - smoothstep(profile.verticalTaper[0], profile.verticalTaper[1], Math.abs(z))) : 0;
        for (let channel = 0; channel < 3; channel++) {
          let light = 0, absorption = 0;
          for (const field of material.emission) light += channelDensity(encoded[field.channel] ?? 0, grid.encoding, field.decodedPower) * field.strength * (field.color[channel] ?? 0);
          if (profile) light += radialDensity * profile.strength * (profile.color[channel] ?? 0);
          for (const field of material.absorption) absorption += channelDensity(encoded[field.channel] ?? 0, grid.encoding, field.decodedPower) * field.strength * (field.color[channel] ?? 0);
          emission[channel] = (emission[channel] ?? 0) + ds * material.intensityScale * light;
          tau[channel] = (tau[channel] ?? 0) + absorption * ds;
        }
      }
      // Keep exponential energy in ordinary alpha. Per-slab sRGB encoding amplifies
      // emission before composition; equal achromatic slabs must accumulate as 1-exp(-sum).
      let red = 1 - Math.exp(-material.exposureGain * emission[0] * Math.exp(-tau[0] / 2));
      let green = 1 - Math.exp(-material.exposureGain * emission[1] * Math.exp(-tau[1] / 2));
      let blue = 1 - Math.exp(-material.exposureGain * emission[2] * Math.exp(-tau[2] / 2));
      const dustOpacity = 1 - Math.exp(-(tau[0] * 0.2126 + tau[1] * 0.7152 + tau[2] * 0.0722));
      let alpha = Math.max(red, green, blue, dustOpacity);
      let colorNormalization = alpha;
      if (material.emissionTransfer === 'shared-opacity') {
        // A common chromaticity q and scalar optical depth E give q*(1-exp(-E)).
        // Source-over then telescopes to q*(1-exp(-sum(E))) at any slab spacing.
        // This is a display-emission model; RGB-varying columns remain an approximation.
        const peak = Math.max(...emission);
        alpha = -Math.expm1(-material.exposureGain * peak);
        // Encode straight optical ratios directly: cancelling alpha after an
        // intermediate multiplication can flip RGBA8 half-byte rounding ties.
        // The bounded linear display matrix commutes with this normalization.
        colorNormalization = peak;
        red = emission[0]; green = emission[1]; blue = emission[2];
      }
      const offset = 4 * (row * width + column);
      if (alpha > 0) {
        const graded = gradePremultipliedDisplayRgb([red, green, blue], material.displayColorMatrix);
        pixels[offset] = Math.round(clamp(graded[0] / colorNormalization) * 255);
        pixels[offset + 1] = Math.round(clamp(graded[1] / colorNormalization) * 255);
        pixels[offset + 2] = Math.round(clamp(graded[2] / colorNormalization) * 255);
        pixels[offset + 3] = Math.round(clamp(alpha) * 255);
        if (pixels[offset + 3]) nonzero++;
      }
    }
  }
  return { rgba: pixels, alphaCoverage: nonzero / (width * height) };
}
export async function prepareVolumeSlices(options: { sourceDirectory: string; outputDirectory: string; recipe: VolumeRecipe }): Promise<VolumeSlices> {
  const source = await loadVolumeSource(options.sourceDirectory, options.recipe);
  const { grid, material, bake } = options.recipe;
  const radial = material.radialEmission ? prepareRadialDensity(material.radialEmission) : undefined;
  const quads: VolumeSliceQuad[] = [], axes: Axis[] = ['x', 'y', 'z'];
  const scale = bake.unitsPerSourceUnit, counts = bake.sliceCounts;
  const pitches: Record<Axis, number> = { x: 0, y: 0, z: 0 };
  for (const axis of axes) {
    const depthIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const horizontal = axis === 'x' ? 1 : 0, vertical = axis === 'z' ? 1 : 2;
    const lower = grid.bounds.min[depthIndex], upper = grid.bounds.max[depthIndex];
    const uLower = grid.bounds.min[horizontal], uUpper = grid.bounds.max[horizontal];
    const vLower = grid.bounds.min[vertical], vUpper = grid.bounds.max[vertical];
    const width = bake.imageWidth, height = Math.max(1, Math.round(width * (vUpper - vLower) / (uUpper - uLower)));
    const slabWidth = (upper - lower) / counts[axis];
    pitches[axis] = slabWidth * scale;
    await mkdir(resolve(options.outputDirectory, 'slices', axis), { recursive: true });
    for (let index = 0; index < counts[axis]; index++) {
      const depth = lower + (index + 0.5) * slabWidth;
      const baked = bakeSlab(source, axis, depth, slabWidth, width, height, radial);
      let left = 0, top = 0, right = width - 1, bottom = height - 1;
      if (bake.cropTransparent) {
        left = width; top = height; right = -1; bottom = -1;
        for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) if (baked.rgba[4 * (row * width + column) + 3]) {
          left = Math.min(left, column); right = Math.max(right, column); top = Math.min(top, row); bottom = Math.max(bottom, row);
        }
        if (right < left) { left = right = Math.floor(width / 2); top = bottom = Math.floor(height / 2); }
      }
      const croppedWidth = right - left + 1, croppedHeight = bottom - top + 1;
      const texturePath = `slices/${axis}/${String(index).padStart(2, '0')}.${bake.imageEncoding?.format ?? 'png'}`;
      const target = resolve(options.outputDirectory, texturePath);
      const bytes = await encodeVolumeRaster({ rgba: baked.rgba, width, height,
        crop: { left, top, width: croppedWidth, height: croppedHeight }, encoding: bake.imageEncoding });
      await writeFile(target, bytes);
      const uMin = uLower + (uUpper - uLower) * left / width, uMax = uLower + (uUpper - uLower) * (right + 1) / width;
      const vMax = vUpper - (vUpper - vLower) * top / height, vMin = vUpper - (vUpper - vLower) * (bottom + 1) / height;
      // Image/projective maps image corners by vertex order; UV-only flips do not correct it.
      const vertices: [Vector3, Vector3, Vector3, Vector3] = [point(axis, depth, uMin, vMax), point(axis, depth, uMax, vMax),
        point(axis, depth, uMax, vMin), point(axis, depth, uMin, vMin)];
      for (const vertex of vertices) for (let i = 0; i < 3; i++) vertex[i] = (vertex[i] ?? 0) * scale;
      const center = point(axis, depth * scale, (uMin + uMax) * scale / 2, (vMin + vMax) * scale / 2);
      const normal: Vector3 = axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, -1];
      quads.push({ id: `${axis}-${index}`, axis, sliceIndex: index, texturePath, widthPx: croppedWidth, heightPx: croppedHeight,
        vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center, normal, sha256: sha256(bytes), bytes: bytes.length,
        alphaCoverage: baked.alphaCoverage * width * height / (croppedWidth * croppedHeight) });
    }
    console.log(`Prepared ${counts[axis]} ${axis.toUpperCase()} scalar-field slabs.`);
  }
  for (const axis of axes) if (!quads.some(q => q.axis === axis && q.alphaCoverage > 0)) throw new TypeError(`Empty ${axis} volume stack.`);
  const boundsUnits: Bounds3 = { min: [grid.bounds.min[0] * scale, grid.bounds.min[1] * scale, grid.bounds.min[2] * scale],
    max: [grid.bounds.max[0] * scale, grid.bounds.max[1] * scale, grid.bounds.max[2] * scale] };
  const result: VolumeSlices = { quads, boundsUnits, provenance: source.provenance, approximation: {
    method: material.emissionTransfer === 'shared-opacity'
      ? 'Filtered scalar fields; decoded after filtering; integrated RGB emission; exponential shared opacity with optical RGB ratios in ordinary alpha.'
      : 'Filtered scalar fields; decoded after filtering; integrated emission/absorption; symmetric slab attenuation; exponential energy in ordinary alpha.',
    radialEmission: material.radialEmission ? 'Abel-deprojected radial profile, ellipsoidal normalization and authored boundary taper.' : 'None.',
    limitations: [material.emissionTransfer === 'shared-opacity'
      ? 'Shared-opacity display emission preserves column-constant chromaticity before RGBA8 quantization; varying chromaticity remains a slab approximation. Extinction is unsupported.'
      : 'Ordinary alpha approximates emitted light and wavelength-dependent extinction.',
      'Finite slices and axis handoffs approximate a continuous field; angle-dependent opacity and sampling differences remain.',
      ...(material.displayColorMatrix ? ['The display color matrix transforms ordinary display RGB values; it is not linear-light photometry.'] : []),
      'No runtime ray integration, near-field noise or global HDR display pass.'],
    samplesPerSlab: bake.samplesPerSlab, opticalWeight: bake.opticalWeight, exposureGain: material.exposureGain,
    ...(material.emissionTransfer ? { emissionTransfer: material.emissionTransfer } : {}),
    ...(material.displayColorMatrix ? { displayColorMatrix: material.displayColorMatrix } : {}),
    sliceCounts: counts, slabPitchUnits: pitches } };
  await writeFile(resolve(options.outputDirectory, 'volume-slices.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

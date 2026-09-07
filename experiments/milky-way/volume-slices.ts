/** Offline three-axis textured geometry preparation; no GPU or runtime asset generation. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { loadVolumeSource, sampleEncoded, type Vector3, type VolumeComponent, type VolumeSource } from './volume-source.js';

export type SliceAxis = 'x' | 'y' | 'z';
export interface VolumeSliceQuad {
  id: string;
  axis: SliceAxis;
  sliceIndex: number;
  texturePath: string;
  widthPx: number;
  heightPx: number;
  /** Polygon winding is CCW toward normal. Image/projective backend maps PNG corners by vertex order (top-left first). */
  vertices: [Vector3, Vector3, Vector3, Vector3];
  uvs: [[number, number], [number, number], [number, number], [number, number]];
  center: Vector3;
  normal: Vector3;
  sha256: string;
  alphaCoverage: number;
}
export interface VolumeSliceResult {
  quads: VolumeSliceQuad[];
  source: VolumeSource['provenance'];
  radiusUnits: number;
  solarPositionUnits: Vector3;
  localBounds: { x: [-1, 1]; y: [-1, 1]; z: [-0.125, 0.125] };
  approximation: {
    method: string;
    bulge: string;
    limitations: string[];
    samplesPerSlab: number;
    axisOpticalWeight: number;
    exposureGain: number;
    transfer: 'per-slab-srgb' | 'integrated-opacity';
    sliceCounts: Record<SliceAxis, number>;
    slabPitchUnits: Record<SliceAxis, number>;
  };
}
export interface VolumeSliceOptions {
  galaxioRoot: string;
  outputDirectory: string;
  /** Short-axis count; default long-axis counts are four times this for the interactive budget. */
  slicesPerAxis?: number;
  /** Independent counts permit equal physical pitch in the thin volume. */
  sliceCounts?: Partial<Record<SliceAxis, number>>;
  radiusUnits?: number;
  imageWidth?: number;
  samplesPerSlab?: number;
  cropTransparent?: boolean;
  axisOpticalWeight?: number;
  exposureGain?: number;
  transfer?: 'per-slab-srgb' | 'integrated-opacity';
}
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (lo: number, hi: number, value: number): number => {
  const t = clamp((value - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
/** Galaxio's projected bulge profile, without its exterior-camera distance modifier (=1). */
function projectedBulge(radius: number, component: VolumeComponent): number {
  return Math.exp(-7.669 * ((radius * radius * component.r0 ** 2 + component.inner ** 2) ** 0.125 - 1)) *
    (1 - smoothstep(0.75, 1, radius));
}
/**
 * Abel inversion j(r)=-1/pi ∫ S'(sqrt(r²+t²))/sqrt(r²+t²) dt.
 * This derives positive radial emissivity from the authored projected profile.
 * Scaling by 1/z0 preserves its face-on line integral in an untruncated ellipsoid.
 */
export function prepareBulgeDensity(component: VolumeComponent, resolution = 1024): Float64Array {
  const result = new Float64Array(resolution);
  const quadrature = 128, derivativeStep = 1e-5;
  for (let index = 0; index < resolution; index++) {
    const radius = index / (resolution - 1), end = Math.sqrt(1 - radius * radius);
    let integral = 0;
    for (let step = 0; step < quadrature; step++) {
      const t = (step + 0.5) / quadrature * end;
      const projectedRadius = Math.hypot(radius, t);
      const lo = Math.max(0, projectedRadius - derivativeStep), hi = Math.min(1, projectedRadius + derivativeStep);
      const derivative = (projectedBulge(hi, component) - projectedBulge(lo, component)) / (hi - lo);
      integral -= derivative / Math.max(projectedRadius, 1e-10);
    }
    result[index] = Math.max(0, integral * end / quadrature / Math.PI / component.z0);
  }
  return result;
}
function bulgeSample(table: Float64Array, radius: number): number {
  if (radius >= 1) return 0;
  const coordinate = Math.max(0, radius) * (table.length - 1), lo = Math.floor(coordinate);
  return (table[lo] ?? 0) * (1 - coordinate + lo) + (table[lo + 1] ?? 0) * (coordinate - lo);
}
function point(axis: SliceAxis, depth: number, u: number, v: number): Vector3 {
  if (axis === 'x') return [depth, u, v];
  if (axis === 'y') return [u, depth, v];
  return [u, v, depth];
}
function srgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}
/** Each pixel integrates a slab, not an invented 2D spiral or a captured camera view. */
function bakeSlab(options: {
  source: VolumeSource; axis: SliceAxis; depth: number; slabWidth: number;
  width: number; height: number; samples: number; opticalWeight: number; exposure: number; transfer: 'per-slab-srgb' | 'integrated-opacity'; bulge: Float64Array;
}): { rgba: Buffer; alphaCoverage: number } {
  const { source, axis, depth, slabWidth, width, height, samples, opticalWeight, exposure, transfer, bulge } = options;
  const pixels = Buffer.alloc(width * height * 4);
  const { disk, stars, dust, bulge: bulgeComponent } = source.model.components;
  const encoded: Vector3 = [0, 0, 0];
  const emission: Vector3 = [0, 0, 0], tau: Vector3 = [0, 0, 0];
  const halfHeight = axis === 'z' ? 1 : 0.125;
  const ds = slabWidth / samples * source.model.stepScale * opticalWeight;
  // Default keeps exponential energy in alpha: equal achromatic slabs compose as
  // 1-exp(-sum(energy)). Encoding each slab to sRGB first destroys this identity.
  const display = transfer === 'per-slab-srgb' ? srgb : (value: number): number => value;
  let nonzero = 0;
  for (let row = 0; row < height; row++) {
    // PNG rows run top-to-bottom; top pixels sample the positive in-plane coordinate.
    const v = halfHeight * (1 - 2 * (row + 0.5) / height);
    for (let column = 0; column < width; column++) {
      const u = 2 * (column + 0.5) / width - 1;
      emission[0] = emission[1] = emission[2] = tau[0] = tau[1] = tau[2] = 0;
      for (let sample = 0; sample < samples; sample++) {
        const d = depth + slabWidth * ((sample + 0.5) / samples - 0.5);
        const [x, y, z] = point(axis, d, u, v);
        sampleEncoded(source, x, y, z, encoded);
        const diskDensity = encoded[0] ** 2, starDensity = encoded[1] ** 2, dustDensity = encoded[2] ** 2;
        // The radial bulge extends beyond this thin texture box; fade that known
        // approximation to zero at its cut boundary instead of revealing a rectangular sheet.
        const coreDensity = bulgeSample(bulge, Math.hypot(x, y, z / bulgeComponent.z0)) *
          (1 - smoothstep(0.075, 0.125, Math.abs(z)));
        for (let channel = 0; channel < 3; channel++) {
          emission[channel] = (emission[channel] ?? 0) + ds * source.model.intensityScale *
            (diskDensity * disk.strength * (disk.color[channel] ?? 0) +
              starDensity * stars.strength * (stars.color[channel] ?? 0) +
              coreDensity * bulgeComponent.strength * (bulgeComponent.color[channel] ?? 0));
          tau[channel] = (tau[channel] ?? 0) + dustDensity * dust.strength * (dust.color[channel] ?? 0) * ds;
        }
      }
      // Symmetric within-slab attenuation does not privilege a front or back camera.
      // This local exponential display approximation is deliberately NOT Galaxio's final HDR display pass.
      const red = display(1 - Math.exp(-exposure * emission[0] * Math.exp(-tau[0] / 2)));
      const green = display(1 - Math.exp(-exposure * emission[1] * Math.exp(-tau[1] / 2)));
      const blue = display(1 - Math.exp(-exposure * emission[2] * Math.exp(-tau[2] / 2)));
      const greyDustOpacity = 1 - Math.exp(-(tau[0] * 0.2126 + tau[1] * 0.7152 + tau[2] * 0.0722));
      // Straight-alpha RGB×A equals this slab's display emission on black.
      // Emission requires nonzero ordinary alpha; that introduces extra inter-slab attenuation.
      const alpha = Math.max(red, green, blue, greyDustOpacity);
      const offset = 4 * (row * width + column);
      if (alpha > 0) {
        pixels[offset] = Math.round(clamp(red / alpha) * 255);
        pixels[offset + 1] = Math.round(clamp(green / alpha) * 255);
        pixels[offset + 2] = Math.round(clamp(blue / alpha) * 255);
        pixels[offset + 3] = Math.round(clamp(alpha) * 255);
        if (pixels[offset + 3]) nonzero++;
      }
    }
  }
  return { rgba: pixels, alphaCoverage: nonzero / (width * height) };
}
export async function prepareVolumeSlices(options: VolumeSliceOptions): Promise<VolumeSliceResult> {
  const baseCount = options.slicesPerAxis ?? 32, radius = options.radiusUnits ?? 10;
  const width = options.imageWidth ?? 512, samples = options.samplesPerSlab ?? 4;
  const opticalWeight = options.axisOpticalWeight ?? 1, exposure = options.exposureGain ?? 128;
  const counts: Record<SliceAxis, number> = { x: options.sliceCounts?.x ?? baseCount * 4,
    y: options.sliceCounts?.y ?? baseCount * 4, z: options.sliceCounts?.z ?? baseCount };
  if (Object.values(counts).some(count => !Number.isInteger(count) || count < 2) || !Number.isInteger(width) || width < 8 || width % 8 ||
    !Number.isInteger(samples) || samples < 1 || !(radius > 0) || !(opticalWeight > 0) || !(exposure > 0)) {
    throw new Error('Invalid volume preparation dimensions or material settings');
  }
  const transfer = options.transfer ?? 'integrated-opacity';
  const source = await loadVolumeSource({ galaxioRoot: options.galaxioRoot });
  const bulge = prepareBulgeDensity(source.model.components.bulge);
  const quads: VolumeSliceQuad[] = [];
  const axes: SliceAxis[] = ['x', 'y', 'z'];
  for (const axis of axes) {
    const count = counts[axis];
    const halfDepth = axis === 'z' ? 0.125 : 1, halfHeight = axis === 'z' ? 1 : 0.125;
    const height = axis === 'z' ? width : width / 8;
    const slabWidth = 2 * halfDepth / count;
    await mkdir(path.join(options.outputDirectory, 'slices', axis), { recursive: true });
    for (let index = 0; index < count; index++) {
      const depth = -halfDepth + (index + 0.5) * slabWidth;
      const baked = bakeSlab({ source, axis, depth, slabWidth, width, height, samples, opticalWeight, exposure, transfer, bulge });
      const texturePath = `slices/${axis}/${String(index).padStart(2, '0')}.png`;
      const target = path.join(options.outputDirectory, texturePath);
      // Preserve every nonzero texel, but do not ask the compositor to carry its empty border.
      // Crop coordinates are mapped back into physical coordinates: imagery never stretches.
      let left = 0, top = 0, right = width - 1, bottom = height - 1;
      if (options.cropTransparent ?? true) {
        left = width; top = height; right = -1; bottom = -1;
        for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
          if (baked.rgba[4 * (row * width + column) + 3]) {
            left = Math.min(left, column); right = Math.max(right, column);
            top = Math.min(top, row); bottom = Math.max(bottom, row);
          }
        }
        if (right < left) { left = right = Math.floor(width / 2); top = bottom = Math.floor(height / 2); }
      }
      const croppedWidth = right - left + 1, croppedHeight = bottom - top + 1;
      await sharp(baked.rgba, { raw: { width, height, channels: 4 } })
        .extract({ left, top, width: croppedWidth, height: croppedHeight }).png().toFile(target);
      const uMin = 2 * left / width - 1, uMax = 2 * (right + 1) / width - 1;
      const vMax = halfHeight * (1 - 2 * top / height), vMin = halfHeight * (1 - 2 * (bottom + 1) / height);
      const vertices: [Vector3, Vector3, Vector3, Vector3] = [point(axis, depth, uMin, vMax),
        point(axis, depth, uMax, vMax), point(axis, depth, uMax, vMin), point(axis, depth, uMin, vMin)];
      for (const vertex of vertices) for (let i = 0; i < 3; i++) vertex[i] = (vertex[i] ?? 0) * radius;
      const center = point(axis, depth * radius, (uMin + uMax) * radius / 2, (vMin + vMax) * radius / 2);
      // Image rows progress downward: X normal -X, Y normal +Y, Z normal -Z.
      const normal: Vector3 = axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, -1];
      quads.push({ id: `${axis}-${index}`, axis, sliceIndex: index, texturePath, widthPx: croppedWidth, heightPx: croppedHeight,
        vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center, normal,
        sha256: createHash('sha256').update(await readFile(target)).digest('hex'), alphaCoverage: baked.alphaCoverage * width * height / (croppedWidth * croppedHeight) });
    }
    console.log(`Prepared ${count} ${axis.toUpperCase()} density slabs (${width}×${height})`);
  }
  for (const axis of axes) if (!quads.some(quad => quad.axis === axis && quad.alphaCoverage > 0.01)) {
    throw new Error(`Empty ${axis} slice stack`);
  }
  const result: VolumeSliceResult = { quads, source: source.provenance, radiusUnits: radius,
    solarPositionUnits: [source.solarPositionLocal[0] * radius, source.solarPositionLocal[1] * radius, source.solarPositionLocal[2] * radius],
    localBounds: { x: [-1, 1], y: [-1, 1], z: [-0.125, 0.125] }, approximation: {
      method: 'Real filtered density fields; squared after sampling; slab-integrated emission and dust; symmetric attenuation; exponential energy in ordinary alpha. Default avoids per-slab sRGB encoding before compositing.',
      bulge: 'Numerical Abel inversion of Galaxio projected radial profile into ellipsoidal emissivity; face-on normalization; smooth taper to zero across the outer40% of the thin vertical bounds.',
      limitations: ['No volume-shader parity: ordinary alpha cannot independently encode emitted light and wavelength-dependent extinction.',
        'Each axis stack carries full density: select one or blend independently projected images; never superimpose their raw dust layers. View angle still changes effective opacity and sampling.',
        'No camera-dependent near-field dust noise, native global display transform or exterior bulge distance modifier.',
        'The analytic bulge is a derived approximation; thin bounds omit its faint outer vertical extent.'],
      samplesPerSlab: samples, axisOpticalWeight: opticalWeight, exposureGain: exposure, transfer, sliceCounts: counts,
      slabPitchUnits: { x: 2 * radius / counts.x, y: 2 * radius / counts.y, z: 0.25 * radius / counts.z } } };
  await writeFile(path.join(options.outputDirectory, 'volume-slices.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`SUCCESS ${quads.length} textured physical quads from pinned density volume`);
  return result;
}

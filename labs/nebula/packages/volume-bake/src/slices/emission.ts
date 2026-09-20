/** Lab-only high-resolution optical masters, followed by offline delivery derivation. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { Axis, Bounds3, Vector3, VolumeImageEncoding } from '@cssearth/volume-core/contracts/volume-recipe';
import { readVolumeLayerPlan, type VolumeLayerPlan, type VolumeSlices, type VolumeSliceQuad } from '@cssearth/volume-core/contracts/volume-slices';
import { encodeVolumeRaster } from './raster.ts';
import { containedPath, sha256 } from '../compact-inputs/density-grid.ts';

export interface MasterDeliveryBank {
  width: number;
  outputDirectory: string;
  imageEncoding?: VolumeImageEncoding;
}
export interface MasterSliceProgress {
  phase: 'master' | 'delivery'; axis: Axis; sliceIndex: number;
  completed: number; total: number; width: number;
}
export interface MasterVolumeOptions {
  /** Synchronous optical RGB emissivity per kpc; must write all three channels. */
  sampleEmission(xKpc: number, yKpc: number, zKpc: number, out: Vector3): void;
  boundsKpc: Bounds3;
  sliceCounts: Record<Axis, number>;
  samplesPerSlab: number;
  /** Optional grouped reference cells; omitted preserves historical uniform bytes. */
  layerPlan?: VolumeLayerPlan;
  exposureGain: number;
  masterWidth: number;
  masterDirectory: string;
  deliveryBanks: readonly MasterDeliveryBank[];
  /** Changes geometry units only: optical integration always uses kpc. */
  unitsPerSourceUnit: number;
  provenance: unknown;
  /** Retain identical physical quads across material variants. */
  cropTransparent?: boolean;
  /** Interactive signed fields can cancel completely. Only applies when no delivery banks are requested. */
  allowEmpty?: boolean;
  onProgress?: (progress: MasterSliceProgress) => void;
}
const axes: Axis[] = ['x', 'y', 'z'];
const byte = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255);
export const MASTER_QUANTIZATION = 'optical-rgb-error-carry@1';
const positive = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be finite and positive.`);
};
function integer(value: number, name: string, maximum: number) {
  positive(value, name);
  if (!Number.isInteger(value) || value > maximum) throw new TypeError(`${name} must be an integer at most ${maximum}.`);
}
function dimensions(width: number, height: number) {
  integer(width, 'Raster width', 8192); integer(height, 'Raster height', 8192);
  if (width * height > 67_108_864) throw new TypeError('Raster exceeds the one-slab memory bound.');
}
function point(axis: Axis, d: number, u: number, v: number): Vector3 {
  return axis === 'x' ? [d, u, v] : axis === 'y' ? [u, d, v] : [u, v, d];
}
function report(callback: MasterVolumeOptions['onProgress'], progress: MasterSliceProgress) {
  if (progress.completed % 4 !== 0 && progress.completed !== progress.total) return;
  if (callback) callback(progress);
  else console.log(`PHOTO_MASTER_${progress.phase.toUpperCase()} ${progress.completed}/${progress.total} ` +
    `${progress.axis.toUpperCase()}-${progress.sliceIndex} ${progress.width}px`);
}
async function manifest(directory: string, slices: VolumeSlices) {
  await writeFile(resolve(directory, 'volume-slices.json'), JSON.stringify(slices, null, 2) + '\n');
}
function nonempty(slices: VolumeSlices) {
  for (const axis of axes) if (!slices.quads.some(quad => quad.axis === axis && quad.alphaCoverage > 0)) {
    throw new TypeError(`Empty ${axis} volume stack.`);
  }
}
function checkBanks(masterDirectory: string, banks: readonly MasterDeliveryBank[]) {
  const directories = new Set([resolve(masterDirectory)]);
  for (const bank of banks) {
    integer(bank.width, 'Delivery width', 8192);
    const directory = resolve(bank.outputDirectory);
    if (directories.has(directory)) throw new TypeError('Master and delivery directories must be distinct.');
    directories.add(directory);
    const encoding = bank.imageEncoding;
    if (encoding && encoding.format !== 'png' && encoding.format !== 'webp') throw new TypeError('Invalid delivery encoding.');
    if (encoding?.quality !== undefined) integer(encoding.quality, 'Image quality', 100);
  }
}

/** Direct field sampling, never an enlargement of a previously baked RGB grid. */
export async function bakeMasterVolumeSlices(options: MasterVolumeOptions): Promise<{
  masters: VolumeSlices; banks: { width: number; slices: VolumeSlices }[];
}> {
  const { boundsKpc: bounds, sliceCounts: counts, samplesPerSlab: samples, masterWidth: width } = options;
  if (bounds.min.length !== 3 || bounds.max.length !== 3 || bounds.min.some((v, i) =>
    !Number.isFinite(v) || !Number.isFinite(bounds.max[i]) || v >= bounds.max[i]!)) {
    throw new TypeError('Bounds must contain finite increasing XYZ intervals.');
  }
  integer(width, 'Master width', 8192); integer(samples, 'Samples per slab', 1024);
  positive(options.exposureGain, 'Exposure gain'); positive(options.unitsPerSourceUnit, 'Geometry scale');
  for (const axis of axes) integer(counts[axis], 'Slice count', 512);
  const layerPlan = options.layerPlan === undefined ? undefined : readVolumeLayerPlan(options.layerPlan);
  if (layerPlan && (samples !== layerPlan.referenceSamplesPerSlab || axes.some(axis => counts[axis] !== layerPlan.axes[axis].length)))
    throw new TypeError('Retained slice counts and reference samples must match the volume layer plan.');
  checkBanks(options.masterDirectory, options.deliveryBanks);
  for (const bank of options.deliveryBanks) if (bank.width > width) throw new TypeError('Delivery must not upscale the master.');
  const scale = options.unitsPerSourceUnit;
  const boundsUnits: Bounds3 = {
    min: bounds.min.map(v => v * scale) as Vector3, max: bounds.max.map(v => v * scale) as Vector3,
  };
  if (layerPlan && axes.some((axis, i) => !Number.isFinite(bounds.max[i]! - bounds.min[i]!) ||
      !Number.isFinite(boundsUnits.min[i]) || !Number.isFinite(boundsUnits.max[i]) ||
      !(boundsUnits.max[i]! > boundsUnits.min[i]!) ||
      !((bounds.max[i]! - bounds.min[i]!) / layerPlan.referenceSliceCounts[axis] / samples > 0)))
    throw new TypeError('Volume layer physical intervals and reference sample spacing must be finite and positive.');
  const masters: VolumeSlices = { quads: [], boundsUnits, provenance: options.provenance, approximation: {
    method: `Direct XYZ emissivity samples per kpc; shared exponential opacity and optical RGB ratios; lossless full-extent RGBA8 masters. Quantization: ${MASTER_QUANTIZATION}.`,
    radialEmission: 'Provided entirely by the authored emissivity sampler.',
    limitations: ['This is display emission, not calibrated photometry; extinction is unsupported.',
      'Shared opacity preserves column-constant chromaticity before RGBA8 quantization; varying chromaticity is a slab approximation.',
      'Higher master resolution improves in-plane sampling only. Finite samples along each slab depth can alias high-frequency photograph detail, especially in X/Y banks.',
      'Finite slabs, RGBA8 alpha and axis handoffs approximate a continuous volume.',
      'Optical RGB rounding residuals carry into the next emitting slab on each ray; true zero support remains transparent. Fully opaque byte255 resets its unrepresentable optical residual.'],
    samplesPerSlab: samples, opticalWeight: 1, exposureGain: options.exposureGain,
    emissionTransfer: 'shared-opacity', sliceCounts: { ...counts }, slabPitchUnits: { x: 0, y: 0, z: 0 },
  } };
  if (layerPlan) {
    masters.approximation.layerPlan = layerPlan;
    masters.approximation.method += ' Variable slabs merge contiguous reference cells without thinning depth quadrature.';
    masters.approximation.limitations.push('Nonuniform slab planes sit at interval midpoints; slabPitchUnits is the axis mean, samplesPerSlab is the reference-cell count. Each quad records its actual interval and sample count. Merging preserves reference quadrature, not continuous depth placement or axis-handoff accuracy.');
  }
  const total = counts.x + counts.y + counts.z;
  for (const axis of axes) {
    const axial = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const horizontal = axis === 'x' ? 1 : 0, vertical = axis === 'z' ? 1 : 2;
    const uMin = bounds.min[horizontal], uSpan = bounds.max[horizontal] - uMin;
    const vMax = bounds.max[vertical], vSpan = vMax - bounds.min[vertical];
    const height = Math.max(1, Math.round(width * vSpan / uSpan));
    dimensions(width, height);
    const pitch = (bounds.max[axial] - bounds.min[axial]) / counts[axis];
    const referencePitch = layerPlan ? (bounds.max[axial] - bounds.min[axial]) / layerPlan.referenceSliceCounts[axis] : pitch;
    const ds = referencePitch / samples;
    masters.approximation.slabPitchUnits[axis] = pitch * scale;
    await mkdir(resolve(options.masterDirectory, 'slices', axis), { recursive: true });
    const rgb: Vector3 = [0, 0, 0];
    const us = Float64Array.from({ length: width }, (_, col) => uMin + uSpan * (col + 0.5) / width);
    // Carry only RGBA8 rounding error, never a fitted column gain. Independent
    // RGB residuals also conserve faint hue when adjacent slabs differ in color.
    const opticalError = new Float64Array(width * height * 3);
    for (let index = 0; index < counts[axis]; index++) {
      const group = layerPlan?.axes[axis][index];
      const start = group ? bounds.min[axial] + group.startCell * referencePitch : 0;
      const end = group ? bounds.min[axial] + group.endCell * referencePitch : 0;
      if (group && (!(end > start) || !Number.isFinite(start) || !Number.isFinite(end) ||
          !(end * scale > start * scale))) throw new TypeError('Volume layer physical intervals must be finite and increasing.');
      const depth = group ? (start + end) / 2 : bounds.min[axial] + (index + 0.5) * pitch;
      const sampleCount = group ? (group.endCell - group.startCell) * samples : samples;
      const depths = Float64Array.from({ length: sampleCount }, (_, sample) => {
        if (!group) return depth + pitch * ((sample + 0.5) / samples - 0.5);
        const cell = group.startCell + Math.floor(sample / samples), sub = sample % samples;
        return bounds.min[axial] + (cell + 0.5) * referencePitch + referencePitch * ((sub + 0.5) / samples - 0.5);
      });
      const rgba = Buffer.alloc(width * height * 4);
      let nonzero = 0;
      for (let row = 0; row < height; row++) {
        const v = vMax - vSpan * (row + 0.5) / height;
        for (let col = 0; col < width; col++) {
          const u = us[col]!;
          let red = 0, green = 0, blue = 0;
          for (let sample = 0; sample < sampleCount; sample++) {
            const d = depths[sample]!;
            if (axis === 'x') options.sampleEmission(d, u, v, rgb);
            else if (axis === 'y') options.sampleEmission(u, d, v, rgb);
            else options.sampleEmission(u, v, d, rgb);
            if (!Number.isFinite(rgb[0]) || !Number.isFinite(rgb[1]) || !Number.isFinite(rgb[2]) ||
                rgb[0] < 0 || rgb[1] < 0 || rgb[2] < 0) throw new TypeError('Sampler must emit finite nonnegative optical RGB per kpc.');
            red += rgb[0] * ds; green += rgb[1] * ds; blue += rgb[2] * ds;
          }
          const peak = Math.max(red, green, blue), offset = 4 * (row * width + col);
          if (!Number.isFinite(peak)) throw new TypeError('Integrated optical emission overflowed.');
          if (peak > 0) {
            const errorOffset = 3 * (row * width + col);
            const targetRed = options.exposureGain * red + opticalError[errorOffset]!;
            const targetGreen = options.exposureGain * green + opticalError[errorOffset + 1]!;
            const targetBlue = options.exposureGain * blue + opticalError[errorOffset + 2]!;
            const correctedPeak = Math.max(0, targetRed, targetGreen, targetBlue);
            const alphaByte = byte(-Math.expm1(-correctedPeak));
            rgba[offset + 3] = alphaByte;
            if (rgba[offset + 3]) {
              rgba[offset] = byte(targetRed / correctedPeak);
              rgba[offset + 1] = byte(targetGreen / correctedPeak);
              rgba[offset + 2] = byte(targetBlue / correctedPeak);
              nonzero++;
            }
            // An opaque byte has infinite optical depth. It cannot support a
            // finite residual; its display error is already below half a byte.
            const encodedPeak = alphaByte === 255 ? 0 : -Math.log1p(-alphaByte / 255);
            opticalError[errorOffset] = alphaByte === 255 ? 0 : targetRed - encodedPeak * rgba[offset]! / 255;
            opticalError[errorOffset + 1] = alphaByte === 255 ? 0 : targetGreen - encodedPeak * rgba[offset + 1]! / 255;
            opticalError[errorOffset + 2] = alphaByte === 255 ? 0 : targetBlue - encodedPeak * rgba[offset + 2]! / 255;
          }
        }
      }
      const texturePath = `slices/${axis}/${String(index).padStart(2, '0')}.png`;
      const bytes = await encodeVolumeRaster({ rgba, width, height, crop: { left: 0, top: 0, width, height } });
      await writeFile(resolve(options.masterDirectory, texturePath), bytes);
      const vertices = [point(axis, depth, uMin, vMax), point(axis, depth, uMin + uSpan, vMax),
        point(axis, depth, uMin + uSpan, vMax - vSpan), point(axis, depth, uMin, vMax - vSpan)]
        .map(p => p.map(value => value * scale) as Vector3) as VolumeSliceQuad['vertices'];
      masters.quads.push({ id: `${axis}-${index}`, axis, sliceIndex: index, texturePath, widthPx: width, heightPx: height,
        vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        center: point(axis, depth * scale, (uMin + uSpan / 2) * scale, (vMax - vSpan / 2) * scale),
        normal: axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, -1],
        sha256: sha256(bytes), bytes: bytes.length, alphaCoverage: nonzero / (width * height),
        ...(group ? { slab: { start: start * scale, end: end * scale, samples: sampleCount, startCell: group.startCell, endCell: group.endCell } } : {}) });
      report(options.onProgress, { phase: 'master', axis, sliceIndex: index, completed: masters.quads.length, total, width });
    }
  }
  if (options.allowEmpty && options.deliveryBanks.length === 0 && masters.quads.every(quad => quad.alphaCoverage === 0)) {
    await manifest(options.masterDirectory, masters);
    return { masters, banks: [] };
  }
  nonempty(masters);
  await manifest(options.masterDirectory, masters);
  const banks = await deriveMasterVolumeSlices({ masters, masterDirectory: options.masterDirectory,
    deliveryBanks: options.deliveryBanks, cropTransparent: options.cropTransparent, onProgress: options.onProgress });
  return { masters, banks };
}

/** Box integration of premultiplied display RGB; invisible RGB cannot contaminate an edge. */
function areaDownsample(source: Buffer, sw: number, sh: number, width: number, height: number): Buffer {
  if (width === sw && height === sh) return source;
  const result = Buffer.alloc(width * height * 4), sx = sw / width, sy = sh / height;
  for (let y = 0; y < height; y++) {
    const top = y * sy, bottom = Math.min(sh, (y + 1) * sy);
    for (let x = 0; x < width; x++) {
      const left = x * sx, right = Math.min(sw, (x + 1) * sx);
      let red = 0, green = 0, blue = 0, alpha = 0;
      for (let yy = Math.floor(top); yy < Math.ceil(bottom); yy++) {
        const wy = Math.min(bottom, yy + 1) - Math.max(top, yy);
        for (let xx = Math.floor(left); xx < Math.ceil(right); xx++) {
          const area = wy * (Math.min(right, xx + 1) - Math.max(left, xx));
          const at = 4 * (yy * sw + xx), weight = source[at + 3]! * area;
          alpha += weight;
          red += source[at]! * weight; green += source[at + 1]! * weight; blue += source[at + 2]! * weight;
        }
      }
      const at = 4 * (y * width + x);
      result[at + 3] = Math.round(alpha / (sx * sy));
      if (result[at + 3] && alpha > 0) {
        result[at] = Math.round(red / alpha); result[at + 1] = Math.round(green / alpha); result[at + 2] = Math.round(blue / alpha);
      }
    }
  }
  return result;
}
function cropBounds(rgba: Buffer, width: number, height: number, crop: boolean) {
  let left = width, top = height, right = -1, bottom = -1, nonzero = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[4 * (y * width + x) + 3]) {
    nonzero++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (!crop) { left = top = 0; right = width - 1; bottom = height - 1; }
  else if (!nonzero) { left = right = Math.floor(width / 2); top = bottom = Math.floor(height / 2); }
  return { left, top, width: right - left + 1, height: bottom - top + 1, nonzero };
}
function physicalPoint(quad: VolumeSliceQuad, u: number, v: number): Vector3 {
  return quad.vertices[0].map((a, i) => a + u * (quad.vertices[1][i]! - a) +
    v * (quad.vertices[3][i]! - a)) as Vector3;
}

/** Re-derive delivery banks from verified lossless PNG bytes without calling the field sampler. */
export async function deriveMasterVolumeSlices(options: {
  masters: VolumeSlices; masterDirectory: string; deliveryBanks: readonly MasterDeliveryBank[];
  cropTransparent?: boolean; onProgress?: MasterVolumeOptions['onProgress'];
}): Promise<{ width: number; slices: VolumeSlices }[]> {
  checkBanks(options.masterDirectory, options.deliveryBanks);
  nonempty(options.masters);
  const banks = options.deliveryBanks.map(bank => ({ width: bank.width, slices: {
    ...options.masters, quads: [], approximation: { ...options.masters.approximation,
      method: options.masters.approximation.method + ' Delivery textures are area-downsampled from those PNG bytes in premultiplied display RGB, then unpremultiplied, cropped and encoded.',
      limitations: [...options.masters.approximation.limitations, 'Delivery downsampling averages already quantized slab coverage; lossy WebP changes RGB while alpha encoding is lossless.'],
    },
  } as VolumeSlices }));
  for (const bank of options.deliveryBanks) for (const axis of axes) {
    await mkdir(resolve(bank.outputDirectory, 'slices', axis), { recursive: true });
  }
  for (const [index, quad] of options.masters.quads.entries()) {
    const bytes = await readFile(containedPath(options.masterDirectory, quad.texturePath));
    if (bytes.length !== quad.bytes || sha256(bytes) !== quad.sha256) throw new TypeError(`Master bytes changed: ${quad.texturePath}.`);
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== 'png' || metadata.width !== quad.widthPx || metadata.height !== quad.heightPx || !metadata.hasAlpha) {
      throw new TypeError(`Master must be a lossless RGBA PNG with matching dimensions: ${quad.texturePath}.`);
    }
    dimensions(quad.widthPx, quad.heightPx);
    const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
    if (rgba.length !== quad.widthPx * quad.heightPx * 4) throw new TypeError('Master must decode to RGBA8.');
    const uSpan = Math.hypot(...quad.vertices[1].map((v, i) => v - quad.vertices[0][i]!));
    const vSpan = Math.hypot(...quad.vertices[3].map((v, i) => v - quad.vertices[0][i]!));
    positive(uSpan, 'Master horizontal extent'); positive(vSpan, 'Master vertical extent');
    for (const [bankIndex, bank] of options.deliveryBanks.entries()) {
      const width = bank.width, height = Math.max(1, Math.round(width * vSpan / uSpan));
      dimensions(width, height);
      if (width > quad.widthPx || height > quad.heightPx) throw new TypeError('Delivery must not upscale the master.');
      const downsampled = areaDownsample(rgba, quad.widthPx, quad.heightPx, width, height);
      const crop = cropBounds(downsampled, width, height, options.cropTransparent ?? true);
      const encoding = bank.imageEncoding ?? { format: 'webp' as const, quality: 90 };
      const encoded = await encodeVolumeRaster({ rgba: downsampled, width, height, crop, encoding });
      const texturePath = `slices/${quad.axis}/${String(quad.sliceIndex).padStart(2, '0')}.${encoding.format}`;
      await writeFile(resolve(bank.outputDirectory, texturePath), encoded);
      const u0 = crop.left / width, u1 = (crop.left + crop.width) / width;
      const v0 = crop.top / height, v1 = (crop.top + crop.height) / height;
      const vertices: VolumeSliceQuad['vertices'] = [physicalPoint(quad, u0, v0), physicalPoint(quad, u1, v0),
        physicalPoint(quad, u1, v1), physicalPoint(quad, u0, v1)];
      banks[bankIndex]!.slices.quads.push({ ...quad, texturePath, widthPx: crop.width, heightPx: crop.height,
        vertices, center: physicalPoint(quad, (u0 + u1) / 2, (v0 + v1) / 2),
        bytes: encoded.length, sha256: sha256(encoded), alphaCoverage: crop.nonzero / (crop.width * crop.height) });
      report(options.onProgress, { phase: 'delivery', axis: quad.axis, sliceIndex: quad.sliceIndex,
        completed: index + 1, total: options.masters.quads.length, width });
    }
  }
  for (const [index, bank] of banks.entries()) {
    nonempty(bank.slices);
    await manifest(options.deliveryBanks[index]!.outputDirectory, bank.slices);
  }
  return banks;
}

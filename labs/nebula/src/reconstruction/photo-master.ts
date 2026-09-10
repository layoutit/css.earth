/** Factorized high-resolution photograph + coarse simulated-depth emission sampler. */
import sharp from 'sharp';
import type { PhotoEmissionImage, PhotoEmissionOptions } from './photo-emission.js';

type Vec3 = [number, number, number];
type DetailOptions = NonNullable<PhotoEmissionOptions['detail']>;

export interface PhotoMasterOptions {
  density: Float64Array<ArrayBufferLike> | Float32Array<ArrayBufferLike>;
  dimensions: Vec3;
  boundsKpc: { min: Vec3; max: Vec3 };
  photo: PhotoEmissionImage;
  projection: PhotoEmissionOptions['projection'];
  edgeFeatherFraction?: number;
  columnDensityFloorFraction?: number;
  columnDensityFullSignalFraction?: number;
  exposureGain?: number;
  maxDisplaySignal?: number;
  detail?: DetailOptions;
  onProgress?: (message: string) => void;
}

export interface PhotoMasterDiagnostics {
  dimensions: Vec3;
  photoDimensions: [number, number];
  occupiedColumns: number;
  peakColumnMass: number;
  voxelDepthKpc: number;
  edgeFeatherFraction: number;
  columnDensityFloorFraction: number;
  columnDensityFullSignalFraction: number;
  exposureGain: number;
  maxDisplaySignal: number;
  detail?: DetailOptions & { blurSigmaPixels: number; narrowColumns: number };
  interpretation: string;
}

export interface PhotoMasterEmissionSampler {
  /** Allocation-free optical RGB emissivity per kpc. */
  sample(xKpc: number, yKpc: number, zKpc: number, out: Vec3): void;
  diagnostics: PhotoMasterDiagnostics;
  depthFields: { broadPerKpc: Float32Array<ArrayBuffer>; narrowPerKpc?: Float32Array<ArrayBuffer> };
}

const clamp = (value: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, value));
const smoothstep = (value: number): number => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function validateTriple(value: Vec3, name: string): void {
  if (value.length !== 3 || value.some(entry => !Number.isFinite(entry))) {
    throw new TypeError(`${name} must contain three finite values.`);
  }
}

async function decodePhoto(photo: PhotoEmissionImage): Promise<{
  rgba: Uint8Array;
  width: number;
  height: number;
}> {
  if ('rgba' in photo) {
    if (!Number.isInteger(photo.width) || photo.width < 1 ||
        !Number.isInteger(photo.height) || photo.height < 1 ||
        photo.rgba.length !== photo.width * photo.height * 4) {
      throw new TypeError('Decoded photo must be a nonempty RGBA8 raster of the declared size.');
    }
    return photo;
  }
  if (!photo.bytes.length) throw new TypeError('Encoded photo bytes must not be empty.');
  const decoded = await sharp(photo.bytes).rotate().ensureAlpha().toColourspace('srgb').raw()
    .toBuffer({ resolveWithObject: true });
  if (decoded.info.channels !== 4) throw new TypeError('Photo decoder must produce RGBA8.');
  return { rgba: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function gaussianBlurCoarse(
  source: Float64Array,
  width: number,
  height: number,
  sigmaX: number,
  sigmaY: number,
): Float64Array {
  let current = source;
  for (const [axis, sigma] of [[0, sigmaX], [1, sigmaY]] as const) {
    const radius = Math.max(1, Math.ceil(3 * sigma));
    const kernel = Array.from({ length: 2 * radius + 1 }, (_, offset) =>
      Math.exp(-0.5 * ((offset - radius) / sigma) ** 2));
    const output = new Float64Array(source.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let sum = 0;
      let weight = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sx = axis === 0 ? x + offset : x;
        const sy = axis === 1 ? y + offset : y;
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
        const kernelWeight = kernel[offset + radius]!;
        sum += current[sy * width + sx]! * kernelWeight;
        weight += kernelWeight;
      }
      output[y * width + x] = sum / weight;
    }
    current = output;
  }
  return current;
}

function bilinear(source: ArrayLike<number>, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  return (source[y0 * width + x0] ?? 0) * (1 - tx) * (1 - ty) +
    (source[y0 * width + x1] ?? 0) * tx * (1 - ty) +
    (source[y1 * width + x0] ?? 0) * (1 - tx) * ty +
    (source[y1 * width + x1] ?? 0) * tx * ty;
}

function trilinear(
  source: ArrayLike<number>,
  dimensions: Vec3,
  x: number,
  y: number,
  z: number,
): number {
  const [width, height, depth] = dimensions;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const z1 = Math.min(depth - 1, z0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const tz = z - z0;
  const row00 = (z0 * height + y0) * width;
  const row01 = (z0 * height + y1) * width;
  const row10 = (z1 * height + y0) * width;
  const row11 = (z1 * height + y1) * width;
  const lower = ((source[row00 + x0] ?? 0) * (1 - tx) + (source[row00 + x1] ?? 0) * tx) * (1 - ty) +
    ((source[row01 + x0] ?? 0) * (1 - tx) + (source[row01 + x1] ?? 0) * tx) * ty;
  const upper = ((source[row10 + x0] ?? 0) * (1 - tx) + (source[row10 + x1] ?? 0) * tx) * (1 - ty) +
    ((source[row11 + x0] ?? 0) * (1 - tx) + (source[row11 + x1] ?? 0) * tx) * ty;
  return lower * (1 - tz) + upper * tz;
}

export async function createPhotoMasterEmissionSampler(
  options: PhotoMasterOptions,
): Promise<PhotoMasterEmissionSampler> {
  validateTriple(options.dimensions, 'dimensions');
  validateTriple(options.boundsKpc.min, 'bounds min');
  validateTriple(options.boundsKpc.max, 'bounds max');
  const [width, height, depth] = options.dimensions;
  const voxelCount = width * height * depth;
  if (options.dimensions.some(value => !Number.isInteger(value) || value < 1 || value > 512) ||
      voxelCount > 8_388_608 || options.density.length !== voxelCount) {
    throw new TypeError('Density must match dimensions of at most 8,388,608 voxels.');
  }
  if (options.boundsKpc.min.some((value, axis) => value >= options.boundsKpc.max[axis]!)) {
    throw new TypeError('Bounds must strictly increase.');
  }
  if (options.density.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Density must contain finite nonnegative values.');
  }
  if (options.projection.centerKpc.some(value => !Number.isFinite(value)) ||
      options.projection.spanKpc.some(value => !Number.isFinite(value) || value <= 0) ||
      !Number.isFinite(options.projection.rotationDeg ?? 0)) {
    throw new TypeError('Photo projection must have finite centre, positive span and finite rotation.');
  }
  const edgeFeather = options.edgeFeatherFraction ?? 0.08;
  const densityFloor = options.columnDensityFloorFraction ?? 0.001;
  const densityFull = options.columnDensityFullSignalFraction ?? 0.01;
  const exposureGain = options.exposureGain ?? 1;
  const maxDisplaySignal = options.maxDisplaySignal ?? 0.98;
  if (!(edgeFeather >= 0 && edgeFeather <= .25) || !(densityFloor >= 0 && densityFloor <= .25) ||
      !(densityFull > densityFloor && densityFull <= .5) || !(exposureGain > 0) ||
      !(maxDisplaySignal > 0 && maxDisplaySignal < 1)) {
    throw new TypeError('Invalid photo emission transfer or gate options.');
  }
  const detail = options.detail;
  const zSpan = options.boundsKpc.max[2] - options.boundsKpc.min[2];
  if (detail && (!(detail.spatialSigmaKpc > 0) || !(detail.depthSigmaKpc > 0) ||
      detail.depthSigmaKpc > zSpan || !(detail.contrastStrength === undefined ||
        detail.contrastStrength > 0 && detail.contrastStrength <= 4))) {
    throw new TypeError('Invalid bounded detail options.');
  }

  options.onProgress?.('PHOTO_MASTER depth fields');
  const dz = zSpan / depth;
  const columnMass = new Float64Array(width * height);
  const support = new Uint8Array(width * height);
  const broad = new Float32Array(voxelCount);
  let peakColumnMass = 0;
  let occupiedColumns = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const column = y * width + x;
    let mass = 0;
    for (let z = 0; z < depth; z++) mass += options.density[(z * height + y) * width + x]!;
    columnMass[column] = mass;
    peakColumnMass = Math.max(peakColumnMass, mass);
    if (mass > 0) {
      support[column] = 1;
      occupiedColumns++;
      for (let z = 0; z < depth; z++) {
        const voxel = (z * height + y) * width + x;
        broad[voxel] = options.density[voxel]! / mass / dz;
      }
    }
  }
  if (!(peakColumnMass > 0)) throw new TypeError('Density has no positive column mass.');

  let narrow: Float32Array<ArrayBuffer> | undefined;
  let narrowSupport: Uint8Array | undefined;
  let narrowColumns = 0;
  if (detail) {
    const cellX = (options.boundsKpc.max[0] - options.boundsKpc.min[0]) / width;
    const cellY = (options.boundsKpc.max[1] - options.boundsKpc.min[1]) / height;
    const sigmaX = detail.spatialSigmaKpc / cellX;
    const sigmaY = detail.spatialSigmaKpc / cellY;
    if (sigmaX > 64 || sigmaY > 64) throw new TypeError('Detail blur is limited to 64 coarse cells per axis.');
    const moment = new Float64Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let value = 0;
      for (let z = 0; z < depth; z++) {
        const zKpc = options.boundsKpc.min[2] + (z + .5) * dz;
        value += options.density[(z * height + y) * width + x]! * zKpc;
      }
      moment[y * width + x] = value;
    }
    const smoothMass = gaussianBlurCoarse(columnMass, width, height, sigmaX, sigmaY);
    const smoothMoment = gaussianBlurCoarse(moment, width, height, sigmaX, sigmaY);
    narrow = new Float32Array(voxelCount);
    narrowSupport = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const column = y * width + x;
      if (!(columnMass[column]! > 0) || !(smoothMass[column]! > 0)) continue;
      const mean = smoothMoment[column]! / smoothMass[column]!;
      let sum = 0;
      for (let z = 0; z < depth; z++) {
        const voxel = (z * height + y) * width + x;
        const zKpc = options.boundsKpc.min[2] + (z + .5) * dz;
        const value = options.density[voxel]! * Math.exp(-.5 * ((zKpc - mean) / detail.depthSigmaKpc) ** 2);
        narrow[voxel] = value;
        sum += value;
      }
      if (sum > 0) {
        narrowSupport[column] = 1;
        narrowColumns++;
        for (let z = 0; z < depth; z++) {
          const voxel = (z * height + y) * width + x;
          narrow[voxel] /= sum * dz;
        }
      }
    }
  }

  options.onProgress?.('PHOTO_MASTER full-resolution photo');
  const photo = await decodePhoto(options.photo);
  let blurredLuminance: Uint8Array | undefined;
  let blurSigmaPixels = 0;
  if (detail) {
    const pixelScaleX = options.projection.spanKpc[0] / Math.max(1, photo.width - 1);
    const pixelScaleY = options.projection.spanKpc[1] / Math.max(1, photo.height - 1);
    blurSigmaPixels = detail.spatialSigmaKpc / Math.sqrt(pixelScaleX * pixelScaleY);
    if (blurSigmaPixels < .3 || blurSigmaPixels > 1000) {
      throw new TypeError('Detail spatial scale must resolve to a 0.3–1000 pixel photo blur.');
    }
    const luma = Buffer.allocUnsafe(photo.width * photo.height);
    for (let pixel = 0; pixel < luma.length; pixel++) {
      const offset = 4 * pixel;
      const alpha = photo.rgba[offset + 3]! / 255;
      luma[pixel] = Math.round(alpha * (0.2126 * photo.rgba[offset]! +
        0.7152 * photo.rgba[offset + 1]! + 0.0722 * photo.rgba[offset + 2]!));
    }
    const blurred = await sharp(luma, { raw: { width: photo.width, height: photo.height, channels: 1 } })
      .blur(blurSigmaPixels).greyscale().toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
    if (blurred.info.channels !== 1 || blurred.data.length !== luma.length) {
      throw new TypeError('Detail blur must remain single-channel.');
    }
    blurredLuminance = blurred.data;
  }

  const radians = (options.projection.rotationDeg ?? 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const xScale = width / (options.boundsKpc.max[0] - options.boundsKpc.min[0]);
  const yScale = height / (options.boundsKpc.max[1] - options.boundsKpc.min[1]);
  const zScale = depth / zSpan;
  const sample = (xKpc: number, yKpc: number, zKpc: number, out: Vec3): void => {
    out[0] = out[1] = out[2] = 0;
    if (!Number.isFinite(xKpc) || !Number.isFinite(yKpc) || !Number.isFinite(zKpc) ||
        xKpc < options.boundsKpc.min[0] ||
        xKpc > options.boundsKpc.max[0] || yKpc < options.boundsKpc.min[1] ||
        yKpc > options.boundsKpc.max[1] || zKpc < options.boundsKpc.min[2] || zKpc > options.boundsKpc.max[2]) return;
    const gx = clamp((xKpc - options.boundsKpc.min[0]) * xScale - .5, 0, width - 1);
    const gy = clamp((yKpc - options.boundsKpc.min[1]) * yScale - .5, 0, height - 1);
    const gz = clamp((zKpc - options.boundsKpc.min[2]) * zScale - .5, 0, depth - 1);
    const dx = xKpc - options.projection.centerKpc[0];
    const dy = yKpc - options.projection.centerKpc[1];
    let u = .5 + (cosine * dx + sine * dy) / options.projection.spanKpc[0];
    let v = .5 - (-sine * dx + cosine * dy) / options.projection.spanKpc[1];
    if (options.projection.flipX) u = 1 - u;
    if (options.projection.flipY) v = 1 - v;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const px = u * (photo.width - 1);
    const py = v * (photo.height - 1);
    const mass = bilinear(columnMass, width, height, gx, gy);
    const densityGate = smoothstep((mass / peakColumnMass - densityFloor) / (densityFull - densityFloor));
    const boundary = Math.min(u, 1 - u, v, 1 - v);
    const edgeGate = edgeFeather === 0 ? 1 : smoothstep(boundary / edgeFeather);
    if (!(densityGate > 0) || !(edgeGate > 0)) return;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = Math.min(photo.width - 1, x0 + 1);
    const y1 = Math.min(photo.height - 1, y0 + 1);
    const tx = px - x0;
    const ty = py - y0;
    const offset00 = 4 * (y0 * photo.width + x0);
    const offset10 = 4 * (y0 * photo.width + x1);
    const offset01 = 4 * (y1 * photo.width + x0);
    const offset11 = 4 * (y1 * photo.width + x1);
    const weight00 = (1 - tx) * (1 - ty) * photo.rgba[offset00 + 3]! / (255 * 255);
    const weight10 = tx * (1 - ty) * photo.rgba[offset10 + 3]! / (255 * 255);
    const weight01 = (1 - tx) * ty * photo.rgba[offset01 + 3]! / (255 * 255);
    const weight11 = tx * ty * photo.rgba[offset11 + 3]! / (255 * 255);
    const transfer = edgeGate * densityGate;
    const red = (photo.rgba[offset00]! * weight00 + photo.rgba[offset10]! * weight10 +
      photo.rgba[offset01]! * weight01 + photo.rgba[offset11]! * weight11) * transfer;
    const green = (photo.rgba[offset00 + 1]! * weight00 + photo.rgba[offset10 + 1]! * weight10 +
      photo.rgba[offset01 + 1]! * weight01 + photo.rgba[offset11 + 1]! * weight11) * transfer;
    const blue = (photo.rgba[offset00 + 2]! * weight00 + photo.rgba[offset10 + 2]! * weight10 +
      photo.rgba[offset01 + 2]! * weight01 + photo.rgba[offset11 + 2]! * weight11) * transfer;
    const peak = Math.max(red, green, blue);
    if (!(peak > 0)) return;
    const supportWeight = bilinear(support, width, height, gx, gy);
    if (!(supportWeight > 0)) return;
    const broadValue = trilinear(broad, options.dimensions, gx, gy, gz) / supportWeight;
    let detailFraction = 0;
    let narrowValue = broadValue;
    if (detail && blurredLuminance && narrow && narrowSupport) {
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const blurred = bilinear(blurredLuminance, photo.width, photo.height, px, py) / 255 *
        edgeGate * densityGate;
      detailFraction = Math.min(1, (detail.contrastStrength ?? 1) * Math.max(0, luma - blurred) /
        Math.max(luma, 1e-12));
      const narrowWeight = bilinear(narrowSupport, width, height, gx, gy);
      if (narrowWeight > 0) narrowValue = trilinear(narrow, options.dimensions, gx, gy, gz) / narrowWeight;
      else detailFraction = 0;
    }
    const profile = (1 - detailFraction) * broadValue + detailFraction * narrowValue;
    const peakOptical = -Math.log(1 - Math.min(maxDisplaySignal, peak)) / exposureGain;
    out[0] = peakOptical * red / peak * profile;
    out[1] = peakOptical * green / peak * profile;
    out[2] = peakOptical * blue / peak * profile;
  };

  options.onProgress?.('PHOTO_MASTER ready');
  return {
    sample,
    diagnostics: {
      dimensions: [...options.dimensions],
      photoDimensions: [photo.width, photo.height],
      occupiedColumns,
      peakColumnMass,
      voxelDepthKpc: dz,
      edgeFeatherFraction: edgeFeather,
      columnDensityFloorFraction: densityFloor,
      columnDensityFullSignalFraction: densityFull,
      exposureGain,
      maxDisplaySignal,
      ...(detail ? { detail: { ...detail, contrastStrength: detail.contrastStrength ?? 1,
        blurSigmaPixels, narrowColumns } } : {}),
      interpretation: 'Full-resolution photographed display RGB constrained by coarse simulated conditional depth; no measured dust or per-source distance.',
    },
    depthFields: { broadPerKpc: broad, ...(narrow ? { narrowPerKpc: narrow } : {}) },
  };
}

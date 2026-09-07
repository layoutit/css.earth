/** Offline projection of an extracted photograph through a simulated density field. */
import sharp from 'sharp';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

export type PhotoEmissionImage =
  | { rgba: Uint8Array; width: number; height: number }
  | { bytes: Uint8Array };

export interface PhotoEmissionOptions {
  density: Float64Array<ArrayBufferLike>;
  dimensions: Vec3;
  boundsKpc: { min: Vec3; max: Vec3 };
  photo: PhotoEmissionImage;
  projection: {
    /** XY location at the centre of the image. */
    centerKpc: Vec2;
    /** Physical image width and height. */
    spanKpc: Vec2;
    /** Counter-clockwise rotation of image-right from grid +X. */
    rotationDeg?: number;
    flipX?: boolean;
    flipY?: boolean;
  };
  /** Photo edges fade over this fraction of each image dimension. */
  edgeFeatherFraction?: number;
  /** Column-mass gate starts and reaches full signal at these fractions of peak column mass. */
  columnDensityFloorFraction?: number;
  columnDensityFullSignalFraction?: number;
  /** Display transfer used by the volume baker. */
  exposureGain?: number;
  /** Upper bound before inverse exponential transfer. */
  maxDisplaySignal?: number;
  /** Optional positive-detail concentration; omitted keeps the full conditional depth profile. */
  detail?: {
    /** Gaussian scale for separating local image contrast and smoothing the conditional mean depth. */
    spatialSigmaKpc: number;
    /** Authored display thickness of compact detail around the conditional mean. */
    depthSigmaKpc: number;
    contrastStrength?: number;
  };
}

export interface PhotoEmissionDiagnostics {
  constrainedColumns: number;
  zeroDensityPhotoColumns: number;
  zeroPhotoColumns: number;
  sampledPhotoRgbSum: Vec3;
  constrainedDisplayRgbSum: Vec3;
  emittedOpticalRgbSum: Vec3;
  maxColumnOpticalError: number;
  maximumEmissionPerKpc: number;
  recommendedEncodingScale: number;
  voxelDepthKpc: number;
  edgeFeatherFraction: number;
  columnDensityFloorFraction: number;
  columnDensityFullSignalFraction: number;
  exposureGain: number;
  maxDisplaySignal: number;
  detail?: {
    spatialSigmaKpc: number;
    depthSigmaKpc: number;
    contrastStrength: number;
    activeColumns: number;
    opticalFraction: number;
  };
}

export interface PhotoEmissionResult {
  /** RGB-interleaved emissivity per kpc, in the density grid's voxel order. */
  emissionPerKpc: Float32Array<ArrayBuffer>;
  diagnostics: PhotoEmissionDiagnostics;
}

const smoothstep = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function validateTriple(value: Vec3, name: string): void {
  if (value.length !== 3 || value.some(entry => !Number.isFinite(entry))) {
    throw new TypeError(`${name} must contain three finite values.`);
  }
}

function boundedFraction(value: number, name: string, maximum: number): void {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be from zero through ${maximum}.`);
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
  if (photo.bytes.length === 0) throw new TypeError('Encoded photo bytes must not be empty.');
  const decoded = await sharp(photo.bytes)
    .rotate()
    .ensureAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (decoded.info.channels !== 4) throw new TypeError('Photo decoder must produce RGBA8.');
  return { rgba: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function samplePremultiplied(
  photo: { rgba: Uint8Array; width: number; height: number },
  u: number,
  v: number,
): Vec3 {
  if (u < 0 || u > 1 || v < 0 || v > 1) return [0, 0, 0];
  const px = u * (photo.width - 1);
  const py = v * (photo.height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(photo.width - 1, x0 + 1);
  const y1 = Math.min(photo.height - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const result: Vec3 = [0, 0, 0];
  for (const [x, y, weight] of [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ] as const) {
    const offset = 4 * (y * photo.width + x);
    const alpha = photo.rgba[offset + 3]! / 255;
    for (let channel = 0; channel < 3; channel++) {
      result[channel] += weight * alpha * photo.rgba[offset + channel]! / 255;
    }
  }
  return result;
}

function gaussianBlur(
  source: Float64Array,
  width: number,
  height: number,
  sigmaX: number,
  sigmaY: number,
): Float64Array {
  let current = source;
  for (const [axis, sigma] of [[0, sigmaX], [1, sigmaY]] as const) {
    if (sigma <= 0) continue;
    const radius = Math.max(1, Math.ceil(3 * sigma));
    const kernel = Array.from({ length: 2 * radius + 1 }, (_, offset) =>
      Math.exp(-0.5 * ((offset - radius) / sigma) ** 2));
    const output = new Float64Array(source.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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
    }
    current = output;
  }
  return current;
}

/**
 * Makes the photo's premultiplied display RGB the face-on column integral while
 * retaining the simulated density as the conditional depth distribution.
 * This is an authored display constraint, not radiative transfer or measured dust.
 */
export async function bakePhotoConstrainedEmission(
  options: PhotoEmissionOptions,
): Promise<PhotoEmissionResult> {
  validateTriple(options.dimensions, 'dimensions');
  validateTriple(options.boundsKpc.min, 'bounds min');
  validateTriple(options.boundsKpc.max, 'bounds max');
  const [width, height, depth] = options.dimensions;
  if (options.dimensions.some(value => !Number.isInteger(value) || value < 1 || value > 512)) {
    throw new TypeError('Dimensions must be integers from one through 512.');
  }
  const voxelCount = width * height * depth;
  if (voxelCount > 8_388_608 || options.density.length !== voxelCount) {
    throw new TypeError('Density must match a grid of at most 8,388,608 voxels.');
  }
  if (options.boundsKpc.min.some((entry, axis) => entry >= options.boundsKpc.max[axis]!)) {
    throw new TypeError('Bounds must strictly increase.');
  }
  if (options.density.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Density must contain only finite nonnegative values.');
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
  boundedFraction(edgeFeather, 'edgeFeatherFraction', 0.25);
  boundedFraction(densityFloor, 'columnDensityFloorFraction', 0.25);
  boundedFraction(densityFull, 'columnDensityFullSignalFraction', 0.5);
  if (!(densityFull > densityFloor)) {
    throw new TypeError('columnDensityFullSignalFraction must exceed its floor.');
  }
  if (!Number.isFinite(exposureGain) || exposureGain <= 0) {
    throw new TypeError('exposureGain must be positive.');
  }
  if (!(maxDisplaySignal > 0 && maxDisplaySignal < 1)) {
    throw new TypeError('maxDisplaySignal must be in (0,1).');
  }
  const detail = options.detail;
  if (detail && (!(detail.spatialSigmaKpc > 0) || !Number.isFinite(detail.spatialSigmaKpc) ||
      !(detail.depthSigmaKpc > 0) || !Number.isFinite(detail.depthSigmaKpc) ||
      detail.depthSigmaKpc > options.boundsKpc.max[2] - options.boundsKpc.min[2] ||
      !(detail.contrastStrength === undefined ||
        (Number.isFinite(detail.contrastStrength) && detail.contrastStrength > 0 && detail.contrastStrength <= 4)))) {
    throw new TypeError('Detail scales must be positive and contrastStrength must be in (0,4].');
  }

  const photo = await decodePhoto(options.photo);
  const columnMass = new Float64Array(width * height);
  let peakColumnMass = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const column = y * width + x;
      let sum = 0;
      for (let z = 0; z < depth; z++) sum += options.density[(z * height + y) * width + x]!;
      columnMass[column] = sum;
      peakColumnMass = Math.max(peakColumnMass, sum);
    }
  }

  const emission = new Float32Array(voxelCount * 3);
  const photoTargets = new Float64Array(width * height * 3);
  const photoLuminance = new Float64Array(width * height);
  const sampledPhotoRgbSum: Vec3 = [0, 0, 0];
  const constrainedDisplayRgbSum: Vec3 = [0, 0, 0];
  const emittedOpticalRgbSum: Vec3 = [0, 0, 0];
  const dz = (options.boundsKpc.max[2] - options.boundsKpc.min[2]) / depth;
  const radians = (options.projection.rotationDeg ?? 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  let constrainedColumns = 0;
  let zeroDensityPhotoColumns = 0;
  let zeroPhotoColumns = 0;
  let maxColumnOpticalError = 0;
  let maximumEmissionPerKpc = 0;

  for (let y = 0; y < height; y++) {
    const worldY = options.boundsKpc.min[1] + (y + 0.5) / height *
      (options.boundsKpc.max[1] - options.boundsKpc.min[1]);
    for (let x = 0; x < width; x++) {
      const worldX = options.boundsKpc.min[0] + (x + 0.5) / width *
        (options.boundsKpc.max[0] - options.boundsKpc.min[0]);
      const dx = worldX - options.projection.centerKpc[0];
      const dy = worldY - options.projection.centerKpc[1];
      let u = 0.5 + (cosine * dx + sine * dy) / options.projection.spanKpc[0];
      let v = 0.5 - (-sine * dx + cosine * dy) / options.projection.spanKpc[1];
      if (options.projection.flipX) u = 1 - u;
      if (options.projection.flipY) v = 1 - v;
      const target = samplePremultiplied(photo, u, v);
      const boundaryDistance = Math.min(u, 1 - u, v, 1 - v);
      const edgeGate = edgeFeather === 0 ? 1 : smoothstep(boundaryDistance / edgeFeather);
      const column = y * width + x;
      for (let channel = 0; channel < 3; channel++) {
        target[channel] *= edgeGate;
        photoTargets[3 * column + channel] = target[channel]!;
        sampledPhotoRgbSum[channel] += target[channel]!;
      }
      photoLuminance[column] = 0.2126 * target[0]! + 0.7152 * target[1]! + 0.0722 * target[2]!;
      if (Math.max(...target) === 0) zeroPhotoColumns++;
    }
  }

  let blurredLuminance: Float64Array | undefined;
  let smoothedMass: Float64Array | undefined;
  let smoothedMoment: Float64Array | undefined;
  let detailActiveColumns = 0;
  let detailOptical = 0;
  let totalOptical = 0;
  if (detail) {
    const cellWidth = (options.boundsKpc.max[0] - options.boundsKpc.min[0]) / width;
    const cellHeight = (options.boundsKpc.max[1] - options.boundsKpc.min[1]) / height;
    const sigmaX = detail.spatialSigmaKpc / cellWidth;
    const sigmaY = detail.spatialSigmaKpc / cellHeight;
    if (sigmaX > 64 || sigmaY > 64) {
      throw new TypeError('Detail spatialSigmaKpc is limited to 64 grid cells per axis.');
    }
    blurredLuminance = gaussianBlur(photoLuminance, width, height, sigmaX, sigmaY);
    const moment = new Float64Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const column = y * width + x;
      let sum = 0;
      for (let z = 0; z < depth; z++) {
        const zKpc = options.boundsKpc.min[2] + (z + 0.5) * dz;
        sum += options.density[(z * height + y) * width + x]! * zKpc;
      }
      moment[column] = sum;
    }
    smoothedMass = gaussianBlur(columnMass, width, height, sigmaX, sigmaY);
    smoothedMoment = gaussianBlur(moment, width, height, sigmaX, sigmaY);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const column = y * width + x;
      const target: Vec3 = [
        photoTargets[3 * column]!,
        photoTargets[3 * column + 1]!,
        photoTargets[3 * column + 2]!,
      ];
      const targetPeak = Math.max(...target);
      const mass = columnMass[column]!;
      if (!(mass > 0) || !(peakColumnMass > 0)) {
        if (targetPeak > 0) zeroDensityPhotoColumns++;
        continue;
      }
      const massFraction = mass / peakColumnMass;
      const densityGate = smoothstep((massFraction - densityFloor) / (densityFull - densityFloor));
      if (densityGate === 0 || targetPeak === 0) continue;
      constrainedColumns++;
      const opticalTarget: Vec3 = [0, 0, 0];
      const displayPeak = Math.min(maxDisplaySignal, targetPeak * densityGate);
      const peakOptical = -Math.log(1 - displayPeak) / exposureGain;
      for (let channel = 0; channel < 3; channel++) {
        const display = target[channel]! * densityGate;
        constrainedDisplayRgbSum[channel] += display;
        opticalTarget[channel] = targetPeak > 0 ? peakOptical * target[channel]! / targetPeak : 0;
      }

      let detailFraction = 0;
      let narrowSum = 0;
      let meanZ = 0;
      if (detail && blurredLuminance && smoothedMass && smoothedMoment) {
        const localContrast = Math.max(0, photoLuminance[column]! - blurredLuminance[column]!);
        detailFraction = Math.min(1, (detail.contrastStrength ?? 1) * localContrast /
          Math.max(photoLuminance[column]!, 1e-12));
        if (detailFraction > 0 && smoothedMass[column]! > 0) {
          meanZ = smoothedMoment[column]! / smoothedMass[column]!;
          for (let z = 0; z < depth; z++) {
            const voxel = (z * height + y) * width + x;
            const zKpc = options.boundsKpc.min[2] + (z + 0.5) * dz;
            narrowSum += options.density[voxel]! *
              Math.exp(-0.5 * ((zKpc - meanZ) / detail.depthSigmaKpc) ** 2);
          }
          if (!(narrowSum > 0)) detailFraction = 0;
        } else {
          detailFraction = 0;
        }
        if (detailFraction > 0) detailActiveColumns++;
      }

      const accumulated: Vec3 = [0, 0, 0];
      for (let z = 0; z < depth; z++) {
        const voxel = (z * height + y) * width + x;
        const broadWeight = options.density[voxel]! / mass;
        const zKpc = options.boundsKpc.min[2] + (z + 0.5) * dz;
        const narrowWeight = narrowSum > 0 ? options.density[voxel]! *
          Math.exp(-0.5 * ((zKpc - meanZ) / detail!.depthSigmaKpc) ** 2) / narrowSum : broadWeight;
        const depthWeight = (1 - detailFraction) * broadWeight + detailFraction * narrowWeight;
        for (let channel = 0; channel < 3; channel++) {
          const value = opticalTarget[channel]! * depthWeight / dz;
          emission[3 * voxel + channel] = value;
          const stored = emission[3 * voxel + channel]!;
          accumulated[channel] += stored * dz;
          maximumEmissionPerKpc = Math.max(maximumEmissionPerKpc, stored);
        }
      }
      const columnOptical = Math.max(...opticalTarget);
      detailOptical += columnOptical * detailFraction;
      totalOptical += columnOptical;
      for (let channel = 0; channel < 3; channel++) {
        emittedOpticalRgbSum[channel] += accumulated[channel];
        maxColumnOpticalError = Math.max(
          maxColumnOpticalError,
          Math.abs(accumulated[channel]! - opticalTarget[channel]!),
        );
      }
    }
  }

  return {
    emissionPerKpc: emission,
    diagnostics: {
      constrainedColumns,
      zeroDensityPhotoColumns,
      zeroPhotoColumns,
      sampledPhotoRgbSum,
      constrainedDisplayRgbSum,
      emittedOpticalRgbSum,
      maxColumnOpticalError,
      maximumEmissionPerKpc,
      recommendedEncodingScale: Math.max(1, maximumEmissionPerKpc),
      voxelDepthKpc: dz,
      edgeFeatherFraction: edgeFeather,
      columnDensityFloorFraction: densityFloor,
      columnDensityFullSignalFraction: densityFull,
      exposureGain,
      maxDisplaySignal,
      ...(detail ? { detail: {
        spatialSigmaKpc: detail.spatialSigmaKpc,
        depthSigmaKpc: detail.depthSigmaKpc,
        contrastStrength: detail.contrastStrength ?? 1,
        activeColumns: detailActiveColumns,
        opticalFraction: totalOptical > 0 ? detailOptical / totalOptical : 0,
      } } : {}),
    },
  };
}

/** Generic offline conversion of xyz+mass particles into the existing RGBA8/Zstd KTX2 density source. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { bakePhotoConstrainedEmission } from '../methods/density-prior/photo-emission.ts';
import type { PhotoEmissionOptions, PhotoEmissionDiagnostics } from '../methods/density-prior/photo-emission.ts';

type Vec3 = [number, number, number];
type Bounds = { min: Vec3; max: Vec3 };
export type ParticlePhotoEmissionOptions = Pick<PhotoEmissionOptions,
  'edgeFeatherFraction' | 'columnDensityFloorFraction' | 'columnDensityFullSignalFraction' |
  'exposureGain' | 'maxDisplaySignal' | 'detail'>;

export interface ParticleColorConstraint {
  imagePath: string;
  centerKpc: Vec3;
  rightDirection: Vec3;
  upDirection: Vec3;
  spanKpc: [number, number];
  flipY?: boolean;
}
export interface ParticleVolumeOptions {
  particlePath: string;
  outputDirectory: string;
  dimensions: Vec3;
  boundsKpc: Bounds;
  smoothingSigmaVoxels: number;
  normalizationQuantile: number;
  encoding: 'sqrt-density-unorm8' | 'linear-density-unorm8';
  colorConstraint?: ParticleColorConstraint;
  photoEmission?: ParticlePhotoEmissionOptions;
  /** Optional ignored-cache export of the smoothed mass field for factorized master sampling. */
  densityOutputPath?: string;
  fallbackColor?: Vec3;
  zstdLevel?: number;
}
export interface ParticleVolumeReceipt {
  schema: 'cssearth-particle-volume-lab@1';
  input: { path: string; sha256: string; bytes: number; layout: 'float32-le-xyzmass-kpc' };
  options: {
    dimensions: Vec3; boundsKpc: Bounds; smoothingSigmaVoxels: number;
    normalizationQuantile: number; encoding: ParticleVolumeOptions['encoding'];
    fallbackColor: Vec3; zstdLevel: number;
    colorConstraint?: Omit<ParticleColorConstraint, 'imagePath'> & { imagePath: string; imageSha256: string };
    photoEmission?: ParticlePhotoEmissionOptions;
  };
  particles: { count: number; accepted: number; inputMass: number; acceptedMass: number; depositedMass: number };
  normalization: { quantile: number; densityAtUnit: number; encoding: ParticleVolumeOptions['encoding'] };
  diagnostics: { occupiedVoxels: number; axisVariation: Vec3 };
  outputs: { gridPath: string; gridSha256: string; decodedSha256: string; bytes: number };
  densityField?: { path: string; sha256: string; bytes: number;
    layout: 'float32-le-x-fastest-density'; dimensions: Vec3; boundsKpc: Bounds };
  interpretation: { density: string; color: string; dust: string };
  emission?: { mode: 'photo-constrained'; encodingScale: number; diagnostics: PhotoEmissionDiagnostics };
}

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function validVec(value: Vec3, name: string): void {
  if (value.length !== 3 || value.some(entry => !Number.isFinite(entry)))
    throw new TypeError(`${name} must contain three finite values.`);
}
function norm(value: Vec3): Vec3 {
  const length = Math.hypot(...value);
  if (!(length > 0)) throw new TypeError('Projection directions must be nonzero.');
  return [value[0] / length, value[1] / length, value[2] / length];
}
function smoothAxis(source: Float64Array, dimensions: Vec3, axis: number, sigma: number): Float64Array {
  if (sigma === 0) return source;
  const radius = Math.ceil(3 * sigma);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, index) => Math.exp(-0.5 * ((index - radius) / sigma) ** 2));
  const output = new Float64Array(source.length), [width, height, depth] = dimensions;
  for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const point = [x, y, z], index = (z * height + y) * width + x;
    let sum = 0, weight = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const coordinate = point[axis]! + offset;
      if (coordinate < 0 || coordinate >= dimensions[axis]!) continue;
      const sample = [...point]; sample[axis] = coordinate;
      const kernelWeight = kernel[offset + radius]!;
      sum += source[(sample[2]! * height + sample[1]!) * width + sample[0]!]! * kernelWeight;
      weight += kernelWeight;
    }
    output[index] = sum / weight;
  }
  return output;
}
async function loadColor(constraint: ParticleColorConstraint | undefined) {
  if (!constraint) return undefined;
  validVec(constraint.centerKpc, 'color center');
  validVec(constraint.rightDirection, 'color right');
  validVec(constraint.upDirection, 'color up');
  if (constraint.spanKpc.some(value => !Number.isFinite(value) || value <= 0)) throw new TypeError('Color span must be positive.');
  const right = norm(constraint.rightDirection), up = norm(constraint.upDirection);
  if (Math.abs(dot(right, up)) > 1e-4) throw new TypeError('Color projection directions must be orthogonal.');
  const imageBytes = await readFile(constraint.imagePath);
  const decoded = await sharp(imageBytes).rotate().ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { ...decoded, right, up, imageSha256: sha(imageBytes) };
}

export interface ParticleVolumeEncoding {encode(grid:{width:number;height:number;depth:number;encodedRgba:Uint8Array},level:number):Buffer}
export async function convertParticlesToDensityVolume(options: ParticleVolumeOptions, encoding:ParticleVolumeEncoding): Promise<ParticleVolumeReceipt> {
  validVec(options.dimensions, 'dimensions'); validVec(options.boundsKpc.min, 'bounds min'); validVec(options.boundsKpc.max, 'bounds max');
  if (options.dimensions.some(value => !Number.isInteger(value) || value < 2 || value > 512)) throw new TypeError('Dimensions must be integers from 2 through 512.');
  if (options.dimensions.reduce((product, value) => product * value, 1) > 8_388_608) throw new TypeError('Particle volume is limited to 8,388,608 voxels.');
  if (options.boundsKpc.min.some((value, index) => value >= options.boundsKpc.max[index]!)) throw new TypeError('Bounds must strictly increase.');
  if (!Number.isFinite(options.smoothingSigmaVoxels) || options.smoothingSigmaVoxels < 0 || options.smoothingSigmaVoxels > 8) throw new TypeError('Smoothing sigma must be from zero through eight voxels.');
  if (!(options.normalizationQuantile > 0 && options.normalizationQuantile <= 1)) throw new TypeError('Normalization quantile must be in (0,1].');
  if (options.encoding !== 'sqrt-density-unorm8' && options.encoding !== 'linear-density-unorm8') throw new TypeError('Unsupported density encoding.');
  const fallback: Vec3 = options.fallbackColor ?? [1, 1, 1], zstdLevel = options.zstdLevel ?? 9;
  validVec(fallback, 'fallback color');
  if (fallback.some(value => value < 0 || value > 1)) throw new TypeError('Fallback color must be in [0,1].');
  if (!Number.isInteger(zstdLevel) || zstdLevel < -7 || zstdLevel > 22) throw new TypeError('Zstd level must be an integer from -7 through 22.');

  const particleBytes = await readFile(options.particlePath);
  if (particleBytes.length % 16) throw new TypeError('Particle input must be float32 little-endian [x,y,z,mass] records.');
  const count = particleBytes.length / 16, [width, height, depth] = options.dimensions;
  const density = new Float64Array(width * height * depth);
  let inputMass = 0, acceptedMass = 0, accepted = 0;
  for (let particle = 0; particle < count; particle++) {
    const offset = 16 * particle;
    const position: Vec3 = [particleBytes.readFloatLE(offset), particleBytes.readFloatLE(offset + 4), particleBytes.readFloatLE(offset + 8)];
    const mass = particleBytes.readFloatLE(offset + 12);
    if (![...position, mass].every(Number.isFinite) || mass < 0) throw new TypeError(`Invalid particle record ${particle}.`);
    inputMass += mass;
    if (position.some((value, axis) => value < options.boundsKpc.min[axis]! || value > options.boundsKpc.max[axis]!)) continue;
    accepted++; acceptedMass += mass;
    const grid = position.map((value, axis) => (value - options.boundsKpc.min[axis]!) /
      (options.boundsKpc.max[axis]! - options.boundsKpc.min[axis]!) * options.dimensions[axis]! - 0.5);
    const cells: { index: number; weight: number }[] = []; let totalWeight = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const cell = [Math.floor(grid[0]!) + dx, Math.floor(grid[1]!) + dy, Math.floor(grid[2]!) + dz];
      if (cell.some((value, axis) => value < 0 || value >= options.dimensions[axis]!)) continue;
      const weight = [dx, dy, dz].reduce((product, upper, axis) => {
        const fraction = grid[axis]! - Math.floor(grid[axis]!); return product * (upper ? fraction : 1 - fraction);
      }, 1);
      cells.push({ index: (cell[2]! * height + cell[1]!) * width + cell[0]!, weight }); totalWeight += weight;
    }
    for (const cell of cells) density[cell.index] += mass * cell.weight / totalWeight;
  }
  if (!(acceptedMass > 0)) throw new TypeError('No positive particle mass falls within the authored bounds.');

  let field: Float64Array<ArrayBufferLike> = density;
  for (let axis = 0; axis < 3; axis++) field = smoothAxis(field, options.dimensions, axis, options.smoothingSigmaVoxels);
  const smoothedMass = field.reduce((sum, value) => sum + value, 0), massScale = acceptedMass / smoothedMass;
  for (let index = 0; index < field.length; index++) field[index] *= massScale;
  const positive = Array.from(field).filter(value => value > 0).sort((a, b) => a - b);
  const densityAtUnit = positive[Math.min(positive.length - 1, Math.floor(options.normalizationQuantile * (positive.length - 1)))]!;
  const color = await loadColor(options.colorConstraint), rgba = Buffer.alloc(field.length * 4);
  if (options.photoEmission && (!color || !options.colorConstraint ||
      color.right.some((v, i) => Math.abs(v - Number(i === 0)) > 1e-8) ||
      color.up.some((v, i) => Math.abs(v - Number(i === 1)) > 1e-8))) {
    throw new TypeError('Photo-constrained emission requires an XY-aligned color image; rotate the source particles first.');
  }
  const projected = options.photoEmission && color && options.colorConstraint
    ? await bakePhotoConstrainedEmission({ density: field, dimensions: options.dimensions, boundsKpc: options.boundsKpc,
      photo: { rgba: color.data, width: color.info.width, height: color.info.height },
      projection: { centerKpc: options.colorConstraint.centerKpc.slice(0, 2) as [number, number],
        spanKpc: options.colorConstraint.spanKpc, flipY: options.colorConstraint.flipY }, ...options.photoEmission }) : undefined;
  const emissionScale = projected?.diagnostics.recommendedEncodingScale ?? 1;
  const marginals = [new Float64Array(width), new Float64Array(height), new Float64Array(depth)];
  for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (z * height + y) * width + x, value = clamp(field[index]! / densityAtUnit);
    const position: Vec3 = [
      options.boundsKpc.min[0] + (x + 0.5) / width * (options.boundsKpc.max[0] - options.boundsKpc.min[0]),
      options.boundsKpc.min[1] + (y + 0.5) / height * (options.boundsKpc.max[1] - options.boundsKpc.min[1]),
      options.boundsKpc.min[2] + (z + 0.5) / depth * (options.boundsKpc.max[2] - options.boundsKpc.min[2]),
    ];
    let rgb: Vec3 = [...fallback];
    if (!projected && color && options.colorConstraint) {
      const delta: Vec3 = position.map((entry, axis) => entry - options.colorConstraint!.centerKpc[axis]!) as Vec3;
      const u = 0.5 + dot(delta, color.right) / options.colorConstraint.spanKpc[0];
      const projectedV = 0.5 + dot(delta, color.up) / options.colorConstraint.spanKpc[1];
      const v = options.colorConstraint.flipY ? 1 - projectedV : projectedV;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        const px = Math.round(u * (color.info.width - 1)), py = Math.round((1 - v) * (color.info.height - 1));
        const source = 4 * (py * color.info.width + px);
        if (color.data[source + 3]! > 0) rgb = [color.data[source]! / 255, color.data[source + 1]! / 255, color.data[source + 2]! / 255];
      }
    }
    const transfer = (sample: number) => options.encoding === 'sqrt-density-unorm8' ? Math.sqrt(sample) : sample;
    const output = 4 * index;
    for (let channel = 0; channel < 3; channel++) {
      const emission = projected ? projected.emissionPerKpc[3 * index + channel]! / emissionScale : value * clamp(rgb[channel]!);
      rgba[output + channel] = Math.round(255 * transfer(clamp(emission)));
    }
    rgba[output + 3] = Math.round(255 * transfer(value));
    marginals[0][x] += field[index]!; marginals[1][y] += field[index]!; marginals[2][z] += field[index]!;
  }
  const axisVariation = marginals.map(values => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) / mean;
  }) as Vec3;
  const ktx = encoding.encode({ width, height, depth, encodedRgba: rgba }, zstdLevel);
  await mkdir(options.outputDirectory, { recursive: true });
  await writeFile(resolve(options.outputDirectory, 'density.ktx2'), ktx);
  let densityField: ParticleVolumeReceipt['densityField'];
  if (options.densityOutputPath) {
    const densityBytes = Buffer.alloc(field.length * 4);
    for (let index = 0; index < field.length; index++) densityBytes.writeFloatLE(field[index]!, 4 * index);
    const path = resolve(options.outputDirectory, options.densityOutputPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, densityBytes);
    densityField = { path, sha256: sha(densityBytes), bytes: densityBytes.length,
      layout: 'float32-le-x-fastest-density', dimensions: [...options.dimensions],
      boundsKpc: { min: [...options.boundsKpc.min], max: [...options.boundsKpc.max] } };
  }
  const receipt: ParticleVolumeReceipt = {
    schema: 'cssearth-particle-volume-lab@1',
    input: { path: options.particlePath, sha256: sha(particleBytes), bytes: particleBytes.length, layout: 'float32-le-xyzmass-kpc' },
    options: { dimensions: options.dimensions, boundsKpc: options.boundsKpc, smoothingSigmaVoxels: options.smoothingSigmaVoxels,
      normalizationQuantile: options.normalizationQuantile, encoding: options.encoding, fallbackColor: fallback, zstdLevel,
      ...(options.photoEmission ? { photoEmission: options.photoEmission } : {}),
      ...(options.colorConstraint && color ? { colorConstraint: { ...options.colorConstraint, imageSha256: color.imageSha256 } } : {}) },
    particles: { count, accepted, inputMass, acceptedMass, depositedMass: field.reduce((sum, value) => sum + value, 0) },
    normalization: { quantile: options.normalizationQuantile, densityAtUnit, encoding: options.encoding },
    diagnostics: { occupiedVoxels: positive.length, axisVariation },
    outputs: { gridPath: 'density.ktx2', gridSha256: sha(ktx), decodedSha256: sha(rgba), bytes: ktx.length },
    ...(densityField ? { densityField } : {}),
    interpretation: { density: 'Mass-weighted CIC deposition of simulation stellar particles with authored offline Gaussian smoothing.',
      color: projected ? 'Photographic brightness and color distributed through the simulated conditional depth profile. Authored display emissivity, not measured gas, dust or stellar population synthesis.' :
        color ? 'Fixed orthographic RGB constraint from an authored observational image; color is not simulated stellar population synthesis.' : 'Authored uniform fallback color.',
      dust: 'No dust or extinction is encoded; alpha is stellar-density support.' },
    ...(projected ? { emission: { mode: 'photo-constrained' as const, encodingScale: emissionScale, diagnostics: projected.diagnostics } } : {}),
  };
  await writeFile(resolve(options.outputDirectory, 'particles-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

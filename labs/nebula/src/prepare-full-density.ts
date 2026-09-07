/** Full-particle neutral density preparation with one pinned source-to-local affine. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Vector3, VolumeRecipe } from '../../../src/preparation/volume/config.js';
import { decodeDensityKtx2, sha256, verifiedBytes } from '../../../src/preparation/volume/source.js';
import { prepareVolumeSlices } from '../../../src/preparation/volume/slices.js';
import { compileCssVolume } from '../../../src/renderers/css/preparation/volume.js';
import { convertParticlesToDensityVolume } from './particles.js';

type Matrix3 = [number, number, number, number, number, number, number, number, number];
interface PinnedFile { path: string; sha256: string; bytes?: number }
interface TransformRecipe {
  mwCenterKpc: Vector3;
  simulationToGalactic: Matrix3;
  sunGalactocentricKpc: Vector3;
  galacticToIcrs: Matrix3;
  method: string;
  limitation: string;
}
interface TargetRecipe {
  id: string;
  outputDirectory: string;
  centeredParticles: PinnedFile;
  importReceipt: PinnedFile;
  sourceObject: PinnedFile;
  centeringOffsetKpc: Vector3;
  centeredToLocal: { matrix: Matrix3; offsetKpc: Vector3 };
}
interface FullDensityRecipe {
  schema: 'cssearth-full-particle-density@1';
  transform: TransformRecipe;
  grid: { maximumVoxels: number; maximumAxisCells: number; smoothingSigmaVoxels: number;
    boundaryPaddingSigma: number; normalizationQuantile: number; encoding: 'sqrt-density-unorm8' };
  material: { sourceChannel: 3; strength: number; exposureGain: number };
  bake: VolumeRecipe['bake'];
  targets: TargetRecipe[];
}
export interface GridPlan {
  dimensions: Vector3;
  boundsKpc: { min: Vector3; max: Vector3 };
  cellWidthKpc: number;
  paddingCells: number;
  paddingKpc: { min: Vector3; max: Vector3 };
}

const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const multiply = (a: Matrix3, b: Matrix3): Matrix3 => Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3), column = index % 3;
  return a[3 * row]! * b[column]! + a[3 * row + 1]! * b[3 + column]! + a[3 * row + 2]! * b[6 + column]!;
}) as Matrix3;
const vector = (matrix: Matrix3, value: Vector3): Vector3 => [
  matrix[0] * value[0] + matrix[1] * value[1] + matrix[2] * value[2],
  matrix[3] * value[0] + matrix[4] * value[1] + matrix[5] * value[2],
  matrix[6] * value[0] + matrix[7] * value[1] + matrix[8] * value[2],
];
const transpose = (matrix: Matrix3): Matrix3 => [matrix[0], matrix[3], matrix[6], matrix[1], matrix[4],
  matrix[7], matrix[2], matrix[5], matrix[8]];
const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const quaternionMatrix = ([x, y, z, w]: readonly number[]): Matrix3 => [
  1 - 2 * (y! * y! + z! * z!), 2 * (x! * y! - z! * w!), 2 * (x! * z! + y! * w!),
  2 * (x! * y! + z! * w!), 1 - 2 * (x! * x! + z! * z!), 2 * (y! * z! - x! * w!),
  2 * (x! * z! - y! * w!), 2 * (y! * z! + x! * w!), 1 - 2 * (x! * x! + y! * y!),
];
const close = (a: readonly number[], b: readonly number[], tolerance = 2e-9): boolean =>
  a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) <= tolerance);

function deriveCenteredToLocal(transform: TransformRecipe, centering: Vector3,
  frame: DensityVolumeFrame): { matrix: Matrix3; offsetKpc: Vector3 } {
  const referenceToLocal = transpose(quaternionMatrix(frame.localToReferenceXyzw));
  const matrix = multiply(referenceToLocal, multiply(transform.galacticToIcrs, transform.simulationToGalactic));
  const centeredGalactic = vector(transform.simulationToGalactic,
    add(centering, transform.mwCenterKpc.map(value => -value) as Vector3));
  const heliocentric = add(centeredGalactic,
    transform.sunGalactocentricKpc.map(value => -value) as Vector3);
  const referenceKpc = vector(transform.galacticToIcrs, heliocentric);
  const originUnits = frame.originM.map(value => value / frame.metersPerUnit) as Vector3;
  return { matrix, offsetKpc: vector(referenceToLocal,
    add(referenceKpc, originUnits.map(value => -value) as Vector3)) };
}

export function transformParticleBytes(source: Buffer, matrix: Matrix3, offset: Vector3): {
  bytes: Buffer; count: number; mass: number; boundsKpc: { min: Vector3; max: Vector3 };
} {
  if (!source.length || source.length % 16) throw new TypeError('Expected float32 LE XYZ-mass records.');
  const bytes = Buffer.allocUnsafe(source.length), min: Vector3 = [Infinity, Infinity, Infinity];
  const max: Vector3 = [-Infinity, -Infinity, -Infinity];
  let mass = 0;
  for (let record = 0; record < source.length / 16; record++) {
    const at = 16 * record;
    const point: Vector3 = [source.readFloatLE(at), source.readFloatLE(at + 4), source.readFloatLE(at + 8)];
    const weight = source.readFloatLE(at + 12), transformed = add(vector(matrix, point), offset);
    if (![...point, weight, ...transformed].every(Number.isFinite) || weight < 0) {
      throw new TypeError(`Invalid transformed particle ${record}.`);
    }
    for (let axis = 0; axis < 3; axis++) {
      bytes.writeFloatLE(transformed[axis]!, at + 4 * axis);
      const stored = bytes.readFloatLE(at + 4 * axis);
      min[axis] = Math.min(min[axis], stored); max[axis] = Math.max(max[axis], stored);
    }
    bytes.writeFloatLE(weight, at + 12); mass += weight;
  }
  return { bytes, count: source.length / 16, mass, boundsKpc: { min, max } };
}

export function planFullDensityGrid(particleBounds: GridPlan['boundsKpc'], settings: {
  maximumVoxels: number; maximumAxisCells: number; smoothingSigmaVoxels: number; boundaryPaddingSigma: number;
}): GridPlan {
  const span = particleBounds.max.map((value, axis) => value - particleBounds.min[axis]!) as Vector3;
  if (span.some(value => !(value > 0)) || !Number.isInteger(settings.maximumVoxels) ||
      !Number.isInteger(settings.maximumAxisCells) || settings.maximumVoxels < 1 || settings.maximumAxisCells < 16 ||
      !(settings.smoothingSigmaVoxels >= 0) || !(settings.boundaryPaddingSigma >= 4)) {
    throw new TypeError('Invalid full-density grid constraints.');
  }
  const paddingCells = Math.max(Math.ceil(settings.boundaryPaddingSigma * settings.smoothingSigmaVoxels),
    Math.ceil(3 * settings.smoothingSigmaVoxels) + 2);
  const dimensions = (cell: number): Vector3 => span.map(value => Math.ceil(value / cell) + 2 * paddingCells) as Vector3;
  const valid = (value: Vector3) => value.every(cells => cells <= settings.maximumAxisCells) &&
    value.reduce((product, cells) => product * cells, 1) <= settings.maximumVoxels;
  let lo = 0, hi = Math.max(...span);
  for (let step = 0; step < 80; step++) {
    const mid = (lo + hi) / 2;
    if (valid(dimensions(mid))) hi = mid; else lo = mid;
  }
  const cellWidthKpc = hi * (1 + 1e-12), cells = dimensions(cellWidthKpc);
  if (!valid(cells)) throw new TypeError('Unable to satisfy bounded full-density dimensions.');
  const min = particleBounds.min.map(value => value - paddingCells * cellWidthKpc) as Vector3;
  const max = min.map((value, axis) => value + cells[axis]! * cellWidthKpc) as Vector3;
  return { dimensions: cells, boundsKpc: { min, max }, cellWidthKpc, paddingCells,
    paddingKpc: { min: particleBounds.min.map((value, axis) => value - min[axis]!) as Vector3,
      max: particleBounds.max.map((value, axis) => max[axis]! - value) as Vector3 } };
}

function boundaryDiagnostics(rgba: Uint8Array, dimensions: Vector3): { nonzeroAlpha: number; nonzeroRgb: number } {
  const [width, height, depth] = dimensions;
  let nonzeroAlpha = 0, nonzeroRgb = 0;
  for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1 && z !== 0 && z !== depth - 1) continue;
    const offset = 4 * ((z * height + y) * width + x);
    if (rgba[offset + 3]) nonzeroAlpha++;
    if (rgba[offset] || rgba[offset + 1] || rgba[offset + 2]) nonzeroRgb++;
  }
  return { nonzeroAlpha, nonzeroRgb };
}

export async function prepareFullParticleDensity(configPath: string): Promise<void> {
  const root = process.cwd(), configBytes = await readFile(resolve(configPath));
  const config = JSON.parse(configBytes.toString('utf8')) as FullDensityRecipe;
  if (config.schema !== 'cssearth-full-particle-density@1' || config.material.sourceChannel !== 3 ||
      !Array.isArray(config.targets) || !config.targets.length) throw new TypeError('Invalid full-density recipe.');
  for (const target of config.targets) {
    const [particleBytes, importBytes, objectBytes] = await Promise.all([
      verifiedBytes(root, target.centeredParticles), verifiedBytes(root, target.importReceipt),
      verifiedBytes(root, target.sourceObject),
    ]);
    if (target.centeredParticles.bytes !== undefined && particleBytes.length !== target.centeredParticles.bytes) {
      throw new TypeError(`Pinned particle byte length changed for ${target.id}.`);
    }
    const imported = JSON.parse(importBytes.toString('utf8')) as any;
    const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(objectBytes.toString('utf8')) as unknown);
    if (imported.output?.sha256 !== target.centeredParticles.sha256 ||
        !close(imported.centering?.offsetKpc ?? [], target.centeringOffsetKpc, 1e-8)) {
      throw new TypeError(`Import receipt does not match centered particles for ${target.id}.`);
    }
    const derived = deriveCenteredToLocal(config.transform, target.centeringOffsetKpc, descriptor.volume);
    if (!close(derived.matrix, target.centeredToLocal.matrix) ||
        !close(derived.offsetKpc, target.centeredToLocal.offsetKpc)) {
      throw new TypeError(`Pinned source-to-local affine is not derivable for ${target.id}.`);
    }
    const transformed = transformParticleBytes(particleBytes, target.centeredToLocal.matrix,
      target.centeredToLocal.offsetKpc);
    if (transformed.count !== imported.output.count || transformed.mass !== imported.mass.sumSourceUnits) {
      throw new TypeError(`Transformed particle count or mass changed for ${target.id}.`);
    }
    const plan = planFullDensityGrid(transformed.boundsKpc, config.grid);
    const objectDirectory = resolve(target.outputDirectory), sourceDirectory = resolve(objectDirectory, 'source');
    const transformedPath = resolve(root, '.local/nebula-lab/full-density', `${target.id}.f32`);
    await mkdir(resolve(root, '.local/nebula-lab/full-density'), { recursive: true });
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(transformedPath, transformed.bytes);
    console.log(`FULL_DENSITY_GRID ${target.id}: ${plan.dimensions.join('x')} at ${plan.cellWidthKpc.toFixed(6)} kpc`);
    const converted = await convertParticlesToDensityVolume({ particlePath: relative(root, transformedPath),
      outputDirectory: sourceDirectory, dimensions: plan.dimensions, boundsKpc: plan.boundsKpc,
      smoothingSigmaVoxels: config.grid.smoothingSigmaVoxels,
      normalizationQuantile: config.grid.normalizationQuantile, encoding: config.grid.encoding,
      fallbackColor: [0, 0, 0] });
    const massError = Math.abs(converted.particles.depositedMass - converted.particles.inputMass);
    if (converted.particles.accepted !== converted.particles.count ||
        converted.particles.acceptedMass !== converted.particles.inputMass ||
        massError > 1e-9 * converted.particles.inputMass) {
      throw new TypeError(`Full particle mass was not retained for ${target.id}.`);
    }
    const gridBytes = await readFile(resolve(sourceDirectory, 'density.ktx2'));
    const decoded = decodeDensityKtx2(gridBytes), boundary = boundaryDiagnostics(decoded.encodedRgba, plan.dimensions);
    if (boundary.nonzeroAlpha || boundary.nonzeroRgb || decoded.encodedRgba.some((value, index) => index % 4 !== 3 && value)) {
      throw new TypeError(`Full density source is not scalar alpha with zero padded faces for ${target.id}.`);
    }
    const provenance = { schema: 'cssearth-full-particle-density-provenance@1',
      config: { path: relative(root, resolve(configPath)).split('\\').join('/'), sha256: sha256(configBytes) },
      source: { centeredParticles: target.centeredParticles, importReceipt: target.importReceipt,
        regeneration: `pnpm lab:nebula:particles labs/nebula/models/magellanic-particles.json <pinned-archive.zip> ${imported.selection ? target.id.replace(/-full-density$/, '-particles') : target.id}`,
        particleSelection: imported.selection, sourceSnapshot: imported.source,
        interpretation: imported.interpretation },
      transform: { ...config.transform, centeringOffsetKpc: target.centeringOffsetKpc,
        centeredToLocal: target.centeredToLocal, targetFrame: { ...descriptor.volume, boundsUnits: plan.boundsKpc },
        interpretation: 'One observer-relative affine maps raw simulation Cartesian positions into the existing Sun-ICRF object frame.' },
      grid: { ...plan, smoothingSigmaVoxels: config.grid.smoothingSigmaVoxels,
        normalizationQuantile: config.grid.normalizationQuantile,
        particleCount: converted.particles.count, acceptedCount: converted.particles.accepted,
        inputMass: converted.particles.inputMass, acceptedMass: converted.particles.acceptedMass,
        depositedMass: converted.particles.depositedMass, massError, boundary },
      limitations: [config.transform.limitation,
        'This is a bounded-resolution overview of simulated stellar mass, not a new high-resolution depth measurement.',
        'It contains no observational photograph, gas, dust, extinction, calibrated photometry or morphology fit.'] };
    const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n');
    await writeFile(resolve(sourceDirectory, 'provenance.json'), provenanceBytes);
    const volumeRecipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1',
      grid: { path: 'density.ktx2', sha256: converted.outputs.gridSha256,
        decodedSha256: converted.outputs.decodedSha256, dimensions: plan.dimensions,
        encoding: config.grid.encoding, bounds: plan.boundsKpc },
      material: { emission: [{ channel: 3, color: [1, 1, 1], strength: config.material.strength }],
        absorption: [], intensityScale: 1, stepScale: 1, stepMetric: 'source',
        exposureGain: config.material.exposureGain, emissionTransfer: 'shared-opacity' },
      bake: config.bake, anchors: [], provenance: { path: 'provenance.json', sha256: sha256(provenanceBytes) } };
    const volumeRecipeBytes = Buffer.from(JSON.stringify(volumeRecipe, null, 2) + '\n');
    await writeFile(resolve(sourceDirectory, 'volume.json'), volumeRecipeBytes);
    const frame = { ...descriptor.volume, boundsUnits: plan.boundsKpc };
    const outputDirectory = resolve(objectDirectory, 'prepared');
    await mkdir(outputDirectory, { recursive: true });
    console.log(`FULL_DENSITY_BAKE ${target.id}`);
    const slices = await prepareVolumeSlices({ sourceDirectory, outputDirectory, recipe: volumeRecipe });
    const data = compileCssVolume({ id: target.id, frame, slices, recipe: volumeRecipe });
    const envelope = { schema: 'cssearth-prepared-object@1' as const, id: target.id,
      type: 'density-volume' as const, format: 'cssearth-density-volume@1' as const, data };
    const preparedBytes = Buffer.from(JSON.stringify(envelope) + '\n');
    await writeFile(resolve(outputDirectory, 'volume.json'), preparedBytes);
    await json(resolve(objectDirectory, 'object.json'), { schema: 'cssearth-object@1', id: target.id,
      type: 'density-volume', properties: { volume: frame,
        preparation: { source: 'source/volume.json', sha256: sha256(volumeRecipeBytes) } },
      prepared: { format: envelope.format, url: 'prepared/volume.json', sha256: sha256(preparedBytes) } });
    await json(resolve(sourceDirectory, 'preparation-receipt.json'), {
      schema: 'cssearth-full-particle-density-receipt@1', id: target.id,
      source: converted.outputs, grid: plan, mass: converted.particles, boundary,
      prepared: { sha256: sha256(preparedBytes), leaves: data.resources.length,
        bytes: data.resources.reduce((sum, resource) => sum + resource.bytes, 0) } });
    console.log(`FULL_DENSITY_READY ${target.id}: ${data.resources.length} leaves`);
  }
}

if (process.argv[1] && !/\.test\.[cm]?js$/.test(process.argv[1]) &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [configPath, extra] = process.argv.slice(2);
  if (!configPath || extra) throw new TypeError('Usage: prepare-full-density <full-density.json>');
  await prepareFullParticleDensity(configPath);
}

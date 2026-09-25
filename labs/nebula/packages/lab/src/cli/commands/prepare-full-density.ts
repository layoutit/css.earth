import {deriveCenteredToLocal,transformParticleBytes,planFullDensityGrid,boundaryDiagnostics,close,type Matrix3,type TransformRecipe} from '@cssearth/nebula-reconstruction/stars/full-density';
export {transformParticleBytes,planFullDensityGrid,type GridPlan} from '@cssearth/nebula-reconstruction/stars/full-density';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Full-particle neutral density preparation with one pinned source-to-local affine. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { Vector3, VolumeRecipe } from '@cssearth/bake/volume';
import { decodeDensityKtx2, sourceBytes, prepareVolumeSlices } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import { convertParticlesToDensityVolume } from '../../server/workflows/stars/particles.ts';

interface PinnedFile {path:string;sha256:string;bytes?:number}
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
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
export async function prepareFullParticleDensity(configPath: string): Promise<void> {
  const root = process.cwd(), configBytes = await readFile(resolve(configPath));
  const config = parseLabModelJson(configBytes.toString('utf8')) as FullDensityRecipe;
  if (config.schema !== 'cssearth-full-particle-density@1' || config.material.sourceChannel !== 3 ||
      !Array.isArray(config.targets) || !config.targets.length) throw new TypeError('Invalid full-density recipe.');
  for (const target of config.targets) {
    const [particleBytes, importBytes, objectBytes] = await Promise.all([
      sourceBytes(root, target.centeredParticles), sourceBytes(root, target.importReceipt),
      sourceBytes(root, target.sourceObject),
    ]);
    if (target.centeredParticles.bytes !== undefined && particleBytes.length !== target.centeredParticles.bytes) {
      throw new TypeError(`Pinned particle byte length changed for ${target.id}.`);
    }
    const imported = parseLabModelJson(importBytes.toString('utf8')) as any;
    const descriptor = parseDensityVolumeObjectDescriptor(parseLabModelJson(objectBytes.toString('utf8')) as unknown);
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
      grid: { path: 'density.ktx2', dimensions: plan.dimensions,
        encoding: config.grid.encoding, bounds: plan.boundsKpc },
      material: { emission: [{ channel: 3, color: [1, 1, 1], strength: config.material.strength }],
        absorption: [], intensityScale: 1, stepScale: 1, stepMetric: 'source',
        exposureGain: config.material.exposureGain, emissionTransfer: 'shared-opacity' },
      bake: config.bake, anchors: [], provenance: { path: 'provenance.json' } };
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
        preparation: { source: 'source/volume.json' } },
      prepared: { format: envelope.format, url: 'prepared/volume.json' } });
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

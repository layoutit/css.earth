import {rotateParticles} from '@cssearth/nebula-reconstruction/stars/rotate-particles';
import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Reproducible local experiment: a pinned simulation snapshot, photograph colors, and the shared volume baker. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { importTipsyStars } from '@cssearth/nebula-reconstruction/stars/tipsy';
import { convertParticlesToDensityVolume } from '../../server/workflows/stars/particles.ts';
import type { ParticlePhotoEmissionOptions } from '../../server/workflows/stars/particles.ts';
import { extractExtendedSource } from '@cssearth/nebula-reconstruction/star-removal/extraction';
import { createParticleAlignmentDiagnostic } from '@cssearth/nebula-reconstruction/registration/particle-alignment';
import type { VolumeRecipe, Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';

interface ParticleExperiment {
  schema: 'cssearth-magellanic-particle-experiment@1';
  source: { url: string; license: string; archiveSha256: string; archiveBytes: number;
    entry: string; snapshotSha256: string; snapshotAgeGyr: number; massUnitSolarMass: number;
    totalCount: number; gasCount: number; darkCount: number; starCount: number };
  targets: { id: string; directory: string; referenceObject: string; photo: string;
    photoSha256: string; photoUrl: string; photoCredit: string; photoReceipt?: string;
    starRange: { start: number; count: number }; rotation: number[];
    boundsKpc: { min: Vector3; max: Vector3 }; dimensions: Vector3;
    colorSpanKpc: [number, number]; colorCenterKpc: Vector3;
    smoothingSigmaVoxels: number; normalizationQuantile: number; exposureGain: number;
    extraction?: { maxPixels: number; medianSize: number };
    photoEmission?: Omit<ParticlePhotoEmissionOptions, 'exposureGain'>;
    alignment?: { method: string; photoScale: string; displayScope: string; registration: string } }[];
}
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function fileDigest(path: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const json = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

async function snapshot(source: ParticleExperiment['source'], archive: string, cache: string) {
  const destination = resolve(cache, source.entry.replace(/\.gz$/, ''));
  if (await fileDigest(destination).catch(() => '') === source.snapshotSha256) return destination;
  if (await fileDigest(archive) !== source.archiveSha256) throw new Error('Archive SHA256 differs from the published pin.');
  // Extract only the named member; no archive paths are used as output paths.
  const extraction = spawnSync('python3', ['-c',
    'import sys,zipfile,gzip; z=zipfile.ZipFile(sys.argv[1]); data=z.read(sys.argv[2]); open(sys.argv[3],"wb").write(gzip.decompress(data))',
    archive, source.entry, destination], { stdio: 'inherit' });
  if (extraction.error) throw extraction.error;
  if (extraction.status !== 0 || await fileDigest(destination) !== source.snapshotSha256) {
    throw new Error('Snapshot extraction or pinned-byte verification failed.');
  }
  return destination;
}


export async function prepareParticleExperiments(recipePath: string, archivePath: string, targetId?: string) {
  const recipe: ParticleExperiment = parseLabModelJson(await readFile(recipePath, 'utf8'));
  if (recipe.schema !== 'cssearth-magellanic-particle-experiment@1') throw new TypeError('Unsupported experiment recipe.');
  const targets = targetId ? recipe.targets.filter(target => target.id === targetId) : recipe.targets;
  if (!targets.length) throw new TypeError(`Unknown experiment target: ${targetId}`);
  const root = process.cwd(), cache = resolve(root, '.local/nebula-lab/particles');
  await mkdir(cache, { recursive: true });
  const input = await snapshot(recipe.source, resolve(archivePath), cache);
  for (const target of targets) {
    console.log(`PARTICLES_IMPORT ${target.id}`);
    const objectDirectory = resolve(root, target.directory), sourceDirectory = resolve(objectDirectory, 'source');
    await mkdir(sourceDirectory, { recursive: true });
    const particlePath = relative(root, resolve(cache, `${target.id}.f32`));
    const importedPath = relative(root, resolve(cache, `${target.id}-centered.f32`));
    const imported = await importTipsyStars({ snapshotPath: relative(root, input), outputPath: importedPath,
      starRange: target.starRange, positionUnit: 'kpc', massUnitSolarMass: recipe.source.massUnitSolarMass,
      center: 'median', expected: recipe.source });
    const particles = await readFile(importedPath); rotateParticles(particles, target.rotation);
    await writeFile(particlePath, particles);
    await json(resolve(sourceDirectory, 'import.json'), { ...imported,
      displayRotation: target.rotation,
      rotatedOutput: { path: particlePath, sha256: digest(particles), bytes: particles.length } });
    if (await fileDigest(target.photo) !== target.photoSha256) throw new Error('Observation photo SHA256 mismatch.');
    const extraction = await extractExtendedSource({ inputPath: target.photo,
      outputDirectory: sourceDirectory, id: 'photo', maxPixels: 1200, ...target.extraction });
    if (target.photoEmission) await createParticleAlignmentDiagnostic({ rotatedParticlePath: particlePath,
      extractedPhotoPath: relative(root, resolve(sourceDirectory, extraction.outputs.diffuse)),
      photoCenterKpc: target.colorCenterKpc, photoSpanKpc: target.colorSpanKpc,
      boundsKpc: target.boundsKpc, resolution: 512, outputDirectory: sourceDirectory });
    const converted = await convertParticlesToDensityVolume({ particlePath,
      outputDirectory: sourceDirectory, dimensions: target.dimensions, boundsKpc: target.boundsKpc,
      smoothingSigmaVoxels: target.smoothingSigmaVoxels, normalizationQuantile: target.normalizationQuantile,
      encoding: 'sqrt-density-unorm8', fallbackColor: [.68, .73, .8],
      photoEmission: target.photoEmission ? { ...target.photoEmission, exposureGain: target.exposureGain } : undefined,
      colorConstraint: { imagePath: relative(root, resolve(sourceDirectory, extraction.outputs.diffuse)),
        centerKpc: target.colorCenterKpc, rightDirection: [1, 0, 0], upDirection: [0, 1, 0], spanKpc: target.colorSpanKpc } });
    const provenance = { schema: 'cssearth-particle-volume-provenance@1', source: recipe.source,
      sourceFamily: imported.selection, density: converted.interpretation.density,
      photo: { path: target.photo, sha256: target.photoSha256, url: target.photoUrl, credit: target.photoCredit, license: 'CC-BY-4.0',
        ...(target.photoReceipt ? { acquisition: { path: target.photoReceipt, sha256: await fileDigest(target.photoReceipt) } } : {}) },
      display: { rotation: target.rotation, boundsKpc: target.boundsKpc,
        alignment: target.alignment ?? 'Authored lab alignment, not an astrometric fit between the simulation and photograph.',
        color: converted.interpretation.color, dust: converted.interpretation.dust,
        massRetention: converted.particles.acceptedMass / converted.particles.inputMass,
        brightness: converted.emission ? 'Photographic display brightness constrained along the reference projection; not calibrated photometry.' :
          'Authored mass-to-light conversion and exposure; not calibrated photometry.' },
      ...(target.extraction ? { extraction: target.extraction } : {}) };
    await json(resolve(sourceDirectory, 'provenance.json'), provenance);
    const volume: VolumeRecipe = { schema: 'cssearth-volume-recipe@1',
      grid: { path: 'density.ktx2',
        dimensions: target.dimensions,
        encoding: 'sqrt-density-unorm8', bounds: target.boundsKpc },
      material: { emission: [0, 1, 2].map(channel => ({ channel,
        color: [Number(channel === 0), Number(channel === 1), Number(channel === 2)] as Vector3,
        strength: converted.emission?.encodingScale ?? 1 })),
        absorption: [], intensityScale: 1, stepScale: 1, stepMetric: 'source', exposureGain: target.exposureGain,
        ...(converted.emission ? { emissionTransfer: 'shared-opacity' as const } : {}) },
      bake: { sliceCounts: { x: 64, y: 64, z: 64 }, unitsPerSourceUnit: 1, imageWidth: 512,
        samplesPerSlab: 2, cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
      anchors: [], provenance: { path: 'provenance.json' } };
    await json(resolve(sourceDirectory, 'volume.json'), volume);
    const reference = parseLabModelJson(await readFile(target.referenceObject, 'utf8'));
    const frame = { ...reference.properties.frame, boundsUnits: target.boundsKpc };
    await json(resolve(objectDirectory, 'object.json'), { schema: 'cssearth-object@1', id: target.id,
      type: 'density-volume', properties: { volume: frame,
        preparation: { source: 'source/volume.json', sha256: await fileDigest(resolve(sourceDirectory, 'volume.json')) } } });
    console.log(`PARTICLES_BAKE ${target.id}: ${(100 * provenance.display.massRetention).toFixed(2)}% stellar mass inside display bounds`);
    const baked = spawnSync(process.execPath, [resolve(root, 'tools/objects/dist/prepare-volume.js'), objectDirectory], { stdio: 'inherit' });
    if (baked.error) throw baked.error;
    if (baked.status !== 0) throw new Error(`Shared volume bake failed for ${target.id}.`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe, archive, targetId, extra] = process.argv.slice(2);
  if (!recipe || !archive || extra) throw new TypeError('Usage: prepare-particles <recipe.json> <archive.zip> [target-id]');
  await prepareParticleExperiments(recipe, archive, targetId);
}

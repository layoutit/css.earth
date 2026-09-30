/** Generic, self-contained density-volume object preparation entry point. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { parseVolumeRecipe } from '../volume/index.ts';
import { sourceBytes, containedPath, prepareVolumeSlices } from '../volume/node/index.ts';
import { compileCssVolume } from '../volume-leaves/index.ts';
import { acquireVolumeSource } from './acquisition.ts';
import { prepareFixedDiscVolume } from './fixed-disc.ts';
import { readPreviousVolumeTextures, retireVolumeTextures } from './retirement.ts';
import { parseSkyRecipe, acquireSkySource, prepareSkyFaces, compileCssSky } from '../sky/index.ts';

export async function prepareDensityVolumeObject(options: { objectDirectory: string; outputDirectory?: string; acquisitionCache?: string;
  inventory?: (object: { objectId: string; objectDirectory: string; preparedRoot: string }) => Promise<unknown> }) {
  const objectDirectory = resolve(options.objectDirectory), outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory, 'prepared'));
  // A bake into the object's own prepared/ directory records its published closure through the host's inventory
  // (`inventoryPreparedAssets` in packages/objects/src/node/runtime-asset-closure.ts); a scratch bake records nothing.
  if (outputDirectory === resolve(objectDirectory, 'prepared') && !options.inventory) throw new TypeError('A bake into the object\'s prepared directory needs the host inventory.');
  const descriptorPath = resolve(objectDirectory, 'object.json');
  const authored: unknown = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const descriptor = parseDensityVolumeObjectDescriptor(authored);
  const configBytes = await readFile(containedPath(objectDirectory, descriptor.preparation.source));
  const recipe = parseVolumeRecipe(JSON.parse(configBytes.toString('utf8')) as unknown);
  const sourceDirectory = dirname(containedPath(objectDirectory, descriptor.preparation.source));
  if (options.acquisitionCache) await acquireVolumeSource(sourceDirectory, recipe, resolve(options.acquisitionCache));
  const previousTextures = await readPreviousVolumeTextures(outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  // A volume that draws no slices integrates none: its field is drawn by other prepared layers.
  const bounds = descriptor.volume.boundsUnits;
  const slices = recipe.drawSlices === false ? { quads: [], boundsUnits: { min: [...bounds.min] as [number, number, number], max: [...bounds.max] as [number, number, number] }, provenance: { drawSlices: false },
    approximation: { method: 'No slices are drawn: other prepared layers of the object draw it.', radialEmission: 'None.', limitations: [],
      samplesPerSlab: 1, opticalWeight: 1, exposureGain: 1, sliceCounts: { x: 0, y: 0, z: 0 }, slabPitchUnits: { x: 0, y: 0, z: 0 } } }
    : await prepareVolumeSlices({ sourceDirectory, outputDirectory, recipe });
  let data = compileCssVolume({ id: descriptor.id, frame: descriptor.volume, slices, recipe });
  // A density volume has no whole-cloud impostor views: the same slices draw it at every distance.
  data = await prepareFixedDiscVolume({ volume: data, slices, recipe, outputDirectory });
  if (recipe.sky) {
    const skyRecipe = parseSkyRecipe(JSON.parse((await sourceBytes(sourceDirectory, recipe.sky)).toString('utf8')));
    const skyDirectory = dirname(containedPath(sourceDirectory, recipe.sky.path));
    if (options.acquisitionCache) await acquireSkySource(skyDirectory, skyRecipe, resolve(options.acquisitionCache));
    const compiled = compileCssSky(await prepareSkyFaces({ sourceDirectory: skyDirectory, outputDirectory, recipe: skyRecipe }), descriptor.volume);
    data = { ...data, sky: compiled.sky, resources: [...data.resources, ...compiled.resources] };
  }
  const envelope = { schema: 'cssearth-prepared-object@1' as const, id: descriptor.id, type: 'density-volume' as const,
    format: 'cssearth-density-volume@1' as const, data };
  const bytes = Buffer.from(JSON.stringify(envelope) + '\n'), outputPath = resolve(outputDirectory, 'volume.json');
  await writeFile(outputPath, bytes);
  if (outputDirectory === resolve(objectDirectory, 'prepared')) {
    // The preparation reference is output metadata; authored physical/model facts remain untouched.
    const { volume: _volume, preparation: _preparation, ...baseDescriptor } = descriptor;
    await writeFile(descriptorPath, JSON.stringify({ ...baseDescriptor, prepared: { format: envelope.format,
      url: relative(objectDirectory, outputPath).split('\\').join('/') } }, null, 2) + '\n');
  }
  await retireVolumeTextures(outputDirectory, [...previousTextures, ...slices.quads.map(quad => quad.texturePath)],
    data.stacks.flatMap(stack => stack.leaves).map(leaf => leaf.texturePath));
  if (outputDirectory === resolve(objectDirectory, 'prepared')) {
    await options.inventory!({ objectId: descriptor.id, objectDirectory, preparedRoot: outputDirectory });
  }
  const decodedBytes = data.resources.reduce((sum, resource) => sum + resource.width * resource.height * 4, 0);
  console.log(`PREPARED ${descriptor.id}: ${data.stacks.reduce((count, stack) => count + stack.leaves.length, 0)} PolyCSS leaves; ${decodedBytes} decoded RGBA bytes; ${outputPath}`);
  return envelope;
}

/** Generic, self-contained density-volume object preparation entry point. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseDensityVolumeObjectDescriptor } from '@cssearth/objects';
import { parseVolumeRecipe } from '@cssearth/bake/volume';
import { sourceBytes, containedPath, prepareVolumeSlices } from '@cssearth/bake/volume/node';
import { compileCssVolume, prepareVolumeImpostors } from '@cssearth/bake/volume-leaves';
import { acquireVolumeSource } from './acquisition.js';
import { prepareFixedDiscVolume } from './fixed-disc.js';
import { readPreviousVolumeTextures, retireVolumeTextures } from './retirement.js';
import { parseSkyRecipe } from '../sky/config.js';
import { acquireSkySource } from '../sky/source.js';
import { loadSkyStarSprites, prepareSkyFaces } from '../sky/bake.js';
import { compileCssSky } from '../../renderers/css/preparation/sky.js';

export async function prepareDensityVolumeObject(options: { objectDirectory: string; outputDirectory?: string; acquisitionCache?: string;
  inventory?: (object: { objectId: string; objectDirectory: string; preparedRoot: string }) => Promise<unknown> }) {
  const objectDirectory = resolve(options.objectDirectory), outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory, 'prepared'));
  // A bake into the object's own prepared/ directory records its published closure through the host's inventory
  // (`inventoryPreparedAssets` in src/platform/runtime-asset-closure.mts); a scratch bake records nothing.
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
  const slices = await prepareVolumeSlices({ sourceDirectory, outputDirectory, recipe });
  let data = compileCssVolume({ id: descriptor.id, frame: descriptor.volume, slices, recipe });
  // One flat image of the whole cloud per viewing direction. Without them a distant volume has nothing to hand off
  // to, so all of its slices stay mounted and composited: the galaxy alone keeps 1,368 elements in every page.
  data = await prepareVolumeImpostors({ volume: data, brightness: { overall: 1, x: 1, y: 1, z: 1 }, prefix: 'impostors',
    readResource: path => readFile(resolve(outputDirectory, path)),
    writeResource: async (path, bytes) => {
      const target = resolve(outputDirectory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    } });
  data = await prepareFixedDiscVolume({ volume: data, slices, recipe, outputDirectory });
  if (recipe.sky) {
    const skyRecipe = parseSkyRecipe(JSON.parse((await sourceBytes(sourceDirectory, recipe.sky)).toString('utf8')));
    const skyDirectory = dirname(containedPath(sourceDirectory, recipe.sky.path));
    if (options.acquisitionCache) await acquireSkySource(skyDirectory, skyRecipe, resolve(options.acquisitionCache));
    // The point field is a sibling object; its pinned descriptor makes the bake reproducible.
    const stars = skyRecipe.stars ? await loadSkyStarSprites(resolve(objectDirectory, '..', skyRecipe.stars.object), skyRecipe.stars) : undefined;
    const compiled = compileCssSky(await prepareSkyFaces({ sourceDirectory: skyDirectory, outputDirectory, recipe: skyRecipe, ...(stars ? { stars } : {}) }), descriptor.volume);
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
    [...data.stacks.flatMap(stack => stack.leaves), ...data.detailPlanes ?? []].map(leaf => leaf.texturePath));
  if (outputDirectory === resolve(objectDirectory, 'prepared')) {
    await options.inventory!({ objectId: descriptor.id, objectDirectory, preparedRoot: outputDirectory });
  }
  const decodedBytes = data.resources.reduce((sum, resource) => sum + resource.width * resource.height * 4, 0);
  console.log(`PREPARED ${descriptor.id}: ${data.stacks.reduce((count, stack) => count + stack.leaves.length, 0)} PolyCSS leaves; ${decodedBytes} decoded RGBA bytes; ${outputPath}`);
  return envelope;
}

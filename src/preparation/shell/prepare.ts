/** Self-contained preparation entry point for pinned transparent surface objects. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseDensityVolumeFrame, parseObjectDescriptor } from '@cssearth/objects';
import { record, text } from '@cssearth/volume-core/contracts/volume-recipe';
import { sourceBytes, sha256, containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { parseShellRecipe } from './config.js';
import { loadShellMesh } from './mesh.js';
import { prepareShellAtlas } from './atlas.js';
import { compileCssSurfaceShell } from '../../renderers/css/preparation/shell.js';
import { inventoryPreparedAssets } from '../../platform/runtime-asset-closure.mts';

export async function prepareSurfaceShellObject(options: { objectDirectory: string; outputDirectory?: string }) {
  const objectDirectory = resolve(options.objectDirectory), outputDirectory = resolve(options.outputDirectory ?? resolve(objectDirectory, 'prepared'));
  const descriptorPath = resolve(objectDirectory, 'object.json');
  const descriptor = parseObjectDescriptor(JSON.parse(await readFile(descriptorPath, 'utf8')) as unknown);
  if (descriptor.type !== 'surface-shell') throw new TypeError('Object descriptor is not a surface-shell.');
  const properties = record(descriptor.properties, 'properties'), frame = parseDensityVolumeFrame(properties.frame);
  const preparation = record(properties.preparation, 'preparation');
  const source = text(preparation.source, 'preparation source');
  const configBytes = await readFile(containedPath(objectDirectory, source));
  const recipe = parseShellRecipe(JSON.parse(configBytes.toString('utf8')) as unknown);
  if (JSON.stringify(frame) !== JSON.stringify(recipe.frame)) throw new TypeError('Shell recipe and descriptor physical frames disagree.');
  const sourceDirectory = dirname(containedPath(objectDirectory, source));
  const provenanceBytes = await sourceBytes(sourceDirectory, recipe.provenance);
  const provenance = record(JSON.parse(provenanceBytes.toString('utf8')) as unknown, 'provenance');
  if (!Array.isArray(provenance.sources)) throw new TypeError('Surface provenance must identify its pinned sources.');
  for (const value of provenance.sources) {
    const source = record(value, 'provenance source');
    await sourceBytes(sourceDirectory, { path: text(source.path, 'source path') });
  }
  const mesh = await loadShellMesh(sourceDirectory, recipe), atlas = await prepareShellAtlas(recipe);
  await mkdir(outputDirectory, { recursive: true });
  const atlasPath = 'rim-atlas.png', meshPath = 'surface-mesh.json';
  const meshBytes = Buffer.from(JSON.stringify({ schema: 'cssearth-surface-mesh@1', ...mesh }) + '\n');
  await writeFile(resolve(outputDirectory, atlasPath), atlas.png);
  await writeFile(resolve(outputDirectory, meshPath), meshBytes);
  const data = compileCssSurfaceShell({ id: descriptor.id, recipe, mesh,
    atlasResource: { path: atlasPath, sha256: sha256(atlas.png), bytes: atlas.png.length, width: atlas.width, height: atlas.height },
    provenance: { ...provenance, preparationSha256: sha256(configBytes), mesh: { path: meshPath, sha256: sha256(meshBytes), bytes: meshBytes.length } } });
  const envelope = { schema: 'cssearth-prepared-object@1' as const, id: descriptor.id, type: 'surface-shell' as const,
    format: 'cssearth-surface-shell@1' as const, data };
  const bytes = Buffer.from(JSON.stringify(envelope) + '\n'), outputPath = resolve(outputDirectory, 'shell.json');
  await writeFile(outputPath, bytes);
  if (outputDirectory === resolve(objectDirectory, 'prepared')) {
    await writeFile(descriptorPath, JSON.stringify({ ...descriptor, prepared: { format: envelope.format,
      url: relative(objectDirectory, outputPath).split('\\').join('/'), sha256: sha256(bytes) } }, null, 2) + '\n');
    await inventoryPreparedAssets({ planetId: descriptor.id, objectDirectory, preparedRoot: outputDirectory });
  }
  console.log(`PREPARED ${descriptor.id}: ${data.faces.length} PolyCSS triangle leaves; ${atlas.width * atlas.height * 4} decoded RGBA bytes; ${outputPath}`);
  return envelope;
}

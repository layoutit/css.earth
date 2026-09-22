/** Compact authored-placement replay. Reuses every canonical texture and grid byte. */
import { readFile, mkdir, symlink, rename, rm, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { parseDensityPlacement, placeDensitySlices } from '@cssearth/volume-core/coordinates/density-placement';
import type { VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';
import { sha256, sourceBytes, containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { parseLabModelJson } from '../../../resources/model-paths.ts';
export interface PlacedDensityOptions { sourceDirectory: string; outputDirectory: string; placement: { path: string; sha256: string }; }
export async function preparePlacedDensity(root: string, options: PlacedDensityOptions) {
  const source = containedPath(root, options.sourceDirectory), output = containedPath(root, options.outputDirectory);
  if (!output.startsWith(resolve(root, '.local/nebula-lab') + '/'))
    throw new TypeError('Placed density must be prepared in its own ignored lab directory.');
  const placementRecord = parseLabModelJson((await sourceBytes(root, options.placement)).toString());
  const placement = parseDensityPlacement(placementRecord);
  if (output === source || source.startsWith(output + '/')) throw new TypeError('Placed output cannot contain its canonical source.');
  const descriptorBytes = await readFile(resolve(source, 'object.json')), descriptor = parseLabModelJson(descriptorBytes.toString());
  const sourceSlicesBytes = await readFile(resolve(source, 'prepared/volume-slices.json'));
  const sourceSlices = parseLabModelJson(sourceSlicesBytes.toString()) as VolumeSlices;
  const original = await sourceBytes(source, { path: descriptor.properties.preparation.source });
  if (!placementRecord.originalDensity || sha256(await sourceBytes(root, placementRecord.originalDensity)) !== sha256(original))
    throw new TypeError('Authored placement must pin its canonical density recipe.');
  const sourceRecipe = parseLabModelJson(original.toString());
  await sourceBytes(dirname(resolve(source, descriptor.properties.preparation.source)), sourceRecipe.grid);
  const identity = { sourceDescriptor: sha256(descriptorBytes), sourceSlices: sha256(sourceSlicesBytes), placement: options.placement };
  const id = `placed-density-${sha256(Buffer.from(JSON.stringify(identity))).slice(0, 24)}`;
  const existing = await readFile(resolve(output, 'placement-receipt.json'), 'utf8').catch(() => null);
  if (existing && JSON.parse(existing).id === id) {
    try {
      const cached = parseLabModelJson((await readFile(resolve(output, 'object.json'))).toString());
      const manifest = parseLabModelJson((await sourceBytes(output, { path: cached.prepared.url })).toString());
      for (const resource of manifest.data.resources) await sourceBytes(resolve(output, 'prepared'), { path: resource.path });
      await sourceBytes(output, { path: 'prepared/volume-slices.json' });
      return;
    } catch { /* Restore missing or damaged generated products from the pinned originals. */ }
  }
  const temporary = `${output}.pending`;
  await rm(temporary, { recursive: true, force: true }); await mkdir(resolve(temporary, 'prepared'), { recursive: true });
  try {
    await symlink(await realpath(resolve(source, 'source')), resolve(temporary, 'source'), 'dir');
    for (const quad of sourceSlices.quads) {
      await sourceBytes(resolve(source, 'prepared'), { path: quad.texturePath });
      const target = containedPath(resolve(temporary, 'prepared'), quad.texturePath); await mkdir(dirname(target), { recursive: true });
      await symlink(await realpath(containedPath(resolve(source, 'prepared'), quad.texturePath)), target).catch(error => { if (error.code !== 'EEXIST') throw error; });
    }
    const slices = placeDensitySlices(sourceSlices, placement);
    slices.provenance = { schema: 'cssearth-placed-density@1', sourceDirectory: options.sourceDirectory, identity,
      placement, limitation: 'Authored simulation-to-sky display registration; no new measured gas/dust geometry.' };
    const frame = { ...descriptor.properties.volume, boundsUnits: slices.boundsUnits };
    const data = compileCssVolume({ id, frame, slices, recipe: { anchors: [] } });
    const prepared = Buffer.from(JSON.stringify({ schema: 'cssearth-prepared-object@1', id, type: 'density-volume', format: 'cssearth-density-volume@1', data }) + '\n');
    await writeFile(resolve(temporary, 'prepared/volume.json'), prepared);
    const slicesBytes = Buffer.from(JSON.stringify(slices, null, 2) + '\n');
    await writeFile(resolve(temporary, 'prepared/volume-slices.json'), slicesBytes);
    await writeFile(resolve(temporary, 'object.json'), JSON.stringify({ ...descriptor, id, properties: { ...descriptor.properties, volume: frame },
      prepared: { format: 'cssearth-density-volume@1', url: 'prepared/volume.json', sha256: sha256(prepared) } }, null, 2) + '\n');
    await writeFile(resolve(temporary, 'placement-receipt.json'), JSON.stringify({ id, ...identity, slicesSha256: sha256(slicesBytes), reusedAlpha: true, reusedGrid: true }, null, 2) + '\n');
    // This directory owns only generated placement products; its source assets remain at their original paths.
    await rm(output, { recursive: true, force: true }); await rename(temporary, output);
  } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
}

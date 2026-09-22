/** Load one body's surface-observation lens through the shared pipeline, for tests that check what its preview covers. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord } from '../../../tools/sources/source-values.mts';
import { parseRadialLoaderConfig } from '../../../tools/objects/terrestrial-layers/radial-source.mts';
import { loadRadialTerrain, requireTerrainMesh } from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { loadSurfaceObservation } from '../../../tools/objects/surface-observations/index.mts';

export async function loadLens(body: string, lensId: string, change: (recipe: Record<string, unknown>) => void = () => {}) {
  const sourceDirectory = resolve('src/objects', body, 'source');
  const file = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8'));
  const recipe = requireArray(requireRecord(requireRecord(file).raster).surfaceObservations).map(value => requireRecord(value)).find(lens => lens.id === lensId);
  if (!recipe) throw new Error(`${body} has no ${lensId} lens.`);
  change(recipe);
  const source = await createSourceManifest({ planetId: body, planetName: body, sourceRoot: sourceDirectory });
  const radial = await loadRadialTerrain({ config: parseRadialLoaderConfig(file), sourceDirectory, source });
  if (!radial) throw new Error(`${body} has no radial terrain.`);
  return loadSurfaceObservation({ sourceDirectory, source, recipe, radial: { grid: requireTerrainMesh(radial.grid), faces: radial.faces },
    config: { geometry: { radius: file.geometry.radius, radiusKm: file.geometry.radiusKm, radialTerrain: file.geometry.radialTerrain }, raster: file.raster } });
}

/** How many preview pixels the lens covers. */
export const coveredPixels = (missing: Uint8Array) => missing.reduce((sum, value) => sum + (value ? 0 : 1), 0);

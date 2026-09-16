/**
 * Load a body's surface-observation lenses the way preparation does, without packing an atlas, and hand back their
 * reports. The standalone registration stage and the scaffold both read a body through this, so a lens is measured the
 * same way whether it was prepared, re-measured or just wired.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString } from '../source-values.mts';
import { loadRadialModels, radialModelForLens } from './terrestrial-layers/radial-models.mts';
import { requireTerrainMesh } from './terrestrial-layers/radial-terrain.mts';
import { loadSurfaceObservation, type SurfaceObservationReport } from './surface-observations/index.mts';

export interface MeasuredLens { id: string; report: SurfaceObservationReport }

/** Every lens of the body under `raster.surfaceObservations`, loaded and measured; an empty list for a body without one. */
export async function measureBody(root: string, objectId: string): Promise<MeasuredLens[]> {
  const sourceDirectory = resolve(root, 'src/objects', objectId, 'source');
  const config = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8')));
  const lenses = requireArray(requireRecord(config.raster).surfaceObservations ?? []).map(value => requireRecord(value));
  if (!lenses.length) return [];
  const source = await createSourceManifest({ planetId: objectId, planetName: requireString(config.displayName), sourceRoot: sourceDirectory });
  await source.verify();
  const models = await loadRadialModels({ config: config as unknown as Parameters<typeof loadRadialModels>[0]['config'], sourceDirectory, source });
  const measured: MeasuredLens[] = [];
  for (const recipe of lenses) {
    const id = requireString(recipe.id), model = radialModelForLens(models, id);
    const observation = await loadSurfaceObservation({ sourceDirectory, source, recipe,
      radial: { ...model.radial, grid: requireTerrainMesh(model.radial.grid) },
      config: { geometry: model.config.geometry as Parameters<typeof loadSurfaceObservation>[0]['config']['geometry'], raster: config.raster as Parameters<typeof loadSurfaceObservation>[0]['config']['raster'] } });
    measured.push({ id, report: observation.report });
  }
  return measured;
}

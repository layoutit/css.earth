/** The surface-observation route: one validator and one loader for every photograph format. See README.md. */
import type { SurfaceOptions } from '../terrestrial-layers/contracts.mts';
import type { SurfaceObservationFormat } from './contract.mts';
import { requireRecord, requireString } from '../../source-values.mts';
import { GEO_FORMATS, geoFormat } from './formats/geo.mts';
import { encounterFormat } from './formats/encounter.mts';
import { orthographicFormat } from './formats/orthographic.mts';
import { createSurfaceObservation, type SurfaceObservation } from './surface.mts';

export type { SurfaceObservation, SurfaceObservationReport } from './surface.mts';

/** Every format an owner can name in `raster.surfaceObservations`. A new archive product adds an adapter here. */
export const SURFACE_OBSERVATION_FORMATS: Readonly<Record<string, SurfaceObservationFormat>> = {
  ...Object.fromEntries(GEO_FORMATS.map(format => [format, geoFormat])),
  'encounter-fits': encounterFormat,
  'isis2-orthographic': orthographicFormat,
};

const formatOf = (recipe: unknown) => {
  const format = SURFACE_OBSERVATION_FORMATS[String(requireRecord(recipe).format)];
  if (!format) throw new TypeError('Invalid source-bound surface observation format.');
  return format;
};

export function validateSurfaceObservation(recipe: unknown, sourceGeometry: unknown) {
  formatOf(recipe).validate(recipe, sourceGeometry);
}

export async function loadSurfaceObservation({ sourceDirectory, source, recipe, radial, config }: SurfaceOptions): Promise<SurfaceObservation> {
  const format = formatOf(recipe);
  format.validate(recipe, config.geometry.radialTerrain);
  const entries = await source.validateGroup(requireString(requireRecord(recipe).consumer)), paths = format.paths(recipe);
  if (entries.length !== paths.length || new Set(paths).size !== paths.length || !paths.every(path => entries.some(entry => entry.path === path))) {
    throw new Error('A surface observation must consume exactly its pinned images, labels, cameras and companions.');
  }
  const { frames, policy } = await format.load(recipe, { sourceDirectory, source, radial, config, entries });
  return createSurfaceObservation({ frames, policy, radial, config, entries });
}

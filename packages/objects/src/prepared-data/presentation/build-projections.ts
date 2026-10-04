/** Narrow data-only admissions used by build consumers; no geometry or editorial policy. */
import { COMPACT_DENSITY_DELIVERY_SCHEMA } from '../../volume/compact/compact-density-delivery.js';
import { UNIFORM_DISC_STAR_SCHEMA } from '../photometry/uniform-disc-star.js';
import { PREPARED_FEATURES_SCHEMA } from '../surface/prepared-features.js';
import { parsePreparedPanelContent, PREPARED_CONTENT_SCHEMA } from '../content/prepared-content.js';
import { GALAXY_BACKING_SCHEMA } from '../catalogue/galaxy-backing.js';
import { NEBULA_DELIVERY_SCHEMA } from '../../volume/nebula/nebula-delivery.js';
import { VOLUME_DATASET_MANIFEST_SCHEMA } from '../../volume/delivery/volume-dataset-manifest.js';
import { requireRecord, requireArray, requireString, requireFiniteNumber, isRecord } from '@cssearth/core';
import { CHART_ASSETS_SCHEMA } from './presentation-recipe-schemas.js';
import { SOURCE_MANIFEST_SCHEMA } from '../../sources/source-manifest-schema.js';
import { VOLUME_SOURCE_MANIFEST_SCHEMA } from '../source/volume-source-manifest.js';
import { PREPARED_SURFACE_FEATURES_SCHEMA } from '../surface/surface-feature-types.js';
import { OBJECT_RUNTIME_SCHEMA } from '../runtime/object-controls.js';
import { RASTER_RECIPE_SCHEMA } from '../surface/raster-recipe.js';
import { parseObjectDescriptor } from '../../parse.js';

/** Descriptor rewrites preserve accepted source metadata, including its generator. */
export function readObjectDescriptorRecord(value: unknown) {
  parseObjectDescriptor(value);
  return requireRecord(value);
}

export function readChartAssetRecipe(value: unknown) {
  const recipe = requireRecord(value, 'charts');
  if (recipe.schema !== CHART_ASSETS_SCHEMA) throw new TypeError('Unknown chart recipe schema.');
  const publicBase = requireString(recipe.publicBase);
  if (!publicBase.startsWith('/') || !publicBase.endsWith('/')) throw new TypeError('Chart asset base must be an absolute URL prefix.');
  requireArray(recipe.charts).forEach(value => requireRecord(value, 'chart'));
  return recipe;
}
export function readSourceManifestInputs(value: unknown): Record<string, unknown> & { inputs: Record<string, unknown>[] } {
  const manifest = requireRecord(value, 'source manifest');
  if (manifest.schema !== SOURCE_MANIFEST_SCHEMA && manifest.schema !== VOLUME_SOURCE_MANIFEST_SCHEMA) throw new TypeError('Invalid source manifest schema.');
  return { ...manifest, inputs: requireArray(manifest.inputs).map(value => requireRecord(value)) };
}
export function readFeatureSearchCatalog(value: unknown, objectId: string, count: unknown) {
  const catalog = requireRecord(value);
  if (catalog.schema !== PREPARED_SURFACE_FEATURES_SCHEMA || catalog.objectId !== objectId) throw new TypeError(`${objectId}: feature catalogue schema or owner differs.`);
  const features = requireArray(catalog.features).map(value => {
    const feature = requireRecord(value);
    for (const key of ['id', 'name', 'type', 'searchContext']) requireString(feature[key]);
    requireArray(feature.searchNames).forEach(value => requireString(value));
    for (const key of ['diameterKm', 'latitudeDeg', 'longitudeDeg']) if (typeof feature[key] !== 'number' || !Number.isFinite(feature[key])) throw new TypeError(`Invalid feature ${key}.`);
    return feature;
  });
  if (features.length !== count) throw new TypeError(`${objectId}: feature catalogue count differs from its descriptor.`);
  return { ...catalog, features };
}
export function readRuntimeFeatureDatasets(value: unknown): string[] {
  const runtime = requireRecord(value);
  if (runtime.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError('Invalid runtime feature schema.');
  const ids = requireArray(requireRecord(runtime.features).datasetIds).map(value => requireString(value));
  if (!ids.length) throw new TypeError('Landmark datasets are missing.');
  return ids;
}
export function readRasterDiscovery(value: unknown): Record<string, unknown> {
  const recipe = requireRecord(value);
  if (recipe.schema !== RASTER_RECIPE_SCHEMA) throw new TypeError('Invalid raster discovery schema.');
  const raster = isRecord(recipe.raster) ? recipe.raster : recipe;
  for (const key of ['observations', 'surfaceObservations', 'observedColors', 'mosaics', 'surfaces']) {
    if (raster[key] === undefined) continue;
    for (const value of requireArray(raster[key])) {
      const entry = requireRecord(value); requireString(entry.id);
      if (entry.science !== undefined) (() => { const science = requireRecord(entry.science); if (science.kind !== undefined) requireString(science.kind); })();
      if (entry.metadata !== undefined) {
        const metadata = requireRecord(entry.metadata);
        for (const flag of ['simulation', 'modeled']) if (metadata[flag] !== undefined && typeof metadata[flag] !== 'boolean') throw new TypeError(`Invalid discovery ${flag}.`);
      }
    }
  }
  return recipe;
}

export const SYSTEM_TEXT_SCHEMA = 'cssearth-system-text@1';
export function readSystemText(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== SYSTEM_TEXT_SCHEMA || Object.keys(record).some(key => !['schema', 'satellites'].includes(key))) throw new TypeError('Unsupported system text schema.');
  return requireRecord(record.satellites);
}

/** Unversioned source catalogue presentation only; never admits a shared schema-bearing presentation. */
export function readCataloguePresentationDistances<Field extends string>(value: unknown, fields: readonly Field[]): Record<Field, number> {
  const record = requireRecord(value);
  if (record.schema !== undefined) throw new TypeError('Catalogue distances require an unversioned source presentation.');
  return Object.fromEntries(fields.map(field => {
    const number = record[field];
    if (typeof number !== 'number' || !(number > 0) || !Number.isFinite(number)) throw new TypeError(`${field} must be a positive number.`);
    return [field, number];
  })) as Record<Field, number>;
}

export const PREPARED_VOLUME_PRESENTATION_SCHEMA = 'cssearth-volume-presentation@2';
export const DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA = 'cssearth-density-volume-dataset-bank-source@1';
/** Preview/resource projection. The shell's field and source/dataset join admission is a separate policy. */
export function readVolumePresentationPreviews(value: unknown, policy?: 'required'): ReturnType<typeof volumePreviews>;
export function readVolumePresentationPreviews(value: unknown, policy: 'candidate'): ReturnType<typeof volumePreviews> | null;
export function readVolumePresentationPreviews(value: unknown, policy: 'required' | 'candidate' = 'required') {
  const record = requireRecord(value);
  if (record.schema !== PREPARED_VOLUME_PRESENTATION_SCHEMA) {
    if (policy === 'candidate') return null;
    throw new TypeError('Invalid prepared volume presentation schema.');
  }
  return volumePreviews(record);
}
function volumePreviews(record: Record<string, unknown>) {
  const objectId = requireString(record.objectId), defaultDataset = requireString(record.defaultDataset);
  const controls = requireArray(record.controls).map(value => {
    const control = requireRecord(value), texture = requireRecord(control.texture);
    for (const key of ['width', 'height']) if (typeof texture[key] !== 'number' || !Number.isFinite(texture[key]) || !(texture[key] > 0)) throw new TypeError(`Invalid volume preview ${key}.`);
    return { ...control, id: requireString(control.id), thumbnailUrl: requireString(control.thumbnailUrl), texture: { ...texture, url: requireString(texture.url) } };
  });
  if (!controls.some(control => control.id === defaultDataset)) throw new TypeError('Invalid volume presentation default dataset.');
  return { ...record, objectId, defaultDataset, controls };
}
export function readVolumeAttachment(value: unknown) {
  const record = requireRecord(value);
  if (![NEBULA_DELIVERY_SCHEMA, VOLUME_DATASET_MANIFEST_SCHEMA, DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA, COMPACT_DENSITY_DELIVERY_SCHEMA].includes(String(record.schema))) throw new TypeError('Invalid volume attachment source schema.');
  return { attachedTo: record.attachedTo === undefined ? undefined : requireString(record.attachedTo) };
}
export function readGalaxyBackingSource(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== GALAXY_BACKING_SCHEMA) throw new TypeError('Invalid galaxy backing schema.');
  return { ...record, source: requireString(record.source), leaf: { texturePath: requireString(requireRecord(record.leaf).texturePath) } };
}

export const WORLD_CONTEXT_SOURCE_SCHEMA = 'cssearth-world-context-source@1';
/** The authored membership projection, before the scientific owner resolves catalogue membership and frame facts. */
export function readWorldContextSourceSelection(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== WORLD_CONTEXT_SOURCE_SCHEMA) throw new TypeError('Unsupported world context source schema.');
  const focus = requireRecord(record.focus), bodies = record.bodies === 'catalog' ? 'catalog' : requireArray(record.bodies).map(value => requireRecord(value));
  return { ...record, focus: { ...focus, id: requireString(focus.id) }, bodies,
    frame: { ...requireRecord(record.frame), epochJdTt: requireFiniteNumber(requireRecord(record.frame).epochJdTt) }, volume: requireRecord(record.volume), stars: requireRecord(record.stars) };
}
export const STELLAR_EXTENT_SOURCE_SCHEMA = 'cssearth-stellar-extent@1';
export function readStellarExtent(value: unknown, objectId: string, path: string) {
  const record = requireRecord(value);
  if (record.schema !== STELLAR_EXTENT_SOURCE_SCHEMA || record.objectId !== objectId) throw new TypeError(`${path}: expected a ${STELLAR_EXTENT_SOURCE_SCHEMA} record for ${objectId}.`);
  const radiusPc = record.radiusPc, source = record.source;
  if (typeof radiusPc !== 'number' || !(radiusPc > 0) || !Number.isFinite(radiusPc)) throw new TypeError(`${path}: radiusPc must be a positive number, got ${String(radiusPc)}.`);
  if (typeof source !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(source)) throw new TypeError(`${path}: source must name a src/sources record, got ${String(source)}.`);
  return { radiusPc, source };
}

/** Preserve source-owned extra metadata while admitting the shared panel fields. */
export function readPreparedPanelContentRecord(value: unknown) {
  parsePreparedPanelContent(value);
  return requireRecord(value);
}
/** Source comparison reads dictionary contents only after binding the historical schema to its current source. */
export function readComparableSource(value: unknown, reference: unknown) {
  const record = requireRecord(value), current = requireRecord(reference);
  if (record.schema !== current.schema) return null;
  return record;
}

/** Star dot photometry consumes only radius and temperature, not the measurement document's other scientific fields. */
export function readStellarDotMeasurements(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== undefined && ![UNIFORM_DISC_STAR_SCHEMA, HOSTED_PLANET_MEASUREMENTS_SCHEMA, NEUTRON_STAR_MEASUREMENTS_SCHEMA].includes(String(record.schema))) throw new TypeError('Invalid stellar dot measurement schema.');
  const optional = (key: string): number | undefined => {
    if (record[key] === undefined) return undefined;
    return requireFiniteNumber(record[key], key);
  };
  return { radiusKm: optional('radiusKm'), effectiveTemperatureK: optional('effectiveTemperatureK') };
}
export function readFeatureMapLongitude(value: unknown): number | undefined {
  const record = requireRecord(value);
  if (record.schema !== undefined && record.schema !== PREPARED_FEATURES_SCHEMA) throw new TypeError('Invalid feature map placement schema.');
  return record.mapLeftEdgeLongitudeDeg === undefined ? undefined : requireFiniteNumber(record.mapLeftEdgeLongitudeDeg);
}

export const PACKAGED_POINTS_SOURCE_SCHEMA = 'cssearth-packaged-points-source@1';
/** Membership preparation compares the bank frame; catalogue production owns table and appearance admission. */
export function readPackagedPointsFrame(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== PACKAGED_POINTS_SOURCE_SCHEMA) throw new TypeError('Invalid packaged points source schema.');
  const frame = requireRecord(record.frame);
  return { frame: { referenceFrame: requireString(frame.referenceFrame), epochJdTt: requireFiniteNumber(frame.epochJdTt) } };
}

export const HOSTED_PLANET_MEASUREMENTS_SCHEMA = 'cssearth-hosted-planet@1';
export const NEUTRON_STAR_MEASUREMENTS_SCHEMA = 'cssearth-neutron-star@1';
/** Chart refresh preserves unrelated panel bytes and consumes only the chart image references. */
export function readPreparedChartContentRecord(value: unknown) {
  const record = requireRecord(value);
  if (record.schema !== PREPARED_CONTENT_SCHEMA) throw new TypeError('Invalid prepared chart content schema.');
  requireString(record.objectId);
  for (const value of requireArray(record.charts)) requireString(requireRecord(value).src);
  return record;
}

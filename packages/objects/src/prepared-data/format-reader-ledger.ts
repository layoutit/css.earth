import { COMPACT_DENSITY_DELIVERY_SCHEMA } from '../volume/compact-density-delivery.js';
import { HOSTED_PLANET_MEASUREMENTS_SCHEMA, NEUTRON_STAR_MEASUREMENTS_SCHEMA } from './build-projections.js';
import { PACKAGED_POINTS_SOURCE_SCHEMA } from './build-projections.js';
import { OBJECT_TEXT_SCHEMA, PREPARED_TEXT_SCHEMA } from './object-text.js';
import { PREPARED_EXPLORATION_SCHEMA } from '../provenance/prepared-exploration.js';
import { UNIFORM_DISC_STAR_SCHEMA } from './uniform-disc-star.js';
import { PREPARED_CONTENT_SCHEMA } from './prepared-content.js';
import { AUTHORED_PREPARATION_SCHEMA } from './authored-preparation.js';
import { WORLD_CONTEXT_SOURCE_SCHEMA, STELLAR_EXTENT_SOURCE_SCHEMA } from './build-projections.js';
import { PREPARED_VOLUME_PRESENTATION_SCHEMA, DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA } from './build-projections.js';
import { GALAXY_BACKING_SCHEMA } from './galaxy-backing.js';
import { PREPARED_GALAXY_CATALOG_SCHEMA } from './galaxy-catalog.js';
import { NEBULA_DELIVERY_SCHEMA } from '../volume/nebula-delivery.js';
import { PREPARED_IMAGE_LAYER_BANK_SCHEMA } from '../volume/volume-schemas.js';
/** Format admission entry points and generated addresses. Source addresses are discovered from schema-bearing data. */
import { OBJECT_SCHEMA } from '../descriptor.js';
import { OBJECT_CONTENT_SCHEMA } from './object-content.js';
import { OBJECT_RUNTIME_SCHEMA } from './object-controls.js';
import { PREPARED_DESTINATIONS_SCHEMA } from './prepared-destinations.js';
import { PREPARED_FEATURES_SCHEMA } from './prepared-features.js';
import { PREPARED_SURFACE_FEATURES_SCHEMA } from './surface-feature-types.js';
import { PREPARED_WORLD_CONTEXT_SCHEMA, PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA } from './world-schemas.js';
import { CHART_ASSETS_SCHEMA } from './presentation-recipe-schemas.js';
import { RASTER_RECIPE_SCHEMA } from './raster-recipe.js';
import { SHAPE_MODEL_SCHEMA } from './discovery-readers.js';
import { VOLUME_SOURCE_MANIFEST_SCHEMA } from './volume-source-manifest.js';
import { VOLUME_PRESENTATION_SOURCE_SCHEMA } from './volume-presentation-source.js';
import { SOURCE_MANIFEST_SCHEMA } from '../sources/source-manifest-schema.js';
import { SYSTEM_TEXT_SCHEMA } from './build-projections.js';
import { FACILITY_CATALOG_SCHEMA } from '../provenance/exploration-catalog.js';
import { PREPARED_CUBIC_SKY_SCHEMA, PREPARED_DIRECTIONAL_SUN_SCHEMA } from './runtime-camera-types.js';

export interface FormatReaderPolicy { readonly schema: string; readonly readers: readonly string[]; readonly paths: readonly string[] }
/** The architecture check reads this data through the AST before any workspace build. No filesystem discovery lives here. */
export const FORMAT_READER_POLICIES: readonly FormatReaderPolicy[] = [
  { schema: FACILITY_CATALOG_SCHEMA, readers: ['parseExplorationCatalog'], paths: [] },
  { schema: PREPARED_CUBIC_SKY_SCHEMA, readers: ['validatePreparedCubicSky'], paths: ['prepared/sky.json', 'sky.json'] },
  { schema: PREPARED_DIRECTIONAL_SUN_SCHEMA, readers: ['validateDirectionalSunPlan'], paths: ['prepared/sun.json', 'sun.json'] },
  { schema: COMPACT_DENSITY_DELIVERY_SCHEMA, readers: ['readVolumeAttachment'], paths: [] },
  { schema: HOSTED_PLANET_MEASUREMENTS_SCHEMA, readers: ['readStellarDotMeasurements'], paths: [] },
  { schema: NEUTRON_STAR_MEASUREMENTS_SCHEMA, readers: ['readStellarDotMeasurements'], paths: [] },
  { schema: PACKAGED_POINTS_SOURCE_SCHEMA, readers: ['readPackagedPointsFrame'], paths: ['source/packaged-stars/points.json'] },
  { schema: UNIFORM_DISC_STAR_SCHEMA, readers: ['parseUniformDiscStarMeasurements', 'readStellarDotMeasurements'], paths: [] },
  { schema: PREPARED_CONTENT_SCHEMA, readers: ['parsePreparedPanelContent', 'readPreparedPanelContentRecord', 'readPreparedChartContentRecord'], paths: ['prepared/content.json'] },
  { schema: AUTHORED_PREPARATION_SCHEMA, readers: ['readAuthoredPreparationSources', 'readPublishedPreparationSources'], paths: ['prepared/authored-preparation.json'] },
  { schema: WORLD_CONTEXT_SOURCE_SCHEMA, readers: ['readWorldContextSourceSelection'], paths: [] },
  { schema: STELLAR_EXTENT_SOURCE_SCHEMA, readers: ['readStellarExtent'], paths: [] },
  { schema: PREPARED_VOLUME_PRESENTATION_SCHEMA, readers: ['readVolumePresentationPreviews'], paths: ['prepared/presentation.json'] },
  { schema: DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA, readers: ['readVolumeAttachment'], paths: [] },
  { schema: NEBULA_DELIVERY_SCHEMA, readers: ['readVolumeAttachment'], paths: [] },
  { schema: GALAXY_BACKING_SCHEMA, readers: ['parseGalaxyBacking', 'readGalaxyBackingSource'], paths: ['prepared/backing.json'] },
  { schema: PREPARED_GALAXY_CATALOG_SCHEMA, readers: ['parsePreparedGalaxyCatalog'], paths: [] },
  { schema: PREPARED_IMAGE_LAYER_BANK_SCHEMA, readers: ['validatePreparedImageLayerBank'], paths: [] },
  { schema: OBJECT_SCHEMA, readers: ['parseObjectDescriptor', 'readObjectDescriptorRecord'], paths: ['object.json'] },
  { schema: OBJECT_CONTENT_SCHEMA, readers: ['parseCompleteObjectContentSource', 'readObjectContentDatasets', 'readObjectContentPanel', 'validateObjectContentEnvelope'], paths: ['source/content/object.json', 'content/object.json'] },
  { schema: OBJECT_RUNTIME_SCHEMA, readers: ['parsePreparedObjectRuntime', 'requireObjectRuntimeDefinition', 'readRuntimeCamera', 'readRuntimeCameraPrefix', 'readRuntimeFeatureDatasets'], paths: ['prepared/runtime.json', 'runtime.json'] },
  { schema: PREPARED_DESTINATIONS_SCHEMA, readers: ['parsePreparedDestinations', 'readDestinationSettlements'], paths: [] },
  { schema: PREPARED_FEATURES_SCHEMA, readers: ['readPreparedFeaturePins', 'readFeatureMapLongitude'], paths: ['prepared/features.json'] },
  { schema: PREPARED_SURFACE_FEATURES_SCHEMA, readers: ['parsePreparedSurfaceFeatureCatalog', 'readFeatureSearchCatalog'], paths: [] },
  { schema: PREPARED_WORLD_CONTEXT_SCHEMA, readers: ['parsePreparedWorldContext', 'parsePreparedWorldContextPlan'], paths: ['prepared/world-context.json', 'world-context.json'] },
  { schema: PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, readers: ['parsePreparedWorldContextSummary', 'parsePreparedWorldContextPlan'], paths: ['prepared/world-context-summary.json'] },
  { schema: CHART_ASSETS_SCHEMA, readers: ['parseChartAssetRecipe', 'readChartAssetRecipe'], paths: ['source/content/charts.json', 'content/charts.json'] },
  { schema: RASTER_RECIPE_SCHEMA, readers: ['parseRasterRecipe', 'readRasterDiscovery'], paths: [] },
  { schema: SHAPE_MODEL_SCHEMA, readers: ['readShapeModelDiscovery'], paths: [] },
  { schema: VOLUME_SOURCE_MANIFEST_SCHEMA, readers: ['parseVolumeSourceManifest', 'readSourceManifestInputs'], paths: [] },
  { schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, readers: ['parseVolumePresentationSource', 'hasVolumePresentationSource', 'readCataloguePresentationDistances'], paths: [] },
  { schema: SOURCE_MANIFEST_SCHEMA, readers: ['validateSourceManifest', 'readSourceManifestInputs'], paths: [] },
  { schema: SYSTEM_TEXT_SCHEMA, readers: ['readSystemText'], paths: ['navigation/system-text.json'] },
  { schema: OBJECT_TEXT_SCHEMA, readers: ['parseObjectText'], paths: ['text.json'] },
  { schema: PREPARED_TEXT_SCHEMA, readers: ['parsePreparedText'], paths: ['prepared/text.json'] },
  { schema: PREPARED_EXPLORATION_SCHEMA, readers: ['parsePreparedExploration'], paths: ['site/prepared-facilities.json'] },
];

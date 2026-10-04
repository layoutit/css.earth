import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readChartAssetRecipe, readSourceManifestInputs, readFeatureSearchCatalog, readRuntimeFeatureDatasets, readRasterDiscovery, readSystemText, readCataloguePresentationDistances, SYSTEM_TEXT_SCHEMA } from './build-projections.js';
import { CHART_ASSETS_SCHEMA } from './presentation-recipe-schemas.js';
import { SOURCE_MANIFEST_SCHEMA } from '../../sources/source-manifest-schema.js';
import { PREPARED_SURFACE_FEATURES_SCHEMA } from '../surface/surface-feature-types.js';
import { OBJECT_RUNTIME_SCHEMA } from '../runtime/object-controls.js';
import { RASTER_RECIPE_SCHEMA } from '../surface/raster-recipe.js';
import { parseVolumeSourceManifest, VOLUME_SOURCE_MANIFEST_SCHEMA } from '../source/volume-source-manifest.js';
import { parseVolumePresentationSource, VOLUME_PRESENTATION_SOURCE_SCHEMA } from '../source/volume-presentation-source.js';
import { readObjectContentDatasets, readObjectContentPanel, OBJECT_CONTENT_SCHEMA, OBJECT_CONTENT_VERSION } from '../content/object-content.js';

test('every build subset rejects an incompatible schema before exposing fields', () => {
  const wrong = { schema: 'wrong' };
  for (const read of [readChartAssetRecipe, readSourceManifestInputs, readRuntimeFeatureDatasets, readRasterDiscovery,
    readSystemText, (value: unknown) => parseVolumeSourceManifest(value, { reader: 'presentation', objectId: 'nebula', policy: 'presentation-source' }), parseVolumePresentationSource, readObjectContentDatasets, readObjectContentPanel]) assert.throws(() => read(wrong));
  assert.throws(() => readFeatureSearchCatalog(wrong, 'body', 0));
  assert.throws(() => readCataloguePresentationDistances(wrong, ['distanceM']));
});
test('chart, source manifest and system subsets validate consumed containers', () => {
  assert.deepEqual(readChartAssetRecipe({ schema: CHART_ASSETS_SCHEMA, publicBase: '/scenes/body/', charts: [] }).charts, []);
  assert.throws(() => readChartAssetRecipe({ schema: CHART_ASSETS_SCHEMA, publicBase: 'relative', charts: [] }));
  assert.deepEqual(readSourceManifestInputs({ schema: SOURCE_MANIFEST_SCHEMA, inputs: [] }).inputs, []);
  assert.throws(() => readSourceManifestInputs({ schema: SOURCE_MANIFEST_SCHEMA, inputs: [0] }));
  assert.deepEqual(parseVolumeSourceManifest({ schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs: [] }, { reader: 'presentation', objectId: 'nebula', policy: 'presentation-source' }).inputs, []);
  assert.throws(() => parseVolumeSourceManifest({ schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'source', inputs: [] }, { reader: 'presentation', objectId: 'nebula', policy: 'presentation-source' }));
  assert.deepEqual(readSystemText({ schema: SYSTEM_TEXT_SCHEMA, satellites: {} }), {});
  assert.throws(() => readSystemText({ schema: SYSTEM_TEXT_SCHEMA, satellites: [], extra: true }));
});
test('feature search subset checks owner, count, identity, search text and coordinates', () => {
  const feature = { id: '1', name: 'City', type: 'City', searchContext: 'Body', searchNames: ['City'], diameterKm: 0, latitudeDeg: 1, longitudeDeg: 2 };
  const value = { schema: PREPARED_SURFACE_FEATURES_SCHEMA, objectId: 'body', features: [feature] };
  assert.deepEqual(readFeatureSearchCatalog(value, 'body', 1).features, [feature]);
  assert.throws(() => readFeatureSearchCatalog(value, 'other', 1));
  assert.throws(() => readFeatureSearchCatalog(value, 'body', 2));
  assert.throws(() => readFeatureSearchCatalog({ ...value, features: [{ ...feature, longitudeDeg: NaN }] }, 'body', 1));
  assert.deepEqual(readRuntimeFeatureDatasets({ schema: OBJECT_RUNTIME_SCHEMA, features: { datasetIds: ['shape'] } }), ['shape']);
  assert.throws(() => readRuntimeFeatureDatasets({ schema: OBJECT_RUNTIME_SCHEMA, features: { datasetIds: [] } }));
});
test('discovery preserves legitimate science without a kind and requires boolean flags', () => {
  const value = { schema: RASTER_RECIPE_SCHEMA, surfaces: [{ id: 'surface', science: { input: 'image' }, metadata: { modeled: true } }] };
  assert.equal(readRasterDiscovery(value), value);
  assert.throws(() => readRasterDiscovery({ ...value, schema: 'wrong' }));
  assert.throws(() => readRasterDiscovery({ ...value, surfaces: [{ id: 'surface', metadata: { simulation: 1 } }] }));
});
test('content subset accepts recipes whose chart dimensions and dataset source are produced later', () => {
  const value = { schema: OBJECT_CONTENT_SCHEMA, version: OBJECT_CONTENT_VERSION, id: 'body', displayName: 'Body',
    datasets: { defaultDataset: 'shape', controls: [{ id: 'shape', label: 'Shape' }] }, charts: [{ id: 'chart' }], panel: {} };
  assert.equal(readObjectContentDatasets(value).datasets.controls[0]?.id, 'shape');
  assert.throws(() => readObjectContentDatasets({ ...value, schema: 'wrong' }));
  assert.throws(() => readObjectContentPanel({ ...value, schema: 'wrong' }));
  assert.deepEqual(readObjectContentPanel(value).panel, {});
  assert.throws(() => readObjectContentDatasets({ ...value, datasets: { ...value.datasets, controls: [{ id: 1, label: 'Shape' }] } }));
});
test('volume source presentation validates a dataset and its preview without editorial computation', () => {
  const value = { schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, objectId: 'body', name: 'Body', defaultDataset: 'optical', bank: { path: 'prepared/bank.json' },
    sharedInputs: [], datasets: [{ id: 'optical', label: 'Optical', title: 'Optical image', description: 'Description', summary: 'Summary', detail: 'Detail',
      input: 'image', facts: [], preview: { path: 'source/image.png', authoredFrom: 'image' } }] };
  assert.equal(parseVolumePresentationSource(value).datasets[0]?.preview.path, 'source/image.png');
  assert.throws(() => parseVolumePresentationSource({ ...value, schema: 'wrong' }));
  assert.throws(() => parseVolumePresentationSource({ ...value, defaultDataset: 'missing' }));
  assert.throws(() => parseVolumePresentationSource({ ...value, datasets: [{ ...value.datasets[0], preview: { path: '../../escape' } }] }));
  assert.deepEqual(readCataloguePresentationDistances({ distanceM: 10 }, ['distanceM']), { distanceM: 10 });
  assert.throws(() => readCataloguePresentationDistances({ distanceM: Infinity }, ['distanceM']));
});

import { readVolumePresentationPreviews, readVolumeAttachment, readGalaxyBackingSource, readWorldContextSourceSelection, readStellarExtent, readPreparedPanelContentRecord, readComparableSource, readStellarDotMeasurements, readFeatureMapLongitude, PREPARED_VOLUME_PRESENTATION_SCHEMA, WORLD_CONTEXT_SOURCE_SCHEMA, STELLAR_EXTENT_SOURCE_SCHEMA } from './build-projections.js';
import { GALAXY_BACKING_SCHEMA } from '../catalogue/galaxy-backing.js';
import { NEBULA_DELIVERY_SCHEMA } from '../../volume/nebula/nebula-delivery.js';
import { PREPARED_FEATURES_SCHEMA } from '../surface/prepared-features.js';

test('additional shared build projections reject incompatible schemas', () => {
  for (const read of [readVolumePresentationPreviews, readVolumeAttachment, readGalaxyBackingSource,
    readWorldContextSourceSelection, readPreparedPanelContentRecord, readStellarDotMeasurements, readFeatureMapLongitude])
    assert.throws(() => read({ schema: 'wrong' }));
  assert.throws(() => readStellarExtent({ schema: 'wrong' }, 'body', 'source'));
  assert.equal(readComparableSource({ schema: 'old' }, { schema: 'current' }), null);
});
test('additional shared build projections validate fields before exposing them', () => {
  const presentation = { schema: PREPARED_VOLUME_PRESENTATION_SCHEMA, objectId: 'body', defaultDataset: 'image', controls: [{ id: 'image', thumbnailUrl: '/thumb', texture: { url: '/image', width: 2, height: 1 } }] };
  assert.equal(readVolumePresentationPreviews(presentation).objectId, 'body');
  assert.throws(() => readVolumePresentationPreviews({ ...presentation, schema: 'wrong' }));
  assert.throws(() => readVolumePresentationPreviews({ ...presentation, defaultDataset: 'missing' }));
  assert.equal(readVolumePresentationPreviews({ schema: 'other' }, 'candidate'), null);
  assert.equal(readVolumeAttachment({ schema: NEBULA_DELIVERY_SCHEMA, attachedTo: 'star' }).attachedTo, 'star');
  assert.throws(() => readVolumeAttachment({ schema: NEBULA_DELIVERY_SCHEMA, attachedTo: 7 }));
  assert.equal(readGalaxyBackingSource({ schema: GALAXY_BACKING_SCHEMA, source: 'image', leaf: { texturePath: 'image.webp' } }).source, 'image');
  assert.throws(() => readGalaxyBackingSource({ schema: GALAXY_BACKING_SCHEMA, source: 'image', leaf: {} }));
  const selection = { schema: WORLD_CONTEXT_SOURCE_SCHEMA, focus: { id: 'sun' }, bodies: 'catalog', frame: { epochJdTt: 2451545 }, volume: {}, stars: {} };
  assert.equal(readWorldContextSourceSelection(selection).frame.epochJdTt, 2451545);
  assert.throws(() => readWorldContextSourceSelection({ ...selection, schema: 'wrong' }));
  assert.throws(() => readWorldContextSourceSelection({ ...selection, frame: { epochJdTt: NaN } }));
  const extent = { schema: STELLAR_EXTENT_SOURCE_SCHEMA, objectId: 'body', radiusPc: 1, source: 'source' };
  assert.equal(readStellarExtent(extent, 'body', 'source').radiusPc, 1);
  assert.throws(() => readStellarExtent({ ...extent, schema: 'wrong' }, 'body', 'source'));
  assert.throws(() => readStellarExtent({ ...extent, radiusPc: 0 }, 'body', 'source'));
  assert.equal(readComparableSource({ schema: 'current', extra: 1 }, { schema: 'current' })?.extra, 1);
  assert.equal(readStellarDotMeasurements({ radiusKm: 1 }).radiusKm, 1);
  assert.throws(() => readStellarDotMeasurements({ radiusKm: NaN }));
  assert.equal(readFeatureMapLongitude({ schema: PREPARED_FEATURES_SCHEMA, mapLeftEdgeLongitudeDeg: 30 }), 30);
  assert.throws(() => readFeatureMapLongitude({ schema: PREPARED_FEATURES_SCHEMA, mapLeftEdgeLongitudeDeg: Infinity }));
});

import { PACKAGED_POINTS_SOURCE_SCHEMA, readPackagedPointsFrame } from './build-projections.js';
test('packaged points frame admits only its schema and finite frame', () => {
  const value = { schema: PACKAGED_POINTS_SOURCE_SCHEMA, frame: { referenceFrame: 'sun-icrf', epochJdTt: 2451545 } };
  assert.deepEqual(readPackagedPointsFrame(value).frame, value.frame);
  assert.throws(() => readPackagedPointsFrame({ ...value, schema: 'wrong' }));
  assert.throws(() => readPackagedPointsFrame({ ...value, frame: { ...value.frame, epochJdTt: NaN } }));
});

import { HOSTED_PLANET_MEASUREMENTS_SCHEMA, NEUTRON_STAR_MEASUREMENTS_SCHEMA, readPreparedChartContentRecord } from './build-projections.js';
test('subset admission preserves legacy feature metadata and partial chart content', () => {
  assert.equal(readFeatureMapLongitude({ mapLeftEdgeLongitudeDeg: 90 }), 90);
  for (const schema of [HOSTED_PLANET_MEASUREMENTS_SCHEMA, NEUTRON_STAR_MEASUREMENTS_SCHEMA])
    assert.equal(readStellarDotMeasurements({ schema, radiusKm: 2 }).radiusKm, 2);
  const partial = { schema: 'cssearth-prepared-content@2', objectId: 'fixture', charts: [{ src: '/chart.svg' }], facts: ['preserved'] };
  assert.equal(readPreparedChartContentRecord(partial), partial);
  assert.throws(() => readPreparedChartContentRecord({ ...partial, schema: 'wrong' }));
  assert.throws(() => readPreparedChartContentRecord({ ...partial, charts: [{ src: 2 }] }));
});

import { COMPACT_DENSITY_DELIVERY_SCHEMA } from '../../volume/compact/compact-density-delivery.js';
import { readObjectDescriptorRecord } from './build-projections.js';
import { OBJECT_SCHEMA } from '../../descriptor.js';
test('descriptor rewrites admit the schema and preserve source generator metadata', () => {
  const value = { schema: OBJECT_SCHEMA, id: 'body', type: 'surface', properties: {}, generator: 'site/build/generate.mts' };
  assert.equal(readObjectDescriptorRecord(value), value);
  assert.equal(readObjectDescriptorRecord(value).generator, value.generator);
  assert.throws(() => readObjectDescriptorRecord({ ...value, schema: 'wrong' }));
});
test('compact delivery attachment uses the same host projection', () => {
  assert.equal(readVolumeAttachment({ schema: COMPACT_DENSITY_DELIVERY_SCHEMA, attachedTo: 'lmc' }).attachedTo, 'lmc');
});

test('build subset schema identifiers retain their historical spellings', () => {
  assert.equal(CHART_ASSETS_SCHEMA, 'cssearth-chart-assets@1');
  assert.equal(COMPACT_DENSITY_DELIVERY_SCHEMA, 'cssearth-compact-density-delivery@1');
  assert.equal(GALAXY_BACKING_SCHEMA, 'cssearth-galaxy-backing@1');
  assert.equal(HOSTED_PLANET_MEASUREMENTS_SCHEMA, 'cssearth-hosted-planet@1');
  assert.equal(NEBULA_DELIVERY_SCHEMA, 'cssearth-nebula-delivery@2');
  assert.equal(NEUTRON_STAR_MEASUREMENTS_SCHEMA, 'cssearth-neutron-star@1');
  assert.equal(OBJECT_CONTENT_SCHEMA, 'cssearth-object-content@2');
  assert.equal(OBJECT_RUNTIME_SCHEMA, 'cssearth-object-runtime@5');
  assert.equal(OBJECT_SCHEMA, 'cssearth-object@2');
  assert.equal(PACKAGED_POINTS_SOURCE_SCHEMA, 'cssearth-packaged-points-source@1');
  assert.equal(PREPARED_FEATURES_SCHEMA, 'cssearth-prepared-features@1');
  assert.equal(PREPARED_SURFACE_FEATURES_SCHEMA, 'cssearth-prepared-surface-features@1');
  assert.equal(PREPARED_VOLUME_PRESENTATION_SCHEMA, 'cssearth-volume-presentation@2');
  assert.equal(RASTER_RECIPE_SCHEMA, 'cssearth-raster-recipe@2');
  assert.equal(SOURCE_MANIFEST_SCHEMA, 'cssearth-authoritative-sources@3');
  assert.equal(STELLAR_EXTENT_SOURCE_SCHEMA, 'cssearth-stellar-extent@1');
  assert.equal(SYSTEM_TEXT_SCHEMA, 'cssearth-system-text@1');
  assert.equal(VOLUME_PRESENTATION_SOURCE_SCHEMA, 'cssearth-volume-presentation-source@2');
  assert.equal(VOLUME_SOURCE_MANIFEST_SCHEMA, 'cssearth-volume-source-manifest@2');
  assert.equal(WORLD_CONTEXT_SOURCE_SCHEMA, 'cssearth-world-context-source@1');
});

import { DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA } from './build-projections.js';
import { VOLUME_DATASET_MANIFEST_SCHEMA } from '../../volume/delivery/volume-dataset-manifest.js';
test('attachment projections admit the historical dataset-bank envelopes', () => {
  assert.equal(DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA, 'cssearth-density-volume-dataset-bank-source@1');
  assert.equal(VOLUME_DATASET_MANIFEST_SCHEMA, 'cssearth-volume-dataset-manifest@1');
  for (const schema of ['cssearth-density-volume-dataset-bank-source@1', 'cssearth-volume-dataset-manifest@1'])
    assert.equal(readVolumeAttachment({ schema, attachedTo: 'body' }).attachedTo, 'body');
});

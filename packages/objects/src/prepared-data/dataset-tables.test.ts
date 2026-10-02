import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requirePreparedData } from './runtime-validation/guards.js';
import { OBJECT_RUNTIME_SCHEMA } from './object-controls.js';
import { parsePreparedObjectRuntime } from './runtime-validation/index.js';
import { mergePreparedDatasetTables, splitPreparedDatasetTables } from './dataset-tables.js';

/** A complete transport fixture: validation uses the same defaults as the JSON reader. */
export function datasetRuntimeFixture() {
  return parsePreparedObjectRuntime({
    schema: OBJECT_RUNTIME_SCHEMA, id: 'fixture',
    controls: { datasets: { defaultDataset: 'day', controls: [{ id: 'day', label: 'Day' }, { id: 'night', label: 'Night' }] }, settings: null },
    camera: {
      cameraModel: 'accumulated-matrix3d', pitchBounded: false, yawBounded: false,
      minimumControlPitchDegrees: -90, maximumControlPitchDegrees: 90, defaultControlPitchDegrees: 0,
      defaultControlYawDegrees: 0, initialScenePitchDegrees: 0, maximumScenePitchDegrees: 90,
      minimumZoom: 1, maximumZoom: 10, defaultZoom: 1, sceneScale: 1, logicalBodyDiameter: 100,
      responsiveFit: { model: 'continuous-aspect-smoothstep', portraitBaseWidthShare: .8, narrowPortraitWidthShareGain: .1,
        landscapeWidthShareGain: .1, narrowPortraitAspectRatio: .5, portraitAspectRatio: .75, squareAspectRatio: 1,
        maximumHeightShare: .8, maximumMobilePreviewShare: .5, minimumZoom: 1, maximumZoom: 10 },
      projection: { model: 'css-perspective-shared-with-sky', cssPerspective: '1000px' },
      dolly: { model: 'multiplicative-wheel-distance', wheelStepPerDelta: .001, minimumDistanceRadii: 2, maximumDistanceOverOrbitExtent: 10 },
      levelOfDetail: { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 100, billboardFullDiscPixels: 80,
        markerFadeStartDiscPixels: 60, markerFullDiscPixels: 40 },
      orbitLineFade: { visibleBelowDiscHeightShare: .1, hiddenAboveDiscHeightShare: .2 },
    },
    sky: { schema: 'cssearth-prepared-cubic-sky@3', standard: 'cssearth-cubic-sky-standard@3', runtimeRasterization: false,
      orientation: 'camera-rotation-only-no-translation-or-parallax', cameraPitchResponse: 1, cameraZoomResponse: 1,
      presentationPitchOffsetDegrees: 0, presentationYawOffsetDegrees: 0 },
    sun: null,
    assets: {
      entries: ['day:surface', 'night:surface', 'day:small', 'night:small'].map(key => ({ key, pool: 'images', url: `/scenes/fixture/${key}.webp` })),
      pools: [{ id: 'images', capacity: 4, concurrency: 1, reuse: true, retention: 'selection' }], startup: [],
    },
    tree: { camera: 0, scene: 1, stageClasses: [], properties: [], activationGroups: [[2]], nodes: [
      { tag: 'div', parent: -1, className: 'polycss-camera', style: '', properties: [], attributes: {} },
      { tag: 'div', parent: 0, className: 'polycss-scene', style: '', properties: [], attributes: {} },
      { tag: 's', parent: 1, className: null, style: '', properties: [], attributes: {} },
    ] },
    variants: ['day', 'night'].map(datasetId => ({ when: { datasetId }, required: [`${datasetId}:surface`], materials: [],
      writes: [{ kind: 'texture', target: 2, name: 'backgroundImage', resource: `${datasetId}:surface`, quoted: false }] })),
    materials: [], viewBindings: [], animations: [],
    textureLevels: { hysteresis: .1, levels: [
      { minimumDiameter: 0, resources: { 'day:surface': 'day:small', 'night:surface': 'night:small' } },
      { minimumDiameter: 100, resources: { 'day:surface': 'day:surface', 'night:surface': 'night:surface' } },
    ] },
  });
}

test('splitting and merging preserve the full transport without mutating their inputs', () => {
  const full = datasetRuntimeFixture(), before = JSON.stringify(full);
  const split = splitPreparedDatasetTables(full), splitBefore = JSON.stringify(split);
  assert.equal(JSON.stringify(full), before);
  assert.deepEqual(split.definition.deferredDatasets, ['night']);
  assert.deepEqual(split.tables[0].entries.map(entry => entry.key), ['night:surface', 'night:small']);
  parsePreparedObjectRuntime(split.definition);
  const merged = mergePreparedDatasetTables(split.definition, split.tables[0], 'night');
  assert.equal(JSON.stringify(split), splitBefore);
  assert.deepEqual(merged.variants, full.variants);
  assert.deepEqual(merged.textureLevels, full.textureLevels);
  assert.deepEqual([...merged.assets.entries].sort((a, b) => a.key.localeCompare(b.key)), [...full.assets.entries].sort((a, b) => a.key.localeCompare(b.key)));
  assert.deepEqual(merged.deferredDatasets, []);
});

test('merging rejects missing variants and undeclared resource addresses before publication', () => {
  const split = splitPreparedDatasetTables(datasetRuntimeFixture()), before = JSON.stringify(split.definition);
  const missing = structuredClone(split.tables[0]);
  Object.assign(missing, { variants: [] });
  assert.throws(() => mergePreparedDatasetTables(split.definition, missing, 'night'), /lack the variant/);
  const invalid = structuredClone(split.tables[0]);
  invalid.entries[0].url = '/invalid.webp';
  assert.throws(() => mergePreparedDatasetTables(split.definition, invalid, 'night'), /resource identity/);
  assert.equal(JSON.stringify(split.definition), before);
});

test('the parser rejects missing activation ownership and executable or sparse JSON data', () => {
  const full = datasetRuntimeFixture();
  const missing = structuredClone(full);
  delete missing.tree.activationGroups;
  assert.throws(() => parsePreparedObjectRuntime(missing), /activation groups must be prepared/);
  let called = false;
  assert.throws(() => parsePreparedObjectRuntime({ get schema() { called = true; return OBJECT_RUNTIME_SCHEMA; } }), /executable/);
  assert.equal(called, false);
  assert.throws(() => parsePreparedObjectRuntime({ ...full, animations: new Array(1) }), /dense JSON array/);
});

test('preparation retains its JSON diagnostics and accepts sparse arrays with the shared traversal', () => {
  for (const value of [NaN, { value: NaN }, () => {}, { value: undefined }]) {
    assert.throws(() => requirePreparedData(value), /must contain only acyclic JSON data/);
  }
  const sparse = new Array(1);
  assert.equal(requirePreparedData(sparse), sparse);
  const value = { valid: true };
  assert.equal(requirePreparedData(value), value);
});

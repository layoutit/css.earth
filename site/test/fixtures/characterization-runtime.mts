import { OBJECT_RUNTIME_SCHEMA, parsePreparedObjectRuntime } from '@cssearth/objects';

/** A complete transport fixture: validation uses the same defaults as the JSON reader. */
export function characterizationRuntime() {
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

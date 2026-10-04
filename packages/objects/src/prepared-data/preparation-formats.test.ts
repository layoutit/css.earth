import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeometryProfile } from './presentation/css-geometry-profile.ts';
import { parseSolarSceneSource } from './orbit/solar-system-preparation.ts';
import { parseInvestigationLedger, parseFacilityLedger, evidenceLink } from './source/investigation-ledger.ts';
import { parseAcquisitionPlan } from './source/acquisition-plan.ts';
import { parsePagedRecipe, parsePagedDatasetBindings } from './presentation/paged-ellipsoid.ts';
import { parseChartAssetRecipe } from './photometry/chart-assets.ts';
import { parseSpectrumRecipe } from './photometry/chart-spectrum.ts';
import { parseMeasuredSpectrum } from './photometry/chart-measured-spectrum.ts';
import { parseRetrievedProfile } from './photometry/chart-retrieved-profile.ts';
import { parseSystemOrbits } from './photometry/chart-system-orbits.ts';
import { parseDepthRecipe, NEBULA_DEPTH_MODEL_SCHEMA } from '../volume/nebula/nebula-depth-model.ts';
import { CSS_GEOMETRY_PROFILE_SCHEMA, PAGED_ELLIPSOID_SCHEMA, CHART_ASSETS_SCHEMA } from './presentation/presentation-recipe-schemas.ts';
import { ACQUISITION_PLAN_SCHEMA, INVESTIGATION_LEDGER_SCHEMA } from './source/source-schema-identifiers.ts';

const diagnostic = (message: string) => ({ name: 'TypeError', message });
const geometry = { schema: CSS_GEOMETRY_PROFILE_SCHEMA, namespace: 'fixture', bodyRotationDegrees: 0,
  surface: { radius: 1, polarRadius: 1, latitudeSegments: 3, longitudeSegments: 3, surfaceLatitudeHeight: 3,
    packedBandGutter: 0, polarTileSize: 1, polarRadiusScale: 1, polarOffset: 0, uv: 'global', color: '#ffffff',
    surface: { url: '/scenes/fixture.webp', width: 3, height: 3 }, poles: { url: '/scenes/poles.webp', width: 3, height: 3 } },
  projection: { tileSize: 1, layerElevation: 0, seamBleed: 0, interiorSeamBleed: 0, overlap: 0, rasterScale: 1,
    rasterGutter: 0, rasterOverscan: 0, ambientIntensity: 0, lightColor: '#ffffff', fitToSource: false, projectivePoles: false },
  output: { schema: 'fixture', materialSchema: 'fixture', layout: 'retained' } };

test('geometry retains authored acceptance, reference identity and diagnostics', () => {
  assert.equal(parseGeometryProfile(geometry), geometry);
  assert.throws(() => parseGeometryProfile(null), diagnostic('geometry must be an object.'));
  assert.throws(() => parseGeometryProfile({ ...geometry, namespace: '' }), diagnostic('Unsupported geometry profile.'));
  assert.throws(() => parseGeometryProfile({ ...geometry, projection: { ...geometry.projection, positionVariables: false } }),
    diagnostic('projection.positionVariables is gone: remove it.'));
  assert.doesNotThrow(() => parseGeometryProfile({ ...geometry, projection: { ...geometry.projection,
    seamOutset: { targetPixels: -1, stepRatio: 0, hysteresis: 2, firstDiameter: 0, lastDiameter: 0 } } }));
});

test('solar source keeps identity admission distinct from JavaScript unit reads', () => {
  assert.deepEqual(parseSolarSceneSource({ bodyId: '', displayName: '', schema: 'ignored' }), { bodyId: '', displayName: '' });
  assert.ok(Object.isFrozen(parseSolarSceneSource({ bodyId: 'fixture', displayName: 'Fixture' })));
  assert.throws(() => parseSolarSceneSource([]), diagnostic('solar-system source must be an object.'));
  assert.throws(() => parseSolarSceneSource({}), diagnostic('Solar-system source is invalid.'));
  assert.deepEqual(parseSolarSceneSource({ bodyRadiusUnits: '2', geometryScale: '3' }, 'units'), { bodyRadiusUnits: 2, geometryScale: 3 });
  assert.deepEqual(parseSolarSceneSource({ bodyRadiusUnits: null, geometryScale: null }, 'units'), { bodyRadiusUnits: 0, geometryScale: 1 });
});

test('investigation admission retains permissive entries and exact diagnostics', () => {
  const ledger = { schema: INVESTIGATION_LEDGER_SCHEMA, objectId: 'fixture', entries: [{ id: 'one', status: 'included', evidence: [7, 'link'], extra: true }] };
  assert.deepEqual(parseInvestigationLedger(ledger, 'fixture').entries, [{ id: 'one', status: 'included', subject: 'one', finding: '', evidence: ['link'] }]);
  assert.throws(() => parseInvestigationLedger({ ...ledger, extra: true }, 'fixture'), diagnostic('fixture investigation ledger: has unknown field extra.'));
  assert.throws(() => parseInvestigationLedger({ ...ledger, entries: [...ledger.entries, ...ledger.entries] }, 'fixture'), diagnostic('fixture investigation ledger entry 2: repeats id one.'));
  assert.deepEqual(parseFacilityLedger({ schema: INVESTIGATION_LEDGER_SCHEMA, facilityId: 'fixture', entries: [] }, 'fixture').entries, []);
  assert.throws(() => evidenceLink(' untrimmed', 'evidence'), diagnostic('evidence: expects one trimmed line of text.'));
});

test('acquisition invokes host containment and DSK policies in historical order', () => {
  const events: string[] = [], policy = { containedPath: (path: string) => { events.push(path); if (path === '../escape') throw new TypeError('host containment'); },
    validateDskMeshRecipe: (_value: unknown) => { events.push('dsk'); throw new TypeError('host DSK'); } };
  const empty = { schema: ACQUISITION_PLAN_SCHEMA, operations: [] };
  assert.equal(parseAcquisitionPlan(empty, policy), empty);
  assert.throws(() => parseAcquisitionPlan({ ...empty, operations: [{ kind: 'dsk-mesh', groups: ['refresh'], path: 'mesh', recipe: {} }] }, policy), diagnostic('host DSK'));
  assert.deepEqual(events, ['mesh', 'dsk']);
  assert.throws(() => parseAcquisitionPlan({ ...empty, operations: [{ kind: 'json-document', groups: ['refresh'], path: '../escape', value: {} }] }, policy), diagnostic('host containment'));
  assert.throws(() => parseAcquisitionPlan({ ...empty, operations: [{ kind: 'download', groups: [] }] }, policy), diagnostic('Acquisition URL or groups are missing.'));
});

test('paged navigation keeps subset admission independent of camera preparation', () => {
  const input = { schema: PAGED_ELLIPSOID_SCHEMA, namespace: 'fixture', atlas: { sourceWidth: 2, density: 3 }, textureLevels: { texelsPerCssPixel: '4' }, camera: { drag: { model: 'pole-held-tumble' } } };
  assert.deepEqual(parsePagedRecipe(input, 'surface-arc'), { sourceWidth: 2, density: 3, texelsPerCssPixel: 4 });
  assert.deepEqual(parsePagedRecipe(input, 'drag'), { model: 'pole-held-tumble' });
  assert.equal(parsePagedRecipe(undefined, 'drag'), undefined);
  assert.equal(parsePagedRecipe({}, 'surface-arc'), undefined);
  assert.throws(() => parsePagedRecipe({ geometry: { OBLIQUITY_DEGREES: 0 } }), diagnostic('Paged ellipsoid geometry states OBLIQUITY_DEGREES, which preparation derives.'));
  assert.throws(() => parsePagedRecipe({ namespace: 'fixture', camera: { drag: null } }, 'drag'), diagnostic('fixture: paged-ellipsoid camera.drag.model must be screen-axis-tumble or pole-held-tumble; found null.'));
  assert.deepEqual(parsePagedDatasetBindings({ defaultDataset: 'fixture', controls: [] }), { defaultDataset: 'fixture', controls: [] });
});

const identity = { id: 'fixture', title: 'Fixture', description: 'Fixture', output: 'fixture.svg', metadata: {} };
test('chart envelope retains historical spectrum admission separately from source reads', () => {
  const spectrum = { ...identity, kind: 'spectrum', source: 'fixture.txt', format: 'json-columns', pointCount: 2, maximum: 1 };
  const chart = { schema: CHART_ASSETS_SCHEMA, publicBase: '/fixture/', charts: [spectrum] };
  assert.equal(parseChartAssetRecipe(chart), chart);
  assert.equal(parseSpectrumRecipe(spectrum, 'chart-assets'), spectrum);
  assert.throws(() => parseSpectrumRecipe(spectrum), TypeError);
  assert.throws(() => parseChartAssetRecipe({ ...chart, publicBase: 'relative/' }), diagnostic('Chart asset base must be an absolute URL prefix.'));
  assert.throws(() => parseChartAssetRecipe({ ...chart, charts: [{ ...spectrum, output: '../escape' }] }), diagnostic('Unsafe chart source path.'));
  assert.throws(() => parseSpectrumRecipe({ ...spectrum, maximum: 0 }, 'chart-assets'), diagnostic('Invalid spectrum sampling profile.'));
});

test('nested chart variant parsers preserve valid inputs and diagnostics', () => {
  const axis = { minimum: 1, maximum: 3, ticks: [{ value: 1, label: 'one' }, { value: 3, label: 'three' }] };
  const profile = { ...identity, kind: 'retrieved-profile', series: [{ path: 'fixture.txt', label: 'fixture', color: '#abcdef', pressureUnit: 'Pa', expectedRows: 2, columns: { pressure: 0, median: 1, lower: 2, upper: 3 } }], pressure: axis, temperature: axis, probedPressure: { minimum: 1, maximum: 2 }, notes: [] };
  assert.deepEqual(parseRetrievedProfile(profile), profile);
  assert.throws(() => parseRetrievedProfile({ ...profile, series: [{ ...profile.series[0], pressureUnit: 'atm' }] }), diagnostic('Profile pressure unit must be Pa or bar.'));
  const measuredAxis = { label: 'axis', minimum: 0, maximum: 1, ticks: [0, 1] };
  const measured = { ...identity, kind: 'measured-spectrum', source: { path: 'fixture.txt', format: 'records', expectedRows: 1, yScale: 1 }, mode: 'points', x: measuredAxis, y: measuredAxis, notes: [] };
  assert.deepEqual(parseMeasuredSpectrum(measured), measured);
  assert.throws(() => parseMeasuredSpectrum({ ...measured, mode: 'invalid' }), diagnostic('Invalid measured-spectrum kind or mode.'));
  const orbits = { ...identity, kind: 'system-orbits', system: 'fixture', highlight: 'fixture' };
  assert.deepEqual(parseSystemOrbits(orbits), orbits);
  assert.throws(() => parseSystemOrbits({ ...orbits, id: 'INVALID' }), diagnostic('INVALID: a system-orbits chart has kind system-orbits and a lowercase id.'));
});

test('depth recipe preserves pair, evidence, identity and frame diagnostics', () => {
  const background = { id: 'background', methodId: 'coherent-irregular-front', evidenceIds: ['evidence'], support: 'unconstrained', centerArcsec: [0, 0], radiusArcsec: [1, 1], angleDegrees: 0, depthArcsec: 0, gradient: [0, 0], curvaturePerArcsec: [0, 0, 0], thicknessArcsec: 1, strength: 1, rationale: 'Fixture' };
  const recipe = { schema: NEBULA_DEPTH_MODEL_SCHEMA, id: 'fixture', centerIcrsDegrees: [0, 0], evidence: { path: 'evidence.json' }, background, features: [], detailThicknessRatio: 1, minimumThicknessArcsec: 1, interpretation: 'Fixture' };
  assert.deepEqual(parseDepthRecipe(recipe, () => true), recipe);
  assert.throws(() => parseDepthRecipe(recipe, () => false), diagnostic('Invalid nebula depth-model recipe.'));
  assert.throws(() => parseDepthRecipe({ ...recipe, centerIcrsDegrees: [0] }, () => true), diagnostic('Invalid depth-model pair.'));
  assert.throws(() => parseDepthRecipe({ ...recipe, features: [background] }, () => true), diagnostic('Invalid depth frame, duplicate surface, or unsupported background claim.'));
  assert.throws(() => parseDepthRecipe({ ...recipe, background: { ...background, evidenceIds: [] } }, () => true), diagnostic('Invalid evidence-addressed depth surface.'));
});

test('paged full recipe retains wire fields and leaves camera angles absent', () => {
  const geometryFields = Object.fromEntries('BODY_LATITUDE_SEGMENTS BODY_LONGITUDE_SEGMENTS EQUATORIAL_RADIUS TILE_SIZE SEAM_BLEED PLANET_SEAM_BLEED INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE SURFACE_OVERLAP POLAR_CAP_BAND_SPAN POLAR_SURFACE_OVERLAP MESH_ROTATION_Z CAMERA_ZOOM CAMERA_MINIMUM_CONTROL_PITCH_DEGREES CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES CAMERA_MILLISECONDS_PER_CONTROL_DEGREE INTERIOR_LATITUDE_SEGMENTS INTERIOR_LONGITUDE_SEGMENTS rotationSeconds'.split(' ').map(key => [key, 1]));
  const cameraFields = Object.fromEntries('minimumControlPitchDegrees maximumControlPitchDegrees maximumScenePitchDegrees minimumZoom maximumZoom defaultZoom sceneScale logicalBodyDiameter'.split(' ').map(key => [key, 1]));
  const responsiveFit = Object.fromEntries('portraitBaseWidthShare narrowPortraitWidthShareGain landscapeWidthShareGain narrowPortraitAspectRatio portraitAspectRatio squareAspectRatio maximumHeightShare maximumMobilePreviewShare minimumZoom maximumZoom'.split(' ').map(key => [key, 1]));
  const recipe = { schema: PAGED_ELLIPSOID_SCHEMA, displayName: 'Fixture', namespace: 'fixture', publicBase: '/fixture/', sceneBodyKey: 'body', interiorRadiusKey: 'radius', interiorSchema: 'fixture', interiorPath: 'interior.json', equatorialRadiusKm: 1, polarRadiusKm: 1,
    geometry: { ...geometryFields, interiorCutaway: { centerLongitudeDegrees: 0, widthDegrees: 1 } },
    camera: { ...cameraFields, cameraModel: 'fixture', pitchBounded: false, yawBounded: false, responsiveFit: { ...responsiveFit, model: 'fixture' } },
    atlas: { pageSize: 1, pageCells: 1, density: 1, gutter: 1, sourceWidth: 1 },
    material: { tileSize: 1, presentationSize: 1, framesPerShard: 1, frameCount: 1, discRadius: 1, illumination: { frameCount: 1, minimumLightViewZ: 0, maximumLightViewZ: 1, baseLightAzimuthDegrees: 0 } },
    atmosphere: { sourcePath: 'source.json', responsePath: 'response.json', sourceId: 'fixture', maximumOpacityKey: 'opacity' },
    limb: { models: ['a', 'b', 'c'], reference: 'fixture', referenceDisplayGamma: 1 },
    surface: { width: 1, height: 1, quality: 1, clouds: { path: 'clouds.webp', maximumAlpha: 1, threshold: 1, scale: 1, color: [1, 1, 1] }, maps: [] },
    destinations: { searchLabel: 'fixture', descriptionSuffix: 'fixture', statuses: { detail: 'fixture', overview: 'fixture' } }, geographic: { places: {} } };
  assert.deepEqual(parsePagedRecipe(recipe), recipe);
  assert.equal(Object.hasOwn(parsePagedRecipe(recipe).camera, 'initialScenePitchDegrees'), false);
  assert.throws(() => parsePagedRecipe({ ...recipe, displayName: null }), diagnostic('Invalid paged ellipsoid profile structure at paged ellipsoid profile.displayName (null).'));
});

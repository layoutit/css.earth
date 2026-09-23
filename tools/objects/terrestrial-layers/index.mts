import { validateObjUvFits } from './obj-uv-fits.mts';
import { validateTerrestrialRings } from './rings.mts';
import { isArray } from '../../../src/platform/is-array.mts';
import {parseSolidPreparationSource} from './profile-source.mts';
import type {parseSolidScience} from './solid-source.mts';
import {requireRecord,requireFiniteNumber,requireString} from '../../sources/source-values.mts';
import type {prepareObjectContentAssets} from '../content/prepare.ts';
import {validatePreparedCubicSky} from '../../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
type SolidConfig=ReturnType<typeof parseSolidPreparationSource>;
type Directories={sourceDirectory:string;publicDirectory:string;outputDirectory:string};
type TerrestrialContext=Directories & {config:SolidConfig;source:Awaited<ReturnType<typeof createSourceManifest>>};
import { validateFacetScalarProfile } from './facet-scalars.mts';
import {validateVtkCategories} from './vtk-categories.mts';
import { validateImageDemScience } from './image-dem-science.mts';
import { validateScienceQualityMasks } from './scientific-raster.mts';
import { validateGeologyProfile } from './categorical-geology.mts';
import { validatePds4ObservationPolicy } from './observed-pds4.mts';
import { validateScalarMapProfile } from './pds-scalar-map.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mts';
import { prepareCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mts';
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from '../../../src/platform/directional-sun-contract.mts';
import { prepareDirectionalSun } from '../../../src/platform/prepare-directional-sun.mts';
import { SOLAR_GEOMETRY_EPOCH_LABEL, requireBodyFixedSunDirection } from '../../../src/platform/solar-geometry.mts';
import { prepareSunReferenceViewDirection } from '../../../src/platform/prepare-sun-view-direction.mts';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mts';
import { prepareSolidRasters, prepareSolidMaterial, scientificPreviewGrid, lensTextureGrid } from './solid-raster.mts';
import { prepareSolidScene, prepareSolidPresentation, solidCameraAngles } from './solid-scene.mts';
import { prepareRadialMaterials } from './radial-terrain.mts';
import { loadRadialModels, combineRadialModels, radialTerrainForLens } from './radial-models.mts';
import { validateRadialTableProfile } from './pds-radial-table.mts';
import { validateFitsObservationPolicy } from './observed-fits.mts';
import { validateSurfaceObservation } from '../surface-observations/index.mts';
import { validateFacetFieldRecipe } from './fits-facet-field.mts';

/** A categorical grid is discrete units in a nearest-sampled GeoTIFF with its missing value kept apart from the unit codes;
 * both the radial-terrain lane and the generic-lane interpreter apply the same rule. */
export function validateCategoricalGrid(lens: ReturnType<typeof parseSolidScience>) {
  if (lens.categories && (lens.format !== 'geotiff' || lens.sampling !== 'nearest' ||
    lens.relief || lens.valueTransform || !isArray(lens.categories) || lens.categories.length < 2 ||
    lens.minimum !== 0 || lens.maximum !== lens.categories.length - 1 ||
    lens.categories.some(category => typeof category.value !== 'string' || !category.value ||
      typeof category.label !== 'string' || !category.label || !/^#[0-9a-f]{6}$/i.test(category.color)) ||
    new Set(lens.categories.map(category => category.value)).size !== lens.categories.length ||
    !lens.grid || typeof lens.grid.noData !== 'number' || !Number.isFinite(lens.grid.noData) || lens.grid.noData >= 0 && lens.grid.noData < lens.categories.length)) {
    throw new TypeError('Categorical scientific grids require discrete units, nearest sampling and separate missing data.');
  }
}

export function parseTerrestrialProfile(input:unknown) {
  const header=requireRecord(input);
  const value=parseSolidPreparationSource(input);
  if (!value || value.schema !== 'cssearth-terrestrial-preparation@1' || value.kind !== 'solid-observation-body' ||
      !/^[a-z][a-z0-9-]*$/.test(value.namespace) || value.publicBase !== `/scenes/${value.namespace}/` ||
      typeof value.displayName !== 'string' ||
      value.raster?.width !== value.raster?.height * 2 || !Number.isSafeInteger(value.raster?.width) || value.raster.width <= 0 ||
      !Number.isSafeInteger(value.raster.bandCount) || value.raster.bandCount <= 0 ||
      !Number.isSafeInteger(value.raster.gutter) || value.raster.gutter < 0 ||
      !Number.isSafeInteger(value.raster.poleSize) || value.raster.poleSize <= 0 ||
      !isArray(value.raster.observations) ||
      !Number.isFinite(value.geometry?.radius) || value.geometry.radius <= 0 || !Number.isFinite(value.geometry.radiusKm) || value.geometry.radiusKm <= 0 ||
      !Number.isSafeInteger(value.lighting?.frameSize) || value.lighting.frameSize <= 0 ||
      !Number.isSafeInteger(value.lighting.frameCount) || value.lighting.frameCount < 2 ||
      !Number.isSafeInteger(value.lighting.columns) || value.lighting.columns <= 0 || value.lighting.frameCount % value.lighting.columns ||
      value.lighting.logicalSize !== value.geometry.radius * 2 || ![...value.raster.observations, ...(value.raster.scientific ?? []), ...(value.raster.observedColors ?? []), ...(value.raster.shapeViews ?? []), ...(value.raster.surfaceObservations ?? [])].some(lens => lens.id === value.presentation?.defaultLens)) {
    throw new TypeError('Invalid terrestrial surface preparation profile.');
  }
  validateTerrestrialRings(value.rings, value.geometry.radiusKm);
  for (const recipe of value.raster.surfaceObservations ?? []) validateSurfaceObservation(recipe, radialTerrainForLens(value, recipe.id));
  if (value.raster.surfaceQuality !== undefined &&
      (!Number.isInteger(value.raster.surfaceQuality) || value.raster.surfaceQuality < 1 || value.raster.surfaceQuality > 100)) {
    throw new TypeError('Surface WebP quality must be an integer from 1 to 100.');
  }
  if (value.celestial.sunQualification !== undefined &&
      (typeof value.celestial.sunQualification !== 'string' || !value.celestial.sunQualification.trim())) {
    throw new TypeError('Authored Sun qualification must explain the source frame.');
  }
  for (const view of value.raster.shapeViews ?? []) {
    if (!/^[a-z][a-z0-9-]*$/.test(view.id) || typeof view.label !== 'string' || !view.label.trim() ||
        !/^[a-z][a-z0-9-]*$/.test(view.consumer) ||
        !value.geometry.radialTerrain?.path) throw new TypeError('Shape views require a pinned mesh and a source consumer.');
  }
  for (const lens of value.raster.scientific ?? []) {
    const terrain = radialTerrainForLens(value, lens.id);
    const terrainRecord = terrain === undefined ? undefined : requireRecord(terrain);
    const terrainSimplification = terrainRecord?.simplification === undefined ? undefined : requireRecord(terrainRecord.simplification);
    validateScienceQualityMasks(lens);
    scientificPreviewGrid(lens, value.raster);
    if (![undefined, 'nearest'].includes(lens.displaySampling)) throw new TypeError('Scientific display sampling must preserve cells with nearest or use the existing default.');
    if (lens.format === 'geologic-shapefile') {validateGeologyProfile(lens); continue;}
    if (lens.format === 'vtk-cell-categories') {validateVtkCategories(lens, terrain); continue;}
    validateCategoricalGrid(lens);
    const facetTable = lens.format === 'facet-scalars';
    const meshGrid = ['image-plane-dem', 'stl', 'wavefront-obj', 'wavefront-obj-zip', 'pds-vertex-facet', 'pds-plate-model', 'vrml-mesh', 'pds-radius-table'].includes(lens.format);
    const tableGrid = lens.format === 'pds-radial-table';
    for (const {path, grid} of [lens, ...(lens.additionalGrids ?? [])]) {
      if (typeof path !== 'string' || path.startsWith('/') || path.split('/').includes('..') ||
          !grid || (!meshGrid && !tableGrid && !facetTable && (typeof grid.width !== 'number' || !Number.isSafeInteger(grid.width) || grid.width <= 0 || typeof grid.height !== 'number' || !Number.isSafeInteger(grid.height) || grid.height <= 0)) ||
          ![undefined, 'equirectangular', 'polar-stereographic'].includes(grid.projection) ||
          (grid.projection === 'polar-stereographic' && ![-90, 90].some(pole=>pole===grid.poleLatitude)) ||
          (grid.latitudeRange && (grid.latitudeRange.length !== 2 || !grid.latitudeRange.every(Number.isFinite) ||
            grid.latitudeRange[0] < -90 || grid.latitudeRange[1] > 90 || grid.latitudeRange[0] >= grid.latitudeRange[1]))) {
        throw new TypeError('Invalid scientific source projection or extent.');
      }
    }
    if (!['obj-uv-fits', 'image-plane-dem', 'facet-scalars', 'pds-image', 'pds3-float-map', 'pds3-scalar-map', 'npy-lonlat-grid', 'stl', 'geotiff', 'isis3', 'pds3-radius-zip', 'wavefront-obj', 'wavefront-obj-zip', 'pds-vertex-facet', 'pds-plate-model', 'vrml-mesh', 'pds-radius-table', 'pds-radial-table'].includes(lens.format) || !lens.grid ||
        (!meshGrid && !tableGrid && !facetTable && (typeof lens.grid.width !== 'number' || !Number.isSafeInteger(lens.grid.width) || typeof lens.grid.height !== 'number' || !Number.isSafeInteger(lens.grid.height) || lens.grid.width <= 0 || lens.grid.height <= 0)) ||
        !(typeof lens.minimum === 'number' && typeof lens.maximum === 'number' && lens.minimum < lens.maximum) || !isArray(lens.colors) || lens.colors.length < 2 ||
        lens.colors.some(color => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) ||
        (lens.sampling !== undefined && !['nearest', 'bilinear'].includes(lens.sampling)) ||
        (lens.valueTransform && (!Number.isFinite(lens.valueTransform.scale) || lens.valueTransform.scale <= 0 ||
          !Number.isFinite(lens.valueTransform.offset))) ||
        (lens.relief && (!(lens.relief.referenceRadiusMeters > 0) || !isArray(lens.relief.lightDirection) ||
          lens.relief.lightDirection.length !== 3 || lens.relief.lightDirection.some(value => !Number.isFinite(value)) ||
          Math.abs(Math.hypot(...lens.relief.lightDirection) - 1) > 1e-12 || lens.relief.ambient < 0 || lens.relief.ambient >= 1 ||
          (lens.relief.heightToMeters !== undefined && (!Number.isFinite(lens.relief.heightToMeters) || lens.relief.heightToMeters <= 0))))) {
      throw new TypeError('Invalid scientific surface grid or relief profile.');
    }
    if (tableGrid) validateRadialTableProfile(lens.grid);
    if (lens.format === 'image-plane-dem') validateImageDemScience(lens);
    if (meshGrid && ((lens.format === 'wavefront-obj-zip' && (typeof lens.grid.member !== 'string' || lens.grid.member.includes('..') || lens.grid.member.startsWith('/'))) ||
        !(typeof lens.grid.metersPerUnit === 'number' && lens.grid.metersPerUnit > 0) || typeof lens.grid.expectedVertices !== 'number' || !Number.isSafeInteger(lens.grid.expectedVertices) || lens.grid.expectedVertices < 4 ||
        typeof lens.grid.expectedFaces !== 'number' || !Number.isSafeInteger(lens.grid.expectedFaces) || lens.grid.expectedFaces < 4 ||
        (lens.coverage && [lens.coverage.path,lens.coverage.member].some(p => typeof p !== 'string' || p.startsWith('/') || p.split('/').includes('..'))))) {
      throw new TypeError('Invalid sourced mesh grid.');
    }
    if (lens.facetField !== undefined) {
      validateFacetFieldRecipe(lens.facetField);
      if (!meshGrid || !lens.surfaceSampling) throw new TypeError('Facet fields require source-surface sampling.');
    }
    if (facetTable) validateFacetScalarProfile(lens, terrain);
    else if (lens.format === 'pds3-scalar-map') validateScalarMapProfile(lens, terrain);
    else if (lens.format === 'obj-uv-fits') validateObjUvFits(lens, terrain);
    else if (lens.surfaceSampling !== undefined && (!meshGrid || lens.surfaceSampling?.method !== 'closest-source-point' ||
        !Number.isFinite(lens.surfaceSampling.maximumDistanceMeters) || !(lens.surfaceSampling.maximumDistanceMeters > 0) ||
        lens.path !== terrainRecord?.path ||
        lens.format !== terrainRecord?.format ||
        JSON.stringify(lens.grid) !== JSON.stringify(terrainRecord?.grid) ||
        terrainSimplification?.method !== 'source-meshoptimizer' ||
        lens.surfaceSampling.maximumDistanceMeters > requireFiniteNumber(terrainSimplification.maximumErrorMeters))) {
      throw new TypeError('Source surface sampling must match the retained mesh and its simplification-distance bound.');
    }
  }
  const observationIds = new Set();
  for (const observation of value.raster.observations) {
    const policy = observation.validity;
    if (policy?.resampling !== undefined && (!['source-georeferenced-bilinear','source-georeferenced-nearest'].includes(policy.resampling) ||
        !['geotiff-rgb-alpha','geotiff-monochrome-alpha'].includes(policy.kind))) {
      throw new TypeError('Source-georeferenced observation resampling requires a masked GeoTIFF.');
    }
    if (!/^[a-z][a-z0-9-]*$/.test(observation.id) || observationIds.has(observation.id) ||
        (observation.monochromeBase && !observationIds.has(observation.monochromeBase)) ||
        !['south-connected-black', 'geotiff-monochrome-alpha', 'geotiff-rgb-alpha', 'geotiff-rgb-bands', 'pds3-rgb-zip', 'image-monochrome-no-data', 'image-rgb-no-data', 'geotiff-float-monochrome', 'geotiff-byte-monochrome', 'isis3-float-monochrome', 'pds3-byte-monochrome', 'fits-byte-monochrome', 'pds4-float-rgb'].includes(policy?.kind)) {
      throw new TypeError('Invalid observation identity, validity policy, or fallback ordering.');
    }
    const byteImage = ['image-monochrome-no-data', 'image-rgb-no-data'].includes(policy.kind);
    if (policy.kind === 'pds4-float-rgb') validatePds4ObservationPolicy(policy);
    if (['pds3-rgb-zip', 'geotiff-rgb-bands'].includes(policy.kind) &&
        (policy.noData !== 0 || typeof policy.centerLongitude !== 'number' || !Number.isFinite(policy.centerLongitude) || policy.centerLongitude < 0 || policy.centerLongitude > 360 ||
         !(typeof policy.grid?.pixelsPerDegree === 'number' && policy.grid?.pixelsPerDegree > 0) || ![policy.grid?.sampleOffset, policy.grid?.lineOffset].every(Number.isFinite))) {
      throw new TypeError('Mapped RGB observations require an explicit source grid and fill code.');
    }
    if (policy.kind === 'pds3-rgb-zip' &&
        (typeof policy.member !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(policy.member) || policy.member.startsWith('-') ||
         typeof policy.targetName !== 'string' || !policy.targetName.trim())) throw new TypeError('Invalid PDS RGB member or target.');
    if (policy.kind === 'geotiff-rgb-bands' &&
        (!isArray(policy.samples) || policy.samples.length !== 3 || ![1, 2].some(bytes=>bytes===policy.sampleBytes) ||
         new Set([...policy.samples, policy.alphaBand]).size !== 4 ||
         [...policy.samples, policy.alphaBand].some(b => typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > 3) ||
         !(typeof policy.resolutionMeters === 'number' && policy.resolutionMeters > 0) || !isArray(policy.origin) || policy.origin.length !== 2 || !policy.origin.every(Number.isFinite))) {
      throw new TypeError('Invalid source-owned RGB band order or storage.');
    }
    if (policy.kind === 'fits-byte-monochrome') validateFitsObservationPolicy(policy);
    if ((policy.kind.startsWith('geotiff-') || byteImage) && (!(byteImage && policy.noData === null) && (typeof policy.noData !== 'number' || !Number.isFinite(policy.noData)) ||
        typeof policy.centerLongitude !== 'number' || !Number.isFinite(policy.centerLongitude) || policy.centerLongitude < 0 || policy.centerLongitude > 360)) {
      throw new TypeError('Invalid observed GeoTIFF no-data or coordinate policy.');
    }
    if (policy.connectedFillRange !== undefined && (!byteImage || !policy.connectedEdge || !isArray(policy.connectedFillRange) ||
        policy.connectedFillRange.length !== 2 || !policy.connectedFillRange.every(v => Number.isInteger(v) && v >= 0 && v <= 255) ||
        policy.connectedFillRange[0] > policy.connectedFillRange[1] ||
        !(typeof policy.noData === 'number' && policy.noData >= policy.connectedFillRange[0] && policy.noData <= policy.connectedFillRange[1]))) {
      throw new TypeError('Invalid source-defined connected fill range.');
    }
    if (policy.connectedEdge !== undefined && (!(byteImage || policy.kind === 'pds3-byte-monochrome') || (policy.noData !== 0 && !policy.connectedFillRange) ||
        !['north', 'south'].includes(policy.connectedEdge))) {
      throw new TypeError('Connected coverage requires a byte image with exact black fill and a polar edge.');
    }
    if (byteImage && policy.noData !== null && (typeof policy.noData !== 'number' || !Number.isInteger(policy.noData) || policy.noData < 0 || policy.noData > 255)) {
      throw new TypeError('Byte observation no-data must be an exact byte value.');
    }
    if (['geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(policy.kind) &&
        (!isArray(policy.displayRange) || policy.displayRange.length !== 2 || !policy.displayRange.every(Number.isFinite) ||
         !(policy.displayRange[0] < policy.displayRange[1]) || !(typeof policy.specialValueMagnitude === 'number' && policy.specialValueMagnitude > 0) ||
         ![undefined, 4, 8].includes(policy.sampleBytes) ||
         ![undefined, 'degrees'].includes(policy.coordinates) || !(policy.coordinates === 'degrees' ? typeof policy.resolutionDegrees === 'number' && policy.resolutionDegrees > 0 : typeof policy.resolutionMeters === 'number' && policy.resolutionMeters > 0) ||
         !isArray(policy.origin) || policy.origin.length !== 2 || !policy.origin.every(Number.isFinite))) {
      throw new TypeError('Invalid floating-point observation grid or display stretch.');
    }
    if (policy.kind === 'geotiff-rgb-alpha' && (
        !['rgb', 'monochrome'].includes(policy.channels ?? '') || !['all-channels', 'any-channel'].includes(policy.zeroValidity ?? '') ||
        (policy.withholdLatitudeDegrees !== undefined && !(policy.withholdLatitudeDegrees > 0 && policy.withholdLatitudeDegrees <= 90)) ||
        (policy.withholdLongitudeDegrees !== undefined && (!isArray(policy.withholdLongitudeDegrees) ||
          policy.withholdLongitudeDegrees.length !== 2 || !policy.withholdLongitudeDegrees.every(Number.isFinite) ||
          policy.withholdLongitudeDegrees[0] < 0 || policy.withholdLongitudeDegrees[1] > 360 ||
          policy.withholdLongitudeDegrees[0] >= policy.withholdLongitudeDegrees[1])))) {
      throw new TypeError('Invalid observed channel or geographic withholding policy.');
    }
    if (policy.kind === 'isis3-float-monochrome' &&
        (!policy.grid || !isArray(policy.displayRange) || policy.displayRange.length !== 2 ||
          !policy.displayRange.every(Number.isFinite) || !(policy.displayRange[0] < policy.displayRange[1]))) {
      throw new TypeError('Invalid ISIS3 observation grid or display range.');
    }
    observationIds.add(observation.id);
  }
  // Photograph lenses moved to raster.surfaceObservations. A recipe may keep the retired group only while it stays empty.
  const retired = requireRecord(header.raster).mosaics;
  if (retired !== undefined && (!isArray(retired) || retired.length)) throw new TypeError('raster.mosaics is retired; a photograph lens belongs in raster.surfaceObservations.');
  for (const lens of value.raster.observedColors ?? []) {
    const p = lens.profile;
    if (!p || !(p.referenceRadiusMeters > 0) || !isArray(p.filters) || p.filters.length !== 3 ||
        new Set(p.filters).size !== 3 || !Number.isFinite(p.noData) || !(p.specialValueMagnitude > 0)) {
      throw new TypeError('Invalid observed-color preparation profile.');
    }
    if (!observationIds.has(lens.monochromeBase)) throw new TypeError('Observed color requires a prepared observation base.');
    if (lens.photometry) {
      const { profile: photometry, levels, vectors } = lens.photometry;
      if (!photometry || photometry.model !== 'Lunar-Lambert' || !(photometry.radiusKm > 0) ||
          photometry.phaseNormalization !== false || !photometry.observationWeights ||
          !Object.keys(photometry.observationWeights).length || Object.values(photometry.observationWeights).some(weight =>
            !Number.isFinite(weight) || weight < 0 || weight > 1) ||
          (['referenceIncidenceDegrees', 'referenceEmissionDegrees', 'maximumIncidenceDegrees', 'maximumEmissionDegrees'] as const).some(key =>
            !Number.isFinite(photometry[key]) || photometry[key] < 0 || photometry[key] >= 90) ||
          photometry.referenceIncidenceDegrees > photometry.maximumIncidenceDegrees ||
          photometry.referenceEmissionDegrees > photometry.maximumEmissionDegrees ||
          !Number.isSafeInteger(levels?.boundaryPixels) || levels.boundaryPixels < 1 ||
          !isArray(levels.luminance) || levels.luminance.length !== 3 ||
          levels.luminance.some(value => !Number.isFinite(value) || value < 0) ||
          Math.abs(levels.luminance.reduce((sum, value) => sum + value, 0) - 1) > 1e-12 ||
          (['sun', 'observer'] as const).some(key => typeof vectors?.[key] !== 'string' || vectors[key].startsWith('/') || vectors[key].split('/').includes('..'))) {
        throw new TypeError('Invalid source-bound disk normalization or color-level profile.');
      }
    }
  }
  for (const lens of [...value.raster.observations, ...(value.raster.scientific ?? [])]) {
    if (lens.textureScale !== undefined) {
      lensTextureGrid(lens, value.raster);
      if (value.geometry.radialModels) throw new TypeError('Texture scaling for radial model families is not supported.');
    }
  }
  return input as typeof value;
}

export async function prepareTerrestrialCelestial({ outputDirectory, config }:TerrestrialContext) {
  const sky = prepareCubicSky({ objectId: config.namespace, cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD });
  const sun = prepareTerrestrialSun({ config, surfacesReport: JSON.parse(await readFile(resolve(outputDirectory, 'surfaces.json'), 'utf8')) });
  await Promise.all([writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(sky)}\n`),
    writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(sun)}\n`)]);
  return { sky, sun };
}

/** Body-owned qualification distinguishes solved orientations from display axes. */
export function prepareTerrestrialSun({ config, surfacesReport }:{config:SolidConfig;surfacesReport:unknown}) {
  const frame = prepareEclipticPresentationFrame(config.namespace), sceneDirection = frame.sunDirection;
  const presentation = { ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
    source: config.celestial.sunSource, sourcePath: 'src/platform/solar-geometry.mts',
    qualification: config.celestial.sunQualification ?? (`Computed ${config.displayName} Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
      'expressed in the ecliptic presentation frame (north up, Sun left at zero yaw) and in view space at the default camera pose.' +
      (config.celestial.qualification ? ` ${config.celestial.qualification}` : '')),
    bodyFixedDirection: requireBodyFixedSunDirection(config.namespace), presentationFrame: frame.model,
    localDirection: sceneDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId: config.namespace, ...solidCameraAngles(config, surfacesReport), sceneDirection }),
  };
  return prepareDirectionalSun({ presentation });
}

/** Source inputs feed reusable raster, geometry, celestial and presentation operations. */
export async function prepareTerrestrialLayers({ sourceDirectory, publicDirectory, outputDirectory, config: input, prepareContent, replaceReviewedImages = false }:Directories & {config:unknown;prepareContent:typeof prepareObjectContentAssets;replaceReviewedImages?:boolean}) {
  const config = parseTerrestrialProfile(input);
  if (typeof prepareContent !== 'function') throw new TypeError('Terrestrial preparation requires the shared content preparer.');
  const source = await createSourceManifest({ objectId: config.namespace, objectName: config.displayName, sourceRoot: sourceDirectory });
  await source.verify();
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const context = { sourceDirectory, publicDirectory, outputDirectory, config, source };
  const models = await loadRadialModels(context);
  const radial = models[0]?.radial ?? null;
  const surfaces = await prepareSolidRasters({ ...context, radial, radialModels: models });
  const raster = await prepareSolidMaterial({ ...context, surfaces, radial: !!radial });
  if (radial) {
    for (const model of models) {
      const terrain=requireRecord(model.config.geometry.radialTerrain);
      await prepareRadialMaterials({ ...context, config: {...model.config,geometry:{...model.config.geometry,radialTerrain:{...terrain,sourceLighting:terrain.sourceLighting,thumbnail:terrain.thumbnail}}}, radial: model.radial,
      surfaces: surfaces.filter(surface => model.lensIds.includes(surface.id)),
      artifactId: model === models[0] ? null : model.id,
      snapshotEntries: models.length === 1 ? source.manifest.generatedIntermediates
        : source.manifest.generatedIntermediates.filter(entry => model.lensIds.includes(requireString(requireRecord(requireRecord(entry).recipe).lensId))),
      sunDirection: requireBodyFixedSunDirection(config.namespace), replaceReviewedImages });
    }
    const unpainted = surfaces.filter(surface => requireRecord(surface.layout).kind !== 'triangle-atlas').map(surface => surface.id);
    if (unpainted.length) throw new Error(`Radial surfaces without a triangle atlas: ${unpainted.join(', ')}.`);
    await writeFile(resolve(outputDirectory, 'surfaces.json'), JSON.stringify({ objectId: config.namespace, surfaces }) + '\n');
    await writeFile(resolve(outputDirectory, 'material.json'), JSON.stringify(raster) + '\n');
  }
  const assets = { surfaces: Object.fromEntries(raster.surfaces.map(surface => [surface.id, {
    url: surface.surface.url, url2x: surface.surface.url,
    polesUrl: surface.polesUrl, polesUrl2x: surface.polesUrl,
  }])) };
  await writeFile(resolve(outputDirectory, 'assets.json'), `${JSON.stringify(assets)}\n`);
  const content = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const celestial = await prepareTerrestrialCelestial(context);
  const scene = await prepareSolidScene({ ...context, celestial, radial: combineRadialModels(models, config.namespace) });
  const definition = await prepareSolidPresentation({ ...context, scene, material: raster, controls: content.controls });
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(definition)}\n`);
  return { raster, celestial, scene, definition, content };
}

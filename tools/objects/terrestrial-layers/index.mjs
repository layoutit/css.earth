import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mjs';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD } from '../../../src/platform/cubic-sky-contract.mjs';
import { prepareAstrometricCubeSampling } from '../../../src/platform/astrometric-sky-registration.mjs';
import { preparePlanetCubicSky } from '../../../src/platform/prepare-cubic-sky-source.mjs';
import { prepareCatalogueStars } from '../../../src/platform/prepare-catalogue-stars.mjs';
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from '../../../src/platform/directional-sun-contract.mjs';
import { preparePlanetDirectionalSun } from '../../../src/platform/prepare-directional-sun.mjs';
import { SOLAR_GEOMETRY_EPOCH_LABEL, requireBodyFixedSunDirection } from '../../../src/platform/solar-geometry.mjs';
import { prepareSunReferenceViewDirection } from '../../../src/platform/prepare-sun-view-direction.mjs';
import { prepareEclipticPresentationFrame } from '../../../src/platform/solar-presentation-frame.mjs';
import { prepareSolidRasters, prepareSolidMaterial } from './solid-raster.mjs';
import { prepareSolidScene, prepareSolidPresentation } from './solid-scene.mjs';
import { prepareAffineLayers } from './affine-preparation.mjs';

export function parseTerrestrialProfile(value) {
  if (value?.schema === 'cssearth-terrestrial-preparation@1' && value.kind === 'affine-photographic-atmosphere') {
    if (!/^[a-z][a-z0-9-]*$/.test(value.namespace) || value.publicBase !== `/scenes/${value.namespace}/` ||
        !(value.distanceAu > 0) || value.width !== value.height * 2 || !Number.isSafeInteger(value.width) || value.width <= 0 ||
        !Number.isSafeInteger(value.lighting?.frameCount) || value.lighting.frameCount < 2 ||
        !(value.lighting.minimumLightViewZ < value.lighting.maximumLightViewZ) || !value.lenses?.plans?.length ||
        [value.shapePath,value.atmospherePath].some(path=>typeof path!=='string'||path.startsWith('/')||path.split('/').includes('..'))) {
      throw new TypeError('Invalid affine photographic-atmosphere profile.');
    }
    return value;
  }
  if (!value || value.schema !== 'cssearth-terrestrial-preparation@1' || value.kind !== 'solid-observation-body' ||
      !/^[a-z][a-z0-9-]*$/.test(value.namespace) || value.publicBase !== `/scenes/${value.namespace}/` ||
      typeof value.displayName !== 'string' || !Number.isFinite(value.distanceAu) || value.distanceAu <= 0 ||
      value.raster?.width !== value.raster?.height * 2 || !Number.isSafeInteger(value.raster?.width) || value.raster.width <= 0 ||
      !Number.isSafeInteger(value.raster.bandCount) || value.raster.bandCount <= 0 ||
      !Number.isSafeInteger(value.raster.gutter) || value.raster.gutter < 0 ||
      !Number.isSafeInteger(value.raster.poleSize) || value.raster.poleSize <= 0 ||
      !Array.isArray(value.raster.observations) || !value.raster.observations.length ||
      !Number.isFinite(value.geometry?.radius) || value.geometry.radius <= 0 || !Number.isFinite(value.geometry.radiusKm) || value.geometry.radiusKm <= 0 ||
      !Number.isSafeInteger(value.lighting?.frameSize) || value.lighting.frameSize <= 0 ||
      !Number.isSafeInteger(value.lighting.frameCount) || value.lighting.frameCount < 2 ||
      !Number.isSafeInteger(value.lighting.columns) || value.lighting.columns <= 0 || value.lighting.frameCount % value.lighting.columns ||
      value.lighting.logicalSize !== value.geometry.radius * 2 || ![...value.raster.observations, ...(value.raster.mosaics ?? [])].some(lens => lens.id === value.presentation?.defaultLens)) {
    throw new TypeError('Invalid terrestrial surface preparation profile.');
  }
  if (value.raster.surfaceQuality !== undefined &&
      (!Number.isInteger(value.raster.surfaceQuality) || value.raster.surfaceQuality < 1 || value.raster.surfaceQuality > 100)) {
    throw new TypeError('Surface WebP quality must be an integer from 1 to 100.');
  }
  for (const lens of value.raster.scientific ?? []) {
    for (const {path, grid} of [lens, ...(lens.additionalGrids ?? [])]) {
      if (typeof path !== 'string' || path.startsWith('/') || path.split('/').includes('..') ||
          !grid || !Number.isSafeInteger(grid.width) || grid.width <= 0 || !Number.isSafeInteger(grid.height) || grid.height <= 0 ||
          ![undefined, 'equirectangular', 'polar-stereographic'].includes(grid.projection) ||
          (grid.projection === 'polar-stereographic' && ![-90, 90].includes(grid.poleLatitude)) ||
          (grid.latitudeRange && (grid.latitudeRange.length !== 2 || !grid.latitudeRange.every(Number.isFinite) ||
            grid.latitudeRange[0] < -90 || grid.latitudeRange[1] > 90 || grid.latitudeRange[0] >= grid.latitudeRange[1]))) {
        throw new TypeError('Invalid scientific source projection or extent.');
      }
    }
    if (lens.format !== 'geotiff' || !lens.grid || !Number.isSafeInteger(lens.grid.width) || !Number.isSafeInteger(lens.grid.height) ||
        lens.grid.width <= 0 || lens.grid.height <= 0 || !(lens.minimum < lens.maximum) || !Array.isArray(lens.colors) || lens.colors.length < 2 ||
        lens.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color)) ||
        (lens.sampling !== undefined && !['nearest', 'bilinear'].includes(lens.sampling)) ||
        (lens.valueTransform && (!Number.isFinite(lens.valueTransform.scale) || lens.valueTransform.scale <= 0 ||
          !Number.isFinite(lens.valueTransform.offset))) ||
        (lens.relief && (!(lens.relief.referenceRadiusMeters > 0) || !Array.isArray(lens.relief.lightDirection) ||
          lens.relief.lightDirection.length !== 3 || lens.relief.lightDirection.some(value => !Number.isFinite(value)) ||
          Math.abs(Math.hypot(...lens.relief.lightDirection) - 1) > 1e-12 || lens.relief.ambient < 0 || lens.relief.ambient >= 1 ||
          (lens.relief.heightToMeters !== undefined && (!Number.isFinite(lens.relief.heightToMeters) || lens.relief.heightToMeters <= 0))))) {
      throw new TypeError('Invalid scientific surface grid or relief profile.');
    }
  }
  const observationIds = new Set();
  for (const observation of value.raster.observations) {
    const policy = observation.validity;
    if (!/^[a-z][a-z0-9-]*$/.test(observation.id) || observationIds.has(observation.id) ||
        (observation.monochromeBase && !observationIds.has(observation.monochromeBase)) ||
        !['south-connected-black', 'geotiff-monochrome-alpha', 'geotiff-rgb-alpha', 'image-monochrome-no-data', 'image-rgb-no-data', 'geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(policy?.kind)) {
      throw new TypeError('Invalid observation identity, validity policy, or fallback ordering.');
    }
    const byteImage = ['image-monochrome-no-data', 'image-rgb-no-data'].includes(policy.kind);
    if ((policy.kind.startsWith('geotiff-') || byteImage) && (!(byteImage && policy.noData === null) && !Number.isFinite(policy.noData) ||
        !Number.isFinite(policy.centerLongitude) || policy.centerLongitude < 0 || policy.centerLongitude > 360)) {
      throw new TypeError('Invalid observed GeoTIFF no-data or coordinate policy.');
    }
    if (policy.connectedEdge !== undefined && (!byteImage || policy.noData !== 0 ||
        !['north', 'south'].includes(policy.connectedEdge))) {
      throw new TypeError('Connected coverage requires a byte image with exact black fill and a polar edge.');
    }
    if (byteImage && policy.noData !== null && (!Number.isInteger(policy.noData) || policy.noData < 0 || policy.noData > 255)) {
      throw new TypeError('Byte observation no-data must be an exact byte value.');
    }
    if (['geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(policy.kind) &&
        (!Array.isArray(policy.displayRange) || policy.displayRange.length !== 2 || !policy.displayRange.every(Number.isFinite) ||
         !(policy.displayRange[0] < policy.displayRange[1]) || !(policy.specialValueMagnitude > 0) ||
         !(policy.resolutionMeters > 0) || !Array.isArray(policy.origin) || policy.origin.length !== 2 || !policy.origin.every(Number.isFinite))) {
      throw new TypeError('Invalid floating-point observation grid or display stretch.');
    }
    if (policy.kind === 'geotiff-rgb-alpha' && (
        !['rgb', 'monochrome'].includes(policy.channels) || !['all-channels', 'any-channel'].includes(policy.zeroValidity) ||
        (policy.withholdLatitudeDegrees !== undefined && !(policy.withholdLatitudeDegrees > 0 && policy.withholdLatitudeDegrees <= 90)) ||
        (policy.withholdLongitudeDegrees !== undefined && (!Array.isArray(policy.withholdLongitudeDegrees) ||
          policy.withholdLongitudeDegrees.length !== 2 || !policy.withholdLongitudeDegrees.every(Number.isFinite) ||
          policy.withholdLongitudeDegrees[0] < 0 || policy.withholdLongitudeDegrees[1] > 360 ||
          policy.withholdLongitudeDegrees[0] >= policy.withholdLongitudeDegrees[1])))) {
      throw new TypeError('Invalid observed channel or geographic withholding policy.');
    }
    observationIds.add(observation.id);
  }
  for (const mosaic of value.raster.mosaics ?? []) {
    if (!['pds3-byte-equirectangular', 'controlled-orthographic'].includes(mosaic.format) || !/^[a-z][a-z0-9-]*$/.test(mosaic.id) ||
        observationIds.has(mosaic.id) || !/^[a-z][a-z0-9-]*$/.test(mosaic.consumer)) {
      throw new TypeError('Invalid PDS byte mosaic identity or format.');
    }
    observationIds.add(mosaic.id);
  }
  for (const lens of value.raster.observedColors ?? []) {
    const p = lens.profile;
    if (!p || !(p.referenceRadiusMeters > 0) || !(p.gamma > 0) || !Array.isArray(p.filters) || p.filters.length !== 3 ||
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
          ['referenceIncidenceDegrees', 'referenceEmissionDegrees', 'maximumIncidenceDegrees', 'maximumEmissionDegrees'].some(key =>
            !Number.isFinite(photometry[key]) || photometry[key] < 0 || photometry[key] >= 90) ||
          photometry.referenceIncidenceDegrees > photometry.maximumIncidenceDegrees ||
          photometry.referenceEmissionDegrees > photometry.maximumEmissionDegrees ||
          !Number.isSafeInteger(levels?.boundaryPixels) || levels.boundaryPixels < 1 ||
          !Array.isArray(levels.luminance) || levels.luminance.length !== 3 ||
          levels.luminance.some(value => !Number.isFinite(value) || value < 0) ||
          Math.abs(levels.luminance.reduce((sum, value) => sum + value, 0) - 1) > 1e-12 ||
          ['sun', 'observer'].some(key => typeof vectors?.[key] !== 'string' || vectors[key].startsWith('/') || vectors[key].split('/').includes('..'))) {
        throw new TypeError('Invalid source-bound disk normalization or color-level profile.');
      }
    }
  }
  return value;
}

export async function prepareTerrestrialCelestial({ sourceDirectory, publicDirectory, outputDirectory, config, source }) {
  const ensureDirectories = () => mkdir(publicDirectory, { recursive: true });
  const sky = await preparePlanetCubicSky({ objectId: config.namespace, sourceRoot: sourceDirectory, publicRoot: publicDirectory,
    ensureDirectories, validateSourceGroup: consumer => source.validateGroup(consumer), includeSun: false,
    cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
    astrometricSampling: prepareAstrometricCubeSampling(),
    catalogueStars: await prepareCatalogueStars({ fovDegrees: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees }), writeModule: false });
  const frame = prepareEclipticPresentationFrame(config.namespace), sceneDirection = frame.sunDirection;
  const presentation = { ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
    source: config.celestial.sunSource, sourcePath: 'src/platform/solar-geometry.mjs',
    qualification: `Observed ${config.displayName} Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
      'expressed in the ecliptic presentation frame (north up, Sun left at zero yaw) and in view space at the default camera pose.',
    bodyFixedDirection: requireBodyFixedSunDirection(config.namespace), presentationFrame: frame.model,
    localDirection: sceneDirection,
    referenceViewDirection: prepareSunReferenceViewDirection({ bodyId: config.namespace, ...config.geometry.camera, sceneDirection }),
  };
  const sun = await preparePlanetDirectionalSun({ objectId: config.namespace, publicRoot: publicDirectory, ensureDirectories,
    meanHeliocentricDistanceAu: config.distanceAu, presentation, writeModule: false });
  await Promise.all([writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(sky)}\n`),
    writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(sun)}\n`)]);
  // Match the JSON transport boundary used by shared celestial preparation.
  // Empty catalogue bands contain non-finite limits before serialization.
  return JSON.parse(JSON.stringify({ sky, sun }));
}

/** Source inputs feed reusable raster, geometry, celestial and presentation operations. */
export async function prepareTerrestrialLayers({ sourceDirectory, publicDirectory, outputDirectory, config: input, prepareContent }) {
  const config = parseTerrestrialProfile(input);
  if (typeof prepareContent !== 'function') throw new TypeError('Terrestrial preparation requires the shared content preparer.');
  const source = await createSourceManifest({ planetId: config.namespace, planetName: config.displayName, sourceRoot: sourceDirectory });
  await source.verify();
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const context = { sourceDirectory, publicDirectory, outputDirectory, config, source };
  if (config.kind === 'affine-photographic-atmosphere') return prepareAffineLayers({...context,prepareContent});
  const surfaces = await prepareSolidRasters(context);
  const raster = await prepareSolidMaterial({ ...context, surfaces });
  const assets = { surfaces: Object.fromEntries(raster.surfaces.map(surface => [surface.id, {
    url: surface.surface.url, url2x: surface.surface.url,
    polesUrl: surface.polesUrl, polesUrl2x: surface.polesUrl,
  }])) };
  await writeFile(resolve(outputDirectory, 'assets.json'), `${JSON.stringify(assets)}\n`);
  const content = await prepareContent({ sourceDirectory, publicDirectory, outputDirectory, config: { contentPath: 'content/object.json' } });
  const celestial = await prepareTerrestrialCelestial(context);
  const scene = await prepareSolidScene({ ...context, celestial });
  const definition = await prepareSolidPresentation({ ...context, scene, material: raster, controls: content.controls });
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(definition)}\n`);
  return { raster, celestial, scene, definition, content };
}

import { array, choice, direction, fail, finite, integer, numbers, positive, record, text } from './guards.js';
import type { CubicSkyPlan } from '../solar-system/cubic-sky-runtime.js';
import type { DirectionalSunPlan } from '../solar-system/directional-sun-runtime.js';
import type { ExposureOptions } from '@cssearth/engine';

export function requireExposure(value: unknown): asserts value is ExposureOptions {
  const exposure = record(value, 'star exposure');
  if (positive(exposure.fovDegrees, 'exposure field of view') >= 180) fail('exposure field of view must be below 180 degrees');
  for (const name of ['screenFactor', 'adaptationLuminanceCdM2', 'exposureScale', 'intensityMax', 'maxRadiusPx', 'linearScale']) if (exposure[name] !== undefined) positive(exposure[name], `exposure ${name}`);
  if (exposure.intensityMax !== undefined && finite(exposure.intensityMax, 'intensity cap') > 1 ||
      exposure.maxRadiusPx !== undefined && finite(exposure.maxRadiusPx, 'maximum radius') < 0.6 ||
      exposure.haloPeak !== undefined && (finite(exposure.haloPeak, 'halo peak') < 0 || finite(exposure.haloPeak, 'halo peak') > 0.5)) fail('star exposure exceeds presentation bounds');
}
export function requireSky(value: unknown): asserts value is CubicSkyPlan {
  const sky = record(value, 'sky');
  if (sky.schema !== 'cssearth-prepared-cubic-sky@2' || sky.standard !== 'cssearth-cubic-sky-standard@2' ||
      sky.runtimeRasterization !== false || sky.orientation !== 'camera-rotation-only-no-translation-or-parallax') fail('retained cubic sky is incompatible');
  const faces = array(sky.faces, 'sky faces'), ids = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  if (faces.length !== ids.length) fail('cubic sky requires six faces');
  faces.forEach((input, index) => {
    const face = record(input, 'sky face'); if (face.id !== ids[index]) fail('cube faces must retain their order');
    for (const name of ['url', 'url2x', 'highContrastUrl', 'highContrastUrl2x']) text(face[name], `face ${name}`);
  });
  for (const name of ['cameraPitchResponse', 'cameraZoomResponse', 'presentationPitchOffsetDegrees', 'presentationYawOffsetDegrees']) finite(sky[name], `sky ${name}`);
  if (sky.sceneRegistration !== undefined || sky.cameraContract === 'scene-locked-unbounded-accumulated-matrix3d') matrixText(sky.sceneRegistration, 'scene registration');
  if (sky.cameraContract !== undefined && typeof sky.cameraContract !== 'string') {
    const contract = record(sky.cameraContract, 'sky camera contract');
    for (const name of ['source', 'sourcePath', 'qualification']) text(contract[name], `sky camera ${name}`);
    for (const name of ['rotationResponse', 'zoomResponse', 'horizontalFovDegrees', 'focalLengthOverViewportWidth']) finite(contract[name], `sky camera ${name}`);
  }
  if (sky.projection !== undefined) {
    const projection = record(sky.projection, 'sky projection');
    if (projection.axis !== 'horizontal' || projection.runtimeProjection !== false) fail('sky projection is incompatible');
    if (positive(projection.horizontalFovDegrees, 'sky field of view') >= 180) fail('sky field of view must be below 180 degrees');
    positive(projection.focalLengthOverViewportWidth, 'sky focal length'); text(projection.cssPerspective, 'sky CSS perspective');
  }
  if (sky.catalogueStars !== undefined) {
    const stars = record(sky.catalogueStars, 'catalogue stars');
    if (stars.schema !== 'cssearth-prepared-catalogue-stars@1' || stars.coexistence !== 'photograph-kept-retained-band-holes-catalogue-points-for-bright-stars') fail('prepared catalogue is incompatible');
    positive(stars.photographDetailGain, 'photograph detail gain'); positive(stars.photographHoleRadiusFacePixels, 'photograph holes');
    positive(stars.retainedRadiusShareOfHalfSide, 'retained star scale'); finite(stars.limitingMagnitude, 'limiting magnitude');
    for (const name of ['count', 'photographicCount', 'retainedCount']) integer(stars[name], `catalogue ${name}`);
    array(stars.bands, 'star bands'); requireExposure(stars.exposure);
    positive(record(stars.exposure, 'star exposure').maxRadiusPx, 'maximum retained radius');
    const retained = array(stars.retained, 'retained stars');
    if (!retained.length || stars.retainedCount !== retained.length) fail('retained star count is incompatible');
    for (const input of retained) {
      const star = record(input, 'retained star');
      text(star.transform, 'star transform'); positive(star.radiusPx, 'star radius');
      if (finite(star.rawRadiusPx, 'raw star radius') < 0 || positive(star.luminance, 'star luminance') > 1 || finite(star.haloAlpha, 'star halo alpha') < 0) fail('star photometry is invalid');
      numbers(star.color, 'star color', 3); direction(star.direction, 'star direction', 1e-5); finite(star.magnitude, 'star magnitude'); text(star.band, 'star band');
      if (star.name !== undefined && star.name !== null) text(star.name, 'star name', true);
    }
  }
  if (sky.sun !== undefined) {
    const sun = record(sky.sun, 'baked Sun');
    if (sun.schema !== 'cssearth-prepared-sun-cubemap-bake@1' || sun.billboard !== false || sun.bakedIntoStarfield !== true || sun.runtimeRasterization !== false) fail('baked Sun is incompatible');
    direction(sun.localDirection, 'baked Sun local direction'); direction(sun.initialViewDirection, 'baked Sun view direction');
  }
}
export function matrixText(value: unknown, label: string): void {
  const match = text(value, label).match(/^matrix3d\(([^)]+)\)$/u);
  if (!match) fail(`${label} requires matrix3d`);
  const matrix = numbers(match[1].split(',').map(Number), label, 16);
  if (matrix[12] !== 0 || matrix[13] !== 0 || matrix[14] !== 0) fail(`${label} must be a rotation without translation`);
}
export function requireSun(value: unknown): asserts value is DirectionalSunPlan {
  const sun = record(value, 'directional Sun'), asset = record(sun.asset, 'Sun asset'), projection = record(sun.projection, 'Sun projection');
  const distance = record(sun.distanceScaling, 'Sun distance'), appearance = record(sun.appearance, 'Sun appearance');
  const radialFit = record(appearance.analyticRadialFit, 'Sun radial fit'), density = record(asset.density1, 'Sun density');
  if (sun.schema !== 'cssearth-prepared-directional-sun@3' || sun.billboard !== true || sun.bakedIntoStarfield !== false || sun.runtimeRasterization !== false ||
      asset.sourcePixels !== 'repository-authored-clean-room-raster' || projection.fixedAngularSize !== true || projection.runtimeGeometry !== false ||
      distance.schema !== 'cssearth-directional-sun-distance-standard@2' || distance.model !== 'iau-nominal-photospheric-disc-at-mean-heliocentric-distance' ||
      distance.nominalSolarRadiusKilometers !== 695700 || distance.astronomicalUnitKilometers !== 149597870.7 ||
      distance.observerDistanceModel !== 'object-catalog-mean-heliocentric-distance') fail('directional Sun is incompatible');
  text(asset.url, 'Sun URL'); text(asset.url2x, 'Sun 2x URL');
  direction(sun.localDirection, 'Sun local direction'); direction(sun.referenceViewDirection, 'Sun reference direction');
  const focal = positive(projection.focalX, 'Sun focal'), center = positive(projection.centerDistanceOverFar, 'Sun center distance');
  const observer = positive(distance.meanHeliocentricDistanceAu, 'Sun mean distance') * 149597870.7;
  const radius = Math.atan(695700 / observer), disk = focal * Math.tan(radius);
  const core = positive(radialFit.coreRadiusPixels, 'Sun core radius') * 2 / positive(density.width, 'Sun image width');
  const sprite = disk / core, extent = sprite / focal;
  const same = (actual: unknown, expected: number, label: string) => {
    const n = positive(actual, label);
    if (Math.abs(n - expected) > Number.EPSILON * Math.max(1, Math.abs(n), Math.abs(expected)) * 8) fail(`${label} differs from prepared physical scale`);
  };
  same(distance.observerDistanceKilometers, observer, 'Sun observer distance'); same(distance.angularDiameterDegrees, radius * 360 / Math.PI, 'Sun angular diameter');
  same(distance.physicalDiskViewportWidthShare, disk, 'Sun physical disc'); same(distance.spriteOpaqueCoreDiameterShare, core, 'Sun opaque core');
  same(distance.physicalToGoogleEarthMarsSpriteScale, sprite / positive(distance.googleEarthMarsSpriteViewportWidthShare, 'Sun reference sprite'), 'Sun sprite scale');
  same(projection.apparentViewportWidthShare, sprite, 'Sun projected sprite'); same(projection.halfExtentOverCenter, extent, 'Sun half extent');
  same(projection.halfExtentOverFar, extent * center, 'Sun far extent');
}

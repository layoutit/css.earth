import { boolean, choice, fail, finite, positive, record, text } from './guards.js';
import type { CameraPlan } from '../camera/runtime-camera-types.js';

export function requireCamera(value: unknown): asserts value is CameraPlan {
  const camera = record(value, 'camera');
  choice(camera.cameraModel, ['accumulated-matrix3d'], 'camera model');
  for (const name of ['pitchBounded', 'yawBounded']) if (boolean(camera[name], `camera ${name}`)) fail(`camera ${name} must preserve accumulated rotation`);
  for (const name of ['minimumControlPitchDegrees', 'maximumControlPitchDegrees', 'defaultControlPitchDegrees',
    'defaultControlYawDegrees', 'initialScenePitchDegrees', 'maximumScenePitchDegrees']) finite(camera[name], `camera ${name}`);
  for (const name of ['minimumZoom', 'maximumZoom', 'defaultZoom', 'sceneScale', 'logicalBodyDiameter']) positive(camera[name], `camera ${name}`);
  const minimum = positive(camera.minimumZoom, 'minimum zoom'), maximum = positive(camera.maximumZoom, 'maximum zoom');
  if (maximum < minimum || positive(camera.defaultZoom, 'default zoom') < minimum || positive(camera.defaultZoom, 'default zoom') > maximum ||
      finite(camera.maximumControlPitchDegrees, 'maximum pitch') <= finite(camera.minimumControlPitchDegrees, 'minimum pitch')) fail('camera bounds are invalid');
  for (const name of ['materialReferenceControlPitchDegrees', 'materialReferenceControlYawDegrees']) if (camera[name] !== undefined) finite(camera[name], name);
  if (camera.framingScale !== undefined && positive(camera.framingScale, 'camera framing scale') > 1) fail('camera framing scale must be at most one');
  const fit = record(camera.responsiveFit, 'responsive fit');
  choice(fit.model, ['continuous-aspect-smoothstep'], 'responsive fit model');
  for (const name of ['portraitBaseWidthShare', 'narrowPortraitWidthShareGain', 'landscapeWidthShareGain',
    'narrowPortraitAspectRatio', 'portraitAspectRatio', 'squareAspectRatio', 'maximumHeightShare', 'maximumMobilePreviewShare', 'minimumZoom', 'maximumZoom']) finite(fit[name], `responsive ${name}`);
  if (positive(fit.maximumMobilePreviewShare, 'mobile preview share') > 1) fail('mobile preview share must be at most one');
  if (!(positive(fit.minimumZoom, 'responsive minimum') <= positive(fit.maximumZoom, 'responsive maximum')) ||
      !(positive(fit.narrowPortraitAspectRatio, 'narrow aspect') < positive(fit.portraitAspectRatio, 'portrait aspect')) ||
      !(positive(fit.portraitAspectRatio, 'portrait aspect') < positive(fit.squareAspectRatio, 'square aspect'))) fail('responsive fit bounds are invalid');
  if (camera.projection !== undefined) {
    const projection = record(camera.projection, 'camera projection');
    choice(projection.model, ['css-perspective-shared-with-sky'], 'camera projection'); text(projection.cssPerspective, 'CSS perspective');
  }
  if (camera.dolly !== undefined) {
    const dolly = record(camera.dolly, 'dolly'); choice(dolly.model, ['multiplicative-wheel-distance'], 'dolly model');
    for (const name of ['wheelStepPerDelta', 'minimumDistanceRadii', 'maximumDistanceOverOrbitExtent']) positive(dolly[name], `dolly ${name}`);
    if (!(positive(dolly.minimumDistanceRadii, 'minimum distance') > 1)) fail('camera must remain outside body');
    if (dolly.surfaceArcPerCssPixelRadians !== undefined &&
        !(positive(dolly.surfaceArcPerCssPixelRadians, 'dolly surfaceArcPerCssPixelRadians') < Math.PI)) {
      fail(`dolly surfaceArcPerCssPixelRadians must be below pi; found ${String(dolly.surfaceArcPerCssPixelRadians)}`);
    }
  }
  if (camera.levelOfDetail !== undefined) {
    const lod = record(camera.levelOfDetail, 'level of detail'); choice(lod.model, ['silhouette-diameter-crossfade'], 'level of detail model');
    const values = ['billboardFadeStartDiscPixels', 'billboardFullDiscPixels', 'markerFadeStartDiscPixels', 'markerFullDiscPixels'].map(name => positive(lod[name], name));
    if (values.some((number, index) => index > 0 && values[index - 1] <= number)) fail('level of detail thresholds must descend');
  }
  if (camera.orbitLineFade !== undefined) {
    const fade = record(camera.orbitLineFade, 'orbit line fade');
    if (!(finite(fade.visibleBelowDiscHeightShare, 'visible orbit threshold') < finite(fade.hiddenAboveDiscHeightShare, 'hidden orbit threshold'))) fail('orbit fade bounds are invalid');
  }
  if (camera.drag !== undefined) choice(record(camera.drag, 'drag').model, ['screen-axis-tumble', 'pole-held-tumble'], 'drag model');
  if (camera.projection !== undefined && (!camera.dolly || !camera.levelOfDetail || !camera.orbitLineFade)) fail('perspective camera requires dolly and appearance thresholds');
}

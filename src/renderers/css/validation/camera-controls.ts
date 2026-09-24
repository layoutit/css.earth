import { SHELL_SETTING_NAMES } from '../../../platform/shell-settings.mts';
import { array, boolean, choice, fail, finite, integer, positive, record, text, unique } from './guards.js';
import type { CameraPlan } from '../navigation/types.js';
import type { ObjectControls } from '../runtime/object-contract.js';
import { objectCycleStates } from '../runtime/object-contract.js';

export function requireControls(value: unknown): asserts value is ObjectControls {
  const controls = record(value, 'controls');
  if (controls.lenses !== null) {
    const lenses = record(controls.lenses, 'lenses');
    const ids = array(lenses.controls, 'lens controls').map(input => {
      const lens = record(input, 'lens'); text(lens.label, 'lens label'); return text(lens.id, 'lens id');
    });
    unique(ids, 'lenses');
    if (!ids.includes(text(lenses.defaultLens, 'default lens'))) fail('default lens must be declared');
  }
  if (controls.settings !== null) {
    const settings = record(controls.settings, 'settings'), names: string[] = [];
    for (const input of array(settings.controls, 'setting controls')) {
      const setting = record(input, 'setting'), name = text(setting.name, 'setting name'); names.push(name);
      if (SHELL_SETTING_NAMES.has(name)) fail(`setting ${name} belongs to the shared shell`);
      const label = text(setting.label, 'setting label'), kind = choice(setting.kind, ['cycle', 'toggle'], 'setting kind');
      if (kind === 'toggle') boolean(setting.checked, 'toggle default');
      else {
        const state = text(setting.state, 'cycle default');
        const states = setting.states === undefined ? undefined : array(setting.states, 'cycle states').map(item => {
          const entry = record(item, 'cycle state'); return {label: text(entry.label, 'cycle label'), value: finite(entry.value, 'cycle value')};
        });
        objectCycleStates({kind, name, label, state, ...(states === undefined ? {} : {states})});
      }
    }
    unique(names, 'settings');
  }
}
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
  if (camera.drag !== undefined) choice(record(camera.drag, 'drag').model, ['screen-axis-tumble'], 'drag model');
  if (camera.projection !== undefined && (!camera.dolly || !camera.levelOfDetail || !camera.orbitLineFade)) fail('perspective camera requires dolly and appearance thresholds');
}

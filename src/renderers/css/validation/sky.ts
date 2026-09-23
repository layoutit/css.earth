import { direction, fail, finite, numbers, positive, record, text } from './guards.js';
import type { CubicSkyPlan } from '../solar-system/cubic-sky-plan.js';
import type { DirectionalSunPlan } from '../solar-system/directional-sun-coordinate.js';

export function requireSky(value: unknown): asserts value is CubicSkyPlan {
  const sky = record(value, 'sky');
  if (sky.schema !== 'cssearth-prepared-cubic-sky@3' || sky.standard !== 'cssearth-cubic-sky-standard@3' ||
      sky.runtimeRasterization !== false || sky.orientation !== 'camera-rotation-only-no-translation-or-parallax') fail('retained cubic sky is incompatible');
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
}
export function matrixText(value: unknown, label: string): void {
  const match = text(value, label).match(/^matrix3d\(([^)]+)\)$/u);
  if (!match) fail(`${label} requires matrix3d`);
  const matrix = numbers(match[1].split(',').map(Number), label, 16);
  if (matrix[12] !== 0 || matrix[13] !== 0 || matrix[14] !== 0) fail(`${label} must be a rotation without translation`);
}
export function requireSun(value: unknown): asserts value is DirectionalSunPlan {
  const sun = record(value, 'directional Sun');
  if (sun.schema !== 'cssearth-prepared-directional-sun@4') fail('directional Sun is incompatible');
  direction(sun.localDirection, 'Sun local direction'); direction(sun.referenceViewDirection, 'Sun reference direction');
}

import { checks, type Fail } from '@cssearth/core';
import { PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA, PREPARED_DIRECTIONAL_SUN_SCHEMA } from '../camera/runtime-camera-types.js';
import type { CubicSkyPlan, DirectionalSunPlan, PreparedCubicSkyPlan, PreparedDirectionalSunPlan } from '../camera/runtime-camera-types.js';
import { fail as runtimeFail } from '../runtime-validation/guards.js';

// Authored validation is the historical bake boundary; runtime opts into stricter camera checks.
export function validatePreparedCubicSky<Policy extends 'authored' | 'runtime' = 'authored'>(
  value: unknown, policy: Policy = 'authored' as Policy,
): Policy extends 'runtime' ? CubicSkyPlan : PreparedCubicSkyPlan {
  const runtime = policy === 'runtime';
  const fail: Fail = runtime ? runtimeFail : () => { throw new TypeError('Prepared retained cubic sky is incompatible.'); };
  const { record: plainRecord, finite, positive, text, numbers } = checks(fail);
  const record = runtime ? plainRecord : (input: unknown, label: string): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`${label} must be a record`);
    return input as Record<string, unknown>;
  };
  const sky = record(value, 'sky');
  if (sky.schema !== PREPARED_CUBIC_SKY_SCHEMA || sky.standard !== CUBIC_SKY_STANDARD_SCHEMA ||
      sky.runtimeRasterization !== false || sky.orientation !== 'camera-rotation-only-no-translation-or-parallax') fail('retained cubic sky is incompatible');
  if (!runtime) { text(sky.model, 'sky model'); text(sky.qualification, 'sky qualification'); }
  for (const name of ['cameraPitchResponse', 'cameraZoomResponse', 'presentationPitchOffsetDegrees', 'presentationYawOffsetDegrees']) finite(sky[name], `sky ${name}`);
  if (runtime && (sky.sceneRegistration !== undefined || sky.cameraContract === 'scene-locked-unbounded-accumulated-matrix3d')) {
    const match = text(sky.sceneRegistration, 'scene registration').match(/^matrix3d\(([^)]+)\)$/u);
    if (!match) fail('scene registration requires matrix3d');
    const matrix = numbers(match[1].split(',').map(Number), 'scene registration', 16);
    if (matrix[12] !== 0 || matrix[13] !== 0 || matrix[14] !== 0) fail('scene registration must be a rotation without translation');
  } else if (!runtime && sky.sceneRegistration !== undefined && typeof sky.sceneRegistration !== 'string') fail('scene registration must be a string');
  if (sky.cameraContract !== undefined && typeof sky.cameraContract !== 'string') {
    const contract = record(sky.cameraContract, 'sky camera contract');
    for (const name of ['source', 'sourcePath', 'qualification']) {
      if (runtime) text(contract[name], `sky camera ${name}`);
      else if (typeof contract[name] !== 'string') fail(`sky camera ${name} must be a string`);
    }
    for (const name of ['rotationResponse', 'zoomResponse', 'horizontalFovDegrees', 'focalLengthOverViewportWidth']) finite(contract[name], `sky camera ${name}`);
  }
  if (sky.projection !== undefined) {
    const projection = record(sky.projection, 'sky projection');
    if (projection.axis !== 'horizontal' || projection.runtimeProjection !== false) fail('sky projection is incompatible');
    if (runtime) {
      if (positive(projection.horizontalFovDegrees, 'sky field of view') >= 180) fail('sky field of view must be below 180 degrees');
      positive(projection.focalLengthOverViewportWidth, 'sky focal length');
    } else {
      finite(projection.horizontalFovDegrees, 'sky field of view'); finite(projection.focalLengthOverViewportWidth, 'sky focal length');
    }
    text(projection.cssPerspective, 'sky CSS perspective');
  }
  return value as Policy extends 'runtime' ? CubicSkyPlan : PreparedCubicSkyPlan;
}

export function validateDirectionalSunPlan<Policy extends 'authored' | 'runtime' = 'authored'>(
  value: unknown, policy: Policy = 'authored' as Policy,
): Policy extends 'runtime' ? DirectionalSunPlan : PreparedDirectionalSunPlan {
  const runtime = policy === 'runtime';
  const fail: Fail = runtime ? runtimeFail : () => { throw new TypeError('Prepared directional Sun is incompatible.'); };
  const { record: plainRecord, numbers } = checks(fail);
  const record = runtime ? plainRecord : (input: unknown, label: string): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`${label} must be a record`);
    return input as Record<string, unknown>;
  };
  const sun = record(value, 'directional Sun');
  if (sun.schema !== PREPARED_DIRECTIONAL_SUN_SCHEMA) fail('directional Sun is incompatible');
  for (const [field, label] of [['localDirection', 'Sun local direction'], ['referenceViewDirection', 'Sun reference direction']]) {
    const direction = numbers(sun[field], label, 3), error = Math.abs(Math.hypot(...direction) - 1);
    if (runtime ? error > 1e-9 : !(error < 1e-9)) fail(`${label} must be a unit direction`);
  }
  if (!runtime) {
    if (typeof sun.model !== 'string') fail('Sun model must be a string');
    const provenance = record(sun.provenance, 'Sun provenance');
    for (const field of ['source', 'sourcePath', 'qualification']) if (typeof provenance[field] !== 'string') fail(`Sun ${field} must be a string`);
  }
  return value as Policy extends 'runtime' ? DirectionalSunPlan : PreparedDirectionalSunPlan;
}

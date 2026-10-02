import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePreparedCubicSky, validateDirectionalSunPlan } from './sky-contract.js';
import { PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA, PREPARED_DIRECTIONAL_SUN_SCHEMA } from './runtime-camera-types.js';

const sky = { schema: PREPARED_CUBIC_SKY_SCHEMA, standard: CUBIC_SKY_STANDARD_SCHEMA, model: 'prepared', qualification: 'source',
  runtimeRasterization: false, orientation: 'camera-rotation-only-no-translation-or-parallax',
  cameraPitchResponse: -1, cameraZoomResponse: 0, presentationPitchOffsetDegrees: 0, presentationYawOffsetDegrees: 0 };
const sun = { schema: PREPARED_DIRECTIONAL_SUN_SCHEMA, model: 'prepared', localDirection: [1, 0, 0],
  referenceViewDirection: [0, 1, 0], provenance: { source: '', sourcePath: '', qualification: '' } };

test('shared sky/Sun identity and numerical checks reject malformed writer and reader data', () => {
  for (const runtime of [false, true]) {
    const skyCheck = runtime ? (value: unknown) => validatePreparedCubicSky(value, { runtime: true }) : validatePreparedCubicSky;
    const sunCheck = runtime ? (value: unknown) => validateDirectionalSunPlan(value, { runtime: true }) : validateDirectionalSunPlan;
    assert.equal(skyCheck(sky), sky); assert.equal(sunCheck(sun), sun);
    for (const replacement of [{ schema: 'old' }, { standard: 'old' }, { runtimeRasterization: true },
      { orientation: 'translation' }, { cameraZoomResponse: NaN }]) assert.throws(() => skyCheck({ ...sky, ...replacement }));
    for (const replacement of [{ schema: 'old' }, { localDirection: [0, 0, 0] }, { referenceViewDirection: [0, NaN, 1] }]) {
      assert.throws(() => sunCheck({ ...sun, ...replacement }));
    }
  }
});

test('preparation metadata and runtime camera qualification retain their existing acceptance policies', () => {
  const metadataFree = { ...sky, model: undefined, qualification: undefined };
  assert.throws(() => validatePreparedCubicSky(metadataFree), /^TypeError: Prepared retained cubic sky is incompatible\.$/);
  assert.equal(validatePreparedCubicSky(metadataFree, { runtime: true }), metadataFree);
  const projected = { ...sky, projection: { axis: 'horizontal', runtimeProjection: false, horizontalFovDegrees: 180,
    focalLengthOverViewportWidth: 0, cssPerspective: '0cqw' } };
  assert.equal(validatePreparedCubicSky(projected, { preparation: true }), projected);
  assert.throws(() => validatePreparedCubicSky(projected), /incompatible/);
  assert.throws(() => validatePreparedCubicSky(projected, { runtime: true }), /below 180/);
  const registered = { ...sky, sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1)' };
  assert.equal(validatePreparedCubicSky(registered, { preparation: true }), registered);
  assert.throws(() => validatePreparedCubicSky(registered, { runtime: true }), /without translation/);
  assert.throws(() => validateDirectionalSunPlan({ ...sun, provenance: null }), /Prepared directional Sun is incompatible/);
  assert.doesNotThrow(() => validateDirectionalSunPlan({ ...sun, provenance: null }, { runtime: true }));
});

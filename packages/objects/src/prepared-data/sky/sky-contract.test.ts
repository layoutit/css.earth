import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePreparedCubicSky, validateDirectionalSunPlan } from './sky-contract.js';
import { PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA, PREPARED_DIRECTIONAL_SUN_SCHEMA } from '../camera/runtime-camera-types.js';

const sky = { schema: PREPARED_CUBIC_SKY_SCHEMA, standard: CUBIC_SKY_STANDARD_SCHEMA, model: 'prepared', qualification: 'source',
  runtimeRasterization: false, orientation: 'camera-rotation-only-no-translation-or-parallax',
  cameraPitchResponse: -1, cameraZoomResponse: 0, presentationPitchOffsetDegrees: 0, presentationYawOffsetDegrees: 0 };
const sun = { schema: PREPARED_DIRECTIONAL_SUN_SCHEMA, model: 'prepared', localDirection: [1, 0, 0],
  referenceViewDirection: [0, 1, 0], provenance: { source: '', sourcePath: '', qualification: '' } };

test('shared sky/Sun identity and numerical checks reject malformed writer and reader data', () => {
  for (const runtime of [false, true]) {
    const skyCheck = runtime ? (value: unknown) => validatePreparedCubicSky(value, 'runtime') : validatePreparedCubicSky;
    const sunCheck = runtime ? (value: unknown) => validateDirectionalSunPlan(value, 'runtime') : validateDirectionalSunPlan;
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
  assert.equal(validatePreparedCubicSky(metadataFree, 'runtime'), metadataFree);
  const contract = { rotationResponse: 1, zoomResponse: 1, horizontalFovDegrees: 200,
    focalLengthOverViewportWidth: 1, source: 's', sourcePath: 'p', qualification: 'q' };
  const projection = { axis: 'horizontal', runtimeProjection: false, horizontalFovDegrees: 60,
    focalLengthOverViewportWidth: 1, cssPerspective: '100cqw' };
  const authoredOnly = [
    ...[180, 200].map(horizontalFovDegrees => ({ ...sky, projection: { ...projection, horizontalFovDegrees } })),
    ...[0, -1].map(focalLengthOverViewportWidth => ({ ...sky, projection: { ...projection, focalLengthOverViewportWidth } })),
    ...['source', 'sourcePath', 'qualification'].map(field => ({ ...sky, cameraContract: { ...contract, [field]: '' } })),
    { ...sky, sceneRegistration: '' },
    { ...sky, sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1)' },
    { ...sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d' },
  ];
  for (const value of authoredOnly) {
    assert.equal(validatePreparedCubicSky(value), value);
    assert.equal(validatePreparedCubicSky(value, 'authored'), value);
    assert.throws(() => validatePreparedCubicSky(value, 'runtime'), /Prepared data:/);
  }
  const registered = { ...sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d',
    sceneRegistration: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' };
  assert.equal(validatePreparedCubicSky(registered, 'runtime'), registered);
  assert.throws(() => validateDirectionalSunPlan({ ...sun, provenance: null }), /Prepared directional Sun is incompatible/);
  assert.doesNotThrow(() => validateDirectionalSunPlan({ ...sun, provenance: null }, 'runtime'));
});

test('directional Sun defaults to authored metadata acceptance', () => {
  assert.throws(() => validateDirectionalSunPlan({ ...sun, localDirection: new Array(3) }), /incompatible/);
  const emptyMetadata = { ...sun, model: '' };
  assert.equal(validateDirectionalSunPlan(emptyMetadata), emptyMetadata);
  assert.equal(validateDirectionalSunPlan(emptyMetadata, 'authored'), emptyMetadata);
  const metadataFree = { ...sun, model: undefined, provenance: undefined };
  assert.throws(() => validateDirectionalSunPlan(metadataFree), /^TypeError: Prepared directional Sun is incompatible\.$/);
  assert.throws(() => validateDirectionalSunPlan(metadataFree, 'authored'), /incompatible/);
  assert.equal(validateDirectionalSunPlan(metadataFree, 'runtime'), metadataFree);
});

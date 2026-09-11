import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMercuryEphemeris, FALLBACK_EPHEMERIS, parseSceneRotation, applyMatrix } from './lighting-geometry-oracle.mts';

const moduleUrl = (position: readonly number[]) => 'data:text/javascript,' + encodeURIComponent(`
  export function systemBarycentreHeliocentricAu() { return ${JSON.stringify(position)}; }
  export function bodyRotationAt() { return { poleRightAscensionRad: ${FALLBACK_EPHEMERIS.pole.rightAscensionDegrees * Math.PI / 180}, poleDeclinationRad: ${FALLBACK_EPHEMERIS.pole.declinationDegrees * Math.PI / 180} }; }
`);

test('the independent oracle validates dynamically loaded astronomy results', async () => {
  const checked = await loadMercuryEphemeris({ astronomyUrl: moduleUrl(FALLBACK_EPHEMERIS.heliocentricIcrfAu) });
  assert.deepEqual(checked.heliocentricIcrfAu, FALLBACK_EPHEMERIS.heliocentricIcrfAu);
  assert.equal(checked.fallback, false);
  await assert.rejects(loadMercuryEphemeris({ astronomyUrl: moduleUrl([1, 2]) }), /three components/);
  await assert.rejects(loadMercuryEphemeris({ astronomyUrl: 'data:text/javascript,export const bodyRotationAt = 1' }), /position and rotation functions/);
});

test('painted matrix parsing preserves rotations and rejects a stretched scene', () => {
  const identity = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  assert.deepEqual(applyMatrix(parseSceneRotation(identity), [2, 3, 4]), [2, 3, 4]);
  assert.throws(() => parseSceneRotation(identity.replace('matrix3d(1,', 'matrix3d(2,')), /not a rotation/);
});

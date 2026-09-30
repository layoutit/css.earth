import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { solidEllipsoidRadii } from '@cssearth/bake/objects/layers/terrestrial';
const test = sourceTest();

test('a body without a mesh draws its recipe ellipsoid with the long axis at the display radius', () => {
  const geometry = { radius: 230 };
  assert.deepEqual(solidEllipsoidRadii(geometry, null), { radius: 230, secondaryRadius: 230, polarRadius: 230 });
  assert.deepEqual(solidEllipsoidRadii(geometry, { kind: 'sphere', radiusKm: 252.1 }), { radius: 230, secondaryRadius: 230, polarRadius: 230 });
  const { radius, secondaryRadius, polarRadius } = solidEllipsoidRadii(geometry, { kind: 'ellipsoid', radiusKm: 256.6, secondaryRadiusKm: 251.4, polarRadiusKm: 248.3 });
  assert.equal(radius, 230);
  assert.ok(Math.abs(secondaryRadius / radius - 251.4 / 256.6) < 1e-12);
  assert.ok(Math.abs(polarRadius / radius - 248.3 / 256.6) < 1e-12);
  // An oblate recipe without a second axis keeps a round equator.
  assert.equal(solidEllipsoidRadii(geometry, { kind: 'ellipsoid', radiusKm: 100, polarRadiusKm: 90 }).secondaryRadius, 230);
});

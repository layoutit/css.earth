import { required } from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import runtimeDefinition from "../../../../src/planets/mercury/prepared/runtime.json" with {type: "json"};
import venusDefinition from "../../../../src/planets/venus/prepared/runtime.json" with {type: "json"};
import { projectHeliocentricView } from './heliocentric-view.js';

const plan = runtimeDefinition.heliocentricView.plan;
const input = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], focal: 1247.08,
  principalOffset: [-170, 0], viewportWidth: 1440, viewportHeight: 1000 };

test('other-body physical size uses the same tangent cone as focused geometry, before the visibility floor', () => {
  const projected = projectHeliocentricView(plan, { ...input, distance: 2e7, system: true, systemOrbits: false });
  const prepared = plan.system.bodies.find(body => body.id === 'venus');
  const marker = projected.system!.bodies.find(body => body.id === 'venus')!.marker;
  const depth = -required(prepared).position[2] - projected.body.translate[2] + input.focal;
  const expected = 2 * input.focal * required(prepared).radiusUnits / Math.sqrt(depth * depth - required(prepared).radiusUnits ** 2);
  assert.ok(Math.abs(marker.physicalDiameterPx - expected) < 1e-14);
  assert.ok(Math.abs(expected - .12180621293661688) < 1e-14);
  assert.equal(marker.diameterPx, Math.max(expected, 2 * required(prepared).pointPresentation.policy.minimumRadiusPx));
});

test('the full translated observer projects the selected body, Sun and system in one eye space', () => {
  const bodyCenter = [400, -50, -1400];
  const projected = projectHeliocentricView(plan, { ...input, bodyCenter,
    distance: Math.hypot(...bodyCenter), system: true, systemOrbits: false });
  assert.equal(projected.body.visible, true);
  assert.deepEqual(projected.body.screen, [-170 + input.focal * 400 / 1400, -input.focal * 50 / 1400]);
  assert.deepEqual(projected.body.translate, [230, -50, input.focal - 1400]);
  const expectedRadius = input.focal * plan.units.bodyRadiusUnits / Math.sqrt(1400 ** 2 - plan.units.bodyRadiusUnits ** 2);
  assert.ok(Math.abs(projected.body.silhouetteRadius - expectedRadius) < 1e-12);
  assert.ok(Math.abs(projected.body.silhouette!.centre[0] - projected.body.screen![0]) > 1,
    'Off-axis silhouette centre must retain its true outward displacement.');
  if (projected.sun.eye) assert.deepEqual(projected.sun.eye, plan.sun.position.map((component, axis) => component + bodyCenter[axis]));
});

test('a selected body behind the observer or intersecting the image plane has no visible silhouette', () => {
  for (const bodyCenter of [[400, 0, 1400], [1400, 0, -100]]) {
    const projected = projectHeliocentricView(plan, { ...input, bodyCenter, distance: Math.hypot(...bodyCenter) });
    assert.equal(projected.body.visible, false);
    assert.equal(projected.body.silhouette, null);
    assert.equal(projected.body.silhouetteDiameter, 0);
  }
  assert.throws(() => projectHeliocentricView(plan, { ...input, bodyCenter: [0, 0, -1400], distance: 2000 }), TypeError);
});

test('approaching another prepared body keeps its marker visible inside the distant source orbit clipping plane', () => {
  for (const [definition, destination] of [[runtimeDefinition, 'venus'], [venusDefinition, 'mercury']] as const) {
    const source = definition.heliocentricView.plan;
    const target = source.system.bodies.find(body => body.id === destination);
    let previousDiameter = 0;
    for (const radiusMultiple of [100, 30, 10, 5]) {
      const depth = required(target).radiusUnits * radiusMultiple;
      const eye = [-input.principalOffset[0] * depth / input.focal, 0, -depth];
      const bodyCenter = eye.map((value, axis) => value - required(target).position[axis]);
      const projected = projectHeliocentricView(source, { ...input, bodyCenter,
        distance: Math.hypot(...bodyCenter), system: true, systemOrbits: false });
      const marker = projected.system!.bodies.find(body => body.id === destination)!.marker;
      assert.ok(marker.depth < projected.near, 'The case must cross the source-distance orbit clipping plane.');
      assert.equal(marker.visible, true, `${definition.id} → ${destination}, radius multiple ${radiusMultiple}`);
      assert.equal(marker.classification, 'visible');
      assert.ok(marker.alpha > 0);
      assert.ok(marker.screen!.every(value => Math.abs(value) < 1e-6));
      assert.ok(marker.physicalDiameterPx > previousDiameter);
      previousDiameter = marker.physicalDiameterPx;
    }
  }
});

test('celestial visibility still rejects bodies behind or intersecting the camera plane', () => {
  const target = plan.system.bodies.find(body => body.id === 'venus');
  for (const [depth, classification] of [[-required(target).radiusUnits, 'behind-camera'],
    [required(target).radiusUnits / 2, 'intersects-camera-plane']] as const) {
    const eye = [-input.principalOffset[0] * depth / input.focal, 0, -depth];
    const bodyCenter = eye.map((value, axis) => value - required(target).position[axis]);
    const projected = projectHeliocentricView(plan, { ...input, bodyCenter,
      distance: Math.hypot(...bodyCenter), system: true, systemOrbits: false });
    const marker = projected.system!.bodies.find(body => body.id === 'venus')!.marker;
    assert.equal(marker.visible, false);
    assert.equal(marker.classification, classification);
  }
});

test('the prepared Sun uses the observer plane rather than the mounted object orbit clipping distance', () => {
  const source = venusDefinition.heliocentricView.plan;
  const depth = source.sun.radiusUnits * 1.1;
  const eye = [-input.principalOffset[0] * depth / input.focal, 0, -depth];
  const bodyCenter = eye.map((value, axis) => value - source.sun.position[axis]);
  const projected = projectHeliocentricView(source, { ...input, bodyCenter,
    distance: Math.hypot(...bodyCenter), system: true, systemOrbits: false });
  assert.ok(depth < projected.near, 'The Sun must exercise the source-distance orbit clipping plane.');
  assert.equal(projected.sun.visible, true);
  assert.equal(projected.system!.sun.visible, true);
});

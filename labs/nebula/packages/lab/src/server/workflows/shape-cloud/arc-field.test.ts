import assert from 'node:assert/strict';
import test from 'node:test';
import { createShapeCloudField, shapePixelToUnits } from '@cssearth/bake/volume';
import { readShapeCloudSettings } from '../../../features/shape-cloud/model.ts';
import type { ShapeCloudComponent } from '../../../features/shape-cloud/types.ts';
const ring: ShapeCloudComponent = { id: 'a', label: 'Arc', memberIds: ['ellipse-a'], groupId: 'one', shape: 'ring', operation: 'add',
  x: 100, y: 100, radiusX: 50, radiusY: 30, rotationDegrees: 0, weight: 1, thickness: .2, softness: .05, depth: .5, enabled: true };
function sample(degrees: number, patch: Partial<ShapeCloudComponent> = {}, z = 0) {
  const angle = degrees * Math.PI / 180, out: [number, number, number] = [0, 0, 0];
  const field = createShapeCloudField({ exposure: 1, components: [{ ...ring, ...patch }] }, 200, 200);
  const [x, y] = shapePixelToUnits(100 + 50 * Math.cos(angle), 100 + 30 * Math.sin(angle), 200, 200);
  field.sampleEmission(x, y, z, out); return out[0];
}
test('partial ring preserves supported emission, softens its ends and removes the unobserved opposite side', () => {
  const patch = { arcCenterDegrees: -90, arcSweepDegrees: 100 };
  assert.ok(sample(-90, patch) > 0);
  assert.equal(sample(90, patch), 0, 'Removing the sector gate must fail this check.');
  assert.ok(sample(-130, patch) > 0 && sample(-130, patch) < sample(-90, patch));
  assert.equal(sample(-141, patch), 0);
  assert.ok(sample(-90, patch, .25) > 0, 'The arc must occupy volume, not a photograph plane.');
  assert.equal(sample(90, patch, .25), 0);
});
test('complete rings retain legacy behavior and clockwise sectors wrap at the image angle seam', () => {
  for (const angle of [-179, -90, 0, 90, 179]) assert.equal(sample(angle), sample(angle, { arcSweepDegrees: 360, arcCenterDegrees: 90 }));
  assert.ok(sample(-179, { arcCenterDegrees: 180, arcSweepDegrees: 60 }) > 0);
  assert.equal(sample(0, { arcCenterDegrees: 180, arcSweepDegrees: 60 }), 0);
  for (const patch of [{ arcSweepDegrees: 0 }, { arcSweepDegrees: 361 }, { arcCenterDegrees: Infinity }])
    assert.throws(() => readShapeCloudSettings({ exposure: 1, components: [{ ...ring, ...patch }] }, 200, 200));
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { projectPreparedPoint } from '@cssearth/volume-viewer/camera/point-projection';
test('prepared lab stars preserve camera-relative depth, orientation and principal offset', () => {
  const identity = [1,0,0,0,1,0,0,0,1];
  const projected = projectPreparedPoint([12,24,20], [10,20,30], identity, 100, 3, -2);
  assert.deepEqual([projected.x, projected.y, projected.depth], [23,38,10]);
  assert.ok(Math.abs(projected.distanceUnits ** 2 - 120) < 1e-12);
  assert.equal(projectPreparedPoint([0,0,5], [0,0,0], identity, 100).depth, -5);
  assert.equal(projectPreparedPoint([10,0,0], [0,0,0], [0,0,1,0,1,0,-1,0,0], 100).depth, 10);
});

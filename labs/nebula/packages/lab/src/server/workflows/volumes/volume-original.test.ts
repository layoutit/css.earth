import assert from 'node:assert/strict';
import test from 'node:test';
import { reflectNebulaPoint } from '@cssearth/bake/nebula';
import { compiledCorners } from './volume-original.ts';

test('a compiled source lies where the delivered volume puts the same sky: its east edge on local +x, north up', () => {
  const origin = [188.98, 35.29, 40.45], bounds = { min: [-3755.6, -3909.3], max: [4133.6, 3979.9] };
  const [topLeft, topRight, bottomRight, bottomLeft] = compiledCorners(bounds, origin);
  // The bake's own reflection of a compiler point (west, north) relative to the origin.
  const delivered = (west: number, north: number) => reflectNebulaPoint([west - origin[0]!, north - origin[1]!, 0]);
  assert.deepEqual(topLeft, delivered(bounds.min[0]!, bounds.max[1]!));
  assert.deepEqual(bottomRight, delivered(bounds.max[0]!, bounds.min[1]!));
  // The picture's left (east) edge is at larger local x than its right (west) edge; its top (north) above its bottom.
  assert.ok(topLeft[0] > topRight[0] && topLeft[1] > bottomLeft[1]);
});

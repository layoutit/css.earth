import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { leafBoxBlocks, leafBoxPlacements } from './leaf-box.ts';
import { requireTexturePlacements } from '@cssearth/objects';

// Leaf centres on a sphere of radius 1000 scene units around the origin (a body's scale; placements round to 0.01).
const sphere = Array.from({ length: 400 }, (_, index) => {
  const y = 1 - 2 * (index + 0.5) / 400, ring = Math.sqrt(1 - y * y), angle = index * 2.39996;
  return [Math.cos(angle) * ring * 1000, y * 1000, Math.sin(angle) * ring * 1000];
});

test('blocks group leaves by direction and publish conservative bounds through the objects contract', () => {
  const blocks = leafBoxBlocks(sphere, [0, 0, 0], 16);
  assert.equal(new Set(blocks).size, 16);
  const points = new Map<string, number[][]>();
  sphere.forEach((centre, index) => points.set(`--step-${blocks[index]}`, [...points.get(`--step-${blocks[index]}`) ?? [], centre]));
  const placements = leafBoxPlacements(points, [0, 0, 0]);
  assert.deepEqual(placements, JSON.parse(readFileSync(new URL('../../../renderer/test/fixtures/leaf-box-placements.json', import.meta.url), 'utf8')),
    'the 16-block output consumed by renderer culling must remain identical');
  for (const [name, corners] of points) {
    const write = placements.writes[name]!;
    for (const corner of corners) {
      assert.ok(Math.hypot(...corner.map((value, axis) => value - write.center[axis]!)) <= write.radius + 1e-9, `${name} bounds its leaves`);
      const angle = Math.acos(corner.reduce((sum, value, axis) => sum + value * write.normal[axis]!, 0) / Math.hypot(...corner));
      assert.ok(angle <= write.spread + 1e-9, `${name} spreads over its leaves`);
    }
  }
  requireTexturePlacements(placements, name => points.has(name));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { requireTexturePlacements, type PreparedTexturePlacements } from '@cssearth/objects';
import { unseenTextureWrites } from './prepared-texture-levels.ts';

test('prepared leaf-box placements count facing leaves as seen before they turn into view', () => {
  const placements: PreparedTexturePlacements = { body: { center: [0,0,0], radius: 1000 }, writes: {
    '--step-front': { center: [0,0,1000], radius: 100, normal: [0,0,1], spread: .1 },
    '--step-back': { center: [0,0,-1000], radius: 100, normal: [0,0,-1], spread: .1 },
  } };
  requireTexturePlacements(placements, name => name.startsWith('--step-'));
  // A camera far along +z sees the blocks facing it and none facing away.
  const projection = { eyeFromScene: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10000, 1], principalOffsetPixels: [0, 0], focalPixels: 1000 };
  const unseen = unseenTextureWrites(placements, projection as never, { width: 1000, height: 1000 });
  for (const [name, write] of Object.entries(placements.writes)) {
    if (write.normal[2]! > 0.6) assert.ok(!unseen.has(name), `${name} faces the camera`);
    if (write.normal[2]! < -0.6) assert.ok(unseen.has(name), `${name} faces away`);
  }
});

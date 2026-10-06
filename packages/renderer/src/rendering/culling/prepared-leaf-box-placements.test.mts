import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { requireTexturePlacements } from '@cssearth/objects';
import { unseenTextureWrites } from '../textures/prepared-texture-levels.ts';

test('prepared leaf-box placements count facing leaves as seen before they turn into view', () => {
  // Frozen bake output; the producer recomputes all 16 placements in leaf-box-contract.test.mts.
  const placements: unknown = JSON.parse(readFileSync(new URL('../../../test/fixtures/leaf-box-placements.json', import.meta.url), 'utf8'));
  requireTexturePlacements(placements, name => name.startsWith('--step-'));
  assert.equal(Object.keys(placements.writes).length, 16);
  // A camera far along +z sees the blocks facing it and none facing away.
  const projection = { eyeFromScene: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10000, 1], principalOffsetPixels: [0, 0], focalPixels: 1000 };
  const unseen = unseenTextureWrites(placements, projection as never, { width: 1000, height: 1000 });
  for (const [name, write] of Object.entries(placements.writes)) {
    if (write.normal[2]! > 0.6) assert.ok(!unseen.has(name), `${name} faces the camera`);
    if (write.normal[2]! < -0.6) assert.ok(unseen.has(name), `${name} faces away`);
  }
});

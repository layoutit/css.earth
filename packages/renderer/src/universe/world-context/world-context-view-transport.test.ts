import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { packWorldBodies, unpackWorldBodies } from './world-context-view-transport.js';
import type { WorldBodyPresentation } from './world-context-planner.js';

test('packed body presentation round-trips exactly, including absent optional flags', () => {
  const bodies: WorldBodyPresentation[] = [
    { hovered: true, orbitHidden: false, labelHidden: true, labelSize: { width: 57, height: 18 }, labelShown: true,
      labelPlacement: 3, indicatorShown: false, indicatorRadius: 8.25, orbitAppearance: { width: 1, opacity: 0.6499999999999999 } },
    { hovered: false, bodyHidden: false, orbitHidden: true, labelHidden: false, labelSuppressed: true, indicatorHidden: false, highlighted: true,
      labelSize: { width: Number.NaN, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: true,
      indicatorRadius: 10, orbitAppearance: { width: 1.5, opacity: 1e-12 } },
  ];
  const packed = packWorldBodies(bodies);
  assert.equal(packed.length, 30);
  assert.deepEqual(unpackWorldBodies(packed), bodies);
  assert.ok(!Object.keys(unpackWorldBodies(packed)[0]!).includes('bodyHidden'));
  assert.ok(!Object.keys(unpackWorldBodies(packed)[0]!).includes('highlighted'));
  bodies[1]!.highlighted = false;
  assert.deepEqual(unpackWorldBodies(packWorldBodies(bodies)), bodies);
  assert.throws(() => unpackWorldBodies(new Float64Array(13)), /malformed/);
});

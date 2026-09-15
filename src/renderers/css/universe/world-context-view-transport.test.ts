import { expect, test } from 'vitest';
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
  expect(packed.length).toBe(30);
  expect(unpackWorldBodies(packed)).toEqual(bodies);
  expect(Object.keys(unpackWorldBodies(packed)[0]!)).not.toContain('bodyHidden');
  expect(Object.keys(unpackWorldBodies(packed)[0]!)).not.toContain('highlighted');
  bodies[1]!.highlighted = false;
  expect(unpackWorldBodies(packWorldBodies(bodies))).toEqual(bodies);
  expect(() => unpackWorldBodies(new Float64Array(13))).toThrow(/malformed/);
});

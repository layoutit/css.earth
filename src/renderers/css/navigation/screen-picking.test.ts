import { expect, test } from 'vitest';
import { hitsScreenShape, screenPicking } from './screen-picking.js';

test('orbit hit corridor widens only painted chords and respects clipped ends and faded segments', () => {
  const shape = { kind: 'segments' as const, halfWidth: 7.5, segments: [[10, 20, 40, 20, 1], [50, 20, 80, 20, .05]] as const };
  expect(hitsScreenShape(shape, 25, 27)).toBe(true);
  expect(hitsScreenShape(shape, 25, 28)).toBe(false);
  expect(hitsScreenShape(shape, 9, 20)).toBe(false);
  expect(hitsScreenShape(shape, 41, 20)).toBe(false);
  expect(hitsScreenShape(shape, 60, 20)).toBe(false);
});

test('published picks preserve direct target priority, depth, disabled state and owner disposal without document reads', () => {
  const host = {} as HTMLElement, owner = {}, otherOwner = {}, registry = screenPicking(host);
  const far = {} as HTMLElement, near = {} as HTMLElement, orbit = {} as HTMLElement;
  const shape = { kind: 'circle' as const, x: 10, y: 10, radius: 8 };
  registry.publish(owner, [{ element: far, rank: 0, shape }, { element: near, rank: 10, shape }]);
  registry.publish(otherOwner, [{ element: orbit, rank: 100, shape: { kind: 'segments', halfWidth: 8, segments: [[0, 10, 30, 10, 1]] } }]);
  expect(registry.pick(10, 10)).toBe(near);
  near.ariaDisabled = 'true'; expect(registry.pick(10, 10)).toBe(far);
  registry.publish(owner, []); expect(registry.pick(10, 10)).toBe(orbit);
  registry.remove(otherOwner); expect(registry.pick(10, 10)).toBeNull();
  expect(screenPicking(host)).toBe(registry);
});

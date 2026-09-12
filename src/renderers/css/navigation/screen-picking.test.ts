import { expect, test, vi } from 'vitest';
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

test('a winning direct target or a missed orbit bound never reads a chord bank', () => {
  const readSegments = vi.fn(() => [[10, 20, 40, 20, 1]] as const);
  const shape = { kind: 'segments' as const, halfWidth: 7.5,
    bounds: { left: 10, top: 20, right: 40, bottom: 20 }, get segments() { return readSegments(); } };
  const registry = screenPicking({} as HTMLElement), direct = {} as HTMLElement, orbit = {} as HTMLElement;
  registry.publish({}, [
    { element: orbit, rank: 100, shape },
    { element: direct, rank: 0, shape: { kind: 'circle', x: 25, y: 20, radius: 8 } },
  ]);
  expect(registry.pick(25, 20)).toBe(direct);
  expect(registry.pick(100, 20)).toBeNull();
  expect(registry.pick(25, 100)).toBeNull();
  expect(readSegments).not.toHaveBeenCalled();
  direct.ariaDisabled = 'true';
  expect(registry.pick(25, 27)).toBe(orbit);
  expect(readSegments).toHaveBeenCalledOnce();
});

test('worker bounds preserve corridor edges, clipped endpoints and faded chord picking', () => {
  const shape = { kind: 'segments' as const, halfWidth: 7.5,
    segments: [[10, 20, 40, 20, 1], [40, 20, 60, 40, .7], [60, 40, 90, 80, .05]] as const };
  const bounded = { ...shape, bounds: { left: 10, top: 20, right: 90, bottom: 80 } };
  for (let x = 0; x <= 100; x += .5) for (let y = 10; y <= 90; y += .5)
    expect(hitsScreenShape(bounded, x, y)).toBe(hitsScreenShape(shape, x, y));
});

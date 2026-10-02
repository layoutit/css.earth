import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { hitsScreenShape, screenPicking } from './screen-picking.js';

test('orbit hit corridor widens only painted chords and respects clipped ends and faded segments', () => {
  const shape = { kind: 'segments' as const, halfWidth: 7.5, segments: [[10, 20, 40, 20, 1], [50, 20, 80, 20, .05]] as const };
  assert.equal(hitsScreenShape(shape, 25, 27), true);
  assert.equal(hitsScreenShape(shape, 25, 28), false);
  assert.equal(hitsScreenShape(shape, 9, 20), false);
  assert.equal(hitsScreenShape(shape, 41, 20), false);
  assert.equal(hitsScreenShape(shape, 60, 20), false);
});

test('published picks preserve direct target priority, depth, disabled state and owner disposal without document reads', () => {
  const host = {} as HTMLElement, owner = {}, otherOwner = {}, registry = screenPicking(host);
  const far = {} as HTMLElement, near = {} as HTMLElement, orbit = {} as HTMLElement;
  const shape = { kind: 'circle' as const, x: 10, y: 10, radius: 8 };
  registry.publish(owner, [{ element: far, rank: 0, shape }, { element: near, rank: 10, shape }]);
  registry.publish(otherOwner, [{ element: orbit, rank: 100, shape: { kind: 'segments', halfWidth: 8, segments: [[0, 10, 30, 10, 1]] } }]);
  assert.equal(registry.pick(10, 10), near);
  near.ariaDisabled = 'true'; assert.equal(registry.pick(10, 10), far);
  registry.publish(owner, []); assert.equal(registry.pick(10, 10), orbit);
  registry.remove(otherOwner); assert.equal(registry.pick(10, 10), null);
  assert.equal(screenPicking(host), registry);
});

test('a winning direct target or a missed orbit bound never reads a chord bank', () => {
  const readSegments = mock.fn(() => [[10, 20, 40, 20, 1]] as const);
  const shape = { kind: 'segments' as const, halfWidth: 7.5,
    bounds: { left: 10, top: 20, right: 40, bottom: 20 }, get segments() { return readSegments(); } };
  const registry = screenPicking({} as HTMLElement), direct = {} as HTMLElement, orbit = {} as HTMLElement;
  registry.publish({}, [
    { element: orbit, rank: 100, shape },
    { element: direct, rank: 0, shape: { kind: 'circle', x: 25, y: 20, radius: 8 } },
  ]);
  assert.equal(registry.pick(25, 20), direct);
  assert.equal(registry.pick(100, 20), null);
  assert.equal(registry.pick(25, 100), null);
  assert.equal(readSegments.mock.callCount(), 0);
  direct.ariaDisabled = 'true';
  assert.equal(registry.pick(25, 27), orbit);
  assert.equal(readSegments.mock.callCount(), 1);
});

test('worker bounds preserve corridor edges, clipped endpoints and faded chord picking', () => {
  const shape = { kind: 'segments' as const, halfWidth: 7.5,
    segments: [[10, 20, 40, 20, 1], [40, 20, 60, 40, .7], [60, 40, 90, 80, .05]] as const };
  const bounded = { ...shape, bounds: { left: 10, top: 20, right: 90, bottom: 80 } };
  for (let x = 0; x <= 100; x += .5) for (let y = 10; y <= 90; y += .5)
    assert.equal(hitsScreenShape(bounded, x, y), hitsScreenShape(shape, x, y));
});

test('a finger reach takes the nearest label or marker only when nothing is under the point, and before any orbit', () => {
  const registry = screenPicking({} as HTMLElement), ring = {} as HTMLElement, label = {} as HTMLElement, orbit = {} as HTMLElement;
  registry.publish({}, [
    { element: ring, rank: 0, shape: { kind: 'circle', x: 0, y: 0, radius: 13 } },
    { element: label, rank: 50, shape: { kind: 'rect', left: 40, top: -9, right: 90, bottom: 9 } },
    { element: orbit, rank: 100, shape: { kind: 'segments', halfWidth: 8, segments: [[-100, 20, 100, 20, 1]] } },
  ]);
  assert.equal(registry.pick(0, 20), orbit);
  assert.equal(registry.pick(0, 20, 16), ring);
  assert.equal(registry.pick(24, 0, 16), ring);
  assert.equal(registry.pick(30, 0, 16), label);
  assert.equal(registry.pick(10, 0, 16), ring);
  assert.equal(registry.pick(0, -29, 16), null);
  ring.ariaDisabled = 'true';
  assert.equal(registry.pick(0, 20, 16), orbit);
});

test('a pick keeps its target, so a see-through selection can leave its members reachable', () => {
  const registry = screenPicking({} as HTMLElement), marker = {} as HTMLElement;
  registry.publish({}, [{ element: marker, rank: 0, shape: { kind: 'circle', x: 0, y: 0, radius: 13 }, unoccluded: true }]);
  assert.equal(registry.pickTarget(0, 0)?.unoccluded, true);
  assert.equal(registry.pick(0, 0), marker);
  assert.equal(registry.pickTarget(40, 0), null);
});

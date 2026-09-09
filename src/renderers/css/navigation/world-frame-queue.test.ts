import { expect, test } from 'vitest';
import { createWorldFrameQueue } from './world-frame-queue.js';
import type { PreparedWorldFrame } from './world-frame-queue.js';
import type { WorldFrameRequest } from './world-frame-presenter.js';

function fixture() {
  const events: string[] = [], pending: { id: number; resolve(frame: PreparedWorldFrame): void; reject(error: Error): void }[] = [];
  const queue = createWorldFrameQueue(request => new Promise((resolve, reject) => {
    const id = request.world.epochJdTt; events.push(`plan:${id}`); pending.push({ id, resolve, reject });
  }));
  const request = (id: number, current = () => true): WorldFrameRequest => ({
    world: { referenceFrame: 'test', epochJdTt: id, pose: { positionM: [0, 0, id], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 800, principalOffsetPixels: [0, 0] }, current,
    commit: () => { events.push(`camera:${id}`); }, fail: () => { events.push(`error:${id}`); },
  });
  const finish = async (current = () => true) => {
    const next = pending.shift()!;
    next.resolve({ current, commit(camera) { camera(); events.push(`drawing:${next.id}`); } });
    await Promise.resolve(); await Promise.resolve();
  };
  return { queue, events, pending, request, finish };
}

test('new input replaces pending work without advancing camera ahead of drawing or starving completion', async () => {
  const f = fixture();
  f.queue.present(f.request(1)); f.queue.present(f.request(2)); f.queue.present(f.request(3));
  expect(f.events).toEqual(['plan:1']); expect(f.queue.stats()).toMatchObject({ inFlight: 1, pending: 1, superseded: 1 });
  await f.finish();
  expect(f.events).toEqual(['plan:1', 'camera:1', 'drawing:1', 'plan:3']);
  await f.finish();
  expect(f.events.slice(-2)).toEqual(['camera:3', 'drawing:3']);
  expect(f.queue.stats()).toMatchObject({ committed: 2, inFlight: 0, pending: 0 });
});

test('resize or owner disposal prevents a delayed frame from touching the presented scene', async () => {
  const f = fixture(); let current = true;
  f.queue.present(f.request(1, () => current));
  current = false; f.queue.present(f.request(2));
  await f.finish(); expect(f.events).toEqual(['plan:1', 'plan:2']);
  f.queue.destroy(); await f.finish();
  expect(f.events).toEqual(['plan:1', 'plan:2']);
});

test('changed annotation state replans the latest requested camera instead of publishing stale picks', async () => {
  const f = fixture(); f.queue.present(f.request(1));
  await f.finish(() => false);
  expect(f.events).toEqual(['plan:1', 'plan:1']);
  await f.finish(); expect(f.events.slice(-2)).toEqual(['camera:1', 'drawing:1']);
});

test('worker failure is delivered to the live owner and does not strand a later request', async () => {
  const f = fixture(); f.queue.present(f.request(1)); f.queue.present(f.request(2));
  f.pending.shift()!.reject(new Error('worker failed'));
  await Promise.resolve(); await Promise.resolve();
  expect(f.events).toEqual(['plan:1', 'error:1', 'plan:2']);
  await f.finish(); expect(f.events.slice(-2)).toEqual(['camera:2', 'drawing:2']);
});

test('idle semantic changes replan the retained initial camera through the worker', async () => {
  const f = fixture();
  expect(f.queue.refresh()).toBe(false);
  f.queue.remember(f.request(1));
  expect(f.events).toEqual([]);
  expect(f.queue.refresh()).toBe(true);
  expect(f.events).toEqual(['plan:1']);
  await f.finish();
  expect(f.events).toEqual(['plan:1', 'camera:1', 'drawing:1']);
  f.queue.refresh();
  await f.finish();
  expect(f.events.slice(-3)).toEqual(['plan:1', 'camera:1', 'drawing:1']);
});

test('semantic refresh preserves newer pending input and coalesces during planning', async () => {
  const f = fixture();
  f.queue.present(f.request(1));
  f.queue.present(f.request(2));
  f.queue.refresh(); f.queue.refresh();
  expect(f.queue.stats()).toMatchObject({ requested: 2, superseded: 0 });
  await f.finish(() => false);
  expect(f.events).toEqual(['plan:1', 'plan:2']);
  f.queue.refresh();
  await f.finish(() => false);
  expect(f.events).toEqual(['plan:1', 'plan:2', 'plan:2']);
  await f.finish();
  expect(f.events.slice(-2)).toEqual(['camera:2', 'drawing:2']);
});

test('a new idle owner can refresh while a disposed owner still has worker work', async () => {
  const f = fixture(); let oldCurrent = true, newCurrent = true;
  f.queue.present(f.request(1, () => oldCurrent));
  oldCurrent = false;
  f.queue.remember(f.request(2, () => newCurrent));
  expect(f.queue.refresh()).toBe(true);
  await f.finish();
  expect(f.events).toEqual(['plan:1', 'plan:2']);
  await f.finish();
  expect(f.events.slice(-2)).toEqual(['camera:2', 'drawing:2']);
  newCurrent = false;
  expect(f.queue.refresh()).toBe(false);
  f.queue.destroy();
  expect(f.queue.refresh()).toBe(false);
});

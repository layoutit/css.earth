import { expect, test } from 'vitest';
import { createWorldFrameQueue } from './world-frame-queue.js';
import type { PreparedWorldFrame } from './world-frame-queue.js';
import type { WorldFrameRequest } from './world-frame-presenter.js';

function fixture() {
  const events: string[] = [], pending: { id: number; resolve(frame: PreparedWorldFrame): void; reject(error: Error): void }[] = [];
  const callbacks = new Map<number, FrameRequestCallback>(); let sequence = 0;
  const paint = () => { for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(0); } };
  const queue = createWorldFrameQueue(request => new Promise((resolve, reject) => {
    const id = request.world.epochJdTt; events.push(`plan:${id}`); pending.push({ id, resolve, reject });
  }), { request: callback => { callbacks.set(++sequence, callback); return sequence; }, cancel: id => { callbacks.delete(id); } });
  const request = (id: number, current = () => true): WorldFrameRequest => ({
    world: { referenceFrame: 'test', epochJdTt: id, pose: { positionM: [0, 0, id], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 800, principalOffsetPixels: [0, 0] }, current,
    commit: () => { events.push(`camera:${id}`); }, fail: () => { events.push(`error:${id}`); },
  });
  const finish = async (current = () => true, present = true) => {
    const next = pending.shift()!;
    next.resolve({ current, commit(camera) { camera(); events.push(`drawing:${next.id}`); } });
    await Promise.resolve(); await Promise.resolve();
    if (present) paint();
  };
  return { queue, events, pending, request, finish, paint, callbacks };
}

test('an awaited flight acknowledges only the complete presented frame and retries semantic invalidation', async () => {
  const f = fixture(), controller = new AbortController(); let shown = false;
  const task = f.queue.presentAndWait(f.request(1), controller.signal).then(value => { shown = value; });
  await f.finish(() => false); expect(shown).toBe(false);
  await f.finish(() => true, false); expect(shown).toBe(false);
  f.paint(); await task;
  expect(shown).toBe(true);
  expect(f.events.slice(-2)).toEqual(['camera:1', 'drawing:1']);
});

test('aborting a flight while its worker result is pending leaves the drawn camera untouched', async () => {
  const f = fixture(), controller = new AbortController();
  const task = f.queue.presentAndWait(f.request(1), controller.signal);
  controller.abort(); expect(await task).toBe(false);
  await f.finish(); expect(f.events).toEqual(['plan:1']);
  f.queue.present(f.request(2)); await f.finish();
  expect(f.events.slice(-2)).toEqual(['camera:2', 'drawing:2']);
});

test('superseding a queued flight and disposing the queue settle their awaiting owners', async () => {
  const f = fixture(), signal = new AbortController().signal;
  f.queue.present(f.request(1));
  const superseded = f.queue.presentAndWait(f.request(2), signal);
  const remaining = f.queue.presentAndWait(f.request(3), signal);
  expect(await superseded).toBe(false);
  f.queue.destroy(); expect(await remaining).toBe(false);
  await f.finish(); expect(f.events).toEqual(['plan:1']);
});

test('an awaited flight rejects a worker failure instead of claiming a painted checkpoint', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const task = f.queue.presentAndWait(f.request(1), signal);
  const result = expect(task).rejects.toThrow('worker failed');
  f.pending.shift()!.reject(new Error('worker failed')); await result;
  expect(f.events).toEqual(['plan:1', 'error:1']);
});

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

test('ready frames wait for paint and newer input coalesces before planning from published state', async () => {
  const f = fixture();
  f.queue.present(f.request(1)); f.queue.present(f.request(2));
  await f.finish(() => true, false); f.queue.present(f.request(3));
  expect(f.events).toEqual(['plan:1']);
  expect(f.callbacks.size).toBe(1);
  f.paint();
  expect(f.events).toEqual(['plan:1', 'camera:1', 'drawing:1', 'plan:3']);
  await f.finish(() => true, false);
  expect(f.events.at(-1)).toBe('plan:3'); f.paint();
  expect(f.events.slice(-2)).toEqual(['camera:3', 'drawing:3']);
  expect(f.queue.stats()).toMatchObject({ committed: 2, superseded: 1, ready: 0 });
});

test('navigation disposal and semantic invalidation are checked again at presentation time', async () => {
  const f = fixture(); let current = true;
  f.queue.present(f.request(1, () => current)); await f.finish(() => true, false);
  current = false; f.paint();
  expect(f.events).toEqual(['plan:1']);
  f.queue.present(f.request(2)); await f.finish(() => true, false);
  f.queue.destroy(); f.paint();
  expect(f.events).toEqual(['plan:1', 'plan:2']); expect(f.callbacks.size).toBe(0);
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

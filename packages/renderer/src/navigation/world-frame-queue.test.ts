import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
  await f.finish(() => false); assert.equal(shown, false);
  await f.finish(() => true, false); assert.equal(shown, false);
  f.paint(); await task;
  assert.equal(shown, true);
  assert.deepEqual(f.events.slice(-2), ['camera:1', 'drawing:1']);
});

test('aborting a flight while its worker result is pending leaves the drawn camera untouched', async () => {
  const f = fixture(), controller = new AbortController();
  const task = f.queue.presentAndWait(f.request(1), controller.signal);
  controller.abort(); assert.equal((await task), false);
  await f.finish(); assert.deepEqual(f.events, ['plan:1']);
  f.queue.present(f.request(2)); await f.finish();
  assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
});

test('superseding a queued flight and disposing the queue settle their awaiting owners', async () => {
  const f = fixture(), signal = new AbortController().signal;
  f.queue.present(f.request(1));
  const superseded = f.queue.presentAndWait(f.request(2), signal);
  const remaining = f.queue.presentAndWait(f.request(3), signal);
  assert.equal((await superseded), false);
  f.queue.destroy(); assert.equal((await remaining), false);
  await f.finish(); assert.deepEqual(f.events, ['plan:1']);
});

test('an awaited flight rejects a worker failure instead of claiming a painted checkpoint', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const task = f.queue.presentAndWait(f.request(1), signal);
  const result = assert.rejects(task, /worker failed/);
  f.pending.shift()!.reject(new Error('worker failed')); await result;
  assert.deepEqual(f.events, ['plan:1', 'error:1']);
});

test('new input replaces pending work without advancing camera ahead of drawing or starving completion', async () => {
  const f = fixture();
  f.queue.present(f.request(1)); f.queue.present(f.request(2)); f.queue.present(f.request(3));
  assert.deepEqual(f.events, ['plan:1']); assert.partialDeepStrictEqual(f.queue.stats(), { inFlight: 1, pending: 1, superseded: 1 });
  await f.finish();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:3']);
  await f.finish();
  assert.deepEqual(f.events.slice(-2), ['camera:3', 'drawing:3']);
  assert.partialDeepStrictEqual(f.queue.stats(), { committed: 2, inFlight: 0, pending: 0 });
});

test('ready frames wait for paint and newer input coalesces before planning from published state', async () => {
  const f = fixture();
  f.queue.present(f.request(1)); f.queue.present(f.request(2));
  await f.finish(() => true, false); f.queue.present(f.request(3));
  assert.deepEqual(f.events, ['plan:1']);
  assert.equal(f.callbacks.size, 1);
  f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:3']);
  await f.finish(() => true, false);
  assert.equal(f.events.at(-1), 'plan:3'); f.paint();
  assert.deepEqual(f.events.slice(-2), ['camera:3', 'drawing:3']);
  assert.partialDeepStrictEqual(f.queue.stats(), { committed: 2, superseded: 1, ready: 0 });
});

test('navigation disposal and semantic invalidation are checked again at presentation time', async () => {
  const f = fixture(); let current = true;
  f.queue.present(f.request(1, () => current)); await f.finish(() => true, false);
  current = false; f.paint();
  assert.deepEqual(f.events, ['plan:1']);
  f.queue.present(f.request(2)); await f.finish(() => true, false);
  f.queue.destroy(); f.paint();
  assert.deepEqual(f.events, ['plan:1', 'plan:2']); assert.equal(f.callbacks.size, 0);
});

test('resize or owner disposal prevents a delayed frame from touching the presented scene', async () => {
  const f = fixture(); let current = true;
  f.queue.present(f.request(1, () => current));
  current = false; f.queue.present(f.request(2));
  await f.finish(); assert.deepEqual(f.events, ['plan:1', 'plan:2']);
  f.queue.destroy(); await f.finish();
  assert.deepEqual(f.events, ['plan:1', 'plan:2']);
});

test('changed annotation state replans the latest requested camera instead of publishing stale picks', async () => {
  const f = fixture(); f.queue.present(f.request(1));
  await f.finish(() => false);
  assert.deepEqual(f.events, ['plan:1', 'plan:1']);
  await f.finish(); assert.deepEqual(f.events.slice(-2), ['camera:1', 'drawing:1']);
});

test('worker failure is delivered to the live owner and does not strand a later request', async () => {
  const f = fixture(); f.queue.present(f.request(1)); f.queue.present(f.request(2));
  f.pending.shift()!.reject(new Error('worker failed'));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(f.events, ['plan:1', 'error:1', 'plan:2']);
  await f.finish(); assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
});

test('idle semantic changes replan the retained initial camera through the worker', async () => {
  const f = fixture();
  assert.equal(f.queue.refresh(), false);
  f.queue.remember(f.request(1));
  assert.deepEqual(f.events, []);
  assert.equal(f.queue.refresh(), true);
  assert.deepEqual(f.events, ['plan:1']);
  await f.finish();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1']);
  f.queue.refresh();
  await f.finish();
  assert.deepEqual(f.events.slice(-3), ['plan:1', 'camera:1', 'drawing:1']);
});

test('semantic refresh preserves newer pending input and coalesces during planning', async () => {
  const f = fixture();
  f.queue.present(f.request(1));
  f.queue.present(f.request(2));
  f.queue.refresh(); f.queue.refresh();
  assert.partialDeepStrictEqual(f.queue.stats(), { requested: 2, superseded: 0 });
  await f.finish(() => false);
  assert.deepEqual(f.events, ['plan:1', 'plan:2']);
  f.queue.refresh();
  await f.finish(() => false);
  assert.deepEqual(f.events, ['plan:1', 'plan:2', 'plan:2']);
  await f.finish();
  assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
});

test('a new idle owner can refresh while a disposed owner still has worker work', async () => {
  const f = fixture(); let oldCurrent = true, newCurrent = true;
  f.queue.present(f.request(1, () => oldCurrent));
  oldCurrent = false;
  f.queue.remember(f.request(2, () => newCurrent));
  assert.equal(f.queue.refresh(), true);
  await f.finish();
  assert.deepEqual(f.events, ['plan:1', 'plan:2']);
  await f.finish();
  assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
  newCurrent = false;
  assert.equal(f.queue.refresh(), false);
  f.queue.destroy();
  assert.equal(f.queue.refresh(), false);
});

test('a warm-up is adopted by the first request for its view and committed without planning it again', async () => {
  const f = fixture();
  assert.equal(f.queue.warm(f.request(1)), true);
  assert.deepEqual(f.events, ['plan:1']);
  await f.finish(() => true, false);
  assert.deepEqual(f.events, ['plan:1'], 'a warm-up draws nothing by itself');
  assert.equal(f.callbacks.size, 0);
  f.queue.remember(f.request(1));
  assert.equal(f.queue.refresh(), true);
  assert.deepEqual(f.events, ['plan:1'], 'the retained camera finds its plan ready');
  assert.equal(f.callbacks.size, 1); f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1']);
  assert.partialDeepStrictEqual(f.queue.stats(), { warmPlanned: 1, warmAdopted: 1, warmDiscarded: 0, committed: 1, requested: 1 });
});

test('a request for another camera discards the warmed frame and plans as it always did', async () => {
  const f = fixture();
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  f.queue.present(f.request(2));
  assert.deepEqual(f.events, ['plan:1', 'plan:2']);
  await f.finish();
  assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
  assert.partialDeepStrictEqual(f.queue.stats(), { warmAdopted: 0, warmDiscarded: 1, warm: 0 });
});

test('a viewport that differs from the warmed one is a different view', async () => {
  const f = fixture();
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  const resized = { ...f.request(1), viewport: { focalPixels: 801, principalOffsetPixels: [0, 0] as const } };
  f.queue.present(resized);
  assert.deepEqual(f.events, ['plan:1', 'plan:1']);
});

test('a change nobody owns yet follows the warmed frame with one more plan; a presentation it no longer matches discards it', async () => {
  const f = fixture();
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  assert.equal(f.queue.refresh(), false, 'no owner to replan for');
  f.queue.remember(f.request(1)); f.queue.refresh();
  assert.deepEqual(f.events, ['plan:1'], 'the warmed frame still commits');
  f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:1'], 'and the changed state is planned after it');
  await f.finish(); assert.deepEqual(f.events.slice(-2), ['camera:1', 'drawing:1']);
  const h = fixture();
  h.queue.warm(h.request(1)); assert.equal(h.queue.refresh(), false, 'a change while the warm-up is still planning');
  await h.finish(() => true, false); h.queue.remember(h.request(1)); h.queue.refresh(); h.paint();
  assert.deepEqual(h.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:1']);
  const g = fixture();
  g.queue.warm(g.request(1)); await g.finish(() => false, false);
  g.queue.remember(g.request(1)); g.queue.refresh();
  assert.deepEqual(g.events, ['plan:1', 'plan:1'], 'a stale snapshot plans again');
  assert.partialDeepStrictEqual(g.queue.stats(), { warmDiscarded: 1 });
});

test('a warm-up still planning holds the planner; a different request waits for it and then plans', async () => {
  const f = fixture();
  f.queue.warm(f.request(1));
  f.queue.present(f.request(2));
  assert.deepEqual(f.events, ['plan:1'], 'one plan in flight at a time');
  await f.finish(() => true, false);
  assert.deepEqual(f.events, ['plan:1', 'plan:2']);
  await f.finish(); assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
  assert.partialDeepStrictEqual(f.queue.stats(), { warmDiscarded: 1, committed: 1 });
});

test('a warm-up refused by a busy queue, a failed warm-up and a destroyed queue leave the normal path intact', async () => {
  const f = fixture();
  f.queue.present(f.request(1));
  assert.equal(f.queue.warm(f.request(1)), false);
  await f.finish(); assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1']);
  assert.equal(f.queue.warm(f.request(2)), true);
  f.pending.shift()!.reject(new Error('worker failed'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:2'], 'a failed warm-up reports nothing');
  f.queue.present(f.request(2));
  assert.deepEqual(f.events.at(-1), 'plan:2'); assert.equal(f.events.length, 5);
  await f.finish(); assert.deepEqual(f.events.slice(-2), ['camera:2', 'drawing:2']);
  const g = fixture();
  g.queue.warm(g.request(1)); g.queue.destroy();
  await g.finish(); assert.deepEqual(g.events, ['plan:1']);
  assert.partialDeepStrictEqual(f.queue.stats(), { warmPlanned: 1, warmDiscarded: 1 });
});

test('an awaited request for the adopted view rides its frame and is acknowledged with it', async () => {
  const f = fixture(), controller = new AbortController(); let shown: boolean | null = null;
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  f.queue.remember(f.request(1)); f.queue.refresh();
  const task = f.queue.presentAndWait(f.request(1), controller.signal).then(value => { shown = value; });
  assert.deepEqual(f.events, ['plan:1'], 'the arrival asks for the view already planned');
  f.paint(); await task;
  assert.equal(shown, true);
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'camera:1', 'drawing:1']);
  assert.partialDeepStrictEqual(f.queue.stats(), { committed: 1, ridden: 1, requested: 2, pending: 0, inFlight: 0 });
});

test('a rider only rides a warmed frame, never an ordinarily planned one', async () => {
  const f = fixture(), signal = new AbortController().signal;
  f.queue.present(f.request(1)); await f.finish(() => true, false);
  const task = f.queue.presentAndWait(f.request(1), signal);
  f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:1']);
  await f.finish(); assert.equal(await task, true);
});

test('a rider aborted before presentation is left out; one whose base request has gone is planned on its own', async () => {
  const f = fixture(), controller = new AbortController();
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  f.queue.remember(f.request(1)); f.queue.refresh();
  const aborted = f.queue.presentAndWait(f.request(1), controller.signal);
  controller.abort(); assert.equal(await aborted, false);
  f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1']);
  const g = fixture(); let baseCurrent = true;
  g.queue.warm(g.request(1)); await g.finish(() => true, false);
  g.queue.remember(g.request(1, () => baseCurrent)); g.queue.refresh();
  const rider = g.queue.presentAndWait(g.request(1), new AbortController().signal);
  baseCurrent = false; g.paint();
  assert.deepEqual(g.events, ['plan:1', 'plan:1'], 'the rider plans for itself');
  await g.finish(); assert.equal(await rider, true);
  assert.deepEqual(g.events.slice(-2), ['camera:1', 'drawing:1']);
});

test('newer input queued behind an adopted frame keeps its order: a later request for that view does not ride', async () => {
  const f = fixture();
  f.queue.warm(f.request(1)); await f.finish(() => true, false);
  f.queue.remember(f.request(1)); f.queue.refresh();
  f.queue.present(f.request(2)); f.queue.present(f.request(1));
  f.paint();
  assert.deepEqual(f.events, ['plan:1', 'camera:1', 'drawing:1', 'plan:1']);
  assert.partialDeepStrictEqual(f.queue.stats(), { ridden: 0, superseded: 1 });
});

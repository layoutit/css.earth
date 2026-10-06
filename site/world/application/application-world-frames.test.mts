import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApplicationWorldFrames } from './application-world-frames.mts';
import type { WorldFrameRequest } from '@cssearth/renderer/navigation/camera/world-frame-presenter.ts';

test('mounting detail cannot replace the public world camera through an asset refresh', async () => {
  const planned: number[] = [], published: number[] = [], callbacks: FrameRequestCallback[] = [];
  const frames = createApplicationWorldFrames({
    layer: {
      opacityClock: { request(callback: FrameRequestCallback) { callbacks.push(callback); return callbacks.length; }, cancel() {} },
      captureFrame(world: WorldFrameRequest['world']) { return { view: world, current: () => true }; },
      publish(world: WorldFrameRequest['world']) { published.push(world.epochJdTt); },
      labelBudget() { return null; },
    },
    planner: { async plan(world: WorldFrameRequest['world']) { planned.push(world.epochJdTt); return {}; } },
    moonLabels: { publish() {} }, lifetime: { disposed: false }, heliosphereEnabled: () => false,
  } as unknown as Parameters<typeof createApplicationWorldFrames>[0]);
  const request = (id: number): WorldFrameRequest => ({
    world: { referenceFrame: 'test', epochJdTt: id, pose: { positionM: [0, 0, id], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 800, principalOffsetPixels: [0, 0] }, current: () => true, commit() {}, fail(error) { throw error; },
  });
  const paint = async () => { await Promise.resolve(); await Promise.resolve(); for (const callback of callbacks.splice(0)) callback(0); };
  try {
    const first = frames.createFramePresenter();
    first.present(request(1));
    assert.equal(frames.refresh(), false, 'decoding assets must not publish an unactivated startup');
    await paint(); assert.deepEqual(planned, []);
    first.present(request(2)); first.enable(); await paint();
    assert.deepEqual(published, [2], 'activation publishes only the latest prepared camera');
    const next = frames.createFramePresenter(); next.present(request(3));
    frames.refresh(); await paint();
    assert.deepEqual(published, [2, 2], 'a mounting replacement leaves the public camera resident');
    next.enable(); await paint(); assert.deepEqual(published, [2, 2, 3]);
    const cancelled = frames.createFramePresenter(); cancelled.present(request(4)); cancelled.destroy(); cancelled.enable();
    frames.refresh(); await paint(); assert.deepEqual(published, [2, 2, 3, 3]);
  } finally { frames.destroy(); }
});

test('a mounting scene can plan its world ahead; enabling then commits that plan at once, and a changed camera plans anew', async () => {
  const planned: number[] = [], published: number[] = [], callbacks: FrameRequestCallback[] = [];
  let revision = 0;
  const frames = createApplicationWorldFrames({
    layer: {
      opacityClock: { request(callback: FrameRequestCallback) { callbacks.push(callback); return callbacks.length; }, cancel() {} },
      captureFrame(world: WorldFrameRequest['world']) { const captured = revision; return { view: world, current: () => captured === revision }; },
      publish(world: WorldFrameRequest['world']) { published.push(world.epochJdTt); },
      labelBudget() { return null; },
    },
    planner: { async plan(world: WorldFrameRequest['world']) { planned.push(world.epochJdTt); return {}; } },
    moonLabels: { publish() {} }, lifetime: { disposed: false }, heliosphereEnabled: () => false,
  } as unknown as Parameters<typeof createApplicationWorldFrames>[0]);
  const request = (id: number): WorldFrameRequest => ({
    world: { referenceFrame: 'test', epochJdTt: id, pose: { positionM: [0, 0, id], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 800, principalOffsetPixels: [0, 0] }, current: () => true, commit() {}, fail(error) { throw error; },
  });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  const paint = async () => { await settle(); for (const callback of callbacks.splice(0)) callback(0); };
  try {
    const warmed = settle;
    const first = frames.createFramePresenter();
    assert.equal(first.warm(), false, 'nothing to plan before the scene has a camera');
    first.present(request(1));
    assert.equal(first.warm(), true);
    await settle(); assert.deepEqual(planned, [1]); assert.deepEqual(published, [], 'a warm-up draws nothing');
    first.enable();
    assert.deepEqual(planned, [1], 'enabling finds the plan ready');
    assert.equal(callbacks.length, 1); await paint();
    assert.deepEqual(published, [1]);
    assert.equal(first.warm(), false, 'an enabled scene plans through the queue');
    // A scene whose camera moved on (an overview page framing itself) plans that camera instead.
    const second = frames.createFramePresenter();
    second.present(request(2)); second.warm(); await warmed();
    second.present(request(3)); second.enable(); await paint();
    assert.deepEqual(planned, [1, 2, 3]); assert.deepEqual(published, [1, 3]);
    // A world whose presentation changed after the warm-up (a selection, a label blocker) plans again.
    const third = frames.createFramePresenter();
    third.present(request(4)); third.warm(); await warmed(); revision++;
    third.enable(); await paint();
    assert.deepEqual(planned, [1, 2, 3, 4, 4]); assert.deepEqual(published, [1, 3, 4]);
    // A scene enabled before its warm-up starts, and a destroyed presenter's, plan nothing ahead.
    const late = frames.createFramePresenter();
    late.present(request(5)); late.warm(); late.enable(); await paint(); await paint();
    assert.deepEqual(planned, [1, 2, 3, 4, 4, 5]); assert.deepEqual(published, [1, 3, 4, 5]);
    const gone = frames.createFramePresenter();
    gone.present(request(6)); gone.warm(); gone.destroy(); await warmed(); gone.enable();
    frames.refresh(); await paint();
    assert.deepEqual(planned, [1, 2, 3, 4, 4, 5, 5]); assert.deepEqual(published, [1, 3, 4, 5, 5]);
  } finally { frames.destroy(); }
});

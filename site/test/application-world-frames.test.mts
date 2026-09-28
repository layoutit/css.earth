import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApplicationWorldFrames } from '../application-world-frames.mts';
import type { WorldFrameRequest } from '@cssearth/renderer/navigation/world-frame-presenter.ts';

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

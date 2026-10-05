import assert from 'node:assert/strict';
import test from 'node:test';
import { afterSceneFrame } from './scene-frame.mts';

function clock() {
  const frames = new Map<number, FrameRequestCallback>(), tasks = new Map<number, () => void>();
  let id = 0;
  const window = {
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(key: number) { frames.delete(key); },
    setTimeout(callback: TimerHandler) { assert.equal(typeof callback, 'function'); tasks.set(++id, () => { if (typeof callback === 'function') callback(); }); return id; },
    clearTimeout(key: number) { tasks.delete(key); },
  };
  return { frames, tasks, window,
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); },
    task() { const pending = [...tasks.values()]; tasks.clear(); pending.forEach(callback => callback()); },
  };
}

test('scene work resumes after the camera rendering turn, never in its frame microtasks', async () => {
  const h = clock(); let resumed = false;
  const work = afterSceneFrame(h.window, new AbortController().signal).then(() => { resumed = true; });
  await Promise.resolve(); assert.equal(resumed, false);
  h.frame(); await Promise.resolve(); assert.equal(resumed, false);
  h.task(); await work; assert.equal(resumed, true);
  assert.equal(h.frames.size + h.tasks.size, 0);
});

for (const phase of ['before-frame', 'after-frame'] as const) {
  test(`cancelling a scene yield ${phase} releases its scheduled work`, async () => {
    const h = clock(), controller = new AbortController();
    const work = afterSceneFrame(h.window, controller.signal);
    if (phase === 'after-frame') h.frame();
    controller.abort(); await work;
    assert.equal(h.frames.size + h.tasks.size, 0);
  });
}

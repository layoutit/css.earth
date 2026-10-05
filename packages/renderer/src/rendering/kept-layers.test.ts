import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepLayers } from './kept-layers.js';

function fixture() {
  const frames: (() => void)[] = [], cancelled: number[] = [], calls: string[] = [];
  const animation = { id: '', pause() { calls.push('pause'); }, cancel() { calls.push('cancel'); } };
  const animated: { keyframes: unknown; options: unknown }[] = [];
  const view = { requestAnimationFrame(callback: FrameRequestCallback) { frames.push(() => { callback(0); }); return frames.length; }, cancelAnimationFrame(id: number) { cancelled.push(id); } };
  const element = { animate(keyframes: unknown, options: unknown) { animated.push({ keyframes, options }); return animation; } } as unknown as HTMLElement;
  return { element, view, frames, cancelled, calls, animation, animated, frame() { frames.shift()!(); } };
}

test('the keeping animation starts on the element, is paused two frames later and is cancelled on release', () => {
  const f = fixture(), release = keepLayers(f.element, f.view);
  assert.equal(f.animated.length, 1);
  assert.deepEqual(f.animated[0]!.keyframes, [{ translate: '0px 0px' }, { translate: '0.01px 0px' }], 'the element keeps its own transform');
  assert.equal(f.animation.id, 'kept-layers');
  f.frame();
  assert.deepEqual(f.calls, [], 'still running after one frame');
  f.frame();
  assert.deepEqual(f.calls, ['pause']);
  assert.equal(f.frames.length, 0, 'it asks for no further frame');
  release();
  assert.deepEqual(f.calls, ['pause', 'cancel']);
  assert.deepEqual(f.cancelled, [], 'no frame was pending');
});

test('released before it paused, it cancels its frame; without animations or frames it does nothing', () => {
  const f = fixture(), release = keepLayers(f.element, f.view);
  release();
  assert.deepEqual(f.cancelled, [1]); assert.deepEqual(f.calls, ['cancel']);
  assert.doesNotThrow(() => keepLayers({} as unknown as HTMLElement, f.view)());
  const still = fixture();
  keepLayers(still.element, null)();
  assert.equal(still.animated.length, 0);
});

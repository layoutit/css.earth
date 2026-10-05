import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZoomCarry } from './zoom-carry.mts';
import type { WorldCameraPose } from '@cssearth/engine';
const world: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [0, 0, 100], orientationXyzw: [0, 0, 0, 1], focusOffset: { originM: [0, 0, 0], offsetM: [0, 0, 100] } } };
const optics = { framingRadiusPixels: 300, focalPixels: 600, principalOffsetPixels: [0, 0] as const, visibleRect: null, detailHandoffDiameterPixels: 14 };
test('carry publishes the departing camera, advances at its log rate and stops its pending frame', () => {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0; const canceled: number[] = [];
  const windowTarget = { performance: { now: () => 10 }, requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++id, callback); return id; }, cancelAnimationFrame(id: number) { canceled.push(id); frames.delete(id); } };
  const draws: WorldCameraPose[] = [], moves: WorldCameraPose[] = []; const controller = new AbortController();
  const carry = createZoomCarry({ windowTarget, signal: controller.signal, presentWorld(camera) { draws.push(camera); }, onMove(camera) { moves.push(camera); } });
  assert.equal(carry.world(), null);
  assert.equal(carry.end(), null);
  carry.begin(world, optics, Math.log(2) / 10);
  assert.equal(draws[0], world);
  assert.equal(carry.world(), world);
  const first = frames.values().next().value!; frames.clear(); first(20);
  assert.equal(moves.length, 1);
  assert.equal(draws.at(-1), moves[0]);
  assert.ok(Math.abs(carry.world()!.pose.positionM[2] - 200) < 1e-10);
  const ending = carry.end()!;
  assert.equal(ending.rate, Math.log(2) / 10);
  assert.equal(ending.world, moves[0]);
  assert.equal(carry.world(), null);
  assert.equal(frames.size, 0);
  assert.ok(canceled.length > 0);
  first(30);
  assert.equal(draws.length, 2);
});
test('zero rate, missing presenter and aborted carries produce no publications', () => {
  const frames: FrameRequestCallback[] = []; const windowTarget = { performance: { now: () => 10 }, requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return 1; }, cancelAnimationFrame() {} };
  const controller = new AbortController(); const draws: unknown[] = [];
  const carry = createZoomCarry({ windowTarget, signal: controller.signal, presentWorld(world) { draws.push(world); } });
  carry.begin(world, optics, 0);
  assert.equal(carry.world(), null);
  createZoomCarry({ windowTarget, signal: controller.signal, presentWorld: null }).begin(world, optics, 1);
  assert.equal(draws.length, 0);
  carry.begin(world, optics, 1); frames.shift()!(10);
  assert.equal(draws.length, 1, 'zero elapsed does not move');
  controller.abort(); frames.shift()!(20);
  assert.equal(draws.length, 1);
  assert.ok(carry.end());
  carry.begin(world, optics, 1);
  assert.equal(carry.world(), null);
});

test('negative rate carries the camera inward and preserves the departing rate', () => {
  const frames: FrameRequestCallback[] = [];
  const windowTarget = {
    performance: { now: () => 10 },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
  };
  const signal = new AbortController().signal;
  const draws: WorldCameraPose[] = [];
  const carry = createZoomCarry({ windowTarget, signal, presentWorld(camera) { draws.push(camera); } });
  const rate = -Math.log(2) / 10;
  carry.begin(world, optics, rate);
  assert.equal(draws[0], world);
  frames.shift()!(20);
  assert.equal(draws[1].pose.positionM[2], 50);
  assert.deepEqual(carry.end(), { world: draws[1], rate });
});

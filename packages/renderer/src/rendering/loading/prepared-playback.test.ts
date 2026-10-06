import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreparedPlayback, releaseAnimation } from "./prepared-playback.js";
type TestAnimation = Omit<import("./prepared-playback.js").PreparedAnimation, "playState"> & { playState: AnimationPlayState; calls: string[];
  effect: AnimationEffect | null; timeline: AnimationTimeline | null };
function animation(time = 12): TestAnimation {
  return { currentTime: time, playbackRate: 1, playState: "running", calls: [], effect: {} as AnimationEffect, timeline: {} as AnimationTimeline,
    play() { this.playState = "running"; this.calls.push("play"); },
    pause() { this.playState = "paused"; this.calls.push("pause"); },
    cancel() { this.playState = "idle"; this.calls.push("cancel"); },
  };
}
test("pre-ready permission, zero speed and late handles all use the router's last permission", () => {
  const owner = createPreparedPlayback(), a = animation();
  owner.setAllowed(true); owner.register(a, { initialTime: 0 });
  assert.equal(a.playState, "paused"); assert.equal(a.currentTime, 0);
  owner.setAllowed(false); owner.setReady(); assert.equal(a.playState, "paused");
  owner.setAllowed(true); assert.equal(a.playState, "running");
  owner.setSelection({ speed: 0 }); assert.equal(a.playState, "paused"); assert.equal(owner.stats().allowed, true);
  const late = animation(); owner.register(late); assert.equal(late.playState, "paused");
  owner.setSelection({ speed: 3 }); assert.equal(late.playbackRate, 3); assert.equal(late.playState, "running");
  owner.setAllowed(false); owner.setSelection({ speed: 4 }); assert.equal(a.playState, "paused");
  owner.destroy();
});
test("prepared role conditions and rates do not create a second permission authority", () => {
  const owner = createPreparedPlayback(), body = animation(), atmosphere = animation();
  owner.register(body); owner.register(atmosphere, { rate: 0.5, enabledWhen: { atmosphere: true, datasetId: ["surface", "topography"] } });
  owner.setSelection({ speed: 2, atmosphere: true, datasetId: "surface" }); owner.setReady(); owner.setAllowed(true);
  assert.equal(atmosphere.playbackRate, 1); assert.equal(atmosphere.playState, "running");
  owner.setSelection({ speed: 2, atmosphere: true, datasetId: "night-lights" });
  assert.equal(body.playState, "running"); assert.equal(atmosphere.playState, "paused");
  owner.setAllowed(false); owner.setSelection({ speed: 1, atmosphere: true, datasetId: "surface" });
  assert.equal(atmosphere.playState, "paused"); owner.destroy();
});
test("camera-addressed native poses retain prepared time and never acquire motion playback", () => {
  const owner = createPreparedPlayback(), pose = animation(234), motion = animation(8);
  owner.register(pose, { mode: "pose" }); owner.register(motion, { initialTime: 0 });
  owner.setReady(); owner.setAllowed(true); owner.setSelection({ speed: 4 });
  assert.equal(pose.currentTime, 234); assert.equal(pose.playState, "paused"); assert.equal(pose.playbackRate, 1);
  owner.seek(pose, 781); assert.equal(pose.currentTime, 781);
  assert.throws(() => owner.seek(motion, 1), /pose/); assert.throws(() => owner.seek(pose, Infinity), /finite/);
  owner.destroy(); owner.seek(pose, 22); assert.equal(pose.currentTime, 781);
});
test("duplicate registration and unchanged permission do not restart native animations", () => {
  const owner = createPreparedPlayback(), a = animation();
  owner.register(a, { initialTime: 0 }); owner.setReady(); owner.setAllowed(true); a.currentTime = 100;
  owner.register(a, { initialTime: 0 }); owner.setAllowed(true); owner.setSelection({ speed: 1 });
  assert.equal(a.currentTime, 100); assert.deepEqual(a.calls, ["pause", "play"]);
  owner.destroy(); owner.destroy(); assert.deepEqual(a.calls, ["pause", "play", "cancel"]);
  assert.deepEqual([a.effect, a.timeline], [null, null], "a destroyed owner's animation names no element and no timeline");
});
test("saved motion restores actual visual times without replacing camera-addressed poses", () => {
  const owner = createPreparedPlayback(), first = animation(1234), second = animation(5678), pose = animation(99);
  owner.register(first); owner.register(pose, { mode: "pose" }); owner.register(second);
  const saved = owner.captureMotion();
  assert.deepEqual(saved, [1234, 5678]);
  owner.resetMotion();
  owner.restoreMotion(saved);
  assert.equal(first.currentTime, 1234); assert.equal(second.currentTime, 5678); assert.equal(pose.currentTime, 99);
  assert.throws(() => owner.restoreMotion([1]), /prepared scene/);
  assert.throws(() => owner.restoreMotion([1, NaN]), /prepared scene/);
  assert.deepEqual(owner.captureMotion(), saved, "invalid links cannot partially seek native animations");
  owner.destroy();
});
test("cleanup and publication failures process every native handle before reporting", () => {
  const owner = createPreparedPlayback(), a = animation(), b = animation();
  owner.register(a); owner.register(b); owner.setReady();
  a.play = () => { throw new Error("play failed"); };
  assert.throws(() => owner.setAllowed(true), AggregateError); assert.equal(b.playState, "running");
  a.cancel = () => { throw new Error("cancel failed"); };
  assert.throws(() => owner.destroy(), AggregateError); assert.equal(b.playState, "idle");
  assert.equal(owner.stats().registeredCount, 0);
  owner.destroy(); const late = animation(); owner.register(late); assert.equal(late.playState, "idle");
});
test("a light curve plays on its own permission, at its own rate, and never holds texture placements off rest", () => {
  const owner = createPreparedPlayback(), spin = animation(0), light = animation(0);
  owner.register(light, { initialTime: 0, lightCurve: true }); owner.register(spin, { initialTime: 0 }); owner.setReady();
  owner.setLightCurves(true);
  assert.equal(light.playState, "running"); assert.equal(spin.playState, "paused"); light.currentTime = 500;
  assert.equal(owner.motionAtRest(), true, "a playing light curve moves no texel");
  owner.setAllowed(true); owner.setSelection({ speed: 3 });
  assert.equal(spin.playState, "running"); assert.equal(spin.playbackRate, 3); assert.equal(light.playbackRate, 1);
  assert.equal(owner.motionAtRest(), false);
  owner.setAllowed(false); assert.equal(light.playState, "running", "pausing rotation leaves the light curve");
  owner.setLightCurves(false); assert.equal(light.playState, "paused");
  assert.throws(() => owner.register(animation(), { lightCurve: "yes" as unknown as boolean }), /prepared role/);
  owner.destroy();
});

test("an ended animation is cancelled with its effect still on it, then loses its effect and its timeline", () => {
  const calls: string[] = [];
  const ended = { effect: {} as AnimationEffect | null, timeline: {} as AnimationTimeline | null,
    cancel() { calls.push(`cancel, effect ${this.effect === null ? "gone" : "present"}`); } };
  releaseAnimation(ended);
  assert.deepEqual(calls, ["cancel, effect present"]);
  assert.equal(ended.effect, null, "it names no element");
  assert.equal(ended.timeline, null, "the document timeline no longer holds it");
  const standIn = { cancelled: 0, cancel() { this.cancelled++; } };
  releaseAnimation(standIn);
  assert.equal(standIn.cancelled, 1); assert.deepEqual(Object.keys(standIn), ["cancelled", "cancel"], "a stand-in is only cancelled");
});

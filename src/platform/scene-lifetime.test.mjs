import assert from "node:assert/strict";
import test from "node:test";
import { createSceneLifetime, waitForScenePaint, waitForSceneDocument } from "./scene-lifetime.mjs";
import * as engine from "@cssearth/engine";
import * as cameraMath from "./camera-math.mjs";
import * as sphereDrag from "./sphere-drag.mjs";
import * as nativeWaits from "../renderers/css/dist/scene-native-waits.js";

test("legacy lifetime and camera paths expose the canonical typed functions", () => {
  assert.equal(createSceneLifetime, engine.createSceneLifetime);
  assert.equal(waitForScenePaint, nativeWaits.waitForScenePaint);
  assert.equal(waitForSceneDocument, nativeWaits.waitForSceneDocument);
  for (const [name, implementation] of Object.entries({ ...cameraMath, ...sphereDrag })) {
    assert.equal(implementation, engine[name], name);
  }
});

function frameQueue() {
  let nextId = 0;
  const frames = new Map(), cancelled = [];
  return {
    frames, cancelled,
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { cancelled.push(id); frames.delete(id); },
    advance() {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback();
    },
  };
}

test("startup paint waits for both frames and document wait removes its listener", async () => {
  const lifetime = createSceneLifetime(), windowTarget = frameQueue();
  let painted = false, loaded = false;
  const listeners = new Set();
  const frame = waitForScenePaint(lifetime, windowTarget).then(() => { painted = true; });
  class LoadingDocument extends EventTarget {
    readyState = "loading";
    addEventListener(type, listener, options) { listeners.add(listener); super.addEventListener(type, listener, options); }
    removeEventListener(type, listener, options) { listeners.delete(listener); super.removeEventListener(type, listener, options); }
  }
  const documentTarget = new LoadingDocument();
  const document = waitForSceneDocument(lifetime, documentTarget).then(() => { loaded = true; });
  assert.equal(listeners.size, 1);
  windowTarget.advance();
  await Promise.resolve();
  assert.equal(painted, false);
  assert.equal(loaded, false);
  assert.equal(windowTarget.frames.size, 1);
  windowTarget.advance();
  documentTarget.dispatchEvent(new Event("DOMContentLoaded"));
  await Promise.all([frame, document]);
  assert.equal(painted, true);
  assert.equal(loaded, true);
  assert.equal(listeners.size, 0);
  assert.equal(windowTarget.frames.size, 0);
  lifetime.destroy();
  assert.equal(listeners.size, 0);
  assert.deepEqual(windowTarget.cancelled, []);
});

test("destruction after the first paint frame cancels the remaining frame", async () => {
  const lifetime = createSceneLifetime(), windowTarget = frameQueue();
  const paint = waitForScenePaint(lifetime, windowTarget);
  windowTarget.advance();
  assert.equal(windowTarget.frames.size, 1);
  const pendingId = windowTarget.frames.keys().next().value;
  lifetime.destroy();
  await paint;
  assert.deepEqual(windowTarget.cancelled, [pendingId]);
  assert.equal(windowTarget.frames.size, 0);
  assert.deepEqual(lifetime.stats(), { disposed: true, ownerCount: 0, waiterCount: 0 });
});

test("startup frame and document waits settle on destruction without native callbacks", async () => {
  const lifetime = createSceneLifetime();
  const frames = new Map();
  const windowTarget = {
    requestAnimationFrame(fn) { frames.set(1, fn); return 1; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const documentTarget = new EventTarget();
  documentTarget.readyState = "loading";
  const frame = waitForScenePaint(lifetime, windowTarget);
  const loaded = waitForSceneDocument(lifetime, documentTarget);
  assert.equal(frames.size, 1);
  lifetime.destroy();
  await Promise.all([frame, loaded]);
  assert.equal(frames.size, 0);
  assert.deepEqual(lifetime.stats(), { disposed: true, ownerCount: 0, waiterCount: 0 });
});

test("lifetime invalidates first and cleans every owner once in reverse order", () => {
  const lifetime = createSceneLifetime();
  const calls = [];
  const error = new Error("cleanup");
  lifetime.onDispose(() => { assert.ok(lifetime.disposed); calls.push(1); });
  lifetime.onDispose(() => { calls.push(2); throw error; });
  lifetime.onDispose(() => calls.push(3));
  assert.deepEqual(lifetime.destroy(), [error]);
  assert.deepEqual(calls, [3, 2, 1]);
  assert.deepEqual(lifetime.destroy(), []);
  assert.deepEqual(lifetime.onDispose(() => { throw error; }), [error]);
  assert.deepEqual(lifetime.stats(), { disposed: true, ownerCount: 0, waiterCount: 0 });
});

test("wait settles cancellation without native work and observes late rejection", async () => {
  const lifetime = createSceneLifetime();
  let reject;
  const native = new Promise((_, fail) => { reject = fail; });
  const ready = lifetime.wait(native);
  lifetime.destroy();
  assert.deepEqual(await ready, { cancelled: true });
  reject(new Error("late image rejection"));
  assert.deepEqual(await lifetime.wait(Promise.reject(new Error("already disposed"))), { cancelled: true });
  await new Promise(setImmediate);
});

test("live wait preserves values/errors and does not retain historical waiters", async () => {
  const lifetime = createSceneLifetime();
  lifetime.onDispose(() => {});
  for (let index = 0; index < 1000; index += 1) {
    assert.deepEqual(await lifetime.wait(Promise.resolve(index)), { cancelled: false, value: index });
    assert.deepEqual(lifetime.stats(), { disposed: false, ownerCount: 1, waiterCount: 0 });
  }
  const error = new Error("live failure");
  await assert.rejects(lifetime.wait(Promise.reject(error)), (actual) => actual === error);
  lifetime.destroy();
});

import assert from "node:assert/strict";
import test from "node:test";
import { createSceneLifetime, waitForScenePaint, waitForSceneDocument } from "./scene-lifetime.mjs";

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

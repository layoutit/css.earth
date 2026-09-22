import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createSceneLifetime } from "@cssearth/engine";
import { waitForScenePaint, waitForSceneDocument } from "../renderers/css/dist/scene-native-waits.js";

function frameQueue() {
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>(), cancelled: number[] = [];
  return {
    frames, cancelled,
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id: number) { cancelled.push(id); frames.delete(id); },
    advance() {
      const next = frames.entries().next().value; assert.ok(next);
      const [id, callback] = next;
      frames.delete(id);
      callback(0);
    },
  };
}

test("startup paint waits for both frames and document wait removes its listener", async () => {
  const lifetime = createSceneLifetime(), windowTarget = frameQueue();
  let painted = false, loaded = false;
  const listeners = new Set<EventListenerOrEventListenerObject | null>();
  const frame = waitForScenePaint(lifetime, windowTarget).then(() => { painted = true; });
  class LoadingDocument extends EventTarget {
    readyState = "loading";
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) { listeners.add(listener); super.addEventListener(type, listener, options); }
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) { listeners.delete(listener); super.removeEventListener(type, listener, options); }
  }
  const documentTarget = new LoadingDocument();
  const document = waitForSceneDocument(lifetime, documentTarget as unknown as Document).then(() => { loaded = true; });
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
  const frames = new Map<number, FrameRequestCallback>();
  const windowTarget = {
    requestAnimationFrame(fn: FrameRequestCallback) { frames.set(1, fn); return 1; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
  };
  const documentTarget = Object.assign(new EventTarget(), {readyState: "loading"});
  const frame = waitForScenePaint(lifetime, windowTarget);
  const loaded = waitForSceneDocument(lifetime, documentTarget as unknown as Document);
  assert.equal(frames.size, 1);
  lifetime.destroy();
  await Promise.all([frame, loaded]);
  assert.equal(frames.size, 0);
  assert.deepEqual(lifetime.stats(), { disposed: true, ownerCount: 0, waiterCount: 0 });
});

test("lifetime invalidates first and cleans every owner once in reverse order", () => {
  const lifetime = createSceneLifetime();
  const calls: number[] = [];
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
  let reject!: (error: Error) => void;
  const native = new Promise((_, fail) => { reject = fail; });
  const ready = lifetime.wait(native);
  lifetime.destroy();
  assert.deepEqual(await ready, { cancelled: true });
  reject(new Error("late image rejection"));
  assert.deepEqual(await lifetime.wait(Promise.reject(new Error("already disposed"))), { cancelled: true });
  await new Promise<void>(resolve => setImmediate(resolve));
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

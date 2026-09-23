import { unusedMountOptions } from './navigation-test-values.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createSceneView } from '../scene/scene-view.mts';
import { createSceneSessions } from '../scene/scene-session.mts';
import { createNavigationLifecycle } from '../navigation/navigation-lifecycle.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { formatSharedView, parseSharedView } from "../../src/renderers/css/dist/navigation.js";

import type { ObjectSharedView } from '../../src/renderers/css/runtime/object-scene.ts';
import type { SharedView } from '../../src/renderers/css/navigation/view-url.ts';
import { required } from './navigation-test-values.mts';
interface FakeHistoryWindow extends EventTarget {
  location: URL;
  history: { state: { existing: boolean }; replaceState(state: unknown, title: string, next: string | URL): void };
  setTimeout(callback: () => void, delay?: number): number;
  clearTimeout(id: number): void;
  performance: { now(): number };
}
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
const saved = () => ({ camera: { distanceKilometers: 12345,
  pose: { schema: "cssearth-camera-pose@2" as const, scene: matrix } },
  preparedEpochJdTt: 2461286.5, playback: { times: [1234.5], speed: 1, motionRequested: false } });

function fixture(href = "http://localhost:4210/mercury?keep=value#details", captured: () => SharedView = saved) {
  // The URL owner only observes these event/history/timer seams.
  const windowTarget = new EventTarget() as FakeHistoryWindow;
  const timers = new Map<number, { callback(): void; delay?: number }>(), writes: (string | URL)[] = [],
    errors: string[] = [], restored: SharedView[] = [];
  let sequence = 0, motion = false, time = 0;
  const listeners = new Set<() => void>();
  windowTarget.location = new URL(href);
  const historyState = { existing: true };
  windowTarget.history = { state: historyState, replaceState(state, title, next) {
    assert.equal(state, historyState); writes.push(next); windowTarget.location = new URL(next, windowTarget.location);
  } };
  windowTarget.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  windowTarget.clearTimeout = id => timers.delete(id);
  // Fired timers advance the fake clock by their delay.
  windowTarget.performance = { now: () => time };
  const view: ObjectSharedView = { capture: requested => ({ ...captured(), playback: { ...captured().playback, motionRequested: requested ?? false } }),
    async restore(value) { restored.push(value); listeners.forEach(listener => listener()); return true; },
    subscribe(next) { listeners.add(next); return () => { listeners.delete(next); }; } };
  const onError = (error: unknown) => errors.push(error instanceof Error ? error.message : String(error));
  const scenes = createSceneSessions();
  const session = scenes.start({ objectId: 'mercury', url: href, onFailure: (_session, error) => onError(error), onCleanupError: onError });
  const activation = session.activate(() => ({ ready: Promise.resolve(), sharedView: view,
    pause() {}, resume() {}, destroy() {},
  }), {} as HTMLElement, unusedMountOptions);
  const sceneView = createSceneView({ windowTarget: windowTarget as unknown as BrowserWindow, scenes,
    requests: createNavigationLifecycle({ onCancel() {}, onError }),
    getHistory: () => null, getWorld: () => null, getMotion: () => motion, setMotion: value => { motion = value; }, onError,
  });
  const owner = {
    async restore() { await activation; session.url = windowTarget.location.href; await sceneView.arrive(session); session.commit(); },
    destroy() { session.dispose(undefined, { flush: false }); },
  };
  return { owner, windowTarget, timers, writes, errors, restored,
    changed: () => listeners.forEach(listener => listener()), motion: () => motion,
    tick() { const [id, entry] = required(timers.entries().next().value); timers.delete(id); time += entry.delay ?? 0; entry.callback(); } };
}

test("camera changes coalesce into replaceState while preserving the route, other queries, hash and history state", async () => {
  const h = fixture(); await h.owner.restore();
  assert.equal(h.writes.length, 0);
  h.changed(); h.changed(); h.changed();
  assert.equal(h.timers.size, 1); h.tick();
  assert.equal(h.writes.length, 1);
  const url = h.windowTarget.location;
  assert.equal(url.pathname, "/mercury"); assert.equal(url.searchParams.get("keep"), "value"); assert.equal(url.hash, "#details");
  assert.deepEqual(parseSharedView(`v=${url.searchParams.get("v")}`), saved());
  h.changed(); h.tick(); assert.equal(h.writes.length, 1, "identical state does not create history writes");
  h.owner.destroy();
});

test("incoming links restore before motion resumes without rewriting their saved playback position", async () => {
  const value = saved(); value.playback.motionRequested = true;
  const h = fixture(`http://localhost:4210/mercury?${formatSharedView(value)}`);
  await h.owner.restore();
  assert.deepEqual(h.restored, [value]); assert.equal(h.motion(), true); assert.equal(h.writes.length, 0);
  assert.equal([...h.timers.values()][0].delay, 1000);
  h.owner.destroy(); assert.equal(h.timers.size, 0);
});
test("obsolete JSON links report an error without restoring or rewriting the current scene", async () => {
  const token = Buffer.from(JSON.stringify({ v: 1, c: [], p: [] })).toString("base64url");
  const h = fixture(`http://localhost:4210/mercury?v=${token}`);
  await h.owner.restore();
  assert.equal(h.errors.length, 1);
  assert.deepEqual(h.restored, []);
  assert.deepEqual(h.writes, []);
  h.owner.destroy();
});

test("invalid links leave the current scene usable and are replaced only after a camera change", async () => {
  for (const query of ["v=invalid!", "v=abc&v=def"]) {
    const h = fixture(`http://localhost:4210/mercury?${query}`); await h.owner.restore();
    assert.equal(h.errors.length, 1); assert.equal(h.restored.length, 0); assert.equal(h.writes.length, 0);
    h.changed(); h.tick(); assert.equal(h.writes.length, 1);
    assert.equal(h.windowTarget.location.searchParams.getAll("v").length, 1);
    h.owner.destroy();
  }
});

test("application arrivals restore the stored camera and disposal removes scheduled work", async () => {
  const h = fixture(); await h.owner.restore();
  h.windowTarget.location = new URL(`http://localhost:4210/mercury?${formatSharedView(saved())}`);
  await h.owner.restore();
  assert.deepEqual(h.restored, [saved()]);
  h.changed(); assert.equal(h.timers.size, 1); h.owner.destroy();
  h.windowTarget.dispatchEvent(new Event("popstate")); h.changed();
  assert.equal(h.restored.length, 1); assert.equal(h.timers.size, 0);
});

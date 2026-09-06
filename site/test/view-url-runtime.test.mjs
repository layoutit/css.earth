import assert from "node:assert/strict";
import test from "node:test";
import { bindViewUrl } from "../view-url-runtime.mjs";
import { formatSharedView, parseSharedView } from "../../src/platform/view-url.mjs";

const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
const saved = () => ({ camera: { controlPitch: 37, controlYaw: 92, zoom: 0.8, distanceKilometers: 12345,
  pose: { schema: "cssearth-camera-pose@1", scene: matrix, skybox: matrix, sunView: matrix } },
  preparedEpochJdTt: 2461286.5, playback: { times: [1234.5], speed: 1, motionRequested: false } });

function fixture(href = "http://localhost:4210/mercury?keep=value#details", captured = saved) {
  const windowTarget = new EventTarget(), timers = new Map(), writes = [], errors = [], restored = [];
  let sequence = 0, motion = false, listener = null;
  windowTarget.location = new URL(href);
  const historyState = { existing: true };
  windowTarget.history = { state: historyState, replaceState(state, title, next) {
    assert.equal(state, historyState); writes.push(next); windowTarget.location = new URL(next, windowTarget.location);
  } };
  windowTarget.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  windowTarget.clearTimeout = id => timers.delete(id);
  const view = { capture: requested => ({ ...captured(), playback: { ...captured().playback, motionRequested: requested } }),
    async restore(value) { restored.push(value); listener?.(); return true; },
    subscribe(next) { listener = next; return () => { listener = null; }; } };
  const owner = bindViewUrl({ windowTarget, view, getMotion: () => motion, setMotion: value => { motion = value; },
    onError: error => errors.push(error.message) });
  return { owner, windowTarget, timers, writes, errors, restored,
    changed: () => listener?.(), motion: () => motion,
    tick() { const [id, entry] = timers.entries().next().value; timers.delete(id); entry.callback(); } };
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
test("existing JSON links shrink on restore while preserving their exact saved time and route", async () => {
  const value = saved(), { camera: c, playback: p } = value;
  const payload = { v: 1, c: [c.controlPitch, c.controlYaw, c.zoom, c.distanceKilometers,
    c.pose.scene, c.pose.skybox, c.pose.sunView], p: [p.times, p.speed, p.motionRequested], e: value.preparedEpochJdTt };
  const legacy = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const h = fixture(`http://localhost:4210/mercury?keep=value&v=${legacy}#details`);
  await h.owner.restore();
  assert.deepEqual(h.restored, [value]);
  assert.equal(h.writes.length, 1);
  const url = h.windowTarget.location;
  assert.equal(url.pathname, "/mercury"); assert.equal(url.searchParams.get("keep"), "value"); assert.equal(url.hash, "#details");
  assert.ok(url.searchParams.get("v").length < legacy.length);
  assert.deepEqual(parseSharedView(`v=${url.searchParams.get("v")}`), value);
  h.owner.destroy();
});

test("old physical camera links migrate to one pose without resampling saved motion time", async () => {
  const value = saved(); value.playback.motionRequested = true;
  const camera = { distanceKilometers: value.camera.distanceKilometers,
    pose: { schema: "cssearth-camera-pose@2", scene: value.camera.pose.scene } };
  const h = fixture(`http://localhost:4210/mercury?${formatSharedView(value)}`, () => ({
    ...value, camera, playback: { ...value.playback, times: [9876] },
  }));
  await h.owner.restore();
  assert.equal(h.errors.length, 0);
  assert.equal(h.writes.length, 1);
  assert.equal(h.windowTarget.location.searchParams.get("v").length, 70);
  assert.deepEqual(parseSharedView(h.windowTarget.location.search), { ...value, camera });
  assert.equal(h.motion(), true);
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

test("popstate restores the stored camera and disposal removes history listeners and scheduled work", async () => {
  const h = fixture(); await h.owner.restore();
  h.windowTarget.location = new URL(`http://localhost:4210/mercury?${formatSharedView(saved())}`);
  h.windowTarget.dispatchEvent(new Event("popstate")); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.restored, [saved()]);
  h.changed(); assert.equal(h.timers.size, 1); h.owner.destroy();
  h.windowTarget.dispatchEvent(new Event("popstate")); h.changed();
  assert.equal(h.restored.length, 1); assert.equal(h.timers.size, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createSceneRouter } from "../scene-router.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(setImmediate);
class CountedEvents extends EventTarget {
  listeners = new Map();
  addEventListener(type, fn, options) {
    super.addEventListener(type, fn, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn, options) {
    super.removeEventListener(type, fn, options);
    this.listeners.get(type)?.delete(fn);
  }
  count(type) { return this.listeners.get(type)?.size ?? 0; }
}
function harness(makeMount = () => ({})) {
  const documentTarget = new CountedEvents();
  documentTarget.hidden = false;
  documentTarget.documentElement = { dataset: {} };
  const classes = new Set();
  documentTarget.body = { classList: {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
  } };
  const media = new CountedEvents();
  media.matches = false;
  const windowTarget = new CountedEvents();
  windowTarget.matchMedia = () => media;
  const shells = [], mounts = [], errors = [];
  const router = createSceneRouter({
    stage: {}, objectId: "test", documentTarget, windowTarget,
    reportError: (error) => errors.push(error),
    mountShell(options) {
      const shell = { ...options, destroyed: 0,
        destroy() { this.destroyed += 1; }, setPlaybackState(value) { this.playback = value; } };
      shells.push(shell);
      return shell;
    },
    loadObject: async () => (stage, context) => {
      const mount = { ready: Promise.resolve(), calls: [],
        pause() { this.calls.push("pause"); }, resume() { this.calls.push("resume"); },
        destroy() { this.calls.push("destroy"); }, ...makeMount(context, mounts.length),
        report: context.onError };
      mounts.push(mount);
      return mount;
    },
  });
  return { router, documentTarget, windowTarget, media, shells, mounts, errors };
}
function show(h) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  h.windowTarget.dispatchEvent(event);
}

test("loading remembers latest intent but cannot resume; media events never rewrite intent", async () => {
  const gate = deferred();
  const h = harness(() => ({ ready: gate.promise }));
  await flush();
  h.shells[0].onMotionChange(true);
  assert.deepEqual(h.mounts[0].calls, ["pause"]);
  h.media.matches = true;
  h.media.dispatchEvent(new Event("change"));
  gate.resolve();
  await h.router.settled;
  assert.deepEqual(h.router.playback(), { motionRequested: true, allowed: false, reason: "reduced-motion" });
  h.media.matches = false;
  h.media.dispatchEvent(new Event("change"));
  h.media.dispatchEvent(new Event("change"));
  assert.deepEqual(h.mounts[0].calls, ["pause", "resume"]);
  assert.equal(h.documentTarget.documentElement.dataset.playing, "true");
  h.shells[0].onMotionChange(false);
  h.media.matches = true;
  h.media.dispatchEvent(new Event("change"));
  h.media.matches = false;
  h.media.dispatchEvent(new Event("change"));
  assert.deepEqual(h.mounts[0].calls, ["pause", "resume", "pause"]);
  h.router.destroy();
});

test("repeated restoration has bounded subscriptions; old callbacks cannot affect the replacement", async () => {
  const oldReady = deferred();
  const h = harness((_, index) => index === 0 ? { ready: oldReady.promise } : {});
  await flush();
  h.shells[0].onMotionChange(true);
  h.windowTarget.dispatchEvent(new Event("pagehide"));
  await h.router.settled;
  assert.equal(h.media.count("change"), 0);
  assert.equal(h.documentTarget.count("visibilitychange"), 0);
  assert.equal(h.windowTarget.count("pageshow"), 1);
  show(h); show(h);
  await h.router.settled;
  h.shells[0].onMotionChange(false);
  h.mounts[0].report(new Error("stale fatal"));
  oldReady.reject(new Error("late ready failure"));
  await flush();
  assert.equal(h.router.state().lifecycle, "mounted");
  assert.deepEqual(h.errors, []);
  for (let i = 0; i < 5; i += 1) {
    h.windowTarget.dispatchEvent(new Event("pagehide"));
    h.windowTarget.dispatchEvent(new Event("pagehide"));
    show(h); show(h);
    await h.router.settled;
    assert.equal(h.media.count("change"), 1);
    assert.equal(h.documentTarget.count("visibilitychange"), 1);
  }
  h.router.destroy();
  assert.equal(h.windowTarget.count("pageshow"), 0);
  assert.equal(h.windowTarget.count("pagehide"), 0);
  assert.ok(h.mounts.every(({ calls }) => calls.filter((call) => call === "destroy").length === 1));
});

test("malformed mounts retain cleanup handles and failure cleanup survives a destructor error", async () => {
  let disposed = 0;
  const h = harness(() => ({ ready: null, destroy() { disposed += 1; throw new Error("dispose failure"); } }));
  await h.router.settled;
  assert.equal(disposed, 1);
  assert.equal(h.shells[0].destroyed, 1);
  assert.equal(h.router.state().lifecycle, "error");
  assert.match(h.router.state().error, /must provide/);
  assert.equal(h.errors.length, 2);
  assert.equal(h.media.count("change"), 0);
  assert.equal(h.documentTarget.documentElement.dataset.playing, undefined);
  h.router.destroy();
});

test("malformed mounts still observe their rejected readiness promise", async () => {
  const h = harness(() => ({ resume: null, ready: Promise.reject(new Error("orphaned readiness")) }));
  await h.router.settled;
  await flush();
  assert.equal(h.router.state().lifecycle, "error");
  assert.equal(h.mounts[0].calls.filter((call) => call === "destroy").length, 1);
  assert.equal(h.errors.length, 1);
  h.router.destroy();
});

for (const failure of ["pause", "resume", "report"]) test(`fatal ${failure} failure cleans once and never publishes success`, async () => {
  const h = harness(() => failure === "pause"
    ? { pause() { throw new Error("pause failed"); } }
    : failure === "resume" ? { resume() { throw new Error("resume failed"); } } : {});
  await h.router.settled;
  if (failure === "resume") h.shells[0].onMotionChange(true);
  if (failure === "report") h.mounts[0].report(new Error("commit failed"));
  h.mounts[0].report(new Error("duplicate fatal"));
  assert.equal(h.router.state().lifecycle, "error");
  assert.equal(h.router.state().mountedObjectCount, 0);
  assert.equal(h.documentTarget.documentElement.dataset.playing, undefined);
  assert.equal(h.mounts[0].calls.filter((call) => call === "destroy").length, 1);
  assert.equal(h.errors.length, 1);
  h.router.destroy();
});

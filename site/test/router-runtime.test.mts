import assert from "node:assert/strict";
import test from "node:test";
import { createSceneRouter, type RouterOptions } from "../scene-router.mts";

import type { ShellOptions } from '../planet-shell-client.mts';
import type { MountOptions, BrowserWindow } from '../browser-types.mts';
import type { ObjectSceneLifecycle } from '../../src/renderers/css/runtime/deferred-object-mount.ts';
import { required, unusedSharedView } from './navigation-test-values.mts';
type Playback = ReturnType<ReturnType<typeof createSceneRouter>['playback']>;
type MockShell = ShellOptions & { onMotionChange(value: boolean): void; destroyed: number; playback?: Playback; destroy(): void; setPlaybackState(value: Playback): void };
type MockMount = { ready: Promise<void> | null; calls: string[]; sharedView: ObjectSceneLifecycle['sharedView'];
  pause(): void; resume: (() => void) | null; destroy(): void; report(error: unknown): void; requestMotion?: (value: boolean) => void };
function deferred() {
  let complete: (() => void) | undefined, fail: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<void>((yes, no) => { complete = yes; fail = no; });
  return { promise, resolve() { required(complete)(); }, reject(error: unknown) { required(fail)(error); } };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
class CountedEvents extends EventTarget {
  listeners = new Map<string, Set<EventListenerOrEventListenerObject | null>>();
  override addEventListener(...[type, fn, options]: Parameters<EventTarget["addEventListener"]>) {
    super.addEventListener(type, fn, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    required(this.listeners.get(type)).add(fn);
  }
  override removeEventListener(...[type, fn, options]: Parameters<EventTarget["removeEventListener"]>) {
    super.removeEventListener(type, fn, options);
    this.listeners.get(type)?.delete(fn);
  }
  count(type: string) { return this.listeners.get(type)?.size ?? 0; }
}
function harness(makeMount: (context: MountOptions, index: number) => Partial<MockMount> = () => ({})) {
  const documentTarget = Object.assign(new CountedEvents(), { hidden: false, documentElement: { dataset: {} as Record<string, string> }, body: { classList: { add(..._items: string[]) {}, remove(..._items: string[]) {} } } });
  documentTarget.hidden = false;
  documentTarget.documentElement = { dataset: {} };
  const classes = new Set<string>();
  documentTarget.body = { classList: {
    add: (...items: string[]) => items.forEach((item) => classes.add(item)),
    remove: (...items: string[]) => items.forEach((item) => classes.delete(item)),
  } };
  const media = Object.assign(new CountedEvents(), { matches: false });
  media.matches = false;
  const windowTarget = Object.assign(new CountedEvents(), { matchMedia: () => media });
  windowTarget.matchMedia = () => media;
  const shells: MockShell[] = [], mounts: MockMount[] = [], errors: unknown[] = [];
  const router = createSceneRouter({
    stage: {} as HTMLElement, objectId: "test", documentTarget: documentTarget as unknown as Document, windowTarget: windowTarget as unknown as BrowserWindow,
    reportError: (error) => errors.push(error),
    mountShell: ((options: ShellOptions) => {
      const shell: MockShell = { ...options, onMotionChange: required(options.onMotionChange), destroyed: 0,
        destroy() { this.destroyed += 1; }, setPlaybackState(value) { this.playback = value; } };
      shells.push(shell);
      return shell;
    }) as unknown as NonNullable<RouterOptions["mountShell"]>,
    loadObject: async () => (stage, context) => {
      const mount: MockMount = { ready: Promise.resolve(), sharedView: unusedSharedView, calls: [],
        pause() { this.calls.push("pause"); }, resume() { this.calls.push("resume"); },
        destroy() { this.calls.push("destroy"); }, ...makeMount(context, mounts.length),
        report: context.onError };
      mounts.push(mount);
      // The malformed-lifecycle cases intentionally cross the same runtime validation boundary.
      return mount as unknown as ObjectSceneLifecycle;
    },
  });
  return { router, documentTarget, windowTarget, media, shells, mounts, errors };
}
function show(h: ReturnType<typeof harness>) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  h.windowTarget.dispatchEvent(event);
}

test("loading remembers latest intent but cannot resume; media events never rewrite intent", async () => {
  const gate = deferred();
  const h = harness(() => ({ ready: gate.promise }));
  await flush();
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, "false");
  h.shells[0].onMotionChange(true);
  assert.deepEqual(h.mounts[0].calls, ["pause"]);
  h.media.matches = true;
  h.media.dispatchEvent(new Event("change"));
  gate.resolve();
  await h.router.settled;
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, "true");
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
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, "false");
});

test("playback reads cannot consume a pending media notification", async () => {
  const h = harness();
  await h.router.settled;
  h.media.matches = true;
  h.media.dispatchEvent(new Event("change"));
  h.shells[0].onMotionChange(true);
  let reads = 0;
  Object.defineProperty(h.media, "matches", { configurable: true, get() { reads += 1; return false; } });
  // The native value has changed, but its notification has not arrived yet.
  // Diagnostic reads must preserve the same policy the scene has applied.
  for (let i = 0; i < 5; i += 1) {
    assert.equal(h.router.playback().allowed, false);
    assert.equal(h.router.state().lifecycle, "paused");
  }
  assert.equal(reads, 0);
  h.media.dispatchEvent(new Event("change"));
  assert.equal(h.router.playback().allowed, true);
  assert.equal(h.router.state().lifecycle, "mounted");
  assert.equal(reads, 1);
  h.windowTarget.dispatchEvent(new Event("pagehide"));
  Object.defineProperty(h.media, "matches", { configurable: true, value: true });
  show(h);
  await h.router.settled;
  assert.equal(h.router.playback().reason, "reduced-motion");
  assert.equal(h.router.state().lifecycle, "paused");
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
  assert.match(required(h.router.state().error), /must provide/);
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

test("an object destination can pause shared motion, and a retired object cannot change intent", async () => {
  const h = harness(context => ({ requestMotion: context.onMotionRequest }));
  await h.router.settled;
  h.shells[0].onMotionChange(true);
  required(h.mounts[0].requestMotion)(false);
  assert.equal(h.router.playback().motionRequested, false);
  assert.equal(required(h.shells[0].playback).motionRequested, false);
  assert.deepEqual(h.mounts[0].calls, ["pause", "resume", "pause"]);
  const retired = h.mounts[0];
  h.windowTarget.dispatchEvent(new Event("pagehide"));
  show(h); await h.router.settled;
  required(retired.requestMotion)(true);
  assert.equal(h.router.playback().motionRequested, false);
  assert.deepEqual(h.mounts[1].calls, ["pause"]);
  h.router.destroy();
});

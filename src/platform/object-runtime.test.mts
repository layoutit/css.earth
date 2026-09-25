import { orbitFixture } from './test/orbit-fixture.mts';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createObjectRuntime, parsePreparedObjectRuntime, preparedObjectCapabilities } from "../renderers/css/dist/index.js";
import type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeCapabilities } from "../renderers/css/runtime/object-runtime-types.js";
import type { PreparedImage } from "../renderers/css/rendering/prepared-image-store.js";
import type { RuntimePolicy } from "../renderers/css/navigation/runtime-policy.js";
import type { OrbitPublication } from "../renderers/css/navigation/object-orbit.js";
import { requireObjectRuntimeDefinition } from "../../tools/contract/object-runtime-contract.mts";
import { createPreparedResidency } from '../renderers/css/dist/testing.js';
import { createPreparedPlayback } from '../renderers/css/dist/testing.js';
import { createSceneLifetime } from "@cssearth/engine";
import { createObjectSelectionRuntime } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture, fixtureObjectCapabilities, objectView } from "./test/object-runtime-package.mts";
const moonDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition("moon"));
const earthDefinition = parsePreparedObjectRuntime(await loadObjectTestDefinition("earth"));
// This mount harness records lifecycle calls; no page requests are made here.
const flush = async () => { for (let index = 0; index < 32; index++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
function publicationForTest(): OrbitPublication {
  return { ...objectView(moonDefinition), sunViewDirection: null, skySunViewDirection: null };
}
type RuntimeServices = NonNullable<Parameters<typeof createObjectRuntime>[1]>;
type RuntimeFactory = typeof createObjectRuntime;
type Runtime = ReturnType<ReturnType<RuntimeFactory>>;
type ResourceOptions = Parameters<NonNullable<RuntimeServices["createResources"]>>[0];
type OrbitOptions = Parameters<NonNullable<RuntimeServices["createOrbit"]>>[0];
type Selection = ReturnType<NonNullable<RuntimeServices["createSelection"]>>;
type Residency = ReturnType<NonNullable<RuntimeServices["createResources"]>>;
type Lifetime = ReturnType<NonNullable<RuntimeServices["createLifetime"]>>;
type Playback = ReturnType<NonNullable<RuntimeServices["createPlayback"]>>;
type Orbit = ReturnType<NonNullable<RuntimeServices["createOrbit"]>>;
interface HarnessOptions { initialWorldCamera?: ObjectMountOptions["initialWorldCamera"]; definition?: ObjectRuntimeDefinition; failAtElement?: number | null; stageId?: string | null; runtimeFactory?: RuntimeFactory; diagnostics?: boolean; }
interface DecodeJob { resolve(): void; reject(error: unknown): void; image: ControlledImage; done: boolean; }
class ControlledImage implements PreparedImage {
  src = ""; naturalWidth = 1; naturalHeight = 1; decoding: "async" = "async";
  private readonly definition: ObjectRuntimeDefinition;
  private readonly jobs: DecodeJob[];
  constructor(definition: ObjectRuntimeDefinition, jobs: DecodeJob[]) { this.definition = definition; this.jobs = jobs; }
  decode(): Promise<void> {
    this.naturalWidth = (this.definition.assets.entries.find(entry => entry.url === this.src)?.decodedBytes ?? 4) / 4;
    return new Promise((resolve, reject) => this.jobs.push({ resolve, reject, image: this, done: false }));
  }
  removeAttribute(name: string): void { if (name === "src") this.src = ""; }
}
class CSSAnimation implements Pick<Animation, "play" | "pause" | "cancel" | "currentTime" | "playbackRate" | "playState" | "effect"> {
  currentTime: number | null = 99; playbackRate = 1; playState: AnimationPlayState = "running"; cancels = 0;
  effect: AnimationEffect | null = null;
  play(): void { this.playState = "running"; } pause(): void { this.playState = "paused"; }
  cancel(): void { this.playState = "idle"; this.cancels++; }
}
const runtimePolicy: RuntimePolicy = {
  MOBILE_VIEWPORT_QUERY: "(max-width: 1px)", SKYBOX_DRAG_ENABLED: true, FLIGHT_WHEEL_SPEEDUP: 6, WHEEL_ZOOM_SPEED_MULTIPLIER: 1,
  WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER: 1, WHEEL_ZOOM_PINCH: { wheelDeltaPerFingerLogStep: 400, fullPinchFingerRatio: 5, nearRemainingPerFullPinch: .6, farZoomPerFullPinch: 50 }, WHEEL_ZOOM_INERTIA: null, WHEEL_ZOOM_INERTIA_INPUT_KINDS: [],
  sceneCursor: () => "", isOrbitDragStart: () => true, wheelZoomInputKind: () => "wheel",
  bindResponsiveOrbitPolicy: () => ({ mobile: false, destroy() {} }),
};
function harness(options: HarnessOptions = {}, overrides: Partial<RuntimeServices> = {}) {
  const definition = options.definition ?? moonDefinition, failAtElement = options.failAtElement ?? null;
  const stageId = options.stageId === undefined ? definition.id : options.stageId;
  const runtimeFactory = options.runtimeFactory ?? createObjectRuntime, diagnostics = options.diagnostics ?? false;
  const f = retainedPresentationFixture(definition, { failAtElement });
  // The package fixture is the controlled native DOM boundary used by this test.
  const stage = f.stage as unknown as HTMLElement;
  const errors: unknown[] = [], jobs: DecodeJob[] = [], events: string[] = [], flights: unknown[][] = [], native = new CSSAnimation(), created: HTMLElement[] = [];
  f.document.readyState = "complete";
  f.document.querySelector = () => f.stage;
  if (stageId === null) Reflect.deleteProperty(f.stage.dataset, "objectId"); else f.stage.dataset.objectId = stageId;
  f.stage.getAnimations = () => { throw new Error("Mount must not discover live animations"); };
  const createElement = f.document.createElement;
  f.document.createElement = (tag: string) => {
    const node = createElement(tag), remove = node.remove;
    node.remove = () => { if (/polycss-camera/.test(node.className)) events.push("remove:camera"); return remove.call(node); };
    const animate = node.animate;
    node.animate = (keyframes, animationOptions) => {
      if (animationOptions.iterations === Infinity && !native.effect) {
        native.effect = { updateTiming() {} } as AnimationEffect; return native as unknown as Animation;
      }
      return animate.call(node, keyframes, animationOptions);
    };
    created.push(node as unknown as HTMLElement); return node;
  };
  let lifetime: Lifetime | null = null, playback: Playback | null = null, resources: Residency | null = null, resourceOptions: ResourceOptions | null = null, orbitArguments: OrbitOptions | null = null, coordinator: Selection | null = null;
  const publication: OrbitPublication = { ...objectView(definition), sunViewDirection: [1, 0, 0] };
  let runtime: Runtime;
  try {
    const mount = runtimeFactory(definition, {
      createLifetime() { lifetime = createSceneLifetime(); return lifetime; },
      createPlayback() { playback = createPreparedPlayback(); return playback; },
      createControls() { return { publish(state) { if (state?.committed) events.push("controls"); }, setReady() { events.push("ready"); }, stats() { return { ready: true, destroyed: false, actions: 0, listenerCount: 0, lensIds: [], settings: [], state: null }; }, destroy() {} }; },
      createSelection(options) { coordinator = createObjectSelectionRuntime(options); return coordinator; },
      createResources(resourceConfiguration) {
        resourceOptions = resourceConfiguration;
        resources = createPreparedResidency({ ...resourceConfiguration, createImage() { return new ControlledImage(definition, jobs); } });
        return resources;
      },
      createOrbit(orbitConfiguration) {
        orbitArguments = orbitConfiguration; orbitConfiguration.onPublish?.(publication);
        const state = (): ReturnType<Orbit["state"]> => ({ ...publication,
          distance: 12345000, distanceKilometers: 12345, distanceRadii: 12345000, focal: 1000, principalOffset: [0,0], visibleRect: null, offAxisDegrees: null, silhouetteRadius: null,
          levelOfDetail: { stage: 'geometry', silhouetteDiameter: 400, billboardOpacity: 0, markerOpacity: 0, proxyOpacity: 0 }, pitch: publication.controlPitch, pose: { schema: "cssearth-camera-pose@2" as const, scene: matrix } });
        return { publicationState: () => ({ requestedRevision: 0, presentedRevision: 0, presentedWorld: null }), mobilePageFlow: () => false, initialResponsiveZoom: () => definition.camera.defaultZoom, currentResponsiveZoom: () => definition.camera.defaultZoom, setZoomOutCentering() {}, preparedFocus: () => null, setPreparedFocus() { throw new Error("Focus changes are outside this mount fixture."); }, async flyToPreparedFocus() { throw new Error("Focus flights are outside this mount fixture."); }, captureWorldCamera() { throw new Error("unused"); }, applyWorldCamera() {}, rebaseScene() {}, flyToState: async (...args: Parameters<Orbit["flyToState"]>) => { flights.push(args); return { completed: true }; }, invalidate: () => orbitConfiguration.onPublish?.(publication), refresh: () => orbitConfiguration.onPublish?.(publication), setState: (value: Parameters<Orbit["setState"]>[0]) => { events.push("camera:reset"); Object.assign(publication, value); return state(); }, state, sharedState: () => ({ distanceKilometers: 12345, pose: { schema: "cssearth-camera-pose@2", scene: matrix } }), skyState: () => ({ sunViewDirection: null, sunVisible: false, sunClassification: "absent" }), stats: (): never => { throw new Error("Orbit stats are outside this mount harness."); }, destroy() { events.push("remove:orbit"); } } satisfies Orbit;
      },
      waitDocument: () => Promise.resolve(), waitPaint: () => Promise.resolve(), ...overrides,
    });
    const { worldContext, viewport, framePresenter, cameraMotion } = orbitFixture(null).arguments;
    runtime = mount(stage, { worldContext, viewport, framePresenter, cameraMotion, diagnostics, initialWorldCamera: options.initialWorldCamera, inputSurface: stage, runtimePolicy,
      capabilities: fixtureObjectCapabilities,
      onError: error => errors.push(error) });
  } catch (error) { f.restore(); throw error; }
  async function resolveJobs() {
    for (let wave = 0; wave < 40; wave++) {
      await flush(); const pending = jobs.filter(job => !job.done);
      if (!pending.length) return;
      for (const job of pending) { job.done = true; job.resolve(); }
    }
    throw new Error("Real prepared startup did not settle.");
  }
  async function complete() { await resolveJobs(); await runtime.ready; }
  function required<T>(value: T | null, name: string): T { assert.ok(value, `${name} was created`); return value; }
  function restore() { try { runtime.destroy(); } finally { f.restore(); } }
  return { ...f, runtime, errors, jobs, events, flights, native, created, complete, resolveJobs, restore,
    lifetime: () => required(lifetime, "lifetime"), playback: () => required(playback, "playback"), selection: () => required(coordinator, "selection"),
    resources: () => required(resources, "resources"), resourceOptions: () => required(resourceOptions, "resource options"), orbitArguments: () => required(orbitArguments, "orbit options") };
}

test("one mount owns the actual prepared tree, startup, celestial layers, readiness and playback", async t => {
  const h = harness(); t.after(h.restore); h.runtime.resume(); h.runtime.pause(); await h.complete();
  assert.equal(h.native.playState, "paused"); assert.equal(h.native.currentTime, 0);
  assert.equal(h.events.at(-1), "ready");
  assert.equal(h.created.filter(node => !node.closest(".prepared-surface-features")).length, moonDefinition.tree.nodes.length);
  assert.equal(h.selection().stats().commits, 1);
  assert.equal(h.selection().stats().framePublications > 0, true);
  assert.deepEqual(h.orbitArguments().cameraPlan, moonDefinition.camera);
  h.runtime.resume(); assert.equal(h.native.playState, "running");
  h.runtime.destroy(); assert.equal(h.native.cancels, 1); assert.equal(h.stage.children.length, 0);
  assert.deepEqual(h.events.slice(-4).filter(value => value.startsWith("remove:")), ["remove:orbit", "remove:camera"]);
  assert.deepEqual(h.errors, []);
});
for (const suppliedCamera of [false, true]) test(`initial lens publication respects camera ownership: supplied=${suppliedCamera}`, async t => {
  const h = harness({ definition: earthDefinition, initialWorldCamera: suppliedCamera ? objectView(earthDefinition).worldCamera : undefined }); t.after(h.restore);
  await h.complete();
  assert.equal(h.events.includes("camera:reset"), !suppliedCamera, "Only default startup may frame its lens");
  assert.deepEqual(h.flights, []);
  assert.equal(h.selection().stats().commits, 1);
});
test("production mount restores camera and native playback through its shared view contract", async t => {
  const h = harness(); t.after(h.restore); await h.complete();
  h.native.currentTime = 2345;
  const saved = h.runtime.sharedView.capture(false);
  assert.ok(saved);
  assert.equal(saved.camera.pose.scene, matrix);
  assert.equal(saved.playback.times.includes(2345), true);
  assert.equal(saved.preparedEpochJdTt, 1);
  h.native.currentTime = 0;
  await h.runtime.sharedView.restore(saved);
  assert.equal(h.native.currentTime, 2345);
  await assert.rejects(h.runtime.sharedView.restore({ ...saved, preparedEpochJdTt: 2461286.5 }), /astronomical date/);
  await assert.rejects(h.runtime.sharedView.restore({ ...saved, playback: { ...saved.playback, times: [] } }), /prepared scene/);
  assert.equal(h.native.currentTime, 2345);
});
test("destroy settles never-ending real startup and native rejection stays retired", async t => {
  const h = harness(); t.after(h.restore); await flush(); assert.ok(h.jobs.length > 0);
  h.runtime.destroy(); await h.runtime.ready;
  for (const job of h.jobs) job.reject(new Error("late decode")); await flush();
  assert.deepEqual(h.events, ["remove:camera", "remove:orbit", "remove:camera"]); assert.deepEqual(h.errors, []);
  assert.equal(h.resources().stats().images.entries.length, 0);
});
test("pre-document destroy starts no native resources or presentation", async t => {
  const h = harness({}, { waitDocument: () => new Promise(() => {}) }); t.after(h.restore);
  h.runtime.resume(); h.runtime.destroy(); await h.runtime.ready;
  assert.equal(h.jobs.length, 0); assert.equal(h.created.length, 0);
});
test("startup decode failure rejects readiness and releases every sibling owner", async t => {
  const h = harness(); t.after(h.restore); await flush();
  const failure = assert.rejects(h.runtime.ready, /decode/); h.jobs[0].reject(new Error("network")); await failure;
  assert.equal(h.resources().stats().images.entries.length, 0);
  assert.ok(h.jobs.every(job => job.image.src === "")); assert.deepEqual(h.errors, []);
});
test("partial actual tree construction registers root cleanup before failure", async t => {
  const h = harness({ failAtElement: 40 }); t.after(h.restore);
  const failure = assert.rejects(h.runtime.ready, /native element failure/); await h.resolveJobs(); await failure;
  assert.ok(h.events.includes("remove:camera")); assert.equal(h.stage.children.length, 0);
  assert.equal(h.resources().stats().images.entries.length, 0);
});
for (const name of ["createPresentation", "resolvePresentation", "reduceSelection"]) test(`preparation rejects a package's executable ${name}`, () => {
  let invoked = false;
  assert.throws(() => requireObjectRuntimeDefinition({ ...moonDefinition, [name]() { invoked = true; return Promise.resolve(); } }), /acyclic JSON|unsupported/);
  assert.equal(invoked, false);
});
test("late native animation registration inherits permission and retires after disposal", async t => {
  const h = harness(); t.after(h.restore); h.runtime.resume(); await h.complete();
  const late = new CSSAnimation(); h.playback().register(late); assert.equal(late.playState, "running");
  h.runtime.pause(); assert.equal(late.playState, "paused"); h.runtime.destroy(); assert.equal(late.playState, "idle");
  const retired = new CSSAnimation(); h.playback().register(retired); assert.equal(retired.cancels, 1);
});
test("fatal camera publication reports once and cleanup errors do not strand other owners", async t => {
  const h = harness(); t.after(h.restore); await h.complete();
  h.lifetime().onDispose(() => { throw new Error("first cleanup"); }); h.lifetime().onDispose(() => { throw new Error("second cleanup"); });
  h.orbitArguments().onError(new Error("native camera failure"));
  assert.equal(h.errors.length, 1); assert.ok(h.errors[0] instanceof AggregateError); assert.equal(h.errors[0].errors.length, 3);
  assert.equal(h.stage.children.length, 0); assert.equal(h.native.cancels, 1);
  h.orbitArguments().onError(new Error("late")); h.orbitArguments().onPublish?.(publicationForTest()); assert.equal(h.errors.length, 1);
});
test("stage identity cannot mount a different existing object's prepared plan", () => {
  assert.throws(() => harness({}, { createResources() { throw new Error("test boundary"); } }), /test boundary/);
  assert.throws(() => harness({ stageId: "pluto" }), /identity/); assert.throws(() => harness({ stageId: null }), /identity/);
});
test("detached native roots cannot satisfy mounted stage readiness", async t => {
  const h = harness(); t.after(h.restore);
  const attach = h.stage.appendChild.bind(h.stage);
  Reflect.set(h.stage, "appendChild", (node: typeof h.stage) => { attach(node); node.remove(); return node; });
  const failure = assert.rejects(h.runtime.ready, /belong to the mounted stage|retained object stage/); await h.resolveJobs(); await failure;
  assert.equal(h.resources().stats().images.entries.length, 0); assert.deepEqual(h.errors, []);
});
test("resource readiness contains a native shared material failure and retires the whole mount", async t => {
  const h = harness(); t.after(h.restore); await h.complete();
  const binding = moonDefinition.viewBindings.find(binding => binding.kind === "silhouette-fit");
  assert.ok(binding); const target = h.created[binding.target];
  Object.defineProperty(target.style, "visibility", { configurable: true, set() { throw new Error("native material write failed"); } });
  assert.doesNotThrow(() => h.resourceOptions().onReady?.(moonDefinition.assets.startup[0]!));
  assert.equal(h.errors.length, 1); assert.ok(h.errors[0] instanceof Error); assert.match(h.errors[0].message, /native material write failed/);
  assert.equal(h.resources().stats().images.entries.length, 0); assert.equal(h.native.cancels, 1);
  const frames = h.selection().stats().framePublications;
  h.resourceOptions().onReady?.(moonDefinition.assets.startup[0]!); h.orbitArguments().onPublish?.(publicationForTest());
  assert.equal(h.selection().stats().framePublications, frames); assert.equal(h.errors.length, 1);
});
test("optional warm decode failure is recoverable while native cleanup failure is fatal", async t => {
  const warnings: unknown[] = []; t.mock.method(console, "error", (error: unknown) => warnings.push(error));
  const h = harness(); t.after(h.restore); await h.complete();
  h.resourceOptions().onWarmError?.(new Error("optional decode")); assert.equal(warnings.length, 1); assert.equal(h.errors.length, 0);
  h.runtime.resume(); assert.equal(h.native.playState, "running");
  h.resourceOptions().onCleanupError?.(new Error("native release failed")); assert.equal(h.errors.length, 1);
  assert.equal(h.native.cancels, 1); assert.equal(h.resources().stats().images.entries.length, 0);
  h.resourceOptions().onWarmError?.(new Error("late warm")); h.resourceOptions().onCleanupError?.(new Error("late cleanup"));
  assert.equal(warnings.length, 1); assert.equal(h.errors.length, 1);
});
test('mount rejects an uncompiled motion document instead of discovering live CSS animations', () => {
  const { motion, ...uncompiled } = moonDefinition;
  assert.throws(() => createObjectRuntime(uncompiled), /motion bindings must be prepared/);
});

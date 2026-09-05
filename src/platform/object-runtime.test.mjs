import { bodyLayerFixture } from "./test/body-layer-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createObjectRuntime } from "./object-runtime.mjs";
import { createPreparedResidency } from "./prepared-residency.mjs";
import { objectControls } from "../planets/moon/site/control-content.mjs";
import { PREPARED_MOON_SCENE } from "../planets/moon/runtime/preparedScene.mjs";
import { PREPARED_MOON_STARFIELD } from "../planets/moon/runtime/preparedStarfield.mjs";
import { OBJECT_RUNTIME_SCHEMA, initialObjectSelection, reduceObjectSelection } from "./object-runtime-contract.mjs";
const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
class CSSAnimation {
  constructor() { this.currentTime = 99; this.playbackRate = 1; this.playState = "running"; this.cancels = 0; }
  play() { this.playState = "running"; }
  pause() { this.playState = "paused"; }
  cancel() { this.playState = "idle"; this.cancels++; }
}
function harness(overrides = {}, services = {}, stageId = "moon") {
  const errors = [], jobs = [], events = [], native = new CSSAnimation();
  const document = { readyState: "complete", defaultView: {}, querySelector: () => stage };
  const element = name => ({ name, nodeType: 1, style: {}, remove() { events.push(`remove:${name}`); } });
  const stage = Object.assign(bodyLayerFixture().stage, { ownerDocument: document, dataset: { objectId: stageId }, getAnimations: () => [native] });
  let context, resources, resourceOptions, orbitArguments;
  const definition = { schema: OBJECT_RUNTIME_SCHEMA, id: "moon", controls: objectControls,
    camera: PREPARED_MOON_SCENE.camera, sky: PREPARED_MOON_STARFIELD,
    assets: { entries: [{ key: "surface", url: PREPARED_MOON_SCENE.body.assets.surface.two, pool: "surface" }],
      pools: [{ id: "surface", capacity: 2, concurrency: 2, reuse: false, retention: "mount" }], startup: ["surface"] },
    initialSelection: initialObjectSelection(objectControls), reduceSelection: reduceObjectSelection,
    resolvePresentation: () => ({ required: ["surface"] }),
    createPresentation(_stage, owned) {
      context = owned; const { cameraElement, sceneElement, bodyLayers } = bodyLayerFixture(_stage);
      const remove = cameraElement.remove.bind(cameraElement); cameraElement.remove = () => { events.push("remove:camera"); remove(); };
      owned.own(() => cameraElement.remove());
      return { cameraElement, sceneElement, bodyLayers, commitSelection() { events.push("commit"); }, publishFrame() { events.push("frame"); } };
    }, ...overrides,
  };
  const mount = createObjectRuntime(definition, {
    createControls() { return { publish() {}, setReady() {}, destroy() {} }; },
    createResources(options) {
      resourceOptions = options;
      resources = createPreparedResidency({ ...options, createImage() { return { naturalWidth: 1, naturalHeight: 1,
        decode: () => new Promise((resolve, reject) => jobs.push({ resolve, reject })) }; } });
      return resources;
    },
    mountSky() { events.push("sky"); return { destroy() { events.push("remove:sky"); } }; },
    mountSun() { events.push("sun"); return { destroy() { events.push("remove:sun"); } }; },
    createOrbit(options) {
      orbitArguments = options;
      const publication = { controlPitch: 0, controlYaw: 0, zoom: 1 };
      options.onPublish(publication);
      return { invalidate: () => options.onPublish(publication), destroy() { events.push("remove:orbit"); } };
    },
    waitDocument: () => Promise.resolve(), waitPaint: () => Promise.resolve(), ...services,
  });
  const runtime = mount(stage, { onError: error => errors.push(error) });
  async function complete() { await flush(); jobs.forEach(job => job.resolve()); await runtime.ready; }
  return { runtime, errors, jobs, events, native, complete, stage,
    context: () => context, resources: () => resources, resourceOptions: () => resourceOptions, orbitArguments: () => orbitArguments };
}

test("one mount owns startup, sky, camera, initial publication, readiness and latest playback permission", async () => {
  const h = harness();
  h.runtime.resume(); h.runtime.pause();
  await h.complete();
  assert.equal(h.native.playState, "paused"); assert.equal(h.native.currentTime, 0);
  assert.deepEqual(h.events.slice(0, 3), ["sky", "commit", "frame"]);
  assert.equal(h.context().density, 2);
  assert.deepEqual(h.orbitArguments().cameraPlan, PREPARED_MOON_SCENE.camera);
  assert.equal(h.orbitArguments().skyPlan, PREPARED_MOON_STARFIELD);
  h.runtime.resume(); assert.equal(h.native.playState, "running");
  h.runtime.destroy(); assert.equal(h.native.cancels, 1);
  assert.deepEqual(h.events.slice(-3), ["remove:orbit", "remove:sky", "remove:camera"]);
  assert.deepEqual(h.errors, []);
});
test("destroy settles never-ending startup and native rejection cannot reach a retired error owner", async () => {
  const h = harness(); await flush(); assert.equal(h.jobs.length, 1);
  h.runtime.destroy(); await h.runtime.ready;
  h.jobs[0].reject(new Error("late decode")); await flush();
  assert.deepEqual(h.events, []); assert.deepEqual(h.errors, []);
  assert.equal(h.resources().stats().images.entries.length, 0);
  h.runtime.destroy();
});
test("pre-document destroy starts no native resource or presentation work", async () => {
  const h = harness({}, { waitDocument: () => new Promise(() => {}) });
  h.runtime.resume(); h.runtime.destroy(); await h.runtime.ready;
  assert.equal(h.jobs.length, 0); assert.equal(h.events.length, 0);
});
test("a startup decode failure rejects ready and releases all owners without reporting duplicate router errors", async () => {
  const h = harness(); await flush();
  h.jobs[0].reject(new Error("network"));
  await assert.rejects(h.runtime.ready, /decode/);
  assert.equal(h.resources().stats().images.entries.length, 0);
  assert.deepEqual(h.errors, []);
});
test("partial presentation construction registers cleanup before any failure", async () => {
  let removed = false;
  const h = harness({ createPresentation(stage, context) {
    context.own(() => { removed = true; });
    throw new Error("construction");
  } });
  await flush(); h.jobs[0].resolve();
  await assert.rejects(h.runtime.ready, /construction/);
  assert.equal(removed, true); assert.equal(h.resources().stats().images.entries.length, 0);
});
for (const name of ["commitSelection", "publishFrame"]) test(`hidden asynchronous ${name} is fatal and has no ready tail`, async () => {
  let removed = false;
  const h = harness({ createPresentation(stage, context) {
    context.own(() => { removed = true; });
    const { cameraElement, sceneElement, bodyLayers } = bodyLayerFixture(stage);
    return { cameraElement, sceneElement, bodyLayers, commitSelection() {}, publishFrame() {},
      [name]() { return Promise.reject(new Error("late hook")); } };
  } });
  await flush(); h.jobs[0].resolve();
  await assert.rejects(h.runtime.ready, /thenable/); await flush();
  assert.equal(removed, true); assert.equal(h.native.playState, "idle"); assert.deepEqual(h.errors, []);
});
test("late animation registration inherits running permission and retires immediately after disposal", async () => {
  const h = harness(); h.runtime.resume(); await h.complete();
  const late = new CSSAnimation(); h.context().registerAnimation(late);
  assert.equal(late.playState, "running");
  h.runtime.pause(); assert.equal(late.playState, "paused");
  h.runtime.destroy(); assert.equal(late.playState, "idle");
  const retired = new CSSAnimation(); h.context().registerAnimation(retired); assert.equal(retired.cancels, 1);
});
test("fatal post-ready camera publication reports once, aggregates cleanup and isolates its late callbacks", async () => {
  const h = harness(); await h.complete();
  h.context().own(() => { throw new Error("first cleanup"); });
  h.context().own(() => { throw new Error("second cleanup"); });
  h.orbitArguments().onError(new Error("native camera failure"));
  assert.equal(h.errors.length, 1); assert.ok(h.errors[0] instanceof AggregateError);
  assert.equal(h.errors[0].errors.length, 3);
  assert.ok(h.events.includes("remove:camera")); assert.equal(h.native.cancels, 1);
  h.orbitArguments().onError(new Error("late")); h.orbitArguments().onPublish({ zoom: 2 });
  assert.equal(h.errors.length, 1);
  h.runtime.destroy();
});
test("stage identity and input validation cannot mount an undeclared object", () => {
  assert.throws(() => harness({}, { createResources() { throw new Error("test boundary"); } }), /test boundary/);
  assert.throws(() => harness({ id: "pluto" }), /identity/);
  assert.throws(() => harness({}, {}, null), /identity/);
});

test("an unrelated retained scene cannot satisfy readiness for the mounted stage", async () => {
  const h = harness({ createPresentation() {
    const { cameraElement, sceneElement, bodyLayers } = bodyLayerFixture();
    return { cameraElement, sceneElement, bodyLayers, commitSelection() {}, publishFrame() {} };
  } });
  await flush(); h.jobs[0].resolve();
  await assert.rejects(h.runtime.ready, /belong to the mounted stage/);
  assert.equal(h.resources().stats().images.entries.length, 0); assert.deepEqual(h.errors, []);
});

test('resource readiness invalidation contains a real presentation failure and retires all owners', async () => {
  let fail = false, frames = 0;
  const h = harness({ createPresentation(stage, context) {
    const { cameraElement, sceneElement, bodyLayers } = bodyLayerFixture(stage);
    context.own(() => cameraElement.remove());
    return { cameraElement, sceneElement, bodyLayers, commitSelection() {},
      publishFrame() { frames++; if (fail) throw new Error('native material write failed'); } };
  } });
  await h.complete(); fail = true;
  assert.doesNotThrow(() => h.resourceOptions().onReady());
  assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /native material write failed/);
  assert.equal(h.resources().stats().images.entries.length, 0); assert.equal(h.native.cancels, 1);
  const retiredFrames = frames;
  h.resourceOptions().onReady(); h.orbitArguments().onPublish({ zoom: 3 });
  assert.equal(frames, retiredFrames); assert.equal(h.errors.length, 1);
  h.runtime.destroy();
});

test('optional warm decode failure is recoverable but native cleanup failure is fatal', async t => {
  const warnings = []; t.mock.method(console, 'error', error => warnings.push(error));
  const h = harness(); await h.complete();
  h.resourceOptions().onWarmError(new Error('optional decode'));
  assert.equal(warnings.length, 1); assert.equal(h.errors.length, 0);
  h.runtime.resume(); assert.equal(h.native.playState, 'running');
  h.resourceOptions().onCleanupError(new Error('native release failed'));
  assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /native release failed/);
  assert.equal(h.native.cancels, 1); assert.equal(h.resources().stats().images.entries.length, 0);
  h.resourceOptions().onWarmError(new Error('late warm'));
  h.resourceOptions().onCleanupError(new Error('late cleanup'));
  assert.equal(warnings.length, 1); assert.equal(h.errors.length, 1); h.runtime.destroy();
});


test("prepared page layers join shared publication, playback and cleanup", async () => {
  const events = [];
  const h = harness({ createPresentation(stage, context) {
    const { cameraElement, sceneElement, body, bodyLayers } = bodyLayerFixture(stage);
    context.own(() => cameraElement.remove());
    return { cameraElement, sceneElement, bodyLayers, commitSelection() {}, publishFrame() {},
      pageLayers: [{ id: "map", plan: {}, carrier: body, system: body,
        className: "map-page", textureClassName: "map-texture", lensIds: ["normal"] }] };
  } }, { mountPages({ own }) {
    own(() => events.push("destroy"));
    return { publish: () => events.push("frame"), setLens: lens => events.push(lens.id),
      setPlaying: value => events.push(value), stats: () => ({}) };
  } });
  await h.complete();
  assert.ok(events.includes("frame"));
  h.runtime.resume(); assert.equal(events.at(-1), true);
  h.runtime.pause(); assert.equal(events.at(-1), false);
  h.runtime.destroy(); assert.equal(events.at(-1), "destroy");
  h.runtime.resume(); assert.equal(events.at(-1), "destroy");
  assert.deepEqual(h.errors, []);
});

test("partial prepared page construction retires the entire mount", async () => {
  let cleaned = false;
  const h = harness({ createPresentation(stage, context) {
    const { cameraElement, sceneElement, body, bodyLayers } = bodyLayerFixture(stage);
    context.own(() => cameraElement.remove());
    return { cameraElement, sceneElement, bodyLayers, commitSelection() {}, publishFrame() {},
      pageLayers: [{ id: "map", plan: {}, carrier: body, system: body,
        className: "map-page", textureClassName: "map-texture", lensIds: ["normal"] }] };
  } }, { mountPages({ own }) { own(() => { cleaned = true; }); throw new Error("page construction"); } });
  await flush(); h.jobs[0].resolve();
  await assert.rejects(h.runtime.ready, /page construction/);
  assert.equal(cleaned, true); assert.equal(h.resources().stats().images.entries.length, 0);
});

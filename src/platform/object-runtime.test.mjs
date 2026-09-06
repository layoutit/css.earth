import { loadObjectTestDefinition } from '../../tools/object-test-data.mjs';
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { createObjectRuntime, preparedObjectCapabilities } from "../renderers/css/dist/index.js";
import { requireObjectRuntimeDefinition } from "../../tools/object-runtime-contract.mjs";
import { createPreparedResidency } from '../renderers/css/dist/testing.js';
import { createPreparedPlayback } from '../renderers/css/dist/testing.js';
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { createObjectSelectionRuntime } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";
const moonDefinition = await loadObjectTestDefinition('moon');
const earthDefinition = await loadObjectTestDefinition('earth');
const flush = async () => { for (let index = 0; index < 32; index++) await Promise.resolve(); };
const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
class CSSAnimation {
  constructor() { this.currentTime = 99; this.playbackRate = 1; this.playState = "running"; this.cancels = 0; }
  play() { this.playState = "running"; } pause() { this.playState = "paused"; }
  cancel() { this.playState = "idle"; this.cancels++; }
}
function harness({ definition = moonDefinition, failAtElement = null, stageId = definition.id, runtimeFactory = createObjectRuntime } = {}, services = {}) {
  const f = retainedPresentationFixture(definition, { failAtElement });
  const errors = [], jobs = [], events = [], flights = [], native = new CSSAnimation(), created = [];
  f.document.readyState = "complete"; f.document.defaultView = {};
  f.document.querySelector = () => f.stage;
  f.stage.dataset.objectId = stageId; f.stage.getAnimations = () => [native, ...f.animations];
  const createElement = f.document.createElement;
  f.document.createElement = tag => {
    const node = createElement(tag), remove = node.remove;
    node.remove = () => { if (/polycss-camera/.test(node.className)) events.push("remove:camera"); return remove.call(node); };
    created.push(node); return node;
  };
  let lifetime, playback, resources, resourceOptions, orbitArguments, coordinator;
  const publication = { controlPitch: definition.camera.defaultControlPitchDegrees ?? 0,
    controlYaw: definition.camera.defaultControlYawDegrees ?? 0, zoom: definition.camera.defaultZoom,
    sceneMatrix: matrix, counterRotation: matrix, counterRotationFor: () => matrix,
    skySunViewDirection: definition.sun?.referenceViewDirection ?? [1, 0, 0], sunViewDirection: [1, 0, 0] };
  let runtime;
  try {
    const mount = runtimeFactory(definition, {
      createLifetime() { lifetime = createSceneLifetime(); return lifetime; },
      createPlayback() { playback = createPreparedPlayback(); return playback; },
      createControls() { return { publish(state) { if (state.committed) events.push("controls"); }, setReady() { events.push("ready"); }, destroy() {} }; },
      createSelection(options) { coordinator = createObjectSelectionRuntime(options); return coordinator; },
      createResources(options) {
        resourceOptions = options;
        resources = createPreparedResidency({ ...options, createImage() { return { src: "", naturalWidth: 1, naturalHeight: 1,
          decode() { return new Promise((resolve, reject) => jobs.push({ resolve, reject, image: this, done: false })); },
          removeAttribute(name) { if (name === "src") this.src = ""; } }; } });
        return resources;
      },
      mountSky(options) { events.push(`sky:${options.imageDensity}`); return { destroy() { events.push("remove:sky"); } }; },
      mountSun() { events.push("sun"); return { destroy() { events.push("remove:sun"); } }; },
      createOrbit(options) {
        orbitArguments = options; options.onPublish(publication);
        return { state: () => ({ ...publication, pose: { schema: "cssearth-camera-pose@1", scene: matrix, skybox: matrix, sunView: matrix } }), setState: value => Object.assign(publication, value),
          flyToState: async (...args) => { flights.push(args); }, rebaseScene() {}, initialResponsiveZoom: () => definition.camera.defaultZoom,
          refresh: () => options.onPublish(publication),
          invalidate: () => options.onPublish(publication), destroy() { events.push("remove:orbit"); } };
      },
      waitDocument: () => Promise.resolve(), waitPaint: () => Promise.resolve(), ...services,
    });
    runtime = mount(f.stage, { inputSurface: f.stage,
      capabilities: { ...preparedObjectCapabilities, ...(services.mountPages ? { mountPages: services.mountPages } : {}) },
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
  function restore() { try { runtime.destroy(); } finally { f.restore(); } }
  return { ...f, runtime, errors, jobs, events, flights, native, created, complete, resolveJobs, restore,
    lifetime: () => lifetime, playback: () => playback, selection: () => coordinator,
    resources: () => resources, resourceOptions: () => resourceOptions, orbitArguments: () => orbitArguments };
}

test("one mount owns the actual prepared tree, startup, celestial layers, readiness and playback", async t => {
  const h = harness(); t.after(h.restore); h.runtime.resume(); h.runtime.pause(); await h.complete();
  assert.equal(h.native.playState, "paused"); assert.equal(h.native.currentTime, 0);
  assert.ok(h.events.includes("sky:2")); assert.equal(h.events.at(-1), "ready");
  assert.equal(h.created.length, moonDefinition.tree.nodes.length);
  assert.equal(h.selection().stats().commits, 1);
  assert.equal(h.selection().stats().framePublications > 0, true);
  assert.deepEqual(h.orbitArguments().cameraPlan, moonDefinition.camera);
  assert.equal(h.orbitArguments().skyPlan, moonDefinition.sky);
  h.runtime.resume(); assert.equal(h.native.playState, "running");
  h.runtime.destroy(); assert.equal(h.native.cancels, 1); assert.equal(h.stage.children.length, 0);
  assert.deepEqual(h.events.slice(-4).filter(value => value.startsWith("remove:")), ["remove:orbit", "remove:sun", "remove:sky", "remove:camera"]);
  assert.deepEqual(h.errors, []);
});
test("development diagnostics start with the mounted sky and expose its star controls", async t => {
  const bundle = await build({ configFile: false, logLevel: "silent",
    define: { "import.meta.env.DEV": "true" },
    build: { write: false, minify: false,
      lib: { entry: fileURLToPath(new URL("./object-runtime.mjs", import.meta.url)), formats: ["es"] } } });
  const chunks = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(output => output.output).filter(item => item.type === "chunk");
  assert.equal(chunks.length, 1);
  const { createObjectRuntime: developmentRuntime } = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString("base64")}`);
  const calls = [], sky = { starGroup: {}, setStarExposure(options) { calls.push(options); return options; }, destroy() {} };
  const h = harness({ runtimeFactory: developmentRuntime }, { mountSky: () => sky }); t.after(h.restore);
  await h.complete();
  const diagnostics = h.document.defaultView.__moon;
  assert.equal(diagnostics?.ready, true);
  const exposure = { exposure: 2 };
  assert.equal(diagnostics.starExposure(exposure), exposure);
  assert.deepEqual(calls, [exposure]);
  assert.equal(h.orbitArguments().cubicSky, sky);
  assert.deepEqual(h.errors, []);
  h.runtime.destroy();
  assert.equal(h.document.defaultView.__moon, undefined);
});
test("production mount restores camera and native playback through its shared view contract", async t => {
  const h = harness(); t.after(h.restore); await h.complete();
  h.native.currentTime = 2345;
  const saved = h.runtime.sharedView.capture(false);
  assert.equal(saved.camera.pose.scene, matrix);
  assert.equal(saved.playback.times.includes(2345), true);
  assert.equal(saved.preparedEpochJdTt, null);
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
  assert.deepEqual(h.events, []); assert.deepEqual(h.errors, []);
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
  h.orbitArguments().onError(new Error("late")); h.orbitArguments().onPublish({ zoom: 2 }); assert.equal(h.errors.length, 1);
});
test("stage identity cannot mount a different existing object's prepared plan", () => {
  assert.throws(() => harness({}, { createResources() { throw new Error("test boundary"); } }), /test boundary/);
  assert.throws(() => harness({ stageId: "pluto" }), /identity/); assert.throws(() => harness({ stageId: null }), /identity/);
});
test("detached native roots cannot satisfy mounted stage readiness", async t => {
  const h = harness(); t.after(h.restore);
  const attach = h.stage.appendChild.bind(h.stage);
  h.stage.appendChild = node => { attach(node); node.remove(); return node; };
  const failure = assert.rejects(h.runtime.ready, /belong to the mounted stage|retained object stage/); await h.resolveJobs(); await failure;
  assert.equal(h.resources().stats().images.entries.length, 0); assert.deepEqual(h.errors, []);
});
test("resource readiness contains a native shared material failure and retires the whole mount", async t => {
  const h = harness(); t.after(h.restore); await h.complete();
  const binding = moonDefinition.viewBindings.find(binding => binding.kind === "silhouette-fit");
  assert.ok(binding); const target = h.created[binding.target];
  Object.defineProperty(target.style, "visibility", { configurable: true, set() { throw new Error("native material write failed"); } });
  assert.doesNotThrow(() => h.resourceOptions().onReady());
  assert.equal(h.errors.length, 1); assert.match(h.errors[0].message, /native material write failed/);
  assert.equal(h.resources().stats().images.entries.length, 0); assert.equal(h.native.cancels, 1);
  const frames = h.selection().stats().framePublications;
  h.resourceOptions().onReady(); h.orbitArguments().onPublish({ zoom: 3 });
  assert.equal(h.selection().stats().framePublications, frames); assert.equal(h.errors.length, 1);
});
test("optional warm decode failure is recoverable while native cleanup failure is fatal", async t => {
  const warnings = []; t.mock.method(console, "error", error => warnings.push(error));
  const h = harness(); t.after(h.restore); await h.complete();
  h.resourceOptions().onWarmError(new Error("optional decode")); assert.equal(warnings.length, 1); assert.equal(h.errors.length, 0);
  h.runtime.resume(); assert.equal(h.native.playState, "running");
  h.resourceOptions().onCleanupError(new Error("native release failed")); assert.equal(h.errors.length, 1);
  assert.equal(h.native.cancels, 1); assert.equal(h.resources().stats().images.entries.length, 0);
  h.resourceOptions().onWarmError(new Error("late warm")); h.resourceOptions().onCleanupError(new Error("late cleanup"));
  assert.equal(warnings.length, 1); assert.equal(h.errors.length, 1);
});
test("Earth's actual prepared page layers join shared publication, playback and cleanup", async t => {
  const events = [], plans = [];
  const h = harness({ definition: earthDefinition }, { mountPages({ own, plan }) {
    plans.push(plan); own(() => events.push("destroy"));
    return { publish: () => events.push("frame"), setLens: lens => events.push(lens.id), setPlaying: value => events.push(value), stats: () => ({}) };
  } }); t.after(h.restore); await h.complete();
  assert.deepEqual(plans, earthDefinition.pageLayers.map(layer => layer.plan));
  assert.ok(events.includes("frame")); h.runtime.resume(); assert.equal(events.at(-1), true);
  h.runtime.pause(); assert.equal(events.at(-1), false); h.runtime.destroy(); assert.equal(events.at(-1), "destroy");
  h.runtime.resume(); assert.equal(events.at(-1), "destroy"); assert.deepEqual(h.errors, []);
});
test("partial prepared page construction retires the actual tree and all resources", async t => {
  let cleaned = false;
  const h = harness({ definition: earthDefinition }, { mountPages({ own }) { own(() => { cleaned = true; }); throw new Error("page construction"); } });
  t.after(h.restore); const failure = assert.rejects(h.runtime.ready, /page construction/); await h.resolveJobs(); await failure;
  assert.equal(cleaned, true); assert.equal(h.stage.children.length, 0); assert.equal(h.resources().stats().images.entries.length, 0);
});

test("prepared geographic destinations and lens targets use the physical surface flight while reset keeps authored framing", async t => {
  const h = harness({ definition: earthDefinition }, { mountPages: () => ({
    publish() {}, setLens() {}, setPlaying() {}, stats: () => ({}),
  }) });
  t.after(h.restore);
  // This boundary test records camera requests; native conformance measures
  // the actual geographic point through the complete browser matrix chain.
  h.document.defaultView.DOMMatrix = class extends globalThis.DOMMatrix { inverse() { return this; } };
  h.document.defaultView.getComputedStyle = () => ({ transform: matrix });
  await h.complete();
  const target = earthDefinition.variants.find(variant => variant.navigation?.camera);
  assert.ok(target, 'The actual prepared geographic lens has a camera target');
  const request = h.selection().dispatch({ kind: 'lens', id: target.when.lensId });
  await h.resolveJobs(); assert.equal(await request, true);
  assert.deepEqual(h.flights.at(-1), [target.navigation.camera, { surfaceTarget: true }]);
  const place = { camera: target.navigation.camera, coverage: 'detail' };
  const destination = h.runtime.destinations.select(place);
  await h.resolveJobs(); await (await destination).arrival;
  assert.deepEqual(h.flights.at(-1), [place.camera, { surfaceTarget: true }]);
  await h.runtime.destinations.reset();
  assert.deepEqual(h.flights.at(-1), [{
    controlPitch: earthDefinition.camera.defaultControlPitchDegrees,
    controlYaw: earthDefinition.camera.defaultControlYawDegrees,
    zoom: earthDefinition.camera.defaultZoom,
  }]);
  assert.deepEqual(h.errors, []);
});

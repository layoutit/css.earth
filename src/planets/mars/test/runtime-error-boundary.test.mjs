import { createPreparedCameraPublisher } from "../../../platform/prepared-camera-runtime.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";
import { createRowShardCache } from "../../jupiter/runtime/preparedRowCache.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../../jupiter/runtime/preparedLighting.mjs";
import { PREPARED_MARS_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MARS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_VENUS_SCENE } from "../../venus/runtime/preparedScene.mjs";
import { PREPARED_VENUS_SKY_SUN } from "../../venus/runtime/preparedSkySun.mjs";
import { createVenusFeatureControls } from "../../venus/runtime/feature-controls.mjs";

// Exercise the actual object coordination functions with controlled native
// boundaries. Shared camera/input math has separate source-backed tests.
async function objectFactory(id, name) {
  const source = await readFile(new URL(`../../${id}/runtime/client.mjs`, import.meta.url), "utf8");
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf("\nfunction ", start + 1);
  return (dependencies) => new Function(...Object.keys(dependencies),
    `${source.slice(start, end)}; return ${name};`)(...Object.values(dependencies));
}
const marsFactory = await objectFactory("mars", "createMarsOrbit");
const venusFactory = await objectFactory("venus", "createVenusOrbitControls");
const jupiterFactory = await objectFactory("jupiter", "createJupiterOrbit");
const flush = () => new Promise(setImmediate);

test("Venus feature toggles publish normal state and release their listeners", (t) => {
  const f = venusFeatureFixture(t);
  const controls = f.create();
  for (const name of ["atmosphere", "stars"]) {
    f.inputs[name].checked = false;
    f.change(name)();
    assert.equal(controls.state()[name], false);
    assert.equal(f.classes.has(`venus-hide-${name}`), true);
    f.inputs[name].checked = true;
    f.change(name)();
    assert.equal(controls.state()[name], true);
    assert.equal(f.classes.has(`venus-hide-${name}`), false);
  }
  f.inputs.shadows.checked = true;
  f.change("shadows")();
  assert.equal(controls.state().shadows, true);
  assert.deepEqual(f.shadowValues, [true]);
  assert.deepEqual(f.errors, []);
  f.lifetime.destroy();
  assert.equal(f.listenerCount(), 0);
});

for (const name of ["atmosphere", "stars"]) {
  test(`Venus ${name} publication failure retires once and stops later callbacks`, (t) => {
    const f = venusFeatureFixture(t);
    const controls = f.create();
    const callbacks = ["atmosphere", "stars", "shadows"].map(f.change);
    f.inputs[name].checked = false;
    f.featureFailure = new Error(`${name} publication failed`);
    assert.doesNotThrow(f.change(name));
    assert.deepEqual(f.errors, [f.featureFailure]);
    assert.equal(f.lifetime.disposed, true);
    assert.equal(controls.state()[name], true, "failed publication cannot advance committed control state");
    assert.equal(f.classes.size, 0, "fatal cleanup removes partial feature presentation");
    assert.equal(f.listenerCount(), 0);
    const writes = [...f.writes];
    const state = controls.state();
    for (const callback of callbacks) assert.doesNotThrow(callback);
    assert.deepEqual(f.writes, writes);
    assert.deepEqual(controls.state(), state);
    assert.deepEqual(f.shadowValues, []);
    assert.equal(f.errors.length, 1);
  });

  test(`Venus ${name} stops control-state publication after synchronous disposal`, (t) => {
    const f = venusFeatureFixture(t);
    const controls = f.create();
    f.inputs[name].checked = false;
    f.onFeaturePublish = () => f.lifetime.destroy();
    assert.doesNotThrow(f.change(name));
    assert.equal(controls.state()[name], true);
    assert.equal(f.classes.size, 0);
    assert.equal(f.lifetime.disposed, true);
    assert.deepEqual(f.errors, []);
  });
}

test("Venus retained feature callbacks are inert after ordinary disposal", (t) => {
  const f = venusFeatureFixture(t);
  const controls = f.create();
  const callbacks = ["atmosphere", "stars", "shadows"].map(f.change);
  f.lifetime.destroy();
  const writes = [...f.writes];
  const state = controls.state();
  for (const input of Object.values(f.inputs)) input.checked = !input.checked;
  for (const callback of callbacks) assert.doesNotThrow(callback);
  assert.deepEqual(controls.state(), state);
  assert.deepEqual(f.writes, writes);
  assert.deepEqual(f.shadowValues, []);
  assert.deepEqual(f.errors, []);
});

for (const throwAfterRetirement of [false, true]) {
  test(`Venus shadow callback retirement stops its publication (${throwAfterRetirement ? "throw" : "return"})`, (t) => {
    const f = venusFeatureFixture(t);
    const controls = f.create();
    f.inputs.shadows.checked = true;
    f.onShadowPublish = () => {
      f.lifetime.destroy();
      if (throwAfterRetirement) throw new Error("already retired by the nested publisher");
    };
    assert.doesNotThrow(f.change("shadows"));
    assert.equal(controls.state().shadows, false);
    assert.deepEqual(f.errors, []);
  });
}

test("Venus initial feature binding failure still throws to startup", (t) => {
  const f = venusFeatureFixture(t);
  const controls = f.create();
  const failure = new Error("initial shadow publication failed");
  f.onShadowPublish = () => { throw failure; };
  assert.throws(() => controls.bindRuntime({ animations: [] }), (error) => error === failure);
  assert.deepEqual(f.errors, []);
  assert.equal(f.lifetime.disposed, false, "the startup owner handles construction failure");
  assert.equal(f.inputs.speed.disabled, true);
});

for (const id of ["sun", "venus", "mars", "jupiter"]) {
  const name = id === "sun" || id === "venus" ? "mountPreparedScene" : "mountPreparedBody";
  const factory = await objectFactory(id, name);
  for (const replacement of [false, true]) {
    test(`${id} lens retirement ${replacement ? "preserves a replacement stage" : "clears owned state before removing its camera"}`, () => {
      const lifetime = createSceneLifetime();
      const stage = { dataset: { lens: replacement ? "replacement" : "selected-lens" } };
      let removed = 0;
      const camera = { parentNode: null, classList: { add() {} },
        remove() { removed += 1; this.parentNode = null; } };
      const stopped = new Error("stop after ownership registration");
      const create = factory({
        validatePreparedCubicSky() {}, createPolyCamera: () => ({}),
        createPolyScene: () => ({ cameraEl: camera, destroy: () => camera.remove() }),
        createMesh(className) { if (className.includes("polycss-camera")) return camera; throw stopped; },
      });
      const plan = { schema: id === "sun" ? "csssun-prepared-runtime-scene@2"
        : id === "venus" ? "cssvenus-prepared-runtime-scene@1" : `css${id}-prepared-retained-body@1`,
        runtimeGeometry: false, runtimeRasterization: false,
        starfield: { cameraContract: "google-earth-pro-inverse-unbounded-matrix3d" },
        camera: { cameraModel: "accumulated-matrix3d", pitchBounded: false, yawBounded: false },
        body: { axialTiltDegrees: 0 } };
      assert.throws(() => create(stage, plan, lifetime), (error) => error === stopped);
      camera.parentNode = replacement ? null : stage;
      assert.deepEqual(lifetime.destroy(), []);
      assert.equal(stage.dataset.lens, replacement ? "replacement" : undefined);
      assert.equal(removed, 1);
      stage.dataset.lens = "newer-replacement";
      lifetime.destroy();
      assert.equal(stage.dataset.lens, "newer-replacement");
      assert.equal(removed, 1);
    });
  }
}

for (const id of ["mars", "venus"]) {
  for (const event of ["wheel", "drag", "resize"]) {
    test(`${id} ${event} publication failure retires once and leaves callbacks inert`, () => {
      const f = localOrbitFixture(id);
      try {
        f.create();
        const callback = event === "wheel" ? f.callbacks.wheel.applyCamera
          : event === "drag" ? () => f.callbacks.drag.rotate({ controlPitchDelta: 2, controlYawDelta: 3 })
            : f.callbacks.resize;
        f.failPublication = true;
        assert.doesNotThrow(callback);
        assert.equal(f.errors.length, 1);
        assert.match(f.errors[0].message, /publication failed/);
        assert.equal(f.lifetime.disposed, true);
        assert.equal(f.owners.size, 0);
        assert.equal(f.callbacks.resize, null);
        const writes = f.writes;
        assert.doesNotThrow(callback);
        assert.equal(f.errors.length, 1);
        assert.equal(f.writes, writes);
      } finally { f.lifetime.destroy(); }
    });
  }
}

test("Mars deferred material publication failure cancels sibling frames without escaping", () => {
  const f = localOrbitFixture("mars");
  try {
    f.create();
    const ready = f.callbacks.ready;
    ready(); ready();
    assert.equal(f.frames.size, 2);
    const callbacks = [...f.frames.values()];
    f.failPublication = true;
    assert.doesNotThrow(callbacks[0]);
    assert.equal(f.errors.length, 1);
    assert.equal(f.lifetime.disposed, true);
    assert.equal(f.frames.size, 0);
    assert.equal(f.callbacks.ready, null);
    assert.doesNotThrow(callbacks[1]);
    assert.doesNotThrow(ready);
    assert.equal(f.frames.size, 0);
    assert.equal(f.errors.length, 1);
  } finally { f.lifetime.destroy(); }
});

test("Mars deferred frame scheduling failure reaches the same fatal owner", () => {
  const f = localOrbitFixture("mars");
  try {
    f.create();
    f.failScheduling = true;
    assert.doesNotThrow(f.callbacks.ready);
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /scheduling failed/);
    assert.equal(f.lifetime.disposed, true);
    assert.equal(f.owners.size, 0);
  } finally { f.lifetime.destroy(); }
});

test("Mars fatal publication still cancels every other frame if one cancellation throws", () => {
  const f = localOrbitFixture("mars");
  try {
    f.create();
    f.callbacks.ready(); f.callbacks.ready(); f.callbacks.ready();
    const first = [...f.frames.values()][0];
    f.failPublication = true;
    f.failCancellation = true;
    assert.doesNotThrow(first);
    assert.equal(f.errors.length, 1);
    assert.equal(f.cleanupErrors.length, 1);
    assert.match(f.cleanupErrors[0].message, /frame cleanup failed/);
    assert.equal(f.frames.size, 0);
    assert.equal(f.owners.size, 0);
  } finally { f.lifetime.destroy(); }
});

test("Mars initial publication still throws to startup instead of reporting a live failure", () => {
  const f = localOrbitFixture("mars");
  try {
    f.failPublication = true;
    assert.throws(f.create, /publication failed/);
    assert.deepEqual(f.errors, []);
  } finally { f.lifetime.destroy(); }
});

for (const failDecode of [false, true]) {
  test(`Jupiter deferred row ${failDecode ? "decode stays recoverable and retries" : "publication reaches the fatal owner"}`, async () => {
    const previousImage = globalThis.Image;
    const previousError = console.error;
    const reports = [];
    let rejectDecode = false;
    globalThis.Image = class {
      naturalWidth = 64;
      naturalHeight = 64;
      decode() { return rejectDecode ? Promise.reject(new Error("row decode failed")) : Promise.resolve(); }
      removeAttribute(name) { if (name === "src") this.src = ""; }
    };
    console.error = (error) => reports.push(error);
    const lifetime = createSceneLifetime();
    const errors = [];
    const cache = createRowShardCache(PREPARED_JUPITER_LIGHTING);
    lifetime.onDispose(() => cache.destroy());
    let refreshes = 0;
    const onError = (error) => { errors.push(error); lifetime.destroy(); };
    try {
      await cache.prepareInitial();
      const create = jupiterFactory({
        PREPARED_JUPITER_LIGHTING, PREPARED_JUPITER_STARFIELD: {}, PREPARED_JUPITER_SKY_SUN: {},
        JUPITER_CUBIC_CAMERA: {},
        createPreparedPlanarRotationPublisher: () => () => {},
        createRetainedCubicSkyOrbit(options) {
          assert.equal(options.onError, onError);
          return { refresh() {
            refreshes += 1;
            if (!failDecode) throw new Error("material publication failed");
          } };
        },
      });
      create({ ownerDocument: { querySelector() {} } }, { materialLeaf: {} }, cache, lifetime, onError);
      rejectDecode = failDecode;
      cache.presentation(PREPARED_JUPITER_LIGHTING.presentations.length - 1);
      await flush(); await flush();
      if (failDecode) {
        assert.equal(errors.length, 0);
        assert.equal(lifetime.disposed, false);
        assert.equal(refreshes, 0);
        assert.equal(reports.length, 1);
        rejectDecode = false;
        cache.presentation(PREPARED_JUPITER_LIGHTING.presentations.length - 1);
        await flush(); await flush();
        assert.ok(refreshes > 0);
        assert.equal(errors.length, 0);
      } else {
        assert.equal(errors.length, 1);
        assert.match(errors[0].message, /material publication failed/);
        assert.equal(lifetime.disposed, true);
        assert.equal(cache.stats().retainedImageCount, 0);
        assert.equal(refreshes, 1);
        assert.deepEqual(reports, []);
      }
    } finally {
      lifetime.destroy();
      globalThis.Image = previousImage;
      console.error = previousError;
    }
  });
}

function venusFeatureFixture(t) {
  const previous = Object.fromEntries(["document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement"]
    .map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const f = { lifetime: createSceneLifetime(), classes: new Set(), errors: [], writes: [],
    shadowValues: [], featureFailure: null, onFeaturePublish: null, onShadowPublish: null };
  class Element {
    constructor() { this.listeners = new Map(); this.dataset = {}; this.checked = true; }
    addEventListener(name, callback, { signal } = {}) {
      this.listeners.set(name, callback);
      signal?.addEventListener("abort", () => this.removeEventListener(name, callback), { once: true });
    }
    removeEventListener(name, callback) {
      if (this.listeners.get(name) === callback) this.listeners.delete(name);
    }
    setAttribute() {}
  }
  f.inputs = Object.fromEntries(["atmosphere", "stars", "shadows", "speed"]
    .map((name) => [name, new Element()]));
  const root = new Element();
  root.querySelector = (selector) => f.inputs[/name="([^"]+)"/.exec(selector)?.[1]] ?? null;
  const stage = new Element();
  stage.classList = {
    toggle(name, value) {
      f.writes.push(`toggle:${name}:${value}`);
      if (value) f.classes.add(name); else f.classes.delete(name);
      if (f.featureFailure) throw f.featureFailure;
      f.onFeaturePublish?.();
    },
    remove(name) { f.writes.push(`remove:${name}`); f.classes.delete(name); },
  };
  globalThis.document = { querySelector: () => root };
  globalThis.HTMLElement = globalThis.HTMLInputElement = globalThis.HTMLButtonElement = Element;
  t.after(() => {
    f.lifetime.destroy();
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  f.create = () => createVenusFeatureControls({
    stage, lifetime: f.lifetime,
    onError(error) { f.errors.push(error); f.lifetime.destroy(); },
    onShadowsVisibilityChange(value) { f.shadowValues.push(value); f.onShadowPublish?.(); },
  });
  f.change = (name) => f.inputs[name].listeners.get("change");
  f.listenerCount = () => Object.values(f.inputs).reduce((count, input) => count + input.listeners.size, 0);
  return f;
}

function localOrbitFixture(id) {
  const f = { lifetime: createSceneLifetime(), owners: new Set(), callbacks: {},
    errors: [], cleanupErrors: [], frames: new Map(), nextFrame: 0, writes: 0,
    failPublication: false, failScheduling: false, failCancellation: false };
  const acquire = (name) => {
    f.owners.add(name);
    return { mobile: false, update() {}, stop() {}, stats: () => ({}), destroy() { f.owners.delete(name); } };
  };
  const onError = (error) => { f.errors.push(error); f.cleanupErrors.push(...f.lifetime.destroy()); };
  const windowTarget = {
    addEventListener(name, callback) { f.callbacks[name] = callback; },
    removeEventListener(name, callback) { if (f.callbacks[name] === callback) f.callbacks[name] = null; },
  };
  const stage = { ownerDocument: { defaultView: windowTarget, querySelector() {} } };
  const node = () => ({ style: { setProperty() {} }, dataset: {}, closest: () => stage });
  const checkedStyle = new Proxy({}, { set(target, key, value) {
    f.writes += 1;
    if (f.failPublication) throw new Error("publication failed");
    target[key] = value;
    return true;
  } });
  const mounted = id === "mars" ? {
    camera: node(), scene: { style: checkedStyle }, materialCounter: node(), materialLeaf: node(),
    cubicSky: { setOrientation() {} }, skySun: { setViewDirection() {} },
  } : {
    camera: { update() {} }, scene: { cameraEl: node(), sceneElement: { style: checkedStyle }, applyCamera() {} },
    materialComposite: node(), setSkyboxOrientation: () => [1, 0, 0], setMaterialDirection() {},
  };
  const cache = { onReady(callback) { f.callbacks.ready = callback; }, presentation: () => null };
  const dependencies = {
    createPreparedCameraPublisher,
    PREPARED_MARS_CAMERA, PREPARED_MARS_LIGHTING, PREPARED_MARS_SCENE, PREPARED_MARS_SKY_SUN,
    PREPARED_VENUS_SCENE, PREPARED_VENUS_SKY_SUN, BASE_TILE: 64,
    MOBILE_VIEWPORT_QUERY: "mobile", matchMedia: () => ({ matches: false }),
    createPolyCamera: (initial) => {
      const state = { ...initial };
      return { state, update(value) { Object.assign(state, value); } };
    },
    createCubicSkyCameraOrientation: () => ({
      // Force a changed scene so the retained publisher reaches the failing
      // style boundary rather than correctly skipping an idle write.
      scene: () => f.failPublication ? "matrix3d(2)" : "matrix3d(1)", skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: [1, 0, 0] }),
      counterRotation: () => "matrix3d(1)", rotate() {}, reset() {},
    }),
    createPolyOrbitControls(scene) { f.callbacks.wheel = scene; return acquire("wheel"); },
    createUnboundedMatrixDragControls(options) {
      assert.equal(options.onError, onError);
      f.callbacks.drag = options;
      return acquire("drag");
    },
    bindResponsiveOrbitPolicy(options) {
      assert.equal(options.onError, onError);
      return acquire("policy");
    },
    selectPreparedResponsiveZoom: () => ({ zoom: 1, model: "test", widthShare: 1 }),
    requestAnimationFrame(callback) {
      if (f.failScheduling) throw new Error("scheduling failed");
      const frame = ++f.nextFrame;
      f.frames.set(frame, () => { f.frames.delete(frame); callback(); });
      return frame;
    },
    cancelAnimationFrame(frame) {
      f.frames.delete(frame);
      if (f.failCancellation) { f.failCancellation = false; throw new Error("cancellation failed"); }
    },
    viewSunDirectionToPreparedLightDirection: (value) => value,
    preparedScenePitch: (value) => value,
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
    normalizeDegrees: (value) => value,
  };
  f.create = id === "mars"
    ? () => marsFactory(dependencies)(stage, mounted, cache, () => false, f.lifetime, onError)
    : () => venusFactory(dependencies)({ inputSurface: stage, mounted,
      plan: PREPARED_VENUS_SCENE.camera, lifetime: f.lifetime, onError });
  return f;
}

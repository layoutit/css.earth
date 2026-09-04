import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPreparedCameraPublisher } from "./prepared-camera-runtime.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";
import { createUnboundedMatrixDragControls } from "./cubic-sky-runtime.mjs";

class Surface {
  constructor() {
    this.listeners = new Map();
    this.style = { removeProperty: (name) => { delete this.style[name]; } };
    this.ownerDocument = { defaultView: this };
    this.frames = new Set();
    this.nextFrame = 0;
    this.captured = new Set();
  }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  dispatch(name, partial = {}) {
    const event = { preventDefault() {}, pointerId: 1, button: 0, clientX: 0, clientY: 0, timeStamp: 0, ...partial };
    for (const callback of this.listeners.get(name) ?? []) callback(event);
  }
  requestAnimationFrame() { const id = ++this.nextFrame; this.frames.add(id); return id; }
  cancelAnimationFrame(id) { this.frames.delete(id); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

test("drag constructor removes partially attached listeners if initial style publication fails", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface();
    Object.defineProperty(surface.style, "cursor", {
      configurable: true,
      set() { throw new Error("style failure"); },
    });
    assert.throws(() => createUnboundedMatrixDragControls({
      inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() {},
    }), /style failure/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
  } finally { globalThis.HTMLElement = previous; }
});

test("drag destruction releases listeners and capture even if interaction completion throws", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface();
    let updates = 0;
    const controls = createUnboundedMatrixDragControls({
      inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() { updates += 1; },
      onEnd() { throw new Error("completion failure"); },
    });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    assert.ok(updates > 0);
    assert.throws(() => controls.destroy(), /cleanup failed/);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
    controls.update({ drag: true });
    assert.equal(surface.style.cursor, undefined);
  } finally { globalThis.HTMLElement = previous; }
});

const source = await readFile(new URL("./cubic-sky-runtime.mjs", import.meta.url), "utf8");
const start = source.indexOf("export function createRetainedCubicSkyOrbit(");
const end = source.indexOf("\nexport function preparedScenePitch", start);
const factory = new Function("dependencies", `const { createSceneLifetime, createPreparedCameraPublisher, HTMLElement,
  validatePreparedCubicSky, validateDirectionalSunPlan, createPolyCamera,
  createCubicSkyCameraOrientation, matchMedia, MOBILE_VIEWPORT_QUERY,
  createUnboundedMatrixDragControls, createPolyOrbitControls, bindResponsiveOrbitPolicy,
  selectPreparedResponsiveZoom, clamp } = dependencies;
  ${source.slice(start, end).replace("export ", "")}
  return createRetainedCubicSkyOrbit;`);

test("live cubic publication failure retires every owner once before reporting fatal", () => {
  const fixture = orbitFixture(null);
  let fail = false;
  const errors = [];
  fixture.arguments.onPublish = () => { if (fail) throw new Error("live publication"); };
  fixture.arguments.onError = (error) => {
    assert.equal(fixture.owners.size, 0);
    errors.push(error);
  };
  const orbit = fixture.create(fixture.arguments);
  fail = true;
  assert.throws(() => orbit.refresh(), /live publication/);
  orbit.refresh();
  orbit.setState({ zoom: 3 });
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /live publication/);
  assert.equal(orbit.stats().publications, 1);
  assert.equal(fixture.stage.listenerCount(), 0);
});

test("native drag publication failure releases capture/listeners and reports instead of escaping", () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  try {
    const surface = new Surface(), errors = [];
    const controls = createUnboundedMatrixDragControls({ inputSurface: surface,
      trackballMetrics: () => ({ centerX: 0, centerY: 0, radius: 200 }),
      rotate() { throw new Error("drag publication"); }, onError: (error) => errors.push(error) });
    surface.dispatch("pointerdown");
    surface.dispatch("pointermove", { clientX: 50, timeStamp: 16 });
    assert.equal(errors.length, 1);
    assert.equal(surface.listenerCount(), 0);
    assert.equal(surface.frames.size, 0);
    assert.equal(surface.captured.size, 0);
    controls.destroy();
  } finally { globalThis.HTMLElement = previous; }
});

for (const failure of ["wheel", "policy", "fit", "publish"]) {
  test(`cubic orbit constructor releases earlier owners when ${failure} fails`, () => {
    const fixture = orbitFixture(failure);
    assert.throws(() => fixture.create(fixture.arguments), new RegExp(`${failure} failure`));
    assert.deepEqual([...fixture.owners], []);
    assert.equal(fixture.stage.listenerCount(), 0);
  });
}

test("cubic orbit completes independent cleanup and preserves construction error when cleanup also fails", () => {
  const fixture = orbitFixture("publish", true);
  assert.throws(() => fixture.create(fixture.arguments), (error) => {
    assert.equal(error.cause.message, "publish failure");
    assert.equal(error.errors[0], error.cause);
    return true;
  });
  assert.deepEqual([...fixture.owners], []);
  assert.equal(fixture.stage.listenerCount(), 0);
});

test("cubic orbit destruction is idempotent and disables later camera publication", () => {
  const fixture = orbitFixture(null, true);
  const orbit = fixture.create(fixture.arguments);
  const publications = orbit.stats().publications;
  assert.throws(() => orbit.destroy(), /cleanup failed/);
  assert.deepEqual([...fixture.owners], []);
  assert.equal(fixture.stage.listenerCount(), 0);
  orbit.destroy();
  orbit.refresh();
  orbit.setState({ zoom: 9 });
  assert.equal(orbit.stats().publications, publications);
  assert.equal(orbit.state().zoom, 1);
});

function orbitFixture(failure, cleanupFailure = false) {
  const owners = new Set();
  const stage = new Surface();
  const acquire = (name) => {
    if (failure === name) throw new Error(`${name} failure`);
    owners.add(name);
    return { mobile: false, update() {}, stop() {}, stats() { return {}; },
      destroy() {
        owners.delete(name);
        if (cleanupFailure && name === "wheel") throw new Error("wheel cleanup failure");
      },
    };
  };
  const create = factory({
    createSceneLifetime, createPreparedCameraPublisher, HTMLElement: Surface,
    validatePreparedCubicSky() {}, validateDirectionalSunPlan() {},
    createPolyCamera(state) { return { state, update(value) { Object.assign(state, value); } }; },
    createCubicSkyCameraOrientation() {
      return { scene: () => "matrix3d(1)", skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: null }),
        counterRotation() {}, billboardCounterRotation() {}, reset() {},
      };
    },
    matchMedia: () => ({ matches: false }), MOBILE_VIEWPORT_QUERY: "mobile",
    createUnboundedMatrixDragControls: () => acquire("drag"),
    createPolyOrbitControls: () => acquire("wheel"),
    bindResponsiveOrbitPolicy: () => acquire("policy"),
    selectPreparedResponsiveZoom() {
      if (failure === "fit") throw new Error("fit failure");
      return { zoom: 1, model: "unit", widthShare: 0.5 };
    },
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
  });
  const cameraPlan = Object.fromEntries([
    "minimumControlPitchDegrees", "maximumControlPitchDegrees", "defaultControlPitchDegrees",
    "defaultControlYawDegrees", "initialScenePitchDegrees", "maximumScenePitchDegrees",
    "minimumZoom", "maximumZoom", "defaultZoom", "sceneScale", "logicalBodyDiameter",
  ].map((key) => [key, key === "maximumZoom" ? 10 : 1]));
  Object.assign(cameraPlan, { cameraModel: "accumulated-matrix3d", pitchBounded: false, yawBounded: false });
  return { create, owners, stage, arguments: {
    onError(error) { throw error; },
    stage, inputSurface: stage, cameraElement: new Surface(), sceneElement: new Surface(),
    cubicSky: { root: { isConnected: true }, setOrientation() {} }, skyPlan: {},
    cameraPlan, objectId: "unit", requireSun: false,
    onPublish() { if (failure === "publish") throw new Error("publish failure"); },
  } };
}

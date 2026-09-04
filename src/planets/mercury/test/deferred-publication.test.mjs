import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPreparedCameraPublisher } from "../../../platform/prepared-camera-runtime.mjs";
import { createSceneLifetime } from "../../../platform/scene-lifetime.mjs";

// Execute the actual object-owned camera with minimal transport/input fixtures.
// The shared drag module separately proves event/RAF exception containment.
const source = await readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8");
const start = source.indexOf("  function createVerticalOrbit() {");
const end = source.indexOf("\n  function publishMaterialFrame(", start);
const factory = new Function("dependencies", `const {
  PREPARED_MERCURY_SCENE, PREPARED_MERCURY_SKY_SUN, PREPARED_MERCURY_ASSETS,
  createPreparedCameraPublisher, createPolyCamera, createCubicSkyCameraOrientation, viewSunDirectionToPreparedLightDirection,
  lifetime, onError, mounted, inputSurface, stage, createPolyOrbitControls,
  createUnboundedMatrixDragControls, matchMedia, MOBILE_VIEWPORT_QUERY,
  bindResponsiveOrbitPolicy, selectPreparedResponsiveZoom, materialCache,
  publishShadowlessMaterial, shadowlessPresentation, clamp, preparedScenePitch
} = dependencies; const shadowsEnabled = false;
${source.slice(start, end)} return createVerticalOrbit();`);

for (const origin of ["cache-ready", "wheel", "resize", "refresh", "setState", "drag-frame", "media-change"]) {
  test(`Mercury ${origin} publication failure reports once and retires owned work`, () => {
    const lifetime = createSceneLifetime(), errors = [], owners = new Set(), listeners = new Map();
    let readyCallback, wheelScene, dragOptions, policyOptions, fail = false, writes = 0;
    const style = {};
    Object.defineProperty(style, "scale", { set() {
      if (fail) throw new Error("Mercury style publication failed");
      writes += 1;
    } });
    const stage = { ownerDocument: { querySelector: () => null } };
    const windowTarget = { addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name) };
    const acquire = (name) => { owners.add(name); return { mobile: false, update() {}, stop() {}, stats: () => ({}),
      destroy: () => owners.delete(name) }; };
    const orbit = factory({ createPreparedCameraPublisher, lifetime, onError(error) {
      assert.equal(lifetime.disposed, true);
      assert.equal(owners.size, 0);
      errors.push(error);
    }, stage, inputSurface: { ownerDocument: { defaultView: windowTarget } },
      mounted: { sceneRoot: { style: {} }, cameraRoot: { style: {} }, materialRoot: { style },
        materialLeaf: {}, cubicSky: { setOrientation() {} }, skySun: { setViewDirection() {} }, viewBank: { syncPitch() {} } },
      PREPARED_MERCURY_SCENE: { camera: { cameraModel: "accumulated-matrix3d", horizontalOrbit: true,
        pitchBounded: false, yawBounded: false, sceneScale: 1, defaultZoom: 1, state: { zoom: 1 },
        defaultControlPitchDegrees: 30, defaultControlYawDegrees: 0, minimumZoom: 0.1, maximumZoom: 4 }, starfield: {}, material: { defaultFrame: 0 } },
      PREPARED_MERCURY_SKY_SUN: { referenceViewDirection: [0, 0, 1] }, PREPARED_MERCURY_ASSETS: { lighting: {} },
      createPolyCamera(state) { return { state, update: (value) => Object.assign(state, value) }; },
      createCubicSkyCameraOrientation: () => ({ scene: () => "matrix3d(1)", skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: [0, 0, 1] }), rotate() {}, reset() {} }),
      viewSunDirectionToPreparedLightDirection: (value) => value,
      createPolyOrbitControls(scene) { wheelScene = scene; return acquire("wheel"); },
      createUnboundedMatrixDragControls(options) { dragOptions = options; return acquire("drag"); },
      matchMedia: () => ({ matches: false }), MOBILE_VIEWPORT_QUERY: "mobile",
      bindResponsiveOrbitPolicy: (options) => { policyOptions = options; return acquire("policy"); }, selectPreparedResponsiveZoom: () => ({ zoom: 1 }),
      materialCache: { onReady: (callback) => { readyCallback = callback; } },
      publishShadowlessMaterial() {}, shadowlessPresentation: { frameIndex: 0 },
      clamp: (value) => value, preparedScenePitch: (value) => value,
    });
    orbit.refresh();
    assert.equal(writes, 1);
    const pendingNotification = readyCallback;
    fail = true;
    const publish = {
      "cache-ready": pendingNotification, wheel: wheelScene.applyCamera, resize: listeners.get("resize"),
      refresh: orbit.refresh, setState: () => orbit.setState({ zoom: 2 }),
      "drag-frame": () => { try { dragOptions.rotate({ controlPitchDelta: 1, controlYawDelta: 0 }); }
        catch (error) { dragOptions.onError(error); } },
      "media-change": () => policyOptions.onError(new Error("Mercury style publication failed")),
    }[origin];
    if (origin === "refresh" || origin === "setState") {
      assert.throws(publish, /Mercury style publication failed/u,
        "public synchronous callers must stop before publishing a commit tail");
    } else assert.doesNotThrow(publish);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Mercury style publication failed/u);
    assert.equal(listeners.size, 0);
    assert.equal(readyCallback, null);
    fail = false;
    pendingNotification();
    wheelScene.applyCamera();
    orbit.refresh();
    orbit.setState({ zoom: 3 });
    assert.equal(writes, 1, "late callbacks must not publish after fatal retirement");
    assert.equal(errors.length, 1);
  });
}

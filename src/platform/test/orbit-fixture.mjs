import { readFile } from "node:fs/promises";
import { createPreparedCameraPublisher } from "../prepared-camera-runtime.mjs";
import { createSceneLifetime } from "../scene-lifetime.mjs";

export class Surface {
  constructor() {
    this.listeners = new Map();
    this.style = { removeProperty: (name) => { delete this.style[name]; } };
    this.ownerDocument = { defaultView: this, querySelector: () => null };
    this.dataset = {};
    this.style.setProperty = (key, value) => { this.style[key] = value; };
    this.frames = new Map();
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
    const event = { type:name, isPrimary:true, preventDefault() {}, pointerId: 1, button: 0, clientX: 0, clientY: 0, timeStamp: 0, ...partial };
    for (const callback of this.listeners.get(name) ?? []) callback(event);
  }
  requestAnimationFrame(callback) { const id = ++this.nextFrame; this.frames.set(id,callback); return id; }
  tick(time) { const callbacks=[...this.frames.values()]; this.frames.clear(); callbacks.forEach(callback=>callback(time)); }
  cancelAnimationFrame(id) { this.frames.delete(id); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

const source = await readFile(new URL("../cubic-sky-runtime.mjs", import.meta.url), "utf8");
const start = source.indexOf("export function createObjectInteractionControls(");
const end = source.indexOf("\nexport function preparedScenePitch", start);
const factory = new Function("dependencies", `const { createSceneLifetime, createPreparedCameraPublisher, HTMLElement,
  validatePreparedCubicSky, validateDirectionalSunPlan, createPolyCamera,
  createCubicSkyCameraOrientation, matchMedia, MOBILE_VIEWPORT_QUERY,
  createUnboundedMatrixDragControls, createPreparedWheelZoomControls, bindResponsiveOrbitPolicy,
  selectPreparedResponsiveZoom, viewSunDirectionToPreparedLightDirection, preparedScenePitch, clamp } = dependencies;
  ${source.slice(start, end).replaceAll("export ", "")}
  return createRetainedCubicSkyOrbit;`);

export function orbitFixture(failure, cleanupFailure = false) {
  const owners = new Set();
  const callbacks = {};
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
    viewSunDirectionToPreparedLightDirection: (value) => value,
    preparedScenePitch: (value) => value,
    validatePreparedCubicSky() {}, validateDirectionalSunPlan() {},
    createPolyCamera(state) { return { state, update(value) { Object.assign(state, value); } }; },
    createCubicSkyCameraOrientation() {
      return { scene: () => "matrix3d(1)", skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: [0, 0, 1] }),
        counterRotation() { return "matrix3d(1)"; }, billboardCounterRotation() {}, reset() {}, rotate() {}, snapshot() { return {}; },
      };
    },
    matchMedia: () => ({ matches: false }), MOBILE_VIEWPORT_QUERY: "mobile",
    createUnboundedMatrixDragControls: (options) => { callbacks.drag = options; return acquire("drag"); },
    createPreparedWheelZoomControls: (options) => { callbacks.wheel = options; return acquire("wheel"); },
    bindResponsiveOrbitPolicy: (options) => { callbacks.policy = options; return acquire("policy"); },
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
  return { create, callbacks, owners, stage, arguments: {
    onError(error) { throw error; },
    stage, inputSurface: stage, cameraElement: new Surface(), sceneElement: new Surface(),
    cubicSky: { root: { isConnected: true }, setOrientation() {} }, skyPlan: {},
    cameraPlan, objectId: "unit", requireSun: false,
    onPublish() { if (failure === "publish") throw new Error("publish failure"); },
  } };
}

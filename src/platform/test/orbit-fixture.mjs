import { createRetainedCubicSkyOrbit } from "../object-orbit.mts";

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

export function orbitFixture(failure, cleanupFailure = false, dependencies = {}) {
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
  const services = {
    HTMLElement: Surface,
    createPolyCamera(state) { return { state, update(value) { Object.assign(state, value); } }; },
    createCubicSkyCameraOrientation() {
      return { scene: () => "matrix3d(1)", sceneMatrix: () => "matrix3d(1)", skybox: () => ({ matrix: "matrix3d(1)", sunViewDirection: [0, 0, 1] }),
        counterRotation() { return "matrix3d(1)"; },  reset() {}, rotate() {}, snapshot() { return {}; },
      };
    },
    matchMedia: () => ({ matches: false }),
    createUnboundedMatrixDragControls: (options) => { callbacks.drag = options; return acquire("drag"); },
    createPreparedWheelZoomControls: (options) => { callbacks.wheel = options; return acquire("wheel"); },
    bindResponsiveOrbitPolicy: (options) => { callbacks.policy = options; return acquire("policy"); },
    selectPreparedResponsiveZoom() {
      if (failure === "fit") throw new Error("fit failure");
      return { zoom: 1, model: "unit", widthShare: 0.5 };
    },
    ...dependencies,
  };
  const create = options => createRetainedCubicSkyOrbit(options, services);
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

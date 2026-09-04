import assert from "node:assert/strict";
import test from "node:test";

import {
  createPreparedOrbitGuideInteraction,
  indexPreparedOrbitGuides,
  mountPreparedOrbitGuide,
  nearestPreparedOrbitDistanceSquared,
  projectPreparedOrbitConic,
} from "./orbit-guide-runtime.mjs";
import { preparedFixture } from "./orbit-guide-test-fixture.mjs";

test("indexes and mounts one stable prepared leaf per guide", () => {
  const plan = preparedFixture();
  const guideIndex = indexPreparedOrbitGuides(plan);
  const children = [];
  const container = { appendChild: (child) => children.push(child) };
  const binding = mountPreparedOrbitGuide({
    guideIndex,
    id: "luna",
    container,
    createLeaf: (leaf) => ({ leaf, className: "" }),
  });

  assert.equal(children.length, 1);
  assert.equal(children[0].className, "planet-orbit-guide");
  assert.equal(binding.id, "luna");
  assert.equal(binding.guideLeaf, children[0]);
  assert.equal(binding.orbitRadius, 100);
  assert.equal(Object.isFrozen(binding), true);
});

test("projects a prepared circle to an exact screen-space conic", () => {
  const output = new Float64Array(6);
  projectPreparedOrbitConic({
    binding: {
      orbitRadius: 100,
      planeMatrix: new IdentityMatrix(),
    },
    sceneSystemTransform: new IdentityMatrix(),
    cameraPerspective: 1_000,
    centerX: 500,
    centerY: 400,
    shellScale: 1,
    output,
  });

  assert.ok(nearestPreparedOrbitDistanceSquared(output, 600, 400) < 1e-18);
  assert.ok(nearestPreparedOrbitDistanceSquared(output, 500, 500) < 1e-18);
  assert.ok(nearestPreparedOrbitDistanceSquared(output, 500, 400) > 1_000);
});

test("owns pointer, touch, refresh, and cleanup lifecycle", () => {
  const plan = preparedFixture();
  const inputSurface = new EventTargetFixture();
  const windowTarget = new EventTargetFixture();
  const guideLeaf = { classList: new ClassListFixture() };
  const frameQueue = new FrameQueue();
  let inputHit = false;
  const interaction = createPreparedOrbitGuideInteraction({
    plan,
    bindings: [{
      id: "luna",
      guideLeaf,
      planeTransform: "",
      orbitRadius: 100,
    }],
    inputSurface,
    cameraElement: {
      style: { perspective: "1000px" },
      offsetWidth: 1_000,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1_000,
        height: 800,
      }),
    },
    sceneElement: { style: { transform: "none" } },
    systemTransform: "none",
    setGuideActive(binding, active) {
      binding.guideLeaf.classList.toggle("is-orbit-hovered", active);
    },
    setInputHit(active) {
      inputHit = active;
    },
    windowTarget,
    Matrix: IdentityMatrix,
    requestFrame: (callback) => frameQueue.request(callback),
    cancelFrame: (id) => frameQueue.cancel(id),
  });

  assert.equal(interaction.stats().projectionRefreshCount, 1);
  inputSurface.dispatch("pointermove", {
    clientX: 600,
    clientY: 400,
    pointerId: 1,
    pointerType: "mouse",
  });
  frameQueue.flush();
  assert.equal(guideLeaf.classList.has("is-orbit-hovered"), true);
  assert.equal(inputHit, true);
  assert.equal(interaction.stats().hoveredGuideId, "luna");

  inputSurface.dispatch("pointerleave", { pointerType: "mouse" });
  assert.equal(guideLeaf.classList.has("is-orbit-hovered"), false);
  assert.equal(inputHit, false);

  interaction.setEnabled(false);
  assert.equal(interaction.stats().hoveredGuideId, null);
  assert.equal(inputHit, false);
  inputSurface.dispatch("pointermove", {
    clientX: 600,
    clientY: 400,
    pointerId: 1,
    pointerType: "mouse",
  });
  frameQueue.flush();
  assert.equal(interaction.stats().hoveredGuideId, null);
  interaction.setEnabled(true);
  assert.equal(frameQueue.size, 0);

  inputSurface.dispatch("pointerdown", {
    clientX: 600,
    clientY: 400,
    isPrimary: true,
    pointerId: 9,
    pointerType: "touch",
    timeStamp: 0,
  });
  inputSurface.dispatch("pointerup", {
    clientX: 600,
    clientY: 400,
    pointerId: 9,
    pointerType: "touch",
    timeStamp: 100,
  });
  frameQueue.flush();
  assert.equal(interaction.stats().touchTapCheckCount, 1);
  assert.equal(interaction.stats().hoveredGuideId, "luna");

  interaction.interactionStart();
  assert.equal(interaction.stats().hoveredGuideId, null);
  interaction.interactionEnd();
  frameQueue.flush();
  assert.ok(interaction.stats().projectionRefreshCount >= 2);

  inputSurface.dispatch("pointermove", {
    clientX: 600,
    clientY: 400,
    pointerId: 1,
    pointerType: "mouse",
  });
  interaction.destroy();
  assert.equal(frameQueue.size, 0);
  assert.equal(guideLeaf.classList.has("is-orbit-hovered"), false);
  assert.equal(inputHit, false);
  assert.equal(inputSurface.listenerCount, 0);
  assert.equal(windowTarget.listenerCount, 0);
});

test("accepts an object-owned complete scene projection matrix", () => {
  const plan = preparedFixture();
  const inputSurface = new EventTargetFixture();
  const frameQueue = new FrameQueue();
  let projectionScale = 2;
  let projectionReadCount = 0;
  const interaction = createPreparedOrbitGuideInteraction({
    ...runtimeFixture(),
    plan,
    inputSurface,
    readSceneProjectionMatrix(Matrix, sceneElement) {
      assert.equal(Matrix, IdentityMatrix);
      assert.equal(sceneElement.style.scale, "object-owned");
      projectionReadCount += 1;
      return new ScaleMatrix(projectionScale);
    },
    sceneElement: {
      style: { transform: "none", scale: "object-owned" },
    },
    requestFrame: (callback) => frameQueue.request(callback),
    cancelFrame: (id) => frameQueue.cancel(id),
  });

  assert.equal(projectionReadCount, 1);
  inputSurface.dispatch("pointermove", {
    clientX: 700,
    clientY: 400,
    pointerId: 1,
    pointerType: "mouse",
  });
  frameQueue.flush();
  assert.equal(interaction.stats().hoveredGuideId, "luna");
  assert.equal(projectionReadCount, 1);

  inputSurface.dispatch("pointerleave", { pointerType: "mouse" });
  projectionScale = 3;
  interaction.refreshProjection();
  assert.equal(projectionReadCount, 2);
  inputSurface.dispatch("pointermove", {
    clientX: 800,
    clientY: 400,
    pointerId: 1,
    pointerType: "mouse",
  });
  frameQueue.flush();
  assert.equal(interaction.stats().hoveredGuideId, "luna");
  assert.equal(projectionReadCount, 2);
  interaction.destroy();
});

test("rejects an invalid object projection matrix", () => {
  assert.throws(() => createPreparedOrbitGuideInteraction({
    ...runtimeFixture(),
    plan: preparedFixture(),
    readSceneProjectionMatrix: () => ({ multiply() {} }),
  }), /scene projection matrix is incompatible/u);
});

test("rejects duplicate or drifted runtime bindings", () => {
  const plan = preparedFixture();
  const runtime = runtimeFixture();
  assert.throws(() => createPreparedOrbitGuideInteraction({
    ...runtime,
    plan: {
      ...plan,
      guideCount: 2,
      retainedLeafCount: 2,
      hitTest: { ...plan.hitTest, orbitTestsPerCallback: 2 },
      guides: [
        plan.guides[0],
        {
          ...plan.guides[0],
          id: "probe",
          displayOrbitRadius: 150,
          orbitRadius: 150,
        },
      ],
    },
    bindings: [runtime.bindings[0], runtime.bindings[0]],
  }), /binding drifted/u);
});

class IdentityMatrix {
  constructor() {
    this.m11 = 1;
    this.m12 = 0;
    this.m13 = 0;
    this.m14 = 0;
    this.m21 = 0;
    this.m22 = 1;
    this.m23 = 0;
    this.m24 = 0;
    this.m31 = 0;
    this.m32 = 0;
    this.m33 = 1;
    this.m34 = 0;
    this.m41 = 0;
    this.m42 = 0;
    this.m43 = 0;
    this.m44 = 1;
  }

  multiply() {
    return new IdentityMatrix();
  }
}

class ScaleMatrix extends IdentityMatrix {
  constructor(scale) {
    super();
    this.m11 = scale;
    this.m22 = scale;
    this.m33 = scale;
  }

  multiply() {
    return this;
  }
}

class EventTargetFixture {
  #listeners = new Map();

  addEventListener(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(type, event) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }

  get listenerCount() {
    return [...this.#listeners.values()]
      .reduce((total, listeners) => total + listeners.size, 0);
  }
}

class ClassListFixture {
  #names = new Set();

  toggle(name, active) {
    if (active) this.#names.add(name);
    else this.#names.delete(name);
  }

  has(name) {
    return this.#names.has(name);
  }
}

class FrameQueue {
  #frames = new Map();
  #nextId = 1;

  request(callback) {
    const id = this.#nextId;
    this.#nextId += 1;
    this.#frames.set(id, callback);
    return id;
  }

  cancel(id) {
    this.#frames.delete(id);
  }

  flush() {
    const frames = [...this.#frames.values()];
    this.#frames.clear();
    for (const callback of frames) callback(0);
  }

  get size() {
    return this.#frames.size;
  }
}

function runtimeFixture() {
  const inputSurface = new EventTargetFixture();
  return {
    bindings: [{
      id: "luna",
      guideLeaf: { classList: new ClassListFixture() },
      planeTransform: "",
      orbitRadius: 100,
    }],
    inputSurface,
    cameraElement: {
      style: { perspective: "1000px" },
      offsetWidth: 1_000,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1_000,
        height: 800,
      }),
    },
    sceneElement: { style: { transform: "none" } },
    systemTransform: "none",
    setGuideActive() {},
    setInputHit() {},
    windowTarget: new EventTargetFixture(),
    Matrix: IdentityMatrix,
    requestFrame: () => 1,
    cancelFrame() {},
  };
}

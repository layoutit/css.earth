import assert from "node:assert/strict";
import test from "node:test";

import {
  createPerspectiveDolly,
  isPerspectiveCameraPlan,
  levelOfDetailFor,
  orbitLineOpacity,
  planetarySystemOpacity,
  sunMarkerOpacity,
  validatePerspectiveCameraPlan,
} from "./perspective-dolly.mjs";
import { projectHeliocentricView } from "./heliocentric-view.mjs";
import PREPARED_MERCURY_SCENE from "../../src/planets/mercury/prepared/scene.json" with {type: "json"};

const levelOfDetail = Object.freeze({
  model: "silhouette-diameter-crossfade",
  billboardFadeStartDiscPixels: 20,
  billboardFullDiscPixels: 14,
  markerFadeStartDiscPixels: 8,
  markerFullDiscPixels: 4.5,
});

const plan = Object.freeze({
  projection: { model: "css-perspective-shared-with-sky", cssPerspective: "86.6cqw" },
  dolly: { model: "multiplicative-wheel-distance", wheelStepPerDelta: 0.0012,
    minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4 },
  orbitLineFade: { visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 },
  levelOfDetail,
  logicalBodyDiameter: 460, defaultZoom: 1.1, maximumZoom: 4, sceneScale: 0.022,
});

test("the three stages crossfade in order as the disc shrinks", () => {
  const stages = [40, 20, 17, 13, 10, 7, 5.5, 4.4, 3].map((diameter) =>
    levelOfDetailFor(levelOfDetail, diameter));
  assert.deepEqual(stages.map(({ stage }) => stage), [
    "geometry", "geometry", "crossfade", "billboard", "billboard", "billboard",
    "billboard", "marker", "marker",
  ]);
  // The finer stage stays painted until the coarser one is opaque: the
  // billboard is fully opaque before the marker starts, and the marker is
  // fully opaque only at the marker stage.
  for (const sample of stages) {
    assert.ok(sample.billboardOpacity >= 0 && sample.billboardOpacity <= 1);
    assert.ok(sample.markerOpacity >= 0 && sample.markerOpacity <= 1);
    if (sample.markerOpacity > 0) assert.equal(sample.billboardOpacity, 1);
    assert.equal(sample.stage === "marker", sample.markerOpacity === 1);
    assert.equal(sample.stage === "geometry", sample.billboardOpacity === 0);
  }
  assert.ok(Math.abs(stages[2].billboardOpacity - 0.5) < 1e-9);
  assert.deepEqual(stages.map(({ markerOpacity }) => Math.round(markerOpacity * 100) / 100),
    [0, 0, 0, 0, 0, 0.29, 0.71, 1, 1]);
});

test("the orbit line fades out as the disc fills the viewport", () => {
  const fade = plan.orbitLineFade;
  assert.equal(orbitLineOpacity(fade, 0.05), 1);
  assert.equal(orbitLineOpacity(fade, 0.12), 1);
  assert.ok(Math.abs(orbitLineOpacity(fade, 0.21) - 0.5) < 1e-9);
  assert.equal(orbitLineOpacity(fade, 0.3), 0);
  assert.equal(orbitLineOpacity(fade, 0.9), 0);
});

test("the perspective contract rejects drifted plans", () => {
  assert.equal(validatePerspectiveCameraPlan(plan), plan);
  assert.equal(isPerspectiveCameraPlan(plan), true);
  assert.equal(isPerspectiveCameraPlan({ ...plan, projection: undefined }), false);
  for (const drift of [
    { projection: { model: "scaled-camera" } },
    { dolly: { ...plan.dolly, wheelStepPerDelta: Number.NaN } },
    { levelOfDetail: { ...levelOfDetail, billboardFullDiscPixels: 21 } },
    { levelOfDetail: { ...levelOfDetail, markerFullDiscPixels: 0 } },
    { orbitLineFade: { visibleBelowDiscHeightShare: 0.3, hiddenAboveDiscHeightShare: 0.12 } },
  ]) {
    assert.throws(() => validatePerspectiveCameraPlan({ ...plan, ...drift }),
      /Perspective camera contract drifted/u);
  }
});

const planetarySystemFade = Object.freeze({
  hiddenBelowDistanceOverOrbitExtent: 1.5,
  visibleAboveDistanceOverOrbitExtent: 2.5,
});

test("the planetary system fades in with distance over the body's own orbit extent", () => {
  assert.equal(planetarySystemOpacity(planetarySystemFade, 1.5), 0);
  assert.equal(planetarySystemOpacity(planetarySystemFade, 1), 0);
  assert.ok(Math.abs(planetarySystemOpacity(planetarySystemFade, 2) - 0.5) < 1e-9);
  assert.equal(planetarySystemOpacity(planetarySystemFade, 2.5), 1);
  assert.equal(planetarySystemOpacity(planetarySystemFade, 3), 1);
});

const sunMarker = Object.freeze({ fadeStartSpritePixels: 16, fullSpritePixels: 8 });

test("the Sun marker floors in as its sprite falls below the marker's size", () => {
  assert.equal(sunMarkerOpacity(sunMarker, 16), 0);
  assert.equal(sunMarkerOpacity(sunMarker, 20), 0);
  assert.ok(Math.abs(sunMarkerOpacity(sunMarker, 12) - 0.5) < 1e-9);
  assert.equal(sunMarkerOpacity(sunMarker, 8), 1);
  assert.equal(sunMarkerOpacity(sunMarker, 4), 1);
  assert.equal(sunMarkerOpacity(sunMarker, undefined), 0);
  assert.equal(sunMarkerOpacity(sunMarker, Number.NaN), 0);
});

test("the perspective contract accepts the real Mercury camera plan and rejects its drifted system options", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.camera;
  assert.equal(validatePerspectiveCameraPlan(mercuryPlan), mercuryPlan);
  for (const drift of [
    { planetarySystem: { ...mercuryPlan.planetarySystem,
      visibleAboveDistanceOverOrbitExtent: mercuryPlan.planetarySystem.hiddenBelowDistanceOverOrbitExtent } },
    { sunMarker: { ...mercuryPlan.sunMarker,
      fadeStartSpritePixels: mercuryPlan.sunMarker.fullSpritePixels } },
    { dolly: { ...mercuryPlan.dolly, maximumDistanceOverSystemExtent: 0 } },
  ]) {
    assert.throws(() => validatePerspectiveCameraPlan({ ...mercuryPlan, ...drift }),
      /Perspective camera contract drifted/u);
  }
});

// A minimal fake DOM for `createPerspectiveDolly`'s own measurements: a
// camera root and a sky root that share one eye (zero principal offset, for
// arithmetic simplicity), plus a stage for the trackball. No fixture in the
// repo builds this shape for `createPerspectiveDolly` directly, so it is
// built here from the same `getBoundingClientRect`/`getComputedStyle`
// primitives `cubic-sky-runtime.test.mjs` fakes elsewhere in this package.
function fakeDom({ viewportWidth = 1440, viewportHeight = 900, focal = 1247 } = {}) {
  const computedStyles = new Map();
  const view = { getComputedStyle: (element) => computedStyles.get(element) };
  const makeElement = () => {
    const element = {
      style: {},
      ownerDocument: { defaultView: view },
      getBoundingClientRect: () => ({
        width: viewportWidth, height: viewportHeight, x: 0, y: 0, left: 0, top: 0,
      }),
    };
    computedStyles.set(element, {
      perspective: `${focal}px`,
      perspectiveOrigin: `${viewportWidth / 2}px ${viewportHeight / 2}px`,
    });
    return element;
  };
  return {
    cameraElement: makeElement(),
    skyElement: makeElement(),
    sceneElement: { style: {} },
    stage: { getBoundingClientRect: () => ({ width: viewportWidth, height: viewportHeight, left: 0, top: 0 }) },
  };
}

// The identity linear part of a CSS `matrix3d`, in the column-major layout
// `rotationFromMatrix3d` reads (`m11`.. `m33`).
const IDENTITY_MATRIX3D = Object.freeze({
  m11: 1, m21: 0, m31: 0,
  m12: 0, m22: 1, m32: 0,
  m13: 0, m23: 0, m33: 1,
});

// A `heliocentric` mount stand-in that records call order and projects
// through the real, already-tested `projectHeliocentricView`, so the dolly
// is exercised against genuine body/Sun/system geometry without mounting any
// DOM nodes of its own.
function heliocentricMock(plan) {
  const calls = [];
  let systemOpacity = 0;
  return {
    calls,
    heliocentric: {
      plan,
      sunRoot: { style: {} },
      setSystemOpacity(value) {
        calls.push(["setSystemOpacity", value]);
        systemOpacity = value;
      },
      setSunMarkerOpacity(value) {
        calls.push(["setSunMarkerOpacity", value]);
      },
      setOrbitOpacity() {},
      setMarkerOpacity() {},
      publish(options) {
        calls.push(["publish"]);
        return projectHeliocentricView(plan, { ...options, system: systemOpacity > 0 });
      },
    },
  };
}

test("the dolly reaches the whole system when the plan carries one", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const { heliocentric } = heliocentricMock(mercuryPlan);
  const dolly = createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() });
  assert.equal(dolly.stats().dolly.maximumDistance, 3 * mercuryPlan.system.maximumExtentUnits);
});

test("without a system-relative dolly bound the plan falls back to the orbit-relative one", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = {
    ...PREPARED_MERCURY_SCENE.camera,
    dolly: { ...PREPARED_MERCURY_SCENE.camera.dolly },
  };
  delete cameraPlan.dolly.maximumDistanceOverSystemExtent;
  const { heliocentric } = heliocentricMock(mercuryPlan);
  const dolly = createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() });
  assert.equal(dolly.stats().dolly.maximumDistance,
    4 * mercuryPlan.orbit.maximumExtentUnits);
});

test("a mounted view lacking the system opacity setters is rejected", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const heliocentric = {
    plan: mercuryPlan,
    sunRoot: { style: {} },
    setOrbitOpacity() {},
    setMarkerOpacity() {},
    publish: () => ({}),
  };
  assert.throws(
    () => createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() }),
    /Perspective dolly requires the mounted planetary system/u,
  );
});

test("publication sets the system opacity before publishing and the Sun marker opacity after", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const { heliocentric, calls } = heliocentricMock(mercuryPlan);
  const dolly = createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() });
  dolly.camera.update({ distance: dolly.stats().dolly.maximumDistance });
  dolly.publish(IDENTITY_MATRIX3D, "");
  assert.deepEqual(calls.map(([name]) => name),
    ["setSystemOpacity", "publish", "setSunMarkerOpacity"]);
});

test("the published system opacity is opaque at the system-fitting distance and hidden at the closest", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const { heliocentric } = heliocentricMock(mercuryPlan);
  const dolly = createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() });

  dolly.camera.update({ distance: 3 * mercuryPlan.system.maximumExtentUnits });
  const far = dolly.publish(IDENTITY_MATRIX3D, "");
  assert.equal(far.planetarySystem.opacity, 1);

  dolly.camera.update({ distance: dolly.stats().dolly.minimumDistance });
  const near = dolly.publish(IDENTITY_MATRIX3D, "");
  assert.equal(near.planetarySystem.opacity, 0);
});

test("the wheel's whole travel stays within the intended tens-of-notches range", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.heliocentricView;
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const { heliocentric } = heliocentricMock(mercuryPlan);
  const dolly = createPerspectiveDolly({ cameraPlan, heliocentric, ...fakeDom() });
  const { wheelNotchesEndToEnd } = dolly.stats().dolly;
  assert.ok(wheelNotchesEndToEnd > 20 && wheelNotchesEndToEnd < 40,
    `wheelNotchesEndToEnd ${wheelNotchesEndToEnd} is outside (20, 40)`);
});


test("a plan may opt into the tumble-only drag and the trackball carries it; other drag models are refused", () => {
  const plan = PREPARED_MERCURY_SCENE.camera;
  assert.equal(plan.drag.model, "screen-axis-tumble");
  assert.equal(validatePerspectiveCameraPlan(plan), plan);
  assert.throws(() => validatePerspectiveCameraPlan({ ...plan, drag: { model: "virtual-trackball" } }), TypeError);
  const { drag, ...withoutDrag } = plan;
  assert.equal(validatePerspectiveCameraPlan(withoutDrag), withoutDrag);
});

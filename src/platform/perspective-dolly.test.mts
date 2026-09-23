import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePreparedWorldCameraFrame } from "../renderers/css/dist/navigation.js";

import {
  createPerspectiveDolly,
  isPerspectiveCameraPlan,
  levelOfDetailFor,
  orbitLineOpacity,
  validatePerspectiveCameraPlan,
} from "./perspective-dolly.mts";
import PREPARED_MERCURY_SCENE from "../../src/objects/mercury/prepared/scene.json" with {type: "json"};

const levelOfDetail = Object.freeze({
  model: "silhouette-diameter-crossfade",
  billboardFadeStartDiscPixels: 20,
  billboardFullDiscPixels: 14,
  markerFadeStartDiscPixels: 8,
  markerFullDiscPixels: 4.5,
});

const plan = Object.freeze({
  ...PREPARED_MERCURY_SCENE.camera,
  drag: undefined,
  projection: { model: "css-perspective-shared-with-sky", cssPerspective: "86.6cqw" },
  dolly: { model: "multiplicative-wheel-distance", wheelStepPerDelta: 0.0012,
    minimumDistanceRadii: 1.2, maximumDistanceOverOrbitExtent: 4 },
  orbitLineFade: { visibleBelowDiscHeightShare: 0.12, hiddenAboveDiscHeightShare: 0.3 },
  levelOfDetail,
  logicalBodyDiameter: 460, defaultZoom: 1.1, maximumZoom: 4, sceneScale: 0.022,
});

// Mercury's prepared physical frame, with an authored extent standing in for the application's world context.
const mercuryFrame = parsePreparedWorldCameraFrame(PREPARED_MERCURY_SCENE.worldFrame);
assert.ok(mercuryFrame);
const worldContext = Object.freeze({
  frame: mercuryFrame,
  bodyRadiusUnits: mercuryFrame.bodyRadiusM / mercuryFrame.metersPerUnit,
  kilometersPerUnit: mercuryFrame.metersPerUnit / 1000,
  maximumExtentUnits: 1e7,
});

test("the two stages crossfade in order as the disc shrinks, drawing no billboard disc", () => {
  const stages = [40, 20, 17, 13, 10, 7, 5.5, 4.4, 3].map((diameter) =>
    levelOfDetailFor(levelOfDetail, diameter));
  // A resolving body goes from its marker straight to its mesh. No billboard
  // disc stands between them, so only the geometry and marker stages remain.
  assert.deepEqual(stages.map(({ stage }) => stage), [
    "geometry", "geometry", "geometry", "geometry", "geometry", "geometry",
    "geometry", "marker", "marker",
  ]);
  // The mesh stays painted until the marker is opaque, and the marker is
  // fully opaque only at the marker stage.
  for (const sample of stages) {
    assert.equal(sample.billboardOpacity, 0);
    assert.ok(sample.proxyOpacity >= 0 && sample.proxyOpacity <= 1);
    assert.ok(sample.markerOpacity >= 0 && sample.markerOpacity <= 1);
    // The prepared billboard band only times the selected navigation marker's
    // fade over the mesh, so it is complete well before the mesh hides.
    if (sample.markerOpacity > 0) assert.equal(sample.proxyOpacity, 1);
    assert.equal(sample.stage === "marker", sample.markerOpacity === 1);
    assert.equal(sample.stage === "geometry", sample.markerOpacity < 1);
  }
  assert.ok(Math.abs(stages[2].proxyOpacity - 0.5) < 1e-9);
  assert.deepEqual(stages.map(({ proxyOpacity }) => Math.round(proxyOpacity * 100) / 100),
    [0, 0, 0.5, 1, 1, 1, 1, 1, 1]);
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
    { dolly: { ...plan.dolly, maximumDistanceOverOrbitExtent: Number.NaN } },
    { levelOfDetail: { ...levelOfDetail, billboardFullDiscPixels: 21 } },
    { levelOfDetail: { ...levelOfDetail, markerFullDiscPixels: 0 } },
    { orbitLineFade: { visibleBelowDiscHeightShare: 0.3, hiddenAboveDiscHeightShare: 0.12 } },
  ]) {
    assert.throws(() => Reflect.apply(validatePerspectiveCameraPlan, undefined, [{ ...plan, ...drift }]),
      /Perspective camera contract drifted/u);
  }
});

test("the real Mercury camera plan carries no planetary system or Sun marker options", () => {
  const mercuryPlan = PREPARED_MERCURY_SCENE.camera;
  assert.equal(validatePerspectiveCameraPlan(mercuryPlan), mercuryPlan);
  for (const retired of ["planetarySystem", "sunMarker"]) assert.equal(retired in mercuryPlan, false, retired);
  assert.equal("maximumDistanceOverSystemExtent" in mercuryPlan.dolly, false);
});

// A minimal fake DOM for `createPerspectiveDolly`'s own measurements: a
// camera root and a sky root that share one eye (zero principal offset, for
// arithmetic simplicity), plus a stage for the trackball.
function fakeDom({ viewportWidth = 1440, viewportHeight = 900, focal = 1247 } = {}) {
  const computedStyles = new Map<object, {perspective: string; perspectiveOrigin: string}>();
  const view = { getComputedStyle: (element: object) => {
    const style = computedStyles.get(element); assert.ok(style); return style;
  } };
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
    // This controlled DOM adapter implements precisely the measurements used by the dolly.
    return element as unknown as HTMLElement;
  };
  return {
    cameraElement: makeElement(),
    viewport: { read: () => ({ bounds: { width: viewportWidth, height: viewportHeight, x: 0, y: 0, left: 0, top: 0 }, focalPixels: focal, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} },
    sceneElement: { style: {} } as HTMLElement,
    stage: { getBoundingClientRect: () => ({ width: viewportWidth, height: viewportHeight, left: 0, top: 0 }) } as HTMLElement,
  };
}

// The identity linear part of a CSS `matrix3d`, in the column-major layout
// `rotationFromMatrix3d` reads (`m11`.. `m33`).
const IDENTITY_MATRIX3D = Object.freeze({
  m11: 1, m21: 0, m31: 0,
  m12: 0, m22: 1, m32: 0,
  m13: 0, m23: 0, m33: 1,
});

test("the dolly's farthest distance is the world extent over its orbit-relative bound", () => {
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const { dolly: stats } = createPerspectiveDolly({ cameraPlan, worldContext, ...fakeDom() }).stats();
  assert.equal(stats.maximumDistance, cameraPlan.dolly.maximumDistanceOverOrbitExtent * worldContext.maximumExtentUnits);
  assert.ok(stats.minimumDistance >= cameraPlan.dolly.minimumDistanceRadii * worldContext.bodyRadiusUnits);
  assert.ok(stats.minimumDistance < stats.maximumDistance);
});

test("a missing world context or one whose units disagree with its prepared frame is refused", () => {
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  assert.throws(() => Reflect.apply(createPerspectiveDolly, undefined, [{ cameraPlan, worldContext: undefined, ...fakeDom() }]),
    /physical camera context/u);
  assert.throws(() => createPerspectiveDolly({ cameraPlan, ...fakeDom(),
    worldContext: { ...worldContext, kilometersPerUnit: worldContext.kilometersPerUnit * 2 } }), /units disagree/u);
});

test("publication reports the physical observer and the resolved body it frames", () => {
  const cameraPlan = PREPARED_MERCURY_SCENE.camera;
  const published: unknown[] = [];
  const dolly = createPerspectiveDolly({ cameraPlan, ...fakeDom(),
    worldContext: { ...worldContext, onWorldPublish: world => published.push(world) } });
  const result = dolly.publish(IDENTITY_MATRIX3D, "");
  assert.equal(published.length, 1);
  assert.ok(result.body && result.body.silhouetteDiameter > 0);
  assert.equal(result.levelOfDetail?.stage, "geometry");
  assert.equal(dolly.state().distanceRadii, dolly.camera.state.distance / worldContext.bodyRadiusUnits);
});

test("a plan may opt into the tumble-only drag and the trackball carries it; other drag models are refused", () => {
  const plan = PREPARED_MERCURY_SCENE.camera;
  assert.equal(plan.drag.model, "screen-axis-tumble");
  assert.equal(validatePerspectiveCameraPlan(plan), plan);
  assert.throws(() => validatePerspectiveCameraPlan({ ...plan, drag: { model: "virtual-trackball" } }), TypeError);
  const { drag, ...withoutDrag } = plan;
  assert.equal(validatePerspectiveCameraPlan(withoutDrag), withoutDrag);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  isPerspectiveCameraPlan,
  levelOfDetailFor,
  orbitLineOpacity,
  validatePerspectiveCameraPlan,
} from "./perspective-dolly.mjs";

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

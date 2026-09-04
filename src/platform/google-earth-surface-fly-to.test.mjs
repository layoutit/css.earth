import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_EARTH_SURFACE_FLY_TO,
  planGoogleEarthSurfaceFlyTo,
  sampleGoogleEarthSurfaceFlyTo,
} from "./google-earth-surface-fly-to.mjs";

const TRACKBALL = Object.freeze({
  centerX: 500,
  centerY: 400,
  radius: 250,
});

test("binds source facts and the native training fit", () => {
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.swoopOutThresholdDegrees, 12);
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.swoopOutZoomFactor, 0.002);
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds, 4500);
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.angularDurationMilliseconds, 2700);
  assert.equal(
    GOOGLE_EARTH_SURFACE_FLY_TO.zoomPrimaryDurationMilliseconds,
    3200,
  );
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.arrivalZoomMultiplier, 2.33);
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.angularResponse, 0.75);
  assert.equal(GOOGLE_EARTH_SURFACE_FLY_TO.wheelTargetResponse, 0.61);
  assert.match(GOOGLE_EARTH_SURFACE_FLY_TO.qualification, /NATIVE_TRAINING_FIT/u);
});

test("rejects double clicks outside the apparent planet disc", () => {
  assert.equal(planGoogleEarthSurfaceFlyTo({
    clientX: 751,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  }), null);
});

test("targets an off-centre surface point and clamps arrival zoom", () => {
  const plan = planGoogleEarthSurfaceFlyTo({
    clientX: 650,
    clientY: 475,
    trackball: TRACKBALL,
    currentZoom: 3,
    minimumZoom: 0.5,
    maximumZoom: 4,
  });
  assert.ok(plan);
  assert.ok(plan.pitchDeltaDegrees < 0);
  assert.ok(plan.yawDeltaDegrees < 0);
  assert.ok(plan.angularDistanceDegrees < plan.rawAngularDistanceDegrees);
  assert.equal(plan.targetZoom, 4);
  assert.equal(plan.swoopOut, true);
});

test("samples one smooth fly-to with exact camera and zoom endpoints", () => {
  const plan = planGoogleEarthSurfaceFlyTo({
    clientX: 650,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  });
  const start = sampleGoogleEarthSurfaceFlyTo(plan, 0);
  const early = sampleGoogleEarthSurfaceFlyTo(plan, 0.12);
  const middle = sampleGoogleEarthSurfaceFlyTo(plan, 0.5);
  const end = sampleGoogleEarthSurfaceFlyTo(plan, 1);
  assert.deepEqual(start, {
    pitchDeltaDegrees: 0,
    yawDeltaDegrees: 0,
    zoom: 1,
    complete: false,
  });
  assert.ok(early.zoom > plan.startZoom,
    "the native fit should begin its restrained zoom response");
  assert.ok(Math.abs(middle.yawDeltaDegrees) <
    Math.abs(end.yawDeltaDegrees));
  assert.equal(end.pitchDeltaDegrees, plan.pitchDeltaDegrees);
  assert.equal(end.yawDeltaDegrees, plan.yawDeltaDegrees);
  assert.equal(end.zoom, plan.targetZoom);
  assert.equal(end.complete, true);
});

test("near-centre double click zooms directly without a swoop out", () => {
  const plan = planGoogleEarthSurfaceFlyTo({
    clientX: 510,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  });
  assert.equal(plan.swoopOut, false);
  assert.ok(sampleGoogleEarthSurfaceFlyTo(plan, 0.2).zoom > 1);
});

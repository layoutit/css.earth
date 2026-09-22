import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  SURFACE_FLY_TO,
  planSurfaceFlyTo,
  sampleSurfaceFlyTo,
} from "./surface-fly-to.mts";

const TRACKBALL = Object.freeze({
  viewportWidth: 1000,
  centerX: 500,
  centerY: 400,
  radius: 250,
  surfaceRadius: 275,
  focalLength: 900,
  sceneMatrix: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ],
});

test("binds source facts and the native training fit", () => {
  assert.equal(SURFACE_FLY_TO.swoopOutThresholdDegrees, 12);
  assert.equal(SURFACE_FLY_TO.swoopOutZoomFactor, 0.002);
  assert.equal(
    SURFACE_FLY_TO.durationMilliseconds,
    3652.3984590021428,
  );
  assert.equal(
    SURFACE_FLY_TO.angularDurationMilliseconds,
    3652.3984590021428,
  );
  assert.equal(
    SURFACE_FLY_TO.zoomPrimaryDurationMilliseconds,
    3652.3984590021428,
  );
  assert.equal(
    SURFACE_FLY_TO.targetRangeRatio,
    0.25,
  );
  assert.equal(
    SURFACE_FLY_TO.angularResponse,
    1.0050401414502155,
  );
  assert.match(SURFACE_FLY_TO.qualification, /NATIVE_TRAINING_FIT/u);
});

test("rejects double clicks outside the apparent planet disc", () => {
  assert.equal(planSurfaceFlyTo({
    clientX: 751,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  }), null);
});

test("targets an off-centre surface point and clamps arrival zoom", () => {
  const plan = planSurfaceFlyTo({
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
  assert.ok(plan.angularDistanceDegrees > plan.rawAngularDistanceDegrees);
  assert.equal(plan.targetZoom, 4);
  assert.equal(plan.swoopOut, true);
});

test("samples one smooth fly-to with exact camera and zoom endpoints", () => {
  const plan = planSurfaceFlyTo({
    clientX: 650,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  });
  assert.ok(plan);
  const start = sampleSurfaceFlyTo(plan, 0);
  const early = sampleSurfaceFlyTo(plan, 0.12);
  const middle = sampleSurfaceFlyTo(plan, 0.5);
  const end = sampleSurfaceFlyTo(plan, 1);
  assert.deepEqual(start, {
    pitchDeltaDegrees: 0,
    yawDeltaDegrees: 0,
    rotation: [0, 0, 0, 1],
    zoom: 1,
    complete: false,
  });
  assert.ok(early.zoom > plan.startZoom,
    "the native fit should begin its restrained zoom response");
  assert.ok(Math.abs(middle.yawDeltaDegrees) <
    Math.abs(end.yawDeltaDegrees));
  assert.equal(end.pitchDeltaDegrees, plan.pitchDeltaDegrees);
  assert.equal(end.yawDeltaDegrees, plan.yawDeltaDegrees);
  assert.ok(Math.abs(Math.hypot(...end.rotation) - 1) < 1e-12);
  assert.notDeepEqual(end.rotation, start.rotation);
  assert.equal(end.zoom, plan.targetZoom);
  assert.equal(end.complete, true);
});

test("near-centre double click zooms directly without a swoop out", () => {
  const plan = planSurfaceFlyTo({
    clientX: 510,
    clientY: 400,
    trackball: TRACKBALL,
    currentZoom: 1,
    minimumZoom: 0.5,
    maximumZoom: 4,
  });
  assert.ok(plan);
  assert.equal(plan.swoopOut, false);
  assert.ok(Math.hypot(...plan.targetRotation.slice(0, 3)) < 0.02,
    "a centre target must preserve the current heading");
  assert.ok(sampleSurfaceFlyTo(plan, 0.2).zoom > 1);
});

test("reconstructs the measured spherical endpoint from the camera ray", () => {
  const plan = planSurfaceFlyTo({
    clientX: 603,
    clientY: 318,
    trackball: {
      viewportWidth: 1107,
      centerX: 553.5,
      centerY: 300,
      radius: 94.6864,
      surfaceRadius: 105.7711330955927,
      focalLength: 598.109864352,
      sceneMatrix: "matrix3d(0.8911556,0.4536879,0.0029641,0," +
        "-0.1736705,0.3350818,0.9260446,0,0.4191419,-0.8257646," +
        "0.3774024,0,0,0,0,1)",
    },
    currentZoom: 0.5146341463414634,
    minimumZoom: 0.42,
    maximumZoom: 4,
  });
  assert.ok(plan);
  const vectorLength = Math.hypot(...plan.targetRotation.slice(0, 3));
  const angle = 2 * Math.atan2(vectorLength, plan.targetRotation[3]) *
    180 / Math.PI;
  assert.ok(Math.abs(angle - 25.97977254759437) < 1e-9);
});

test("flight arrival uses one quarter of the clicked point range at different distances", () => {
  for (const [distance, nativeArrival] of [[4.236441135406494,1.8265275955200195],
    [4.242939472198486,1.828224539756775]]) {
    const focalLength = 600.1556396484375;
    const radius = focalLength / Math.sqrt(distance*distance-1);
    const plan = planSurfaceFlyTo({clientX:-40.5,clientY:43,
      trackball:{viewportWidth: focalLength * 2 / Math.sqrt(3),centerX:0,centerY:0,radius,surfaceRadius:radius,focalLength,
        sceneMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},
      currentZoom:1,minimumZoom:.1,maximumZoom:10});
    assert.ok(plan);
    assert.ok(Math.abs(plan.targetDistance-nativeArrival)<.00005);
  }
});

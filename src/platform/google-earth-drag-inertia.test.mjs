import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceGoogleEarthDragThrow,
  createGoogleEarthDragHistory,
  estimateGoogleEarthDragThrow,
  GOOGLE_EARTH_DRAG_INERTIA,
  googleEarthDirectAngularDegreesPerTrackballRadius,
  projectGoogleEarthTrackballDelta,
  recordGoogleEarthDragSample,
  resetGoogleEarthDragHistory,
} from "./google-earth-drag-inertia.mjs";

test("binds the Google Earth Pro trackball and throw constants", () => {
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.averagingFrameCount, 5);
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.historyCapacity, 16);
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.minimumThrowDisplacementPixels, 5);
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds, 100);
  assert.equal(
    GOOGLE_EARTH_DRAG_INERTIA.directAngularDegreesPerTrackballRadius,
    47.5,
  );
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.directPitchResponse, 1);
  assert.equal(
    googleEarthDirectAngularDegreesPerTrackballRadius(1.7793002915451894),
    40.81009111550928,
  );
  assert.equal(
    googleEarthDirectAngularDegreesPerTrackballRadius(1.0748129675810474),
    52.29766603391934,
  );
  assert.equal(googleEarthDirectAngularDegreesPerTrackballRadius(4), 40);
  assert.equal(googleEarthDirectAngularDegreesPerTrackballRadius(0.42), 52.5);
  assert.equal(
    GOOGLE_EARTH_DRAG_INERTIA.maximumPitchVelocityDegreesPerSecond,
    30,
  );
  assert.equal(
    GOOGLE_EARTH_DRAG_INERTIA.maximumYawVelocityDegreesPerSecond,
    90,
  );
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.rotationalDampingSeconds, 1.2);
  assert.equal(GOOGLE_EARTH_DRAG_INERTIA.stopVelocityRatio, 0.0033);
  assert.match(
    GOOGLE_EARTH_DRAG_INERTIA.sourceFunctions.directTrackballMove,
    /0x005d1d70/u,
  );
});

test("projects drag distance through the fitted apparent-disc response", () => {
  const center = projectGoogleEarthTrackballDelta({
    previousX: 500,
    previousY: 500,
    currentX: 550,
    currentY: 500,
    centerX: 500,
    centerY: 500,
    radius: 250,
  });
  const nearLimb = projectGoogleEarthTrackballDelta({
    previousX: 650,
    previousY: 500,
    currentX: 700,
    currentY: 500,
    centerX: 500,
    centerY: 500,
    radius: 250,
  });
  const zoomedIn = projectGoogleEarthTrackballDelta({
    previousX: 500,
    previousY: 500,
    currentX: 550,
    currentY: 500,
    centerX: 500,
    centerY: 500,
    radius: 500,
  });
  assert.ok(center.yawDegrees > 0);
  assert.equal(center.pitchDegrees, 0);
  assert.equal(nearLimb.yawDegrees, center.yawDegrees);
  assert.ok(zoomedIn.yawDegrees < center.yawDegrees);

  const diagonal = projectGoogleEarthTrackballDelta({
    previousX: 500,
    previousY: 500,
    currentX: 550,
    currentY: 550,
    centerX: 500,
    centerY: 500,
    radius: 250,
  });
  assert.ok(diagonal.pitchDegrees > 0);
  assert.ok(diagonal.yawDegrees > 0);
});

test("retains sixteen angular samples in fixed-capacity storage", () => {
  const history = createGoogleEarthDragHistory();
  const xStorage = history.x;
  for (let index = 0; index < 20; index += 1) {
    recordGoogleEarthDragSample(history, {
      x: index,
      y: -index,
      timestamp: index * 10,
      pitch: index * 0.5,
      yaw: index,
    });
  }
  assert.equal(history.length, 16);
  assert.equal(history.x, xStorage);
  assert.equal(history.next, 4);
  resetGoogleEarthDragHistory(history);
  assert.equal(history.length, 0);
  assert.equal(history.x, xStorage);
});

test("requires a fresh five-pixel release and averages angular motion", () => {
  const history = createGoogleEarthDragHistory();
  for (let index = 0; index < 8; index += 1) {
    recordGoogleEarthDragSample(history, {
      x: index * 10,
      y: index * -5,
      timestamp: index * (1000 / 60),
      pitch: index * -0.5,
      yaw: index,
    });
  }
  const latestTimestamp = 7 * (1000 / 60);
  const throwState = estimateGoogleEarthDragThrow({
    history,
    releaseTimestamp: latestTimestamp + 10,
  });
  assert.ok(throwState);
  assert.equal(throwState.averagingSampleCount, 6);
  assert.ok(Math.abs(throwState.yawDegreesPerMillisecond - 0.06) < 1e-12);
  assert.ok(Math.abs(throwState.pitchDegreesPerMillisecond + 0.03) < 1e-12);

  const belowGate = createGoogleEarthDragHistory();
  recordGoogleEarthDragSample(belowGate, {
    x: 0, y: 0, timestamp: 0, pitch: 0, yaw: 0,
  });
  recordGoogleEarthDragSample(belowGate, {
    x: 2, y: 1, timestamp: 16, pitch: 1, yaw: 1,
  });
  recordGoogleEarthDragSample(belowGate, {
    x: 3, y: 2, timestamp: 32, pitch: 2, yaw: 2,
  });
  assert.equal(estimateGoogleEarthDragThrow({
    history: belowGate,
    releaseTimestamp: 40,
  }), null);
  assert.equal(estimateGoogleEarthDragThrow({
    history,
    releaseTimestamp: latestTimestamp + 101,
  }), null);
});

test("caps launch velocity and applies the native frame-time decay", () => {
  const history = createGoogleEarthDragHistory();
  recordGoogleEarthDragSample(history, {
    x: 0, y: 0, timestamp: 0, pitch: 0, yaw: 0,
  });
  recordGoogleEarthDragSample(history, {
    x: 100, y: -100, timestamp: 1, pitch: -100, yaw: 100,
  });
  recordGoogleEarthDragSample(history, {
    x: 200, y: -200, timestamp: 2, pitch: -200, yaw: 200,
  });
  const throwState = estimateGoogleEarthDragThrow({
    history,
    releaseTimestamp: 2,
  });
  assert.equal(throwState.pitchDegreesPerMillisecond, -0.03);
  assert.equal(throwState.yawDegreesPerMillisecond, 0.09);

  const step = advanceGoogleEarthDragThrow({
    pitchDegreesPerMillisecond: -0.2,
    yawDegreesPerMillisecond: 0.1,
    initialSpeedDegreesPerMillisecond: Math.hypot(0.2, 0.1),
    elapsedMilliseconds: 20,
  });
  assert.ok(Math.abs(step.pitchDegreesPerMillisecond -
    -0.2 * (1 - 20 / 1200)) < 1e-12);
  assert.ok(Math.abs(step.pitchDeltaDegrees -
    step.pitchDegreesPerMillisecond * 20) < 1e-12);
  assert.equal(step.active, true);
});

test("stops only after velocity reaches 0.33 percent of launch", () => {
  const initial = 0.2;
  let velocity = initial;
  let active = true;
  let frames = 0;
  while (active && frames < 1000) {
    const step = advanceGoogleEarthDragThrow({
      pitchDegreesPerMillisecond: 0,
      yawDegreesPerMillisecond: velocity,
      initialSpeedDegreesPerMillisecond: initial,
      elapsedMilliseconds: 1000 / 60,
    });
    velocity = step.yawDegreesPerMillisecond;
    active = step.active;
    frames += 1;
  }
  assert.ok(frames >= 405 && frames <= 410, `unexpected frame count ${frames}`);
});

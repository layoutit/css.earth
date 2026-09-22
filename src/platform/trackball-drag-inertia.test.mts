import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { projectSphereDrag } from "@cssearth/engine";

import {
  advanceDragThrow,
  createDragHistory,
  estimateDragThrow as estimateThrow,
  TRACKBALL_DRAG_INERTIA,
  directAngularDegreesPerTrackballRadius,
  directPitchResponseForZoom,
  projectTrackballDelta,
  recordDragSample,
  resetDragHistory,
} from "./trackball-drag-inertia.mts";

const trackball = {centerX:346.5,centerY:300,radius:144.65263161811257,viewportWidth:693,surfaceRadius:144.65263161811257,
  focalLength:598.73636504};
const estimateDragThrow = (options: Omit<Parameters<typeof estimateThrow>[0], "trackball"> & { trackball?: typeof trackball }) => estimateThrow({trackball,...options});

function requiredThrow(...args: Parameters<typeof estimateDragThrow>) {
  const value = estimateDragThrow(...args); assert.ok(value, 'Expected a drag throw'); return value;
}

test("binds the reference trackball and throw constants", () => {
  assert.equal(TRACKBALL_DRAG_INERTIA.averagingFrameCount, 5);
  assert.equal(TRACKBALL_DRAG_INERTIA.historyCapacity, 16);
  assert.equal(TRACKBALL_DRAG_INERTIA.minimumThrowDisplacementPixels, 2.5);
  assert.equal(TRACKBALL_DRAG_INERTIA.releaseFreshnessMilliseconds, 100);
  assert.equal(
    TRACKBALL_DRAG_INERTIA.directAngularDegreesPerTrackballRadius,
    47.5,
  );
  assert.equal(
    TRACKBALL_DRAG_INERTIA.directPitchResponse,
    1,
  );
  assert.equal(
    TRACKBALL_DRAG_INERTIA.directPitchResponseEvidence
      .calibrationScenarios.length,
    2,
  );
  assert.equal(
    directPitchResponseForZoom(1.0748129675810474),
    1.2025381100738586,
  );
  assert.equal(
    directPitchResponseForZoom(1.7793002915451894),
    1.3504854183805297,
  );
  assert.ok(
    directPitchResponseForZoom(1.4599145299145297) >
      directPitchResponseForZoom(1.0748129675810474),
  );
  assert.equal(
    directAngularDegreesPerTrackballRadius(1.7793002915451894),
    40.81009111550928,
  );
  assert.equal(
    directAngularDegreesPerTrackballRadius(1.0748129675810474),
    52.29766603391934,
  );
  assert.equal(directAngularDegreesPerTrackballRadius(4), 40);
  assert.equal(directAngularDegreesPerTrackballRadius(0.42), 52.5);
  assert.equal(
    TRACKBALL_DRAG_INERTIA.maximumPitchVelocityDegreesPerSecond,
    30,
  );
  assert.equal(
    TRACKBALL_DRAG_INERTIA.maximumYawVelocityDegreesPerSecond,
    90,
  );
  assert.equal(TRACKBALL_DRAG_INERTIA.rotationalDampingSeconds, 1.2);
  assert.equal(TRACKBALL_DRAG_INERTIA.stopVelocityRatio, 0.0033);
  assert.match(
    TRACKBALL_DRAG_INERTIA.sourceFunctions.directTrackballMove,
    /0x005d1d70/u,
  );
});

test("projects drag distance through the fitted apparent-disc response", () => {
  const center = projectTrackballDelta({
    previousX: 500,
    previousY: 500,
    currentX: 550,
    currentY: 500,
    centerX: 500,
    centerY: 500,
    radius: 250,
  });
  const nearLimb = projectTrackballDelta({
    previousX: 650,
    previousY: 500,
    currentX: 700,
    currentY: 500,
    centerX: 500,
    centerY: 500,
    radius: 250,
  });
  const zoomedIn = projectTrackballDelta({
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

  const diagonal = projectTrackballDelta({
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
  assert.equal(
    diagonal.pitchDegrees * TRACKBALL_DRAG_INERTIA.directPitchResponse,
    diagonal.yawDegrees,
  );
});

test("retains sixteen angular samples in fixed-capacity storage", () => {
  const history = createDragHistory();
  const xStorage = history.x;
  for (let index = 0; index < 20; index += 1) {
    recordDragSample(history, {
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
  resetDragHistory(history);
  assert.equal(history.length, 0);
  assert.equal(history.x, xStorage);
});

test("requires a fresh release displacement change and averages angular motion", () => {
  const history = createDragHistory();
  for (let index = 0; index < 8; index += 1) {
    recordDragSample(history, {
      x: index * 10 + (index === 7 ? 6 : 0),
      y: index * -5,
      timestamp: index * (1000 / 60),
      pitch: index * -0.5,
      yaw: index,
    });
  }
  const latestTimestamp = 7 * (1000 / 60);
  const throwState = requiredThrow({
    history,
    releaseTimestamp: latestTimestamp + 10,
  });
  assert.ok(throwState);
  assert.equal(throwState.averagingSampleCount, 6);
  const averagingMilliseconds = 5 * (1000 / 60) + 10;
  assert.ok(Math.abs(
    throwState.yawDegreesPerMillisecond - 5 / averagingMilliseconds,
  ) < 1e-12);
  assert.ok(Math.abs(
    throwState.pitchDegreesPerMillisecond + 2.5 / averagingMilliseconds,
  ) < 1e-12);
  assert.ok(Math.abs(
    throwState.averagingMilliseconds - averagingMilliseconds,
  ) < 1e-12);

  const belowGate = createDragHistory();
  recordDragSample(belowGate, {
    x: 0, y: 0, timestamp: 0, pitch: 0, yaw: 0,
  });
  recordDragSample(belowGate, {
    x: 2, y: 1, timestamp: 16, pitch: 1, yaw: 1,
  });
  recordDragSample(belowGate, {
    x: 3, y: 2, timestamp: 32, pitch: 2, yaw: 2,
  });
  assert.equal(estimateDragThrow({
    history: belowGate,
    releaseTimestamp: 40,
  }), null);
  assert.equal(estimateDragThrow({
    history,
    releaseTimestamp: latestTimestamp + 101,
  }), null);
});

test("includes the final release pause in launch velocity", () => {
  const history = createDragHistory();
  for (let index = 0; index < 4; index += 1) {
    recordDragSample(history, {
      x: index * 12 + (index === 3 ? 6 : 0),
      y: 0,
      timestamp: index * 16,
      pitch: 0,
      yaw: index * 2,
    });
  }
  const immediate = estimateDragThrow({
    history,
    releaseTimestamp: 48,
  });
  const paused = estimateDragThrow({
    history,
    releaseTimestamp: 138,
  });
  assert.ok(immediate);
  assert.ok(paused);
  assert.equal(paused.averagingSampleCount, 3);
  assert.equal(paused.averagingMilliseconds, 122);
  assert.ok(
    paused.yawDegreesPerMillisecond <
      immediate.yawDegreesPerMillisecond / 2,
  );
});

test("caps launch velocity and applies the native frame-time decay", () => {
  const history = createDragHistory();
  recordDragSample(history, {
    x: 0, y: 0, timestamp: 0, pitch: 0, yaw: 0,
  });
  recordDragSample(history, {
    x: 100, y: -100, timestamp: 1, pitch: -100, yaw: 100,
  });
  recordDragSample(history, {
    x: 200, y: -200, timestamp: 2, pitch: -200, yaw: 200,
  });
  assert.equal(requiredThrow({
    history,
    releaseTimestamp: 2,
  }).averagingSampleCount, 3,
  "the native release can launch from a press and two movements");
  recordDragSample(history, {
    x: 450, y: -450, timestamp: 3, pitch: -450, yaw: 450,
  });
  const throwState = requiredThrow({
    history,
    releaseTimestamp: 3,
  });
  assert.equal(throwState.pitchDegreesPerMillisecond, -0.03);
  assert.equal(throwState.yawDegreesPerMillisecond, 0.09);

  const step = advanceDragThrow({
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
    const step = advanceDragThrow({
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

test("release projects averaged pointer velocity at the endpoint after ring wrap", () => {
  const history = createDragHistory();
  const storage = history.x;
  for (let i = 0; i < 24; i++) {
    recordDragSample(history, {
      x: 200 + i * 3 + (i === 23 ? 6 : 0), y: 50 + i * 3, timestamp: i * 40,
      pitch: i * 0.25, yaw: i * 0.5,
    });
  }
  const launch = requiredThrow({ history, releaseTimestamp: 925 });
  const frameMilliseconds = 1000 / 60;
  const intervals = launch.averagingSampleCount - 1;
  const rawExpected = projectSphereDrag({previousX:275,previousY:119,
    currentX:275+(intervals*3+6)/launch.averagingMilliseconds*frameMilliseconds,
    currentY:119+intervals*3/launch.averagingMilliseconds*frameMilliseconds,
    ...trackball,radius:trackball.surfaceRadius});
  const expected = rawExpected;
  const sine = Math.hypot(...expected.slice(0,3));
  const scale = 2*Math.atan2(sine,expected[3])/sine/frameMilliseconds;
  assert.deepEqual(launch.launchRotation,expected);
  expected.slice(0,3).forEach((v,i)=>assert.ok(Math.abs(launch.angularVelocity[i]-v*scale)<1e-12));
  const offAxis = { ...trackball, opticalCenterX:trackball.centerX-25,
    opticalCenterY:trackball.centerY+40 };
  const shifted = estimateDragThrow({ history, trackball:offAxis, releaseTimestamp:925 }); assert.ok(shifted);
  const shiftedExpected = projectSphereDrag({ previousX:275, previousY:119,
    currentX:275+(intervals*3+6)/launch.averagingMilliseconds*frameMilliseconds,
    currentY:119+intervals*3/launch.averagingMilliseconds*frameMilliseconds,
    ...offAxis, radius:offAxis.surfaceRadius });
  assert.deepEqual(shifted.launchRotation,shiftedExpected);
  assert.notDeepEqual(shifted.angularVelocity,launch.angularVelocity);
  assert.ok(Math.abs(Math.hypot(...shifted.angularVelocity)-Math.hypot(...launch.angularVelocity))<1e-12);
  assert.equal(shifted.averagingMilliseconds,launch.averagingMilliseconds);
  assert.equal(history.x, storage);
  assert.equal(storage.length, 16);
  assert.equal(estimateDragThrow({ history, releaseTimestamp: 1021 }), null);
  resetDragHistory(history);
  assert.equal(history.x, storage);
  assert.equal(estimateDragThrow({ history, releaseTimestamp: 925 }), null);
});

test("legacy control velocity caps do not rescale the physical trackball throw", () => {
  const launches = [];
  for (const controlScale of [1,100]) {
    const history = createDragHistory();
    for (let i=0;i<4;i++) recordDragSample(history,{
      x:300+i*10+(i===3?6:0),y:280+i*10,timestamp:i*10,
      pitch:i*controlScale,yaw:i*controlScale,
    });
    launches.push(requiredThrow({history,releaseTimestamp:30}));
  }
  assert.deepEqual(launches[0].angularVelocity,launches[1].angularVelocity);
  assert.ok(Math.hypot(...launches[0].angularVelocity)>0);
});

test("constant pointer steps do not throw, including after ring wrap", () => {
  for (const count of [4, 13, 40]) {
    const history = createDragHistory();
    for (let i = 0; i < count; i++) recordDragSample(history, {
      x: 261 + i * 4.5, y: 288 + i * 1.2,
      timestamp: i * 25, pitch: i, yaw: i * 2,
    });
    assert.equal(estimateDragThrow({
      history, releaseTimestamp: (count - 1) * 25 + 15,
    }), null);
  }
});

test("accelerating release uses the change from two movement samples earlier", () => {
  for (const finalStep of [6.99, 7, 9.5]) {
    const history = createDragHistory();
    let x = 261;
    for (let i = 0; i < 13; i++) {
      if (i > 0) x += i === 12 ? finalStep : 4.5;
      recordDragSample(history, {
        x, y: 288, timestamp: i * 25, pitch: 0, yaw: i,
      });
    }
    assert.equal(estimateDragThrow({
      history, releaseTimestamp: 315,
    }) !== null, finalStep >= 7);
  }
});

test("a reversal with a four-pixel release change still coasts", () => {
  const history = createDragHistory();
  const deltas = [[0,0],[5,2],[5,1],[5,2],[5,1],[5,2],[5,1],
    [-10,2],[-10,1],[-10,2],[-10,1],[-10,5],[-10,5]];
  let x=575,y=290;
  for (const [i,[dx,dy]] of deltas.entries()) {
    x+=dx;y+=dy;
    recordDragSample(history,{x,y,timestamp:i*38,pitch:y-290,yaw:x-575});
  }
  const launch=estimateDragThrow({history,releaseTimestamp:12*38+15,
    frameMilliseconds:38});
  assert.ok(launch);
  assert.ok(launch.angularVelocity[1]<0);
});

test("release distinguishes equal adjacent steps from the two-step history comparison", () => {
  // The reference release reads the newest movement and the movement two
  // slots earlier. These cases distinguish that rule from adjacent deltas.
  for (const padding of [0, 20]) {
    for (const [steps, shouldCoast] of [[[10, 20, 20], true], [[10, 20, 10], false]] as const) {
      const history = createDragHistory();
      let x = 260;
      recordDragSample(history, { x, y:300, timestamp:0, pitch:0, yaw:0 });
      for (const [index, step] of [...Array.from({length:padding},()=>1), ...steps].entries()) {
        x += step;
        recordDragSample(history, {
          x, y:300, timestamp:(index + 1) * 20, pitch:0, yaw:x - 260,
        });
      }
      assert.equal(estimateDragThrow({ history,
        releaseTimestamp:(padding + steps.length) * 20 + 1 }) !== null, shouldCoast);
    }
  }
});

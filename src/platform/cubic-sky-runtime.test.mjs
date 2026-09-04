import assert from "node:assert/strict";
import test from "node:test";

import {
  measureRetainedPlanetTrackball,
  measureRetainedPlanetFlyToDisc,
  retainedPlanetUniformScale,
} from "./cubic-sky-runtime.mjs";

test("parses only positive retained camera scales", () => {
  assert.equal(retainedPlanetUniformScale("1.25"), 1.25);
  assert.equal(retainedPlanetUniformScale("1.25 0.75"), 0.75);
  assert.equal(retainedPlanetUniformScale("none"), null);
  assert.equal(retainedPlanetUniformScale("invalid"), null);
});

test("retains the separately fitted fly-to target envelope", () => {
  const stage = {
    getBoundingClientRect: () => ({ width: 1411, height: 959 }),
  };
  const cameraElement = {
    getBoundingClientRect: () => ({
      left: 145,
      right: 1265,
      top: -423.5,
      bottom: 1221.5,
      width: 1120,
      height: 1645,
    }),
  };
  assert.deepEqual(measureRetainedPlanetFlyToDisc({
    stage,
    cameraElement,
    logicalBodyDiameter: 460,
  }), {
    centerX: 705,
    centerY: 399,
    radius: 182.56555634301915,
  });
});

test("measures the planet trackball independently of screen roll", () => {
  const stage = {
    getBoundingClientRect: () => ({ width: 1411, height: 959 }),
  };
  const boundsByRoll = [
    { left: 145, right: 1265, top: -423.5, bottom: 1221.5 },
    { left: -498.5, right: 1908.5, top: -668, bottom: 1466 },
    { left: 257.5, right: 1152.5, top: -230, bottom: 1028 },
  ];
  const measurements = boundsByRoll.map((bounds) => {
    const cameraElement = {
      ownerDocument: {
        defaultView: {
          getComputedStyle: () => ({ scale: "1.16792" }),
        },
      },
      getBoundingClientRect: () => ({
        ...bounds,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      }),
    };
    return measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: 460,
    });
  });
  const expected = {
    centerX: 705,
    centerY: 399,
    radius: 268.6216,
  };
  assert.deepEqual(measurements, [expected, expected, expected]);
});

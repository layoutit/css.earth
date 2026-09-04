import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarsNativeCaptureKml,
  GOOGLE_EARTH_PRO_MARS_ORACLE,
  GOOGLE_EARTH_PRO_MARS_POSES,
} from "../tools/oracle/google-earth-pro/profile.mjs";
import {
  GOOGLE_EARTH_PRO_APPLE_EVENT_API,
  GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH,
} from "../tools/oracle/google-earth-pro/api-contract.mjs";
import { parseViewInfo } from
  "../tools/oracle/google-earth-pro/controller.mjs";

test("Mars Google Earth Pro oracle binds the corrected native renderer facts", () => {
  const oracle = GOOGLE_EARTH_PRO_MARS_ORACLE;
  assert.equal(oracle.mode.databasePrefix, "mars");
  assert.equal(oracle.mode.customAtmosphereState, true);
  assert.equal(oracle.mode.customAtmosphereColor, true);
  assert.equal(oracle.marsBodyRecord.parent, "sun");
  assert.equal(oracle.marsBodyRecord.orbitalPeriodDays, 686.98);
  assert.equal(
    oracle.marsBodyRecord.orbitalElements.eccentricity,
    0.093405,
  );
  assert.equal(oracle.renderer.stars.drawCount, 5_000);
  assert.equal(oracle.renderer.stars.liveResources.catalogueBuffer.bytes, 160_000);
  assert.deepEqual(
    oracle.renderer.camera.liveSaveImageProjection.viewport,
    [0, 0, 2093, 1295],
  );
  assert.equal(
    oracle.renderer.camera.granularBodyFrameContract.sampleCount,
    201,
  );
  assert.ok(
    oracle.renderer.camera.granularBodyFrameContract
      .maximumAngularResidualDegrees < 0.000003,
  );
  assert.ok(
    oracle.renderer.stars.granularProjection
      .maximumReconstructedMvpElementResidual < 0.0002,
  );
  assert.equal(oracle.renderer.sun.independentFromStarfieldPlane, true);
  assert.deepEqual(
    oracle.renderer.sun.liveDefaultBillboard.dimensions,
    [128, 128],
  );
  assert.ok(
    oracle.renderer.sun.granularPlacement
      .maximumVisibleCenterReplayResidualPixels < 0.25,
  );
  assert.ok(Math.abs(
    oracle.renderer.sun.granularPlacement.centerDistanceOverFar -
      0.939566,
  ) < 0.000001);
  assert.equal(oracle.renderer.atmosphere.marsAltitudeKm, 50);
  assert.deepEqual(oracle.capture.nativeContentSize, {
    width: 2092,
    height: 1295,
  });
  assert.equal(
    oracle.capture.headlessExecution.interactiveAquaSessionAllowed,
    false,
  );
  assert.equal(
    oracle.capture.headlessExecution.currentSessionBackgroundProcessAllowed,
    true,
  );
});

test("Mars native sweep stresses latitude, longitude, oblique tilt, and zoom", () => {
  assert.equal(GOOGLE_EARTH_PRO_MARS_POSES.length, 56);
  assert.equal(
    new Set(GOOGLE_EARTH_PRO_MARS_POSES.map(({ id }) => id)).size,
    GOOGLE_EARTH_PRO_MARS_POSES.length,
  );
  assert.deepEqual(
    [...new Set(GOOGLE_EARTH_PRO_MARS_POSES.map((pose) =>
      pose.nativeCamera.latitude))].sort((left, right) => left - right),
    [-60, -35, -30, 0, 30, 35, 60],
  );
  assert.deepEqual(
    [...new Set(GOOGLE_EARTH_PRO_MARS_POSES.map((pose) =>
      pose.nativeCamera.rangeMeters))].sort((left, right) => left - right),
    [4_200_000, 7_800_000, 13_500_000],
  );
  assert.ok(GOOGLE_EARTH_PRO_MARS_POSES.some((pose) =>
    pose.nativeCamera.tilt === 35 && pose.nativeCamera.heading !== 0));
});

test("Mars component scoring is normalized and the KML covers every pose", () => {
  const weight = Object.values(
    GOOGLE_EARTH_PRO_MARS_ORACLE.componentWeights,
  ).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(weight - 1) < Number.EPSILON * 8);
  const kml = createMarsNativeCaptureKml();
  assert.equal(
    [...kml.matchAll(/<Placemark>/gu)].length,
    GOOGLE_EARTH_PRO_MARS_POSES.length,
  );
  assert.match(kml, /<range>4200000<\/range>/u);
  assert.match(kml, /<tilt>35<\/tilt>/u);
});

test("Mars oracle binds the complete recovered Apple-event surface", () => {
  assert.equal(GOOGLE_EARTH_PRO_APPLE_EVENT_API.installedHandlerCount, 7);
  assert.equal(GOOGLE_EARTH_PRO_APPLE_EVENT_API.hiddenAppleEventHandlersFound, 0);
  assert.deepEqual(
    GOOGLE_EARTH_PRO_APPLE_EVENT_API.commands.setViewInfo
      .observedLimits.speed,
    [0, 10],
  );
  assert.equal(
    GOOGLE_EARTH_PRO_APPLE_EVENT_API.commands.saveScreenShot
      .actualDirectParameterType,
    "TEXT path",
  );
  assert.equal(
    GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.patches[0].expectedHex,
    "0f4fd8",
  );
  assert.equal(
    GOOGLE_EARTH_PRO_MARS_ORACLE_PATCH.patches[0].replacementHex,
    "909090",
  );
});

test("Mars oracle parses Google Earth's Apple-event view record", () => {
  assert.deepEqual(
    parseViewInfo(
      "latitude:4.25, longitude:-7.5, distance:8.3E+6, tilt:35.0, azimuth:16.5",
    ),
    {
      latitude: 4.25,
      longitude: -7.5,
      distance: 8.3e6,
      tilt: 35,
      azimuth: 16.5,
    },
  );
});

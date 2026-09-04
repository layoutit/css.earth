import assert from "node:assert/strict";
import test from "node:test";

import { PNG } from "pngjs";

import {
  analyzeScenePng,
  compareStarfieldFeatures,
  compareSunPresentations,
} from "../tools/oracle/image-analysis.mjs";
import {
  GOOGLE_MAPS_VENUS_URL,
  deriveBrowserCamera,
  intersectsSceneClip,
  ORACLE_CAMERA_MODEL,
  ORACLE_COMPONENT_WEIGHTS,
  ORACLE_DEFAULT_BROWSER_CAMERA,
  ORACLE_EXPLICIT_CAMERA_REGISTRATION,
  ORACLE_LENS,
  ORACLE_POSES,
  ORACLE_QUALIFICATION,
  ORACLE_SCENE_CENTER,
  ORACLE_SCENE_CLIP,
  parseGoogleCameraUrl,
} from "../tools/oracle/profile.mjs";

test("Venus oracle pins the canonical Google Maps URL and settled poses", () => {
  assert.equal(GOOGLE_MAPS_VENUS_URL,
    "https://www.google.com/maps/space/venus/");
  assert.deepEqual(ORACLE_POSES.map(({ id }) => id), [
    "default",
    "orbit-right-1",
    "orbit-right-2",
    "orbit-right-3",
    "orbit-right-4",
    "orbit-right-5",
    "orbit-right-6",
    "orbit-right-3-up",
    "orbit-right-3-down",
    "orbit-right-1-zoom-in",
    "orbit-right-1-zoom-in-2",
  ]);
  assert.equal(ORACLE_CAMERA_MODEL.browser,
    "full-matrix3d-pitch-yaw-zoom");
  assert.equal(ORACLE_CAMERA_MODEL.mapping,
    "settled-google-geodetic-delta-plus-explicit-heading-registration-with-prepared-zoom-bounds");
  assert.equal(ORACLE_LENS, "clouds");
  for (const pose of ORACLE_POSES) {
    assert.equal("browserCamera" in pose, false,
      "a proper oracle must not carry visually guessed local cameras");
    assert.ok(pose.googleActions.every(({ id, count }) =>
      typeof id === "string" && Number.isSafeInteger(count) && count > 0));
    assert.equal(pose.mappingQualification,
      "SOURCE_DERIVED_SETTLED_GOOGLE_URL");
    assert.ok(pose.endpointContract);
  }
  assert.deepEqual(ORACLE_POSES.find(({ id }) => id === "orbit-right-6")
    .googleActions, [{ id: "pan-right", count: 6 }]);
  assert.deepEqual(ORACLE_POSES.find(({ id }) => id === "orbit-right-3-up")
    .googleActions, [
      { id: "pan-right", count: 3 },
      { id: "pan-up", count: 1 },
    ]);
  assert.deepEqual(Object.keys(ORACLE_COMPONENT_WEIGHTS), [
    "starfield",
    "sun",
  ]);
  assert.equal(Object.values(ORACLE_COMPONENT_WEIGHTS)
    .reduce((sum, weight) => sum + weight, 0), 1);
  assert.equal(ORACLE_QUALIFICATION.sourceParity, "INVALID");
  assert.equal(ORACLE_QUALIFICATION.scientificLightingFidelity, "UNPROVEN");
});

test("local cameras derive only from settled Google geodetic endpoints", () => {
  const baseline = {
    latitude: 0,
    longitude: -58.4515826,
    range: 22_963_938,
    rangeUnit: "m",
    tilt: null,
    heading: null,
  };
  assert.deepEqual(deriveBrowserCamera(baseline, baseline),
    ORACLE_DEFAULT_BROWSER_CAMERA);
  const mapped = deriveBrowserCamera({
    ...baseline,
    latitude: 10,
    longitude: 56.4626037,
    range: 11_481_969,
  }, baseline);
  assert.ok(Math.abs(mapped.controlPitch -
    (ORACLE_DEFAULT_BROWSER_CAMERA.controlPitch - 10)) < 1e-9);
  assert.ok(Math.abs(mapped.controlYaw - 114.9141863) < 1e-7);
  assert.ok(Math.abs(mapped.zoom - 2.2) < 1e-9);
  assert.throws(() => deriveBrowserCamera({
    ...baseline,
    rangeUnit: "a",
    tilt: 60,
  }, baseline), /not a flat metric Google Venus endpoint/u);

  const explicitBaseline = {
    ...baseline,
    tilt: 0,
    heading: 0,
  };
  const explicitMapped = deriveBrowserCamera({
    ...explicitBaseline,
    latitude: 15,
    longitude: 50,
  }, explicitBaseline);
  assert.equal(explicitMapped.controlPitch,
    ORACLE_DEFAULT_BROWSER_CAMERA.controlPitch - 15);
  assert.ok(Math.abs(explicitMapped.controlYaw -
    (shortestTestAngleDelta(50, explicitBaseline.longitude) +
      ORACLE_EXPLICIT_CAMERA_REGISTRATION.longitudePhaseDegrees)) < 1e-9);
  assert.throws(() => deriveBrowserCamera({
    ...explicitBaseline,
    heading: null,
  }, explicitBaseline), /not a flat metric Google Venus endpoint/u);
});

test("Google Maps camera state is parsed from settled endpoint URLs", () => {
  assert.deepEqual(parseGoogleCameraUrl(
    "https://www.google.com/maps/space/venus/" +
    "@17.8,-86.5,19638519a,60y,270h/data=!3m1!1e3",
  ), {
    latitude: 17.8,
    longitude: -86.5,
    range: 19638519,
    rangeUnit: "a",
    tilt: 60,
    heading: 270,
  });
  assert.deepEqual(parseGoogleCameraUrl(GOOGLE_MAPS_VENUS_URL), {
    latitude: null,
    longitude: null,
    range: null,
    rangeUnit: null,
    tilt: null,
    heading: null,
  });
});

test("scene crop excludes UI boxes on its boundaries", () => {
  assert.equal(intersectsSceneClip({ x: 0, y: 300, width: 24, height: 40 }), false);
  assert.equal(intersectsSceneClip({ x: 984, y: 300, width: 80, height: 80 }), false);
  assert.equal(intersectsSceneClip({ x: 600, y: 680, width: 100, height: 30 }), false);
  assert.equal(intersectsSceneClip({ x: 600, y: 300, width: 10, height: 10 }), true);
});

test("scene analysis isolates starfield and Sun evidence", () => {
  const first = syntheticScene({ shadowRight: true, shadowLevel: 18 });
  const second = syntheticScene({ shadowRight: false, shadowLevel: 18 });
  const analysis = analyzeScenePng(first);
  const secondAnalysis = analyzeScenePng(second);
  assert.ok(analysis.background.brightPixelRatio > 0);
  assert.equal(analysis.sun.state, "absent");
  const starfieldComparison = compareStarfieldFeatures(
    first,
    second,
    analysis,
    secondAnalysis,
  );
  assert.equal(starfieldComparison.qualified, true);
  assert.ok(starfieldComparison.score > 0.95,
    "planet lighting changes must not contaminate the starfield score");

  const sunAnalysis = analyzeScenePng(syntheticScene({
    shadowRight: true,
    shadowLevel: 18,
    sun: { x: 850, y: 100 },
  }));
  assert.equal(sunAnalysis.sun.state, "visible");
  assert.ok(sunAnalysis.sun.pixelCount >= 100);

  const clippedSunAnalysis = analyzeScenePng(syntheticScene({
    shadowRight: true,
    shadowLevel: 18,
    sun: { x: 0, y: 170 },
  }));
  assert.equal(clippedSunAnalysis.sun.state, "clipped");
  assert.equal(compareSunPresentations(
    sunAnalysis.sun,
    clippedSunAnalysis.sun,
    { maximumCentroidDeltaPixels: 20 },
  ).score, 0);

  const absentSunComparison = compareSunPresentations(
    analysis.sun,
    secondAnalysis.sun,
  );
  assert.equal(absentSunComparison.qualified, true);
  assert.equal(absentSunComparison.eligible, false);
  assert.equal(absentSunComparison.score, null,
    "two absent Suns must not fabricate 100 percent appearance coverage");
});

function syntheticScene({
  shadowRight,
  shadowLevel,
  sun = null,
}) {
  const png = new PNG({
    width: ORACLE_SCENE_CLIP.width,
    height: ORACLE_SCENE_CLIP.height,
  });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index + 3] = 255;
  }
  const radius = 140;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const distance = Math.hypot(
        x - ORACLE_SCENE_CENTER.x,
        y - ORACLE_SCENE_CENTER.y,
      );
      if (distance > radius) continue;
      const index = (y * png.width + x) * 4;
      const shadow = shadowRight === null
        ? false
        : shadowRight
          ? x > ORACLE_SCENE_CENTER.x + 20
          : x < ORACLE_SCENE_CENTER.x - 20;
      png.data[index] = shadow
        ? shadowLevel
        : 210;
      png.data[index + 1] = shadow
        ? shadowLevel * 0.7
        : 160;
      png.data[index + 2] = shadow
        ? shadowLevel * 0.35
        : 60;
    }
  }
  for (let star = 0; star < 180; star += 1) {
    const x = 24 + (star % 30) * 31;
    const y = 24 + Math.floor(star / 30) * 91;
    const index = (y * png.width + x) * 4;
    png.data[index] = 160;
    png.data[index + 1] = 160;
    png.data[index + 2] = 160;
  }
  for (let y = 90; y < 96; y += 1) {
    for (let x = 900; x < 906; x += 1) {
      const index = (y * png.width + x) * 4;
      png.data[index] = 180;
      png.data[index + 1] = 100;
      png.data[index + 2] = 24;
    }
  }
  if (sun) {
    for (let y = sun.y - 10; y < sun.y + 10; y += 1) {
      for (let x = sun.x - 10; x < sun.x + 10; x += 1) {
        const index = (y * png.width + x) * 4;
        png.data[index] = 255;
        png.data[index + 1] = 245;
        png.data[index + 2] = 210;
      }
    }
  }
  return PNG.sync.write(png);
}

function shortestTestAngleDelta(value, origin) {
  return ((value - origin + 540) % 360) - 180;
}

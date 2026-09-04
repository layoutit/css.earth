import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_MARS_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_MARS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import {
  MARS_MATERIAL_CONTENT_SCALE,
  MARS_MATERIAL_COVERAGE_SCALE,
  MARS_MATERIAL_OUTER_RADIUS,
  MARS_SURFACE_REFERENCE_COLOR,
  applyMarsLinearLight,
  measurePublishedMarsAtmosphereReference,
  prepareMarsMaterialFrame,
} from "../tools/prepare-atmosphere.mjs";

test("derives Mars illumination from checked PSG and OpenSpace sources", () => {
  assert.equal(PREPARED_MARS_LIGHTING.schema, "cssmars-prepared-lighting@5");
  assert.equal(PREPARED_MARS_LIGHTING.frameCount, 256);
  assert.equal(PREPARED_MARS_LIGHTING.presentationFrameSize, 512);
  assert.deepEqual(PREPARED_MARS_LIGHTING.preparedPixelDensities, [1, 2]);
  assert.deepEqual(
    PREPARED_MARS_LIGHTING.sourceWorldLightDirection,
    [-0.487135, 0.238606, 0.840099],
  );
  assert.deepEqual(PREPARED_MARS_LIGHTING.worldLightDirection,
    PREPARED_MARS_SKY_SUN.localDirection);
  assert.deepEqual(PREPARED_MARS_LIGHTING.initialViewLightDirection,
    viewSunDirectionToPreparedLightDirection(
      PREPARED_MARS_SKY_SUN.referenceViewDirection,
    ));
  assert.equal(
    PREPARED_MARS_LIGHTING.cameraContract,
    "google-earth-pro-view-x-up-y-forward-minus-z-to-material-x-down-y-front-plus-z",
  );
  assert.ok(PREPARED_MARS_LIGHTING.defaultFrame >= 250,
    "the default visible Sun must prepare a predominantly full phase");
  assert.deepEqual(PREPARED_MARS_LIGHTING.illuminationGeometry, {
    source: "NASA PSG pinned Mars configuration",
    sourcePath: "source/atmosphere/psg-mars-20260829.cfg",
    solarLongitudeDegrees: 160,
    solarLatitudeDegrees: -6.96,
    observerLongitudeDegrees: 189.39,
    observerLatitudeDegrees: 7.88,
    phaseAngleDegrees: 32.849424,
    defaultScenePitchDegrees: 18,
    poleFrame: "north-up-aligned",
    runtimeEphemeris: false,
  });
  assert.equal(PREPARED_MARS_LIGHTING.outerRadius, MARS_MATERIAL_OUTER_RADIUS);
  assert.ok(Math.abs(MARS_MATERIAL_OUTER_RADIUS - 243.410924) < 1e-6);
  assert.equal(
    PREPARED_MARS_LIGHTING.atmosphere.openSpace.atmosphereRadiusRatio,
    1.022734976,
  );
  assert.equal(
    PREPARED_MARS_LIGHTING.atmosphere.openSpace.mie.anisotropy,
    0.85,
  );
  assert.equal(PREPARED_MARS_LIGHTING.atmosphere.runtimeRasterization, false);
});

test("fits every Sun phase to one prepared oblate mesh silhouette", () => {
  assert.deepEqual(PREPARED_MARS_LIGHTING.projection, {
    model: "prepared-oblate-ellipsoid-fixed-camera-projection",
    presentationPitchDegrees: 40,
    phaseStateCount: 256,
    presentationScale: MARS_MATERIAL_COVERAGE_SCALE,
    materialScale: MARS_MATERIAL_CONTENT_SCALE,
    meshCoverage: {
      model: "prepared-analytic-oblate-ellipsoid-proportional-overscan",
      coverageScale: MARS_MATERIAL_COVERAGE_SCALE,
      materialScale: MARS_MATERIAL_CONTENT_SCALE,
      rimFill: "prepared-source-calibrated-opaque-limb-fill",
      sourcePixelBleed: 0,
      supersampling: 4,
      alphaClamp: true,
      runtimeWork: false,
    },
    samples: PREPARED_MARS_LIGHTING.projection.samples,
    screenshotDerived: false,
    runtimeGeometry: false,
    runtimeRasterization: false,
  });
  assert.deepEqual(
    PREPARED_MARS_LIGHTING.projection.samples.map(
      ({ frameIndex }) => frameIndex,
    ),
    [0, PREPARED_MARS_LIGHTING.defaultFrame, 255],
  );
  assert.ok(PREPARED_MARS_LIGHTING.projection.samples.every(
    ({ pitchDegrees }) => pitchDegrees === 40,
  ));
  assert.equal(
    PREPARED_MARS_LIGHTING.atmosphere.externalHalo,
    "prepared-analytic-oblate-silhouette-overscan",
  );

  const frames = [0, 18, 65].map((pitchDegrees) =>
    prepareMarsMaterialFrame(pitchDegrees, 1));
  assert.equal(new Set(frames.map(({ silhouetteCoverage }) =>
    createHash("sha256").update(silhouetteCoverage).digest("hex"))).size, 3,
  "camera elevation must prepare three distinct projected mesh silhouettes");
  for (const frame of frames) {
    for (let pixel = 0; pixel < frame.silhouetteCoverage.length; pixel += 1) {
      const materialAlpha = frame.data[pixel * 4 + 3];
      const silhouetteCoverage = frame.silhouetteCoverage[pixel];
      assert.ok(materialAlpha <= silhouetteCoverage,
        "prepared material alpha must be clamped to analytic coverage");
    }
  }
});

test("uses measured Hubble limb color and linear-light shadow transport", async () => {
  const reference = await measurePublishedMarsAtmosphereReference();
  assert.deepEqual(reference.limbMeanRgb8, [95, 117, 144]);
  assert.deepEqual(reference.interiorMeanRgb8, [119, 120, 112]);
  assert.equal(reference.exteriorMaximumRgb8, 16);
  assert.equal(reference.limbChromaticDifference, 0.156102);
  assert.deepEqual(PREPARED_MARS_LIGHTING.atmosphere.sourceReference, reference);
  assert.deepEqual(PREPARED_MARS_LIGHTING.atmosphere.color, [95, 117, 144]);
  assert.deepEqual(MARS_SURFACE_REFERENCE_COLOR, [119, 120, 112]);
  assert.deepEqual(PREPARED_MARS_LIGHTING.shadow, {
    model:
      "prepared-directional-sun-phase-with-psg-qualified-openspace-lambert-terminator",
    source:
      "Google Earth Pro measured Sun direction, NASA PSG qualification, and OpenSpace RenderableGlobe lighting model",
    ambientFloor: 0.05,
    terminatorSmoothstep: [0, 0.1],
    displayTransfer: "sRGB IEC 61966-2-1",
    referenceChannel: 160,
    linearLight: true,
    fixedCelestialDirection: true,
    runtimeLightingMath: false,
  });
  assert.equal(applyMarsLinearLight(160, 1), 160);
  assert.equal(applyMarsLinearLight(160, 0.05), 36);
  assert.notEqual(applyMarsLinearLight(160, 0.5), 80,
    "lighting must not multiply encoded sRGB channels directly");
});

test("pins both bounded density banks to their exact runtime bytes", async () => {
  for (const density of [1, 2]) {
    const bank = PREPARED_MARS_LIGHTING.banks[String(density)];
    assert.equal(bank.schema, "cssmars-prepared-lighting-bank@1");
    assert.equal(bank.preparedPixelDensity, density);
    assert.equal(bank.frameSize, 512 * density);
    assert.equal(bank.rows.length, 256);
    assert.equal(bank.presentations.length, 256);
    assert.equal(bank.transport.framesPerRow, 1);
    assert.equal(bank.transport.encoding, "webp-q75-alpha-q100");
    assert.equal(bank.transport.rowCount, 256);
    assert.deepEqual(bank.transport.initialWarmRows, [
      Math.max(0, PREPARED_MARS_LIGHTING.defaultFrame - 1),
      PREPARED_MARS_LIGHTING.defaultFrame,
      Math.min(255, PREPARED_MARS_LIGHTING.defaultFrame + 1),
    ]);
    assert.ok(bank.transport.maximumDecodedWorkingSetBytes <= 13_000_000,
      `DPR ${density} decoded working set must stay below Saturn's accepted bound`);
    let totalBytes = 0;
    for (const row of bank.rows) {
      assert.equal(row.encoding, "webp-q75-alpha-q100");
      const bytes = await readFile(new URL(
        `../../../../public${row.url}`,
        import.meta.url,
      ));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, row.width);
      assert.equal(metadata.height, row.height);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), row.sha256);
      assert.equal(bytes.byteLength, row.bytes);
      totalBytes += bytes.byteLength;
    }
    assert.equal(totalBytes, bank.totalBytes);
    assert.deepEqual(
      bank.presentations.map(({ frameIndex }) => frameIndex),
      Array.from({ length: 256 }, (_, index) => index),
    );
  }
});

test("prepares the shared unbounded camera and responsive framing contract", () => {
  assert.equal(PREPARED_MARS_CAMERA.schema, "cssmars-prepared-camera@2");
  assert.equal(PREPARED_MARS_CAMERA.minimumControlPitchDegrees, 0);
  assert.equal(PREPARED_MARS_CAMERA.maximumControlPitchDegrees, 89);
  assert.equal(PREPARED_MARS_CAMERA.initialScenePitchDegrees, 40);
  assert.equal(PREPARED_MARS_CAMERA.defaultControlYawDegrees, -105);
  assert.equal(PREPARED_MARS_CAMERA.cameraModel, "accumulated-matrix3d");
  assert.equal(PREPARED_MARS_CAMERA.minimumZoom, 0.42);
  assert.equal(PREPARED_MARS_CAMERA.maximumZoom, 4);
  assert.equal(PREPARED_MARS_CAMERA.defaultZoom, 1.1);
  assert.equal(PREPARED_MARS_CAMERA.logicalBodyDiameter, 460);
  assert.equal(PREPARED_MARS_CAMERA.horizontalOrbit, true);
  assert.equal(PREPARED_MARS_CAMERA.pitchBounded, false);
  assert.equal(PREPARED_MARS_CAMERA.yawBounded, false);
  assert.equal(PREPARED_MARS_CAMERA.runtimeMatrixFormatting, true);
  assert.equal(PREPARED_MARS_CAMERA.responsiveFit.model,
    "continuous-aspect-smoothstep");
  assert.equal(PREPARED_MARS_CAMERA.materialDepthContract.depthBias, 1.3);
  assert.match(PREPARED_MARS_CAMERA.materialDepthContract.planeTransform,
    /^matrix3d\(.+\)$/u);
  assert.equal(PREPARED_MARS_CAMERA.materialDepthContract.runtimeGeometry,
    false);
});

test("keeps unattended playback on compositor animations", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /createPolyOrbitControls/);
  assert.match(client, /createCubicSkyCameraOrientation/);
  assert.match(client, /createUnboundedMatrixDragControls/);
  assert.match(client, /createRowShardCache/);
  assert.match(client, /materialCache\.presentation\(frame\)/);
  assert.match(client, /mounted\.materialLeaf\.style\.backgroundPosition/);
  assert.doesNotMatch(client, /materialLeaves|\.style\.opacity/);
  assert.doesNotMatch(client, /setInterval|setTimeout|DOMMatrix|canvas|getContext/);
  assert.doesNotMatch(css,
    /clip-path|mask:|filter:|linear-gradient|radial-gradient|mix-blend-mode/);
  assert.match(css, /html\[data-playing="true"\] \.mars-body/);
});

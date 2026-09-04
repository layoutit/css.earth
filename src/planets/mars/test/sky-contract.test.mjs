import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_MARS_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_MARS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_MARS_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";

test("transports the measured Google Earth camera through the licensed cube", () => {
  assert.equal(PREPARED_MARS_STARFIELD.faces.length, 6);
  assert.equal(PREPARED_MARS_STARFIELD.source,
    "ESO eso0932a all-sky panorama");
  assert.equal(PREPARED_MARS_STARFIELD.sourceLicense, "CC-BY-4.0");
  assert.equal(PREPARED_MARS_STARFIELD.sun, undefined);
  assert.deepEqual(PREPARED_MARS_STARFIELD.projection, {
    axis: "horizontal",
    horizontalFovDegrees: 59.999999639646695,
    focalLengthOverViewportWidth: 0.8660254100737903,
    cssPerspective: "86.60254100737903cqw",
    runtimeProjection: false,
  });
  assert.equal(PREPARED_MARS_STARFIELD.cameraPitchResponse, -1);
  assert.equal(PREPARED_MARS_STARFIELD.cameraZoomResponse, 0);
  assert.deepEqual(PREPARED_MARS_STARFIELD.pointSourcePresentation, {
    model: "prepared-diffuse-photograph-plus-compact-point-sources",
    selectedCount: 5000,
    logicalPointFootprintPixels: 1,
    nativeOraclePointSizePixels: 4.5,
    source: "Google Earth Pro Mars fixed-size catalogue draw contract",
    sourcePath: "source/sky/google-earth-pro-contract.json",
    positionSource:
      "licensed ESO photographic local maxima; no Google catalogue bytes",
    runtimePointRendering: false,
    qualification:
      "native fixed-size catalogue behavior collapsed into the prepared " +
      "cubemap; point positions and colors remain ESO-derived",
  });
  assert.equal(
    PREPARED_MARS_STARFIELD.photographicSeparation.standardDiffuseGain,
    0.68,
  );
  assert.equal(
    PREPARED_MARS_STARFIELD.photographicSeparation.standardDetailGain,
    0.4,
  );
  assert.equal(
    PREPARED_MARS_STARFIELD.oracleCameraContract.qualification,
    "201 native headless samples; licensed ESO pixels replace Google sky bytes",
  );
  assert.equal(PREPARED_MARS_CAMERA.oracleContract.sampleCount, 201);
  assert.equal(
    PREPARED_MARS_CAMERA.oracleContract.orientation
      .maximumAngularResidualDegrees,
    0.000002561320938754782,
  );
});

test("prepares a separate clean-room Sun without Google image bytes", async () => {
  assert.equal(PREPARED_MARS_SKY_SUN.billboard, true);
  assert.equal(PREPARED_MARS_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_MARS_SKY_SUN.asset.googlePixelsRedistributed, false);
  assert.equal(PREPARED_MARS_SKY_SUN.asset.sourcePixels,
    "repository-authored-clean-room-raster");
  assert.equal(PREPARED_MARS_SKY_SUN.projection.fixedAngularSize, true);
  const expectedReferenceViewDirection =
    [-0.22665800735781813, 0.13368726790267432, -0.9647558562150849];
  for (const [index, expected] of expectedReferenceViewDirection.entries()) {
    assert.ok(Math.abs(
      PREPARED_MARS_SKY_SUN.referenceViewDirection[index] - expected,
    ) < 1e-15);
  }
  assert.equal(PREPARED_MARS_SKY_SUN.defaultCameraBinding.nativeSampleId,
    "longitude-orbit-5deg-047");
  assert.deepEqual(
    PREPARED_MARS_SKY_SUN.appearance.analyticRadialFit,
    {
      model: "opaque-core-generalized-exponential-falloff",
      coreRadiusPixels: 18.9,
      falloffScalePixels: 17.8,
      falloffExponent: 1.36,
      redProfileSumSquaredResidual: 0.0010404800442828858,
      qualification:
        "Least-squares fit to annular red-channel means from the bound native " +
        "128 by 128 Sun texture; fitted values only, no source pixels.",
    },
  );
  assert.ok(Math.abs(
    PREPARED_MARS_SKY_SUN.projection.apparentViewportWidthShare -
      0.017944518258800286,
  ) < 1e-15);
  assert.ok(Math.abs(
    PREPARED_MARS_SKY_SUN.distanceScaling
      .physicalDiskViewportWidthShare - 0.00529924054830196,
  ) < 1e-15);
  for (const density of [1, 2]) {
    const descriptor = PREPARED_MARS_SKY_SUN.asset[`density${density}`];
    const bytes = await readFile(new URL(
      `../../../../public${descriptor.url}`,
      import.meta.url,
    ));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 128 * density);
    assert.equal(metadata.height, 128 * density);
    assert.equal(bytes.byteLength, descriptor.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),
      descriptor.sha256);
  }
});

test("keeps Sun projection on retained transform and visibility updates", async () => {
  const [runtime, client, css] = await Promise.all([
    readFile(new URL(
      "../../../platform/directional-sun-runtime.mjs",
      import.meta.url,
    ), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /document\.createElement\("s"\)/u);
  assert.match(runtime, /root\.style\.left/u);
  assert.match(runtime, /root\.style\.top/u);
  assert.match(runtime, /root\.hidden/u);
  assert.match(client, /mountRetainedDirectionalSun/u);
  assert.match(client, /mounted\.skySun\.setViewDirection/u);
  assert.doesNotMatch(client, /google-maps-sun\.png|mw1\.google\.com/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
});

test("maps the native view basis to the prepared material basis", () => {
  const light = viewSunDirectionToPreparedLightDirection(
    PREPARED_MARS_SKY_SUN.referenceViewDirection,
  );
  assert.deepEqual(light, [
    PREPARED_MARS_SKY_SUN.referenceViewDirection[0],
    -PREPARED_MARS_SKY_SUN.referenceViewDirection[1],
    -PREPARED_MARS_SKY_SUN.referenceViewDirection[2],
  ]);
  assert.ok(light[2] > 0.96,
    "the visible default Sun must prepare a predominantly full phase");
});

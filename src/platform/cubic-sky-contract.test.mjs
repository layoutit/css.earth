import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREPARED_EARTH_STARFIELD } from
  "../planets/earth/runtime/preparedStarfield.mjs";
import { PREPARED_JUPITER_STARFIELD } from
  "../planets/jupiter/runtime/preparedStarfield.mjs";
import { PREPARED_MARS_STARFIELD } from
  "../planets/mars/runtime/preparedStarfield.mjs";
import { PREPARED_MERCURY_STARFIELD } from
  "../planets/mercury/runtime/preparedStarfield.mjs";
import { PREPARED_NEPTUNE_STARFIELD } from
  "../planets/neptune/runtime/preparedStarfield.mjs";
import { PREPARED_SATURN_STARFIELD } from
  "../planets/saturn/runtime/preparedStarfield.mjs";
import { PREPARED_SUN_STARFIELD } from
  "../planets/sun/runtime/preparedStarfield.mjs";
import { PREPARED_URANUS_STARFIELD } from
  "../planets/uranus/runtime/preparedStarfield.mjs";
import { PREPARED_VENUS_STARFIELD } from
  "../planets/venus/runtime/preparedStarfield.mjs";
import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_FACE_IDS,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
  CUBIC_SKY_STANDARD,
  PREPARED_CUBIC_SKY_SCHEMA,
  PREPARED_CUBIC_SKY_SUN_SCHEMA,
  createCubicSkySunPresentation,
  projectDirectionToCubemapFace,
  validatePreparedCubicSky,
} from "./cubic-sky-contract.mjs";

const OBJECT_SKIES = Object.freeze({
  sun: PREPARED_SUN_STARFIELD,
  mercury: PREPARED_MERCURY_STARFIELD,
  venus: PREPARED_VENUS_STARFIELD,
  earth: PREPARED_EARTH_STARFIELD,
  mars: PREPARED_MARS_STARFIELD,
  jupiter: PREPARED_JUPITER_STARFIELD,
  saturn: PREPARED_SATURN_STARFIELD,
  uranus: PREPARED_URANUS_STARFIELD,
  neptune: PREPARED_NEPTUNE_STARFIELD,
});

test("defines one reusable retained cubic-sky contract", () => {
  const presentation = createCubicSkySunPresentation();
  const plan = {
    schema: PREPARED_CUBIC_SKY_SCHEMA,
    standard: CUBIC_SKY_STANDARD.schema,
    runtimeRasterization: false,
    orientation: "camera-rotation-only-no-translation-or-parallax",
    cameraPitchResponse: CUBIC_SKY_STANDARD.cameraPitchResponse,
    cameraZoomResponse: CUBIC_SKY_STANDARD.cameraZoomResponse,
    presentationPitchOffsetDegrees:
      CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees,
    presentationYawOffsetDegrees:
      CUBIC_SKY_STANDARD.presentationYawOffsetDegrees,
    faces: CUBIC_SKY_FACE_IDS.map((id) => ({
      id,
      url: `/${id}-standard.webp`,
      url2x: `/${id}-standard@2x.webp`,
      highContrastUrl: `/${id}.webp`,
      highContrastUrl2x: `/${id}@2x.webp`,
    })),
    sun: {
      schema: PREPARED_CUBIC_SKY_SUN_SCHEMA,
      ...presentation,
      billboard: false,
      bakedIntoStarfield: true,
      runtimeRasterization: false,
    },
  };
  assert.equal(validatePreparedCubicSky(plan), plan);
  assert.deepEqual(projectDirectionToCubemapFace(
    presentation.localDirection,
  ).face, "front");
  assert.ok(presentation.initialViewDirection[2] > 0.8);
  assert.equal(CUBIC_SKY_STANDARD.standardPresentation.saturation, 0.42);
  assert.equal(CUBIC_SKY_STANDARD.standardPresentation.gain, 0.7);
  assert.throws(() => validatePreparedCubicSky({
    ...plan,
    faces: plan.faces.map(({ highContrastUrl, ...face }) => face),
  }), /incompatible/u);
});

test("rejects a cube with no prepared Sun binding", () => {
  const selfLuminousPlan = {
    schema: PREPARED_CUBIC_SKY_SCHEMA,
    standard: CUBIC_SKY_STANDARD.schema,
    runtimeRasterization: false,
    orientation: "camera-rotation-only-no-translation-or-parallax",
    cameraPitchResponse: -1.7,
    cameraZoomResponse: 0.12,
    presentationPitchOffsetDegrees: -20,
    presentationYawOffsetDegrees: 66,
    faces: CUBIC_SKY_FACE_IDS.map((id) => ({
      id,
      url: `${id}-standard`,
      url2x: `${id}-standard@2x`,
      highContrastUrl: id,
      highContrastUrl2x: `${id}@2x`,
    })),
  };
  assert.equal(
    validatePreparedCubicSky(selfLuminousPlan, { requireSun: false }),
    selfLuminousPlan,
  );
  assert.throws(
    () => validatePreparedCubicSky(selfLuminousPlan),
    /incompatible/u,
  );
  assert.throws(() => validatePreparedCubicSky({
    ...selfLuminousPlan,
    sun: { bakedIntoStarfield: false },
  }), /incompatible/u);
});

test("all object packages use the compact Mars-derived cubic-sky standard", () => {
  for (const [objectId, plan] of Object.entries(OBJECT_SKIES)) {
    assert.equal(validatePreparedCubicSky(plan, { requireSun: false }), plan,
      objectId);
    assert.equal("sun" in plan, false, objectId);
    assert.equal(plan.cameraPitchResponse,
      CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.rotationResponse, objectId);
    assert.equal(plan.cameraZoomResponse,
      CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.zoomResponse, objectId);
    assert.ok(Math.abs(
      plan.projection.horizontalFovDegrees -
        CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees,
    ) < 1e-6, objectId);
    assert.equal(plan.pointSourcePresentation.selectedCount,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.drawCount, objectId);
    assert.equal(plan.pointSourcePresentation.logicalPointFootprintPixels,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.logicalPointFootprintPixels,
      objectId);
    assert.equal(plan.photographicSeparation.standardDiffuseGain,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.backgroundDiffuseGain,
      objectId);
    assert.equal(plan.photographicSeparation.standardDetailGain,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.backgroundDetailGain,
      objectId);
  }
});

test("keeps the retained cube and directional Sun in one generic stylesheet", async () => {
  const css = await readFile(new URL("./cubic-sky.css", import.meta.url),
    "utf8");
  assert.match(css, /\.planet-cubic-sky\s*\{/u);
  assert.match(css,
    /background-image:\s*var\(--planet-cubic-sky-standard-image\)/u);
  assert.match(css,
    /body\[data-sky-contrast="high"\] \.planet-cubic-sky-face/u);
  assert.match(css, /\.planet-directional-sun\s*\{/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
});

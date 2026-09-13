import { requireRecord, requireFiniteNumber } from '../../tools/source-values.mts';
import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { sky: PREPARED_EARTH_STARFIELD } = requireRecord(await loadObjectTestDefinition('earth'));
const { sky: PREPARED_JUPITER_STARFIELD } = requireRecord(await loadObjectTestDefinition('jupiter'));
const { sky: PREPARED_MARS_STARFIELD } = requireRecord(await loadObjectTestDefinition('mars'));
import PREPARED_MERCURY_STARFIELD from "../../src/planets/mercury/prepared/sky.json" with {type: "json"};
const { sky: PREPARED_NEPTUNE_STARFIELD } = requireRecord(await loadObjectTestDefinition('neptune'));
const { sky: PREPARED_SATURN_STARFIELD } = requireRecord(await loadObjectTestDefinition('saturn'));
const { sky: PREPARED_SUN_STARFIELD } = requireRecord(await loadObjectTestDefinition('sun'));
const { sky: PREPARED_URANUS_STARFIELD } = requireRecord(await loadObjectTestDefinition('uranus'));
import PREPARED_VENUS_STARFIELD from "../../src/planets/venus/prepared/sky.json" with {type: "json"};
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
} from "./cubic-sky-contract.mts";

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
      url: `/${id}-standard@2x.webp`,
      highContrastUrl: `/${id}@2x.webp`,
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
      url: `${id}-standard@2x`,
      highContrastUrl: `${id}@2x`,
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
    const data = requireRecord(plan);
    const projection = requireRecord(data.projection);
    const points = requireRecord(data.pointSourcePresentation);
    const photographic = requireRecord(data.photographicSeparation);
    assert.equal("sun" in data, false, objectId);
    assert.equal(data.cameraPitchResponse,
      CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.rotationResponse, objectId);
    assert.equal(data.cameraZoomResponse,
      CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.zoomResponse, objectId);
    assert.ok(Math.abs(
      requireFiniteNumber(projection.horizontalFovDegrees) -
        CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees,
    ) < 1e-6, objectId);
    assert.equal(points.selectedCount,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.drawCount, objectId);
    assert.equal(points.logicalPointFootprintPixels,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.logicalPointFootprintPixels,
      objectId);
    assert.equal(photographic.standardDiffuseGain,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.backgroundDiffuseGain,
      objectId);
    assert.equal(photographic.standardDetailGain,
      CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD.backgroundDetailGain,
      objectId);
  }
});

test("catalogue star transport rejects missing or invalid prepared raw radii", () => {
  const plan = PREPARED_MERCURY_STARFIELD;
  assert.equal(validatePreparedCubicSky(plan, { requireSun: false }), plan);
  for (const rawRadiusPx of [undefined, Number.NaN, Infinity, -1]) {
    const retained = plan.catalogueStars.retained.map((star, index) =>
      index === 0 ? { ...star, rawRadiusPx } : star);
    assert.throws(() => validatePreparedCubicSky({ ...plan,
      catalogueStars: { ...plan.catalogueStars, retained } }, { requireSun: false }), /incompatible/u);
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

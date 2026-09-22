import { requireRecord, requireFiniteNumber } from '../../tools/sources/source-values.mts';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import PREPARED_MERCURY_SKY from "../../src/objects/mercury/prepared/sky.json" with {type: "json"};
import PREPARED_VENUS_SKY from "../../src/objects/venus/prepared/sky.json" with {type: "json"};
import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_STANDARD,
  PREPARED_CUBIC_SKY_SCHEMA,
  validatePreparedCubicSky,
} from "./cubic-sky-contract.mts";

const runtimeSky = async (id: string) => requireRecord(await loadObjectTestDefinition(id)).sky;
const OBJECT_SKIES = Object.freeze({
  sun: await runtimeSky('sun'),
  mercury: PREPARED_MERCURY_SKY,
  venus: PREPARED_VENUS_SKY,
  earth: await runtimeSky('earth'),
  mars: await runtimeSky('mars'),
  jupiter: await runtimeSky('jupiter'),
  saturn: await runtimeSky('saturn'),
  uranus: await runtimeSky('uranus'),
  neptune: await runtimeSky('neptune'),
});
// The shared universe draws the visible sky, so no package carries faces, stars, a baked Sun or their registration.
const RETIRED_SKY_FIELDS = ["faces", "catalogueStars", "sun", "pointSourcePresentation", "photographicSeparation", "astrometricRegistration"];

const plan = Object.freeze({
  schema: PREPARED_CUBIC_SKY_SCHEMA,
  standard: CUBIC_SKY_STANDARD.schema,
  model: "prepared-object-sky-orientation-for-the-shared-universe",
  cameraPitchResponse: CUBIC_SKY_STANDARD.cameraPitchResponse,
  cameraZoomResponse: CUBIC_SKY_STANDARD.cameraZoomResponse,
  presentationPitchOffsetDegrees: CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees,
  presentationYawOffsetDegrees: CUBIC_SKY_STANDARD.presentationYawOffsetDegrees,
  runtimeRasterization: false,
  orientation: "camera-rotation-only-no-translation-or-parallax",
  qualification: "Test sky orientation.",
});

test("a prepared sky carries only the orientation its camera reads", () => {
  assert.equal(validatePreparedCubicSky(plan), plan);
  for (const drift of [
    { schema: "cssearth-prepared-cubic-sky@2" },
    { standard: "cssearth-cubic-sky-standard@2" },
    { runtimeRasterization: true },
    { orientation: "free-translation" },
    { qualification: "" },
    { cameraZoomResponse: Number.NaN },
    { cameraContract: { ...CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, source: undefined } },
    { projection: { axis: "horizontal", horizontalFovDegrees: 60, focalLengthOverViewportWidth: Math.sqrt(3) / 2,
      cssPerspective: "86.6cqw", runtimeProjection: true } },
  ]) {
    assert.throws(() => validatePreparedCubicSky({ ...plan, ...drift }), /incompatible/u);
  }
});

test("every planet package prepares its sky for the shared camera without private imagery", () => {
  for (const [objectId, sky] of Object.entries(OBJECT_SKIES)) {
    const data = requireRecord(validatePreparedCubicSky(sky));
    for (const field of RETIRED_SKY_FIELDS) assert.equal(field in data, false, `${objectId}: ${field}`);
    assert.equal(data.cameraPitchResponse, CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.rotationResponse, objectId);
    assert.equal(data.cameraZoomResponse, CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.zoomResponse, objectId);
    const projection = requireRecord(data.projection);
    assert.ok(Math.abs(requireFiniteNumber(projection.horizontalFovDegrees) -
      CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees) < 1e-6, objectId);
  }
});

test("the retained sky stylesheet keeps no private Sun or catalogue stars", async () => {
  const css = await readFile(new URL("./cubic-sky.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /planet-directional-sun|planet-cubic-sky-star/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
});

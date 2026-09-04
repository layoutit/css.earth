import assert from "node:assert/strict";
import test from "node:test";

import { PREPARED_EARTH_SCENE } from
  "../../src/planets/earth/runtime/preparedScene.mjs";
import { PREPARED_JUPITER_SCENE } from
  "../../src/planets/jupiter/runtime/preparedScene.mjs";
import { PREPARED_MARS_SCENE } from
  "../../src/planets/mars/runtime/preparedScene.mjs";
import { PREPARED_MERCURY_SCENE } from
  "../../src/planets/mercury/runtime/preparedScene.mjs";
import { PREPARED_NEPTUNE_SCENE } from
  "../../src/planets/neptune/runtime/preparedScene.mjs";
import { PREPARED_SATURN_SCENE } from
  "../../src/planets/saturn/runtime/preparedScene.mjs";
import { PREPARED_URANUS_SCENE } from
  "../../src/planets/uranus/runtime/preparedScene.mjs";
import { PREPARED_VENUS_SCENE } from
  "../../src/planets/venus/runtime/preparedScene.mjs";

const PLANET_SURFACE_SEAMS = Object.freeze({
  mercury: PREPARED_MERCURY_SCENE.preparedSurface.seamRepair,
  venus: PREPARED_VENUS_SCENE.body.seamRepair,
  earth: PREPARED_EARTH_SCENE.body.seamRepair,
  mars: PREPARED_MARS_SCENE.surface.seamRepair,
  jupiter: PREPARED_JUPITER_SCENE.surface.seamRepair,
  saturn: PREPARED_SATURN_SCENE.preparedSurface.seamRepair,
  uranus: PREPARED_URANUS_SCENE.preparedSurface.seamRepair,
  neptune: PREPARED_NEPTUNE_SCENE.surfacePreparation.seamRepair,
});

test("all prepared planet surfaces use the measured Chrome seam contract", () => {
  assert.deepEqual(Object.keys(PLANET_SURFACE_SEAMS), [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ]);
  for (const [planet, seam] of Object.entries(PLANET_SURFACE_SEAMS)) {
    assert.ok([
      "prepared-zero-seam-bleed-with-compositor-overlap",
      "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap",
    ].includes(seam.model), `${planet} seam model`);
    assert.equal(seam.seamBleed, 0, `${planet} seam bleed`);
    assert.ok(
      seam.presentationOverlap >= 0.005,
      `${planet} compositor overlap`,
    );
    assert.ok(seam.rasterGutter > 0, `${planet} raster gutter`);
    if (seam.model.includes("matched-raster")) {
      assert.ok(seam.rasterOverscan > 0, `${planet} matched raster overscan`);
    } else {
      assert.equal(seam.rasterOverscan, 0, `${planet} raster overscan`);
    }
    assert.ok(
      seam.rasterOverscan <= seam.rasterGutter,
      `${planet} raster overscan stays inside its prepared gutter`,
    );
    assert.equal(seam.runtimeEdgeDiscovery, false, `${planet} runtime work`);
  }
});

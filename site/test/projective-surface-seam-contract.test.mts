import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import { loadObjectContent } from "./load-object-content.mts";
import { prepareBandedEllipsoid } from "../../tools/objects/giant-layers/geometry.mts";

const PLANET_SURFACE_SEAMS = {};
for (const id of ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
  const scene = JSON.parse(await readFile(new URL("../../src/planets/" + id + "/prepared/scene.json", import.meta.url), "utf8"));
  const loaded = await loadObjectContent(id);
  const geometry = loaded.descriptor.properties.recipe.sources.some(source => source.id === "geometry")
    ? await loaded.source("geometry") : null;
  if (geometry?.schema === "cssearth-banded-ellipsoid@1") {
    // The source parameters must generate the accepted retained geometry, not
    // merely declare a seam-policy label beside unrelated prepared transforms.
    const actual = prepareBandedEllipsoid(geometry);
    const { schema, ...prepared } = scene;
    assert.deepEqual(actual, prepared, id + ": seam parameters must generate the actual leaves");
    const { seamBleed, overlap, gutter, overscan } = geometry.surface;
    PLANET_SURFACE_SEAMS[id] = {
      model: overscan > 0 ? "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap"
        : "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed, presentationOverlap: overlap, rasterGutter: gutter, rasterOverscan: overscan,
      runtimeEdgeDiscovery: false,
    };
  } else {
    PLANET_SURFACE_SEAMS[id] = (scene.preparedSurface ?? scene.body ?? scene.surface).seamRepair;
  }
}

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

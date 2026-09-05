import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolvePreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { initialObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PREPARED_MARS_LENSES } from "../runtime/preparedLenses.mjs";

const publicRoot = new URL("../../../../public/scenes/mars/", import.meta.url);

test("prepares only the three source-backed Mars lenses", () => {
  assert.equal(PREPARED_MARS_LENSES.schema, "cssmars-prepared-lenses@1");
  assert.equal(PREPARED_MARS_LENSES.defaultLens, "normal");
  assert.equal(PREPARED_MARS_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_MARS_LENSES.runtimeRasterization, false);
  assert.deepEqual(PREPARED_MARS_LENSES.controls.map(({ id }) => id), [
    "normal",
    "elevation",
    "thermal",
  ]);
  assert.equal(PREPARED_MARS_LENSES.controls.some(({ id }) =>
    id === "cross-section" || id === "methane"), false);
});

test("ships complete DPR surfaces, poles, thumbnails, and qualification",
  async () => {
    for (const lens of PREPARED_MARS_LENSES.controls) {
      const assets = [
        [lens.surfaceUrl, 2_080, 1_504],
        [lens.surface2xUrl, 4_160, 3_008],
        [lens.polesUrl, 512, 256],
        [lens.poles2xUrl, 1_024, 512],
        [lens.thumbnailUrl, 112, 64],
      ];
      for (const [url, width, height] of assets) {
        const assetPath = fileURLToPath(
          new URL(url.split("/").at(-1), publicRoot),
        );
        const metadata = await sharp(assetPath).metadata();
        assert.equal(metadata.width, width, `${url} width`);
        assert.equal(metadata.height, height, `${url} height`);
      }
      assert.ok(lens.measurement.length > 10);
      assert.ok(lens.qualification.length > 20);
    }
  });

test("declares MOLA false color and qualified THEMIS coverage", () => {
  const elevation = PREPARED_MARS_LENSES.controls.find(
    ({ id }) => id === "elevation",
  );
  const thermal = PREPARED_MARS_LENSES.controls.find(
    ({ id }) => id === "thermal",
  );
  assert.equal(elevation.falseColor, true);
  assert.match(elevation.qualification, /MOLA elevation/u);
  assert.equal(thermal.falseColor, false);
  assert.match(thermal.qualification, /not a calibrated temperature retrieval/u);
  assert.match(thermal.coveragePreparation, /Viking grayscale detail/u);
  for (const lens of [elevation, thermal]) {
    assert.equal(lens.polarPreparation.boundaryLatitudeDegrees, 87.1875);
    assert.equal(
      lens.polarPreparation.singularityStabilization.model,
      "prepared-boundary-guided-polar-inpaint",
    );
    assert.equal(lens.polarPreparation.runtimeProjection, false);
  }
});

test("switches prepared lenses without filters, canvas, or DOM growth", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  const { runtimeDefinition } = await import("../runtime/definition.mjs");
  assert.equal(runtimeDefinition.controls.lenses.defaultLens, PREPARED_MARS_LENSES.defaultLens);
  for (const lens of PREPARED_MARS_LENSES.controls) {
    const plan = resolvePreparedPresentation(runtimeDefinition, { selection: { ...initialObjectSelection(runtimeDefinition.controls), lensId: lens.id }, view: { skySunViewDirection: runtimeDefinition.sun.referenceViewDirection } });
    assert.ok(plan.required.includes(`surface:${lens.id}`));
    assert.ok(plan.required.includes(`poles:${lens.id}`));
  }
  assert.doesNotMatch(client, /style\.filter|canvas|getContext\(/u);
  assert.match(css, /data-lens="elevation"/u);
  assert.match(css, /data-lens="thermal"/u);
  assert.doesNotMatch(css, /filter\s*:|mask\s*:|clip-path\s*:/u);
});

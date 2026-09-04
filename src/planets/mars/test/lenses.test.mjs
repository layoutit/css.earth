import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
  assert.match(client, /selectLens/u);
  assert.match(client, /lensDecodePromises\.get\(lens\.id\)/u);
  assert.match(client, /lensDecodePromises\.set\(lens\.id, decoding\)/u);
  assert.match(client,
    /lens\.id !== PREPARED_MARS_LENSES\.defaultLens/u);
  assert.match(client, /await decoding/u);
  assert.match(client, /destroyed \|\| request !== lensRequest/u);
  assert.match(client, /stage\.dataset\.lens = lens\.id/u);
  assert.match(client, /panelControls\?\.publishLens\(activeLens\)/u);
  assert.match(client, /publishLens\(state\.id\)/u);
  assert.match(client, /ready: mounted !== null && !destroyed/u);
  assert.doesNotMatch(client, /style\.filter|canvas|getContext\(/u);
  assert.match(css, /data-lens="elevation"/u);
  assert.match(css, /data-lens="thermal"/u);
  assert.doesNotMatch(css, /filter\s*:|mask\s*:|clip-path\s*:/u);
});

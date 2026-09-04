import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PREPARED_JUPITER_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";

const publicRoot = new URL("../../../../public/scenes/jupiter/", import.meta.url);

test("prepares only the three source-backed Jupiter lenses", () => {
  assert.equal(PREPARED_JUPITER_LENSES.schema, "cssjupiter-prepared-lenses@1");
  assert.equal(PREPARED_JUPITER_LENSES.defaultLens, "normal");
  assert.equal(PREPARED_JUPITER_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_JUPITER_LENSES.runtimeRasterization, false);
  assert.deepEqual(PREPARED_JUPITER_LENSES.controls.map(({ id }) => id), [
    "normal",
    "ultraviolet",
    "methane",
  ]);
  assert.equal(PREPARED_JUPITER_LENSES.controls.some(({ id }) =>
    id === "elevation" || id === "thermal" || id === "cross-section"), false);
});

test("ships complete DPR surfaces, poles, thumbnails, and qualification",
  async () => {
    for (const lens of PREPARED_JUPITER_LENSES.controls) {
      const assets = [
        [lens.surfaceUrl, 2_080, 1_678],
        [lens.surface2xUrl, 4_160, 3_356],
        [lens.polesUrl, 512, 256],
        [lens.poles2xUrl, 1_024, 512],
        [lens.thumbnailUrl, 132, 72],
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

test("declares source bands and qualified false-color presentation", () => {
  const ultraviolet = PREPARED_JUPITER_LENSES.controls.find(
    ({ id }) => id === "ultraviolet",
  );
  const methane = PREPARED_JUPITER_LENSES.controls.find(
    ({ id }) => id === "methane",
  );
  assert.equal(ultraviolet.filter, "F275W");
  assert.equal(ultraviolet.wavelength, "275 nm");
  assert.equal(ultraviolet.falseColor, true);
  assert.match(ultraviolet.qualification, /single-band Hubble OPAL/u);
  assert.deepEqual(ultraviolet.coveragePreparation, {
    model: "measured-polar-projection-with-source-structured-unmeasured-core",
    firstMeasuredRow: 50,
    lastMeasuredRow: 1_709,
    projectionEdgeLatitudeDegrees: 64,
    bodyLatitudeBoundsDegrees:
      PREPARED_JUPITER_SCENE.materialProjection.meshSilhouette
        .latitudeBoundsDegrees,
    unmeasuredCoreRadius: { south: 0.346346, north: 0.192415 },
    polarProjectionAngularSamples: 9,
    unmeasuredCoreHarmonicOrder: 2,
    detailedPoles: ["south", "north"],
    structuralAuthority: {
      north: "NASA Juno PIA23808",
      south: "NASA Juno JIRAM PIA23556",
    },
    structuralDetailMeasurement: false,
    spectralColorAuthority: "Hubble WFC3 F275W ultraviolet reflectance",
    runtimeCoverageRepair: false,
  });
  assert.equal(methane.filter, "FQ889N");
  assert.equal(methane.wavelength, "889 nm");
  assert.equal(methane.falseColor, true);
  assert.match(methane.qualification, /single-band Hubble OPAL/u);
  assert.deepEqual(methane.coveragePreparation, {
    model: "measured-polar-projection-with-source-structured-unmeasured-core",
    firstMeasuredRow: 52,
    lastMeasuredRow: 1_705,
    projectionEdgeLatitudeDegrees: 64,
    bodyLatitudeBoundsDegrees:
      PREPARED_JUPITER_SCENE.materialProjection.meshSilhouette
        .latitudeBoundsDegrees,
    unmeasuredCoreRadius: { south: 0.361739, north: 0.200111 },
    polarProjectionAngularSamples: 9,
    unmeasuredCoreHarmonicOrder: 2,
    detailedPoles: ["south", "north"],
    structuralAuthority: {
      north: "NASA Juno PIA23808",
      south: "NASA Juno JIRAM PIA23556",
    },
    structuralDetailMeasurement: false,
    spectralColorAuthority: "Hubble WFC3 FQ889N methane-band reflectance",
    runtimeCoverageRepair: false,
  });
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
    /lens\.id !== PREPARED_JUPITER_LENSES\.defaultLens/u);
  assert.match(client, /await decoding/u);
  assert.match(client, /destroyed \|\| request !== lensRequest/u);
  assert.match(client, /stage\.dataset\.lens = lens\.id/u);
  assert.match(client, /lensControls\?\.publishLens\(activeLens\)/u);
  assert.match(client, /publishLens\(state\.id\)/u);
  assert.match(client, /ready: mounted !== null && !destroyed/u);
  assert.doesNotMatch(client, /style\.filter|canvas|getContext\(/u);
  assert.match(css, /data-lens="ultraviolet"/u);
  assert.match(css, /data-lens="methane"/u);
  assert.match(css,
    /data-lens="ultraviolet"[^}]+\.jupiter-pole-inner[\s\S]+visibility:\s*hidden/u);
  assert.doesNotMatch(css, /filter\s*:|mask\s*:|clip-path\s*:/u);
});

test("fills unmeasured spectral pole coverage with source-structured cores",
  async () => {
    for (const id of ["ultraviolet", "methane"]) {
      const { data, info } = await sharp(fileURLToPath(new URL(
        `../../../../public/scenes/jupiter/jupiter-lens-${id}-poles@2x.webp`,
        import.meta.url,
      ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const centerX of [256, 768]) {
        const center = rgbaAt(centerX, 256);
        assert.equal(center[3], 255, `${id} pole center alpha`);
        assert.ok(
          center[0] + center[1] + center[2] > 30,
          `${id} pole center must not encode unmeasured FITS background`,
        );
        const coreLuminances = [];
        for (let y = 224; y <= 288; y += 8) {
          for (let x = centerX - 32; x <= centerX + 32; x += 8) {
            const [red, green, blue, alpha] = rgbaAt(x, y);
            assert.equal(alpha, 255, `${id} structured core alpha`);
            coreLuminances.push(
              red * 0.2126 + green * 0.7152 + blue * 0.0722,
            );
          }
        }
        const range = Math.max(...coreLuminances) - Math.min(...coreLuminances);
        assert.ok(range > 4, `${id} structured pole core flattened: ${range}`);
      }

      function rgbaAt(x, y) {
        const offset = (y * info.width + x) * info.channels;
        return [...data.subarray(offset, offset + 4)];
      }
    }
  });

test("retains measured angular spectral structure outside the polar core",
  async () => {
    for (const id of ["ultraviolet", "methane"]) {
      const { data, info } = await sharp(fileURLToPath(new URL(
        `../../../../public/scenes/jupiter/jupiter-lens-${id}-poles@2x.webp`,
        import.meta.url,
      ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const centerX of [256, 768]) {
        const samples = [];
        for (let angle = 0; angle < 360; angle += 2) {
          const radians = angle * Math.PI / 180;
          const x = Math.round(centerX + 144 * Math.cos(radians));
          const y = Math.round(256 + 144 * Math.sin(radians));
          const offset = (y * info.width + x) * info.channels;
          samples.push(
            data[offset] * 0.2126 + data[offset + 1] * 0.7152 +
              data[offset + 2] * 0.0722,
          );
        }
        const mean = samples.reduce((sum, value) => sum + value, 0) /
          samples.length;
        const deviation = Math.sqrt(samples.reduce(
          (sum, value) => sum + (value - mean) ** 2,
          0,
        ) / samples.length);
        assert.ok(deviation > 1.5,
          `${id} measured polar structure flattened at ${centerX}: ${deviation}`);
      }
    }
  });

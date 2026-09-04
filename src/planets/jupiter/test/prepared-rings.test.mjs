import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_JUPITER_RINGS } from "../runtime/preparedRings.mjs";

const publicRoot = new URL("../../../../public/", import.meta.url);

test("prepares the measured three-part Jovian ring system", () => {
  const rings = PREPARED_JUPITER_RINGS;
  assert.equal(rings.schema, "cssjupiter-prepared-rings@2");
  assert.equal(rings.system.model,
    "three-part-jovian-ring-system-with-two-gossamer-components");
  assert.deepEqual(rings.system.parts, ["halo", "main", "gossamer"]);
  assert.deepEqual(rings.system.radialPresentation, {
    model: "same-prepared-logarithmic-inner-system-map-as-jupiter-moons",
    retainedWorldUnitsPerPresentationUnit: 50,
    anchors: [
      {
        id: "jupiter-equator",
        sourceRadiusKm: 71_492,
        presentationRadius: 230,
      },
      {
        id: "metis",
        sourceRadiusKm: 128_000,
        presentationRadius: 255,
      },
      {
        id: "io",
        sourceRadiusKm: 421_800,
        presentationRadius: 285,
      },
    ],
    sourceOrderPreserved: true,
    runtimeMapping: false,
  });
  assert.deepEqual(rings.system.components, [
    {
      name: "Halo",
      innerRadiusKm: 100_000,
      outerRadiusKm: 122_400,
      opticalDepthText: "~10^-6",
      opticalDepth: 1e-6,
      verticalThicknessKm: 10_000,
      associatedMoons: [],
    },
    {
      name: "Main Ring",
      innerRadiusKm: 122_400,
      outerRadiusKm: 129_100,
      opticalDepthText: "< 8 x 10^-6",
      opticalDepth: 8e-6,
      verticalThicknessKm: 100,
      associatedMoons: ["Metis", "Adrastea"],
    },
    {
      name: "Amalthea Gossamer Ring",
      innerRadiusKm: 122_400,
      outerRadiusKm: 181_350,
      opticalDepthText: "~5 x 10^-7",
      opticalDepth: 5e-7,
      verticalThicknessKm: 2_600,
      associatedMoons: ["Amalthea"],
    },
    {
      name: "Thebe Gossamer Ring",
      innerRadiusKm: 122_400,
      outerRadiusKm: 221_900,
      opticalDepthText: "~10^-7",
      opticalDepth: 1e-7,
      verticalThicknessKm: 8_800,
      associatedMoons: ["Thebe"],
    },
    {
      name: "Thebe Extension",
      innerRadiusKm: 221_900,
      outerRadiusKm: 270_000,
      opticalDepthText: "~10^-9",
      opticalDepth: 1e-9,
      verticalThicknessKm: 8_800,
      associatedMoons: ["Thebe"],
    },
  ]);
});

test("commits exact DPR ring asset bytes", async () => {
  assert.deepEqual(Object.keys(PREPARED_JUPITER_RINGS.assets), ["system"]);
  let maximumPreparedAlpha = 0;
  for (const asset of Object.values(PREPARED_JUPITER_RINGS.assets)) {
    for (const [url, descriptor] of [
      [asset.url, asset.one],
      [asset.url2x, asset.two],
    ]) {
      const bytes = await readFile(new URL(url.slice(1), publicRoot));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, descriptor.width, url);
      assert.equal(metadata.height, descriptor.height, url);
      assert.equal(bytes.byteLength, descriptor.bytes, url);
      assert.equal(createHash("sha256").update(bytes).digest("hex"),
        descriptor.sha256, url);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      for (let index = 3; index < data.length; index += info.channels) {
        maximumPreparedAlpha = Math.max(maximumPreparedAlpha, data[index]);
      }
    }
    assert.deepEqual([asset.one.width, asset.two.width], [1_024, 2_048]);
  }
  assert.ok(maximumPreparedAlpha >= 120,
    `Jupiter main ring became illegible: ${maximumPreparedAlpha}`);
  assert.ok(maximumPreparedAlpha <= 145,
    `Jupiter rings became materially opaque: ${maximumPreparedAlpha}`);
});

test("publishes only fixed retained ring leaves", () => {
  const rings = PREPARED_JUPITER_RINGS;
  assert.deepEqual(rings.retainedDom, {
    transformGroupCount: 1,
    leafCount: 16,
    maximumLeafWorldSize: 6894.428344,
    stackedTransparentPlaneCount: 0,
    runtimeTopology: false,
  });
  assert.ok(rings.leaves.every((leaf) => leaf.component === "system"));
  assert.deepEqual(
    rings.leaves.map(({ tileColumn, tileRow }) => [tileColumn, tileRow]),
    Array.from({ length: 16 }, (_, index) => [index % 4, Math.floor(index / 4)]),
  );
  assert.ok(rings.leaves.every((leaf) =>
    leaf.className.startsWith("jupiter-ring-leaf ") &&
    leaf.style.includes("background-image:url(\"/scenes/jupiter/jupiter-rings@2x.webp\")") &&
    leaf.style.includes("transform:translate3d(") &&
    leaf.style.includes("background-position:") &&
    leaf.style.includes("background-size:") &&
    !leaf.style.includes("filter:") &&
    !leaf.style.includes("gradient(")));
  assert.equal(rings.presentation.runtimeGeometry, false);
  assert.equal(rings.presentation.runtimeRasterization, false);
  assert.equal(rings.shadow.runtimeShadow, false);
  assert.equal(rings.shadow.solarLongitudeDegrees, 56.4);
  assert.equal(rings.shadow.solarLatitudeDegrees, 0.53);
  assert.equal(rings.shadow.physicalDirectTransmission, 0);
  assert.equal(rings.shadow.presentationLuminanceMultiplier, 0.65);
  assert.match(rings.shadow.qualification, /complete ring silhouette/u);
  assert.equal(rings.presentation.maximumMainAlpha, 0.4);
  assert.equal(rings.presentation.opticalDepthExponent, 0.65);
  assert.equal(rings.presentation.minimumMainRingPresentationWidth, 3);
  assert.equal(rings.presentation.verticalPresentation,
    "source-thickness-retained-as-metadata-without-stacked-transparent-planes");
  assert.equal(rings.presentation.tileGrid, 4);
  assert.equal(rings.presentation.tileOverlapWorld, 50);
  assert.ok(rings.retainedDom.maximumLeafWorldSize < 8192);
  assert.match(rings.presentation.qualification, /low-opacity visibility/u);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";

test("prepares the source-radii Mars body as stable retained topology", () => {
  const scene = PREPARED_MARS_SCENE;
  assert.equal(scene.schema, "cssmars-prepared-retained-body@1");
  assert.deepEqual(scene.geometry, {
    latitudeSegments: 18,
    longitudeSegments: 32,
    equatorialRadius: 230,
    polarRadius: 228.646218,
    equatorialRadiusKm: 3396.19,
    polarRadiusKm: 3376.2,
    axialTiltDegrees: 25.19,
  });
  assert.deepEqual(scene.retainedDom, {
    transformGroupCount: 4,
    bodyLeafCount: 512,
    polarLeafCount: 4,
    totalLeafCount: 516,
    starfieldFaceCount: 6,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
    runtimeTopology: false,
  });
  assert.equal(scene.starfield.faces.length, 6);
  assert.equal(scene.starfield.sun, undefined);
  assert.equal(scene.starfield.cameraContract,
    "google-earth-pro-inverse-unbounded-matrix3d");
  assert.equal(scene.leaves.length, 516);
  assert.equal(scene.leaves.filter(({ className }) =>
    className === "mars-pole mars-pole-outer mars-pole-north").length, 1);
  assert.equal(scene.leaves.filter(({ className }) =>
    className === "mars-pole mars-pole-inner mars-pole-south").length, 1);
  assert.ok(scene.leaves.every(({ tag, style }) =>
    tag === "s" && style.startsWith("transform:matrix3d(") &&
    style.includes("background-position:") && style.includes("background-size:")));
});

test("prepares complete DPR 1 and DPR 2 opaque surface texels", async () => {
  assert.equal(PREPARED_MARS_SCENE.surface.encoding, "webp-q80");
  const pairs = [
    ["mars-surface.webp", PREPARED_MARS_SCENE.assets.surface],
    ["mars-surface@2x.webp", PREPARED_MARS_SCENE.assets.surface2x],
    ["mars-poles.webp", PREPARED_MARS_SCENE.assets.poles],
    ["mars-poles@2x.webp", PREPARED_MARS_SCENE.assets.poles2x],
  ];
  for (const [name, descriptor] of pairs) {
    const bytes = await readFile(new URL(`../../../../public/scenes/mars/${name}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, descriptor.width);
    assert.equal(metadata.height, descriptor.height);
    assert.equal(bytes.byteLength, descriptor.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), descriptor.sha256);
  }
  assert.deepEqual(
    [PREPARED_MARS_SCENE.assets.surface.width, PREPARED_MARS_SCENE.assets.surface.height],
    [2080, 1504],
  );
  assert.deepEqual(
    [PREPARED_MARS_SCENE.assets.surface2x.width, PREPARED_MARS_SCENE.assets.surface2x.height],
    [4160, 3008],
  );
  assert.ok(PREPARED_MARS_SCENE.surface.polarCaps.transparentPixelRatio < 0.22);
});

test("prepares zero seam bleed with compositor overlap", () => {
  assert.deepEqual(PREPARED_MARS_SCENE.surface.seamRepair, {
    model: "prepared-zero-seam-bleed-with-compositor-overlap",
    seamBleed: 0,
    presentationOverlap: 0.005,
    rasterGutter: 16,
    rasterOverscan: 0,
    runtimeEdgeDiscovery: false,
    wrappedLongitudeSeams: 512,
  });
  assert.equal(PREPARED_MARS_SCENE.surface.polarCaps.boundaryLatitudeDegrees,
    87.1875);
  assert.ok(PREPARED_MARS_SCENE.surface.polarCaps.innerInset <= 0.15,
    "the final polar patch must not be visibly recessed into the spheroid");
  assert.deepEqual(
    PREPARED_MARS_SCENE.surface.polarCaps.singularityStabilization,
    {
      model: "prepared-boundary-guided-polar-inpaint",
      inpaintRadiusRatio: 0.2,
      transitionEndRadiusRatio: 1,
      boundaryAngularSmoothingDegrees: 12,
      polewardLatitudeDegrees: 89.418036,
      runtimeProjection: false,
    },
  );
  assert.equal(PREPARED_MARS_SCENE.surface.polarCaps.runtimeProjection, false);
  assert.equal(PREPARED_MARS_SCENE.motion.runtimeJavaScriptPerFrame, false);
});

test("keeps topology and raster work out of the browser runtime", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /spherePolygons|computeTextureAtlasPlan|sharp/);
  assert.match(client, /PREPARED_MARS_SCENE/);
  assert.match(css,
    /background-image:\s*url\("\/scenes\/mars\/mars-surface@2x\.webp"\)/u);
  assert.match(css, /@keyframes mars-body-spin/);
  assert.doesNotMatch(css, /clip-path|mask:|filter:|linear-gradient|radial-gradient|mix-blend-mode/);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";

test("prepares the source-radii Jupiter body as stable retained topology", () => {
  const scene = PREPARED_JUPITER_SCENE;
  assert.equal(scene.schema, "cssjupiter-prepared-retained-body@1");
  assert.deepEqual(scene.geometry, {
    latitudeSegments: 24,
    longitudeSegments: 32,
    equatorialRadius: 230,
    polarRadius: 215.07889,
    equatorialRadiusKm: 71_492,
    polarRadiusKm: 66_854,
    axialTiltDegrees: 3.13,
  });
  assert.deepEqual(scene.presentation, {
    responsiveRenderRoot: {
      model: "shared-container-scaled-reference-viewport",
      referenceWidth: 1280,
      referenceHeight: 720,
      sidePadding: 16,
      runtimeMeasurement: false,
    },
  });
  assert.equal(scene.systemTransform, "transform:rotateX(3.13deg)");
  assert.deepEqual(scene.materialProjection, {
    model: "prepared-oblate-body-camera-projection-input",
    polarAxis: "object-z",
    systemRotation: [0, -3.13, 0],
    cssSystemRotationXDegrees: 3.13,
    bodyInitialRotationZDegrees: -145,
    meshSilhouette: {
      model: "prepared-expanded-retained-body-vertex-input",
      latitudeBoundsDegrees: [
        -80, -76, -72, -68, -64, -56, -48, -40, -32, -24, -16, -8,
        0,
        8, 16, 24, 32, 40, 48, 56, 64, 68, 72, 76, 80,
      ],
      longitudeSegments: 32,
      surfaceOverlap: 0.008,
      polarBoundaryLatitudeDegrees: 80,
      polarBoundaryRadius: 39.939081,
      polarOverlayEdgeLatitudeDegrees: 64,
      polarOverlayRadius: 100.825364,
      polarCoreRadiusRatio: 0.396121,
      polarPlaneZ: 211.911358,
      polarOuterOverlap: 1.035,
      polarInnerOverlap: 1.05,
      polarInnerInset: 2.4,
      supersampling: 4,
    },
    runtimeDerivation: false,
  });
  assert.equal(scene.camera.state.zoom, 1.1);
  assert.ok(Math.abs(scene.camera.state.rotX - 65.74) < 1e-10);
  assert.deepEqual(scene.retainedDom, {
    transformGroupCount: 4,
    bodyLeafCount: 768,
    polarLeafCount: 4,
    totalLeafCount: 772,
    runtimeTopology: false,
  });
  assert.equal(scene.leaves.length, 772);
  assert.ok(Math.max(...scene.materialProjection.meshSilhouette
    .latitudeBoundsDegrees.slice(1).map((latitude, index) =>
      latitude - scene.materialProjection.meshSilhouette
        .latitudeBoundsDegrees[index])) <= 8);
  assert.equal(scene.leaves.filter(({ className }) => className === "jupiter-pole jupiter-pole-outer jupiter-pole-north").length, 1);
  assert.equal(scene.leaves.filter(({ className }) => className === "jupiter-pole jupiter-pole-inner jupiter-pole-south").length, 1);
  assert.ok(scene.leaves.every(({ tag, style }) =>
    tag === "s" && style.startsWith("transform:matrix3d(") &&
    style.includes("background-position:") && style.includes("background-size:")));
});

test("prepares complete DPR 1 and DPR 2 opaque surface texels", async () => {
  const pairs = [
    ["jupiter-surface.webp", PREPARED_JUPITER_SCENE.assets.surface],
    ["jupiter-surface@2x.webp", PREPARED_JUPITER_SCENE.assets.surface2x],
    ["jupiter-poles.webp", PREPARED_JUPITER_SCENE.assets.poles],
    ["jupiter-poles@2x.webp", PREPARED_JUPITER_SCENE.assets.poles2x],
  ];
  for (const [name, descriptor] of pairs) {
    const bytes = await readFile(new URL(`../../../../public/scenes/jupiter/${name}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, descriptor.width);
    assert.equal(metadata.height, descriptor.height);
    assert.equal(bytes.byteLength, descriptor.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), descriptor.sha256);
  }
  assert.deepEqual(
    [PREPARED_JUPITER_SCENE.assets.surface.width, PREPARED_JUPITER_SCENE.assets.surface.height],
    [2080, 1678],
  );
  assert.deepEqual(
    [PREPARED_JUPITER_SCENE.assets.surface2x.width, PREPARED_JUPITER_SCENE.assets.surface2x.height],
    [4160, 3356],
  );
  assert.ok(PREPARED_JUPITER_SCENE.surface.polarCaps.transparentPixelRatio > 0.25);
  assert.ok(PREPARED_JUPITER_SCENE.surface.polarCaps.transparentPixelRatio < 0.3);
});

test("prepares source-backed cyclone structure at both poles", async () => {
  const { data, info } = await sharp(await readFile(new URL(
    "../../../../public/scenes/jupiter/jupiter-poles@2x.webp",
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const centerX of [256, 768]) {
    const luminance = [];
    for (let angle = 0; angle < 360; angle += 2) {
      const radians = angle * Math.PI / 180;
      const x = Math.round(centerX + 64 * Math.cos(radians));
      const y = Math.round(256 + 64 * Math.sin(radians));
      const offset = (y * info.width + x) * info.channels;
      luminance.push(
        data[offset] * 0.2126 + data[offset + 1] * 0.7152 +
          data[offset + 2] * 0.0722,
      );
    }
    const mean = luminance.reduce((sum, value) => sum + value, 0) /
      luminance.length;
    const standardDeviation = Math.sqrt(luminance.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0,
    ) / luminance.length);
    assert.ok(standardDeviation > 0.4,
      `Jupiter polar continuation flattened at ${centerX}: ${standardDeviation}`);
    const alphaAt = (radius) => data[
      (256 * info.width + centerX + radius) * info.channels + 3
    ];
    assert.equal(alphaAt(96), 255);
    assert.ok(alphaAt(160) > 0 && alphaAt(160) < 255);
    assert.equal(alphaAt(240), 0);
  }
  assert.deepEqual(PREPARED_JUPITER_SCENE.surface.polarCaps, {
    ...PREPARED_JUPITER_SCENE.surface.polarCaps,
    model: "source-structure-hubble-chroma-bounded-polar-atlas",
    detailLookbackDegrees: 0.5,
    harmonicOrder: 32,
    centerDetailWeight: 1,
    edgeDetailWeight: 0.3,
    detailedPoles: ["south", "north"],
    detailBlendStartRadius: 0.08,
    detailBlendEndRadius: 0.96,
    alphaOpaqueRadius: 0.43,
    alphaTransparentRadius: 0.93,
    overlayEdgeLatitudeDegrees: 64,
    coreBoundaryLatitudeDegrees: 80,
    northStructureSource: "NASA Juno PIA23808",
    northPaletteSource: "NASA Juno PIA24239",
    northDetailRole:
      "north polar projection structure with visible-light palette chroma",
    southStructureSource: "NASA Juno JIRAM PIA23556",
    southPaletteSource: "NASA JunoCam PIA21382",
    southDetailRole:
      "south polar cyclone structure with visible-light palette chroma",
    chromaBoundarySource: "measured Hubble 64-degree latitude edge",
    structuralColorModel:
      "bounded luminance injection with palette-only chroma transport",
    runtimeProjection: false,
  });
});

test("prepares seam ownership and polar projection without runtime work", () => {
  assert.deepEqual(PREPARED_JUPITER_SCENE.surface.seamRepair, {
    model: "prepared-zero-seam-bleed-with-compositor-overlap",
    seamBleed: 0,
    presentationOverlap: 0.008,
    rasterGutter: 16,
    rasterOverscan: 0,
    runtimeEdgeDiscovery: false,
    wrappedLongitudeSeams: 768,
  });
  assert.equal(PREPARED_JUPITER_SCENE.surface.polarCaps.runtimeProjection, false);
  assert.equal(PREPARED_JUPITER_SCENE.motion.runtimeJavaScriptPerFrame, false);
});

test("keeps topology and raster work out of the browser runtime", async () => {
  const [client, css, shellCss] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../site/site.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /spherePolygons|computeTextureAtlasPlan|sharp/);
  assert.match(client, /PREPARED_JUPITER_SCENE/);
  assert.match(css,
    /background-image:\s*url\("\/scenes\/jupiter\/jupiter-surface@2x\.webp"\)/u);
  assert.match(css, /@keyframes jupiter-body-spin/);
  assert.doesNotMatch(css, /clip-path|mask:|filter:|linear-gradient|radial-gradient|mix-blend-mode|text-shadow|box-shadow/);
  assert.doesNotMatch(css, /jupiter-starfield\.webp/u);
  assert.match(css, /--planet-render-reference-width:\s*1280px/u);
  assert.match(css, /--planet-render-reference-height:\s*720px/u);
  assert.match(css, /--planet-render-side-padding:\s*16px/u);
  assert.match(shellCss,
    /\.planet-stage > \.planet-render-root/u);
  assert.doesNotMatch(shellCss,
    /(?:jupiter|saturn|mars).*planet-render-reference/iu);
});

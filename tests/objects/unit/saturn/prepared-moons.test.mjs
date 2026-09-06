import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  PREPARED_SATURN_MOON_MOTION,
} from "../runtime/preparedMoonMotion.mjs";
import { PREPARED_SATURN_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_ORBIT_GUIDES } from "../runtime/preparedMoonOrbitArcs.mjs";
import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";

const EXPECTED_MOONS = Object.freeze([
  "mimas",
  "enceladus",
  "tethys",
  "dione",
  "rhea",
  "titan",
  "hyperion",
  "iapetus",
]);

test("prepares eight independently hoverable major-moon orbit guides", () => {
  assert.equal(
    PREPARED_ORBIT_GUIDES.schema,
    "cssearth-prepared-orbit-guides@1",
  );
  assert.equal(PREPARED_ORBIT_GUIDES.planetId, "saturn");
  assert.equal(PREPARED_ORBIT_GUIDES.guideCount, 8);
  assert.equal(PREPARED_ORBIT_GUIDES.retainedLeafCount, 8);
  assert.deepEqual(
    PREPARED_ORBIT_GUIDES.guides.map(({ id }) => id),
    EXPECTED_MOONS,
  );
  assert.deepEqual(
    PREPARED_ORBIT_GUIDES.guides.map((guide) => ({
      id: guide.id,
      radius: guide.displayOrbitRadius,
      inclination: guide.inclinationDeg,
      node: guide.nodeDeg,
      planeTransform: guide.planeTransform,
    })),
    PREPARED_SATURN_MOONS.moons.map((moon) => ({
      id: moon.id,
      radius: moon.displayOrbitRadius,
      inclination: moon.inclinationDeg,
      node: moon.nodeDeg,
      planeTransform: moon.inclinationDeg === 0
        ? ""
        : `rotateY(${-moon.inclinationDeg}deg) ` +
          `rotateZ(${-moon.nodeDeg}deg)`,
    })),
  );
  assert.equal(PREPARED_ORBIT_GUIDES.animationCount, 0);
  assert.deepEqual(PREPARED_ORBIT_GUIDES.presentation, {
    baseOpacity: 0.2,
    hoverOpacity: 0.65,
  });
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.model,
    "event-driven-preprojected-static-conic-nearest-orbit",
  );
  assert.equal(PREPARED_ORBIT_GUIDES.hitTest.thresholdPixels, 6);
  assert.equal(PREPARED_ORBIT_GUIDES.hitTest.orbitTestsPerCallback, 8);
  assert.equal(PREPARED_ORBIT_GUIDES.hitTest.pointSamplesPerOrbit, 0);
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.animationTimeReadsPerCallback,
    0,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.trigonometricCallsPerCallback,
    0,
  );
  assert.deepEqual(
    PREPARED_ORBIT_GUIDES.hitTest.layoutRefreshEvents,
    ["initial-mount", "resize"],
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.layoutReadsPerHoverCallback,
    0,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.layoutReadsPerCameraInteractionEnd,
    0,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.touchTapMaxDurationMilliseconds,
    350,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.touchTapMaxMovementPixels,
    12,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.hitTest.runtimeTemporaryObjectsPerOrbit,
    0,
  );
  assert.equal(
    PREPARED_ORBIT_GUIDES.guides.every(({ orbitRadius }) =>
      Number.isFinite(orbitRadius) && orbitRadius > 0),
    true,
  );
  assert.equal(PREPARED_ORBIT_GUIDES.runtimeJavaScriptWritesPerFrame, 0);
  assert.equal(PREPARED_ORBIT_GUIDES.asset.browserImageType, "image/svg+xml");
  assert.equal(PREPARED_ORBIT_GUIDES.asset.runtimePathGeneration, false);
  assert.equal(
    PREPARED_ORBIT_GUIDES.guides.every(({ leaf }) =>
      leaf.tag === "s" &&
      /^transform:matrix3d\([^;]+\);$/u.test(leaf.style)),
    true,
  );
  assert.deepEqual([
    PREPARED_ORBIT_GUIDES.asset.width,
    PREPARED_ORBIT_GUIDES.asset.height,
    PREPARED_ORBIT_GUIDES.asset.width2x,
    PREPARED_ORBIT_GUIDES.asset.height2x,
  ], [514, 514, 514, 514]);
  assert.equal(PREPARED_ORBIT_GUIDES.asset.transparentPaddingPixels, 1);
  assert.equal(PREPARED_ORBIT_GUIDES.asset.selectedDensityImageCount, 1);
});

test("prepares 293 retained moons with static minor-moon dots", () => {
  assert.equal(PREPARED_SATURN_MOONS.schema,
    "csssaturn-prepared-low-poly-moons@4");
  assert.deepEqual(
    PREPARED_SATURN_MOONS.moons.map(({ id }) => id),
    EXPECTED_MOONS,
  );
  assert.equal(
    PREPARED_SATURN_MOON_MOTION.schema,
    "csssaturn-prepared-billboard-moon-motion@1",
  );
  assert.deepEqual(
    PREPARED_SATURN_MOON_MOTION.moons,
    PREPARED_SATURN_MOONS.moons.map(({ id, billboard }) => ({
      id,
      motion: billboard.motion,
    })),
  );
  assert.equal(
    PREPARED_SATURN_MOON_MOTION.moons.every(({ motion }) =>
      motion.keyframes[0].transform.startsWith("rotateZ(0deg) ") &&
      motion.keyframes[1].transform.startsWith("rotateZ(-360deg) ")),
    true,
    "orbit rotation must precede the prepared orbit plane",
  );
  assert.deepEqual(PREPARED_SATURN_MOONS.counts, {
    confirmedMoonCount: 293,
    preparedMoonCount: 293,
    detailedMoonCount: 8,
    minorMoonCount: 285,
    moonCount: 293,
    moonLeafCount: 300,
    moonSurfaceLeafCount: 293,
    moonTextureLeafCount: 15,
    moonSolidLeafCount: 0,
    moonDotLeafCount: 285,
    moonShadowLeafCount: 7,
    moonLabelCount: 8,
    moonTransformGroupCount: 24,
    moonAnimationCount: 8,
  });
  assert.equal(PREPARED_SATURN_MOONS.presentation.radiusScale, 1.5);
  assert.deepEqual(PREPARED_SATURN_MOONS.presentation.radiusScaleOverrides, {
    titan: 1,
  });
  assert.equal(
    PREPARED_SATURN_MOONS.presentation.orbitDistanceModel,
    "logarithmic-compression-preserving-source-order",
  );
  assert.deepEqual(PREPARED_SATURN_MOONS.presentation.orbitDistanceRange,
    [563.636954, 1_650]);
  assert.deepEqual(
    PREPARED_SATURN_MOONS.presentation.detailedOrbitDistanceRange,
    [650, 1_200],
  );
  assert.equal(
    PREPARED_SATURN_MOONS.presentation.minorMoonModel,
    "one-dot-leaf-one-prepared-static-epoch-translate",
  );
  assert.deepEqual(
    PREPARED_SATURN_MOONS.presentation.minorMoonPhysicalPixelFloor,
    { dpr1: 2, dpr2: 3 },
  );
  assert.equal(PREPARED_SATURN_MOONS.presentation.animatedMinorMoonCount, 0);
  assert.equal(
    PREPARED_SATURN_MOONS.presentation.staticEpochMinorMoonCount,
    285,
  );
  assert.equal(PREPARED_SATURN_MOONS.presentation.sourceOrbitOrderPreserved, true);
  assert.equal(PREPARED_SATURN_MOONS.presentation.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_SATURN_MOONS.presentation.runtimeTexturePreparation, false);
  assert.equal(PREPARED_SATURN_MOONS.presentation.runtimeJavaScriptWritesPerFrame, 0);
  assert.equal(PREPARED_SATURN_MOONS.atlas.selectedDensityImageCount, 1);
  assert.equal(PREPARED_SATURN_MOONS.atlas.tileCount, 0);
  assert.deepEqual(PREPARED_SATURN_MOONS.billboardAtlas, {
    url: "/scenes/saturn/saturn-moon-billboards.webp",
    url2x: "/scenes/saturn/saturn-moon-billboards@2x.webp",
    width: 272,
    height: 136,
    width2x: 544,
    height2x: 272,
    tileCount: 8,
    tileSize: 64,
    tileGutter: 2,
    selectedDensityImageCount: 1,
    encoding: "webp-q75-alpha-q100",
  });
  assert.equal(PREPARED_SATURN_MOONS.shadowAtlas.frameCount, 256);
  assert.equal(PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.model,
    "prepared-canonical-high-density-single-atlas");
  assert.equal(PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.selectedDensity,
    "canonical-2x");
  assert.equal(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards
      .maximumRetainedAtlasCount,
    1,
  );
  assert.deepEqual(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.runtimeAtlas,
    {
      assetUrl: "/scenes/saturn/saturn-moon-shadows.webp",
      asset2xUrl: "/scenes/saturn/saturn-moon-shadows@2x.webp",
      assetBytes: PREPARED_SATURN_MOONS.shadowAtlas.bytes,
      assetBytes2x: PREPARED_SATURN_MOONS.shadowAtlas.bytes2x,
      assetSha256: PREPARED_SATURN_MOONS.shadowAtlas.sha256,
      assetSha2562x: PREPARED_SATURN_MOONS.shadowAtlas.sha256_2x,
      width: 2112,
      height: 2112,
      width2x: 4224,
      height2x: 4224,
      decodedRgbaBytes: 17_842_176,
      decodedRgbaBytes2x: 71_368_704,
    },
  );
  assert.equal(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.runtimeDecodePolicy,
    "one-selected-density-atlas-decoded-before-input",
  );
  assert.equal(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards
      .alphaExactDecodedCropVerification,
    true,
  );
  assert.deepEqual(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.q75AssetUrls,
    [
      "/scenes/saturn/saturn-moon-shadows-row-05.webp",
      "/scenes/saturn/saturn-moon-shadows-row-05@2x.webp",
      "/scenes/saturn/saturn-moon-shadows-row-06.webp",
      "/scenes/saturn/saturn-moon-shadows-row-07.webp",
    ],
  );
  for (const row of PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.rows) {
    assert.match(row.assetUrl, /\.webp$/u);
    assert.match(row.asset2xUrl, /@2x\.webp$/u);
    assert.equal("url" in row, false);
    assert.equal("url2x" in row, false);
  }
  assert.equal(PREPARED_SATURN_MOONS.shadowAtlas.runtimeRasterization, false);
  assert.equal(
    PREPARED_SATURN_MOONS.shadowAtlas.runtimePlaybackWritesPerFrame,
    0,
  );

  assert.equal(PREPARED_SATURN_MOONS.minorMoonDots.length, 285);
  assert.equal(
    new Set(PREPARED_SATURN_MOONS.minorMoonDots.map(({ id }) => id)).size,
    285,
  );
  for (const moon of PREPARED_SATURN_MOONS.minorMoonDots) {
    assert.equal(moon.animated, false);
    assert.equal(
      moon.sourceModel,
      "JPL-mean-elements-prepared-static-epoch-translate",
    );
    assert.match(
      moon.style,
      /^translate:-?[\d.]+px -?[\d.]+px -?[\d.]+px$/u,
    );
  }

  for (const moon of PREPARED_SATURN_MOONS.moons) {
    assert.equal(
      moon.surfaceTopology,
      "prepared-camera-facing-alpha-plane",
    );
    assert.equal(moon.latitudeSegments, 0);
    assert.equal(moon.longitudeSegments, 0);
    assert.equal(moon.polarCapLeafCount, 0);
    assert.equal(moon.leafCount, 1);
    assert.ok(moon.billboard);
    assert.equal(moon.label.text, moon.name);
    assert.match(moon.label.style, /^transform:matrix3d\([^)]+\)$/u);
    assert.equal(
      moon.billboard.motion.model,
      "prepared-orbit-translation-and-counter-rotation",
    );
    assert.equal(moon.billboard.motion.keyframes.length, 2);
    const plane = moon.inclinationDeg === 0
      ? ""
      : `rotateY(${-moon.inclinationDeg}deg) ` +
        `rotateZ(${-moon.nodeDeg}deg)`;
    const inversePlane =
      `rotateZ(${moon.nodeDeg}deg) ` +
      `rotateY(${moon.inclinationDeg}deg)`;
    const startTransform = normalizeTransform(
      moon.billboard.motion.keyframes[0].transform,
    );
    const endTransform = normalizeTransform(
      moon.billboard.motion.keyframes[1].transform,
    );
    const orbitPosition = startTransform.match(/translate3d\([^)]+\)/u)?.[0];
    assert.ok(orbitPosition);
    assert.equal(
      startTransform,
      ["rotateZ(0deg)", plane, orbitPosition, "rotateZ(0deg)", inversePlane]
        .filter(Boolean)
        .join(" "),
    );
    assert.equal(
      endTransform,
      [
        "rotateZ(-360deg)",
        plane,
        orbitPosition,
        "rotateZ(360deg)",
        inversePlane,
      ].filter(Boolean).join(" "),
    );
    const orbitDurationSeconds = Number(
      moon.orbitTransform.match(/animation-duration:([\d.]+)s/u)?.[1],
    );
    assert.equal(
      Number(moon.billboard.motion.durationMilliseconds.toFixed(3)),
      Number((orbitDurationSeconds * 1_000).toFixed(3)),
    );
    assert.equal(Number.isFinite(moon.billboard.motion.delayMilliseconds), true);
  }

  const hyperion = PREPARED_SATURN_MOONS.moons.find(({ id }) =>
    id === "hyperion");
  assert.equal(hyperion.sourceModel,
    "openspace-shape-ratios-on-prepared-camera-facing-plane");
  assert.equal(hyperion.textureLeafCount, 1);
  assert.equal(hyperion.solidLeafCount, 0);
  assert.equal(hyperion.shadowLeafCount, 0);
  assert.equal(hyperion.shadow, null);

  const titan = PREPARED_SATURN_MOONS.moons.find(({ id }) => id === "titan");
  assert.equal(titan.leafCount, 1);
  assert.ok(titan.billboard);
  assert.equal(titan.radiusPresentationScale, 1);
  assert.equal(titan.orbitKm, 1_221_900);
  assert.equal(titan.periodDays, 15.945448);
  assert.equal(
    PREPARED_SATURN_MOONS.moons
      .filter(({ id }) => id !== "titan")
      .every(({ radiusPresentationScale }) => radiusPresentationScale === 1.5),
    true,
  );
});

function normalizeTransform(transform) {
  return transform.trim().replace(/\s+/gu, " ");
}

test("includes every prepared moon-shadow density in the runtime closure", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../runtime-assets.json", import.meta.url),
    "utf8",
  ));
  const filenames = new Set(manifest.assets.map(({ filename }) => filename));
  for (const row of PREPARED_SATURN_MOONS.shadowAtlas.runtimeShards.rows) {
    for (const url of [row.assetUrl, row.asset2xUrl]) {
      assert.equal(filenames.has(url.split("/").at(-1)), true, url);
    }
  }
  for (const url of [
    PREPARED_ORBIT_GUIDES.asset.url,
    PREPARED_ORBIT_GUIDES.asset.url2x,
  ]) {
    assert.equal(filenames.has(url.split("/").at(-1)), true, url);
  }
});

test("keeps prepared Saturn moon material out of the parent runtime", async () => {
  const [client, css, head] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../site/SaturnHead.astro", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client,
    /PREPARED_SATURN_MOON|saturn-moon|mountPreparedOrbitGuide|createPreparedOrbitGuideInteraction/u);
  assert.doesNotMatch(css, /saturn-moon/u);
  assert.doesNotMatch(head, /moon/iu);

  const styles = PREPARED_SATURN_MOONS.moons.flatMap(({ leaves, shadow }) => [
    ...leaves.map(({ style }) => style),
    ...(shadow ? [shadow.leaf.style] : []),
  ]);
  for (const style of styles) {
    assert.doesNotMatch(style,
      /(?:-webkit-)?mask|clip-path|filter|gradient|blend-mode/u);
  }
  assert.equal(PREPARED_SATURN_SCENE.counts.moonLeafCount, 300);
  assert.equal(PREPARED_SATURN_SCENE.counts.moonSurfaceLeafCount, 293);
  assert.equal(PREPARED_SATURN_SCENE.counts.moonDotLeafCount, 285);
  assert.equal(PREPARED_SATURN_SCENE.counts.moonShadowLeafCount, 7);
  assert.equal(PREPARED_SATURN_SCENE.counts.moonLabelCount, 8);
  assert.equal(PREPARED_SATURN_SCENE.counts.moonAnimationCount, 8);
});
test("prepares transparent circular moon billboard leaves", async () => {
  const atlas = await sharp(fileURLToPath(new URL(
    "../../../../public/scenes/saturn/saturn-moon-billboards.webp",
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => atlas.data[
    (y * atlas.info.width + x) * atlas.info.channels + 3
  ];

  // Mimas and Titan both keep transparent corners around their prepared discs.
  assert.equal(alphaAt(1, 1), 0);
  assert.equal(alphaAt(34, 34), 255);
  assert.equal(alphaAt(69, 69), 0);
  assert.equal(alphaAt(102, 102), 255);

  for (const moon of PREPARED_SATURN_MOONS.moons) {
    assert.equal(moon.leaves.every(({ tag }) => tag === "s"), true);
    assert.equal(moon.leafCount, 1);
  }
});

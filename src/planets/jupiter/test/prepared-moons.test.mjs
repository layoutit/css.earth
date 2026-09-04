import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import moonCatalog from "../source/moons/jupiter-moons.json" with { type: "json" };
import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_ORBIT_GUIDES } from "../runtime/preparedMoonOrbitArcs.mjs";

const EXPECTED_DETAILED_MOONS = Object.freeze([
  "Io",
  "Europa",
  "Ganymede",
  "Callisto",
]);

test("prepares the complete 115-moon JPL catalog", () => {
  assert.equal(PREPARED_JUPITER_MOONS.schema,
    "cssjupiter-prepared-low-poly-moons@2");
  assert.equal(moonCatalog.counts.confirmed, 115);
  assert.equal(moonCatalog.moons.length, 115);
  assert.deepEqual(PREPARED_JUPITER_MOONS.counts, {
    confirmedMoonCount: 115,
    preparedMoonCount: 115,
    detailedMoonCount: 4,
    minorMoonCount: 111,
    moonCount: 115,
    moonLeafCount: 115,
    moonSurfaceLeafCount: 115,
    moonTextureLeafCount: 4,
    moonSolidLeafCount: 0,
    moonDotLeafCount: 111,
    moonShadowLeafCount: 0,
    moonLabelCount: 57,
    namedMinorMoonCount: 53,
    moonTransformGroupCount: 16,
    moonAnimationCount: 8,
  });
  assert.deepEqual(PREPARED_JUPITER_MOONS.moons.map(({ name }) => name),
    EXPECTED_DETAILED_MOONS);
  assert.deepEqual(
    Object.fromEntries(PREPARED_JUPITER_MOONS.moons.map(({ id, label }) =>
      [id, label.offsetPx])),
    {
      io: [0, 0],
      europa: [25, -20],
      ganymede: [-25, 20],
      callisto: [0, 0],
    },
  );
  assert.equal(PREPARED_JUPITER_MOONS.minorMoonDots.length, 111);
  assert.equal(new Set([
    ...PREPARED_JUPITER_MOONS.moons.map(({ id }) => id),
    ...PREPARED_JUPITER_MOONS.minorMoonDots.map(({ id }) => id),
  ]).size, 115);
});

test("uses prepared PIA01299 billboards instead of faceted solids", async () => {
  const { billboardAtlas, moons } = PREPARED_JUPITER_MOONS;
  assert.deepEqual(billboardAtlas, {
    url: "/scenes/jupiter/jupiter-moon-billboards.webp",
    url2x: "/scenes/jupiter/jupiter-moon-billboards@2x.webp",
    width: 136,
    height: 136,
    width2x: 272,
    height2x: 272,
    tileCount: 4,
    tileSize: 64,
    tileGutter: 2,
    selectedDensityImageCount: 1,
    encoding: "webp-q75-alpha-q100",
  });
  for (const moon of moons) {
    assert.equal(moon.sourceModel,
      "NASA-JPL-DLR-PIA01299-prepared-camera-facing-alpha-plane");
    assert.equal(moon.surfaceTopology, "prepared-camera-facing-alpha-plane");
    assert.equal(moon.leafCount, 1);
    assert.equal(moon.leaves[0].tag, "s");
    assert.match(moon.leaves[0].style,
      /jupiter-moon-billboards(?:@2x)?\.webp/u);
    assert.equal(moon.radiusPresentationScale, 1.5);
  }
  const [one, two] = await Promise.all([
    sharp(fileURLToPath(new URL(
      "../../../../public/scenes/jupiter/jupiter-moon-billboards.webp",
      import.meta.url))).metadata(),
    sharp(fileURLToPath(new URL(
      "../../../../public/scenes/jupiter/jupiter-moon-billboards@2x.webp",
      import.meta.url))).metadata(),
  ]);
  assert.deepEqual([one.width, one.height, two.width, two.height],
    [136, 136, 272, 272]);
  assert.equal(one.hasAlpha, true);
  assert.equal(two.hasAlpha, true);
});

test("prepares every smaller moon as one static retained dot", () => {
  const { presentation, minorMoonDots } = PREPARED_JUPITER_MOONS;
  assert.equal(presentation.minorMoonModel,
    "one-dot-leaf-one-prepared-static-epoch-translate");
  assert.equal(presentation.animatedMinorMoonCount, 0);
  assert.equal(presentation.staticEpochMinorMoonCount, 111);
  assert.equal(presentation.minorMoonLabels,
    "all-IAU-named-catalog-objects");
  assert.equal(presentation.minorMoonLabelWidthModel,
    "prepared-monospace-character-count");
  assert.deepEqual(presentation.minorMoonLabelLayout, {
    model: "prepared-camera-state-greedy-nameplate-collision-layout",
    sampleScenePitchDegrees: [-3.13, 86.87],
    sampleScenePitchStepDegrees: 0.5,
    materialStateCount: 181,
    defaultMaterialStateIndex: 86,
    collisionCountAtSamples: 0,
    reservedDetailedMoonLabelCount: 4,
    detailedMoonEpoch: "prepared-css-animation-start",
    maximumOffsetPx: 169.705627,
    runtimeLayout: false,
    runtimeSelection: "prepared-material-state-index",
    runtimeInterpolation: false,
  });
  assert.equal(presentation.sourceOrbitOrderPreserved, true);
  assert.equal(presentation.runtimeGeometryPreparation, false);
  assert.equal(presentation.runtimeTexturePreparation, false);
  assert.equal(presentation.runtimeJavaScriptWritesPerFrame, 0);
  for (const moon of minorMoonDots) {
    assert.equal(moon.animated, false);
    assert.equal(moon.sourceModel,
      "JPL-mean-elements-prepared-static-epoch-translate");
    assert.match(moon.style,
      /^translate:-?[\d.]+px -?[\d.]+px -?[\d.]+px$/u);
  }
  assert.equal(minorMoonDots.filter(({ label }) => label).length, 53);
  assert.equal(minorMoonDots.filter(({ label }) => label)
    .every(({ name, label }) => label.text === name), true);
  assert.equal(minorMoonDots.filter(({ label }) => label)
    .every(({ label }) =>
      label.widthPx >= 21 && label.widthPx <= 76 &&
      label.offsetPx.length === 2 && label.offsetPx.every(Number.isFinite) &&
      label.anchorTranslate.startsWith("0px ") &&
      label.offsetTransforms.length > 0 &&
      label.offsetTransforms.every((transform) =>
        /^translate\(-?[\d.]+px,-?[\d.]+px\)$/u.test(transform)) &&
      label.offsetTransformIndicesByMaterialState.length === 181 &&
      label.offsetTransformIndicesByMaterialState.every((index) =>
        Number.isSafeInteger(index) && index >= 0 &&
        index < label.offsetTransforms.length)), true);
});

test("prepares collision-free named moon labels for every camera material state", () => {
  const named = PREPARED_JUPITER_MOONS.minorMoonDots.filter(({ label }) => label);
  const zoom = 1.1;
  for (let state = 0; state < 181; state += 1) {
    const totalPitch = state * 0.5 * Math.PI / 180;
    const boxes = named.map((moon) => {
      const transform = moon.label.offsetTransforms[
        moon.label.offsetTransformIndicesByMaterialState[state]
      ];
      const [, transformX, transformY] = transform.match(
        /^translate\((-?[\d.]+)px,(-?[\d.]+)px\)$/u,
      );
      const offsetX = Number(transformX) + moon.label.widthPx / 2;
      const offsetY = Number(transformY) - moon.label.gapPx;
      const x = moon.displayPosition[0] * zoom;
      const y = (
        moon.displayPosition[1] * Math.cos(totalPitch) -
        moon.displayPosition[2] * Math.sin(totalPitch)
      ) * zoom;
      return {
        name: moon.name,
        left: x + offsetX - moon.label.widthPx / 2,
        right: x + offsetX + moon.label.widthPx / 2,
        top: y + moon.label.gapPx + zoom + offsetY,
        bottom: y + moon.label.gapPx + zoom + offsetY + 10,
      };
    });
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        const left = boxes[first];
        const right = boxes[second];
        assert.equal(
          left.left < right.right && left.right > right.left &&
            left.top < right.bottom && left.bottom > right.top,
          false,
          `Prepared labels ${left.name} and ${right.name} overlap at material state ${state}.`,
        );
      }
    }
  }
});

test("keeps prepared moon material out of the parent runtime", async () => {
  const client = await readFile(new URL("../runtime/client.mjs", import.meta.url),
    "utf8");
  assert.doesNotMatch(client, /PREPARED_JUPITER_MOONS|jupiter-moon/u);
  assert.doesNotMatch(client, /matrix3d\(`|DOMMatrix|Math\.cos|Math\.sin/u);
  assert.doesNotMatch(client, /requestAnimationFrame\([^)]*moon/iu);
});

test("retains prepared guide provenance without mounting it in Jupiter", async () => {
  assert.equal(PREPARED_ORBIT_GUIDES.planetId, "jupiter");
  assert.equal(PREPARED_ORBIT_GUIDES.guideCount, 4);
  assert.equal(PREPARED_ORBIT_GUIDES.retainedLeafCount, 4);
  assert.deepEqual(PREPARED_ORBIT_GUIDES.guides.map(({ id }) => id),
    ["io", "europa", "ganymede", "callisto"]);
  assert.equal(PREPARED_ORBIT_GUIDES.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_ORBIT_GUIDES.runtimeJavaScriptWritesPerFrame, 0);
  assert.deepEqual(PREPARED_ORBIT_GUIDES.presentation, {
    baseOpacity: 0.2,
    hoverOpacity: 0.65,
  });
  const client = await readFile(new URL("../runtime/client.mjs", import.meta.url),
    "utf8");
  assert.doesNotMatch(client, /mountPreparedOrbitGuide/u);
  assert.doesNotMatch(client, /createPreparedOrbitGuideInteraction/u);
  assert.match(client, /createPlanetFeatureControls/u);
});

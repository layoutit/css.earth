import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREPARED_MARS_MOONS } from "../runtime/preparedMoons.mjs";

test("prepares the two JPL Mars moons in orbital order", () => {
  assert.equal(PREPARED_MARS_MOONS.schema, "cssmars-prepared-low-poly-moons@3");
  assert.deepEqual(PREPARED_MARS_MOONS.moons.map(({ name }) => name), [
    "Phobos",
    "Deimos",
  ]);
  assert.deepEqual(PREPARED_MARS_MOONS.moons.map(({ orbitKm }) => orbitKm), [
    9_375,
    23_457,
  ]);
  assert.deepEqual(PREPARED_MARS_MOONS.moons.map(({ meanRadiusKm }) =>
    meanRadiusKm), [11.08, 6.2]);
});

test("retains source-textured irregular bodies as one billboard leaf each", () => {
  for (const moon of PREPARED_MARS_MOONS.moons) {
    assert.equal(moon.sourceModel,
      "OpenSpace GLB source-textured prepared camera-facing alpha plane");
    assert.equal(moon.surfaceTopology, "prepared-camera-facing-alpha-plane");
    assert.equal(moon.sourceSha256.length, 64);
    assert.equal(moon.leafCount, 1);
    assert.equal(moon.leaves.every(({ tag }) => tag === "s"), true);
    assert.ok(moon.billboard.sourceTriangleCount > 30_000);
    assert.ok(moon.billboard.sourceVertexCount > 16_000);
    assert.equal(new Set(moon.displayRadii.map((radius) =>
      radius.toFixed(2))).size > 1, true);
  }
  assert.equal(PREPARED_MARS_MOONS.retainedDom.surfaceLeafCount, 2);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.solidLeafCount, 0);
  assert.equal(PREPARED_MARS_MOONS.billboardAtlas.tileCount, 2);
  assert.equal(PREPARED_MARS_MOONS.billboardAtlas.tileSize, 128);
});

test("declares readability scaling and prepared CSS-only transport", () => {
  const { presentation, retainedDom } = PREPARED_MARS_MOONS;
  assert.equal(presentation.radiusPresentationScale, 15);
  assert.equal(presentation.runtimeOrbitalCalculation, false);
  assert.equal(presentation.runtimeGeometryPreparation, false);
  assert.equal(presentation.runtimeLabelGeometry, false);
  assert.equal(presentation.runtimeRasterization, false);
  assert.equal(presentation.sourceEccentricityPublishedButNotApplied, true);
  assert.deepEqual(presentation.mobileDisplayOrbitRange, [235, 250]);
  assert.equal(retainedDom.cssAnimationCount, 4);
  assert.equal(retainedDom.labelCount, 2);
  assert.equal(retainedDom.transformGroupCount, 12);
  assert.match(PREPARED_MARS_MOONS.labelPlaneTransform, /^matrix3d\(.+\)$/u);
  assert.equal(PREPARED_MARS_MOONS.labelReferencePitchDegrees, 40);
  assert.equal(PREPARED_MARS_MOONS.labelReferenceYawDegrees, -105);
  assert.equal(
    presentation.cameraContract,
    "fixed-reference-billboard-with-unbounded-camera-counter-rotation",
  );
  assert.ok(PREPARED_MARS_MOONS.moons.every(({ label }) =>
    typeof label.anchorTranslation === "string" &&
    label.localStyle.includes("--mars-moon-label-transform:") &&
    label.localStyle.includes("--mars-moon-label-transform-mobile:")));
  assert.ok(PREPARED_MARS_MOONS.moons[0].displayOrbitRadius <
    PREPARED_MARS_MOONS.moons[1].displayOrbitRadius);
  assert.ok(PREPARED_MARS_MOONS.moons.every((moon) =>
    moon.mobileDisplayOrbitRadius < moon.displayOrbitRadius &&
    moon.positionTransform.includes("--mars-moon-position:") &&
    moon.positionTransform.includes("--mars-moon-position-mobile:")));
});

test("keeps prepared Mars moon material out of the parent runtime", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /PREPARED_MARS_MOONS|mars-moon/u);
  assert.doesNotMatch(client,
    /preparedMoonPlaneBasis|preparedMoonBasisMatrix|preparedMoonProjectedRadii|preparedMoonLocalLabelMatrix/u);
  assert.doesNotMatch(client, /Math\.(?:cos|sin)/u);
  assert.doesNotMatch(client, /requestAnimationFrame\([^)]*moon/iu);
  assert.doesNotMatch(css, /mars-moon/u);
});

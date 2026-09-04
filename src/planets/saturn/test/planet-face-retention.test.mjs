import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";

test("retains every source longitude with prepared projective backface ownership", () => {
  assert.equal(PREPARED_SATURN_SCENE.schema, "csssaturn-prepared-retained-scene@30");
  const { planetFaceRetention } = PREPARED_SATURN_SCENE;
  assert.equal(
    planetFaceRetention.model,
    "complete-source-longitudes-prepared-projective-backface-ownership",
  );
  assert.equal(planetFaceRetention.longitudeCount, 32);
  const visibility = planetFaceRetention.preparedVisibility;
  assert.equal(visibility.schema, "csssaturn-prepared-body-visibility@1");
  assert.equal(
    visibility.model,
    "prepared-projective-matrix-backface-ownership",
  );
  assert.equal(visibility.leafCount, 452);
  assert.equal(visibility.frameCount, 128);
  assert.equal(visibility.frameMilliseconds, 562.5);
  assert.equal(visibility.bankCount, 9);
  assert.equal(visibility.rangeBankCount, 8);
  assert.equal(visibility.defaultBankIndex, 0);
  assert.equal(visibility.stateStrideBytes, 57);
  assert.equal(visibility.runtimeGeometry, false);
  assert.equal(visibility.runtimeMatrixMath, false);
  assert.equal(visibility.browserBackfaceRetentionAtTransitions, true);
  assert.deepEqual(visibility.phaseSafetyFrames, [-1, 2]);
  const states = Buffer.from(visibility.statesBase64, "base64");
  assert.equal(
    states.byteLength,
    visibility.bankCount * visibility.frameCount * visibility.stateStrideBytes,
  );
  const defaultFrameHiddenLeafCount = Array.from(
    { length: visibility.leafCount },
    (_, leafIndex) => Number(Boolean(
      states[leafIndex >> 3] & (1 << (leafIndex & 7)),
    )),
  ).reduce((sum, hidden) => sum + hidden, 0);
  assert.equal(defaultFrameHiddenLeafCount, 225);

  assert.equal(PREPARED_SATURN_SCENE.bodyBands.length, 16);
  for (const [latitudeIndex, band] of PREPARED_SATURN_SCENE.bodyBands.entries()) {
    assert.equal(band.latitudeIndex, latitudeIndex);
    if (latitudeIndex === 0 || latitudeIndex === 15) {
      assert.equal(band.leaves.length, 2);
      assert.ok(band.leaves.every(({ tag }) => tag === "s"));
      assert.ok(band.leaves.some(({ className }) => className?.includes("saturn-polar-inner")));
      assert.ok(band.leaves.some(({ className }) => className?.includes("saturn-polar-surface")));
    } else {
      assert.equal(band.leaves.length, 32);
    }
  }
});

test("does not prepare or mount the removed inner fill", async () => {
  const { counts } = PREPARED_SATURN_SCENE;
  assert.equal("innerFill" in PREPARED_SATURN_SCENE, false);
  assert.equal("innerFillPolygonCount" in counts, false);
  assert.equal(counts.polygonCount, 1_238);
  const client = await readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(client, /saturn-inner-fill/);
  assert.doesNotMatch(client, /spherePolygons/);
});

test("closes each polar seam under one fixed prepared material plane", async () => {
  const { bodyBands, counts, fixedMaterialPlane, preparedSurface } =
    PREPARED_SATURN_SCENE;
  const polarLeaves = [bodyBands[0], bodyBands[15]].flatMap(({ leaves }) => leaves);
  assert.equal(counts.polarInnerLeafCount, 2);
  assert.equal(counts.polarSurfaceLeafCount, 2);
  assert.equal(counts.polarMaterialLeafCount, 0);
  assert.equal(counts.polarInnerMaterialLeafCount, 0);
  assert.equal(counts.fixedMaterialPlaneLeafCount, 1);
  assert.equal(counts.planetPolygonCount, 453);
  assert.equal(counts.textureLeafCount, 953);
  assert.equal(fixedMaterialPlane.runtimeWork,
    "single-transform-and-address-on-input-change");
  assert.equal(fixedMaterialPlane.leaf.tag, "s");
  assert.match(fixedMaterialPlane.leaf.style,
    /background-image:url\(\/scenes\/saturn\/saturn-orbit-material\.webp\)/);
  assert.equal("blendLeaf" in fixedMaterialPlane, false);
  assert.equal(preparedSurface.polarCaps.assetUrl, "/scenes/saturn/saturn-poles.webp");
  const polarAsset = await readFile(new URL(
    "../../../../public/scenes/saturn/saturn-poles.webp",
    import.meta.url,
  ));
  assert.equal(preparedSurface.polarCaps.assetBytes, polarAsset.byteLength);
  assert.equal(
    preparedSurface.polarCaps.assetSha256,
    createHash("sha256").update(polarAsset).digest("hex"),
  );
  assert.equal(preparedSurface.polarCaps.encoding, "webp-q75-alpha-q100");
  assert.equal(preparedSurface.polarCaps.alphaEncoding, "lossless");
  assert.equal(
    preparedSurface.polarCaps.model,
    "prepared-cassini-north-polar-projection-under-fixed-world-material-plane",
  );
  assert.deepEqual(preparedSurface.polarCaps.northSource.sourceTile, {
    x: 1024,
    y: 0,
    width: 1024,
    height: 1024,
  });
  assert.equal(
    preparedSurface.polarCaps.northSource.sourceSha256,
    "2e9765b2ffada33d74bfbe0443ea0bbf59bb15f27a128b7ba99160fdeb78f177",
  );
  assert.equal(
    preparedSurface.polarCaps.northSource.projection,
    "north-polar-stereographic",
  );
  assert.equal(preparedSurface.polarCaps.northSource.sourceKmPerPixel, 25);
  assert.equal(preparedSurface.polarCaps.northSource.boundaryBlendStart, 0.94);
  assert.equal(preparedSurface.polarCaps.tileCount, 8);
  assert.equal(preparedSurface.polarCaps.atlasWidth, 4096);
  assert.equal(preparedSurface.polarCaps.innerSurfaceLeafCount, 2);
  assert.equal(preparedSurface.polarCaps.innerMaterialLeafCount, 0);
  assert.equal(preparedSurface.polarCaps.innerOverlap, 1.05);
  assert.equal(preparedSurface.polarCaps.innerInset, 2.4);
  assert.equal(
    preparedSurface.polarCaps.innerBoundarySampling,
    "outer-cap-boundary-clamped",
  );
  assert.equal(preparedSurface.polarCaps.fixedWorldMaterial, true);
  assert.equal(preparedSurface.polarCaps.runtimeMath, false);
  for (const leaf of polarLeaves) {
    assert.equal(leaf.tag, "s");
    assert.equal(leaf.leafWidth, 512);
    assert.equal(leaf.leafHeight, 512);
    assert.equal(leaf.lightingOverlay, false);
    assert.match(leaf.style, /background-image:url\(\/scenes\/saturn\/saturn-poles\.webp\)/);
  }
});

test("keeps Saturn's axial tilt on a static parent independent of the camera", () => {
  assert.equal(PREPARED_SATURN_SCENE.camera.state.zoom, 1.1);
  assert.match(PREPARED_SATURN_SCENE.camera.sceneStyle,
    /scale\(0\.022(?:0+2)?\)/);
  assert.equal(
    PREPARED_SATURN_SCENE.preparedMotion.ringPointPresentation.localScale,
    Number((50 / 1.1).toFixed(6)),
  );
  assert.equal(
    PREPARED_SATURN_SCENE.systemTransform,
    "transform:rotateZ(60deg) rotateY(-26.73deg)",
  );
  assert.match(PREPARED_SATURN_SCENE.camera.sceneStyle, /rotateX\(40deg\)/);
  assert.equal(PREPARED_SATURN_SCENE.preparedMotion.obliquityDegrees, 26.73);
  assert.equal(PREPARED_SATURN_SCENE.preparedMotion.obliquityAxis, "source-x");
  assert.equal(
    PREPARED_SATURN_SCENE.preparedMotion.obliquityOwner,
    "retained-saturn-system-parent",
  );
  assert.equal(PREPARED_SATURN_SCENE.preparedMotion.presentationNodeDegrees, -60);
  assert.equal(PREPARED_SATURN_SCENE.preparedMotion.cameraOrbitalElevationDegrees, 50);
  assert.equal(PREPARED_SATURN_SCENE.preparedMotion.cameraRotationXDegrees, 40);
  assert.equal(
    PREPARED_SATURN_SCENE.preparedRingSource.shadowModel.systemTiltDegrees,
    26.73,
  );
  assert.equal(
    PREPARED_SATURN_SCENE.preparedRingSource.shadowModel.systemTiltAxis,
    "source-x",
  );
  assert.equal(
    PREPARED_SATURN_SCENE.preparedRingSource.shadowModel.systemNodeDegrees,
    -60,
  );
});

test("keeps latitude band geometry on one phase under the fixed prepared light", () => {
  assert.equal(
    PREPARED_SATURN_SCENE.preparedMotion.model,
    "nasa-cloud-periods-shared-phase-rotation-under-fixed-world-material-plane",
  );
  assert.deepEqual(
    PREPARED_SATURN_SCENE.bodyBands.map(({ visualRotationSeconds }) =>
      visualRotationSeconds),
    Array(16).fill(72),
  );
  assert.ok(new Set(PREPARED_SATURN_SCENE.bodyBands.map(
    ({ realRotationSeconds }) => realRotationSeconds,
  )).size > 1);
});

test("keeps the complete retained system fixed around its tilt transform", async () => {
  const css = await readFile(new URL("../runtime/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /saturn-system-drift/);
  assert.doesNotMatch(css, /\.saturn-system\s*\{[^}]*animation-/s);
});

test("keeps playback prepared while orbit input selects one dense material state", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /weatherPlayer|createPreparedSaturnWeatherPlayer/);
  assert.match(client,
    /publishAtlasPresentation\(\s*mounted\.fixedMaterialLeaf,\s*materialPresentation/u);
  assert.match(css,
    /\.saturn-body\s*\{[^}]*animation-name:\s*saturn-body-spin;/su);
  assert.match(css,
    /\.saturn-ring-orbit\s*\{[^}]*animation-name:\s*saturn-ring-orbit;/su);
});

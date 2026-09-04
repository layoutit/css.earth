import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createHash } from "node:crypto";

import sharp from "sharp";

import {
  renderMarker,
  validateMarkerDescriptor,
} from "../../../navigation/marker-recipe.mjs";
import { verifyRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";
import { PREPARED_URANUS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_ORBIT_GUIDES } from "../runtime/preparedMoonOrbitArcs.mjs";
import { PREPARED_URANUS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "../runtime/preparedSceneRuntime.mjs";
import { PREPARED_URANUS_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_URANUS_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_URANUS_PANEL } from "../site/preparedPanel.mjs";
import { PREPARED_URANUS_TITLE } from "../site/preparedTitle.mjs";
import uranusNavigationMarker from "../tools/navigation-marker.mjs";
import { verifyUranusSourceManifest } from "../tools/source-manifest.mjs";

test("verifies the complete Uranus source closure", async () => {
  assert.deepEqual(await verifyUranusSourceManifest(), {
    inputCount: 17,
    generatedIntermediateCount: 0,
    documentCount: 2,
  });
});

test("preserves accepted Uranus navigation marker pixels at both densities", async () => {
  assert.equal(validateMarkerDescriptor(uranusNavigationMarker), uranusNavigationMarker);
  for (const [tileSize, hash] of [[16, "3921a22517ad9b52becf4490254d3361c42a2a4ef7526ff5fa33a7cf65b2bc25"], [32, "435eff78c4b0b90d1f79058e3bcda7ec53a073fa4077e40899e32dafacd1a7c7"]]) {
    const bytes = await renderMarker(uranusNavigationMarker, { sourcePath: fileURLToPath(new URL("../source/navigation/uranus.jpg", import.meta.url)), tileSize });
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  }
});

test("prepares evidence-backed Uranus shell content", () => {
  assert.equal(PREPARED_URANUS_TITLE.label, "Uranus");
  assert.equal(PREPARED_URANUS_PANEL.facts[1].value, "51,118 km");
  assert.equal(PREPARED_URANUS_PANEL.moonCountPolicy.editorial, 28);
  assert.equal(PREPARED_URANUS_PANEL.moonCountPolicy.rendered, 29);
});

test("prepares retained scene data without runtime derivation", async () => {
  assert.equal(PREPARED_URANUS_SCENE.runtimeGeometry, false);
  assert.equal(PREPARED_URANUS_SCENE.runtimeRasterization, false);
  assert.equal(PREPARED_URANUS_SCENE.schema,
    "cssuranus-prepared-retained-scene@1");
  assert.equal(PREPARED_URANUS_RUNTIME_SCENE.schema,
    "cssuranus-prepared-runtime-scene@1");
  assert.equal(PREPARED_URANUS_SCENE.counts.confirmedMoonCount, 29);
  assert.equal(PREPARED_URANUS_SCENE.rings.length, 13);
  assert.deepEqual(PREPARED_ORBIT_GUIDES.presentation, {
    baseOpacity: 0.2,
    hoverOpacity: 0.65,
  });
  assert.equal(PREPARED_URANUS_STARFIELD.faces.length, 6);
  assert.equal("sun" in PREPARED_URANUS_STARFIELD, false);
  assert.equal(PREPARED_URANUS_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_URANUS_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_URANUS_SKY_SUN.billboard, true);
  assert.deepEqual(PREPARED_URANUS_SCENE.bodyBands.map(({ leaves }) =>
    leaves.length), [2, ...Array(22).fill(48), 2]);
  const bodyLeaves = PREPARED_URANUS_SCENE.bodyBands.flatMap(({ leaves }) => leaves);
  assert.equal(bodyLeaves.length, 1_060);
  assert.ok(bodyLeaves.every(({ style }) =>
    style.startsWith("transform:matrix3d(")));
  assert.equal(PREPARED_URANUS_SCENE.ringPlane.style.includes("matrix3d("), true);
  assert.equal(PREPARED_URANUS_SCENE.ringShadowPlane.style.includes("matrix3d("), true);
  assert.equal(PREPARED_URANUS_SCENE.fixedMaterialPlane.leaf.style.includes("matrix3d("), true);
  assert.equal(PREPARED_URANUS_SCENE.counts.planetPolygonCount, 1_061);
  assert.equal(PREPARED_URANUS_SCENE.provenance.body.inventedLocalFeatures, false);
  assert.equal(PREPARED_URANUS_SCENE.provenance.body.baselineAuthority,
    "NASA/JPL-Caltech Voyager 2 PIA18182 full-disc observation");
  assert.deepEqual(PREPARED_URANUS_SCENE.provenance.body.baselineColor,
    [194, 232, 235]);
  assert.equal(PREPARED_URANUS_SCENE.provenance.body.transitionRows, 12);
  assert.equal(PREPARED_URANUS_SCENE.fixedMaterialPlane.model,
    "prepared-front-depth-biased-camera-facing-material-plane");
  assert.equal(PREPARED_URANUS_SCENE.fixedMaterialPlane.depthBias, 0.5);
  assert.deepEqual(PREPARED_URANUS_SCENE.fixedMaterialPlane.silhouetteBacking, {
    model: "prepared-horizontal-resolved-limb-backing",
    horizontalScale: 1.012,
    verticalScale: 0.988,
    viewAlignmentFadeStart: 0.14,
    viewAlignmentOpaqueAt: 0.06,
    sideDirectionFadeStart: 0.8,
    sideDirectionOpaqueAt: 0.9,
    runtimeGeometry: false,
  });
  for (const [density, boundaryX] of [[1, 28], [2, 56]]) {
    const material = PREPARED_URANUS_SCENE.assets.fixedMaterial.normal[density];
    const { data, info } = await sharp(fileURLToPath(new URL(
      `../../../../public${material.url}`,
      import.meta.url,
    ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const centerX = 256 * density;
    const centerY = 256 * density;
    const boundaryY = 29 * density;
    assert.equal(data[(centerY * info.width + boundaryX - 1) * 4 + 3], 0,
      `DPR ${density} Uranus limb exterior remains transparent`);
    assert.equal(data[(centerY * info.width + boundaryX) * 4 + 3], 255,
      `DPR ${density} Uranus limb backing resolves the outer chord`);
    assert.equal(data[((boundaryY - 1) * info.width + centerX) * 4 + 3], 0,
      `DPR ${density} Uranus top remains unexpanded`);
    assert.ok(data[(boundaryY * info.width + centerX) * 4 + 3] >= 200,
      `DPR ${density} Uranus top resolves at the prepared inset boundary`);
  }
  assert.equal(PREPARED_URANUS_SCENE.preparedLighting.mode,
    "prepared-view-bank-shared-scene-single-material-plane-orbit-projection");
  assert.equal(PREPARED_URANUS_SCENE.preparedLighting.frameCount, 256);
  assert.equal(PREPARED_URANUS_SCENE.preparedLighting.rowCount, 16);
  assert.equal(PREPARED_URANUS_SCENE.preparedLighting.frameSize, 256);
  assert.equal(PREPARED_URANUS_SCENE.preparedLighting
    .foregroundRingOrdering.model,
  "prepared-ring-rgb-over-material-with-material-alpha-retained");
  assert.ok(PREPARED_URANUS_SCENE.preparedLighting
    .foregroundRingOrdering.compositedTexelCount > 0);
  assert.ok(PREPARED_URANUS_SCENE.preparedLighting
    .foregroundRingOrdering.ringShadowedTexelCount > 0);
  for (const lens of ["normal", "methane", "near-infrared"]) {
    assert.equal(PREPARED_URANUS_SCENE.assets.materialViewBank[lens][1]
      .rows.length, 16);
    assert.equal(PREPARED_URANUS_SCENE.assets.materialViewBank[lens][2]
      .rows.length, 16);
    assert.equal(PREPARED_URANUS_SCENE.assets.materialViewBank[lens][1]
      .frameRawSha256.length, 256);
    assert.notEqual(PREPARED_URANUS_SCENE.assets.materialViewBank[lens][1]
      .frameRawSha256[0], PREPARED_URANUS_SCENE.assets
      .materialViewBank[lens][1].frameRawSha256[255]);
  }
  assert.ok(PREPARED_URANUS_SCENE.moons.moons.every((moon) =>
    moon.phaseQualification ===
      "JPL mean anomaly propagated to the fixed presentation epoch using the source mean period" &&
    moon.presentationEpoch === "2026-08-30.5 TDB"));
  assert.ok(PREPARED_URANUS_SCENE.moons.moons.every((moon) =>
    moon.orbitTransform.includes(`rotateY(${-moon.inclinationDeg}deg)`) &&
    moon.orbitTransform.includes(`rotateZ(${-moon.nodeDeg}deg)`) &&
    moon.orbitTransform.includes(`animation-delay:${moon.animationDelaySeconds}s`) &&
    moon.billboard.counterTransform.includes(
      `--uranus-moon-orbit-inclination:${moon.inclinationDeg}deg`,
    ) &&
    moon.billboard.counterTransform.includes(
      `--uranus-moon-orbit-node:${moon.nodeDeg}deg`,
    ) &&
    moon.bodyTransform.startsWith("transform:translate3d(") &&
    moon.bodyTransform.endsWith("px,0px,0px)")));
  assert.deepEqual(PREPARED_URANUS_SCENE.moons.moons
    .filter(({ major }) => major).map(({ displayOrbitRadius }) =>
      displayOrbitRadius), [650, 791.11, 912.46, 1_093.59, 1_200]);
  assert.deepEqual(PREPARED_URANUS_SCENE.moons.moons
    .filter(({ major }) => major).map(({ meanRadiusKm, portraitDiameter }) =>
      [meanRadiusKm, portraitDiameter]), [
    [235.8, 26],
    [578.9, 65],
    [584.7, 65],
    [788.9, 88],
    [761.4, 85],
  ]);
  assert.equal(PREPARED_URANUS_SCENE.assets.moonAtlas[1].width, 480);
  assert.equal(PREPARED_URANUS_SCENE.assets.moonAtlas[1].height, 192);
  assert.equal(PREPARED_URANUS_SCENE.assets.moonAtlas[2].width, 960);
  assert.equal(PREPARED_URANUS_SCENE.assets.moonAtlas[2].height, 384);
  assert.equal(PREPARED_URANUS_SCENE.moons.counts.billboardCount, 29);
  assert.equal(PREPARED_URANUS_SCENE.moons.counts.shadowLeafCount, 5);
  assert.equal(PREPARED_URANUS_SCENE.counts.moonLeafCount, 34);
  assert.equal(PREPARED_URANUS_SCENE.counts.majorMoonShadowLeafCount, 5);
  assert.ok(PREPARED_URANUS_RUNTIME_SCENE.moons.moons.every(
    ({ billboard }) => billboard?.counterTransform,
  ));
  assert.ok(PREPARED_URANUS_RUNTIME_SCENE.moons.moons
    .filter(({ major }) => major).every(({ leaves, label, shadow }) =>
      leaves.length === 2 &&
      leaves[1].className === "uranus-moon-shadow" &&
      label?.style.startsWith("top:") &&
      shadow?.leafCount === 1));
  assert.equal(PREPARED_URANUS_LENSES.runtimeFilters, false);
  assert.deepEqual(PREPARED_URANUS_LENSES.controls.map(({ id }) => id), [
    "normal", "methane", "near-infrared",
  ]);
  for (const lens of PREPARED_URANUS_LENSES.controls) {
    const { data, info } = await sharp(fileURLToPath(new URL(
      `../../../../public${lens.thumbnailUrl}`,
      import.meta.url,
    ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 64);
    assert.equal(info.height, 64);
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) {
      assert.equal(data[(y * info.width + x) * 4 + 3], 255,
        `${lens.id} thumbnail corner ${x},${y}`);
    }
  }
});

test("keeps every declared Uranus runtime asset exact", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../runtime-assets.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.assets.length, 112);
  await verifyRuntimeAssetClosure({
    planetId: "uranus",
    manifest,
    root: fileURLToPath(new URL("../../../../public/scenes/uranus/", import.meta.url)),
  });
});

test("bakes physical portrait scale and non-empty observed shadow layers", async () => {
  const sourcePath = fileURLToPath(new URL(
    "../source/moons/pia01361-major-moons.jpg",
    import.meta.url,
  ));
  const crops = [
    { left: 80, top: 322, width: 142, height: 142 },
    { left: 470, top: 250, width: 300, height: 300 },
    { left: 970, top: 220, width: 370, height: 370 },
    { left: 1_475, top: 178, width: 420, height: 420 },
    { left: 2_000, top: 177, width: 420, height: 420 },
  ];
  const diameters = [26, 65, 65, 88, 85];
  const { data, info } = await sharp(fileURLToPath(new URL(
    "../../../../public/scenes/uranus/uranus-moon-billboards.webp",
    import.meta.url,
  ))).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 480);
  assert.equal(info.height, 192);
  const occupiedWidths = [];
  const shadowAlphaTotals = [];
  let maximumCompositeChannelError = 0;
  let compositeChannelErrorTotal = 0;
  let compositeChannelCount = 0;
  for (let tileIndex = 0; tileIndex < 5; tileIndex += 1) {
    const diameter = diameters[tileIndex];
    const { data: sourceRgb } = await sharp(sourcePath)
      .extract(crops[tileIndex])
      .resize(diameter, diameter, {
        fit: "contain",
        kernel: sharp.kernel.lanczos3,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let minimumX = 96;
    let maximumX = -1;
    let shadowAlpha = 0;
    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const atlasX = tileIndex * 96 + x;
        const portraitAlpha = data[(y * info.width + atlasX) * 4 + 3];
        shadowAlpha += data[((y + 96) * info.width + atlasX) * 4 + 3];
        if (portraitAlpha <= 5) continue;
        minimumX = Math.min(minimumX, x);
        maximumX = Math.max(maximumX, x);
      }
    }
    occupiedWidths.push(maximumX - minimumX + 1);
    shadowAlphaTotals.push(shadowAlpha);
    const inset = Math.floor((96 - diameter) / 2);
    for (let y = 0; y < diameter; y += 1) {
      for (let x = 0; x < diameter; x += 1) {
        const sourceOffset = (y * diameter + x) * 3;
        const atlasX = tileIndex * 96 + inset + x;
        const atlasY = inset + y;
        const baseOffset = (atlasY * info.width + atlasX) * 4;
        const shadowOffset = ((atlasY + 96) * info.width + atlasX) * 4;
        const brightness = Math.max(
          sourceRgb[sourceOffset],
          sourceRgb[sourceOffset + 1],
          sourceRgb[sourceOffset + 2],
        );
        const sourceAlpha = Math.max(0, Math.min(255, (brightness - 2) * 32)) /
          255;
        const baseAlpha = data[baseOffset + 3] / 255;
        const shadowLayerAlpha = data[shadowOffset + 3] / 255;
        for (let channel = 0; channel < 3; channel += 1) {
          const expected = sourceRgb[sourceOffset + channel] * sourceAlpha;
          const actual = data[baseOffset + channel] * baseAlpha *
            (1 - shadowLayerAlpha);
          const error = Math.abs(expected - actual);
          maximumCompositeChannelError = Math.max(
            maximumCompositeChannelError,
            error,
          );
          compositeChannelErrorTotal += error;
          compositeChannelCount += 1;
        }
      }
    }
  }
  assert.deepEqual(occupiedWidths.slice(0, 4), [26, 65, 65, 88]);
  assert.ok(shadowAlphaTotals.every((total) => total > 0));
  assert.ok(maximumCompositeChannelError < 0.7);
  assert.ok(compositeChannelErrorTotal / compositeChannelCount < 0.13);
});

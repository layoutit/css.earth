import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import sharp from "sharp";

import { PREPARED_NEPTUNE_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_ORBIT_GUIDES } from
  "../runtime/preparedMoonOrbitArcs.mjs";
import { PREPARED_NEPTUNE_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_NEPTUNE_ORBIT_BANK } from "../runtime/preparedOrbitBank.mjs";
import { PREPARED_NEPTUNE_SCENE } from "../runtime/preparedScene.mjs";

test("publishes Neptune with Saturn's retained PolyCSS planet structure", () => {
  const scene = PREPARED_NEPTUNE_SCENE;
  assert.equal(scene.schema, "cssneptune-prepared-runtime-scene@1");
  assert.deepEqual(scene.counts, {
    bodyLeafCount: 724,
    polarSurfaceLeafCount: 2,
    polarInnerLeafCount: 2,
    fixedMaterialPlaneLeafCount: 1,
    ringLeafCount: 1,
    moonCount: 16,
    detailedMoonCount: 8,
    textureLeafCount: 726,
  });
  assert.equal(scene.camera.stateCount, 8_901);
  assert.equal(scene.camera.stateStepDegrees, 0.01);
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.stateCount, 8_901);
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.schema,
    "cssneptune-prepared-orbit-bank@3");
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.encoding,
    "gzip-float64-le-column-major-variable-matrix-coefficients");
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.asset.url,
    "/scenes/neptune/neptune-orbit-bank.f64z");
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.runtimeMatrixConstructionForPitch,
    false);
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.runtimeMatrixConstructionForZoom,
    true);
  assert.equal(PREPARED_NEPTUNE_ORBIT_BANK.materialStateCount, 256);
  assert.equal(
    PREPARED_NEPTUNE_ORBIT_BANK.runtimeMaterialMatrixConstructionForPitch,
    false,
  );
  assert.equal(scene.ring.outerRadiusKm, 62_933);
  assert.equal(scene.ring.source, "NASA PDS Rings Node Neptune table");
  assert.equal(scene.moonPresentation.billboardModel,
    "prepared-orbit-counter-rotation-with-camera-and-system-counter-rotation");
  assert.match(scene.ring.leaf.style, /--polycss-atlas-width:1024px/u);
  assert.match(scene.ring.leaf.style, /--polycss-atlas-height:1024px/u);
  assert.match(scene.ring.leaf.style, /background-size:1024px 1024px/u);
  assert.equal(scene.surfacePreparation.runtimeImageProcessing, false);
  assert.deepEqual(scene.surfacePreparation.seamRepair, {
    model: "prepared-zero-seam-bleed-with-compositor-overlap",
    seamBleed: 0,
    presentationOverlap: 0.05,
    rasterGutter: 18,
    rasterOverscan: 0,
    runtimeEdgeDiscovery: false,
  });
  assert.match(scene.surfacePreparation.unobservedNorthPolarTreatment,
    /source-derived extrapolation from the \+30 degree latitude row/u);
  assert.equal(scene.surfacePreparation.retainedSurface,
    "724 prepared projective PolyCSS surface leaves plus one prepared " +
      "projective PolyCSS material leaf");
  assert.equal(scene.fixedMaterialPlane.leaf.tag, "s");
  assert.match(scene.fixedMaterialPlane.leaf.style, /matrix3d\(/u);
  assert.match(scene.fixedMaterialPlane.leaf.style, /background-image:url\(/u);
  assert.equal(scene.surfacePreparation.fixedMaterialPresentation,
    "retained s leaf in the shared PolyCSS scene for body-ring-moon depth " +
      "sorting; no ordinary image or disk element");
  assert.equal(scene.fixedMaterialPlane.model,
    "prepared-transparent-front-tangent-depth-plane");
  assert.equal(scene.fixedMaterialPlane.runtimeWork,
    "single-transform-and-prepared-address-on-input-change");
  assert.deepEqual(scene.preparedLighting, {
    mode: "prepared-view-bank-shared-scene-transparent-material-overlay",
    surfaceOwner: "724 retained source-textured PolyCSS face leaves",
    overlayModel:
      "saturn-schema-directional-attenuation-and-source-derived-atmospheric-limb-over-retained-face-textures",
    worldLightDirection: [0.42, -0.73, 0.54],
    ambientFraction: 0.22,
    atmosphereColorModel:
      "true-colour-calibrated-normal-or-declared-false-colour-source-bright-tail-chromaticity",
    fullColorSurfaceInMaterial: false,
    runtimeLightingMath: false,
    runtimeRasterization: false,
  });
  const normal = PREPARED_NEPTUNE_LENSES.controls.find(({ id }) =>
    id === "normal");
  assert.equal(normal.preparedMaterial.trueColorCalibration.model,
    "prepared-per-channel-affine-mean-standard-deviation-match");
  assert.equal(
    normal.preparedMaterial.trueColorCalibration.runtimeColorProcessing,
    false,
  );
  assert.deepEqual(
    normal.preparedMaterial.trueColorCalibration.reference,
    {
      source: "Irwin et al. 2024 true-colour Neptune reconstruction",
      credit: "Patrick Irwin, University of Oxford, and NASA",
      distribution: "Royal Astronomical Society CC BY 4.0",
      sourcePath:
        "source/color/ras-oxford-neptune-true-colors-2024.jpg",
    },
  );
});

test("ships the prepared Neptune orbit bank as an exact binary asset",
  async () => {
    const descriptor = PREPARED_NEPTUNE_ORBIT_BANK;
    const encoded = await readFile(new URL(
      "../../../../public/scenes/neptune/neptune-orbit-bank.f64z",
      import.meta.url,
    ));
    assert.equal(encoded.byteLength, descriptor.asset.byteLength);
    assert.equal(createHash("sha256").update(encoded).digest("hex"),
      descriptor.asset.sha256);
    const decoded = gunzipSync(encoded);
    assert.equal(decoded.byteLength, descriptor.decodedByteLength);
    assert.equal(decoded.byteLength,
      descriptor.valueCount * Float64Array.BYTES_PER_ELEMENT);
    assert.deepEqual(descriptor.sceneVariableMatrixIndexes,
      [0, 1, 2, 4, 5, 6, 8, 9, 10]);
    assert.deepEqual(descriptor.materialVariableMatrixIndexes,
      [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]);
  });

test("keeps full-color Neptune imagery on faces, not the material overlay",
  async () => {
    const lens = PREPARED_NEPTUNE_LENSES.controls.find(({ id }) =>
      id === "normal");
    assert.ok(lens);
    await assertPreparedMaterialOverlay(new URL(
      "../../../../public/scenes/neptune/neptune-material-normal.webp",
      import.meta.url,
    ), lens.preparedMaterial.atmosphereColor, true);
    await assertPreparedMaterialOverlay(new URL(
      "../../../../public/scenes/neptune/" +
        "neptune-orbit-material-normal-row-06.webp",
      import.meta.url,
    ), lens.preparedMaterial.atmosphereColor, false);

    const { data } = await sharp(fileURLToPath(new URL(
      "../../../../public/scenes/neptune/neptune-surface-normal.webp",
      import.meta.url,
    ))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.ok(Math.max(...data.subarray(0, 65_536)) > 0,
      "The retained face atlas must carry visible source color.");

    const calibrated = await sharp(fileURLToPath(new URL(
      "../../../../public/scenes/neptune/neptune-surface-normal.webp",
      import.meta.url,
    ))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sums = [0, 0, 0];
    let sampleCount = 0;
    for (let sourceY = 600; sourceY < 920; sourceY += 1) {
      const band = Math.floor(sourceY / 72);
      const packedY = band * 108 + 18 + sourceY % 72;
      for (let packedX = 18; packedX < 2_898; packedX += 1) {
        const offset = (packedY * calibrated.info.width + packedX) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          sums[channel] += calibrated.data[offset + channel];
        }
        sampleCount += 1;
      }
    }
    const preparedMean = sums.map((sum) => Math.round(sum / sampleCount));
    assert.ok(preparedMean.every((value, channel) =>
      Math.abs(value - [174, 220, 238][channel]) <= 1),
    "The normal lens must retain its prepared pale-blue true-colour balance.");
  });

test("binds every Neptune lens to prepared DPR assets", () => {
  assert.equal(PREPARED_NEPTUNE_LENSES.schema,
    "cssneptune-prepared-lenses@1");
  assert.equal(PREPARED_NEPTUNE_LENSES.defaultLens, "normal");
  assert.equal(PREPARED_NEPTUNE_LENSES.runtimeFilters, false);
  assert.equal(PREPARED_NEPTUNE_LENSES.runtimeRasterization, false);
  assert.deepEqual(PREPARED_NEPTUNE_LENSES.controls.map(({ id }) => id), [
    "normal",
    "methane",
    "near-infrared",
  ]);
  for (const lens of PREPARED_NEPTUNE_LENSES.controls) {
    assert.match(lens.surfaceUrl, new RegExp(`neptune-surface-${lens.id}\\.webp$`, "u"));
    assert.match(lens.surface2xUrl,
      new RegExp(`neptune-surface-${lens.id}@2x\\.webp$`, "u"));
    assert.match(lens.materialUrl,
      new RegExp(`neptune-material-${lens.id}\\.webp$`, "u"));
    assert.equal(lens.materialLeaf.tag, "s");
    assert.match(lens.materialLeaf.style, /background-image:url\(/u);
    assert.equal("material2xUrl" in lens, false);
    assert.equal(lens.orbitMaterial.schema,
      "cssneptune-prepared-orbit-material@1");
    assert.equal(lens.orbitMaterial.rows.length, 16);
    assert.equal(lens.orbitMaterial.presentations.length, 256);
    assert.equal(lens.orbitMaterial.runtimeRasterization, false);
    assert.ok(lens.orbitMaterial.presentations.every(({ assetUrl }) =>
      assetUrl.startsWith("/scenes/neptune/neptune-orbit-material-")));
  }
  assert.equal(PREPARED_NEPTUNE_LENSES.controls[1].falseColor, true);
  assert.equal(PREPARED_NEPTUNE_LENSES.controls[2].falseColor, true);
});

test("preserves the source-bound 16-moon catalog and Triton's retrograde orbit",
  () => {
    assert.equal(PREPARED_NEPTUNE_MOONS.schema, "cssneptune-prepared-moons@1");
    assert.equal(PREPARED_NEPTUNE_MOONS.count, 16);
    const triton = PREPARED_NEPTUNE_MOONS.moons.find(({ name }) =>
      name === "Triton");
    assert.ok(triton);
    assert.equal(triton.radiusKm, 1352.6);
    assert.equal(triton.retrograde, true);
    assert.equal(triton.meanAnomalyDegrees, 63);
    assert.equal(triton.phaseDegrees, 63);
    assert.equal(triton.inclinationDegrees, 157.3);
    assert.equal(triton.nodeDegrees, 178.1);
    assert.equal(triton.displayOrbitRadius, 490.652);
    assert.match(triton.orbitStyle,
      /rotateY\(-157\.3deg\) rotateZ\(-178\.1deg\)/u);
    assert.doesNotMatch(triton.orbitStyle, /animation-direction/u);
    assert.match(triton.presentationStyle,
      /--neptune-moon-orbit-inclination:157\.3deg/u);
    assert.match(triton.presentationStyle,
      /--neptune-moon-orbit-node:178\.1deg/u);
    assert.match(triton.presentationStyle,
      /--neptune-camera-pitch:40deg/u);
    assert.match(triton.presentationStyle,
      /--neptune-system-tilt:-28\.32deg/u);
    assert.equal(new Set(PREPARED_NEPTUNE_MOONS.moons.map(({ id }) => id)).size,
      16);
  });

test("prepares Saturn-style retained orbit guide leaves for major moons", () => {
  assert.equal(PREPARED_ORBIT_GUIDES.schema,
    "cssearth-prepared-orbit-guides@1");
  assert.equal(PREPARED_ORBIT_GUIDES.planetId, "neptune");
  assert.equal(PREPARED_ORBIT_GUIDES.guideCount, 8);
  assert.equal(PREPARED_ORBIT_GUIDES.retainedLeafCount, 8);
  assert.equal(PREPARED_ORBIT_GUIDES.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_ORBIT_GUIDES.runtimeJavaScriptWritesPerFrame, 0);
  assert.deepEqual(PREPARED_ORBIT_GUIDES.presentation, {
    baseOpacity: 0.2,
    hoverOpacity: 0.65,
  });
  assert.ok(PREPARED_ORBIT_GUIDES.guides.every(({ leaf }) =>
    leaf.tag === "s" && leaf.style.startsWith("transform:matrix3d(")));
});

async function assertPreparedMaterialOverlay(
  url,
  atmosphereColor,
  requireExactAtmosphereChromaticity,
) {
  const { data, info } = await sharp(fileURLToPath(url)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  let minimumAlpha = 255;
  let maximumAlpha = 0;
  let atmosphereSampleCount = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const rgb = [data[offset], data[offset + 1], data[offset + 2]];
    const maximumRgb = Math.max(...rgb);
    if (maximumRgb >= 32 && data[offset + 3] > 0 &&
        requireExactAtmosphereChromaticity) {
      atmosphereSampleCount += 1;
      const expectedMaximum = Math.max(...atmosphereColor);
      for (let channel = 0; channel < 3; channel += 1) {
        assert.ok(Math.abs(
          rgb[channel] / maximumRgb -
          atmosphereColor[channel] / expectedMaximum,
        ) < 0.03,
        "The overlay may contain only its prepared atmosphere chromaticity.");
      }
    }
    minimumAlpha = Math.min(minimumAlpha, data[offset + 3]);
    maximumAlpha = Math.max(maximumAlpha, data[offset + 3]);
  }
  assert.equal(minimumAlpha, 0);
  if (requireExactAtmosphereChromaticity) {
    assert.ok(atmosphereSampleCount > 100,
      "The prepared atmospheric limb must be present.");
  }
  assert.ok(maximumAlpha > 0 && maximumAlpha < 255,
    "A lighting overlay must remain transparent and non-opaque.");
}

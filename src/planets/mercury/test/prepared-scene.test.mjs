import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PREPARED_MERCURY_ASSETS } from "../runtime/preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_MERCURY_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MERCURY_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_MERCURY_STARFIELD } from "../runtime/preparedStarfield.mjs";

test("publishes one prepared retained Mercury scene", () => {
  assert.equal(
    PREPARED_MERCURY_SCENE.schema,
    "cssmercury-prepared-retained-scene@3",
  );
  assert.equal(PREPARED_MERCURY_SCENE.bodyLeaves.length, 452);
  assert.equal(PREPARED_MERCURY_SCENE.counts.bodyLeafCount, 452);
  assert.equal(PREPARED_MERCURY_SCENE.preparedSurface.longitudeSegments, 32);
  assert.equal(PREPARED_MERCURY_SCENE.camera.horizontalOrbit, true);
  assert.equal(PREPARED_MERCURY_SCENE.camera.pitchBounded, false);
  assert.equal(PREPARED_MERCURY_SCENE.camera.yawBounded, false);
  assert.equal(
    PREPARED_MERCURY_SCENE.camera.cameraModel,
    "accumulated-matrix3d",
  );
  assert.equal(
    PREPARED_MERCURY_SCENE.camera.defaultControlPitchDegrees,
    89 * (1 - 40 / 65),
  );
  assert.equal(PREPARED_MERCURY_SCENE.camera.defaultControlYawDegrees, -105);
  assert.equal(PREPARED_MERCURY_SCENE.camera.responsiveFit.model,
    "continuous-aspect-smoothstep");
  assert.equal(PREPARED_MERCURY_SCENE.camera.runtimeGeometryDerivation, false);
  assert.equal(PREPARED_MERCURY_SCENE.material.runtimeLighting, false);
  assert.equal(PREPARED_MERCURY_SCENE.material.frameCount, 256);
  assert.equal(PREPARED_MERCURY_SCENE.material.defaultFrame, 230);
  assert.equal(PREPARED_MERCURY_SCENE.bodyTransform, "rotateZ(-118deg)");
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.schema,
    "cssmercury-prepared-cutaway@1",
  );
  assert.equal(PREPARED_MERCURY_SCENE.interior.leafCount, 446);
  assert.equal(PREPARED_MERCURY_SCENE.interior.outerBodyLeaves.length, 310);
  assert.equal(PREPARED_MERCURY_SCENE.interior.coreLeaves.length, 134);
  assert.equal(PREPARED_MERCURY_SCENE.interior.coreLatitudeSegments, 8);
  assert.equal(PREPARED_MERCURY_SCENE.interior.coreLongitudeSegments, 32);
  assert.equal(PREPARED_MERCURY_SCENE.interior.cutaway.removedLongitudeCount, 10);
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.cutaway.removedCoreLongitudeCount,
    10,
  );
  assert.equal(PREPARED_MERCURY_SCENE.interior.sectionLeaves.length, 2);
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.outerBodyLeaves.filter((leaf) =>
      leaf.className.includes("mercury-cutaway-outer-pole")).length,
    2,
  );
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.coreLeaves.filter((leaf) =>
      leaf.className.includes("mercury-interior-pole")).length,
    2,
  );
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.metallicCoreRadiusFraction,
    0.85,
  );
  assert.equal(PREPARED_MERCURY_ASSETS.interior.outerShellThicknessKm, 366);
  assert.match(
    PREPARED_MERCURY_ASSETS.interior.presentationQualification,
    /illustrative presentation choices/u,
  );
  assert.match(
    PREPARED_MERCURY_ASSETS.interior.outerSurfaceUrl,
    /mercury-interior-outer\.webp$/u,
  );
  assert.deepEqual(PREPARED_MERCURY_ASSETS.interior.sectionDimensions, {
    width: 2048,
    height: 2048,
  });
  assert.match(
    PREPARED_MERCURY_ASSETS.interior.corePolesUrl,
    /mercury-interior-core-poles\.webp$/u,
  );
  assert.deepEqual(PREPARED_MERCURY_ASSETS.interior.cutaway, {
    centerLongitudeDegrees: -56.25,
    widthDegrees: 112.5,
  });
  assert.equal(
    PREPARED_MERCURY_ASSETS.interior.publishedApproximateOuterShellThicknessKm,
    400,
  );
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.runtimeRasterization, false);
  assert.equal(PREPARED_MERCURY_LENSES.runtimeRasterization, false);
  assert.equal(
    PREPARED_MERCURY_STARFIELD.schema,
    "cssearth-prepared-cubic-sky@2",
  );
  assert.equal(PREPARED_MERCURY_STARFIELD.standard,
    "cssearth-cubic-sky-standard@2");
  assert.equal(PREPARED_MERCURY_STARFIELD.faces.length, 6);
  assert.equal(PREPARED_MERCURY_STARFIELD.faceSize, 1024);
  assert.equal(PREPARED_MERCURY_STARFIELD.faceSize2x, 2048);
  assert.equal("sun" in PREPARED_MERCURY_STARFIELD, false);
  assert.equal(PREPARED_MERCURY_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_MERCURY_SKY_SUN.billboard, true);
  assert.equal(PREPARED_MERCURY_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_MERCURY_SKY_SUN.runtimeRasterization, false);
  assert.equal(PREPARED_MERCURY_STARFIELD.runtimeRasterization, false);
  assert.equal(
    PREPARED_MERCURY_SCENE.starfield.cameraContract,
    "inverse-unbounded-accumulated-matrix3d",
  );
  assert.equal(PREPARED_MERCURY_SCENE.counts.starfieldFaceCount, 6);
  assert.equal(PREPARED_MERCURY_SCENE.counts.sunBillboardCount, 1);
  assert.equal(PREPARED_MERCURY_SCENE.counts.sunCubemapBakeCount, 0);
  assert.equal(
    PREPARED_MERCURY_SCENE.interior.presentationOrbit
      .changesPhysicalAxialTiltClaim,
    false,
  );
});

test("uses the shared Venus cubic-sky camera without a decoded transform bank", async () => {
  const client = await readFile(new URL("../runtime/client.mjs", import.meta.url),
    "utf8");
  const cubicSkyRuntime = await readFile(new URL(
    "../../../platform/cubic-sky-runtime.mjs",
    import.meta.url,
  ), "utf8");
  assert.match(client, /createCubicSkyCameraOrientation/u);
  assert.match(client, /mountRetainedCubicSky/u);
  assert.match(cubicSkyRuntime, /new DOMMatrix\(\)/u);
  assert.match(client, /controlYawDelta/u);
  assert.match(client, /sunViewDirection/u);
  assert.doesNotMatch(
    client,
    /preparedOrbitBank|DecompressionStream|TextDecoder|encodedBase64/u,
  );
});

test("publishes byte-bound DPR 1 and DPR 2 photographic cubemap faces", async () => {
  for (const face of PREPARED_MERCURY_STARFIELD.faces) {
    for (const url of [face.url, face.url2x]) {
      const fileName = url.split("/").at(-1);
      const declared = PREPARED_MERCURY_STARFIELD.hashes[fileName];
      assert.ok(declared);
      const path = fileURLToPath(new URL(
        `../../../../public${url}`,
        import.meta.url,
      ));
      const bytes = await readFile(path);
      assert.equal(bytes.byteLength, declared.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        declared.sha256,
      );
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, url.includes("@2x") ? 2048 : 1024);
      assert.equal(metadata.height, url.includes("@2x") ? 2048 : 1024);
    }
  }
});

test("publishes a byte-bound clean-room Sun independently of the cube", async () => {
  const sun = PREPARED_MERCURY_SKY_SUN;
  assert.equal(sun.asset.sourcePixels, "repository-authored-clean-room-raster");
  assert.equal(sun.asset.googlePixelsRedistributed, false);
  for (const density of [sun.asset.density1, sun.asset.density2]) {
    const bytes = await readFile(fileURLToPath(new URL(
      `../../../../public${density.url}`,
      import.meta.url,
    )));
    assert.equal(bytes.byteLength, density.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),
      density.sha256);
    const metadata = await sharp(bytes).metadata();
    assert.deepEqual([metadata.width, metadata.height],
      [density.width, density.height]);
  }
  assert.ok(Math.abs(Math.hypot(...sun.localDirection) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...sun.referenceViewDirection) - 1) < 1e-12);
});

test("prepares every Mercury lighting angle at native DPR resolution", async () => {
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.schema,
    "cssmercury-prepared-lighting@3");
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.frameCount, 256);
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.minimumLightViewZ, -1);
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.maximumLightViewZ, 1);
  assert.equal(
    PREPARED_MERCURY_ASSETS.lighting.cameraContract,
    "unbounded-accumulated-matrix3d-phase-and-roll",
  );
  for (const density of [1, 2]) {
    const bank = PREPARED_MERCURY_ASSETS.lighting.banks[String(density)];
    assert.equal(bank.schema, "cssmercury-prepared-lighting-bank@1");
    assert.equal(bank.frameSize, 512 * density);
    assert.ok(bank.frameSize >=
      PREPARED_MERCURY_ASSETS.lighting.presentationFrameSize * density);
    assert.equal(bank.rows.length, 32);
    assert.equal(bank.presentations.length, 256);
    assert.equal(bank.transport.maximumRetainedRowCount, 3);
    for (const row of bank.rows) {
      const path = fileURLToPath(new URL(
        `../../../../public${row.url}`,
        import.meta.url,
      ));
      const bytes = await readFile(path);
      assert.equal(bytes.byteLength, row.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        row.sha256,
      );
      assert.equal(row.height, bank.frameSize);
      assert.equal(row.width / row.frameCount, bank.frameSize);
    }
  }
});

test("reuses the exact full-phase frame for symmetric shadowless curvature", async () => {
  for (const density of [1, 2]) {
    const bank = PREPARED_MERCURY_ASSETS.lighting.banks[String(density)];
    const presentation = bank.presentations.at(-1);
    assert.equal(presentation.frameIndex, 255);
    assert.equal(presentation.rowIndex, 31);
    assert.match(presentation.url,
      new RegExp(`mercury-lighting-${density}x-row-31\\.webp$`));
  }

  const bank = PREPARED_MERCURY_ASSETS.lighting.banks["1"];
  const row = bank.rows.at(-1);
  const frame = await sharp(fileURLToPath(new URL(
    `../../../../public${row.url}`,
    import.meta.url,
  ))).extract({
    left: bank.frameSize * (row.frameCount - 1),
    top: 0,
    width: bank.frameSize,
    height: bank.frameSize,
  }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const center = Math.floor(frame.info.width / 2);
  const alphaAt = (x, y = center) =>
    frame.data[(y * frame.info.width + x) * frame.info.channels + 3];
  const offset = Math.round(frame.info.width * 0.4);
  assert.ok(alphaAt(center) <= 2);
  assert.ok(Math.abs(alphaAt(center - offset) -
    alphaAt(center + offset)) <= 1);
  assert.ok(alphaAt(4) >= 120 && alphaAt(4) <= 135);
  assert.ok(alphaAt(frame.info.width - 5) >= 120 &&
    alphaAt(frame.info.width - 5) <= 135);

  const directionalFrame = await sharp(fileURLToPath(new URL(
    `../../../../public${row.url}`,
    import.meta.url,
  ))).extract({
    left: bank.frameSize * (row.frameCount - 2),
    top: 0,
    width: bank.frameSize,
    height: bank.frameSize,
  }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const directionalAlphaAt = (x, y = center) =>
    directionalFrame.data[
      (y * directionalFrame.info.width + x) *
        directionalFrame.info.channels + 3
    ];
  assert.ok(directionalAlphaAt(4) > 200);
});

test("keeps every Mercury scene leaf on permitted retained CSS paths", () => {
  for (const leaf of PREPARED_MERCURY_SCENE.bodyLeaves) {
    assert.equal(leaf.tag, "s");
    assert.match(leaf.style, /^transform:matrix3d\(/u);
    assert.doesNotMatch(
      leaf.style,
      /(?:clip-path|(?:-webkit-)?mask|filter|gradient|mix-blend-mode)/iu,
    );
  }
});

test("qualifies observation products without claiming false color as normal", () => {
  const lenses = new Map(PREPARED_MERCURY_LENSES.controls.map((lens) => [
    lens.id,
    lens,
  ]));
  assert.equal(lenses.get("normal").falseColor, false);
  assert.equal(lenses.get("normal").label, "750 nm");
  assert.match(lenses.get("normal").filter, /BDR global 750 nm monochrome/u);
  assert.equal(lenses.get("enhanced").falseColor, true);
  assert.equal(lenses.get("enhanced").label, "Enhanced");
  assert.match(lenses.get("enhanced").filter, /coverage completion/u);
  assert.equal(
    PREPARED_MERCURY_ASSETS.surfaces.enhanced.coverageCompletion
      .directEnhancedColorClaim,
    false,
  );
  assert.ok(
    PREPARED_MERCURY_ASSETS.surfaces.enhanced.coverageCompletion
      .filledPixelCount > 0,
  );
  assert.equal(lenses.get("topography").falseColor, true);
  assert.match(lenses.get("interior").filter, /retained 3D/u);
  assert.match(PREPARED_MERCURY_ASSETS.interior.qualification, /Schematic/u);
});

test("binds Mercury lighting to the pinned source renderer without atmospheric terms", () => {
  assert.equal(
    PREPARED_MERCURY_ASSETS.lighting.sourceRenderer,
    "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl",
  );
  assert.ok(Math.abs(Math.hypot(
    ...PREPARED_MERCURY_ASSETS.lighting.worldLightDirection,
  ) - 1) < 1e-12);
  assert.deepEqual(
    PREPARED_MERCURY_ASSETS.lighting.sourceWorldLightDirection,
    [0.883835, -0.385595, 0.264864],
  );
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.ambientIntensity, 0.05);
  assert.equal(
    PREPARED_MERCURY_ASSETS.lighting.shadowlessFloodLimbFloor,
    0.35,
  );
  assert.equal(PREPARED_MERCURY_ASSETS.lighting.orenNayarRoughness, 0);
  assert.deepEqual(
    PREPARED_MERCURY_ASSETS.lighting.terminatorSmoothstep,
    [0, 0.1],
  );
});

test("prepares complete enhanced poles and removes the core polar wedge", async () => {
  const polarAtlas = await sharp(fileURLToPath(new URL(
    "../../../../public/scenes/mercury/mercury-poles.webp",
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(polarAtlas.info.width, 1_536);
  assert.equal(polarAtlas.info.height, 256);
  for (const tileX of [512, 768]) {
    const coverage = tileCoverage(polarAtlas, tileX, 256);
    assert.ok(coverage.opaquePixels > 50_000);
    assert.ok(coverage.neutralDarkFraction < 0.01);
  }

  const coreAtlas = await sharp(fileURLToPath(new URL(
    "../../../../public/scenes/mercury/mercury-interior-core-poles.webp",
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(coreAtlas.info.width, 512);
  assert.equal(coreAtlas.info.height, 256);
  for (const tileX of [0, 256]) {
    const cutaway = polarCutawayFraction(coreAtlas, tileX, 256);
    assert.ok(cutaway > 0.29);
    assert.ok(cutaway < 0.34);
  }
});

function tileCoverage(image, tileX, tileSize) {
  let opaquePixels = 0;
  let neutralDarkPixels = 0;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const offset = (y * image.info.width + tileX + x) * image.info.channels;
      if (image.data[offset + 3] === 0) continue;
      opaquePixels += 1;
      const maximum = Math.max(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
      );
      const minimum = Math.min(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2],
      );
      if (maximum <= 18 && maximum - minimum <= 6) neutralDarkPixels += 1;
    }
  }
  return {
    opaquePixels,
    neutralDarkFraction: neutralDarkPixels / opaquePixels,
  };
}

function polarCutawayFraction(image, tileX, tileSize) {
  const center = (tileSize - 1) / 2;
  let discPixels = 0;
  let transparentPixels = 0;
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      if (Math.hypot((x - center) / center, (y - center) / center) > 0.98) {
        continue;
      }
      discPixels += 1;
      const offset = (y * image.info.width + tileX + x) * image.info.channels;
      if (image.data[offset + 3] === 0) transparentPixels += 1;
    }
  }
  return transparentPixels / discPixels;
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";

test("ships the generated default material and prepared orbit view bank", async () => {
  const { preparedLighting: lighting, fixedMaterialPlane, counts } =
    PREPARED_SATURN_SCENE;
  const asset = await readFile(new URL(
    "../.prepared/saturn-fixed-material.webp",
    import.meta.url,
  ));
  const orbitSourceAsset = await readFile(new URL(
    "../.prepared/saturn-orbit-material.webp",
    import.meta.url,
  ));
  const orbitAsset = await readFile(new URL(
    "../../../../public/scenes/saturn/saturn-orbit-material.webp",
    import.meta.url,
  ));
  const metadata = await sharp(asset).metadata();
  const orbitMetadata = await sharp(orbitSourceAsset).metadata();
  const runtimeShards = lighting.orbitAtlas.runtimeShards;
  const defaultRuntimeAsset = await readFile(new URL(
    `../../../../public${runtimeShards.defaultPresentation.assetUrl}`,
    import.meta.url,
  ));

  assert.equal(lighting.mode,
    "prepared-view-bank-single-material-plane-orbit-projection");
  assert.equal(lighting.assetUrl, "/scenes/saturn/saturn-orbit-material.webp");
  assert.equal(lighting.assetBytes, orbitAsset.byteLength);
  assert.equal(lighting.assetSha256,
    createHash("sha256").update(orbitAsset).digest("hex"));
  assert.ok(asset.byteLength < 300_000);
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.deepEqual(lighting.defaultAsset, {
    preparationPath: ".prepared/saturn-fixed-material.webp",
    assetBytes: asset.byteLength,
    assetSha256: createHash("sha256").update(asset).digest("hex"),
    embeddedInOrbitAtlas: true,
    backgroundPosition: "-4162px -2px",
    backgroundSize: "5188px 4160px",
    runtimePresentation: {
      assetUrl: "/scenes/saturn/saturn-orbit-material.webp",
      assetBytes: defaultRuntimeAsset.byteLength,
      assetSha256: createHash("sha256")
        .update(defaultRuntimeAsset)
        .digest("hex"),
      backgroundPosition: "-4162px -2px",
      backgroundSize: "5188px 4160px",
      exactDecodedCrop: true,
    },
  });
  assert.equal(lighting.approvedReferenceMatchesDefault, false);
  assert.match(lighting.defaultFrameRawSha256, /^[a-f0-9]{64}$/u);
  assert.match(lighting.approvedReferenceFrameRawSha256, /^[a-f0-9]{64}$/u);
  assert.notEqual(
    lighting.defaultFrameRawSha256,
    lighting.approvedReferenceFrameRawSha256,
  );
  assert.equal(
    lighting.approvedReferenceAsset.sourcePath,
    "source/approved/saturn-fixed-material.webp",
  );
  assert.equal(lighting.approvedReferenceAsset.embeddedInOrbitAtlas, false);
  assert.equal(lighting.frameCount, 256);
  assert.equal(lighting.frameRate, 0);
  assert.equal(lighting.presentationScale, 1.002);
  assert.equal(lighting.materialScale, 0.992);
  assert.equal(lighting.projection.depthBias, 0.5);
  assert.deepEqual(lighting.projection.silhouetteCoverage, {
    model: "prepared-analytic-oblate-ellipsoid-proportional-overscan",
    coverageScale: 1.002,
    materialScale: 0.992,
    rimFill: "prepared-radial-binary-clamp-to-material-limb",
    sourcePixelBleed: 0,
    runtime: false,
  });
  assert.equal(lighting.interpolation,
    "dense-nearest-prepared-view-with-continuous-plane-projection");
  assert.equal(lighting.addressPublication,
    "single-transform-and-prepared-background-address-on-input-frame");
  assert.equal(lighting.runtimeAddressWrites,
    "one-retained-leaf-prepared-address-on-published-input-frame");
  assert.equal(lighting.runtimeLightingMath, false);
  assert.equal(lighting.runtimeRasterization, false);
  assert.equal(lighting.runtimeMatrixFormatting, false);
  assert.equal(lighting.extraDomLeaves, 1);
  assert.deepEqual(lighting.foregroundRingOrdering, {
    model: "prepared-ring-rgb-over-material-with-material-alpha-retained",
    sourceAssetUrl: "/scenes/saturn/saturn-rings.webp",
    compositedTexelCount: 183_189,
    meanSampledOpacity: 0.403704,
    screenshotDerived: false,
    runtimeMath: false,
    extraDomLeaves: 0,
  });
  assert.ok(lighting.foregroundRingOrdering.compositedTexelCount > 0);
  assert.ok(lighting.foregroundRingOrdering.meanSampledOpacity > 0);
  assert.equal(lighting.projection.screenshotDerived, false);
  assert.equal(lighting.projection.model,
    "prepared-oblate-ellipsoid-camera-projection");
  assert.deepEqual(
    lighting.projection.view.map((value) => Number(value.toFixed(6))),
    [0.46543, -0.771488, 0.433799],
  );
  assert.equal(fixedMaterialPlane.runtimeWork,
    "single-transform-and-address-on-input-change");
  assert.deepEqual(fixedMaterialPlane.leaf, lighting.leaf);
  assert.equal(counts.fixedMaterialPlaneLeafCount, 1);
  assert.match(lighting.leaf.style, /transform:matrix3d\(/);
  assert.match(lighting.leaf.style,
    /background-image:url\(\/scenes\/saturn\/saturn-orbit-material\.webp\)/);
  assert.match(lighting.leaf.style, /background-position:-4162px -2px/);
  assert.match(lighting.leaf.style, /background-size:5188px 4160px/);
  assert.match(lighting.leaf.style, /backface-visibility:visible/);

  assert.equal(lighting.orbitAtlas.assetBytes, orbitAsset.byteLength);
  assert.equal(lighting.orbitAtlas.assetSha256,
    createHash("sha256").update(orbitAsset).digest("hex"));
  assert.ok(orbitSourceAsset.byteLength < 5_000_000);
  assert.ok(orbitAsset.byteLength < 13_000_000);
  assert.equal(orbitMetadata.width, 5188);
  assert.equal(orbitMetadata.height, 4160);
  assert.equal(lighting.orbitAtlas.frameCount, 256);
  assert.equal(lighting.orbitAtlas.frameColumns, 16);
  assert.equal(lighting.orbitAtlas.frameRows, 16);
  assert.equal(lighting.orbitAtlas.tileSize, 256);
  assert.equal(lighting.orbitAtlas.frameGutter, 2);
  assert.equal(lighting.orbitAtlas.frameStride, 260);
  assert.equal(lighting.orbitAtlas.presentationAtlasWidth, 20_752);
  assert.equal(lighting.orbitAtlas.presentationAtlasHeight, 16_640);
  assert.equal(lighting.orbitAtlas.defaultBackgroundPosition,
    "-4162px -2px");
  assert.equal(lighting.orbitAtlas.defaultBackgroundSize,
    "5188px 4160px");
  assert.equal(lighting.orbitAtlas.minimumScenePitchDegrees, 0);
  assert.equal(lighting.orbitAtlas.maximumScenePitchDegrees, 65);
  assert.deepEqual(lighting.orbitAtlas.preparedMeshSilhouette, {
    model: "prepared-projected-lowpoly-hull-alpha-coverage",
    longitudeCount: 32,
    latitudeCount: 16,
    supersampling: 4,
    atlasAlphaOnly: true,
    runtimeWork: false,
  });
  assert.deepEqual(lighting.orbitAtlas.ringShadowFootprint, {
    model: "prepared-center-weighted-five-tap-orbit-texel-footprint",
    sourceBlurSigmaPixels: 6,
    orbitSampleRadiusPixels: 4,
    approvedReferenceFrameChanged: true,
    runtimeWork: false,
  });
  assert.equal(lighting.orbitAtlas.backgroundPositions.length, 256);
  assert.equal(runtimeShards.model,
    "prepared-variant-single-atlas");
  assert.equal(runtimeShards.defaultVariant, "normal");
  assert.equal(runtimeShards.maximumRetainedAtlasCount, 1);
  assert.deepEqual(Object.keys(runtimeShards.variants), [
    "normal",
    "normal-no-shadows",
    "normal-ringless",
    "normal-ringless-no-shadows",
    "ultraviolet",
    "ultraviolet-no-shadows",
    "ultraviolet-ringless",
    "ultraviolet-ringless-no-shadows",
    "methane",
    "methane-no-shadows",
    "methane-ringless",
    "methane-ringless-no-shadows",
    "thermal",
    "thermal-no-shadows",
    "thermal-ringless",
    "thermal-ringless-no-shadows",
  ]);
  assert.equal(runtimeShards.alphaExactDecodedCropVerification, true);
  assert.equal(runtimeShards.selectiveVisibleRgbEncoding,
    "webp-q75-alpha-q100");
  assert.deepEqual(runtimeShards.q75AssetUrls, [
    "/scenes/saturn/saturn-orbit-material-default.webp",
    "/scenes/saturn/saturn-orbit-material-row-05.webp",
    "/scenes/saturn/saturn-orbit-material-row-06.webp",
    "/scenes/saturn/saturn-orbit-material-row-07.webp",
  ]);
  assert.equal(runtimeShards.exactVisibleDecodedCropVerification, false);
  assert.equal(runtimeShards.defaultPreparedFrame, 98);
  assert.equal(runtimeShards.defaultPreparedRow, 6);
  assert.deepEqual(runtimeShards.initialWarmRows, [5, 6, 7]);
  assert.equal(runtimeShards.rows.length, 16);
  assert.equal(runtimeShards.presentations.length, 256);
  assert.equal(runtimeShards.fullAtlasDecodedRgbaBytes, 86_328_320);
  assert.equal(runtimeShards.initialDecodedWorkingSetBytes, 86_328_320);
  assert.equal(runtimeShards.maximumDecodedWorkingSetBytes, 86_328_320);
  assert.equal(runtimeShards.runtimeDecodePolicy,
    "one-active-variant-atlas-decoded-before-presentation");
  for (const [id, variant] of Object.entries(runtimeShards.variants)) {
    assert.equal(variant.presentations.length, 256);
    assert.equal(variant.rows.length, 16);
    assert.equal(variant.runtimeAtlas.width, 5188);
    assert.equal(variant.runtimeAtlas.height, 4160);
    assert.equal(variant.runtimeAtlas.decodedRgbaBytes, 86_328_320);
    assert.equal(variant.runtimeAtlas.encoding, "lossless-webp");
    assert.equal(variant.runtimeAtlas.alphaMatchesSource, true);
    assert.equal(variant.runtimeAtlas.visibleTexelsMatchSource, true);
    assert.match(variant.runtimeAtlas.assetUrl,
      id === "normal"
        ? /saturn-orbit-material\.webp$/u
        : new RegExp(`saturn-orbit-material-${id}\\.webp$`, "u"));
  }
  assert.deepEqual(runtimeShards.presentations[98], {
    frameIndex: 98,
    rowIndex: 6,
    assetUrl: "/scenes/saturn/saturn-orbit-material.webp",
    backgroundPosition: "-2088px -6248px",
    backgroundSize: "20752px 16640px",
  });
  assert.deepEqual(lighting.orbitAtlas.ringShadowMotionEvidence, {
    model: "prepared-visible-ray-occlusion-centroid-span",
    frameCount: 256,
    visibleFrameCount: 251,
    centroidColumnSpan: 31.115,
    centroidRowSpan: 164.137,
    minimumShadowedTexelCount: 0,
    maximumShadowedTexelCount: 8_507,
  });
  assert.equal(lighting.orbitAtlas.runtimeRasterization, false);
});

test("preserves full-atlas alpha and keeps non-Q75 row sources pixel exact", async () => {
  const runtime = PREPARED_SATURN_SCENE.preparedLighting.orbitAtlas
    .runtimeShards;
  const full = await sharp(await readFile(new URL(
    "../.prepared/saturn-orbit-material.webp",
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const deployed = await sharp(await readFile(new URL(
    `../../../../public${runtime.variants.normal.runtimeAtlas.assetUrl}`,
    import.meta.url,
  ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(deployed.info.width, full.info.width);
  assert.equal(deployed.info.height, full.info.height);
  for (let offset = 3; offset < full.data.length; offset += 4) {
    if (deployed.data[offset] !== full.data[offset]) {
      assert.fail(`runtime atlas changed alpha at byte ${offset}`);
    }
  }
  const shards = runtime.rows;
  for (const shard of shards) {
    const decoded = await sharp(await readFile(new URL(
      `../../../../public${shard.assetUrl}`,
      import.meta.url,
    ))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, shard.sourceBounds.width);
    assert.equal(decoded.info.height, shard.sourceBounds.height);
    for (let row = 0; row < shard.sourceBounds.height; row += 1) {
      for (let column = 0; column < shard.sourceBounds.width; column += 1) {
        const sourceOffset = (
          (shard.sourceBounds.y + row) * full.info.width +
          shard.sourceBounds.x + column
        ) * 4;
        const shardOffset = (
          row * shard.sourceBounds.width + column
        ) * 4;
        if (decoded.data[shardOffset + 3] !== full.data[sourceOffset + 3]) {
          assert.fail(`${shard.assetUrl} changed alpha at ${column},${row}.`);
        }
        if (full.data[sourceOffset + 3] === 0) continue;
        if (shard.encoding === "webp-q75-alpha-q100") continue;
        if (decoded.data[shardOffset] !== full.data[sourceOffset] ||
            decoded.data[shardOffset + 1] !== full.data[sourceOffset + 1] ||
            decoded.data[shardOffset + 2] !== full.data[sourceOffset + 2]) {
          assert.fail(`${shard.assetUrl} changed RGB at ${column},${row}.`);
        }
      }
    }
  }
});

test("keeps OpenSpace lighting, atmosphere, and ring-shadow authority", () => {
  const lighting = PREPARED_SATURN_SCENE.preparedLighting;
  assert.deepEqual(lighting.directionalLight.direction,
    [0.883835, -0.385595, 0.264864]);
  assert.equal(lighting.directionalLight.color, "#fff1ea");
  assert.equal(lighting.directionalLight.intensity, Math.PI);
  assert.equal(lighting.ambientLight.color, "#fff1ea");
  assert.equal(lighting.ambientLight.intensity, 0.05 * Math.PI);
  assert.equal(lighting.materialModel,
    "openspace-globe-solar-rgb-lambert-terminator-attenuation-oblate-texels");
  assert.equal(lighting.sourceRenderer,
    "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl");
  assert.equal(lighting.illuminationDirectionAuthority,
    "OpenSpace default scene-graph Sun direction");
  assert.equal(lighting.solarEffectiveTemperatureKelvin, 5772);
  assert.equal(lighting.rendererAlbedoMultiplier, "#fff1ea");
  assert.equal(lighting.ambientIntensity, 0.05);
  assert.equal(lighting.orenNayarRoughness, 0);
  assert.deepEqual(lighting.terminatorSmoothstep, [0, 0.1]);
  assert.deepEqual(lighting.atmosphere, {
    model: "prepared-view-light-limb-scattering-oblate-texels",
    compositedIntoMaterialAsset: true,
    assetUrl: "/scenes/saturn/saturn-orbit-material.webp",
    assetBytes: lighting.assetBytes,
    assetSha256: lighting.assetSha256,
    color: "#eef4fb",
    maximumAlpha: 0.72,
    limbExponent: 1.75,
    nightFloor: 0.22,
    initialObjectViewDirection: [0.46543, -0.771488, 0.433799],
    retainedOverlayBinding:
      "one-mount-time-retained-final-composite-texture-leaf",
    atlasLayer: "prepared-approved-material-plane",
    runtimeMath: false,
    extraDomLeaves: 1,
  });
  assert.equal(lighting.mutualShadows.model,
    "prepared-static-mutual-ray-occlusion");
  assert.equal(lighting.mutualShadows.runtime, false);
  assert.equal(lighting.mutualShadows.saturnOnRings.model,
    "ray-to-oblate-ellipsoid-prepared-alpha-overlay");
  assert.equal(lighting.mutualShadows.ringsOnSaturn.model,
    "ray-to-prepared-ring-alpha-profile");
  assert.ok(lighting.mutualShadows.ringsOnSaturn.shadowedTexelCount > 0);
  assert.ok(lighting.mutualShadows.ringsOnSaturn.maxSampledOpacity > 0.8);
});

test("ships a prepared cropped ring-shadow bitmap on the original logical plane", async () => {
  const asset = await readFile(new URL(
    "../../../../public/scenes/saturn/saturn-ring-shadow.webp",
    import.meta.url,
  ));
  const metadata = await sharp(asset).metadata();
  const source = PREPARED_SATURN_SCENE.preparedRingSource;
  const leaf = PREPARED_SATURN_SCENE.ringShadowPlane;

  assert.equal(source.shadowTextureSourceSize, 1024);
  assert.deepEqual(source.shadowTextureBounds, {
    x: 271,
    y: 672,
    width: 469,
    height: 342,
  });
  assert.equal(source.shadowTextureTransparentGutter, 4);
  assert.equal(metadata.width, source.shadowTextureBounds.width);
  assert.equal(metadata.height, source.shadowTextureBounds.height);
  assert.equal(leaf.leafWidth, source.shadowTextureSourceSize);
  assert.equal(leaf.leafHeight, source.shadowTextureSourceSize);
  assert.match(leaf.style, /--polycss-atlas-width:1024px/);
  assert.match(leaf.style, /--polycss-atlas-height:1024px/);
  assert.match(leaf.style, /background-position:271px 672px/);
  assert.match(leaf.style, /background-size:469px 342px/);
  assert.deepEqual(leaf.preparedCrop, {
    sourceSize: 1024,
    bounds: source.shadowTextureBounds,
    transparentGutter: 4,
    retainedLogicalPlaneSize: 1024,
    runtimeWork: false,
  });
  assert.equal(PREPARED_SATURN_SCENE.counts.ringShadowPlaneCount, 1);
});

test("uses only prepared material addresses for orbit-responsive lighting", async () => {
  const [client, preparer, generated] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../tools/prepare-scene.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/preparedScene.mjs", import.meta.url), "utf8"),
  ]);
  const bodyLeaves = PREPARED_SATURN_SCENE.bodyBands.flatMap(({ leaves }) =>
    leaves);
  assert.equal(bodyLeaves.filter(({ preparedMaterial }) => preparedMaterial).length,
    0);
  assert.equal(bodyLeaves.filter(({ preparedWeather }) => preparedWeather).length,
    9);
  assert.ok(bodyLeaves.every(({ style }) =>
    !style.includes("saturn-material.webp")));
  assert.match(client,
    /publishAtlasPresentation\(\s*mounted\.fixedMaterialLeaf,\s*materialPresentation/u);
  assert.match(client,
    /orbitMaterialCache\.presentation\(\s*materialFrame/);
  assert.match(client, /materialFrame = Math\.round\(clamp\(/);
  assert.doesNotMatch(client, /materialBlend|lowerMaterialFrame|upperMaterialFrame/);
  assert.match(client, /onPublish: publish/);
  assert.doesNotMatch(client, /getImageData|putImageData|drawImage/);
  assert.doesNotMatch(client, /createPreparedSaturnWeatherPlayer|weatherPlayer|weatherTargets/);
  assert.match(preparer, /prepareFixedMaterialPlane/);
  assert.match(preparer, /prepareOrbitMaterialAtlas/);
  assert.doesNotMatch(preparer, /readFile\([^)]*(?:screenshot|\.png)/i);
});

test("warms the prepared material CSS raster before declaring ready", async () => {
  const [client, css, head] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../site/SaturnHead.astro", import.meta.url), "utf8"),
  ]);
  const paintGate = client.indexOf("await waitForPreparedScenePaint()");

  assert.ok(paintGate >= 0);
  assert.match(head,
    /orbitRuntime\.model === "prepared-variant-single-atlas"/u);
  assert.match(head, /\? \[\]/u);
  assert.doesNotMatch(client,
    /dataset\.ready|classList\.(?:add|remove)\("(?:loading|ready|error)"/u);
  assert.match(css,
    /html:not\(\[data-ready="true"\]\) \.example-stage\s*\{[\s\S]*?opacity:\s*0\.001/);
  assert.doesNotMatch(css,
    /html:not\(\[data-ready="true"\]\) \.example-stage\s*\{[\s\S]*?opacity:\s*0(?:;|\s*\})/);
});

test("uses the shared prepared cubic starfield and independent Sun", async () => {
  const [css, client, starfieldModule, sunModule] = await Promise.all([
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    import("../runtime/preparedStarfield.mjs"),
    import("../runtime/preparedSkySun.mjs"),
  ]);
  const starfield = starfieldModule.PREPARED_SATURN_STARFIELD;
  const sun = sunModule.PREPARED_SATURN_SKY_SUN;
  assert.doesNotMatch(css, /saturn-starfield\.webp/u);
  assert.match(client, /PREPARED_SATURN_STARFIELD\.faces\.flatMap/u);
  assert.match(client, /mountRetainedCubicSky\(\{/u);
  assert.doesNotMatch(client, /createStar|Math\.random/);
  assert.equal(starfield.schema, "cssearth-prepared-cubic-sky@2");
  assert.equal(starfield.faces.length, 6);
  assert.equal("sun" in starfield, false);
  assert.equal(sun.schema, "cssearth-prepared-directional-sun@3");
  assert.equal(sun.bakedIntoStarfield, false);
  assert.equal(sun.billboard, true);
  assert.match(client, /mountRetainedDirectionalSun/u);
});

test("publishes Saturn through cssEarth's object registry", async () => {
  const [layout, router, client, css, objects] = await Promise.all([
    readFile(new URL("../../../../site/layouts/PlanetLayout.astro", import.meta.url), "utf8"),
    readFile(new URL("../../../../site/scene-router.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    import("../../../../site/objects.mjs"),
  ]);
  assert.match(layout, /class="planet-stage example-stage"/);
  assert.match(router, /get mountedObjectCount\(\)/);
  assert.match(router, /return activeMount \? 1 : 0/);
  assert.ok(objects.OBJECTS.some(({ id }) => id === "saturn"));
  assert.match(client, /csssaturn-prepared-runtime-scene@1/);
  assert.match(css,
    /\.example-stage > \.polycss-camera/);
  assert.doesNotMatch(client, /saturn-material-composite|materialScene/u);
  assert.doesNotMatch(client, /ringDustRepresentation|ringDustTexture/);
  const saturn = objects.OBJECTS.find(({ id }) => id === "saturn");
  assert.equal(saturn.route, "/saturn/");
});

test("ships the HD solar-tinted Saturn surface without face-strip repacking", async () => {
  const surface = PREPARED_SATURN_SCENE.preparedSurface;
  const asset = await readFile(new URL(
    "../../../../public/scenes/saturn/saturn-surface-body.jpg",
    import.meta.url,
  ));
  const sourceAsset = await readFile(new URL(
    "../.prepared/saturn-surface.jpg",
    import.meta.url,
  ));
  const metadata = await sharp(asset).metadata();
  assert.equal(surface.mode, "prepared-static-hd-equirectangular-surface");
  assert.equal(surface.sourcePath, "source/saturn-surface-original.jpg");
  assert.equal(surface.solarColor, "#fff1ea");
  assert.equal(surface.solarTintPreparation,
    "linear-light-static-albedo-multiplication");
  assert.equal(metadata.width, 2080);
  assert.equal(metadata.height, 1536);
  assert.equal(surface.assetBytes, asset.byteLength);
  assert.equal(surface.assetSha256,
    createHash("sha256").update(asset).digest("hex"));
  assert.equal(surface.sourceAssetUrl, "/scenes/saturn/saturn-surface.jpg");
  assert.equal(surface.sourceAssetBytes, sourceAsset.byteLength);
  assert.equal(surface.sourceAssetSha256,
    createHash("sha256").update(sourceAsset).digest("hex"));
  assert.equal(
    surface.projectiveLeafOrientation,
    "prepared-latitude-strip-north-south-correction",
  );
  assert.deepEqual(surface.seamRepair, {
    model: "prepared-zero-seam-bleed-with-compositor-overlap",
    seamBleed: 0,
    topologyOverlap: 0,
    presentationOverlap: 0.008,
    rasterGutter: 16,
    rasterOverscan: 0,
    runtimeEdgeDiscovery: false,
  });
});

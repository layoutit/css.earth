import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  EARTH_MATERIAL_FRAMES_PER_SHARD,
  EARTH_MATERIAL_TILE_SIZE,
  readEarthAtmosphereModel,
} from "../tools/atmosphere-model.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_SKY_SUN } from "../runtime/preparedSkySun.mjs";
import { PREPARED_EARTH_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_EARTH_TITLE } from "../site/preparedTitle.mjs";
import { verifyEarthSourceManifest } from "../tools/source-manifest.mjs";

const execFileAsync = promisify(execFile);
const publicRoot = resolve("public/scenes/earth");

test("prepares Earth from a complete checked source closure", async () => {
  assert.deepEqual(await verifyEarthSourceManifest(), {
    inputCount: 19,
    generatedIntermediateCount: 2,
    documentCount: 4,
  });
});

test("verifies Earth acquisition without a network request", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    new URL("../tools/acquire.mjs", import.meta.url).pathname,
    "--verify-only",
  ]);
  assert.match(stdout, /"inputCount": 19/u);
});

test("prepares the shared photographed cubic sky and independent Sun", () => {
  assert.equal(PREPARED_EARTH_STARFIELD.schema,
    "cssearth-prepared-cubic-sky@2");
  assert.equal(PREPARED_EARTH_STARFIELD.faces.length, 6);
  assert.equal("sun" in PREPARED_EARTH_STARFIELD, false);
  assert.equal(PREPARED_EARTH_SKY_SUN.schema,
    "cssearth-prepared-directional-sun@3");
  assert.equal(PREPARED_EARTH_SKY_SUN.bakedIntoStarfield, false);
  assert.equal(PREPARED_EARTH_SKY_SUN.billboard, true);
  assert.equal(PREPARED_EARTH_SKY_SUN.asset.googlePixelsRedistributed, false);
});

test("prepares flat opaque texel thumbnails for Earth surface lenses", async () => {
  for (const lens of PREPARED_EARTH_LENSES.controls.filter(
    ({ id }) => id !== "cross-section",
  )) {
    const { data, info } = await sharp(resolve(
      publicRoot,
      lens.thumbnailUrl.split("/").at(-1),
    )).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 96);
    assert.equal(info.height, 96);
    for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) {
      assert.equal(data[(y * info.width + x) * 4 + 3], 255,
        `${lens.id} thumbnail corner ${x},${y}`);
    }
  }
});

test("prepares OpenSpace Earth colour with Google directional exposure response", async () => {
  const source = await readEarthAtmosphereModel();
  const atmosphere = PREPARED_EARTH_SCENE.material.atmosphere;
  assert.equal(atmosphere.model,
    "prepared-openspace-atmosphere-with-google-directional-response-bank");
  assert.deepEqual(atmosphere.source, source);
  assert.equal(source.atmosphereHeightKm, 70);
  assert.equal(source.planetRadiusKm, 6377);
  assert.ok(Math.abs(source.outerRadiusRatio - 6447 / 6377) < 1e-12);
  assert.deepEqual(source.rayleigh.scatteringPerKm,
    [0.0058, 0.0135, 0.0331]);
  assert.equal(source.rayleigh.scaleHeightKm, 8);
  assert.equal(source.mie.scaleHeightKm, 1.2);
  assert.equal(source.mie.anisotropy, 0.85);
  assert.equal(source.presentationResponse.qualification,
    "NATIVE_HEADLESS_LAYER_ISOLATION_AND_LINKED_SHADER_BOUND");
  assert.equal(source.presentationResponse.observedResponse.exposure, 0.2);
  assert.equal(source.presentationResponse.observedResponse.toneMap,
    "one-minus-exp-negative-radiance-times-exposure");
  assert.deepEqual(source.presentationResponse.transferPolicy.bodySpecific, [
    "effective-solar-irradiance",
    "apparent-exposure",
    "atmosphere-height",
    "scattering-coefficients",
    "scale-heights",
    "chromaticity",
    "density",
    "twilight-width",
    "limb-concentration",
    "opacity-response",
  ]);
  assert.equal(source.presentationResponse.observedResponse.exposureRole,
    "camera-response-not-body-irradiance");
  assert.equal(
    source.presentationResponse.cleanRoomTransfer.bodySunIntensitySource,
    "openspace-body-atmosphere-model",
  );
  assert.equal(
    source.presentationResponse.transferPolicy.googlePixelsRedistributed,
    false,
  );
  assert.ok(Math.abs(
    atmosphere.physicalRadius / atmosphere.planetRadius -
      source.outerRadiusRatio,
  ) < 1e-12);
  assert.equal(atmosphere.sourceTileSize, EARTH_MATERIAL_TILE_SIZE);
  assert.deepEqual(atmosphere.defaultAssets, {
    one: "/scenes/earth/earth-atmosphere-default.webp",
    two: "/scenes/earth/earth-atmosphere-default@2x.webp",
  });
  assert.equal(atmosphere.frames.every(({ assets }) =>
    assets.one.endsWith(".webp") && assets.two.endsWith("@2x.webp")), true);

  for (const density of [1, 2]) {
    const suffix = density === 2 ? "@2x" : "";
    const { data, info } = await sharp(resolve(
      publicRoot,
      `earth-atmosphere-default${suffix}.webp`,
    )).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, EARTH_MATERIAL_TILE_SIZE * density);
    assert.equal(info.height, EARTH_MATERIAL_TILE_SIZE * density);
    let alpha = 0;
    let maximumAlpha = 0;
    const weighted = [0, 0, 0];
    for (let offset = 0; offset < data.length; offset += 4) {
      const pixelAlpha = data[offset + 3];
      alpha += pixelAlpha;
      maximumAlpha = Math.max(maximumAlpha, pixelAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        weighted[channel] += data[offset + channel] * pixelAlpha;
      }
    }
    const color = weighted.map((value) => value / alpha);
    assert.ok(maximumAlpha >= 96 && maximumAlpha <= 120, maximumAlpha);
    assert.ok(color[2] - color[1] >= 12, JSON.stringify(color));
    assert.ok(color[1] - color[0] >= 16, JSON.stringify(color));
  }

  const directionalFrames = [];
  for (const frameIndex of [0, 127]) {
    const frame = atmosphere.frames[frameIndex];
    const { data, info } = await sharp(resolve(
      publicRoot,
      `earth-atmosphere-row-${String(frame.rowIndex).padStart(2, "0")}.webp`,
    )).extract({
      left: frame.columnIndex * atmosphere.stride + atmosphere.gutter,
      top: frame.tileRowIndex * atmosphere.stride + atmosphere.gutter,
      width: atmosphere.sourceTileSize,
      height: atmosphere.sourceTileSize,
    }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let alpha = 0;
    let weightedY = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const pixelAlpha = data[(y * info.width + x) * 4 + 3];
        alpha += pixelAlpha;
        weightedY += y * pixelAlpha;
      }
    }
    directionalFrames.push({ alpha, centerY: weightedY / alpha });
  }
  assert.ok(directionalFrames[0].alpha > directionalFrames[1].alpha * 2);
  assert.ok(directionalFrames[1].centerY - directionalFrames[0].centerY > 80);
});

test("publishes the prepared Earth title and retained scene", async () => {
  assert.equal(PREPARED_EARTH_TITLE.label, "Earth");
  assert.equal(PREPARED_EARTH_TITLE.sourceSha256, "746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c");
  assert.doesNotMatch(PREPARED_EARTH_TITLE.path, /<text|font-family/iu);
  assert.equal(PREPARED_EARTH_SCENE.schema, "cssearth-prepared-retained-scene@6");
  assert.equal(PREPARED_EARTH_SCENE.counts.surfaceLeafCount, 450);
  assert.equal(PREPARED_EARTH_SCENE.counts.cloudLeafCount, 0);
  assert.equal("moon" in PREPARED_EARTH_SCENE, false);
  assert.equal(Object.keys(PREPARED_EARTH_SCENE.counts).some((key) =>
    /moon|orbitGuide/u.test(key)), false);
  assert.equal(PREPARED_EARTH_SCENE.counts.retainedLeafCount, 453);
  assert.equal(PREPARED_EARTH_SCENE.counts.interiorLeafCount, 546);
  assert.equal(PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount, 999);
  assert.equal(PREPARED_EARTH_SCENE.counts.runtimeGeometryPreparation, false);
  assert.equal(PREPARED_EARTH_SCENE.counts.runtimeRasterization, false);
  const surfaceLeaves = PREPARED_EARTH_SCENE.body.bands.flatMap(({ leaves }) =>
    leaves);
  assert.equal(surfaceLeaves.length, 450);
  assert.equal(PREPARED_EARTH_SCENE.body.polarCapBandSpan, 1);
  assert.equal(PREPARED_EARTH_SCENE.body.bands[1].leaves.length, 32);
  assert.equal(PREPARED_EARTH_SCENE.body.bands[14].leaves.length, 32);
  const rasterLeaves = surfaceLeaves.filter(({ className }) =>
    className.includes("earth-surface-leaf"));
  assert.equal(rasterLeaves.length, 448);
  assert.ok(rasterLeaves.every(({ className, style, leafWidth, leafHeight }) =>
    leafWidth <= 32 && leafHeight <= 32 &&
    style.includes("background-position:") &&
    style.includes("background-size:") &&
    !style.includes("--polycss-projective-texture-") &&
    !className.includes("polycss-projective-texture-clip")));
  assert.ok(surfaceLeaves.every(({ projection }) => projection === "projective"));
  assert.equal(PREPARED_EARTH_SCENE.material.lighting.frameCount, 128);
  assert.equal(PREPARED_EARTH_SCENE.material.atmosphere.frameCount, 128);
  for (const role of ["lighting", "atmosphere"]) {
    const material = PREPARED_EARTH_SCENE.material[role];
    const shardSide = Math.sqrt(EARTH_MATERIAL_FRAMES_PER_SHARD);
    assert.equal(material.columns, shardSide);
    assert.equal(material.rows, shardSide);
    assert.equal(material.framesPerShard, EARTH_MATERIAL_FRAMES_PER_SHARD);
    assert.equal(material.shardCount,
      128 / EARTH_MATERIAL_FRAMES_PER_SHARD);
    assert.equal(material.preparedRows.length, material.shardCount);
    assert.equal(material.transport.model, "row-shard-cache");
    assert.equal(material.transport.framesPerShard,
      EARTH_MATERIAL_FRAMES_PER_SHARD);
    assert.equal(material.transport.shardCount, material.shardCount);
    assert.equal(material.transport.maximumRetainedRowCount, 3);
    assert.equal(material.defaultRow,
      Math.floor(material.defaultFrame / EARTH_MATERIAL_FRAMES_PER_SHARD));
    assert.equal(material.transport.defaultRow, material.shardCount - 1);
    assert.deepEqual(material.transport.initialWarmRows,
      [material.shardCount - 1]);
    assert.equal(material.transformPlayback.schema,
      "cssearth-prepared-material-transform@1");
    assert.equal(material.transformPlayback.keyframes.length, 129);
    assert.equal(material.transformPlayback.runtimeTransformConstruction, false);
    for (const density of [1, 2]) {
      const suffix = density === 2 ? "@2x" : "";
      for (let rowIndex = 0;
        rowIndex < material.shardCount;
        rowIndex += 1) {
        const row = await sharp(resolve(
          publicRoot,
          `earth-${role}-row-${String(rowIndex).padStart(2, "0")}` +
            `${suffix}.webp`,
        )).metadata();
        assert.equal(row.width, 508 * density * shardSide);
        assert.equal(row.height, 508 * density * shardSide);
      }
    }
    for (const frame of material.frames) {
      assert.equal(frame.rowIndex,
        Math.floor(frame.frameIndex / EARTH_MATERIAL_FRAMES_PER_SHARD));
      const frameOffset = frame.frameIndex %
        EARTH_MATERIAL_FRAMES_PER_SHARD;
      assert.equal(frame.columnIndex,
        frameOffset % shardSide);
      assert.equal(frame.tileRowIndex, Math.floor(frameOffset / shardSide));
    }
  }
  assert.notEqual(
    PREPARED_EARTH_SCENE.material.lighting.frames[0].transform,
    PREPARED_EARTH_SCENE.material.lighting.frames.at(-1).transform,
  );
  assert.equal("interior" in PREPARED_EARTH_SCENE.material, false);
  assert.equal(PREPARED_EARTH_SCENE.camera.maximumZoom, 8);
  assert.equal(PREPARED_EARTH_SCENE.body.assets.surface.url,
    "/scenes/earth/earth-surface.webp");
  assert.equal(PREPARED_EARTH_SCENE.body.assets.poles.url,
    "/scenes/earth/earth-surface-poles.webp");
  assert.equal(PREPARED_EARTH_SCENE.body.seamRepair.seamBleed, 0);
  assert.equal(
    PREPARED_EARTH_SCENE.body.seamRepair.rasterOverscan,
    PREPARED_EARTH_SCENE.body.assets.surface.presentationCellSize *
      PREPARED_EARTH_SCENE.body.seamRepair.presentationOverlap,
  );
  assert.deepEqual(
    await Promise.all(["earth-surface.webp", "earth-surface-poles.webp"]
      .map(async (filename) => {
        const { width, height } = await sharp(resolve(publicRoot, filename))
          .metadata();
        return { width, height };
      })),
    [{ width: 8320, height: 6144 }, { width: 2048, height: 512 }],
  );
  const polarLeaves = surfaceLeaves.filter(({ className }) =>
    className.includes("earth-polar"));
  assert.equal(polarLeaves.some(({ className }) =>
    className.includes("earth-polar-inner")), false);
  assert.equal(new Set(polarLeaves.map(({ sourceRect }) =>
    `${sourceRect.x}:${sourceRect.y}`)).size, 2);
  const interiorSource = JSON.parse(await readFile(
    new URL("../source/interior/earth-interior.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(PREPARED_EARTH_SCENE.interior.source.layers,
    interiorSource.layers);
  assert.equal(PREPARED_EARTH_SCENE.interior.runtimeGeometry, false);
  assert.equal(PREPARED_EARTH_SCENE.interior.runtimeRasterization, false);
  assert.equal(PREPARED_EARTH_SCENE.interior.presentationLock.schema,
    "cssearth-prepared-interior-presentation-lock@1");
  assert.equal(
    PREPARED_EARTH_SCENE.interior.presentationLock
      .referenceControlYawDegrees,
    -105,
  );
  assert.equal(
    PREPARED_EARTH_SCENE.interior.presentationLock
      .changesPhysicalAxialTiltClaim,
    false,
  );
  assert.equal(PREPARED_EARTH_SCENE.camera.orbitPlayback.schema,
    "cssearth-prepared-camera-orbit@1");
  assert.equal(PREPARED_EARTH_SCENE.camera.orbitPlayback.keyframes.length, 2);
  assert.equal(PREPARED_EARTH_SCENE.camera.orbitPlayback.runtimeTransport,
    "paused-waapi-current-time-only");
  assert.equal(PREPARED_EARTH_SCENE.camera.orbitPlayback
    .runtimeTransformConstruction, false);
  assert.deepEqual(PREPARED_EARTH_SCENE.interior.shells.map(({ id }) => id),
    ["mantle", "outer-core", "inner-core"]);
  assert.equal(PREPARED_EARTH_SCENE.interior.sectionLeaves.length, 2);
});

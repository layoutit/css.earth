import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

import { PREPARED_SATURN_SCENE } from "../runtime/preparedScene.mjs";

test("prepares three upper-hemisphere storms on separate retained bands", async () => {
  const weather = PREPARED_SATURN_SCENE.preparedLighting.weather;
  const weatherLeaves = PREPARED_SATURN_SCENE.bodyBands
    .flatMap(({ leaves }) => leaves)
    .filter(({ preparedWeather }) => preparedWeather);
  const asset = await readFile(new URL(
    "../../../../public/scenes/saturn/saturn-weather.webp", import.meta.url));
  const sourceSnapshot = await readFile(new URL(
    "../source/saturn-weather-static.webp", import.meta.url));

  assert.equal(weather.model,
    "prepared-source-texel-independent-fixed-center-curls");
  assert.equal(weather.targetFaceCount, 9);
  assert.equal(weather.targetFaceIndices.length, 9);
  assert.equal(weather.targetFaceOrdinals.length, 448);
  assert.equal(weather.targetFaceOrdinals.filter((ordinal) => ordinal >= 0).length,
    9);
  assert.equal(weather.storms.length, 3);
  assert.deepEqual(weather.storms.map(({ latitudeDegrees }) => latitudeDegrees),
    [39.375, 16.875, 5.625]);
  assert.ok(weather.storms.every(({ latitudeDegrees }) => latitudeDegrees > 0));
  assert.deepEqual(weather.storms.map(({ longitudeStartIndex }) =>
    longitudeStartIndex), [9, 20, 30]);
  assert.deepEqual(weather.storms.map((storm, index, storms) =>
    (storms[(index + 1) % storms.length].longitudeStartIndex -
      storm.longitudeStartIndex + 32) % 32), [11, 10, 11]);
  assert.deepEqual(weather.storms.map(({ sourceCenter }) => sourceCenter),
    [[137, 58], [110, 68], [122, 62]]);
  assert.ok(weather.storms.every(({ longitudeCount }) => longitudeCount === 3));
  assert.equal(weather.frameCount, 1);
  assert.equal(weather.frameRate, 0);
  assert.equal(weather.frameColumns, 1);
  assert.equal(weather.frameRows, 1);
  assert.equal(weather.atlasWidth, 290);
  assert.equal(weather.atlasHeight, 34);
  assert.equal(weather.runtimePlayback, false);
  assert.equal(weather.addressPublication, "none-static-prepared-texels");
  assert.equal("lightingFrameDivisor" in weather, false);
  assert.equal(weather.opacity, 0.5);
  assert.deepEqual(weather.storms.map(({ sourceMotionGain }) => sourceMotionGain),
    [1.75, 1.45, 1.38]);
  assert.deepEqual(weather.storms.map(({ armCount }) => armCount), [2, 0, 0]);
  assert.deepEqual(weather.storms.map(({ armProfileExponent }) =>
    armProfileExponent), [3, 3, 3]);
  assert.deepEqual(weather.storms.map(({ brightArmAmplitude }) =>
    brightArmAmplitude), [70, 0, 0]);
  assert.deepEqual(weather.storms.map(({ brightEyeWallAmplitude }) =>
    brightEyeWallAmplitude), [44, 48, 42]);
  assert.deepEqual(weather.storms.map(({ bodyLiftAmplitude }) =>
    bodyLiftAmplitude), [10, 11, 9]);
  assert.deepEqual(weather.storms.map(({ darkEyeAmplitude }) =>
    darkEyeAmplitude), [26, 20, 17]);
  assert.deepEqual(weather.storms.map(({ rotationTurnsPerCycle }) =>
    rotationTurnsPerCycle), [1, 1, 1]);
  assert.equal(weather.extraDomLeaves, 0);
  assert.equal(weather.runtimeMath, false);
  assert.equal(weather.runtimeRasterization, false);
  assert.equal(weatherLeaves.length, 9);
  assert.equal(PREPARED_SATURN_SCENE.counts.planetPolygonCount, 453);
  assert.equal(asset.byteLength, weather.assetBytes);
  assert.equal(createHash("sha256").update(asset).digest("hex"),
    weather.assetSha256);
  assert.equal(weather.encoding, "webp-q75-alpha-q100");
  assert.equal(weather.alphaEncoding, "lossless");
  const [preparedPixels, sourcePixels] = await Promise.all([
    sharp(asset).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(sourceSnapshot).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  assert.equal(preparedPixels.info.width, sourcePixels.info.width);
  assert.equal(preparedPixels.info.height, sourcePixels.info.height);
  for (let offset = 3; offset < sourcePixels.data.length; offset += 4) {
    assert.equal(preparedPixels.data[offset], sourcePixels.data[offset]);
  }
  assert.equal(weather.sourceSnapshotPath,
    "source/saturn-weather-static.webp");
  assert.equal(createHash("sha256").update(sourceSnapshot).digest("hex"),
    weather.sourceSnapshotSha256);
  assert.equal("frameColumnBackgroundPositions" in weather, false);
  assert.equal("frameRowBackgroundPositions" in weather, false);

  for (const leaf of weatherLeaves) {
    assert.match(leaf.style,
      /background-image:url\(\/scenes\/saturn\/saturn-weather\.webp\),var\(--polycss-projective-texture-image\)/);
    assert.equal(leaf.style.match(/background-image:/g)?.length, 1);
  }
  assert.equal(PREPARED_SATURN_SCENE.bodyBands.flatMap(({ leaves }) => leaves)
    .filter(({ style }) =>
    style.includes("saturn-weather.webp")).length, 9);
});

test("awaits the prepared storm atlas before declaring the scene ready", async () => {
  const [html, client] = await Promise.all([
    readFile(new URL("../site/SaturnHead.astro", import.meta.url), "utf8"),
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /rel="preload" href="\/scenes\/saturn\/saturn-weather\.webp"/);
  assert.match(client, /decodeImage\(PLANET_WEATHER_TEXTURE_URL\)/u);
  assert.doesNotMatch(client, /createElement\([^)]*weather|weatherPlayer|weatherTargets/);
});

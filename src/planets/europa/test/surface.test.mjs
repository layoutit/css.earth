import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { verifyEuropaSourceManifest } from "../tools/source-manifest.mjs";
import { COLOR_PHOTOMETRY, colorPhotometricGain, loadColorGeometry } from "../tools/color-photometry.mjs";

test("observed terrain survives preparation and explicit polar no-data stays marked", async () => {
  await verifyEuropaSourceManifest();
  const sourcePath = new URL("../source/europa-global-500m.tif", import.meta.url).pathname;
  const tiff = await fromFile(sourcePath);
  const source = await tiff.getImage();
  assert.equal(source.getGDALNoData(), 0);
  const bottom = await source.readRasters({window:[9800,9815,9830,9816], interleave:true});
  assert.ok(bottom.every(value => value === 0));
  await tiff.close();
  const path = new URL("../../../../public/scenes/europa/europa-normal-map.webp", import.meta.url).pathname;
  const map = await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(map.info.width, 4096);
  assert.equal(map.info.height, 2048);
  const observed = await sharp(sourcePath).resize(4096,2048,{fit:"fill",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
  for (const [x,y] of [[700,750],[1500,1024],[2400,900],[3100,1100]]) {
    const i = (y * 4096 + x) * 3;
    for (let c=0;c<3;c++) assert.ok(Math.abs(map.data[i+c] - observed[i+c]) <= 1);
  }
  const south = (2047 * 4096 + 2048) * 3;
  assert.deepEqual([...map.data.subarray(south,south+3)], [82,84,82]);
  const metadata = JSON.parse(await readFile(new URL("../.prepared/surfaces.json", import.meta.url)));
  assert.ok(metadata.surfaces[0].missingPixels > 0);
  assert.ok(metadata.surfaces[0].missingPixels < 4096 * 2048 / 10);
  const enhanced = await sharp(new URL("../../../../public/scenes/europa/europa-enhanced-map.webp", import.meta.url).pathname)
    .removeAlpha().raw().toBuffer();
  // The 2500,400 / 2300,500 patches previously used the coarse 28ESGLOCOL01
  // observation. They must now preserve the sharper monochrome source.
  for (const [x,y] of [[700,750],[3100,1100],[2048,2047],[2500,400],[2300,500],[1900,750]]) {
    const i = (y * 4096 + x) * 3;
    assert.deepEqual(enhanced.subarray(i,i+3),map.data.subarray(i,i+3), "Monochrome terrain and true gaps remain intact outside color coverage");
  }
  const color = (700 * 4096 + 1500) * 3;
  assert.notDeepEqual(enhanced.subarray(color,color+3),map.data.subarray(color,color+3), "Observed color overlays the base");
  assert.ok(metadata.surfaces[1].monochromePixels > 4096 * 2048 / 2);
  assert.ok(metadata.surfaces[1].photometry.correctedPixels > 400000);
  assert.ok(metadata.surfaces[1].photometry.withheldPixels > 200000);
  assert.equal(metadata.surfaces[1].photometry.clippedChannels, 0, "Correction must not erase highlights");
});

test("disk normalization preserves its reference and withholds oblique or unlit observations", () => {
  const normal = [1, 0, 0], radius = COLOR_PHOTOMETRY.radiusKm;
  const position = degrees => [radius + 10000 * Math.cos(degrees * Math.PI / 180), 10000 * Math.sin(degrees * Math.PI / 180), 0];
  assert.ok(Math.abs(colorPhotometricGain(normal, { sun:position(30), observer:position(0) }) - 1) < 1e-12);
  const gain = colorPhotometricGain(normal, { sun:position(60), observer:position(0) });
  assert.ok(gain > 1 && gain < 1.5);
  assert.ok(.001 * gain > 0, "Observed dark terrain is scaled, never classified as absent");
  for (const angle of [76, 90, 120, 180]) {
    assert.equal(colorPhotometricGain(normal, { sun:position(angle), observer:position(0) }), null);
    assert.equal(colorPhotometricGain(normal, { sun:position(30), observer:position(angle) }), null);
  }
});

test("capture vectors match the source geometry in the controlled east-positive frame", async () => {
  const geometry = await loadColorGeometry();
  assert.equal(geometry.size, 13);
  const [, first] = [...geometry].find(([id]) => id.includes("s0440984926"));
  const coordinates = v => ({ latitude:Math.asin(v[2] / Math.hypot(...v)) * 180 / Math.PI,
    longitude:(Math.atan2(v[1], v[0]) * 180 / Math.PI + 360) % 360, distance:Math.hypot(...v) });
  const sun = coordinates(first.sun), observer = coordinates(first.observer);
  // Original Galileo PDS label: Sun 1.399 N / 243.734 W, spacecraft
  // 0.047 N / 166.336 W. W0 changes from 35.67 to the controlled 36.054.
  // Small remaining differences come from the reconstructed ephemerides.
  assert.ok(Math.abs(sun.latitude - 1.399) < .001);
  assert.ok(Math.abs(observer.latitude - .047) < .001);
  assert.ok(Math.abs(sun.longitude - (360 - 243.734 - .384)) < .005);
  assert.ok(Math.abs(observer.longitude - (360 - 166.336 - .384)) < .005);
  assert.ok(Math.abs(observer.distance - 143510.7) < 10);
});

test("color sampling withholds incomplete footprints without erasing observed dark terrain", async () => {
  const { sampleColorBand } = await import("../tools/prepare-color.mjs");
  const band = { width:2,height:2,origin:[0,2],resolution:[1,-1],data:new Float32Array([.001,.001,.001,.001]) };
  assert.ok(sampleColorBand(band,1,1) > 0);
  band.data[3] = 0;
  assert.equal(sampleColorBand(band,1,1), null, "A missing contributor cannot be interpolated into color");
  band.data[3] = -3.4028234663852886e38;
  assert.equal(sampleColorBand(band,1,1), null, "ISIS special pixels cannot become terrain");
  assert.equal(sampleColorBand(band,0,0), null, "The image footprint cannot be extrapolated");
});

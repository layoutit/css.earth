import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { verifyEuropaSourceManifest } from "../tools/source-manifest.mjs";

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
});

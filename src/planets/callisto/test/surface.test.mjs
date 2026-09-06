import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { verifyCallistoSourceManifest } from "../tools/source-manifest.mjs";
import { verifyRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const sourcePath = new URL("../source/callisto-global-1km.tif", import.meta.url).pathname;
const publicRoot = new URL("../../../../public/scenes/callisto/", import.meta.url).pathname;

test("source coordinates and explicit no-data agree with the prepared map", async () => {
  await verifyCallistoSourceManifest();
  const tiff = await fromFile(sourcePath);
  try {
    const source = await tiff.getImage();
    assert.deepEqual([source.getWidth(), source.getHeight(), source.getGDALNoData()], [15138, 7569, 0]);
    const [x0, y0] = source.getOrigin(), [dx, dy] = source.getResolution();
    const radius = source.getGeoKeys().GeogSemiMajorAxisGeoKey;
    // Independent IAU landmark: Valhalla, 14.7 N, 56 W = 304 E.
    const x = (radius * (304 - 180) * Math.PI / 180 - x0) / dx;
    const y = (radius * 14.7 * Math.PI / 180 - y0) / dy;
    assert.ok(Math.abs(x / source.getWidth() - 304 / 360) < 1e-8);
    assert.ok(Math.abs(y / source.getHeight() - (90 - 14.7) / 180) < 1e-8);
    const landmark = await source.readRasters({ window: [Math.floor(x), Math.floor(y), Math.floor(x) + 1, Math.floor(y) + 1], interleave: true });
    assert.ok(landmark[0] > 0, "Valhalla is observed terrain");
    const polarGap = await source.readRasters({ window: [7568, 7568, 7570, 7569], interleave: true });
    assert.ok(polarGap.every(value => value === 0), "The selected south polar gap is source no-data");
  } finally { await tiff.close(); }
  const {data, info} = await sharp(`${publicRoot}/callisto-normal-map.webp`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width, info.height], [8192, 4096]);
  const observed = await sharp(sourcePath).resize(8192,4096,{fit:"fill",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
  for (const [x,y] of [[1500,1500],[3000,2048],[4800,1800],[6917,1713]]) {
    const i = (y * info.width + x) * 3;
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(data[i+c] - observed[i+c]) <= 1, "Observed terrain is not flattened or recolored");
  }
  const gap = ((info.height - 1) * info.width + info.width / 2) * 3;
  assert.notEqual(data[gap], data[gap+1], "Explicit no-data carries the neutral grid, not black or invented terrain");
  let darkObserved = 0;
  for (let i = 0; i < data.length; i += 3) if (data[i] > 0 && data[i] < 20 && data[i] === data[i+1] && data[i] === data[i+2]) darkObserved++;
  assert.ok(darkObserved > 100, "Nonzero dark observations survive the validity mask");
});

test("runtime closure includes Callisto's parent image and canonical surface geometry", async () => {
  const manifest = JSON.parse(await readFile(new URL("../runtime-assets.json", import.meta.url)));
  await verifyRuntimeAssetClosure({planetId:"callisto",manifest,root:publicRoot});
  const { surfaces: [surface] } = JSON.parse(await readFile(new URL("../.prepared/surfaces.json", import.meta.url)));
  assert.equal(surface.layout.gutter / surface.layout.width, 1 / 128);
  assert.ok(surface.missingPixels > 0 && surface.missingPixels < 8192 * 4096 / 10);
  assert.deepEqual((await sharp(`${publicRoot}/callisto-normal-poles@2x.webp`).metadata()).width, 2048);
  assert.equal((await sharp(`${publicRoot}/callisto-parent-jupiter.webp`).metadata()).width, 1024);
});

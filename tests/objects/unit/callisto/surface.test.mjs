import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromFile } from "geotiff";
import {publishedObservation,expectedMonochromeTexel,assertDisplayClose,countInteriorPixels} from "../observed-atlas-proof.mjs";
import {missingCoverageColor} from "../../../../src/platform/prepare-missing-coverage.mts";
import {createSourceManifest} from "../../../../src/platform/source-manifest.mts";
const source = await createSourceManifest({planetId:"callisto",planetName:"Callisto",sourceRoot:new URL("../../../../src/planets/callisto/source/",import.meta.url).pathname});
const verifyCallistoSourceManifest = () => source.verify();
const callistoSourceInputsFor = consumer => source.inputsFor(consumer);
import { verifyRuntimeAssetClosure } from "../../../../src/platform/runtime-asset-closure.mts";

const sourcePath = new URL("../../../../src/planets/callisto/source/callisto-global-1km.tif", import.meta.url).pathname;
const publicRoot = new URL("../../../../public/scenes/callisto/", import.meta.url).pathname;

test("source coordinates and explicit no-data agree with the actual retained atlas", async () => {
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
  const surface=await publishedObservation('callisto','normal');
  assert.deepEqual([surface.record.layout.width,surface.record.layout.height],[8192,4096]);
  const file=await fromFile(sourcePath);
  try{
    const image=await file.getImage(),entry=callistoSourceInputsFor('surfaces').find(e=>e.lensId==='normal');
    for(const [longitude,latitude]of [[66,24],[132,0],[211,11],[304,14.7]]){
      const actual=surface.sample(longitude,latitude);
      const value=await expectedMonochromeTexel(image,entry,surface.record.layout,actual);
      assertDisplayClose(actual.rgb,[value,value,value],'Observed native monochrome remains in the retained runtime atlas');
    }
  }finally{await file.close();}
  const gap=surface.sample(180,-89.99);
  assertDisplayClose(gap.rgb,missingCoverageColor(gap.longitude,gap.latitude,180/4096),'Explicit south polar no-data retains the neutral grid');
  assert.ok(countInteriorPixels(surface,(r,g,b)=>r>0&&r<20&&Math.abs(r-g)<3&&Math.abs(r-b)<3)>100,'Nonzero dark observations survive the validity mask');
});

test("runtime closure includes Callisto's parent image and canonical surface geometry", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../../../src/planets/callisto/runtime-assets.json", import.meta.url)));
  await verifyRuntimeAssetClosure({planetId:"callisto",manifest,root:publicRoot});
  const { surfaces: [surface] } = JSON.parse(await readFile(new URL("../../../../src/planets/callisto/prepared/surfaces.json", import.meta.url)));
  assert.equal(surface.layout.gutter / surface.layout.width, 1 / 128);
  assert.ok(surface.missingPixels > 0 && surface.missingPixels < 8192 * 4096 / 10);
  assert.deepEqual((await sharp(`${publicRoot}/callisto-normal-poles@2x.webp`).metadata()).width, 2048);
  assert.equal((await sharp(`${publicRoot}/callisto-parent-jupiter.webp`).metadata()).width, 1024);
});

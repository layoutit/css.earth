import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fromFile } from "geotiff";
import { verifyGanymedeSourceManifest, ganymedeSourceInputsFor } from "../tools/source-manifest.mjs";

const root=new URL("../../../../public/scenes/ganymede/",import.meta.url);
test("source maps retain georeference and valid observed terrain",async()=>{
 await verifyGanymedeSourceManifest();
 const entries=ganymedeSourceInputsFor("surfaces");
 for(const entry of entries) {
  const tiff=await fromFile(new URL(`../source/${entry.path}`,import.meta.url).pathname),image=await tiff.getImage();
  assert.equal(image.getGDALNoData(),0);
  const [x,y]=image.getOrigin(),[dx,dy]=image.getResolution(),radius=entry.projection.referenceRadiusMeters;
  assert.ok(Math.abs(180+x/radius*180/Math.PI)<.02,"left edge is zero east, not a mirrored 180-degree origin");
  assert.ok(Math.abs(y/radius*180/Math.PI-90)<.02);
  assert.ok(dx>0&&dy<0);
  await tiff.close();
 }
 const sourcePath=new URL("../source/ganymede-mono.tif",import.meta.url).pathname;
 const map=await sharp(new URL('ganymede-normal-map.webp',root).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(map.info.width,8192);assert.equal(map.info.height,4096);
 const observed=await sharp(sourcePath).resize(8192,4096,{fit:"fill",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
 for(const [x,y]of [[1500,1500],[4000,2048],[6000,2000],[7200,2800]]){
  const i=(y*8192+x)*3;for(let c=0;c<3;c++)assert.ok(Math.abs(map.data[i+c]-observed[i+c])<=1);
 }
});

test("enhanced color preserves monochrome across synthesized and missing source coverage",async()=>{
 const normal=await sharp(new URL('ganymede-normal-map.webp',root).pathname).removeAlpha().raw().toBuffer();
 const enhanced=await sharp(new URL('ganymede-enhanced-map.webp',root).pathname).removeAlpha().raw().toBuffer();
 // 230 degrees west lies inside the independently documented synthesized-red sector.
 const x=Math.floor(130/360*8192);
 for(const y of [300,1200,2048,3200,3800]) {
  const i=(y*8192+x)*3;assert.deepEqual(enhanced.subarray(i,i+3),normal.subarray(i,i+3));
 }
 let colored=0;for(let i=0;i<enhanced.length;i+=3)if(Math.max(enhanced[i],enhanced[i+1],enhanced[i+2])-Math.min(enhanced[i],enhanced[i+1],enhanced[i+2])>12)colored++;
 assert.ok(colored>8192*4096/4,"enhanced lens retains real color outside withheld coverage");
 const metadata=JSON.parse(await readFile(new URL('../.prepared/surfaces.json',import.meta.url))).surfaces;
 assert.ok(metadata[1].withheldSyntheticPixels>0);assert.ok(metadata[1].monochromePixels>8192*4096/10);
 for(const surface of metadata) {
  assert.equal(surface.layout.gutter,64,"atlas gutters scale with the canonical 8k map");
  const poles=await sharp(new URL(`ganymede-${surface.id}-poles@2x.webp`,root).pathname).metadata();
  assert.equal(poles.width,2048);assert.equal(poles.height,1024);
 }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { verifyIoSourceManifest } from "../tools/source-manifest.mjs";
import { verifyRuntimeAssetClosure } from "../../../platform/runtime-asset-closure.mjs";

const root=new URL('../../../../public/scenes/io/',import.meta.url);
async function pixels(id){return sharp(new URL(`io-${id}-map.webp`,root).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true});}

test('Io binds its independent source and prepared runtime closure',async()=>{
 assert.equal((await verifyIoSourceManifest()).inputCount,5);
 const manifest=JSON.parse(await readFile(new URL('../runtime-assets.json',import.meta.url)));
 await verifyRuntimeAssetClosure({planetId:'io',manifest,root:root.pathname});
 assert.ok(manifest.assets.some(a=>a.filename==='io-parent-jupiter.webp'));
});

test('Io withholds interpolated polar color and retains observed monochrome',async()=>{
 const [normal,color]=await Promise.all([pixels('normal'),pixels('enhanced')]);
 assert.equal(color.info.width,4096);assert.equal(color.info.height,2048);
 for(const y of [0,20,45,2002,2027,2047]) {
  const start=y*4096*3,end=start+4096*3;
  assert.deepEqual(color.data.subarray(start,end),normal.data.subarray(start,end),`latitude row ${y} keeps monochrome or the shared gap`);
 }
 // Observed dark terrain is not treated as missing merely for low brightness.
 let observedDark=0,observedGray=0;
 for(let y=400;y<1650;y++)for(let x=0;x<4096;x++){
  const i=(y*4096+x)*3, r=normal.data[i],g=normal.data[i+1],b=normal.data[i+2];
  if(r===g&&g===b){observedGray++;if(r>0&&r<35)observedDark++;}
 }
 assert.ok(observedGray>4_000_000);assert.ok(observedDark>1000);
});

test('Pele is south of the equator at the independently published positive-west longitude',async()=>{
 // IAU/USGS Gazetteer feature 4638: 18.71 S, 255.28 W = 104.72 E.
 // Its large red plume deposit distinguishes this from a reflected/180-degree map.
 const {data,info}=await pixels('enhanced');
 function redFraction(lon){let red=0,count=0;for(let lat=-30;lat<-6;lat+=.3)for(let x=lon-12;x<lon+12;x+=.3){
  const i=(Math.floor((90-lat)/180*info.height)*info.width+Math.floor(x/360*info.width))*3;
  if(data[i]>data[i+1]*1.35&&data[i]>data[i+2]*1.5)red++;count++;
 }return red/count;}
 assert.ok(redFraction(104.72)>.45);assert.ok(redFraction(255.28)<.05);
});

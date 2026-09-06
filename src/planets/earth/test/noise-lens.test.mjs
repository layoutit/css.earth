import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PREPARED_EARTH_NOISE as plan } from "../runtime/preparedNoise.mjs";
import { PREPARED_GEOGRAPHIC_LENSES } from "../runtime/preparedGeographicLenses.mjs";
const pin=JSON.parse(await readFile(new URL("../source/noise/manifest.json",import.meta.url))),source=gunzipSync(await readFile(new URL(`../source/noise/${pin.file}`,import.meta.url)));
const data=JSON.parse(source);
const hash=b=>createHash("sha256").update(b).digest("hex");
test("noise overlay is bound to the official 2025 daytime source and explicit units",async()=>{
  assert.equal(hash(source),pin.decodedSha256);assert.equal(plan.sourceSha256,pin.decodedSha256);assert.equal(data.features.length,181);
  assert.equal(pin.license,"CC-BY-2.5-AR");assert.equal(pin.year,2025);assert.equal(pin.period,"Diurno");assert.equal(pin.units,"dBA");
  const descriptor=PREPARED_GEOGRAPHIC_LENSES[0].lens;
  const bytes=await readFile(new URL(`../../../../public${descriptor.package.url}`,import.meta.url));
  assert.equal(hash(bytes),descriptor.package.sha256);
  const lens=JSON.parse(bytes); assert.match(lens.qualification,/not live measurements/);
  assert.equal(lens.source.year,pin.year); assert.equal(lens.source.units,pin.units);
  assert.deepEqual(lens.legend.items.map(l=>l.label),plan.legend.map(l=>l.label));
});
const insideRing=(point,ring)=>{
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }return inside;
};
const insideFeature=(point,feature)=>{
  const polygons=feature.geometry.type==="Polygon"?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.some(([outer,...holes])=>insideRing(point,outer)&&!holes.some(hole=>insideRing(point,hole)));
};
test("prepared noise texels agree with independent source polygon classification",async()=>{
  const b=plan.bounds;
  for(const [lon,lat] of [[-58.382,-34.604],[-58.393,-34.588],[-58.44,-34.61],[-58.48,-34.65],[-58.42,-34.58]]){
    const px=Math.floor((lon-b.west)/(b.east-b.west)*4096),py=Math.floor((b.north-lat)/(b.north-b.south)*4096);
    const point=[b.west+(px+.5)/4096*(b.east-b.west),b.north-(py+.5)/4096*(b.north-b.south)];
    const matches=data.features.filter(f=>insideFeature(point,f));
    const page=plan.roots.find(p=>p.key.startsWith(`noise-day-${Math.floor(px/1024)}-${Math.floor(py/1024)}-`));
    const bytes=await readFile(new URL(`../../../../public${page.url}`,import.meta.url));assert.equal(hash(bytes),page.sha256);
    const pixel=await sharp(bytes).extract({left:px%1024,top:py%1024,width:1,height:1}).ensureAlpha().raw().toBuffer();
    if(matches.length===1 && pixel[3]>=166){
      const color=matches[0].properties.color.split(" ").map(Number);
      assert.ok(color.every((value,i)=>Math.abs(value-pixel[i])<=2),`${point}: ${pixel} / ${color}`);
    }else if(!matches.length)assert.ok(pixel[3]<166,"A source gap must not become a solid noise estimate.");
  }
});

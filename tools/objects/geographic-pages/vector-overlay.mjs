import { readFile,writeFile,mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import { prepareRangeLegend } from "./range-legend.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { prepareGeographicOverlayTile } from "./operations/geographic-overlay.mjs";
import { prepareLocationPoint,prepareLocationCamera } from "./prepare-location.mjs";
export async function prepareVectorOverlay({sourceDirectory,publicDirectory,config,scene,ownership}) {
const recipe=config.geographic.noise;
const source=pathToFileURL(resolve(sourceDirectory,recipe.directory)+'/'),pin=JSON.parse(await readFile(new URL("manifest.json",source),"utf8"));
const hash=bytes=>createHash("sha256").update(bytes).digest("hex"),packed=await readFile(new URL(pin.file,source));
if(packed.length!==pin.bytes||hash(packed)!==pin.sha256)throw new Error("Noise source archive does not match its pin.");
const bytes=gunzipSync(packed,{maxOutputLength:pin.decodedBytes});
if(bytes.length!==pin.decodedBytes||hash(bytes)!==pin.decodedSha256)throw new Error("Noise source content does not match its pin.");
const data=JSON.parse(bytes),polygons=feature=>feature.geometry.type==="Polygon"?[feature.geometry.coordinates]:feature.geometry.coordinates;
if(data.crs?.properties.name!=="urn:ogc:def:crs:OGC:1.3:CRS84"||data.features.length!==pin.features)throw new Error("Unexpected noise source coordinates or record count.");
const bounds={west:Infinity,east:-Infinity,south:Infinity,north:-Infinity};
for(const feature of data.features){
  if(!["Polygon","MultiPolygon"].includes(feature.geometry.type)||feature.properties.periodo!==recipe.period)throw new Error("Unexpected noise source feature.");
  for(const polygon of polygons(feature))for(const ring of polygon)for(const [x,y] of ring){
    if(x<recipe.bounds.west||x>recipe.bounds.east||y<recipe.bounds.south||y>recipe.bounds.north)throw new Error("Noise geometry outside Buenos Aires.");
    bounds.west=Math.min(bounds.west,x);bounds.east=Math.max(bounds.east,x);bounds.south=Math.min(bounds.south,y);bounds.north=Math.max(bounds.north,y);
  }
}
const {size,side,columns:cols}=recipe;
const project=([x,y])=>[(x-bounds.west)/(bounds.east-bounds.west)*size,(bounds.north-y)/(bounds.north-bounds.south)*size];
const paths=data.features.map(feature=>{
  const color=feature.properties.color.split(" ").map(Number);
  if(color.length!==3||color.some(n=>!Number.isInteger(n)||n<0||n>255))throw new Error("Invalid source noise color.");
  const path=polygons(feature).flatMap(polygon=>polygon.map(ring=>ring.map((point,i)=>`${i?"L":"M"}${project(point).map(n=>n.toFixed(3)).join(",")}`).join("")+"Z")).join("");
  return `<path fill="rgb(${color.join(",")})" fill-opacity="${recipe.opacity}" fill-rule="evenodd" d="${path}"/>`;
});
// Source vectors are rasterized only during preparation. Runtime mounts these
// transparent, source-colored textures over the same accepted Earth plane.
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join("")}</svg>`);
const raster=await sharp(svg,{limitInputPixels:size*size}).ensureAlpha().raw().toBuffer();
await mkdir(publicDirectory,{recursive:true});
const roots=[],assets=[];

for(let y=0;y<cols;y++)for(let x=0;x<cols;x++){
  const b={west:bounds.west+(bounds.east-bounds.west)*x/cols,east:bounds.west+(bounds.east-bounds.west)*(x+1)/cols,
    north:bounds.north+(bounds.south-bounds.north)*y/cols,south:bounds.north+(bounds.south-bounds.north)*(y+1)/cols};
  const image=await sharp(raster,{raw:{width:size,height:size,channels:4}}).extract({left:x*side,top:y*side,width:side,height:side}).webp({lossless:true,effort:6}).toBuffer();
  const sha256=hash(image),url=`${config.publicBase}${config.namespace}-noise-day-${x}-${y}-${sha256.slice(0,16)}.webp`;
  await writeFile(`${publicDirectory}/${url.split("/").at(-1)}`,image);assets.push(url);
  roots.push(...prepareGeographicOverlayTile(scene,b,{key:`noise-day-${x}-${y}`,
    width:side,height:side,url,bytes:image.length,sha256}));
}
const thumbnail=await sharp(raster,{raw:{width:size,height:size,channels:4}}).resize(96,96).flatten({background:"#171719"}).webp({lossless:true}).toBuffer();
await writeFile(`${publicDirectory}/${config.namespace}-lens-noise.webp`,thumbnail);assets.push(`${config.publicBase}${config.namespace}-lens-noise.webp`);
const legend=[...new Map(data.features.map(f=>[f.properties.rango,{label:f.properties.rango,color:`rgb(${f.properties.color.split(" ").join(",")})`,low:Number(f.properties.dba_low)}])).values()].sort((a,b)=>a.low-b.low);
const plan={...config.geographic.observation,dataset:`${pin.id}-${pin.year}`,qualification:pin.qualification,
  credit:`${pin.publisher}, ${pin.year}, ${pin.license}`,sourcePage:pin.sourcePage,sourceSha256:pin.decodedSha256,
  roots,initialLayer:roots[0],bounds,legend,assets,
  camera:prepareLocationCamera(scene,prepareLocationPoint(scene,recipe.camera.longitude,recipe.camera.latitude),recipe.camera.zoom,{body:scene[config.sceneBodyKey],camera:config.camera})};
const content={schema:"cssearth-geographic-lens@1",id:pin.id,entityIds:ownership.entityIds,baseLensId:recipe.baseLensId,
  label:recipe.label,qualification:pin.qualification,coverage:{bounds},
  source:{publisher:pin.publisher,year:pin.year,units:pin.units,url:pin.sourcePage,
    license:pin.license,licenseUrl:pin.licenseUrl,sha256:pin.decodedSha256},
  legend:prepareRangeLegend({title:recipe.label,units:pin.units,
    ranges:data.features.map(({properties:p})=>({low:Number(p.dba_low),high:Number(p.dba_high),label:p.rango,color:`rgb(${p.color.split(" ").join(",")})`}))}),
  pages:Object.fromEntries(Object.entries(plan).filter(([key])=>!["assets","camera","legend"].includes(key)))};
const packageBytes=Buffer.from(JSON.stringify(content)),sha256=hash(packageBytes);
const packageUrl=`${config.publicBase}geographic-lens-${pin.id}-${sha256.slice(0,16)}.json`;
await writeFile(`${publicDirectory}/${packageUrl.split("/").at(-1)}`,packageBytes);
const descriptor={id:pin.id,label:content.label,thumbnailUrl:`${config.publicBase}${config.namespace}-lens-noise.webp`,
  package:{url:packageUrl,bytes:packageBytes.length,sha256}};
assets.push(packageUrl);
return {plan,descriptor,assets,receipt:{features:data.features.length,bounds,tiles:roots.length,bytes:roots.reduce((s,p)=>s+p.bytes,0),sourceSha256:pin.decodedSha256}};
}

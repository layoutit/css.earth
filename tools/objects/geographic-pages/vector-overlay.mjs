import { readFile,writeFile,mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import { prepareCityPageGeometry } from "./page-geometry.mjs";
import { prepareGeographicTextureQuad } from "./wms-page-geometry.mjs";
import { prepareLocationPoint,prepareLocationCamera } from "./prepare-location.mjs";
export async function prepareVectorOverlay({sourceDirectory,publicDirectory,config,scene}) {
const recipe=config.geographic.noise;
const source=new URL(recipe.directory+'/',new URL('file://'+sourceDirectory+'/')),pin=JSON.parse(await readFile(new URL("manifest.json",source),"utf8"));
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
const coarse=prepareCityPageGeometry(recipe.coarse,scene);
for(let y=0;y<cols;y++)for(let x=0;x<cols;x++){
  const b={west:bounds.west+(bounds.east-bounds.west)*x/cols,east:bounds.west+(bounds.east-bounds.west)*(x+1)/cols,
    north:bounds.north+(bounds.south-bounds.north)*y/cols,south:bounds.north+(bounds.south-bounds.north)*(y+1)/cols};
  const image=await sharp(raster,{raw:{width:size,height:size,channels:4}}).extract({left:x*side,top:y*side,width:side,height:side}).webp({lossless:true,effort:6}).toBuffer();
  const sha256=hash(image),url=`${config.publicBase}${config.namespace}-noise-day-${x}-${y}-${sha256.slice(0,16)}.webp`;
  await writeFile(`${publicDirectory}/${url.split("/").at(-1)}`,image);assets.push(url);
  const mapping=prepareGeographicTextureQuad(coarse,{...b,west:b.west+360,east:b.east+360},32);
  const m=mapping.frameMatrix.split(",").map(Number);for(let i=0;i<3;i++)m[12+i]+=coarse.normal[i]*.003;
  roots.push({key:`noise-day-${x}-${y}`,level:0,x,y,normal:coarse.normal,...mapping,frameMatrix:m.join(","),
    width:side,height:side,children:[],url,bytes:image.length,sha256,rasterSource:"prepared-noise@1"});
}
const thumbnail=await sharp(raster,{raw:{width:size,height:size,channels:4}}).resize(96,96).flatten({background:"#171719"}).webp({lossless:true}).toBuffer();
await writeFile(`${publicDirectory}/${config.namespace}-lens-noise.webp`,thumbnail);assets.push(`${config.publicBase}${config.namespace}-lens-noise.webp`);
const legend=[...new Map(data.features.map(f=>[f.properties.rango,{label:f.properties.rango,color:`rgb(${f.properties.color.split(" ").join(",")})`,low:Number(f.properties.dba_low)}])).values()].sort((a,b)=>a.low-b.low);
const plan={schema:"cssearth-earth-city-pages@1",dataset:recipe.dataset,assetOrigin:recipe.assetOrigin,qualification:pin.qualification,
  credit:`${recipe.credit}, ${pin.year}, ${pin.license}`,sourcePage:pin.sourcePage,sourceSha256:pin.decodedSha256,
  roots,initialLayer:roots[0],rasterScale:32,poolSize:recipe.poolSize,minimumZoom:16,maximumDecodedBytes:recipe.poolSize*side*side*4,decodedPageBytes:side*side*4,
  targetCssPixels:2048,maximumConcurrentLoads:3,lensIds:[pin.id],index:{maximumDirectories:1,maximumBytes:1,maximumDirectoryBytes:1,maximumConcurrentLoads:1},
  bounds,legend,assets,camera:prepareLocationCamera(scene,prepareLocationPoint(scene,recipe.camera.longitude,recipe.camera.latitude),recipe.camera.zoom,{body:scene[config.sceneBodyKey],camera:config.camera})};
return plan;
}

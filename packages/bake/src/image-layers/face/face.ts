import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogueColor } from '@cssearth/engine';
import sharp from 'sharp';
import type { ImageLayerRecipe, Vec3 } from '../config.ts';
import { imageLayerDisc, imageLayerView, norm, rad } from '../disc.ts';
import { removeCompanionGalaxies, removeForegroundStars, type CompanionEllipse, type ForegroundRemoval } from './foreground.ts';

/** The recipe's foreground star table (CSV with a header row) placed on the face image and removed from it in place. */
async function removeCataloguedForeground(rgb: Buffer, width: number, height: number, recipe: ImageLayerRecipe, sourceDirectory: string): Promise<ForegroundRemoval> {
  const table=recipe.source.foregroundStars!, lines=(await readFile(resolve(sourceDirectory,table.path),'utf8')).trim().split(/\r?\n/), header=lines[0]!.split(',');
  const column=(name:string)=>{const index=header.indexOf(name);if(index<0)throw new TypeError(`${recipe.id}: ${table.path} has no ${JSON.stringify(name)} column (source.foregroundStars); its header is ${lines[0]}.`);return index;};
  const ra=column(table.raDegColumn),dec=column(table.decDegColumn),g=column(table.gMagColumn),view=imageLayerView(recipe);
  const stars=lines.slice(1).flatMap((line,row)=>{
    const cells=line.split(','),values=[ra,dec,g].map(index=>cells[index]?.trim()?Number(cells[index]):Number.NaN);
    if(values.some(value=>!Number.isFinite(value)))throw new TypeError(`${recipe.id}: ${table.path} row ${row+2} has no finite ${table.raDegColumn}, ${table.decDegColumn} or ${table.gMagColumn}: ${line}.`);
    const crop=view.crop(values[0]!,values[1]!);
    return crop?[{x:(crop[0]+1)/2*width-.5,y:(1-crop[1])/2*height-.5,gMag:values[2]!}]:[];
  }).sort((a,b)=>a.gMag-b.gMag);
  return removeForegroundStars(rgb,width,height,stars);
}
/** Scales red and blue in linear light so the photograph's light-weighted mean color over the disc (unclipped pixels
 * inside the support radius) matches the catalogue color of the recipe's integrated B-V. Returns the ratios and gains. */
function tieColor(rgb: Buffer, width: number, height: number, recipe: ImageLayerRecipe) {
  const tie=recipe.bake.colorTie!,disc=imageLayerDisc(recipe),view=imageLayerView(recipe),pa=rad(recipe.geometry.lineOfNodesPaDeg);
  const nodes:Vec3=[Math.sin(pa),Math.cos(pa),0],minor=norm(cross(disc.diskNormal,nodes)),support=recipe.geometry.supportRadiusKpc;
  const toLinear=Array.from({length:256},(_,v)=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  const toByte=(l:number)=>{const c=Math.max(0,Math.min(1,l)),s=c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;return Math.round(255*s);};
  const sums=[0,0,0];
  for(let py=0;py<height;py+=2)for(let px=0;px<width;px+=2){const i=3*(py*width+px);if(Math.max(rgb[i]!,rgb[i+1]!,rgb[i+2]!)>=250)continue;
    const ray=view.ray(2*(px+.5)/width-1,1-2*(py+.5)/height),local:Vec3=[dot(ray,disc.east),dot(ray,disc.north),dot(ray,disc.target)];
    const t=dot(disc.diskNormal,[0,0,disc.distanceKpc])/dot(disc.diskNormal,local),point:Vec3=[t*local[0],t*local[1],t*local[2]-disc.distanceKpc];
    if(Math.hypot(dot(point,nodes),dot(point,minor))>support)continue;
    for(let c=0;c<3;c++)sums[c]+=toLinear[rgb[i+c]!]!;}
  const targetRgb=catalogueColor(Number.NaN,tie.bv),target=targetRgb.map(v=>toLinear[v]!);
  const measured=[sums[0]!/sums[1]!,1,sums[2]!/sums[1]!],wanted=[target[0]!/target[1]!,1,target[2]!/target[1]!],gains=wanted.map((w,c)=>w/measured[c]!);
  const tables=gains.map(g=>Array.from({length:256},(_,v)=>toByte(toLinear[v]!*g)));
  for(let i=0;i<rgb.length;i++)rgb[i]=tables[i%3]![rgb[i]!]!;
  const round=(values:number[])=>values.map(v=>Number(v.toFixed(3)));
  return {bv:tie.bv,source:tie.source,targetRgb:[...targetRgb],measured:round(measured),target:round(wanted),gains:round(gains)};
}
/** The recipe's companion galaxies, from their catalogue rows, as half-light ellipses on the face image, removed in place. */
async function removeCatalogueCompanions(rgb: Buffer, width: number, height: number, recipe: ImageLayerRecipe, sourceDirectory: string): Promise<{ keys: string[]; extentHalfLight: number[] }> {
  const companions=recipe.source.companions!,path=resolve(sourceDirectory,'../../../..',companions.catalogue),lines=(await readFile(path,'utf8')).trim().split(/\r?\n/);
  // The catalogue's cells hold no quoted commas in the columns read here; a quoted cell elsewhere keeps its commas out of the split.
  const cells=(line:string)=>line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map(cell=>cell.replace(/,$/,'').replace(/^"|"$/g,''));
  const header=cells(lines[0]!),column=(name:string)=>{const index=header.indexOf(name);if(index<0)throw new TypeError(`${recipe.id}: ${companions.catalogue} has no ${JSON.stringify(name)} column (source.companions).`);return index;};
  const [key,ra,dec,rhalf,pa,ellipticity]=['key','ra','dec','rhalf','position_angle','ellipticity'].map(column) as [number,number,number,number,number,number];
  const rows=new Map(lines.slice(1).map(line=>{const row=cells(line);return [row[key]!,row] as const;})),view=imageLayerView(recipe);
  const pixel=(raDeg:number,decDeg:number)=>{const crop=view.crop(raDeg,decDeg);if(!crop)throw new TypeError(`${recipe.id}: ${raDeg}, ${decDeg} is behind the photograph.`);return [(crop[0]+1)/2*width-.5,(1-crop[1])/2*height-.5] as const;};
  const ellipses=companions.keys.map(name=>{
    const row=rows.get(name);if(!row)throw new TypeError(`${recipe.id}: ${companions.catalogue} has no row with key ${JSON.stringify(name)} (source.companions.keys).`);
    const values=[ra,dec,rhalf,pa,ellipticity].map(index=>Number(row[index]));
    if(values.some(value=>!Number.isFinite(value))||row[pa]===''||row[ellipticity]==='')throw new TypeError(`${recipe.id}: ${companions.catalogue} row ${name} needs ra, dec, rhalf, position_angle and ellipticity; got ${[ra,dec,rhalf,pa,ellipticity].map(index=>JSON.stringify(row[index])).join(', ')}.`);
    const [r,d,half,angle,e]=values as [number,number,number,number,number],[x,y]=pixel(r,d),theta=rad(angle);
    // One half-light radius along the position angle (east of north), onto the image.
    const [ex,ey]=pixel(r+half/60*Math.sin(theta)/Math.cos(rad(d)),d+half/60*Math.cos(theta)),halfLightPx=Math.hypot(ex-x,ey-y);
    return {x,y,halfLightPx,axisRatio:1-e,major:[(ex-x)/halfLightPx,(ey-y)/halfLightPx]} satisfies CompanionEllipse;
  });
  return {keys:companions.keys,...removeCompanionGalaxies(rgb,width,height,ellipses)};
}
/** The photograph as the layers show it, before it is split into layers: resized to the face size, cleaned of foreground
 * stars and companions, levelled and color-tied, as sRGB bytes. The catalogue dots read their look from it. */
export async function prepareImageLayerFace(options: { sourceDirectory: string; recipe: ImageLayerRecipe }) {
  const { recipe }=options, source=await readFile(resolve(options.sourceDirectory,recipe.source.path));
  const metadata=await sharp(source).metadata();
  if(metadata.width!==recipe.source.dimensions[0]||metadata.height!==recipe.source.dimensions[1]) throw new TypeError('Image source dimensions mismatch.');
  const resized=sharp(source).rotate().resize({width:recipe.bake.maxFacePixels,height:recipe.bake.maxFacePixels,fit:'inside',withoutEnlargement:true});
  const {data:rgb,info}=await resized.removeAlpha().toColorspace('srgb').raw().toBuffer({resolveWithObject:true});
  const foreground=recipe.source.foregroundStars?await removeCataloguedForeground(rgb,info.width,info.height,recipe,options.sourceDirectory):null;
  const companions=recipe.source.companions?await removeCatalogueCompanions(rgb,info.width,info.height,recipe,options.sourceDirectory):null;
  if(recipe.bake.levels){const {black,white,gamma}=recipe.bake.levels,table=Array.from({length:256},(_,v)=>Math.round(255*Math.max(0,Math.min(1,(v/255-black)/(white-black)))**(1/gamma)));for(let i=0;i<rgb.length;i++)rgb[i]=table[rgb[i]!]!;}
  const colorTie=recipe.bake.colorTie?tieColor(rgb,info.width,info.height,recipe):null;
  return {rgb,info,foreground,companions,colorTie};
}

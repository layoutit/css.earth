import { PREPARED_IMAGE_LAYER_BANK_SCHEMA, type PreparedImageLayerBank, type PreparedImageLayerLeaf as Quad } from '@cssearth/objects';

import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogueColor } from '@cssearth/engine';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import type { ImageLayerRecipe, LayerAxis, Vec3 } from './config.ts';
import { resizeRgbaLanczos3 } from './resize-rgba.ts';
import { imageLayerDisc, imageLayerView, norm, rad } from './disc.ts';
import { removeCompanionGalaxies, removeForegroundStars, type CompanionEllipse, type ForegroundRemoval } from './foreground.ts';
import { imageLayerBulgeModel } from './bulge.ts';
import { imageLayerShapeModel, lowerEnvelope } from './shape.ts';
import { compileVolumeLeaf } from '../volume-leaves/index.ts';

/** Over how many face pixels a wall's light may pass from one terrace to the next: a browser's layers do not line up closer. */
const TERRACE_SHARE_PIXELS=12;
const M_PER_PC = 3.0856775814913673e16, M_PER_KPC = M_PER_PC * 1000;
const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const difference3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], difference = difference3;
const add = (...v: Vec3[]): Vec3 => v.reduce<Vec3>((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
function quaternionFromBasis(x: Vec3, y: Vec3, z: Vec3): [number, number, number, number] {
  const m00=x[0],m01=y[0],m02=z[0],m10=x[1],m11=y[1],m12=z[1],m20=x[2],m21=y[2],m22=z[2], tr=m00+m11+m22;
  let q: [number,number,number,number];
  if (tr > 0) { const s=Math.sqrt(tr+1)*2; q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4]; }
  else if (m00>m11&&m00>m22) { const s=Math.sqrt(1+m00-m11-m22)*2; q=[s/4,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s]; }
  else if (m11>m22) { const s=Math.sqrt(1+m11-m00-m22)*2; q=[(m01+m10)/s,s/4,(m12+m21)/s,(m02-m20)/s]; }
  else { const s=Math.sqrt(1+m22-m00-m11)*2; q=[(m02+m20)/s,(m12+m21)/s,s/4,(m10-m01)/s]; }
  return q;
}
function compileStyle(vertices: Quad['verticesUnits'], texture: string, width: number, height: number, index: number): Quad['style'] {
  const polygon: Polygon = { vertices, uvs: [[0,0],[1,0],[1,1],[0,1]], texture,
    textureImageSource: { url: texture, width, height }, texturePresentation: { backend:'image',lighting:'source',projection:'projective' }, doubleSided:true };
  const plan=computeTextureAtlasPlanPublic(polygon,index,{tileSize:50,layerElevation:50,seamBleed:0});
  const g=plan&&resolvePolyTextureLeafGeometry(plan,{backend:'image',lighting:'source',projection:'projective'});
  if(!g) throw new TypeError(`Could not compile ${texture}.`);
  // The same projective leaf as a volume slice, drawn at TEXELS_PER_CSS_PIXEL: M31's 2735×2988 detail plane was backed at
  // 8205×8964 device pixels on a DPR 3 phone.
  return compileVolumeLeaf(g,width).style;
}
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
export async function prepareImageLayers(options: { sourceDirectory: string; outputDirectory: string; recipe: ImageLayerRecipe }): Promise<PreparedImageLayerBank> {
  // A parsec bank (`geometry.unit`) is the same bake with every length a thousand times as many units; the origin keeps the true distance.
  const unitsPerKpc=options.recipe.geometry.unit==='pc'?1000:1,{rgb,info,foreground,companions,colorTie}=await prepareImageLayerFace(options);
  const recipe:ImageLayerRecipe=unitsPerKpc===1?options.recipe:{...options.recipe,target:{...options.recipe.target,distancePc:options.recipe.target.distancePc*unitsPerKpc},
    geometry:{...options.recipe.geometry,thicknessKpc:options.recipe.geometry.thicknessKpc*unitsPerKpc,supportRadiusKpc:options.recipe.geometry.supportRadiusKpc*unitsPerKpc}};
  const base=Buffer.alloc(info.width*info.height*4), floor=recipe.bake.backgroundFloor*255;
  for(let p=0;p<info.width*info.height;p++) { const i=p*3,o=p*4,r=Math.max(0,rgb[i]-floor),g=Math.max(0,rgb[i+1]-floor),b=Math.max(0,rgb[i+2]-floor),a=Math.max(r,g,b);
    base[o]=a?Math.round(r*255/a):0;base[o+1]=a?Math.round(g*255/a):0;base[o+2]=a?Math.round(b*255/a):0;base[o+3]=Math.round(a*255/(255-floor)); }
  const pa=rad(recipe.geometry.lineOfNodesPaDeg);
  const { target, north, east, diskNormal }=imageLayerDisc(recipe);
  const origin=scale(target,options.recipe.target.distancePc*M_PER_PC), q=quaternionFromBasis(east,north,target);
  const view=imageLayerView(recipe),distanceKpc=recipe.target.distancePc/1000;
  const rayLocal=(u:number,v:number):Vec3=>{const ray=view.ray(u,v);return [dot(ray,east),dot(ray,north),dot(ray,target)];};
  const intersect=(u:number,v:number,offset:number):Vec3=>{const ray=rayLocal(u,v),t=(dot(diskNormal,[0,0,distanceKpc])+offset)/dot(diskNormal,ray);return [t*ray[0],t*ray[1],t*ray[2]-distanceKpc];};
  const thickness=recipe.geometry.thicknessKpc;
  const lineNodes:Vec3=[Math.sin(pa),Math.cos(pa),0],diskMinor=norm(cross(diskNormal,lineNodes)),support=recipe.geometry.supportRadiusKpc,taper=support*recipe.geometry.supportTaperFraction;
  for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const p=intersect(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height,0),radius=Math.hypot(dot(p,lineNodes),dot(p,diskMinor));let factor=1;
    if(radius>=support)factor=0;else if(radius>taper){const t=(support-radius)/(support-taper);factor=t*t*(3-2*t);}
    const edge=Math.min(px/Math.max(1,info.width-1),(info.width-1-px)/Math.max(1,info.width-1),py/Math.max(1,info.height-1),(info.height-1-py)/Math.max(1,info.height-1)),et=Math.min(1,edge/recipe.bake.edgeTaperFraction),edgeFactor=et*et*(3-2*et);
    base[4*(py*info.width+px)+3]=Math.round(base[4*(py*info.width+px)+3]*factor*edgeFactor);}
  // A bulge fit splits each pixel's light (as optical depth) between the disc, which keeps its share here, and the bulge.
  const bulgeModel=recipe.geometry.bulge?imageLayerBulgeModel(recipe):null,bulgeTau=bulgeModel?new Float32Array(info.width*info.height):null;
  // Where the photograph is saturated it holds no split: there the fit's own bulge and disc light stand in, scaled to the
  // photograph by the median ratio of optical depth to fitted light just below saturation.
  let saturatedPixels=0,lightScale=0;
  if(bulgeModel&&bulgeTau){const reach=recipe.geometry.bulge!.extentKpc.radius,SATURATED=.97,NEAR=.85,ratios:number[]=[],nearColor:number[][]=[[],[],[]];
    const skyAt=(px:number,py:number)=>{const ray=rayLocal(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height);return [ray[0]/ray[2]*distanceKpc,ray[1]/ray[2]*distanceKpc] as const;};
    for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const [east,north]=skyAt(px,py),a=base[4*(py*info.width+px)+3]/255;
      if(Math.hypot(east,north)<=reach&&a>=NEAR&&a<SATURATED){const l=bulgeModel.light(east,north),o=4*(py*info.width+px);ratios.push(-Math.log(1-a)/(l.bulge+l.disc));for(let c=0;c<3;c++)nearColor[c]!.push(base[o+c]!);}}
    ratios.sort((x,y)=>x-y);lightScale=ratios.length?ratios[ratios.length>>1]!:0;
    // Saturated pixels are clipped white; they take the median color of the light just below saturation.
    const coreColor=nearColor.map(values=>{values.sort((x,y)=>x-y);return values.length?values[values.length>>1]!:255;});
    for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const [east,north]=skyAt(px,py);
      if(Math.hypot(east,north)>reach)continue;
      const i=4*(py*info.width+px)+3,a=Math.min(base[i]/255,.998),tau=-Math.log(1-a);
      if(a>=SATURATED&&lightScale>0){const l=bulgeModel.light(east,north);saturatedPixels++;for(let c=0;c<3;c++)base[i-3+c]=coreColor[c]!;bulgeTau[py*info.width+px]=lightScale*l.bulge;base[i]=Math.round(255*(1-Math.exp(-lightScale*l.disc)));continue;}
      // Near the centre the photograph's display stretch compresses bright light, so its disc share keeps the bulge's
      // rounder sky shape and deprojects into a streak; there the disc takes the fit's disc light, blending back to the
      // photograph's split as the bulge's share falls to half.
      const share=bulgeModel.share(east,north),w=Math.min(1,share/.5),l=bulgeModel.light(east,north);
      // With `lightFrom: fit` the bulge's light is the fit's own, scaled to the photograph (at most all of it): a nearly
      // edge-on photograph's centre is thicker on the sky than the fitted bulge, and a share of it would spread that
      // thickness through the bulge.
      const discTau=recipe.geometry.bulge!.lightFrom==='fit'?tau-Math.min(tau,lightScale*l.bulge*bulgeModel.fade(east,north)):(1-w)*(1-share)*tau+w*Math.min(tau,lightScale*l.disc);
      bulgeTau[py*info.width+px]=tau-discTau;base[i]=Math.round(255*(1-Math.exp(-discTau)));}}
  // A nebula's published walls take the picture's light inside their outline: each pixel's light leaves the flat picture
  // for the wall in front of the star and the wall behind it, at the depths the spectra give (./shape.ts). One picture
  // cannot tell the two walls apart, so the far wall takes half the optical depth of the smooth light (the lower
  // envelope over `smoothPixels`), in its color, and the near wall the rest, with every fine detail: the dark knots show
  // against the light behind them, so they are in front. Where the light is smooth the two walls are alike. Seen from
  // the Sun, the near wall over the far wall is the photograph.
  const shapeModel=recipe.geometry.shape?imageLayerShapeModel(recipe.geometry.shape):null;
  let shapeWalls:{near:Float32Array;far:Float32Array;nearTau:Float32Array;farTau:Float32Array;nearHue:Uint8Array;farHue:Uint8Array;pixels:number}|null=null;
  if(shapeModel){const count=info.width*info.height,arcsec=distanceKpc*Math.PI/648000;
    const found={near:new Float32Array(count).fill(NaN),far:new Float32Array(count).fill(NaN),nearTau:new Float32Array(count),farTau:new Float32Array(count),nearHue:new Uint8Array(3*count),farHue:new Uint8Array(3*count),pixels:0};
    // Each channel's light (color times opacity, 0 to 1) and its smooth floor under fine dark detail.
    const lights=[0,1,2].map(c=>{const light=new Float32Array(count);for(let p=0;p<count;p++)light[p]=base[4*p+c]!/255*Math.min(base[4*p+3]!/255,.998);return light;});
    const floors=lights.map(light=>lowerEnvelope(light,info.width,info.height,recipe.geometry.shape!.smoothPixels));
    for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const p=py*info.width+px;if(!base[4*p+3])continue;
      const ray=rayLocal(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height),ends=shapeModel.walls(ray[0]/ray[2]*distanceKpc/arcsec,ray[1]/ray[2]*distanceKpc/arcsec,[floors[0]![p]!,floors[1]![p]!,floors[2]![p]!]);if(!ends)continue;
      const smooth=Math.max(floors[0]![p]!,floors[1]![p]!,floors[2]![p]!),whole=-Math.log(1-Math.min(base[4*p+3]!/255,.998)),farTau=Math.min(whole,-Math.log(1-Math.min(smooth,.998)))/2,farAlpha=1-Math.exp(-farTau);
      // The far wall's light, and the near wall's: what the photograph has left once the far wall shows through it. Where
      // that would pass full brightness the near wall keeps a little more opacity instead.
      const behind=floors.map(floor=>smooth>0?floor[p]!/smooth*farAlpha:0);let nearAlpha=1-Math.exp(-(whole-farTau)),front=[0,0,0];
      for(let pass=0;pass<2;pass++){front=lights.map((light,c)=>Math.max(0,light[p]!-(1-nearAlpha)*behind[c]!));nearAlpha=Math.min(.998,Math.max(nearAlpha,...front));}
      found.near[p]=ends.near*arcsec;found.far[p]=ends.far*arcsec;found.nearTau[p]=-Math.log(1-nearAlpha);found.farTau[p]=farTau;
      for(let c=0;c<3;c++){found.nearHue[3*p+c]=nearAlpha>0?Math.min(255,Math.round(255*front[c]!/nearAlpha)):0;found.farHue[3*p+c]=farAlpha>0?Math.min(255,Math.round(255*behind[c]!/farAlpha)):0;}
      base[4*p+3]=0;found.pixels++;}
    if(!found.pixels)throw new TypeError(`${recipe.id}: the walls (${recipe.geometry.shape!.source}) hold no light of the picture.`);
    // Under the walls the flat picture is clear; it keeps one color there, the mean of what it still shows, so the lossy
    // encoding spends nothing on it and has no dark edge to bleed into the picture around the outline.
    const kept=[0,0,0];let weight=0;for(let p=0;p<count;p++){const a=base[4*p+3]!;if(!a)continue;weight+=a;for(let c=0;c<3;c++)kept[c]!+=a*base[4*p+c]!;}
    if(weight>0)for(let p=0;p<count;p++)if(!Number.isNaN(found.near[p]!))for(let c=0;c<3;c++)base[4*p+c]=Math.round(kept[c]!/weight);
    shapeWalls=found;}
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++)if(base[4*(py*info.width+px)+3]){left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
  if(right<left)throw new TypeError('Physical support removed the complete observation.');
  left=Math.max(0,left-1);right=Math.min(info.width-1,right+1);top=Math.max(0,top-1);bottom=Math.min(info.height-1,bottom+1);
  const extractSized=(rgba:Buffer,width:number,x0:number,y0:number,x1:number,y1:number):Buffer=>{const out=Buffer.alloc((x1-x0)*(y1-y0)*4);for(let py=y0;py<y1;py++)rgba.copy(out,(py-y0)*(x1-x0)*4,4*(py*width+x0),4*(py*width+x1));return out;};
  const luminance=Buffer.alloc(info.width*info.height);for(let p=0;p<info.width*info.height;p++){const i=4*p,a=base[i+3]/255;luminance[p]=Math.round(a*(.2126*base[i]+.7152*base[i+1]+.0722*base[i+2]));}
  const blurredResult=await sharp(luminance,{raw:{width:info.width,height:info.height,channels:1}}).blur(recipe.bake.diffuseSigmaPixels).greyscale().raw().toBuffer({resolveWithObject:true});
  if(blurredResult.info.channels!==1||blurredResult.data.length!==info.width*info.height)throw new TypeError('Diffuse luminance blur must remain single-channel.');
  const blurred=blurredResult.data;
  const diffuse=Buffer.from(base),residual=Buffer.from(base);
  for(let p=0;p<info.width*info.height;p++){const i=4*p,a=base[i+3]/255,compactness=Math.min(1,(blurred[p]+2)/(luminance[p]+2)),ad=a*recipe.bake.diffuseFraction*compactness;
    diffuse[i+3]=Math.round(255*ad);residual[i+3]=Math.round(255*(a-ad)/Math.max(1-ad,1e-9));}
  await mkdir(resolve(options.outputDirectory,'layers'),{recursive:true});
  const leaves: Quad[]=[], resources: PreparedImageLayerBank['resources']=[];
  const encode=async(rgba:Buffer,width:number,height:number,path:string,exactAlpha=false)=>{ const bytes=await sharp(rgba,{raw:{width,height,channels:4}}).webp({quality:recipe.bake.encoding.quality,alphaQuality:exactAlpha?100:recipe.bake.encoding.alphaQuality??100,effort:5}).toBuffer(); await writeFile(resolve(options.outputDirectory,path),bytes); resources.push({path,bytes:bytes.length,width,height}); return bytes; };
  const cropWidth=right-left+1,cropHeight=bottom-top+1,u0=2*left/info.width-1,u1=2*(right+1)/info.width-1,v0=1-2*top/info.height,v1=1-2*(bottom+1)/info.height;
  const diffuseCrop=extractSized(diffuse,info.width,left,top,right+1,bottom+1),residualCrop=extractSized(residual,info.width,left,top,right+1,bottom+1);
  const diffuseScale=Math.min(1,recipe.bake.diffuseFacePixels/Math.max(cropWidth,cropHeight)),dw=Math.max(1,Math.round(cropWidth*diffuseScale)),dh=Math.max(1,Math.round(cropHeight*diffuseScale));
  const diffuseSmall=dw===cropWidth&&dh===cropHeight?diffuseCrop:resizeRgbaLanczos3(diffuseCrop,cropWidth,cropHeight,dw,dh);
  // A flat bank is the Milky Way's backing for another galaxy: the whole observation on one midplane image, with no
  // slabs through the disc's thickness and no side banks. Its depth comes from the catalogue dots drawn with it.
  const flat=recipe.bake.flat===true;
  for(let layer=0;!flat&&layer<recipe.geometry.depthWeights.length;layer++){const w=recipe.geometry.depthWeights[layer],rgba=Buffer.from(diffuseSmall);for(let p=0;p<dw*dh;p++){const i=4*p,a=rgba[i+3]/255;rgba[i+3]=Math.round(255*(1-(1-a)**w));}
    const offset=thickness*(layer/(recipe.geometry.depthWeights.length-1)-.5),path=`layers/z-${String(layer).padStart(2,'0')}.webp`,bytes=await encode(rgba,dw,dh,path),v:[Vec3,Vec3,Vec3,Vec3]=[intersect(u0,v0,offset),intersect(u1,v0,offset),intersect(u1,v1,offset),intersect(u0,v1,offset)];
    leaves.push({id:`z-${layer}`,axis:'z',offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:dw,heightPx:dh,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,dw,dh,leaves.length),bytes:bytes.length});}
  {const path='layers/z-detail.webp',bytes=await encode(flat?extractSized(base,info.width,left,top,right+1,bottom+1):residualCrop,cropWidth,cropHeight,path),v:[Vec3,Vec3,Vec3,Vec3]=[intersect(u0,v0,0),intersect(u1,v0,0),intersect(u1,v1,0),intersect(u0,v1,0)];leaves.push({id:'z-detail',axis:'z',offsetKpc:0,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:cropWidth,heightPx:cropHeight,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,cropWidth,cropHeight,leaves.length),bytes:bytes.length});
    // The runtime shows one stack per view axis: a flat bank gives each the same plane, so the disc draws from every side.
    if(flat)for(const axis of ['x','y'] as const)leaves.push({id:`${axis}-detail`,axis,offsetKpc:0,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:cropWidth,heightPx:cropHeight,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,cropWidth,cropHeight,leaves.length),bytes:0});}
  const weightAt=(z:number)=>{const q=(z+1)/2*(recipe.geometry.depthWeights.length-1),i=Math.min(recipe.geometry.depthWeights.length-2,Math.max(0,Math.floor(q))),t=q-i;return ((recipe.geometry.depthWeights[i]??0)*(1-t)+(recipe.geometry.depthWeights[i+1]??0)*t)*recipe.geometry.depthWeights.length;};
  const side=async(axis:'x'|'y')=>{const slices=recipe.bake.crossAxisSlices,sourceAlong=axis==='x'?info.height:info.width,along=Math.min(sourceAlong,recipe.bake.crossAxisAlongPixels),depth=recipe.bake.crossAxisDepthPixels,crossSize=axis==='x'?info.width:info.height;
    for(let s=0;s<slices;s++){const rgba=Buffer.alloc(along*depth*4);
      for(let a=0;a<along;a++){const alongSource=Math.min(sourceAlong-1,Math.floor((a+.5)/along*sourceAlong));let ad=0,ar=0,pd=[0,0,0],pr=[0,0,0];
        for(let sample=0;sample<4;sample++){const crossSource=Math.min(crossSize-1,Math.floor((s+(sample+.5)/4)/slices*crossSize)),px=axis==='x'?crossSource:alongSource,py=axis==='x'?alongSource:crossSource,si=4*(py*info.width+px),da=diffuse[si+3]/255,ra=residual[si+3]/255;ad+=da/4;ar+=ra/4;for(let c=0;c<3;c++){pd[c]+=base[si+c]/255*da/4;pr[c]+=base[si+c]/255*ra/4;}}
        for(let d=0;d<depth;d++){const zz=(d+.5)/depth*2-1,aD=1-(1-ad)**(weightAt(zz)/slices),aR=Math.abs(d-(depth-1)/2)<.5?1-(1-ar)**(1/slices):0,A=aR+aD*(1-aR),di=4*(d*along+a);for(let c=0;c<3;c++){const premul=(ar?pr[c]/Math.max(ar,1e-9)*aR:0)+(ad?pd[c]/Math.max(ad,1e-9)*aD*(1-aR):0);rgba[di+c]=A?Math.round(255*premul/A):0;}rgba[di+3]=Math.round(255*A);}}
      let aMin=along,aMax=-1;for(let d=0;d<depth;d++)for(let a=0;a<along;a++)if(rgba[4*(d*along+a)+3]){aMin=Math.min(aMin,a);aMax=Math.max(aMax,a);}
      if(aMax<aMin)continue;
      const sideWidth=aMax-aMin+1,sideRgba=Buffer.alloc(sideWidth*depth*4);for(let d=0;d<depth;d++)rgba.copy(sideRgba,d*sideWidth*4,4*(d*along+aMin),4*(d*along+aMax+1));
      const coordinate=(s+.5)/slices*2-1,path=`layers/${axis}-${String(s).padStart(2,'0')}.webp`,bytes=await encode(sideRgba,sideWidth,depth,path),lo=-thickness/2,hi=thickness/2;
      const alongA=2*aMin/along-1,alongB=2*(aMax+1)/along-1;
      const v:Quad['verticesUnits']=axis==='x'?[intersect(coordinate,-alongA,hi),intersect(coordinate,-alongB,hi),intersect(coordinate,-alongB,lo),intersect(coordinate,-alongA,lo)]:[intersect(alongA,-coordinate,hi),intersect(alongB,-coordinate,hi),intersect(alongB,-coordinate,lo),intersect(alongA,-coordinate,lo)];
      const offset=axis==='x'?(v[0][0]+v[1][0])/2:(v[0][1]+v[1][1])/2;
      leaves.push({id:`${axis}-${s}`,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:sideWidth,heightPx:depth,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,sideWidth,depth,leaves.length),bytes:bytes.length}); }};
  if(!flat){await side('x');await side('y');}
  if(bulgeModel&&bulgeTau){
    // The bulge's light, spread along each of our sight lines by the spheroid's density: slices parallel to the disc for the
    // z bank, curtains through image columns and rows for the side banks. Along every sight line from the Sun the slices
    // add up to the photograph's bulge light, so the view from the Sun is unchanged.
    let bl=info.width,bt=info.height,br=-1,bb=-1;for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++)if(bulgeTau[py*info.width+px]>1e-3){bl=Math.min(bl,px);br=Math.max(br,px);bt=Math.min(bt,py);bb=Math.max(bb,py);}
    if(br<bl)throw new TypeError(`${recipe.id}: the bulge fit (${recipe.geometry.bulge!.source}) leaves no light inside ${recipe.geometry.bulge!.extentKpc.radius} kpc.`);
    const bw=br-bl+1,bh=bb-bt+1,fscale=Math.min(1,recipe.bake.bulgeFacePixels!/Math.max(bw,bh)),sw=Math.max(2,Math.round(bw*fscale)),sh=Math.max(2,Math.round(bh*fscale));
    const bu0=2*bl/info.width-1,bu1=2*(br+1)/info.width-1,bv0=1-2*bt/info.height,bv1=1-2*(bb+1)/info.height,height=recipe.geometry.bulge!.extentKpc.height;
    // Bulge optical depth and color on a coarser grid (texel centres in crop u, v), box-averaged from the face image.
    const cell=(i:number,j:number,cols:number,rows:number)=>{const x0=bl+Math.floor(i*bw/cols),x1=Math.max(x0+1,bl+Math.floor((i+1)*bw/cols)),y0=bt+Math.floor(j*bh/rows),y1=Math.max(y0+1,bt+Math.floor((j+1)*bh/rows));
      let tau=0;const color=[0,0,0];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const t=bulgeTau[y*info.width+x],k=4*(y*info.width+x);tau+=t;for(let c=0;c<3;c++)color[c]+=t*base[k+c];}
      const n=(x1-x0)*(y1-y0);return {tau:tau/n,color:color.map(c=>tau?c/tau:0)};};
    const at=(i:number,j:number,cols:number,rows:number)=>({u:bu0+(bu1-bu0)*(i+.5)/cols,v:bv0+(bv1-bv0)*(j+.5)/rows});
    // Optical depth per unit density along the Sun's sight line through (u, v): the bulge light over the density summed
    // across the z slices, each weighted by its path length there.
    const slices=recipe.bake.bulgeSlices!,offsets=Array.from({length:slices},(_,k)=>height*((k+.5)/slices*2-1)),step=2*height/slices;
    const scaleAt=(u:number,v:number,tau:number)=>{const ray=rayLocal(u,v),path=step/Math.abs(dot(diskNormal,norm(ray)));let sum=0;for(const z of offsets)sum+=bulgeModel.density(intersect(u,v,z))*path;return sum>0?tau/sum:0;};
    const grid=Array.from({length:sw*sh},(_,k)=>{const i=k%sw,j=Math.floor(k/sw),{tau,color}=cell(i,j,sw,sh),{u,v}=at(i,j,sw,sh);return {u,v,color,scale:scaleAt(u,v,tau),path:step/Math.abs(dot(diskNormal,norm(rayLocal(u,v))))};});
    const push=async(id:string,axis:LayerAxis,rgba:Buffer,width:number,height:number,v:Quad['verticesUnits'],offset:number)=>{const path=`layers/${id}.webp`,bytes=await encode(rgba,width,height,path);
      leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:width,heightPx:height,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,width,height,leaves.length),bytes:bytes.length});};
    for(const [k,z] of offsets.entries()){const rgba=Buffer.alloc(sw*sh*4);
      for(const [t,g] of grid.entries()){const tau=g.scale*bulgeModel.density(intersect(g.u,g.v,z))*g.path,o=4*t;for(let c=0;c<3;c++)rgba[o+c]=Math.round(g.color[c]);rgba[o+3]=Math.round(255*(1-Math.exp(-tau)));}
      await push(`bulge-z-${String(k).padStart(2,'0')}`,'z',rgba,sw,sh,[intersect(bu0,bv0,z),intersect(bu1,bv0,z),intersect(bu1,bv1,z),intersect(bu0,bv1,z)],z);}
    // Side curtains: through image columns (x) or rows (y) across the bulge, each carrying the density in its own plane
    // times the curtain spacing, so looking across them adds the density along that line.
    const crossSlices=recipe.bake.bulgeCrossSlices!,depthPx=Math.max(8,Math.round(sh*2*height/Math.max(1e-9,Math.hypot(...difference3(intersect(bu0,bv0,0),intersect(bu0,bv1,0)))))),alongPx=(axis:'x'|'y')=>axis==='x'?sh:sw;
    for(const axis of ['x','y'] as const){const along=alongPx(axis);
      for(let s=0;s<crossSlices;s++){const fraction=(s+.5)/crossSlices,rgba=Buffer.alloc(along*depthPx*4);
        const place=(a:number,z:number)=>{const i=axis==='x'?Math.min(sw-1,Math.floor(fraction*sw)):a,j=axis==='x'?a:Math.min(sh-1,Math.floor(fraction*sh));return {g:grid[j*sw+i]!,u:axis==='x'?bu0+(bu1-bu0)*fraction:grid[j*sw+i]!.u,v:axis==='x'?grid[j*sw+i]!.v:bv0+(bv1-bv0)*fraction,z};};
        const first=place(0,0),spacing=Math.hypot(...difference3(intersect(axis==='x'?bu0:first.u,axis==='x'?first.v:bv0,0),intersect(axis==='x'?bu1:first.u,axis==='x'?first.v:bv1,0)))/crossSlices;
        let any=false;
        for(let a=0;a<along;a++)for(let d=0;d<depthPx;d++){const z=height-(d+.5)/depthPx*2*height,{g,u,v}=place(a,z),tau=g.scale*bulgeModel.density(intersect(u,v,z))*spacing,o=4*(d*along+a);
          for(let c=0;c<3;c++)rgba[o+c]=Math.round(g.color[c]);rgba[o+3]=Math.round(255*(1-Math.exp(-tau)));if(rgba[o+3])any=true;}
        if(!any)continue;
        const ends=[place(0,0),place(along-1,0)],v=[intersect(ends[0].u,ends[0].v,height),intersect(ends[1].u,ends[1].v,height),intersect(ends[1].u,ends[1].v,-height),intersect(ends[0].u,ends[0].v,-height)] as Quad['verticesUnits'];
        await push(`bulge-${axis}-${String(s).padStart(2,'0')}`,axis,rgba,along,depthPx,v,axis==='x'?(v[0][0]+v[1][0])/2:(v[0][1]+v[1][1])/2);}}}
  if(shapeWalls){
    // The walls as leaves. Face-on (the z bank): terraces parallel to the picture, at the picture's own resolution, each
    // holding the wall light at its depth; a pixel's light lies on the terraces around its wall, shared by distance, so
    // from the Sun the terraces add up to the walls. A browser draws each terrace as a layer of its own, on its own
    // pixel grid, so two terraces' shares must not change faster than a few pixels or the sum shows as rings: where a
    // wall is steep a pixel's light is shared among terraces over as much depth as the wall crosses in
    // `TERRACE_SHARE_PIXELS`. From the side (the x and y banks): curtains through image columns and rows, each holding
    // the walls where they cross it, one terrace thick.
    const {near,far,nearTau,farTau,nearHue,farHue}=shapeWalls,W=info.width;
    let bl=W,bt=info.height,br=-1,bb=-1,reach=0;for(let py=0;py<info.height;py++)for(let px=0;px<W;px++){const p=py*W+px;if(Number.isNaN(near[p]!))continue;bl=Math.min(bl,px);br=Math.max(br,px);bt=Math.min(bt,py);bb=Math.max(bb,py);reach=Math.max(reach,-near[p]!,far[p]!);}
    const bw=br-bl+1,bh=bb-bt+1,slices=recipe.bake.bulgeSlices!,step=2*reach/(slices-1),toward=Math.sign(intersect(0,0,1)[2]-intersect(0,0,0)[2])||1;
    const bu0=2*bl/W-1,bu1=2*(br+1)/W-1,bv0=1-2*bt/info.height,bv1=1-2*(bb+1)/info.height,name=(axis:LayerAxis,index:number)=>`shape-${axis}-${String(index).padStart(2,'0')}`;
    // The walls' leaves keep their alpha exact: two terraces share a pixel's light, and a coarser alpha shows as rings.
    const push=async(id:string,axis:LayerAxis,rgba:Buffer,width:number,height:number,v:Quad['verticesUnits'],offset:number)=>{const path=`layers/${id}.webp`,bytes=await encode(rgba,width,height,path,true);
      leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:width,heightPx:height,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:compileStyle(v,path,width,height,leaves.length),bytes:bytes.length});};
    // How far in depth each pixel's light is shared, on each wall, and the sum of its shares over the terraces.
    const spread=[near,far].map(wall=>{const half=new Float32Array(bw*bh),total=new Float32Array(bw*bh),at=(x:number,y:number,otherwise:number)=>{const value=x<0||y<0||x>=bw||y>=bh?NaN:wall[(bt+y)*W+bl+x]!;return Number.isNaN(value)?otherwise:value;};
      for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const here=at(x,y,NaN),t=y*bw+x;if(Number.isNaN(here))continue;
        half[t]=Math.max(step,Math.hypot(at(x+1,y,here)-at(x-1,y,here),at(x,y+1,here)-at(x,y-1,here))/2*TERRACE_SHARE_PIXELS);
        for(let k=0;k<slices;k++)total[t]+=Math.max(0,1-Math.abs(here-(-reach+k*step))/half[t]!);}
      return {half,total};});
    // A terrace behind the star holds only the far wall's smooth light: half the picture's resolution carries it.
    const halve=(rgba:Buffer,width:number,height:number)=>{const out=Buffer.alloc(width*height);for(let y=0;y<height/2;y++)for(let x=0;x<width/2;x++){const lit=[0,0,0],plain=[0,0,0];let opacity=0;
        for(const [i,j] of [[0,0],[1,0],[0,1],[1,1]] as const){const o=4*((2*y+j)*width+2*x+i),a=rgba[o+3]!;opacity+=a;for(let c=0;c<3;c++){lit[c]!+=rgba[o+c]!*a;plain[c]!+=rgba[o+c]!;}}
        const o=4*(y*width/2+x);for(let c=0;c<3;c++)out[o+c]=Math.round(opacity?lit[c]!/opacity:plain[c]!/4);out[o+3]=Math.round(opacity/4);}
      return out;};
    for(let k=0;k<slices;k++){const depth=-reach+k*step,rgba=Buffer.alloc(bw*bh*4);let x0=bw,y0=bh,x1=-1,y1=-1,detailed=false;
      for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const p=(bt+y)*W+bl+x,o=4*(y*bw+x);
        // Color is kept under transparent texels too, so the lossy encoding has no dark edge to bleed in.
        if(Number.isNaN(near[p]!)){for(let c=0;c<3;c++)rgba[o+c]=base[4*p+c]!;continue;}
        const t=y*bw+x,share=(side:number,at:number)=>Math.max(0,1-Math.abs(at-depth)/spread[side]!.half[t]!)/spread[side]!.total[t]!;
        const front=1-Math.exp(-nearTau[p]!*share(0,near[p]!)),back=1-Math.exp(-farTau[p]!*share(1,far[p]!)),alpha=front+(1-front)*back,stored=Math.round(255*alpha);
        for(let c=0;c<3;c++)rgba[o+c]=alpha>0?Math.min(255,Math.round((nearHue[3*p+c]!*front+(1-front)*farHue[3*p+c]!*back)/alpha)):nearHue[3*p+c]!;
        rgba[o+3]=stored;if(stored){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(front>0)detailed=true;}}
      if(x1<x0)continue;
      if(!detailed){if((x1-x0)%2===0){if(x1<bw-1)x1++;else x0--;}if((y1-y0)%2===0){if(y1<bh-1)y1++;else y0--;}}
      const u0=2*(bl+x0)/W-1,u1=2*(bl+x1+1)/W-1,v0=1-2*(bt+y0)/info.height,v1=1-2*(bt+y1+1)/info.height,offset=toward*depth,width=x1-x0+1,height=y1-y0+1,crop=extractSized(rgba,bw,x0,y0,x1+1,y1+1);
      await push(name('z',k),'z',detailed?crop:halve(crop,width,height),detailed?width:width/2,detailed?height:height/2,[intersect(u0,v0,offset),intersect(u1,v0,offset),intersect(u1,v1,offset),intersect(u0,v1,offset)],offset);}
    // The curtains' grid: the walls' optical depth, color and depth range in each cell, box-averaged from the picture.
    const fscale=Math.min(1,recipe.bake.bulgeFacePixels!/Math.max(bw,bh)),sw=Math.max(2,Math.round(bw*fscale)),sh=Math.max(2,Math.round(bh*fscale));
    const grid=Array.from({length:sw*sh},(_,t)=>{const i=t%sw,j=Math.floor(t/sw),x0=bl+Math.floor(i*bw/sw),x1=Math.max(x0+1,bl+Math.floor((i+1)*bw/sw)),y0=bt+Math.floor(j*bh/sh),y1=Math.max(y0+1,bt+Math.floor((j+1)*bh/sh));
      const sides=[{tau:0,color:[0,0,0],lo:Infinity,hi:-Infinity},{tau:0,color:[0,0,0],lo:Infinity,hi:-Infinity}];
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x;if(Number.isNaN(near[p]!))continue;
        for(const [side,tau,at,hue] of [[sides[0]!,nearTau[p]!,near[p]!,nearHue],[sides[1]!,farTau[p]!,far[p]!,farHue]] as const){if(!(tau>0))continue;side.tau+=tau;side.lo=Math.min(side.lo,at);side.hi=Math.max(side.hi,at);for(let c=0;c<3;c++)side.color[c]!+=tau*hue[3*p+c]!;}}
      const n=(x1-x0)*(y1-y0);return sides.map(side=>({tau:side.tau/n,color:side.color.map(c=>side.tau?c/side.tau:0),lo:side.lo-step/2,hi:side.hi+step/2}));});
    const crossSlices=recipe.bake.bulgeCrossSlices!,depthPx=Math.max(8,Math.round(sh*2*reach/Math.max(1e-9,Math.hypot(...difference3(intersect(bu0,bv0,0),intersect(bu0,bv1,0))))));
    for(const axis of ['x','y'] as const){const along=axis==='x'?sh:sw;
      for(let s=0;s<crossSlices;s++){const fraction=(s+.5)/crossSlices,rgba=Buffer.alloc(along*depthPx*4),u=bu0+(bu1-bu0)*fraction,v=bv0+(bv1-bv0)*fraction;
        const spacing=Math.hypot(...difference3(axis==='x'?intersect(bu0,v,0):intersect(u,bv0,0),axis==='x'?intersect(bu1,v,0):intersect(u,bv1,0)))/crossSlices;let any=false;
        // A curtain stands for the slab of the nebula around it: at each place along it, the walls of the slab's cells
        // across it, over the depths they span there, so neighbouring curtains' walls meet.
        const across=axis==='x'?sw:sh,first=Math.floor(s*across/crossSlices),last=Math.max(first+1,Math.floor((s+1)*across/crossSlices));
        for(let a=0;a<along;a++){const cell=[0,1].map(side=>{let tau=0,lo=Infinity,hi=-Infinity;const color=[0,0,0];
            for(let t=first;t<last;t++){const part=grid[axis==='x'?a*sw+t:t*sw+a]![side]!;if(!(part.tau>0))continue;tau+=part.tau;lo=Math.min(lo,part.lo);hi=Math.max(hi,part.hi);for(let c=0;c<3;c++)color[c]!+=part.tau*part.color[c]!;}
            return {tau:tau/(last-first),color:color.map(c=>tau?c/tau:0),lo,hi};});
          for(let d=0;d<depthPx;d++){const depth=toward*(reach-(d+.5)/depthPx*2*reach),o=4*(d*along+a);let tau=0;const light=[0,0,0];
            // A wall's optical depth per unit length where the curtain crosses it, times the curtain spacing.
            for(const side of cell){if(!(side.tau>0)||depth<side.lo||depth>side.hi)continue;const part=side.tau/(side.hi-side.lo)*spacing;tau+=part;for(let c=0;c<3;c++)light[c]!+=part*side.color[c]!;}
            const alpha=tau>0?Math.round(255*(1-Math.exp(-tau))):0;rgba[o+3]=alpha;if(!alpha)continue;any=true;
            for(let c=0;c<3;c++)rgba[o+c]=Math.min(255,Math.round(light[c]!/tau));}}
        if(!any)continue;
        const quad=(axis==='x'?[intersect(u,bv0,reach),intersect(u,bv1,reach),intersect(u,bv1,-reach),intersect(u,bv0,-reach)]:[intersect(bu0,v,reach),intersect(bu1,v,reach),intersect(bu1,v,-reach),intersect(bu0,v,-reach)]) as Quad['verticesUnits'];
        await push(name(axis,s),axis,rgba,along,depthPx,quad,axis==='x'?(quad[0][0]+quad[1][0])/2:(quad[0][1]+quad[1][1])/2);}}}
  const provenanceBytes=await readFile(resolve(options.sourceDirectory,recipe.provenance.path));
  const provenance=JSON.parse(provenanceBytes.toString('utf8')) as unknown;
  const allVertices=leaves.flatMap(l=>l.verticesUnits),bounds={min:[0,1,2].map(i=>Math.min(...allVertices.map(v=>v[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...allVertices.map(v=>v[i]))) as Vec3};
    const inDepth=(leaf:Quad)=>leaf.id.startsWith('bulge-')||leaf.id.startsWith('shape-');
    const bank=(axis:LayerAxis)=>{const selected=leaves.filter(l=>l.axis===axis),sampled=selected.filter(l=>!inDepth(l)),middle=sampled[Math.floor(sampled.length/2)],normal=axis==='z'?diskNormal:flat?norm(difference(middle.verticesUnits[axis==='x'?1:3],middle.verticesUnits[0])):norm(cross(difference(middle.verticesUnits[1],middle.verticesUnits[0]),difference(middle.verticesUnits[2],middle.verticesUnits[1])));let samplingStepUnits=thickness/(recipe.geometry.depthWeights.length-1);
    // A flat bank's one picture belongs to every view, so its face-on stack always wins. With a bulge each view has its own
    // bulge leaves (slices face-on, curtains from the side): their spacing decides the view, so the curtains take over side-on.
    const bulgeLeaves=selected.filter(inDepth);
    if(flat&&bulgeLeaves.length>1){const values=bulgeLeaves.map(l=>dot(l.centerUnits,normal));samplingStepUnits=(Math.max(...values)-Math.min(...values))/(bulgeLeaves.length-1);}
    else if(flat&&axis!=='z')samplingStepUnits=recipe.geometry.supportRadiusKpc*2;else if(axis!=='z'){const values=sampled.map(l=>dot(l.centerUnits,normal)),span=Math.max(...values)-Math.min(...values);samplingStepUnits=sampled.length>1?span/(sampled.length-1):recipe.geometry.supportRadiusKpc*2;}
    return {axis,normalUnits:normal,samplingStepUnits,leaves:selected};};
  const result:PreparedImageLayerBank={schema:PREPARED_IMAGE_LAYER_BANK_SCHEMA,id:recipe.id,frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5,originM:origin,localToReferenceXyzw:q,metersPerUnit:M_PER_KPC/unitsPerKpc,boundsUnits:bounds},observation:recipe.observation,
    banks:(['x','y','z'] as LayerAxis[]).map(bank),resources,provenance,approximation:{model:shapeModel?`The observed display RGB inside the published outline lies on two walls, in front of the star and behind it, at the depths the published expansion speeds give; outside the outline it lies on one plane.`:flat?`The observed display RGB lies on one plane, the ${recipe.geometry.kind}'s midplane; nothing in it has depth.`:`A low-frequency fraction of the observed display RGB is distributed through one normalized ${recipe.geometry.kind} depth profile; the compact residual remains on the physical midplane.`,canonicalRecomposition:'The source-facing diffuse slabs use optical-depth weights and composite with the residual layer to reproduce the prepared observation within resampling and encoding error.',limitations:['Depth is parametric and is not measured per pixel.','Compact residuals are image-frequency features, not classified stars or measured 3D positions.','Cross-axis banks are sampled projections of the separable display model; finite slices and bank handoffs remain visible.',foreground?`Milky Way foreground stars from ${recipe.source.foregroundStars!.source} were removed where they show (${foreground.removed} of the ${foreground.inImage} catalogued in the image; ${foreground.extended} left where the light is an extended object); fainter ones and uncatalogued stars remain.`:'Released foreground stars remain because blanket removal would also erase intrinsic galaxy stars.',...(colorTie?[`Whole-galaxy color tied to B-V ${colorTie.bv} (${colorTie.source}): red/green and blue/green in linear light measured ${colorTie.measured[0]}, ${colorTie.measured[2]}, target ${colorTie.target[0]}, ${colorTie.target[2]}; gains red ${colorTie.gains[0]}, blue ${colorTie.gains[2]}.`]:[]),...(bulgeModel?[`The bulge fit (${recipe.geometry.bulge!.source}) stands in for ${saturatedPixels} saturated pixels, scaled by ${lightScale.toPrecision(4)} optical depth per unit fitted light.`]:[]),...(shapeModel&&shapeWalls?[`The walls (${recipe.geometry.shape!.source}) are ellipsoids from published expansion speeds and a published expansion law, out to ${shapeModel.reach.toFixed(1)} arcsec along the sight line; ${shapeWalls.pixels} face pixels lie on them. One picture cannot tell the near wall from the far one: the far wall holds half the optical depth of the light smooth over ${recipe.geometry.shape!.smoothPixels} face pixels, the near wall the rest. A pixel's depth is its channels' walls weighted by its smooth light in each.`]:[]),...(companions?[`Companion galaxies ${companions.keys.join(', ')} from ${recipe.source.companions!.source} were replaced by the light around them, out to ${companions.extentHalfLight.join(', ')} half-light radii.`]:[])]}};
  await writeFile(resolve(options.outputDirectory,'image-layers.json'),JSON.stringify(result,null,2)+'\n');return result;
}

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
import { imageLayerShapeModel, lowerEnvelope, smoothed, broadLight } from './shape.ts';
import { imageLayerShapeWalls, type ShapeWalls } from './shape-walls.ts';
import { imageLayerShapePatches, packShapePatches } from './shape-patches.ts';
import { imageLayerBodyModel } from './body.ts';
import { imageLayerRingsModel, imageLayerRingsSheet } from './rings.ts';
import { imageLayerRingsCells, imageLayerRingsCurtains, imageLayerRingsGlow, imageLayerRingsSheets, RINGS_FACE_ON_STEP, type Across } from './rings-volume.ts';
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
/** The leaf compiler draws a leaf this many CSS pixels beyond its quad on every side, at LEAF_PIXELS_PER_UNIT. */
/** How fine, as a share of a cavity's size, the picture's light is read when a cavity's length is taken from it. */
const CAVITY_EDGE_SHARE=1/8;
/** Over what share of the longest path through a body, above the half where cavities start to be read, the reading sets in. */
const CAVITY_FADE_SHARE=.15;
/** Depths kept per sight line of a body: into and out of its envelope, the body, its cavity and its denser gas. */
const BODY_DEPTHS=8;
/** Shells of gas, from the star to a body's outline, whose emissivity is read from the picture. */
const BODY_SHELLS=64;
/** The innermost of those shells whose light is taken as it is; over as many again the smoothing sets in. */
const BODY_CORE_SHELLS=4;
/** Steps along a sight line within one slab of a body, when the model's light there is summed. */
const BODY_STEPS=8;
/** Rounds of matching a body's light to what the Sun sees through the nearer gas, and the most optical depth a channel may take. */
const BODY_PASSES=8,BODY_MOST_DEPTH=8;
/** The brightest channel of a body's texel, of full: under it there is room to make up a browser's rounding. */
const BODY_COLOR_PEAK=240/255;
const LEAF_OUTSET_PIXELS=0.6,LEAF_PIXELS_PER_UNIT=50;
/** A leaf's style. The compiler's outset is 12 pc on a kiloparsec bank and unseen; on a parsec bank it is 0.012 pc, 5% of
 * a picture half a parsec across, and leaves that share a picture's light no longer line up. `exact` hands the compiler
 * the quad drawn in by the outset, so the leaf is drawn on the quad itself. */
function compileStyle(quad: Quad['verticesUnits'], texture: string, width: number, height: number, index: number, exact = false): Quad['style'] {
  let vertices = quad;
  if (exact) { const inset = LEAF_OUTSET_PIXELS / LEAF_PIXELS_PER_UNIT, right = difference(quad[1], quad[0]), down = difference(quad[3], quad[0]);
    if (Math.hypot(...right) <= 2 * inset || Math.hypot(...down) <= 2 * inset) throw new RangeError(`${texture}: the leaf is ${(Math.hypot(...right) * LEAF_PIXELS_PER_UNIT).toFixed(2)} by ${(Math.hypot(...down) * LEAF_PIXELS_PER_UNIT).toFixed(2)} CSS pixels, under the compiler's outset.`);
    const u = scale(norm(right), inset), v = scale(norm(down), inset), move = (vertex: Vec3, a: number, b: number): Vec3 => [vertex[0] + a * u[0] + b * v[0], vertex[1] + a * u[1] + b * v[1], vertex[2] + a * u[2] + b * v[2]];
    vertices = [move(quad[0], 1, 1), move(quad[1], -1, 1), move(quad[2], -1, -1), move(quad[3], 1, -1)]; }
  const polygon: Polygon = { vertices, uvs: [[0,0],[1,0],[1,1],[0,1]], texture,
    textureImageSource: { url: texture, width, height }, texturePresentation: { backend:'image',lighting:'source',projection:'projective' }, doubleSided:true };
  const plan=computeTextureAtlasPlanPublic(polygon,index,{tileSize:50,layerElevation:50,seamBleed:0});
  const g=plan&&resolvePolyTextureLeafGeometry(plan,{backend:'image',lighting:'source',projection:'projective'});
  if(!g) throw new TypeError(`Could not compile ${texture}.`);
  // The same projective leaf as a volume slice, drawn at TEXELS_PER_CSS_PIXEL: M31's 2735×2988 detail plane was backed at
  // 8205×8964 device pixels on a DPR 3 phone.
  return compileVolumeLeaf(g,width).style;
}
/** A surface patch's style: its texels, cut from their atlas, on its quad. The leaf compiler cannot draw a leaf under its own
 * outset (see compileStyle), and a patch of a parsec bank is a fraction of a CSS pixel across before the camera enlarges
 * it, so the matrix is written here, in the compiler's own scene: CSS x along the bank's y, CSS y along its x, CSS z
 * along its z, LEAF_PIXELS_PER_UNIT to the unit. */
function patchStyle(quad: Quad['verticesUnits'], width: number, height: number, atlas: { width: number; height: number }, at: { x: number; y: number }): Quad['style'] {
  const css = (point: Vec3): Vec3 => [point[1] * LEAF_PIXELS_PER_UNIT, point[0] * LEAF_PIXELS_PER_UNIT, point[2] * LEAF_PIXELS_PER_UNIT];
  const corner = css(quad[0]), across = scale(difference(css(quad[1]), corner), 1 / width), down = scale(difference(css(quad[3]), corner), 1 / height), out = norm(cross(down, across));
  const matrix = [...across, 0, ...down, 0, ...out, 0, ...corner, 1].map(value => value.toFixed(12)).join(',');
  // One CSS pixel a texel here; the shared rule then draws the box at its texel density, as every volume leaf.
  return compileVolumeLeaf({ matrix, leafWidth: width, leafHeight: height, backgroundSize: [atlas.width, atlas.height], backgroundPosition: [-at.x, -at.y] }, atlas.width).style;
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
  // A parsec bank's leaves are drawn on their quads exactly (see compileStyle).
  const styleOf=(vertices:Quad['verticesUnits'],texture:string,width:number,height:number,index:number)=>compileStyle(vertices,texture,width,height,index,unitsPerKpc!==1);
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
  // A nebula's published walls take the picture's light inside their outline (./shape-walls.ts): each pixel's light
  // leaves the flat picture for the walls, at the depths the spectra give (./shape.ts). Where the recipe has measured
  // speeds they say which wall a feature is on.
  const shapeSpeeds=recipe.geometry.shape?.speeds,measuredSpeeds=shapeSpeeds?(await readFile(resolve(options.sourceDirectory,shapeSpeeds.path),'utf8')).split(/\r?\n/).filter(line=>line.trim()).map(line=>{const cells=line.trim().split(/\s+/).map(Number),row=[cells[shapeSpeeds.columns.east],cells[shapeSpeeds.columns.north],cells[shapeSpeeds.columns.kmS]] as [number,number,number];
    if(!row.every(Number.isFinite))throw new TypeError(`${recipe.id}: ${shapeSpeeds.path} has a row without its east, north and speed columns (geometry.shape.speeds.columns): ${JSON.stringify(line)}.`);return row;}):[];
  const shapeModel=recipe.geometry.shape?imageLayerShapeModel(recipe.geometry.shape,measuredSpeeds):null;
  // Surfaces at measured depths are drawn as a mesh (./shape-patches.ts); a shell's walls as slices.
  const meshed=recipe.geometry.shape?.speeds?.depth==='speed';
  let shapeWalls:ShapeWalls|null=null;
  if(shapeModel){const count=info.width*info.height,arcsec=distanceKpc*Math.PI/648000;
    // Each channel's light (color times opacity, 0 to 1) and its smooth floor under fine dark detail.
    const lights=[0,1,2].map(c=>{const light=new Float32Array(count);for(let p=0;p<count;p++)light[p]=base[4*p+c]!/255*Math.min(base[4*p+3]!/255,.998);return light;});
    // The smooth light: the lower envelope of the picture's, so the walls' halves never take fine bright detail. Where
    // a measured speed is its own depth (speeds.depth "speed") it is the picture blurred instead: only what stands
    // above the blur is fine enough to lie at a depth measured over arcseconds.
    const floors=lights.map(light=>recipe.geometry.shape!.speeds?.depth==='speed'?smoothed(light,info.width,info.height,recipe.geometry.shape!.smoothPixels):lowerEnvelope(light,info.width,info.height,recipe.geometry.shape!.smoothPixels));
    const found=imageLayerShapeWalls(base,info.width,info.height,lights,floors,shapeModel,(px,py)=>{const ray=rayLocal(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height);return [ray[0]/ray[2]*distanceKpc/arcsec,ray[1]/ray[2]*distanceKpc/arcsec];},arcsec,recipe.geometry.shape!.speeds?.depth==='speed'?floors.map(floor=>broadLight(floor,info.width,info.height,recipe.geometry.shape!.smoothPixels)):undefined);
    if(!found.pixels)throw new TypeError(`${recipe.id}: the walls (${recipe.geometry.shape!.source}) hold no light of the picture.`);
    // Under the walls the flat picture is clear; it keeps one color there, the mean of what it still shows, so the lossy
    // encoding spends nothing on it and has no dark edge to bleed into the picture around the outline.
    const kept=[0,0,0];let weight=0;for(let p=0;p<count;p++){const a=base[4*p+3]!;if(!a)continue;weight+=a;for(let c=0;c<3;c++)kept[c]!+=a*base[4*p+c]!;}
    if(weight>0)for(let p=0;p<count;p++)if(!base[4*p+3]&&found.layers.some(layer=>!Number.isNaN(layer.depth[p]!)))for(let c=0;c<3;c++)base[4*p+c]=Math.round(kept[c]!/weight);
    shapeWalls=found;}
  // A nebula's published filled body takes the picture's light inside its outline (./body.ts). The gas is taken to be
  // the same all around the star at one distance from it, so how much each display channel emits at each distance comes
  // from the picture itself: the middle of its light around the star at each radius, taken apart shell by shell from
  // the outside in. Each pixel's light is then spread along its sight line by that emissivity, less inside a cavity.
  // Where a cavity lies along a sight line comes from the model. How long it is comes from the picture: how far the
  // light there falls short of the middle at its radius (the dips around the star at one radius, as the paper measures
  // the cavities), read through the cavity's own emission. Light above that middle is denser gas about the equatorial
  // plane. Near the body's outline, where the path through it is short, neither is read.
  const bodyModel=recipe.geometry.body?imageLayerBodyModel(recipe.geometry.body):null;
  type Along=(channel:number,radius:number,lo:number,hi:number,from:number,to:number,steps:number)=>number;
  let bodyFill:{spans:Float32Array;tau:Float32Array;dense:Float32Array;hue:Uint8Array;radius:Float32Array;emit:(channel:number,radius:number)=>number;along:Along;pixels:number;carved:number;hollow:number}|null=null;
  if(bodyModel){const body=recipe.geometry.body!,count=info.width*info.height,arcsec=distanceKpc*Math.PI/648000,hollow=body.cavities?1-body.cavities.emission:0,shell=bodyModel.reach*arcsec/BODY_SHELLS,N=BODY_DEPTHS;
    // Per sight line, in units: its distance from the star on the sky, and along z where it enters and leaves the
    // outline, the body, its cavity and its denser gas. `dense` is the share of its light in that denser gas.
    const spans=new Float32Array(N*count).fill(NaN),tau=new Float32Array(count),dense=new Float32Array(count),hue=new Uint8Array(3*count),radius=new Float32Array(count);
    const centre=new Float32Array(count),equator=new Float32Array(count),inside=new Float32Array(count),rings=Array.from({length:4},()=>Array.from({length:BODY_SHELLS},():number[]=>[]));let longest=0,pixels=0,carved=0;
    for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++){const p=py*info.width+px,o=N*p;if(!base[4*p+3])continue;
      const ray=rayLocal(2*(px+.5)/info.width-1,1-2*(py+.5)/info.height),east=ray[0]/ray[2]*distanceKpc/arcsec,north=ray[1]/ray[2]*distanceKpc/arcsec,line=bodyModel.along(east,north);if(!line)continue;
      const outer=line.envelope??line.body!,inner=line.body,ring=Math.min(BODY_SHELLS-1,Math.floor(Math.hypot(east,north)*arcsec/shell));
      spans[o]=outer[0]*arcsec;spans[o+1]=outer[1]*arcsec;centre[p]=line.cavityAt*arcsec;equator[p]=line.equatorAt*arcsec;radius[p]=Math.hypot(east,north)*arcsec;tau[p]=-Math.log(1-Math.min(base[4*p+3]!/255,.998));inside[p]=1;pixels++;
      for(let c=0;c<3;c++){hue[3*p+c]=base[4*p+c]!;rings[c]![ring]!.push(tau[p]!*base[4*p+c]!/255);}rings[3]![ring]!.push(tau[p]!);
      if(inner){spans[o+2]=inner[0]*arcsec;spans[o+3]=inner[1]*arcsec;longest=Math.max(longest,inner[1]-inner[0]);}}
    if(!pixels)throw new TypeError(`${recipe.id}: the body (${body.source}) holds no light of the picture.`);
    // Each channel's light by radius (red, green, blue, then the whole opacity), and the emissivity of each shell of gas
    // that adds up to it: the outermost shell is seen alone at the outline, and each shell inward through those outside
    // it. The light is smoothed before it is taken apart, never the gas after: shells that no longer add up to the light
    // put too much of a sight line's light in one place and leave a dark line along the rest of it. For the same reason
    // the innermost shells, where the light changes within a shell's width around the star, are not smoothed.
    const soft=(values:Float32Array)=>values.map((_,k)=>(values[Math.max(0,k-1)]!+2*values[k]!+values[Math.min(values.length-1,k+1)]!)/4);
    const through=(ray:number,of:number)=>2*(Math.sqrt(((of+1)*shell)**2-((ray+.5)*shell)**2)-Math.sqrt(Math.max(0,(of*shell)**2-((ray+.5)*shell)**2)));
    const levels=rings.map(ring=>{const raw=Float32Array.from(ring,values=>values.length?values.sort((a,b)=>a-b)[values.length>>1]!:0),even=soft(soft(soft(soft(raw))));return raw.map((value,k)=>{const t=Math.max(0,Math.min(1,(k-BODY_CORE_SHELLS)/BODY_CORE_SHELLS));return value+(even[k]!-value)*t;});});
    const emissivity=levels.map(level=>{const gas=new Float32Array(BODY_SHELLS);for(let ray=BODY_SHELLS-1;ray>=0;ray--){let rest=0;for(let of=ray+1;of<BODY_SHELLS;of++)rest+=gas[of]!*through(ray,of);gas[ray]=Math.max(0,(level[ray]!-rest)/through(ray,ray));}return gas;});
    const emit=(channel:number,r:number)=>{const at=r/shell-.5,k=Math.floor(at),gas=emissivity[channel]!;return k<0?gas[0]!:k>=BODY_SHELLS-1?(at<BODY_SHELLS-.5?gas[BODY_SHELLS-1]!:0):gas[k]!+(gas[k+1]!-gas[k]!)*(at-k);};
    // A channel's light along a sight line that passes the star at `r`, from `lo` to `hi`, less inside a cavity from `from` to `to`.
    const along:Along=(channel,r,lo,hi,from,to,steps)=>{let sum=0;const dz=(hi-lo)/steps;for(let i=0;i<steps;i++){const z=lo+(i+.5)*dz;sum+=emit(channel,Math.hypot(r,z))*(z>=from&&z<to?1-hollow:1);}return sum*dz;};
    if(body.cavities){const size=body.cavities.sizeArcsec/(recipe.observation.fieldOfViewDeg[0]*3600/info.width),fine=Math.max(1,Math.round(size*CAVITY_EDGE_SHARE)),thick=body.cavities.sizeArcsec*arcsec;
      // The picture's grain is not a cavity: its light is read no finer than a share of a cavity's size, and compared
      // with the middle of the same smoothed light at its radius.
      const light=smoothed(tau,info.width,info.height,fine),cover=smoothed(inside,info.width,info.height,fine),around=Array.from({length:BODY_SHELLS},():number[]=>[]);
      for(let p=0;p<count;p++)if(inside[p])around[Math.min(BODY_SHELLS-1,Math.floor(radius[p]!/shell))]!.push(light[p]!/cover[p]!);
      const middle=soft(Float32Array.from(around,values=>values.length?values.sort((a,b)=>a-b)[values.length>>1]!:0));
      for(let p=0;p<count;p++){const o=N*p,near=spans[o+2]!,far=spans[o+3]!;if(!inside[p]||!(far-near>=longest*arcsec/2))continue;
        const where=Math.max(0,Math.min(BODY_SHELLS-1,radius[p]!/shell-.5)),below=Math.min(BODY_SHELLS-2,Math.floor(where)),level=middle[below]!+(middle[below+1]!-middle[below]!)*(where-below);
        if(!(level>0))continue;
        // Toward the edge of where it is read, the reading fades out, so no edge of its own shows there.
        const edge=Math.max(0,Math.min(1,((far-near)/(longest*arcsec)-.5)/CAVITY_FADE_SHARE)),fade=edge*edge*(3-2*edge),ratio=1+(light[p]!/cover[p]!/level-1)*fade;
        if(!(ratio>0))continue;
        if(ratio>1){const half=Math.min(thick,far-near)/2,at=Math.max(near+half,Math.min(far-half,equator[p]!));dense[p]=1-1/ratio;spans[o+6]=at-half;spans[o+7]=at+half;continue;}
        // The cavity is as long as takes that much of the sight line's light away, about its place on the pole's line.
        const wanted=(1-ratio)*along(3,radius[p]!,spans[o]!,spans[o+1]!,NaN,NaN,24)/hollow,place=(length:number):[number,number]=>{const at=Math.max(near+length/2,Math.min(far-length/2,centre[p]!));return [at-length/2,at+length/2];};
        const taken=(length:number)=>{const [from,to]=place(length);return along(3,radius[p]!,from,to,NaN,NaN,12);};
        let low=0,high=far-near;if(taken(high)>wanted)for(let i=0;i<14;i++){const mid=(low+high)/2;if(taken(mid)<wanted)low=mid;else high=mid;}
        if(!(high>0))continue;[spans[o+4],spans[o+5]]=place(high);carved++;}}
    // Under the body the flat picture is clear; it keeps one color there, the mean of what it still shows.
    const kept=[0,0,0];let weight=0;for(let p=0;p<count;p++){if(!Number.isNaN(spans[N*p]!))base[4*p+3]=0;const a=base[4*p+3]!;if(!a)continue;weight+=a;for(let c=0;c<3;c++)kept[c]!+=a*base[4*p+c]!;}
    if(weight>0)for(let p=0;p<count;p++)if(!Number.isNaN(spans[N*p]!))for(let c=0;c<3;c++)base[4*p+c]=Math.round(kept[c]!/weight);
    bodyFill={spans,tau,dense,hue,radius,emit,along,pixels,carved,hollow};}
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
    leaves.push({id:`z-${layer}`,axis:'z',offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:dw,heightPx:dh,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,dw,dh,leaves.length),bytes:bytes.length});}
  const ringsModel=recipe.geometry.rings?imageLayerRingsModel(recipe.geometry.rings):null;let ringsSteps:[number,number]|null=null;
  if(ringsModel){
    // A nebula's published rings (./rings.ts): the picture lies on two tilted planes through the star, each sight line's
    // light shared between them. One leaf a plane, the same from every side; from the Sun they add up to the picture.
    const arcsec=distanceKpc*Math.PI/648000,W=info.width,H=info.height,sky=(px:number,py:number)=>{const ray=rayLocal(2*(px+.5)/W-1,1-2*(py+.5)/H);return [ray[0]/ray[2]*distanceKpc/arcsec,ray[1]/ray[2]*distanceKpc/arcsec] as const;};
    // The sky is flat across the picture: a pixel's offset from the star, east and north, from three of its pixels.
    const origin=sky(0,0),beside=sky(1,0),below=sky(0,1),east:Across=[origin[0],beside[0]-origin[0],below[0]-origin[0]],north:Across=[origin[1],beside[1]-origin[1],below[1]-origin[1]];
    const hit=(u:number,v:number,normal:Vec3):Vec3=>{const ray=rayLocal(u,v),t=normal[2]*distanceKpc/dot(normal,ray);return [t*ray[0],t*ray[1],t*ray[2]-distanceKpc];};
    const leaf=(id:string,axis:LayerAxis,path:string,w:number,h:number,v:Quad['verticesUnits'],offset:number,bytes:number)=>leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:w,heightPx:h,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,w,h,leaves.length),bytes});
    let sheets:Buffer[];
    if(ringsModel.thickness>0){
      // Rings with depth (./rings-volume.ts): the smooth part of each ring's light is a glow about its plane. Face-on it
      // is drawn as layers parallel to the plane, in front of it and behind; from the sides as curtains across the
      // picture, each a strip through the glow's depth along the plane. The sheets keep the rest, every detail with it,
      // on the rings' planes. From the Sun the glow and the sheets are the photograph.
      const thickness=ringsModel.thickness,cells=imageLayerRingsCells(base,W,H,east,north,ringsModel,recipe.bake.bulgeFacePixels!),glow=imageLayerRingsGlow(cells,recipe.bake.bulgeSlices!,thickness),crossSlices=recipe.bake.bulgeCrossSlices!;
      const gu0=2*cells.left/W-1,gu1=2*(cells.left+cells.cols*cells.cell)/W-1,gv0=1-2*cells.top/H,gv1=1-2*(cells.top+cells.rows*cells.cell)/H,drawn:Buffer[][]=[],two=(n:number)=>String(n).padStart(2,'0');
      // A place on a sight line at a depth from the star, and on a ring's plane moved along the sight line.
      const placed=(u:number,v:number,depth:number):Vec3=>{const ray=rayLocal(u,v),t=(distanceKpc+depth)/ray[2];return [t*ray[0],t*ray[1],depth];};
      const moved=(u:number,v:number,normal:Vec3,offset:number):Vec3=>{const ray=rayLocal(u,v),t=normal[2]*(distanceKpc+offset)/dot(normal,ray);return [t*ray[0],t*ray[1],t*ray[2]-distanceKpc];};
      ringsSteps=[Math.hypot(...difference3(intersect(gu0,0,0),intersect(gu1,0,0)))/crossSlices,Math.hypot(...difference3(intersect(0,gv0,0),intersect(0,gv1,0)))/crossSlices];
      for(const [index,plane] of ringsModel.planes.entries()){const images:Buffer[]=[],sizes:number[]=[];
        for(const [m,image] of glow[index]!.images.entries()){const bytes=await encode(image,cells.cols,cells.rows,`layers/glow-${plane.id}-${two(m)}.webp`,true);images.push(await sharp(bytes).ensureAlpha().raw().toBuffer());sizes.push(bytes.length);}
        drawn.push(images);
        // The same picture on the plane wherever it is moved to, so from the Sun every drawing lies on the sheet.
        for(const [j,layer] of glow[index]!.layers.entries()){const offset=layer.offset*arcsec,first=glow[index]!.layers.findIndex(other=>other.image===layer.image)===j;
          leaf(`shape-z-${plane.id}-${two(j)}`,'z',`layers/glow-${plane.id}-${two(layer.image)}.webp`,cells.cols,cells.rows,[moved(gu0,gv0,plane.normal,offset),moved(gu1,gv0,plane.normal,offset),moved(gu1,gv1,plane.normal,offset),moved(gu0,gv1,plane.normal,offset)],offset,first?sizes[layer.image]!:0);}}
      sheets=imageLayerRingsSheets(base,W,H,east,north,ringsModel,cells,glow,drawn);
      for(const axis of ['x','y'] as const)for(const [index,plane] of ringsModel.planes.entries()){const curtains=imageLayerRingsCurtains(cells,index,axis,crossSlices,cells.cell*Math.hypot(east[1],north[1]),thickness);if(!curtains)continue;
        const along=axis==='x'?cells.rows:cells.cols,from=curtains.first/along,to=(curtains.first+curtains.length)/along,reach=thickness*arcsec,depth=(u:number,v:number)=>moved(u,v,plane.normal,0)[2];
        for(const [s,image] of curtains.images.entries()){if(!image)continue;
          const fraction=(s+.5)/crossSlices,path=`layers/shape-${axis}-${plane.id}-${two(s)}.webp`,bytes=await encode(image,curtains.length,curtains.depthPixels,path,true);
          const a:[number,number]=axis==='x'?[gu0+(gu1-gu0)*fraction,gv0+(gv1-gv0)*from]:[gu0+(gu1-gu0)*from,gv0+(gv1-gv0)*fraction],b:[number,number]=axis==='x'?[a[0],gv0+(gv1-gv0)*to]:[gu0+(gu1-gu0)*to,a[1]];
          const quad:Quad['verticesUnits']=[placed(...a,depth(...a)-reach),placed(...b,depth(...b)-reach),placed(...b,depth(...b)+reach),placed(...a,depth(...a)+reach)];
          leaf(`shape-${axis}-${plane.id}-${two(s)}`,axis,path,curtains.length,curtains.depthPixels,quad,axis==='x'?(quad[0][0]+quad[1][0])/2:(quad[0][1]+quad[1][1])/2,bytes.length);}}
    }else{
      // Sheets alone: optical depths add, so the planes' shares of a pixel's light multiply back to its own opacity.
      const sheet=imageLayerRingsSheet(base,W,H);
      sheets=ringsModel.planes.map(plane=>{const rgba=Buffer.from(sheet);for(let py=0;py<H;py++)for(let px=0;px<W;px++){const i=4*(py*W+px)+3,a=sheet[i]!;if(!a)continue;const share=plane.share(east[0]+east[1]*px+east[2]*py,north[0]+north[1]*px+north[2]*py);rgba[i]=share>0?Math.round(255*(1-(1-Math.min(a/255,.998))**share)):0;}return rgba;});}
    for(const [index,plane] of ringsModel.planes.entries()){const rgba=sheets[index]!;let l=W,t=H,r=-1,b=-1;
      for(let py=0;py<H;py++)for(let px=0;px<W;px++)if(rgba[4*(py*W+px)+3]){l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);}
      if(r<l)continue;
      const w=r-l+1,h=b-t+1,pu0=2*l/W-1,pu1=2*(r+1)/W-1,pv0=1-2*t/H,pv1=1-2*(b+1)/H,path=`layers/plane-${plane.id}.webp`,bytes=await encode(extractSized(rgba,W,l,t,r+1,b+1),w,h,path);
      const v:[Vec3,Vec3,Vec3,Vec3]=[hit(pu0,pv0,plane.normal),hit(pu1,pv0,plane.normal),hit(pu1,pv1,plane.normal),hit(pu0,pv1,plane.normal)];
      for(const axis of ['z','x','y'] as const)leaf(`${axis}-${plane.id}`,axis,path,w,h,v,0,axis==='z'?bytes.length:0);}
  }else
  {const path='layers/z-detail.webp',bytes=await encode(flat?extractSized(base,info.width,left,top,right+1,bottom+1):residualCrop,cropWidth,cropHeight,path),v:[Vec3,Vec3,Vec3,Vec3]=[intersect(u0,v0,0),intersect(u1,v0,0),intersect(u1,v1,0),intersect(u0,v1,0)];leaves.push({id:'z-detail',axis:'z',offsetKpc:0,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:cropWidth,heightPx:cropHeight,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,cropWidth,cropHeight,leaves.length),bytes:bytes.length});
    // The runtime shows one stack per view axis: a flat bank gives each the same plane, so the disc draws from every side.
    if(flat&&!meshed)for(const axis of ['x','y'] as const)leaves.push({id:`${axis}-detail`,axis,offsetKpc:0,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:cropWidth,heightPx:cropHeight,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,cropWidth,cropHeight,leaves.length),bytes:0});}
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
      leaves.push({id:`${axis}-${s}`,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:sideWidth,heightPx:depth,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,sideWidth,depth,leaves.length),bytes:bytes.length}); }};
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
      leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:width,heightPx:height,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,width,height,leaves.length),bytes:bytes.length});};
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
  let shapeScenes:number[]|null=null;
  if(shapeWalls&&meshed){
    // Surfaces at measured depths as leaves (./shape-patches.ts): each is a mesh of flat patches, the same from every
    // side, so the bank has one stack. A patch is a rectangle of the picture on a plane through the surface there: its
    // corners lie on their own sight lines, at the plane's depth, so from the Sun the patches add up to the photograph.
    const W=info.width,H=info.height,facePixel=Math.hypot(...difference3(intersect(-1,0,0),intersect(1,0,0)))/W,toward=Math.sign(intersect(0,0,1)[2]-intersect(0,0,0)[2])||1;
    const fit=recipe.geometry.shape!.speeds!.reachArcsec*distanceKpc*Math.PI/648000,{patches,scenes}=imageLayerShapePatches(shapeWalls,W,H,facePixel,fit),{atlases,places}=packShapePatches(patches),files:{path:string;bytes:number}[]=[];
    for(const [index,atlas] of atlases.entries()){const path=`layers/shape-${index}.webp`;files.push({path,bytes:(await encode(atlas.rgba,atlas.width,atlas.height,path,true)).length});}
    for(const [index,patch] of patches.entries()){const place=places[index]!,atlas=atlases[place.atlas]!,file=files[place.atlas]!;
      const corner=(x:number,y:number)=>intersect(2*x/W-1,1-2*y/H,toward*(patch.depth+patch.right*(x-patch.left)+patch.down*(y-patch.top)));
      const x1=patch.left+patch.width,y1=patch.top+patch.height,v:Quad['verticesUnits']=[corner(patch.left,patch.top),corner(x1,patch.top),corner(x1,y1),corner(patch.left,y1)],center=scale(add(...v),.25);
      const [columns,rows]=patch.texture,u0=place.x/atlas.width,u1=(place.x+columns)/atlas.width,v0=place.y/atlas.height,v1=(place.y+rows)/atlas.height;
      leaves.push({id:`shape-${String(index).padStart(4,'0')}`,axis:'z',offsetKpc:dot(center,diskNormal),centerUnits:center,doubleSided:true,texturePath:file.path,widthPx:columns,heightPx:rows,verticesUnits:v,uvs:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],
        style:patchStyle(v,columns,rows,atlas,place),bytes:Math.round(file.bytes*columns*rows/(atlas.width*atlas.height))});}
    // The flat picture is a scene of its own, drawn first.
    shapeScenes=[leaves.filter(leaf=>leaf.axis==='z').length-patches.length,...scenes];}
  else if(shapeWalls){
    // The walls as leaves. Face-on (the z bank): terraces parallel to the picture, at the picture's own resolution, each
    // holding the wall light at its depth; a pixel's light lies on the terraces around its wall, shared by distance, so
    // from the Sun the terraces add up to the walls. A browser draws each terrace as a layer of its own, on its own
    // pixel grid, so two terraces' shares must not change faster than a few pixels or the sum shows as rings: where a
    // wall is steep a pixel's light is shared among terraces over as much depth as the wall crosses in
    // `TERRACE_SHARE_PIXELS`. From the side (the x and y banks): curtains through image columns and rows, each holding
    // the walls where they cross it, one terrace thick.
    const {layers,sharp}=shapeWalls,W=info.width,near=layers[0]!.depth,far=layers[layers.length-1]!.depth;
    let bl=W,bt=info.height,br=-1,bb=-1,reach=0;for(let py=0;py<info.height;py++)for(let px=0;px<W;px++){const p=py*W+px;if(Number.isNaN(near[p]!))continue;bl=Math.min(bl,px);br=Math.max(br,px);bt=Math.min(bt,py);bb=Math.max(bb,py);reach=Math.max(reach,-near[p]!,far[p]!);}
    const bw=br-bl+1,bh=bb-bt+1,slices=recipe.bake.bulgeSlices!,step=2*reach/(slices-1),toward=Math.sign(intersect(0,0,1)[2]-intersect(0,0,0)[2])||1;
    const bu0=2*bl/W-1,bu1=2*(br+1)/W-1,bv0=1-2*bt/info.height,bv1=1-2*(bb+1)/info.height,name=(axis:LayerAxis,index:number)=>`shape-${axis}-${String(index).padStart(2,'0')}`;
    // The walls' leaves keep their alpha exact: two terraces share a pixel's light, and a coarser alpha shows as rings.
    const push=async(id:string,axis:LayerAxis,rgba:Buffer,width:number,height:number,v:Quad['verticesUnits'],offset:number)=>{const path=`layers/${id}.webp`,bytes=await encode(rgba,width,height,path,true);
      leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:width,heightPx:height,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,width,height,leaves.length),bytes:bytes.length});};
    // How far in depth each pixel's light is shared, on each wall, and the sum of its shares over the terraces.
    const spread=layers.map(layer=>layer.depth).map(wall=>{const half=new Float32Array(bw*bh),total=new Float32Array(bw*bh),at=(x:number,y:number,otherwise:number)=>{const value=x<0||y<0||x>=bw||y>=bh?NaN:wall[(bt+y)*W+bl+x]!;return Number.isNaN(value)?otherwise:value;};
      for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const here=at(x,y,NaN),t=y*bw+x;if(Number.isNaN(here))continue;
        half[t]=Math.max(step,Math.hypot(at(x+1,y,here)-at(x-1,y,here),at(x,y+1,here)-at(x,y-1,here))/2*TERRACE_SHARE_PIXELS);
        for(let k=0;k<slices;k++)total[t]+=Math.max(0,1-Math.abs(here-(-reach+k*step))/half[t]!);}
      return {half,total};});
    const least=Math.ceil(4/LEAF_PIXELS_PER_UNIT/(Math.hypot(...difference3(intersect(bu0,bv0,0),intersect(bu1,bv0,0)))/bw));
    // A terrace that holds only the far wall's smooth light is carried at half the picture's resolution.
    const halve=(rgba:Buffer,width:number,height:number)=>{const out=Buffer.alloc(width*height);for(let y=0;y<height/2;y++)for(let x=0;x<width/2;x++){const lit=[0,0,0],plain=[0,0,0];let opacity=0;
        for(const [i,j] of [[0,0],[1,0],[0,1],[1,1]] as const){const o=4*((2*y+j)*width+2*x+i),a=rgba[o+3]!;opacity+=a;for(let c=0;c<3;c++){lit[c]!+=rgba[o+c]!*a;plain[c]!+=rgba[o+c]!;}}
        const o=4*(y*width/2+x);for(let c=0;c<3;c++)out[o+c]=Math.round(opacity?lit[c]!/opacity:plain[c]!/4);out[o+3]=Math.round(opacity/4);}
      return out;};
    for(let k=0;k<slices;k++){const depth=-reach+k*step,rgba=Buffer.alloc(bw*bh*4);let x0=bw,y0=bh,x1=-1,y1=-1,detailed=false;
      for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const p=(bt+y)*W+bl+x,o=4*(y*bw+x);
        // Color is kept under transparent texels too, so the lossy encoding has no dark edge to bleed in.
        if(Number.isNaN(near[p]!)){for(let c=0;c<3;c++)rgba[o+c]=base[4*p+c]!;continue;}
        const t=y*bw+x,share=(side:number,at:number)=>Math.max(0,1-Math.abs(at-depth)/spread[side]!.half[t]!)/spread[side]!.total[t]!;
        // The surfaces' light at this depth, nearest first, each seen through the ones in front of it.
        let alpha=0,fine=false;const lit=[0,0,0];
        for(const [k,layer] of layers.entries()){const part=1-Math.exp(-layer.tau[p]!*share(k,layer.depth[p]!)),clear=1-alpha;for(let c=0;c<3;c++)lit[c]=lit[c]!+clear*layer.hue[3*p+c]!*part;alpha=alpha+clear*part;if(part>0&&sharp[p]!&(1<<k))fine=true;}
        const stored=Math.round(255*alpha);
        for(let c=0;c<3;c++)rgba[o+c]=alpha>0?Math.min(255,Math.round(lit[c]!/alpha)):layers[0]!.hue[3*p+c]!;
        rgba[o+3]=stored;if(stored){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(fine)detailed=true;}}
      if(x1<x0)continue;
      // A terrace is a few CSS pixels across at least, with clear texels around its light: the leaf compiler cannot draw less.
      while(x1-x0+1<least&&(x0>0||x1<bw-1)){if(x0>0)x0--;if(x1<bw-1&&x1-x0+1<least)x1++;}
      while(y1-y0+1<least&&(y0>0||y1<bh-1)){if(y0>0)y0--;if(y1<bh-1&&y1-y0+1<least)y1++;}
      if(!detailed){if((x1-x0)%2===0){if(x1<bw-1)x1++;else x0--;}if((y1-y0)%2===0){if(y1<bh-1)y1++;else y0--;}}
      const u0=2*(bl+x0)/W-1,u1=2*(bl+x1+1)/W-1,v0=1-2*(bt+y0)/info.height,v1=1-2*(bt+y1+1)/info.height,offset=toward*depth,width=x1-x0+1,height=y1-y0+1,crop=extractSized(rgba,bw,x0,y0,x1+1,y1+1);
      await push(name('z',k),'z',detailed?crop:halve(crop,width,height),detailed?width:width/2,detailed?height:height/2,[intersect(u0,v0,offset),intersect(u1,v0,offset),intersect(u1,v1,offset),intersect(u0,v1,offset)],offset);}
    // The curtains' grid: the walls' optical depth, color and depth range in each cell, box-averaged from the picture.
    const fscale=Math.min(1,recipe.bake.bulgeFacePixels!/Math.max(bw,bh)),sw=Math.max(2,Math.round(bw*fscale)),sh=Math.max(2,Math.round(bh*fscale));
    const grid=Array.from({length:sw*sh},(_,t)=>{const i=t%sw,j=Math.floor(t/sw),x0=bl+Math.floor(i*bw/sw),x1=Math.max(x0+1,bl+Math.floor((i+1)*bw/sw)),y0=bt+Math.floor(j*bh/sh),y1=Math.max(y0+1,bt+Math.floor((j+1)*bh/sh));
      const sides=layers.map(()=>({tau:0,color:[0,0,0],lo:Infinity,hi:-Infinity}));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x;if(Number.isNaN(near[p]!))continue;
        for(const [k,layer] of layers.entries()){const side=sides[k]!,tau=layer.tau[p]!,at=layer.depth[p]!,hue=layer.hue;if(!(tau>0))continue;side.tau+=tau;side.lo=Math.min(side.lo,at);side.hi=Math.max(side.hi,at);for(let c=0;c<3;c++)side.color[c]!+=tau*hue[3*p+c]!;}}
      const n=(x1-x0)*(y1-y0);return sides.map(side=>({tau:side.tau/n,color:side.color.map(c=>side.tau?c/side.tau:0),lo:side.lo-step/2,hi:side.hi+step/2}));});
    const crossSlices=recipe.bake.bulgeCrossSlices!,depthPx=Math.max(8,Math.round(sh*2*reach/Math.max(1e-9,Math.hypot(...difference3(intersect(bu0,bv0,0),intersect(bu0,bv1,0))))));
    for(const axis of ['x','y'] as const){const along=axis==='x'?sh:sw;
      for(let s=0;s<crossSlices;s++){const fraction=(s+.5)/crossSlices,rgba=Buffer.alloc(along*depthPx*4),u=bu0+(bu1-bu0)*fraction,v=bv0+(bv1-bv0)*fraction;
        const spacing=Math.hypot(...difference3(axis==='x'?intersect(bu0,v,0):intersect(u,bv0,0),axis==='x'?intersect(bu1,v,0):intersect(u,bv1,0)))/crossSlices;let any=false;
        // A curtain stands for the slab of the nebula around it: at each place along it, the walls of the slab's cells
        // across it, over the depths they span there, so neighbouring curtains' walls meet.
        const across=axis==='x'?sw:sh,first=Math.floor(s*across/crossSlices),last=Math.max(first+1,Math.floor((s+1)*across/crossSlices));
        for(let a=0;a<along;a++){const cell=layers.map((_,side)=>{let tau=0,lo=Infinity,hi=-Infinity;const color=[0,0,0];
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
  if(bodyFill){
    // The body as leaves, from one grid of cells over its outline (`bulgeFacePixels` on its longer side). Face-on (the z
    // bank): slabs parallel to the picture, each holding the light the model puts between its two faces, so from the
    // Sun the slabs add up to the photograph. From the side (the x and y banks): curtains through the grid's columns
    // and rows, each holding the light of the slab of nebula around it.
    const {spans,tau,dense,hue,radius,emit,along,hollow}=bodyFill,W=info.width,N=BODY_DEPTHS;
    let bl=W,bt=info.height,br=-1,bb=-1,reach=0;for(let py=0;py<info.height;py++)for(let px=0;px<W;px++){const p=py*W+px;if(Number.isNaN(spans[N*p]!))continue;bl=Math.min(bl,px);br=Math.max(br,px);bt=Math.min(bt,py);bb=Math.max(bb,py);reach=Math.max(reach,-spans[N*p]!,spans[N*p+1]!);}
    const bw=br-bl+1,bh=bb-bt+1,slices=recipe.bake.bulgeSlices!,step=2*reach/slices,toward=Math.sign(intersect(0,0,1)[2]-intersect(0,0,0)[2])||1;
    const bu0=2*bl/W-1,bu1=2*(br+1)/W-1,bv0=1-2*bt/info.height,bv1=1-2*(bb+1)/info.height,name=(axis:LayerAxis,index:number)=>`shape-${axis}-${String(index).padStart(2,'0')}`;
    const push=async(id:string,axis:LayerAxis,rgba:Buffer,width:number,height:number,v:Quad['verticesUnits'],offset:number)=>{const path=`layers/${id}.webp`,bytes=await encode(rgba,width,height,path,true);
      leaves.push({id,axis,offsetKpc:offset,centerUnits:scale(add(...v),.25),doubleSided:true,texturePath:path,widthPx:width,heightPx:height,verticesUnits:v,uvs:[[0,0],[1,0],[1,1],[0,1]],style:styleOf(v,path,width,height,leaves.length),bytes:bytes.length});};
    // A texel from its channels' optical depths. Its opacity is its brightest channel's, drawn a little more opaque
    // and a little less saturated (`BODY_COLOR_PEAK`), which leaves room above every channel: a browser keeps a
    // layer's color times its opacity in whole numbers, rounded down, and half a step is added back to each channel.
    // `owed` is the rounding of the opacity carried from the texel in front; the texel's own is returned.
    const paint=(rgba:Buffer,o:number,each:readonly number[],owed:number)=>{const depth=Math.max(...each),wanted=depth/BODY_COLOR_PEAK+owed,stored=Math.max(0,Math.min(254,Math.round(255*(1-Math.exp(-wanted))))),lift=stored?127.5/stored:0;
      for(let c=0;c<3;c++)rgba[o+c]=Math.min(255,Math.round(255*BODY_COLOR_PEAK*each[c]!/depth+lift));rgba[o+3]=stored;return wanted+Math.log(1-stored/255);};
    // The share of a bell between `from` and `to` (most in the middle, none at its ends) that lies between `lo` and `hi`.
    const upTo=(x:number,from:number,to:number)=>{const t=Math.max(0,Math.min(1,(x-from)/(to-from)));return t-Math.sin(2*Math.PI*t)/(2*Math.PI);},bell=(lo:number,hi:number,from:number,to:number)=>upTo(hi,from,to)-upTo(lo,from,to);
    // The grid: each cell's light toward the Sun by channel (color times opacity, 0 to 1), its distance from the star
    // and its depths, averaged over its pixels by their optical depth.
    const fscale=Math.min(1,recipe.bake.bulgeFacePixels!/Math.max(bw,bh)),sw=Math.max(2,Math.round(bw*fscale)),sh=Math.max(2,Math.round(bh*fscale)),cells=sw*sh;
    const grid=Array.from({length:cells},(_,t)=>{const i=t%sw,j=Math.floor(t/sw),x0=bl+Math.floor(i*bw/sw),x1=Math.max(x0+1,bl+Math.floor((i+1)*bw/sw)),y0=bt+Math.floor(j*bh/sh),y1=Math.max(y0+1,bt+Math.floor((j+1)*bh/sh));
      const at=[0,0,0,0,0,0,0,0],light=[0,0,0],sides=[0,0],middles=[0,0];let sum=0,far=0,inBody=0,length=0,thick=0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x,o=N*p,weight=tau[p]!;if(Number.isNaN(spans[o]!)||!(weight>0))continue;sum+=weight;far+=weight*radius[p]!;at[0]!+=weight*spans[o]!;at[1]!+=weight*spans[o+1]!;for(let c=0;c<3;c++)light[c]!+=(1-Math.exp(-weight))*hue[3*p+c]!/255;
        if(!Number.isNaN(spans[o+2]!)){inBody+=weight;at[2]!+=weight*spans[o+2]!;at[3]!+=weight*spans[o+3]!;}
        if(!Number.isNaN(spans[o+4]!)){const size=spans[o+5]!-spans[o+4]!,centre=(spans[o+4]!+spans[o+5]!)/2,side=centre<0?0:1;length+=weight*size;sides[side]!+=weight*size;middles[side]!+=weight*size*centre;}
        if(dense[p]!>0){thick+=weight*dense[p]!;at[6]!+=weight*dense[p]!*spans[o+6]!;at[7]!+=weight*dense[p]!*spans[o+7]!;}}
      // A cell's cavity: its pixels' mean length, about the mean centre, weighted by length, of those on the side of the
      // star most of them are on, so a cell across the line between a near lobe and a far one does not put one at the star.
      const side=sides[0]!>=sides[1]!?0:1,size=inBody>0?length/inBody:0,middle=sides[side]!>0?middles[side]!/sides[side]!:0,area=(x1-x0)*(y1-y0);
      return {light:light.map(value=>Math.min(.998,value/area)),radius:sum?far/sum:0,thick:sum?thick/sum:0,at:[sum?at[0]!/sum:NaN,sum?at[1]!/sum:NaN,inBody?at[2]!/inBody:NaN,inBody?at[3]!/inBody:NaN,size>0?middle-size/2:NaN,size>0?middle+size/2:NaN,thick?at[6]!/thick:NaN,thick?at[7]!/thick:NaN]};});
    // Each cell's light by slab: the shares of each channel's light the model puts in each slab, then how much each
    // channel emits in all, found so that what the Sun sees through the nearer slabs is the cell's own light.
    const parts=new Float32Array(cells*slices*3),wholes=new Float32Array(cells*3),emission=new Float32Array(cells*3);
    for(let t=0;t<cells;t++){const cell=grid[t]!,most=Math.max(...cell.light);if(!(most>0))continue;
      for(let c=0;c<3;c++){let whole=0;for(let k=0;k<slices;k++){const lo=-reach+k*step,from=Math.max(lo,cell.at[0]!),to=Math.min(lo+step,cell.at[1]!),part=to>from?along(c,cell.radius,from,to,cell.at[4]!,cell.at[5]!,BODY_STEPS):0;parts[(t*slices+k)*3+c]=part;whole+=part;}
        wholes[t*3+c]=whole;
        for(let k=0;k<slices;k++){const o=(t*slices+k)*3+c,lo=-reach+k*step;parts[o]=whole>0?(1-cell.thick)*parts[o]!/whole+(cell.thick>0?cell.thick*bell(lo,lo+step,cell.at[6]!,cell.at[7]!):0):k===slices>>1?1:0;}
        emission[t*3+c]=-Math.log(1-most)*cell.light[c]!/most;}
      for(let pass=0;pass<BODY_PASSES;pass++){const seen=[0,0,0];let clear=1;
        for(let k=0;k<slices;k++){const o=(t*slices+k)*3,red=emission[t*3]!*parts[o]!,green=emission[t*3+1]!*parts[o+1]!,blue=emission[t*3+2]!*parts[o+2]!,depth=Math.max(red,green,blue);if(!(depth>0))continue;
          const shown=BODY_COLOR_PEAK*(1-Math.exp(-depth/BODY_COLOR_PEAK))*clear/depth;seen[0]!+=red*shown;seen[1]!+=green*shown;seen[2]!+=blue*shown;clear*=Math.exp(-depth/BODY_COLOR_PEAK);}
        for(let c=0;c<3;c++)if(seen[c]!>0)emission[t*3+c]=Math.min(BODY_MOST_DEPTH,emission[t*3+c]!*cell.light[c]!/seen[c]!);}}
    // Every slab is drawn on the same rectangle, so a browser places them all alike: where a cavity ends, the slabs in
    // front of the star and those behind it change by opposite amounts, and a slab a fraction of a pixel off shows there as a line.
    const carry=new Float32Array(cells);
    for(let k=0;k<slices;k++){const lo=-reach+k*step,hi=lo+step,rgba=Buffer.alloc(cells*4);let any=false;
      for(let t=0;t<cells;t++){const o=4*t,from=(t*slices+k)*3,each=[emission[t*3]!*parts[from]!,emission[t*3+1]!*parts[from+1]!,emission[t*3+2]!*parts[from+2]!],depth=Math.max(...each);
        // Color is kept under transparent texels too, so the lossy encoding has no dark edge to bleed in.
        if(!(depth>0)){const most=Math.max(...grid[t]!.light);if(most>0)for(let c=0;c<3;c++)rgba[o+c]=Math.round(255*grid[t]!.light[c]!/most);else{const p=(bt+Math.floor((Math.floor(t/sw)+.5)*bh/sh))*W+bl+Math.floor((t%sw+.5)*bw/sw);for(let c=0;c<3;c++)rgba[o+c]=base[4*p+c]!;}continue;}
        carry[t]=paint(rgba,o,each,carry[t]!);if(rgba[o+3])any=true;}
      if(!any)continue;
      const offset=toward*(lo+hi)/2;
      await push(name('z',k),'z',rgba,sw,sh,[intersect(bu0,bv0,offset),intersect(bu1,bv0,offset),intersect(bu1,bv1,offset),intersect(bu0,bv1,offset)],offset);}
    const crossSlices=recipe.bake.bulgeCrossSlices!,depthPx=Math.max(8,Math.round(sh*2*reach/Math.max(1e-9,Math.hypot(...difference3(intersect(bu0,bv0,0),intersect(bu0,bv1,0))))));
    for(const axis of ['x','y'] as const){const lengthPx=axis==='x'?sh:sw;
      for(let s=0;s<crossSlices;s++){const fraction=(s+.5)/crossSlices,rgba=Buffer.alloc(lengthPx*depthPx*4),u=bu0+(bu1-bu0)*fraction,v=bv0+(bv1-bv0)*fraction;
        const spacing=Math.hypot(...difference3(axis==='x'?intersect(bu0,v,0):intersect(u,bv0,0),axis==='x'?intersect(bu1,v,0):intersect(u,bv1,0)))/crossSlices;let any=false;
        const across=axis==='x'?sw:sh,first=Math.floor(s*across/crossSlices),last=Math.max(first+1,Math.floor((s+1)*across/crossSlices)),half=reach/depthPx;
        for(let a=0;a<lengthPx;a++)for(let d=0;d<depthPx;d++){const z=toward*(reach-(d+.5)/depthPx*2*reach),o=4*(d*lengthPx+a),optical=[0,0,0];
          // Each channel's light in the curtain's slab of cells at this depth, per unit length, times the curtain spacing.
          for(let i=first;i<last;i++){const t=axis==='x'?a*sw+i:i*sw+a,cell=grid[t]!;if(!(z>=cell.at[0]!&&z<cell.at[1]!))continue;
            const hole=z>=cell.at[4]!&&z<cell.at[5]!?1-hollow:1,thick=cell.thick>0?cell.thick*bell(z-half,z+half,cell.at[6]!,cell.at[7]!)/(2*half):0,far=Math.hypot(cell.radius,z);
            for(let c=0;c<3;c++)if(wholes[t*3+c]!>0)optical[c]!+=emission[t*3+c]!*((1-cell.thick)*emit(c,far)*hole/wholes[t*3+c]!+thick)*spacing/(last-first);}
          if(!(Math.max(...optical)>0))continue;paint(rgba,o,optical,0);if(rgba[o+3])any=true;}
        if(!any)continue;
        const quad=(axis==='x'?[intersect(u,bv0,reach),intersect(u,bv1,reach),intersect(u,bv1,-reach),intersect(u,bv0,-reach)]:[intersect(bu0,v,reach),intersect(bu1,v,reach),intersect(bu1,v,-reach),intersect(bu0,v,-reach)]) as Quad['verticesUnits'];
        await push(name(axis,s),axis,rgba,lengthPx,depthPx,quad,axis==='x'?(quad[0][0]+quad[1][0])/2:(quad[0][1]+quad[1][1])/2);}}}
  const provenanceBytes=await readFile(resolve(options.sourceDirectory,recipe.provenance.path));
  const provenance=JSON.parse(provenanceBytes.toString('utf8')) as unknown;
  const allVertices=leaves.flatMap(l=>l.verticesUnits),bounds={min:[0,1,2].map(i=>Math.min(...allVertices.map(v=>v[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...allVertices.map(v=>v[i]))) as Vec3};
    const inDepth=(leaf:Quad)=>leaf.id.startsWith('bulge-')||leaf.id.startsWith('shape-');
    const glow=ringsSteps!==null,bank=(axis:LayerAxis)=>{const selected=leaves.filter(l=>l.axis===axis),sampled=selected.filter(l=>glow?inDepth(l):!inDepth(l)),middle=sampled[Math.floor(sampled.length/2)],normal=axis==='z'?diskNormal:flat&&!glow?norm(difference(middle.verticesUnits[axis==='x'?1:3],middle.verticesUnits[0])):norm(cross(difference(middle.verticesUnits[1],middle.verticesUnits[0]),difference(middle.verticesUnits[2],middle.verticesUnits[1])));let samplingStepUnits=thickness/(recipe.geometry.depthWeights.length-1);
    // A flat bank's one picture belongs to every view, so its face-on stack always wins. With a bulge each view has its own
    // bulge leaves (slices face-on, curtains from the side): their spacing decides the view, so the curtains take over side-on.
    const bulgeLeaves=selected.filter(inDepth);
    if(flat&&bulgeLeaves.length>1){const values=bulgeLeaves.map(l=>dot(l.centerUnits,normal));samplingStepUnits=(Math.max(...values)-Math.min(...values))/(bulgeLeaves.length-1);}
    else if(flat&&axis!=='z')samplingStepUnits=recipe.geometry.supportRadiusKpc*2;else if(axis!=='z'){const values=sampled.map(l=>dot(l.centerUnits,normal)),span=Math.max(...values)-Math.min(...values);samplingStepUnits=sampled.length>1?span/(sampled.length-1):recipe.geometry.supportRadiusKpc*2;}
    // Rings with depth: the curtains' spacing tells the views from the sides, and the face-on drawing counts as coarser.
    if(ringsSteps)samplingStepUnits=axis==='x'?ringsSteps[0]:axis==='y'?ringsSteps[1]:RINGS_FACE_ON_STEP*(ringsSteps[0]+ringsSteps[1])/2;
    return {axis,normalUnits:normal,samplingStepUnits,leaves:selected};};
  // Surfaces drawn as patches are one stack for every view: its leaves in their scenes, the depth it resolves the
  // patches' fit. The two stacks beside it are empty, across the picture and down it, each as coarse as the picture is wide.
  const patched=():PreparedImageLayerBank['banks']=>{const across=difference(intersect(1,0,0),intersect(-1,0,0)),along=dot(across,diskNormal),right=norm([across[0]-along*diskNormal[0],across[1]-along*diskNormal[1],across[2]-along*diskNormal[2]]),down=norm(cross(diskNormal,right)),wide=Math.hypot(...across);
    return [{axis:'x',normalUnits:right,samplingStepUnits:wide,leaves:[]},{axis:'y',normalUnits:down,samplingStepUnits:wide,leaves:[]},{axis:'z',normalUnits:diskNormal,samplingStepUnits:recipe.geometry.shape!.speeds!.reachArcsec*distanceKpc*Math.PI/648000,leaves:leaves.filter(leaf=>leaf.axis==='z'),scenes:shapeScenes!}];};
  const result:PreparedImageLayerBank={schema:PREPARED_IMAGE_LAYER_BANK_SCHEMA,id:recipe.id,frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5,originM:origin,localToReferenceXyzw:q,metersPerUnit:M_PER_KPC/unitsPerKpc,boundsUnits:bounds},observation:recipe.observation,
    banks:shapeScenes?patched():(['x','y','z'] as LayerAxis[]).map(bank),resources,provenance,approximation:{model:ringsModel?`The observed display RGB lies on two tilted planes through the star, a disc's and the plane of the ring around it. Inside the disc's radius a sight line's light is on the disc, beyond the ring's radius on the ring's plane; between the two published radii the planes share it in proportion.${ringsModel.thickness>0?' The smooth part of each structure\'s light is a glow about its plane, as deep along the sight line as its published thickness; the rest, with every detail, stays on the plane.':''}`:bodyModel?`The observed display RGB inside the published outline is spread along each sight line through a filled body, its envelope and its cavities; outside the outline it lies on one plane.`:shapeModel?`The observed display RGB inside the published outline lies on two walls, in front of the star and behind it, at the depths the published expansion speeds give; outside the outline it lies on one plane.`:flat?`The observed display RGB lies on one plane, the ${recipe.geometry.kind}'s midplane; nothing in it has depth.`:`A low-frequency fraction of the observed display RGB is distributed through one normalized ${recipe.geometry.kind} depth profile; the compact residual remains on the physical midplane.`,canonicalRecomposition:'The source-facing diffuse slabs use optical-depth weights and composite with the residual layer to reproduce the prepared observation within resampling and encoding error.',limitations:['Depth is parametric and is not measured per pixel.','Compact residuals are image-frequency features, not classified stars or measured 3D positions.','Cross-axis banks are sampled projections of the separable display model; finite slices and bank handoffs remain visible.',foreground?`Milky Way foreground stars from ${recipe.source.foregroundStars!.source} were removed where they show (${foreground.removed} of the ${foreground.inImage} catalogued in the image; ${foreground.extended} left where the light is an extended object); fainter ones and uncatalogued stars remain.`:'Released foreground stars remain because blanket removal would also erase intrinsic galaxy stars.',...(colorTie?[`Whole-galaxy color tied to B-V ${colorTie.bv} (${colorTie.source}): red/green and blue/green in linear light measured ${colorTie.measured[0]}, ${colorTie.measured[2]}, target ${colorTie.target[0]}, ${colorTie.target[2]}; gains red ${colorTie.gains[0]}, blue ${colorTie.gains[2]}.`]:[]),...(bulgeModel?[`The bulge fit (${recipe.geometry.bulge!.source}) stands in for ${saturatedPixels} saturated pixels, scaled by ${lightScale.toPrecision(4)} optical depth per unit fitted light.`]:[]),...(shapeModel&&shapeWalls?[`The walls (${recipe.geometry.shape!.source}) are ellipsoids from published expansion speeds and a published expansion law, out to ${shapeModel.reach.toFixed(1)} arcsec along the sight line; ${shapeWalls.pixels} face pixels lie on them. One picture cannot tell the near wall from the far one: the far wall holds half the optical depth of the light smooth over ${recipe.geometry.shape!.smoothPixels} face pixels, the near wall the rest. A pixel's depth is its channels' walls weighted by its smooth light in each.`]:[]),...(bodyModel&&bodyFill?[`The body (${recipe.geometry.body!.source}) is a published outline, pole and cavity emission, out to ${bodyModel.reach.toFixed(1)} arcsec along the sight line; ${bodyFill.pixels} face pixels lie in it. How much the gas emits at each distance from the star is read from the picture, taken as the same all around the star. A cavity's place along a sight line is the model's; its length is read from how dim the picture is there (${bodyFill.carved} sight lines carved), not from spectra.`]:[]),...(companions?[`Companion galaxies ${companions.keys.join(', ')} from ${recipe.source.companions!.source} were replaced by the light around them, out to ${companions.extentHalfLight.join(', ')} half-light radii.`]:[])]}};
  await writeFile(resolve(options.outputDirectory,'image-layers.json'),JSON.stringify(result,null,2)+'\n');return result;
}

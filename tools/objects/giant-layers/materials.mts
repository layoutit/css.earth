import { sha256 } from '../../../src/platform/sha256.mts';
import { isArray } from '../../../src/platform/is-array.mts';
import { shape, array, number, optional } from '../terrestrial-layers/source-records.mts';
import { parse } from '../material-composition/data-schema.mts';
import { ellipsoidMaterialRecipe, type Orientation, type MaterialPose, type MaterialRaster, type RadialMaterialInput, type MaterialAsset, type FixedMaterial, type PreparedLensMaterial } from './material-contract.mts';
import type { Vector3, ReadonlyVector3 } from '../material-composition/ellipsoid.mts';
import type { WebpOptions } from 'sharp';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { worldPositionToCss } from '@layoutit/polycss';
import { intersectViewRayWithEllipsoid, normalizeVector, dotVector, rotateSequence } from '../material-composition/ellipsoid.mts';
import { writeMaterialAtlasTile, sampleRgbaBilinear } from '../material-composition/raster.mts';

import { optimizePreparedDisplayLosslessWebp, optimizePreparedQ75Webp, PREPARED_Q75_WEBP_ENCODING } from '../../prepared/prepared-webp.mts';

const clamp=(value: number,low=0,high=1)=>Math.max(low,Math.min(high,value));
const scale=(vector: ReadonlyVector3,value: number): Vector3=>[vector[0]*value,vector[1]*value,vector[2]*value];
const add=(...vectors: ReadonlyVector3[]): Vector3=>[vectors.reduce((sum,v)=>sum+v[0],0),vectors.reduce((sum,v)=>sum+v[1],0),vectors.reduce((sum,v)=>sum+v[2],0)];

const safeName=(name: unknown)=>typeof name==='string'&&/^[a-z0-9][a-z0-9-]*(?:@2x)?\.webp$/u.test(name);
function transform(vector: ReadonlyVector3,steps: readonly Orientation[],state: MaterialPose){for(const step of steps){if(step.kind==='normalize')vector=normalizeVector(vector);else vector=rotateSequence(vector,[{axis:step.axis,degrees:'state' in step?state[step.state]*step.factor:step.degrees}]);}return vector;}

export function parseEllipsoidMaterialRecipe(input: unknown){
  const config = parse(input, ellipsoidMaterialRecipe, 'ellipsoid material recipe');
  const fail=(message: string): never=>{throw new TypeError(`Ellipsoid material: ${message}`);},positive=(value: number)=>Number.isFinite(value)&&value>0,unit=(value: number | undefined)=>typeof value === 'number'&&Number.isFinite(value)&&value>=0&&value<=1,integer=(value: number,min: number,max: number)=>Number.isInteger(value)&&value>=min&&value<=max;
  const vector=(value: readonly number[])=>isArray(value)&&value.length===3&&value.every(Number.isFinite)&&Math.hypot(...value)>0;
  const color=(value: readonly number[] | undefined)=>isArray(value)&&value.length===3&&value.every(channel=>integer(channel,0,255));
  if(config?.schema!=='cssearth-ellipsoid-materials@1'||!isArray(config.lenses)||!config.lenses.length||!/^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(config.urlPrefix))fail('invalid recipe.');
  const {shape,view,grid,lighting,atmosphere,silhouette}=config.raster??{},bank=config.bank;
  if(!shape||!positive(shape.equatorialRadius)||!positive(shape.polarRadius)||!['division','reciprocal'].includes(shape.arithmetic)||!['facing','positive'].includes(shape.rootSelection))fail('invalid physical shape.');
  const rotations=(steps: readonly Orientation[])=>{if(!isArray(steps))fail('missing orientation.');for(const step of steps){if(step.kind==='normalize')continue;if(step.kind!=='rotate'||!['x','y','z'].includes(step.axis)||('state' in step?!['scenePitchDegrees','systemObliquityDegrees'].includes(step.state)||!Number.isFinite(step.factor):!Number.isFinite(step.degrees)))fail('invalid orientation operation.');}};
  if(!view||![view.right,view.down,view.forward,config.raster.light?.direction].every(vector))fail('invalid view/light vectors.');rotations(view.rotations);rotations(config.raster.light.operations);
  if(!grid||!['projected-ellipsoid','fixed-span'].includes(grid.kind)||(grid.kind==='fixed-span'?!positive(grid.span):!positive(grid.coverageScale)||!positive(grid.contentScale)||!Number.isFinite(grid.depthBias)))fail('invalid projection grid.');
  if(!lighting||!unit(lighting.ambient)||!isArray(lighting.terminator)||lighting.terminator.length!==2||!lighting.terminator.every(Number.isFinite)||lighting.terminator[1]<=lighting.terminator[0]||(lighting.terminatorWidth!==undefined&&!positive(lighting.terminatorWidth))||!['amount-first','direct-first'].includes(lighting.smoothstepOrder)||!['atmosphere-first','lighting-first'].includes(lighting.alphaOrder))fail('invalid attenuation law.');
  if(!atmosphere||!positive(atmosphere.limbExponent)||!['normalized-night-floor','additive-floor'].includes(atmosphere.model)||(atmosphere.model==='normalized-night-floor'?!unit(atmosphere.maximumAlpha)||!unit(atmosphere.nightFloor):!unit(atmosphere.floor)||!unit(atmosphere.gain)))fail('invalid limb atmosphere.');
  if(silhouette&&(!positive(silhouette.horizontalScale)||!positive(silhouette.verticalScale)||!unit(silhouette.fadeStart)||!unit(silhouette.opaqueAt)||silhouette.fadeStart<=silhouette.opaqueAt||!unit(silhouette.sideFadeStart)||!unit(silhouette.sideOpaqueAt)||silhouette.sideOpaqueAt<=silhouette.sideFadeStart))fail('invalid silhouette backing.');
  if(!config.fixedState||!Number.isFinite(config.fixedState.scenePitchDegrees)||!Number.isFinite(config.fixedState.systemObliquityDegrees))fail('invalid reference pose.');
  if(!bank||!integer(bank.frames,2,4096)||!integer(bank.columns,1,bank.frames)||bank.frames%bank.columns||!integer(bank.frameSize,2,4096)||!integer(bank.gutter,0,32)||(bank.frameSize+bank.gutter*2)*bank.columns>32768||!positive(bank.maximumScenePitchDegrees)||!positive(bank.presentationSize)||!bank.encoding)fail('invalid row bank.');
  if(bank.systemObliquity&&(!Number.isFinite(bank.systemObliquity.degrees)||!positive(bank.systemObliquity.referencePitch)))fail('invalid axial-tilt schedule.');
  const outputs=new Set(),ids=new Set();
  for(const lens of config.lenses){
    if(!/^[a-z][a-z0-9-]*$/u.test(lens.id)||ids.has(lens.id)||(!lens.atmosphereFromMap&&!color(lens.atmosphere))||(silhouette&&!color(lens.fixedBase))||!isArray(lens.fixed)||!lens.fixed.length)fail('invalid lens material.');ids.add(lens.id);
    for(const product of lens.fixed){if(!safeName(product.filename)||outputs.has(product.filename)||!integer(product.size,2,8192)||![1,2].includes(product.density)||typeof product.shadowless!=='boolean'||!product.encoding||![undefined,'display-lossless','q75'].includes(product.optimization))fail('invalid fixed material product.');outputs.add(product.filename);}
    for(let row=0;row<bank.frames/bank.columns;row++){const name=String(lens.rowOutput).replace('{row}',String(row).padStart(2,'0'));if(!safeName(name)||outputs.has(name))fail('invalid or duplicate material row.');outputs.add(name);}
  }
  if(config.radialLayer&&(!integer(config.radialLayer.layerIndex,0,1000)||!integer(config.radialLayer.size,2,8192)||!positive(config.radialLayer.outerRadius)||!unit(lighting.radialShadowGain)))fail('invalid radial source binding.');
  return config;
}

function sampleRadialPlane(x: number,y: number,layer: RadialMaterialInput) {
  const {data,size,outerRadius}=layer;
  return sampleRgbaBilinear(data,size,(x/outerRadius+1)*0.5*(size-1),(y/outerRadius+1)*0.5*(size-1));
}
function radialIntersection(origin: ReadonlyVector3,direction: ReadonlyVector3,layer: RadialMaterialInput | undefined,minimumDistance: number) {
  if(!layer||Math.abs(direction[2])<1e-9)return null;
  const distance=-origin[2]/direction[2];if(distance<=minimumDistance)return null;
  const x=origin[0]+distance*direction[0],y=origin[1]+distance*direction[1];
  if(Math.hypot(x,y)>layer.outerRadius)return null;return sampleRadialPlane(x,y,layer);
}

/** A source-defined directional attenuation/limb overlay, optionally closing
 * the polygon silhouette and resolving front/behind radial-layer occlusion. */
export function rasterEllipsoidMaterial(config: MaterialRaster,{size,state,palette,radialLayer,shadowless=false,textureUrl='',geometryOnly=false}: {size: number; state: MaterialPose; palette?: {atmosphere: readonly number[]; base?: readonly number[]}; radialLayer?: RadialMaterialInput; shadowless?: boolean; textureUrl?: string; geometryOnly?: boolean}) {
  const {shape,view:camera,grid,lighting,atmosphere,silhouette}=config;
  const right=transform(camera.right,camera.rotations,state),down=transform(camera.down,camera.rotations,state),view=transform(camera.forward,camera.rotations,state);
  const light=shadowless?view:transform(config.light.direction,config.light.operations,state);
  const projected=(direction: ReadonlyVector3)=>Math.sqrt(shape.equatorialRadius**2*(direction[0]**2+direction[1]**2)+shape.polarRadius**2*direction[2]**2);
  const radiusX=projected(right),radiusY=projected(down),frontDepth=projected(view),output=Buffer.alloc(size*size*4),center=(size-1)/2,pixelToObject=grid.kind==='fixed-span'?grid.span/size:0;
  const intersect=(origin: ReadonlyVector3)=>intersectViewRayWithEllipsoid(origin,view,shape);
  let foregroundRingTexelCount=0,ringShadowTexelCount=0;
  for(let y=0;y<(geometryOnly?0:size);y++)for(let x=0;x<size;x++){
    if(!palette)throw new TypeError('Raster material palette is required.');
    const screenX=grid.kind==='projected-ellipsoid'?((x+0.5)/size*2-1)*radiusX:(x-center)*pixelToObject;
    const screenY=grid.kind==='projected-ellipsoid'?((y+0.5)/size*2-1)*radiusY:(y-center)*pixelToObject;
    const origin=add(scale(right,screenX),scale(down,screenY)),surfaceHit=intersect(origin);
    let hit=surfaceHit,backingHit,sideCoverage=0;
    if(silhouette){
      const direction=Math.abs(screenX)/Math.max(1e-9,Math.hypot(screenX,screenY));sideCoverage=clamp((direction-silhouette.sideFadeStart)/(silhouette.sideOpaqueAt-silhouette.sideFadeStart));
      const horizontal=1+(silhouette.horizontalScale-1)*sideCoverage,vertical=silhouette.verticalScale+(1-silhouette.verticalScale)*sideCoverage;
      backingHit=intersect(add(scale(right,screenX/horizontal),scale(down,screenY/vertical)));if(!backingHit)continue;hit=surfaceHit??backingHit;
    }else{
      if(!surfaceHit)continue;const materialScale=grid.kind==='projected-ellipsoid'?grid.coverageScale/grid.contentScale:1;
      hit=intersect(add(scale(right,screenX*materialScale),scale(down,screenY*materialScale)))??surfaceHit;
    }
    if (!hit) throw new Error('Material ray intersection is unavailable.');
    let direct=Math.max(0,dotVector(hit.normal,light));
    const ringShadow=shadowless?0:(radialIntersection(hit.position,light,radialLayer,0)?.[3]??0)/255;
    if(ringShadow>1/255&&direct>0){direct*=1-ringShadow*(lighting.radialShadowGain ?? 0);ringShadowTexelCount++;}
    const amount=clamp((direct-lighting.terminator[0])/(lighting.terminatorWidth??(lighting.terminator[1]-lighting.terminator[0])));
    // Preserve the accepted source numerical convention of each capability.
    const diffuse=lighting.smoothstepOrder==='direct-first'?direct*amount*amount*(3-2*amount):direct*(amount*amount*(3-2*amount));
    const illumination=lighting.ambient+(1-lighting.ambient)*diffuse,lightingAlpha=clamp(1-illumination);
    const alignment=Math.max(0,dotVector(hit.normal,view)),limb=Math.pow(1-alignment,atmosphere.limbExponent);
    const atmosphereAlpha=atmosphere.model==='normalized-night-floor'
      ?clamp(limb*atmosphere.maximumAlpha*(atmosphere.nightFloor+(1-atmosphere.nightFloor)*Math.sqrt(direct)),0,atmosphere.maximumAlpha)
      :clamp(limb*(atmosphere.floor+Math.sqrt(direct)*atmosphere.gain));
    let alpha=lighting.alphaOrder==='atmosphere-first'?1-(1-atmosphereAlpha)*(1-lightingAlpha):1-(1-lightingAlpha)*(1-atmosphereAlpha);
    const offset=(y*size+x)*4;
    if(silhouette){
      if (!backingHit || !palette.base) throw new Error('Silhouette requires a backing intersection and base colour.');
      const coverage=(normalAlignment: number)=>clamp((silhouette.fadeStart-normalAlignment)/(silhouette.fadeStart-silhouette.opaqueAt));
      const silhouetteCoverage=surfaceHit?Math.max(coverage(alignment),coverage(Math.max(0,dotVector(backingHit.normal,view)))):sideCoverage;
      const transmission=illumination*(1-atmosphereAlpha),resolvedAlpha=surfaceHit?alpha*(1-silhouetteCoverage)+silhouetteCoverage:sideCoverage;
      for(let c=0;c<3;c++){const overlay=palette.atmosphere[c]*atmosphereAlpha,resolved=overlay+palette.base[c]*transmission,premultiplied=surfaceHit?overlay*(1-silhouetteCoverage)+resolved*silhouetteCoverage:resolved*sideCoverage;output[offset+c]=resolvedAlpha>0?clamp(Math.round(premultiplied/resolvedAlpha),0,255):0;}alpha=resolvedAlpha;
    }else for(let c=0;c<3;c++)output[offset+c]=alpha>0?Math.round(palette.atmosphere[c]*atmosphereAlpha/alpha):0;
    output[offset+3]=clamp(Math.round(alpha*255),0,255);
    if(radialLayer){
      const surfaceDistance=dotVector([hit.position[0]-origin[0],hit.position[1]-origin[1],hit.position[2]-origin[2]],view),foreground=radialIntersection(origin,view,radialLayer,surfaceDistance);
      if(!foreground||foreground[3]<=0)continue;const radialAlpha=foreground[3]/255,compositeAlpha=radialAlpha+alpha*(1-radialAlpha);
      for(let c=0;c<3;c++)output[offset+c]=compositeAlpha>0?clamp(Math.round((foreground[c]*radialAlpha+output[offset+c]*alpha*(1-radialAlpha))/compositeAlpha),0,255):0;
      output[offset+3]=clamp(Math.round(compositeAlpha*255),0,255);foregroundRingTexelCount++;
    }
  }
  let leaf;
  if(grid.kind==='projected-ellipsoid'){
    const scaledX=radiusX*grid.coverageScale,scaledY=radiusY*grid.coverageScale;
    const matrix=[...worldPositionToCss(scale(right,scaledX*2/size)),0,...worldPositionToCss(scale(down,scaledY*2/size)),0,...worldPositionToCss([view[0],view[1],view[2]]),0,...worldPositionToCss(add(scale(right,-scaledX),scale(down,-scaledY),scale(view,frontDepth+grid.depthBias))),1].map(value=>Number(value.toFixed(12)));
    leaf={tag:'s',style:`transform:matrix3d(${matrix.join(',')});--polycss-atlas-width:${size}px;--polycss-atlas-height:${size}px;background-image:url(${textureUrl});background-size:${size}px ${size}px;backface-visibility:visible`};
  }
  return {rgba:output,leaf,foregroundRingTexelCount,ringShadowTexelCount};
}

/** The encoder stages only its own temporary files; accepted assets are never inputs. */
async function encodeMaterial(data: Buffer,width: number,height: number,encoding: WebpOptions,optimization?: 'display-lossless' | 'q75') {
  const bytes=await sharp(data,{raw:{width,height,channels:4}}).webp(encoding).toBuffer();if(!optimization)return bytes;
  const directory=await mkdtemp(join(tmpdir(),'cssearth-material-')),path=join(directory,'material.webp');
  try{await writeFile(path,bytes);if(optimization==='display-lossless')await optimizePreparedDisplayLosslessWebp(path);else if(optimization==='q75')await optimizePreparedQ75Webp(path);else throw new TypeError('Unknown material optimization.');return await readFile(path);}finally{await rm(directory,{recursive:true,force:true});}
}

export async function prepareEllipsoidMaterials({config: input,maps,radialLayer,publicDirectory,write=false}: {config: unknown; maps: ReadonlyMap<string, unknown>; radialLayer?: RadialMaterialInput; publicDirectory?: string; write?: boolean}) {
  const config = parseEllipsoidMaterialRecipe(input);
  if(Boolean(config.radialLayer)!==Boolean(radialLayer)||radialLayer&&(!Buffer.isBuffer(radialLayer.data)||radialLayer.data.length!==radialLayer.size*radialLayer.size*4))throw new TypeError('Prepared radial input differs from material capability.');
  const assets: MaterialAsset[]=[],lenses: Record<string, PreparedLensMaterial>={};
  const publish=async(filename: string,frame: Buffer,width: number,height: number,encoding: WebpOptions,optimization?: 'display-lossless' | 'q75')=>{if(!safeName(filename))throw new TypeError('Invalid material output.');const data=await encodeMaterial(frame,width,height,encoding,optimization);const record={filename,width,height,bytes:data.length,sha256:sha256(data),data};assets.push(record);return record;};
  for(const lens of config.lenses){
    const inputMap=maps.get(lens.id);if(!inputMap)throw new Error(`Material lens ${lens.id} has no observed map.`);
    const map=shape({atmosphereColor:optional(array(number)),coverage:optional(shape({baselineColor:array(number)}))})(inputMap);
    const atmosphere=lens.atmosphereFromMap?map.atmosphereColor:lens.atmosphere;
    if (!atmosphere) throw new TypeError('Material atmosphere colour is unavailable.');
    const result: {fixed: Record<number, FixedMaterial>; shadowless: Record<number, FixedMaterial>}={fixed:{},shadowless:{}};
    for(const product of lens.fixed){
      const prepared=rasterEllipsoidMaterial(config.raster,{size:product.size,state:config.fixedState,palette:{atmosphere,base:lens.fixedBase},radialLayer,shadowless:product.shadowless,textureUrl:`${config.urlPrefix}${product.filename}`});
      const asset=await publish(product.filename,prepared.rgba,product.size,product.size,product.encoding,product.optimization);
      result[product.shadowless?'shadowless':'fixed'][product.density]={asset,leaf:prepared.leaf};
    }
    const bank=config.bank,rows=[],presentations=[],frameRawSha256=[],frameForegroundRingTexelCounts=[],frameRingShadowTexelCounts=[],stride=bank.frameSize+bank.gutter*2,width=stride*bank.columns,height=stride;
    for(let rowIndex=0;rowIndex<bank.frames/bank.columns;rowIndex++){
      const row=Buffer.alloc(width*height*4),filename=lens.rowOutput.replace('{row}',String(rowIndex).padStart(2,'0'));
      for(let column=0;column<bank.columns;column++){
        const frameIndex=rowIndex*bank.columns+column,scenePitchDegrees=bank.maximumScenePitchDegrees*(1-frameIndex/(bank.frames-1));
        const state={scenePitchDegrees,systemObliquityDegrees:bank.systemObliquity?bank.systemObliquity.degrees*scenePitchDegrees/bank.systemObliquity.referencePitch:config.fixedState.systemObliquityDegrees};
        if (lens.bankBaseFromCoverage && !map.coverage) throw new TypeError('Material coverage base colour is unavailable.');
        const frame=rasterEllipsoidMaterial(config.raster,{size:bank.frameSize,state,palette:{atmosphere,base:lens.bankBaseFromCoverage?map.coverage?.baselineColor:lens.fixedBase},radialLayer,textureUrl:`${config.urlPrefix}${filename}`});
        frameRawSha256.push(sha256(frame.rgba));frameForegroundRingTexelCounts.push(frame.foregroundRingTexelCount);frameRingShadowTexelCounts.push(frame.ringShadowTexelCount);
        const frameX=column*stride+bank.gutter;writeMaterialAtlasTile({output:row,outputWidth:width,source:frame.rgba,sourceSize:bank.frameSize,frameX,frameY:bank.gutter,gutter:bank.gutter});
        const scale=bank.presentationSize/bank.frameSize;
        presentations.push({frameIndex,rowIndex,...(bank.presentationAssetUrl?{assetUrl:`${config.urlPrefix}${filename}`}:{scenePitchDegrees:Number(scenePitchDegrees.toFixed(6))}),backgroundPosition:`${-frameX*scale}px ${-bank.gutter*scale}px`,backgroundSize:`${width*scale}px ${height*scale}px`});
      }
      rows.push(await publish(filename,row,width,height,bank.encoding,bank.optimization));
    }
    lenses[lens.id]={...result,bank:{rows,presentations,frameRawSha256,frameForegroundRingTexelCounts,frameRingShadowTexelCounts,...(bank.optimization==='q75'?{encoding:PREPARED_Q75_WEBP_ENCODING}:{})}};
  }
  if(write){if(!publicDirectory)throw new TypeError('Material output directory is required for writing.');await mkdir(publicDirectory,{recursive:true});for(const asset of assets)await writeFile(resolve(publicDirectory,asset.filename),asset.data);}
  return {schema:'cssearth-prepared-ellipsoid-materials@1',assets,lenses};
}

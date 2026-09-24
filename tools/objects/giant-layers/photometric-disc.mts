import { sha256 } from '../../../src/platform/sha256.mts';
import {parse, object, string, dictionary, number, union} from '@cssearth/core/schema';
import {photometricRecipe, type PhotometricRecipe} from './photometric-contract.mts';
import type {MaterialAsset} from './material-contract.mts';
import type {OverlayOptions} from 'sharp';
export type ResolvedPhotometricRecipe = PhotometricRecipe & {minnaertChannels: number[]};
// The observed composite also names its source product, so an entry is a channel coefficient or that label.
const minnaertSource = object({photometricLaw:object({name:string}),mapComposite:dictionary(union(object({minnaertK:number}),string))});
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {verifyObservationSources} from '../observed-surfaces/index.mts';

const clamp=(value: number)=>Math.max(0,Math.min(1,value));
const round=(value: number,digits=6)=>Number(value.toFixed(digits));
const dot=(a: readonly number[],b: readonly number[])=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const normalize=(vector: readonly number[])=>{const length=Math.hypot(...vector)||1;return vector.map(value=>value/length);};
const ellipseBoundary=(rx: number,ry: number,dx: number,dy: number)=>1/Math.hypot(dx/rx,dy/ry);

/** Linear-light transfer for a retained source-over photometric overlay. */
export function encodeAttenuatedSrgb(channel: number,factor: number){
  const srgb=channel/255,linear=srgb<=0.04045?srgb/12.92:Math.pow((srgb+0.055)/1.055,2.4),lit=clamp(linear*factor);
  return Math.max(0,Math.min(255,Math.round((lit<=0.0031308?lit*12.92:1.055*Math.pow(lit,1/2.4)-0.055)*255)));
}

export function prepareNormalizedDiscProjection(config: PhotometricRecipe,pitchDegrees=config.scenePitchDegrees){
  const angle=pitchDegrees+config.systemRotationXDegrees,radians=angle*Math.PI/180,cosine=Math.cos(radians),sine=Math.sin(radians);
  const radiusX=config.shape.equatorialRadius,radiusY=Math.hypot(radiusX*cosine,config.shape.polarRadius*sine),rasterRadiusX=config.rasterSurfaceRadius,rasterRadiusY=rasterRadiusX*radiusY/radiusX;
  return{model:'prepared-oblate-ellipsoid-camera-projection',pitchDegrees,rotationXDegrees:round(angle),radiusX:round(radiusX),radiusY:round(radiusY),rasterRadiusX,rasterRadiusY:round(rasterRadiusY),rasterCoverageRadiusX:round(rasterRadiusX*config.presentationScale),rasterCoverageRadiusY:round(rasterRadiusY*config.presentationScale),presentationScale:config.presentationScale,materialScale:config.contentScale,right:[1,0,0],down:[0,round(cosine,12),round(-sine,12)],view:[0,round(sine,12),round(cosine,12)],runtime:false};
}

function projectedNormal(localX: number,localY: number,projection: ReturnType<typeof prepareNormalizedDiscProjection>,config: PhotometricRecipe){
  const rasterToScene=config.shape.equatorialRadius/config.rasterSurfaceRadius;
  let screenX=localX*rasterToScene/config.contentScale,screenY=localY*rasterToScene/config.contentScale;
  const screenRadius=Math.hypot(screenX,screenY),directionX=screenRadius===0?1:screenX/screenRadius,directionY=screenRadius===0?0:screenY/screenRadius;
  const boundary=ellipseBoundary(projection.radiusX,projection.radiusY,directionX,directionY);
  if(screenRadius>=boundary){const scale=boundary*(1-1e-9)/screenRadius;screenX*=scale;screenY*=scale;}
  const origin=[0,1,2].map(axis=>projection.right[axis]*screenX+projection.down[axis]*screenY);
  // This normalized-disc operator preserves reduction order at the grazing limb.
  // The other material operator intersects an unnormalized view raster instead.
  const equatorial=1/config.shape.equatorialRadius**2,polar=1/config.shape.polarRadius**2,weight=(axis: number)=>axis===2?polar:equatorial;
  const a=projection.view.reduce((sum,value,axis)=>sum+value*value*weight(axis),0),b=2*projection.view.reduce((sum,value,axis)=>sum+origin[axis]*value*weight(axis),0),c=origin.reduce((sum,value,axis)=>sum+value*value*weight(axis),-1);
  const depth=(-b+Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a),hit=origin.map((value,axis)=>value+projection.view[axis]*depth),normal=normalize(hit.map((value,axis)=>value*weight(axis)));
  return normalize([dot(normal,projection.right),dot(normal,projection.down),dot(normal,projection.view)]);
}

export function phaseLightDirection(z: number,reference: readonly number[]):[number,number,number]{const[x,y]=reference,scale=Math.sqrt(Math.max(0,1-z*z))/Math.hypot(x,y);return[x*scale,y*scale,z];}

export function rasterPhotometricDisc(config: ResolvedPhotometricRecipe,lightViewZ: number,{shadowless=false}: {shadowless?: boolean}={}){
  if(!Number.isFinite(lightViewZ)||lightViewZ<-1||lightViewZ>1)throw new TypeError('Light phase must be within [-1, 1].');
  const size=config.frameSize,center=size/2,data=Buffer.alloc(size*size*4),light=shadowless?[0,0,1]:phaseLightDirection(lightViewZ,config.referenceLightDirection),projection=prepareNormalizedDiscProjection(config);
  const[min,max]=config.terminatorSmoothstep;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const localX=x+0.5-center,localY=y+0.5-center,radius=Math.hypot(localX,localY),boundary=projection.rasterCoverageRadiusX;
    if(radius>boundary+0.5)continue;
    const normal=projectedNormal(localX,localY*projection.rasterRadiusY/projection.rasterRadiusX,projection,config);
    const incidence=Math.max(0,normal[0]*light[0]+normal[1]*light[1]+normal[2]*light[2]),emission=Math.max(Math.max(0,normal[2]),0.5/config.rasterSurfaceRadius),coverage=clamp(boundary-radius+0.5),amount=clamp((incidence-min)/(max-min)),terminator=amount*amount*(3-2*amount);
    const desired=config.minnaertChannels.map(k=>{const direct=Math.min(1,Math.pow(incidence,k)*Math.pow(emission,k-1)*terminator);return encodeAttenuatedSrgb(config.referenceChannel,clamp((config.ambientIntensity+direct)/(1+config.ambientIntensity)));});
    const alpha=clamp(1-Math.min(...desired)/config.referenceChannel);
    if(alpha===0||coverage===0)continue;
    const retainedBase=config.referenceChannel*(1-alpha),offset=(y*size+x)*4;
    for(let channel=0;channel<3;channel++)data[offset+channel]=Math.max(0,Math.min(255,Math.round((desired[channel]-retainedBase)/alpha)));
    data[offset+3]=Math.round(alpha*coverage*255);
  }
  return{data,width:size,height:size,lightViewZ,cameraLightDirection:light.map(value=>round(value)),projection};
}

export function parsePhotometricDiscRecipe(input: unknown){
  const config = parse(input, photometricRecipe, 'photometric disc recipe');
  const positive=(value: number)=>Number.isFinite(value)&&value>0;
  if(config?.schema!=='cssearth-photometric-disc@1'||!positive(config.frameSize)||!Number.isInteger(config.frameSize)||config.frameSize>4096||!positive(config.rasterSurfaceRadius)||!positive(config.shape?.equatorialRadius)||!positive(config.shape?.polarRadius)||!positive(config.presentationScale)||!positive(config.contentScale)||!positive(config.referenceChannel)||config.referenceChannel>255||!Number.isFinite(config.ambientIntensity)||config.ambientIntensity<0)throw new TypeError('Invalid photometric disc geometry.');
  if(![config.scenePitchDegrees,config.systemRotationXDegrees].every(Number.isFinite)||!Array.isArray(config.referenceLightDirection)||config.referenceLightDirection.length!==3||!config.referenceLightDirection.every(Number.isFinite)||Math.hypot(...config.referenceLightDirection.slice(0,2))===0)throw new TypeError('Invalid photometric disc reference frame.');
  if(!Number.isInteger(config.shapePrecisionDigits)||config.shapePrecisionDigits<0||config.shapePrecisionDigits>12)throw new TypeError('Invalid photometric shape precision.');
  if(!Array.isArray(config.terminatorSmoothstep)||config.terminatorSmoothstep.length!==2||!config.terminatorSmoothstep.every(Number.isFinite)||config.terminatorSmoothstep[1]<=config.terminatorSmoothstep[0]||!Array.isArray(config.minnaertSourceChannels)||config.minnaertSourceChannels.length!==3||typeof config.minnaertSource!=='string')throw new TypeError('Invalid photometry source recipe.');
  const bank=config.bank;if(!bank||![bank.frames,bank.framesPerRow,bank.columns,bank.maximumRetainedRows].every(value=>Number.isInteger(value)&&value>0)||bank.frames<2||!Number.isInteger(bank.gutter)||bank.gutter<0||!positive(config.pixelDensity)||!positive(config.presentationSize)||!config.rowOutput?.includes('{row}')||!config.shadowlessOutput||!Array.isArray(config.sources))throw new TypeError('Invalid photometric row recipe.');
  for(const filename of[config.rowOutput.replace('{row}','00'),config.shadowlessOutput])if(!/^[a-zA-Z0-9@_.-]+\.webp$/u.test(filename))throw new TypeError('Unsafe photometric output.');
  return config;
}

export async function resolvePhotometricDiscRecipe({sourceDirectory,config: input}: {sourceDirectory: string; config: unknown}){
  const config = parsePhotometricDiscRecipe(input);await verifyObservationSources(sourceDirectory,config.sources);
  if(!config.sources.some(source=>source.path===config.minnaertSource))throw new TypeError('Minnaert source is not pinned.');
  const source=parse(JSON.parse(await readFile(resolve(sourceDirectory,config.minnaertSource),'utf8')), minnaertSource, 'Minnaert source');
  if(source.photometricLaw?.name!=='Minnaert')throw new TypeError('Unsupported photometric law.');
  const minnaertChannels=config.minnaertSourceChannels.map(channel=>{const entry=source.mapComposite[channel];return typeof entry==='object'?entry.minnaertK:undefined;});
  if(!minnaertChannels.every((value): value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=2))throw new TypeError('Invalid observed Minnaert coefficients.');
  return{...config,minnaertChannels};
}

/** Generates transparent normalized-disc overlays, not replacement globe maps. */
export async function preparePhotometricDisc({sourceDirectory,publicDirectory,config: input,write=false}: {sourceDirectory: string; publicDirectory?: string; config: unknown; write?: boolean}){
  const config=await resolvePhotometricDiscRecipe({sourceDirectory,config:input});
  const outputDirectory=publicDirectory ?? '';
  if(write&&!publicDirectory)throw new TypeError('Photometric output directory is required for writing.');
  if(write)await mkdir(outputDirectory,{recursive:true});
  const{bank}=config,stride=config.frameSize+bank.gutter*2,rowCount=Math.ceil(bank.frames/bank.framesPerRow),assets:MaterialAsset[]=[],rows=[],presentations=[];
  const output=async(filename: string,data: Buffer,width: number,height: number)=>{const asset={filename,width,height,bytes:data.length,sha256:sha256(data),data};if(write)await writeFile(resolve(outputDirectory,filename),data);assets.push(asset);return asset;};
  for(let row=0;row<rowCount;row++){
    const first=row*bank.framesPerRow,count=Math.min(bank.framesPerRow,bank.frames-first),columns=Math.min(bank.columns,count),lines=Math.ceil(count/bank.columns),width=columns*stride,height=lines*stride,composites: OverlayOptions[]=[],filename=config.rowOutput.replace('{row}',String(row).padStart(2,'0'));
    for(let column=0;column<count;column++){
      const frame=first+column,lightViewZ=-1+2*frame/(bank.frames-1),prepared=rasterPhotometricDisc(config,lightViewZ),left=(column%bank.columns)*stride+bank.gutter,top=Math.floor(column/bank.columns)*stride+bank.gutter;
      composites.push({input:prepared.data,raw:{width:config.frameSize,height:config.frameSize,channels:4},left,top});
      presentations.push({frameIndex:frame,lightViewZ,rowIndex:row,url:`${config.urlPrefix}${filename}`,backgroundPosition:`${-left/config.pixelDensity}px ${-top/config.pixelDensity}px`,backgroundSize:`${width/config.pixelDensity}px ${height/config.pixelDensity}px`,cameraLightDirection:prepared.cameraLightDirection,projection:prepared.projection});
    }
    const bytes=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).webp(config.encoding).toBuffer();
    const asset=await output(filename,bytes,width,height);rows.push({rowIndex:row,url:`${config.urlPrefix}${filename}`,bytes:asset.bytes,sha256:asset.sha256,width,height,decodedRgbaBytes:width*height*4});
  }
  const frame=rasterPhotometricDisc(config,1,{shadowless:true}),data=await sharp(frame.data,{raw:{width:config.frameSize,height:config.frameSize,channels:4}}).webp(config.encoding).toBuffer(),fixed=await output(config.shadowlessOutput,data,config.frameSize,config.frameSize);
  const shadowless={url:`${config.urlPrefix}${fixed.filename}`,bytes:fixed.bytes,sha256:fixed.sha256,width:fixed.width,height:fixed.height,backgroundPosition:'0px 0px',backgroundSize:`${config.presentationSize}px ${config.presentationSize}px`,lightSpace:'prepared-view-aligned-shadowless-flood'};
  const defaultFrame=Math.round((config.referenceLightDirection[2]+1)/2*(bank.frames-1)),defaultRow=Math.floor(defaultFrame/bank.framesPerRow),initialWarmRows=[Math.max(0,defaultRow-1),defaultRow,Math.min(rowCount-1,defaultRow+1)].filter((value,index,array)=>array.indexOf(value)===index);
  return{config,assets,rows,presentations,shadowless,transport:{defaultFrame,defaultRow,initialWarmRows,maximumRetainedRowCount:bank.maximumRetainedRows,framesPerRow:bank.framesPerRow}};
}

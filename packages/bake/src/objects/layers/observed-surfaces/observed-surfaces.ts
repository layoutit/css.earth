import { isArray } from '@cssearth/core';
import {parse} from '@cssearth/core/schema';
import {observedRecipe, type Region, type ObservationTransform, type BoundaryContinuation, type FalseColor, type PixelPresence, type UniformCoverage, type DiscBaseline, type Calibration, type BrightTail, type PolarProjection, type RasterMap, type Baseline} from './contract.ts';
import type {SourcePin} from '../../geometry/index.ts';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { readFitsPrimary } from '@cssearth/fits';
import { planetographicRowsToMeshLatitude } from '../../geometry/index.ts';
import { packProjectiveSurfaceRaster } from '../../../scene/index.ts';
import { missingCoverageColor } from '../../../raster/index.ts';
import { resizeObservedRgb, sampleObservedRgb } from './coverage.ts';
import { measureScalarCoverage } from './scalar-coverage.ts';


const clamp = (value: number, low=0, high=1) => Math.max(low, Math.min(high,value));
const fixed = (value: number,digits: number) => Number(value.toFixed(digits));

/** Observed surfaces cap allocations at 64 Mi pixels and retain their restricted product naming convention. */
const OBSERVATION_RECIPE_POLICY = { maximumRasterPixels: 67108864, identifier: /^[a-z][a-z0-9-]*$/u,
  productFilename: /^[a-z0-9][a-z0-9-]*(?:@2x)?\.webp$/u };

export function parseObservedSurfaceRecipe(input: unknown) {
  const config = parse(input, observedRecipe, 'observed surface recipe');
  if(config?.schema!=='cssearth-observed-surfaces@2'||!isArray(config.sources)||!isArray(config.datasets)||!config.datasets.length)throw new TypeError('Invalid observed-surface recipe.');
  const sourcePaths=new Set(config.sources.map(source=>source.path)),ids=new Set(),outputs=new Set();
  /** Measurement magnitudes are positive; fractional coverage admits both endpoints. */
  const positive=(value: number)=>Number.isFinite(value)&&value>0;
  const fraction=(value: number)=>Number.isFinite(value)&&value>=0&&value<=1;
  const dimensions=(width: number,height: number)=>Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width*height<=OBSERVATION_RECIPE_POLICY.maximumRasterPixels;
  const operations=(items: readonly ObservationTransform[] | undefined)=>{for(const op of items??[]){if(!['flip','crop','resize','sharpen'].includes(op.kind))throw new TypeError('Unsupported observation transform.');if(op.kind==='resize'&&!dimensions(op.width,op.height))throw new TypeError('Invalid resize dimensions.');if(op.kind==='crop'&&(!op.region||!dimensions(op.region.width,op.region.height)||![op.region.left,op.region.top].every(v=>Number.isSafeInteger(v)&&v>=0)))throw new TypeError('Invalid crop dimensions.');if(op.kind==='sharpen'&&!positive(op.options?.sigma))throw new TypeError('Invalid sharpening radius.');}};
  for(const dataset of config.datasets){
    if(!OBSERVATION_RECIPE_POLICY.identifier.test(dataset.id)||ids.has(dataset.id)||!sourcePaths.has(dataset.source)||!dataset.decode)throw new TypeError('Invalid observation identity.');ids.add(dataset.id);
    if(!['raster','fits'].includes(dataset.decode.kind))throw new TypeError('Unsupported observation decoder.');
    if(dataset.decode.kind==='raster'&&![3,4].includes(dataset.decode.channels))throw new TypeError('Invalid raster channels.');
    if(dataset.decode.kind==='fits'){
      const color=dataset.decode.color;
      if(dataset.decode.bitpix!==-32||!dimensions(dataset.decode.width,dataset.decode.height)||!color||![3,4].includes(color.channels)||!isArray(color.palette)||color.palette.length!==3||color.palette.some(rgb=>!isArray(rgb)||rgb.length!==3||rgb.some(c=>!Number.isSafeInteger(c)||c<0||c>255))||!isArray(color.percentiles)||color.percentiles.length!==2||!color.percentiles.every(fraction)||color.percentiles[0]>=color.percentiles[1]||color.percentiles[1]===1||!['sqrt','power'].includes(color.transfer)||!positive(color.exponent)||!fraction(color.minimumCoverage))throw new TypeError('Invalid scientific color mapping.');
    }
    if(dataset.coverage?.kind==='component-fits'&&(dataset.decode.kind!=='raster'||dataset.decode.crop||dataset.calibration||dataset.coverage.sources.some(path=>!sourcePaths.has(path))))throw new TypeError('Component coverage requires an uncropped RGB map and declared FITS sources.');
    for(const continuation of[dataset.decode.continuation,dataset.coverage?.kind==='boundary-mean'?dataset.coverage:null])if(continuation&&(!positive(continuation.exponent)||!positive(continuation.boundaryFraction)||continuation.boundaryFraction>=1||!Number.isFinite(continuation.minimumBoundarySum ?? 0)))throw new TypeError('Invalid boundary continuation.');
    if(dataset.calibration&&(!sourcePaths.has(dataset.calibration.source)||(dataset.decode.kind !== 'raster' || dataset.decode.channels!==3)))throw new TypeError('Invalid true-color calibration input.');
    operations(dataset.transforms);
    if(!isArray(dataset.products)||!dataset.products.length)throw new TypeError('Observation has no products.');
    for(const product of dataset.products){
      if(!OBSERVATION_RECIPE_POLICY.productFilename.test(product.filename)||outputs.has(product.filename)||!['surface','poles','thumbnail'].includes(product.kind)||!product.encoding)throw new TypeError('Invalid observation product.');outputs.add(product.filename);operations(product.transforms);
      if(product.kind==='surface'&&(!Number.isSafeInteger(product.packing?.bandCount)||product.packing.bandCount<1||!Number.isFinite(product.packing.gutter)||product.packing.gutter<0))throw new TypeError('Invalid surface packing.');
      if(product.kind==='poles'){const p=product.projection;if(!p||!dimensions(p.tileSize,p.tileSize)||!isArray(p.poles)||!p.poles.length||p.poles.some(value=>!['north','south'].includes(value))||!positive(p.latitudeSegments)||!['nearest-closed','bilinear-wrapped'].includes(p.sampling)||!['direct-segment','boundary-difference','orthographic'].includes(p.angularMode))throw new TypeError('Invalid polar projection.');}
    }
  }
  return config;
}

/** Every observation is verified before any processing or output publication. */
export async function verifyObservationSources(directory: string, sources: readonly SourcePin[]) {
  const root=await realpath(directory), inputs=new Map();
  for(const source of sources) {
    if(!source.path || source.path.startsWith('/') || source.path.split(/[\\/]/u).includes('..')) throw new TypeError('Invalid observation source path.');
    const path=await realpath(resolve(root,source.path)), offset=relative(root,path);
    if(offset==='..'||offset.startsWith(`..${sep}`)||offset.startsWith(sep)) throw new TypeError('Observation source escapes its package.');
    const bytes=await readFile(path);
    inputs.set(source.path,bytes);
  }
  return inputs;
}

export function rgbMoments(source: Uint8Array,width: number,height: number,sample: Region) {
  if(sample.left<0||sample.top<0||sample.left+sample.width>width||sample.top+sample.height>height) throw new RangeError('Color sample is outside its observation.');
  const sum=[0,0,0],squaredSum=[0,0,0],count=sample.width*sample.height;
  for(let y=sample.top;y<sample.top+sample.height;y++) for(let x=sample.left;x<sample.left+sample.width;x++) for(let channel=0;channel<3;channel++) {
    const value=source[(y*width+x)*3+channel]; sum[channel]+=value;squaredSum[channel]+=value**2;
  }
  const mean=sum.map(value=>value/count),standardDeviation=squaredSum.map((value,channel)=>Math.sqrt(value/count-mean[channel]**2));
  if(standardDeviation.some(value=>!Number.isFinite(value)||value<=0)) throw new Error('Color sample variance drifted.');
  return {mean,standardDeviation};
}

export function affineColorCalibration(source: RasterMap,target: RasterMap,config: Calibration) {
  const sourceMoments=rgbMoments(source.data,source.width,source.height,config.sourceSample);
  const targetMoments=rgbMoments(target.data,target.width,target.height,{left:0,top:0,width:target.width,height:target.height});
  const scale=sourceMoments.standardDeviation.map((value,channel)=>targetMoments.standardDeviation[channel]/value);
  const offset=sourceMoments.mean.map((value,channel)=>targetMoments.mean[channel]-scale[channel]*value);
  return {model:'prepared-per-channel-affine-mean-standard-deviation-match',sourceSample:config.sourceSample,targetSample:config.targetSample,
    sourceMean:sourceMoments.mean.map(value=>fixed(value,6)),sourceStandardDeviation:sourceMoments.standardDeviation.map(value=>fixed(value,6)),
    targetMean:targetMoments.mean.map(value=>fixed(value,6)),targetStandardDeviation:targetMoments.standardDeviation.map(value=>fixed(value,6)),
    scale:scale.map(value=>fixed(value,9)),offset:offset.map(value=>fixed(value,9)),reference:config.reference,runtimeColorProcessing:false};
}

/** A declared high-latitude boundary fades only to its own longitudinal mean. */
export function continueBoundaryMean(data: Buffer, options: {width: number; height: number; channels: number} & BoundaryContinuation): Buffer;
export function continueBoundaryMean(data: Float32Array, options: {width: number; height: number; channels: number} & BoundaryContinuation): Float32Array<ArrayBuffer>;
export function continueBoundaryMean(data: Buffer | Float32Array,{width,height,channels,boundaryFraction,exponent,minimumBoundarySum=0}: {width: number; height: number; channels: number} & BoundaryContinuation): Buffer | Float32Array<ArrayBuffer> {
  const output=Buffer.isBuffer(data)?Buffer.from(data):new Float32Array(data),boundary=Math.round(height*boundaryFraction),means=[];
  for(let x=0;x<width;x++) {
    let sum=0;for(let c=0;c<channels;c++) sum+=data[(boundary*width+x)*channels+c];
    if(!Number.isFinite(sum)||sum<=minimumBoundarySum) throw new Error('Observation continuation boundary is not fully observed.');
  }
  for(let c=0;c<channels;c++) {let sum=0;for(let x=0;x<width;x++)sum+=data[(boundary*width+x)*channels+c];means.push(sum/width);}
  for(let y=0;y<boundary;y++) {const weight=Math.pow(y/boundary,exponent);for(let x=0;x<width;x++)for(let c=0;c<channels;c++) {
    const value=means[c]*(1-weight)+data[(boundary*width+x)*channels+c]*weight;
    output[(y*width+x)*channels+c]=Buffer.isBuffer(output)?Math.round(value):value;
  }}
  return output;
}

const presentPixel=(data: Uint8Array,offset: number,config: PixelPresence)=>config.alphaValidity?data[offset+3]>0:data[offset]+data[offset+1]+data[offset+2]>config.minimumBrightness;
export function observedMean(map: RasterMap,config: PixelPresence & {minimumCoverage: number}) {
  const totals=[0,0,0];let count=0;
  for(let offset=0;offset<map.data.length;offset+=map.channels) if(presentPixel(map.data,offset,config)) {for(let c=0;c<3;c++)totals[c]+=map.data[offset+c];count++;}
  if(count<map.width*map.height*config.minimumCoverage)throw new Error('Observed baseline coverage drifted.');
  return totals.map(total=>Math.round(total/count));
}

export function centralDiscBaseline(map: RasterMap,config: DiscBaseline) {
  const present=[];let minX=map.width,minY=map.height,maxX=-1,maxY=-1;
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
    const offset=(y*map.width+x)*map.channels;
    if(map.data[offset]+map.data[offset+1]+map.data[offset+2]<=config.minimumBrightness)continue;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);present.push([x,y,offset]);
  }
  if(present.length<map.width*map.height*config.minimumCoverage)throw new Error('Disc observation coverage drifted.');
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2,radiusX=(maxX-minX+1)/2,radiusY=(maxY-minY+1)/2,totals=[0,0,0];let sampleCount=0;
  for(const[x,y,offset]of present){if(Math.hypot((x-centerX)/radiusX,(y-centerY)/radiusY)>config.radiusFraction)continue;for(let c=0;c<3;c++)totals[c]+=map.data[offset+c];sampleCount++;}
  if(sampleCount<present.length*config.minimumSampleShare)throw new Error('Central disc sample drifted.');
  const color=totals.map(total=>Math.round(total/sampleCount));
  return {color,provenance:{...config.provenance,sampleCount,color}};
}

/** Sparse hemisphere observations are composed over an evidence-bound baseline. */
export function completeUniformCoverage(map: RasterMap,baseline: Baseline,config: UniformCoverage) {
  if(map.channels!==4||!isArray(baseline.color)||baseline.color.length!==3)throw new TypeError('Uniform coverage requires RGBA and an RGB baseline.');
  const {data,width,height,channels}=map,validRows=[];
  for(let y=0;y<height;y++){let valid=0;for(let x=0;x<width;x++)valid+=Number(presentPixel(data,(y*width+x)*channels,config));if(valid/width>config.minimumRowCoverage)validRows.push(y);}
  const detectedBoundaryRow=validRows.at(-1),boundaryRow=Math.min(detectedBoundaryRow ?? NaN,Math.floor((height-1)/2)-config.equatorialInsetRows);
  if(!Number.isSafeInteger(boundaryRow)||boundaryRow<height*config.allowedBoundaryRange[0]||boundaryRow>height*config.allowedBoundaryRange[1])throw new Error('Observed coverage boundary drifted.');
  const output=Buffer.from(data),transitionRows=config.transitionRows;let filledPixelCount=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=(y*width+x)*channels,present=presentPixel(output,offset,config);
    if(present&&y<=boundaryRow){const start=boundaryRow-transitionRows+1;if(y>=start){const weight=(boundaryRow-y+1)/(transitionRows+1);for(let c=0;c<3;c++)output[offset+c]=Math.round(baseline.color[c]*(1-weight)+output[offset+c]*weight);}output[offset+3]=255;continue;}
    output.set(baseline.color,offset);output[offset+3]=255;filledPixelCount++;
  }
  return {...map,data:output,coverage:{sourceWidth:width,sourceHeight:height,lastObservedRow:boundaryRow,detectedNonblackBoundaryRow:detectedBoundaryRow,filledPixelCount,
    compositionModel:'observed-map-over-authoritative-uniform-disc-baseline',baselineAuthority:baseline.provenance.authority,baselineModel:baseline.provenance.model,baselineColor:[...baseline.color],transitionRows,inventedLocalFeatures:false}};
}

export function percentileFalseColor(values: Float32Array,width: number,height: number,config: FalseColor): RasterMap {
  const finite=[...values].filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
  if(finite.length<width*height*config.minimumCoverage)throw new Error('Scalar observation is unexpectedly sparse.');
  const lower=finite[Math.floor(finite.length*config.percentiles[0])],upper=finite[Math.floor(finite.length*config.percentiles[1])];
  if(!Number.isFinite(lower)||upper<=lower)throw new Error('Scalar observation stretch is degenerate.');
  const data=Buffer.alloc(width*height*config.channels);
  for(let index=0;index<values.length;index++){
    const value=values[index],valid=Number.isFinite(value)&&(!config.positiveValidity||value>0);
    const normalized=valid?clamp((value-lower)/(upper-lower)):0;
    const amount=config.transfer==='sqrt'?Math.sqrt(normalized):Math.pow(normalized,config.exponent);
    const segment=amount<0.5?0:1,t=amount<0.5?amount*2:(amount-0.5)*2;
    for(let c=0;c<3;c++)data[index*config.channels+c]=Math.round(config.palette[segment][c]+(config.palette[segment+1][c]-config.palette[segment][c])*t);
    if(config.channels===4)data[index*4+3]=valid?255:0;
  }
  return {data,width,height,channels:config.channels,stretch:[lower,upper]};
}

export function brightTailColor(data: Uint8Array,{share,maximum,luminance}: BrightTail) {
  const histogram=new Uint32Array(256),pixelCount=data.length/3;
  const luma=(offset: number)=>Math.round(data[offset]*luminance[0]+data[offset+1]*luminance[1]+data[offset+2]*luminance[2]);
  for(let offset=0;offset<data.length;offset+=3)histogram[luma(offset)]++;
  let included=0,threshold=255;for(;threshold>0&&included<Math.ceil(pixelCount*share);threshold--)included+=histogram[threshold];
  const sums=[0,0,0];let count=0;for(let offset=0;offset<data.length;offset+=3){if(luma(offset)<=threshold)continue;for(let c=0;c<3;c++)sums[c]+=data[offset+c];count++;}
  if(!count)throw new Error('Atmosphere source has no bright samples.');
  const mean=sums.map(sum=>sum/count),peak=Math.max(...mean);return mean.map(channel=>Math.round(channel/peak*maximum));
}

function sampleMap(map: RasterMap,latitude: number,longitude: number,mode: PolarProjection['sampling']) {
  const {data,width,height,channels}=map;
  if(map.missing){
    const u=((longitude/(Math.PI*2))%1+1)%1, v=clamp((Math.PI/2-latitude)/Math.PI);
    const x=mode==='nearest-closed'?Math.round(u*(width-1)):u*width;
    const y=mode==='nearest-closed'?Math.round(v*(height-1)):v*(height-1);
    return sampleObservedRgb({data,info:{width,height,channels},missing:map.missing},x,y,true)
      ?? missingCoverageColor(u*360,latitude*180/Math.PI,180/height);
  }
  if(mode==='nearest-closed'){
    const u=(longitude+Math.PI*2)%(Math.PI*2),x=Math.round(u/(Math.PI*2)*(width-1)),y=Math.round((Math.PI/2-latitude)/Math.PI*(height-1));
    return [...data.subarray((y*width+x)*channels,(y*width+x)*channels+channels)];
  }
  const u=((longitude/(Math.PI*2))%1+1)%1,v=clamp((Math.PI/2-latitude)/Math.PI),x=u*width,y=v*(height-1),x0=Math.floor(x)%width,x1=(x0+1)%width,y0=Math.floor(y),y1=Math.min(height-1,y0+1),tx=x-Math.floor(x),ty=y-y0;
  return Array.from({length:channels},(_,c)=>{
    const a=data[(y0*width+x0)*channels+c],b=data[(y0*width+x1)*channels+c],d=data[(y1*width+x0)*channels+c],e=data[(y1*width+x1)*channels+c];
    const top=a+(b-a)*tx,bottom=d+(e-d)*tx;return Math.round(top+(bottom-top)*ty);
  });
}

export function polarDiscAtlas(map: RasterMap,config: PolarProjection): RasterMap {
  const tile=config.tileSize,output=Buffer.alloc(tile*config.poles.length*tile*4);
  for(const[index,pole]of config.poles.entries())for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
    const nx=(x+0.5)/tile*2-1,ny=(y+0.5)/tile*2-1,r=Math.hypot(nx,ny);if(r>1)continue;
    // Both angular expressions are authored arithmetic conventions, retained
    // because their rounding changes nearest/bilinear source texel selection.
    const extent=config.angularMode==='direct-segment'?Math.PI/config.latitudeSegments:Math.PI/2-(Math.PI/2-Math.PI/config.latitudeSegments);
    const polarLatitude=config.angularMode==='orthographic'?Math.acos(Math.min(1,r*Math.sin(extent))):Math.PI/2-r*extent;
    const latitude=pole==='north'?polarLatitude:-polarLatitude;
    const color=sampleMap(map,latitude,Math.atan2(ny,nx),config.sampling),offset=(y*tile*config.poles.length+index*tile+x)*4;
    output.set(color.slice(0,3),offset);output[offset+3]=color[3]??255;
  }
  return {data:output,width:tile*config.poles.length,height:tile,channels:4};
}

async function decodeRaster(bytes: Buffer | undefined,config: {channels: 3 | 4; crop?: Region}): Promise<RasterMap> {
  if (!bytes) throw new TypeError('Observation has no verified source.');
  let pipeline=sharp(bytes);if(config.crop)pipeline=pipeline.extract(config.crop);
  pipeline=config.channels===4?pipeline.ensureAlpha():pipeline.removeAlpha();
  const {data,info}=await pipeline.raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,channels:info.channels};
}

/** Intersect the three measured filters before resampling the publisher's RGB image.
 * The recipe names whether the longitude endpoint repeats. Reversal and the
 * declared offset put releases with different origins in the same body frame. */
function componentCoverage(map: RasterMap, config: Extract<NonNullable<ReturnType<typeof parseObservedSurfaceRecipe>['datasets'][number]['coverage']>,{kind:'component-fits'}>, inputs: Map<string,Buffer>) : RasterMap {
  const masks=config.sources.map(path=>{
    const bytes=inputs.get(path);if(!bytes)throw new Error(`Missing component coverage ${path}`);
    const scalar=readFitsPrimary(bytes);
    if(scalar.width!==map.width||scalar.height!==map.height)throw new Error('RGB component coverage dimensions differ.');
    return measureScalarCoverage(scalar,{noData:0,coverage:'polar-connected-zero',seedRows:config.unobservedRows.flatMap(([first,last])=>[first,last])}).missing;
  });
  const {width,height}=map,period=config.longitudePeriod,shift=config.longitudeOffsetDegrees/360*period;
  if(!Number.isInteger(shift)||!Number.isInteger(period)||![width,width-1].includes(period)||period<1)throw new Error('Map longitude offset must match the source grid.');
  for(const [first,last] of config.unobservedRows){
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<first||last>=height)throw new Error('Unobserved rows lie outside the source map.');
    for(const mask of masks)mask.fill(1,first*width,(last+1)*width);
  }
  const data=Buffer.alloc(width*height*4),missing=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=((config.reverseLongitude?period-x:x)+shift+period)%period,from=y*width+sx,to=y*width+x;
    missing[to]=Number(masks.some(mask=>mask[from]));
    if(!missing[to]){data.set(map.data.subarray(from*map.channels,from*map.channels+3),to*4);data[to*4+3]=255;}
  }
  if(!missing.includes(0))throw new Error('RGB map has no common observed coverage.');
  return {...map,data,channels:4,missing};
}
async function transformMap(map: RasterMap,operations?: readonly ObservationTransform[]): Promise<RasterMap> {
  if(!operations?.length)return map;
  if(map.missing){
    let result=map;
    for(const op of operations){
      if(op.kind!=='resize'||op.options&&op.options.fit!=='fill')throw new TypeError('Covered maps support only full-map resize operations.');
      const resized=resizeObservedRgb({data:result.data,info:result,missing:result.missing!},op.width,op.height);
      result={...result,...resized.info,data:resized.data,missing:resized.missing};
    }
    return result;
  }
  let pipeline=sharp(map.data,{raw:{width:map.width,height:map.height,channels:map.channels}});
  for(const op of operations){if(op.kind==='flip')pipeline=pipeline.flip();else if(op.kind==='crop')pipeline=pipeline.extract(op.region);else if(op.kind==='resize')pipeline=pipeline.resize(op.width,op.height,op.options??{kernel:sharp.kernel.lanczos3});else if(op.kind==='sharpen')pipeline=pipeline.sharpen(op.options);else throw new TypeError('Unsupported observation transform.');}
  const {data,info}=await pipeline.raw().toBuffer({resolveWithObject:true});return {...map,data,width:info.width,height:info.height,channels:info.channels};
}

/** A same-aspect resize contributes no geographic operation to a polar projection. */
function retainsNativePoleCoordinates(map: RasterMap,operations?: readonly ObservationTransform[]) {
  return !!operations?.length&&operations.every(operation=>operation.kind==='resize'
    &&(operation.options?.fit===undefined||operation.options.fit==='fill')
    &&!operation.options?.withoutEnlargement
    &&operation.width*map.height===operation.height*map.width);
}

export async function prepareObservedSurfaces({sourceDirectory,publicDirectory,config: input,write=false,datasetIds,productKinds}: {sourceDirectory: string; publicDirectory?: string; config: unknown; write?: boolean;datasetIds?:readonly string[];productKinds?:readonly ('surface'|'poles'|'thumbnail')[]}) {
  const config = parseObservedSurfaceRecipe(input);
  if(datasetIds&&(!datasetIds.length||new Set(datasetIds).size!==datasetIds.length))throw new TypeError('Observed surface selection requires distinct dataset ids.');
  if(productKinds&&(!productKinds.length||new Set(productKinds).size!==productKinds.length))throw new TypeError('Observed surface selection requires distinct product kinds.');
  const datasets=datasetIds?config.datasets.filter(dataset=>datasetIds.includes(dataset.id)):config.datasets;
  if(datasetIds&&datasets.length!==datasetIds.length)throw new Error('Observed surface selection requested an unknown dataset.');
  const baselineIds=new Set(datasets.flatMap(dataset=>dataset.coverage?.kind==='uniform-baseline'&&dataset.coverage.baseline?[dataset.coverage.baseline]:[])),baselinesToPrepare=(config.baselines??[]).filter(recipe=>baselineIds.has(recipe.id));
  if(baselineIds.size!==baselinesToPrepare.length)throw new Error('Observed surface selection requested an unknown baseline.');
  const sourcePaths=new Set([...datasets.flatMap(dataset=>[dataset.source,...(dataset.calibration?[dataset.calibration.source]:[]),...(dataset.coverage?.kind==='component-fits'?dataset.coverage.sources:[])]),...baselinesToPrepare.map(recipe=>recipe.source)]);
  const inputs=await verifyObservationSources(sourceDirectory,datasetIds?config.sources.filter(source=>sourcePaths.has(source.path)):config.sources),baselines=new Map<string, Baseline>(),maps=new Map<string, RasterMap>(),assets=[];
  for(const recipe of baselinesToPrepare){const map=await decodeRaster(inputs.get(recipe.source),{channels:3});baselines.set(recipe.id,centralDiscBaseline(map,recipe));}
  for(const dataset of datasets){
    if(!inputs.has(dataset.source))throw new TypeError('Observation has no verified source.');
    let map: RasterMap;
    if(dataset.decode.kind==='raster')map=await decodeRaster(inputs.get(dataset.source),dataset.decode);
    else if(dataset.decode.kind==='fits'){
      const fits=readFitsPrimary(inputs.get(dataset.source));if(fits.bitpix!==dataset.decode.bitpix||fits.width!==dataset.decode.width||fits.height!==dataset.decode.height)throw new Error('Observed FITS geometry drifted.');
      let values=new Float32Array(fits.values);if(dataset.decode.continuation)values=continueBoundaryMean(values,{width:fits.width,height:fits.height,channels:1,...dataset.decode.continuation});
      map=percentileFalseColor(values,fits.width,fits.height,dataset.decode.color);
    }else throw new TypeError('Unsupported observation decoder.');
    if(dataset.coverage?.kind==='component-fits')map=componentCoverage(map,dataset.coverage,inputs);
    let calibration;
    if(dataset.calibration){const target=await decodeRaster(inputs.get(dataset.calibration.source),{crop:dataset.calibration.targetSample,channels:3});calibration=affineColorCalibration(map,target,dataset.calibration);}
    if(dataset.coverage?.kind==='boundary-mean')map={...map,data:continueBoundaryMean(map.data,{...map,...dataset.coverage})};
    if(dataset.coverage?.kind==='uniform-baseline'){
      if (!dataset.coverage.baseline && !dataset.coverage.baselineProvenance) throw new TypeError('Observation baseline provenance is missing.');
      const baseline=dataset.coverage.baseline?baselines.get(dataset.coverage.baseline):{color:observedMean(map,dataset.coverage),provenance:dataset.coverage.baselineProvenance};
      if(!baseline || !baseline.provenance)throw new TypeError('Observation baseline is undefined.');map=completeUniformCoverage(map,{color:baseline.color,provenance:baseline.provenance},dataset.coverage);
    }
    if(calibration){const data=Buffer.allocUnsafe(map.data.length);for(let offset=0;offset<data.length;offset+=3)for(let c=0;c<3;c++)data[offset+c]=Math.round(clamp(map.data[offset+c]*calibration.scale[c]+calibration.offset[c],0,255));map={...map,data,calibration};}
    // Maps indexed by planetographic latitude move to the parametric rows of the drawn ellipsoid.
    if(dataset.planetographicAxisRatio!==undefined)map={...map,data:planetographicRowsToMeshLatitude(map.data,map.width,map.height,map.channels,dataset.planetographicAxisRatio)};
    if(map.missing)map.missing=Uint8Array.from({length:map.width*map.height},(_,i)=>map.data[i*4+3]===255?0:1);
    const nativePoleMap=map,transformedMap=await transformMap(map,dataset.transforms);
    if(dataset.atmosphereColor)transformedMap.atmosphereColor=brightTailColor(transformedMap.data,dataset.atmosphereColor);maps.set(dataset.id,transformedMap);
    for(const product of productKinds?dataset.products.filter(product=>productKinds.includes(product.kind)):dataset.products){
      if(!OBSERVATION_RECIPE_POLICY.productFilename.test(product.filename))throw new TypeError('Invalid observation output name.');
      const productMap=product.kind==='poles'&&retainsNativePoleCoordinates(nativePoleMap,dataset.transforms)?nativePoleMap:transformedMap;
      let raster=await transformMap(productMap,product.transforms);
      if(product.kind==='surface'){const packed=packProjectiveSurfaceRaster(raster.data,{width:raster.width,height:raster.height,channels:raster.channels,...product.packing});raster={data:packed.data,width:packed.packedWidth,height:packed.packedHeight,channels:raster.channels};}
      else if(product.kind==='poles')raster=polarDiscAtlas(raster,product.projection);
      else if(product.kind!=='thumbnail')throw new TypeError('Unsupported observation product.');
      let pipeline=sharp(raster.data,{raw:{width:raster.width,height:raster.height,channels:raster.channels}});if(product.removeAlpha)pipeline=pipeline.removeAlpha();
      const bytes=await pipeline.webp(product.encoding).toBuffer();assets.push({filename:product.filename,width:raster.width,height:raster.height,bytes:bytes.length,data:bytes});
    }
  }
  if(write){if(!publicDirectory)throw new TypeError('Observation output directory is required for writing.');await mkdir(publicDirectory,{recursive:true});for(const asset of assets)await writeFile(resolve(publicDirectory,asset.filename),asset.data);}
  return {schema:'cssearth-prepared-observed-surfaces@1',maps,baselines,assets};
}

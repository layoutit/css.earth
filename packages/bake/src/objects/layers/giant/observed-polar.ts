import type {Channels} from 'sharp';
import type { ObservedRgb } from './polar-dome.ts';
import { parseObservedPolarSource } from './polar-source-contract.ts';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {packProjectiveSurfaceRaster} from '../../../scene/index.ts';
import {planetographicRowsToMeshLatitude} from '../../geometry/index.ts';
import { readFitsPrimary } from '@cssearth/fits';
import {verifyObservationSources} from '../observed-surfaces/index.ts';
import { latitudeRasterBands } from './geometry.ts';
import { compositePolarOverlay, layoutPolarAtlasForCaps, writeDomeRings, type DomeRingWarp, type PoleProjection } from './polar-dome.ts';
import { validateRelativePath } from './relative-path.ts';
import {measureScalarCoverage,finitePercentiles,falseColorMap} from '../observed-surfaces/index.ts';
import {resizeObservedRgb,prepareMeasuredPolarAtlas} from '../observed-surfaces/index.ts';

export function parseObservedPolarRecipe(input: unknown) {
  const config=parseObservedPolarSource(input);
  if(config?.schema!=='cssearth-observed-polar-surfaces@2'||!/^[a-z][a-z0-9-]*$/.test(config.namespace)||typeof config.publicPrefix!=='string'||!/^\/[a-z0-9/-]+\/$/.test(config.publicPrefix))throw new TypeError('Invalid observed polar recipe.');
  if(!Array.isArray(config.datasets)||!config.datasets.length)throw new TypeError('Observed polar datasets must be declared.');
  const finite=(value: unknown)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('Observed polar parameters must be finite.');if(value&&typeof value==='object')Object.values(value).forEach(finite);};finite(config);
  for(const value of Object.values(config.dimensions))if(!Number.isSafeInteger(value)||value<16)throw new TypeError('Invalid observed polar raster dimensions.');
  latitudeRasterBands(config.packing.latitudeBoundsDegrees,config.dimensions.height);
  const ids=new Set(),outputs=new Set(),sourcePaths=new Set<string>();
  const source=(path: string)=>{validateRelativePath(path);sourcePaths.add(path);};
  for(const dataset of config.datasets) {
    if(!/^[a-z][a-z0-9-]*$/.test(dataset.id)||ids.has(dataset.id))throw new TypeError('Invalid observed polar dataset operation.');
    ids.add(dataset.id);source(dataset.source);
    for(const filename of Object.values(dataset.files)){validateRelativePath(filename);if(outputs.has(filename))throw new TypeError('Observed polar outputs must be unique.');outputs.add(filename);}
    if(dataset.operation==='rgb-measured-rows'&&(!Number.isInteger(dataset.coverage.columnStride)||dataset.coverage.columnStride<1))throw new TypeError('Invalid observed RGB coverage stride.');
    if(dataset.operation==='rgb-observed-gaps'){
      if(dataset.coverageSources.length!==3||!(dataset.planetographicAxisRatio>=1))throw new TypeError('RGB maps require three component coverage maps and an ellipsoid ratio.');
      dataset.coverageSources.forEach(source);
    }
    if(dataset.operation==='scalar-observed-gaps'&&(!Array.isArray(dataset.palette)||dataset.palette.length<2||dataset.scalar.range&&!(dataset.scalar.range[1]>dataset.scalar.range[0])))throw new TypeError('Invalid measured scalar parameters.');
  }
  return {...config,sourcePins:[...sourcePaths].map(path=>({path}))};
}

/** The projection every dataset's pole tiles share (see PoleProjection). A dome shows every dataset through the same rings and cap,
 * so the datasets must agree; each is latitude-linear from the pole to its edge. */
export function polarImageProjection(config: unknown): PoleProjection {
  const recipe=parseObservedPolarRecipe(config);
  const projections=recipe.datasets.map(dataset=>{
    if((dataset.projection.projection??'latitude-linear')!=='latitude-linear')throw new TypeError(`${recipe.namespace} dataset ${dataset.id}: pole tiles in the ${dataset.projection.projection} projection cannot share a dome with latitude-linear ones.`);
    return{id:dataset.id,edgeLatitudeDegrees:dataset.projection.boundaryLatitudeDegrees,scale:dataset.projection.overlap??1.035};
  });
  const [first]=projections;
  if(!first)throw new TypeError(`${recipe.namespace}: no dataset declares pole tiles.`);
  for(const projection of projections)if(projection.edgeLatitudeDegrees!==first.edgeLatitudeDegrees||projection.scale!==first.scale)
    throw new TypeError(`${recipe.namespace} dataset ${projection.id}: pole tiles at edge ${projection.edgeLatitudeDegrees}° and scale ${projection.scale} differ from dataset ${first.id}'s (${first.edgeLatitudeDegrees}°, ${first.scale}).`);
  return{edgeLatitudeDegrees:first.edgeLatitudeDegrees,scale:first.scale};
}

/** Observed RGB/scalar maps, projective band packing, and source-structured poles.
 * The original observations are the only input; encoded surfaces are consumed
 * directly in memory for their matching thumbnail. With a dome (`@cssearth/bake/objects/layers/giant`, geometry.ts domeRingWarp), the pole imagery is
 * composited into the map poleward of its edge, each dome ring's packed rows are written for its leaves, and the pole atlas
 * is laid out for the caps. */
export async function prepareObservedPolarSurfaces({sourceDirectory,publicDirectory,config,write=false,dome}: {sourceDirectory: string; publicDirectory: string; config: unknown; write?: boolean; dome?: DomeRingWarp}) {
  const recipe=parseObservedPolarRecipe(config);
  const poleProjection=dome?.length?polarImageProjection(config):null;
  const sources=await verifyObservationSources(sourceDirectory,recipe.sourcePins);
  if(write)await mkdir(publicDirectory,{recursive:true});
  const assets: {filename: string; data: Buffer; bytes: number; width: number; height: number}[]=[],
    maps=new Map<string, {data: Uint8Array; width: number; height: number; channels: number}>(),
    coverage: Record<string, Record<string, unknown>>={},controls=[];
  const {width,height,polarTileSize}=recipe.dimensions;
  const add=async(filename: string,data: Buffer)=>{
    const info=await sharp(data).metadata();
    if (!info.width || !info.height) throw new Error(`Observed asset has no dimensions: ${filename}`);
    const asset={filename,data,bytes:data.length,width:info.width,height:info.height};assets.push(asset);
    if(write)await writeFile(resolve(publicDirectory,filename),data);
    return asset;
  };
  const pack=async (source: ObservedRgb,rings?: DomeRingWarp,lossless=false)=>{
    const {width,height}=source.info, channels=requireChannels(source.info.channels);
    if (!Buffer.isBuffer(source.data)) throw new TypeError('Projective raster packing requires a byte buffer.');
    const packed=packProjectiveSurfaceRaster(source.data,{width,height,channels,bands:latitudeRasterBands(recipe.packing.latitudeBoundsDegrees,height),gutter:recipe.packing.gutter*height/recipe.dimensions.height});
    if(rings?.length)writeDomeRings(packed,source,rings,recipe.packing.latitudeBoundsDegrees);
    return sharp(packed.data,{raw:{width:packed.packedWidth,height:packed.packedHeight,channels}}).webp({...recipe.encoding.surface,...(lossless?{lossless:true}:{})}).toBuffer();
  };
  for(const dataset of recipe.datasets) {
    let source1x: ObservedRgb,source2x: ObservedRgb;
    let polar: ReturnType<typeof prepareMeasuredPolarAtlas>;
    let sourceRange: [number,number] | undefined;
    let measured: {firstMeasuredRow: number; lastMeasuredRow: number; sourceMissingPixels?: number};
    const bytes=requireSource(sources,dataset.source);
    if(dataset.operation==='rgb-measured-rows') {
      // The map's own rows are all it shows: a row outside the pinned measured range is missing, and nothing is drawn into it.
      const image=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      measured=measureRgbCoverage(image,dataset.coverage);
      const pixels=image.info.width*image.info.height,data=Buffer.alloc(pixels*4),missing=new Uint8Array(pixels).fill(1);
      for(let row=measured.firstMeasuredRow;row<=measured.lastMeasuredRow;row++)for(let column=0;column<image.info.width;column++){
        const i=row*image.info.width+column;
        data.set(image.data.subarray(i*image.info.channels,i*image.info.channels+3),i*4);data[i*4+3]=255;missing[i]=0;
      }
      const original={data,info:{width:image.info.width,height:image.info.height,channels:4},missing};
      source1x=resizeObservedRgb(original,width,height);source2x=resizeObservedRgb(original,width*2,height*2);
      measured={...measured,sourceMissingPixels:missing.reduce((sum,n)=>sum+n,0)};
      polar=prepareMeasuredPolarAtlas(original,polarTileSize*2,{projection:'latitude-linear',...dataset.projection});
    } else if(dataset.operation==='rgb-observed-gaps') {
      const image=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const masks=dataset.coverageSources.map(path=>{
        const scalar=readFitsPrimary(requireSource(sources,path));
        if(scalar.width!==image.info.width||scalar.height!==image.info.height)throw new Error('RGB component coverage dimensions differ.');
        return measureScalarCoverage(scalar,{noData:0,coverage:'polar-connected-zero'}).missing;
      });
      const rgba=Buffer.alloc(image.info.width*image.info.height*4);
      for(let i=0;i<masks[0].length;i++)if(masks.every(mask=>!mask[i])){
        rgba.set(image.data.subarray(i*image.info.channels,i*image.info.channels+3),i*4);rgba[i*4+3]=255;
      }
      const data=planetographicRowsToMeshLatitude(rgba,image.info.width,image.info.height,4,dataset.planetographicAxisRatio);
      const missing=Uint8Array.from({length:masks[0].length},(_,i)=>data[i*4+3]===255?0:1);
      if(!missing.includes(0))throw new Error('RGB map has no common observed coverage.');
      const original={data,info:{width:image.info.width,height:image.info.height,channels:4},missing};
      source1x=resizeObservedRgb(original,width,height);source2x=resizeObservedRgb(original,width*2,height*2);
      measured={firstMeasuredRow:Math.floor(missing.indexOf(0)/image.info.width),lastMeasuredRow:Math.floor(missing.lastIndexOf(0)/image.info.width),sourceMissingPixels:missing.reduce((sum,n)=>sum+n,0)};
      polar=prepareMeasuredPolarAtlas(original,polarTileSize*2,{projection:'latitude-linear',...dataset.projection});
    } else {
      const scalar=readFitsPrimary(bytes);
      if(scalar.bitpix!==dataset.scalar.bitpix||scalar.width!==dataset.scalar.width||scalar.height!==dataset.scalar.height)throw new Error('Pinned scalar polar dimensions changed.');
      const measuredSource=measureScalarCoverage(scalar,dataset.scalar);
      sourceRange=dataset.scalar.range??finitePercentiles(measuredSource.values,...dataset.scalar.percentiles,dataset.scalar.minimumCoverageFraction,measuredSource.missing);
      if(!(sourceRange[1]>sourceRange[0]))throw new Error('Scalar observation has no measured dynamic range.');
      const original={data:falseColorMap(measuredSource,dataset.palette,...sourceRange,dataset.scalar.gamma),info:{width:scalar.width,height:scalar.height,channels:4},missing:measuredSource.missing};
      source2x=resizeObservedRgb(original,width*2,height*2);
      source1x=resizeObservedRgb(original,width,height);
      measured={firstMeasuredRow:measuredSource.firstMeasuredRow,lastMeasuredRow:measuredSource.lastMeasuredRow,sourceMissingPixels:measuredSource.sourceMissingPixels};
      polar=prepareMeasuredPolarAtlas(original,polarTileSize*2,{projection:'latitude-linear',...dataset.projection});
    }
    if(poleProjection){
      source2x=compositePolarOverlay(source2x,polar,poleProjection);source1x=compositePolarOverlay(source1x,polar,poleProjection);
      polar={...polar,data:layoutPolarAtlasForCaps(polar)};
    }
    maps.set(dataset.id,{data:source2x.data,...source2x.info});
    coverage[dataset.id]={...measured,...Object.fromEntries(Object.entries(polar).filter(([key])=>key!=='data'))};
    const lossless=dataset.operation==='scalar-observed-gaps'&&dataset.scalar.lossless===true;
    const surface=await add(dataset.files.surface,await pack(source1x,dome,lossless)),surface2x=await add(dataset.files.surface2x,await pack(source2x,dome,lossless));
    const raw={width:polar.width,height:polar.height,channels:4 as const};
    const poles=await add(dataset.files.poles,await sharp(polar.data,{raw}).resize(polarTileSize*2,polarTileSize).webp({...recipe.encoding.polar,...(lossless?{lossless:true}:{})}).toBuffer());
    const poles2x=await add(dataset.files.poles2x,await sharp(polar.data,{raw}).webp({...recipe.encoding.polar,...(lossless?{lossless:true}:{})}).toBuffer());
    const thumbnail=await add(dataset.files.thumbnail,await sharp(surface.data).resize(recipe.thumbnail.width,recipe.thumbnail.height,{fit:recipe.thumbnail.fit,position:recipe.thumbnail.position}).webp({...recipe.encoding.thumbnail,...(lossless?{lossless:true}:{})}).toBuffer());
    if(dataset.operation!=='scalar-observed-gaps'){controls.push(dataset.control);continue;}
    if(!sourceRange) throw new Error('Scalar observation requires its measured range.');
    controls.push({id:dataset.id,label:dataset.label,shortLabel:dataset.shortLabel,filter:dataset.filter,wavelength:dataset.wavelength,measurement:dataset.measurement,
      thumbnailUrl:recipe.publicPrefix+dataset.files.thumbnail,surfaceUrl:recipe.publicPrefix+dataset.files.surface,surface2xUrl:recipe.publicPrefix+dataset.files.surface2x,polesUrl:recipe.publicPrefix+dataset.files.poles,poles2xUrl:recipe.publicPrefix+dataset.files.poles2x,falseColor:true,qualification:dataset.qualification,
      coveragePreparation:{model:polar.model,...measured,projectionEdgeLatitudeDegrees:polar.measuredProjectionEdgeLatitudeDegrees,bodyLatitudeBoundsDegrees:recipe.packing.latitudeBoundsDegrees,unmeasuredCoreRadius:('unmeasuredCoreRadius' in polar ? polar.unmeasuredCoreRadius : undefined),polarProjectionAngularSamples:('polarProjectionAngularSamples' in polar ? polar.polarProjectionAngularSamples : undefined),unmeasuredCoreHarmonicOrder:('unmeasuredCoreHarmonicOrder' in polar ? polar.unmeasuredCoreHarmonicOrder : undefined),detailedPoles:polar.detailedPoles,structuralAuthority:dataset.structuralAuthority,structuralDetailMeasurement:false,spectralColorAuthority:dataset.measurement,runtimeCoverageRepair:false},
      sourceFile:dataset.source,sourceRange:sourceRange.map(value=>Number(value.toPrecision(8)))});
  }
  return {assets,maps,coverage,datasets:{...recipe.descriptor,controls}};
}

export function measureRgbCoverage(source: ObservedRgb,config: {columnStride: number; minimumMean: number; firstMeasuredRow: number; lastMeasuredRow: number}) {
  const {width,height,channels}=source.info;
  if(!Number.isSafeInteger(config.columnStride)||config.columnStride<1||!Number.isFinite(config.minimumMean))throw new TypeError('Invalid RGB coverage sampling.');
  const mean=(row: number)=>{let sum=0,count=0;for(let column=0;column<width;column+=config.columnStride){const offset=(row*width+column)*channels;sum+=source.data[offset]+source.data[offset+1]+source.data[offset+2];count+=3;}return sum/count;};
  let firstMeasuredRow=0,lastMeasuredRow=height-1;
  while(firstMeasuredRow<height&&mean(firstMeasuredRow)<=config.minimumMean)firstMeasuredRow++;
  while(lastMeasuredRow>=0&&mean(lastMeasuredRow)<=config.minimumMean)lastMeasuredRow--;
  if(firstMeasuredRow!==config.firstMeasuredRow||lastMeasuredRow!==config.lastMeasuredRow)throw new Error('Pinned RGB polar coverage changed.');
  return {firstMeasuredRow,lastMeasuredRow};
}

function requireSource(sources: ReadonlyMap<string, Buffer>, path: string): Buffer {
  const bytes=sources.get(path); if (!bytes) throw new Error(`Missing verified observation: ${path}`); return bytes;
}
function requireChannels(channels: number): Channels {
  if (channels !== 1 && channels !== 2 && channels !== 3 && channels !== 4) throw new TypeError('Invalid observed raster channels.');
  return channels;
}

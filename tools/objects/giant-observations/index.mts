import { sha256 } from '@cssearth/core/node';
import type {Channels} from 'sharp';
import type {ObservedRgb, PolarDetails} from './polar-continuation.mts';
import type {DetailImage} from './source-contract.mts';
import {parseObservedPolarSource} from './source-contract.mts';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {packProjectiveSurfaceRaster} from '@cssearth/bake/scene';
import { readFitsPrimary } from '@cssearth/fits';
import {verifyObservationSources} from '../observed-surfaces/index.mts';
import {latitudeRasterBands} from '../giant-layers/geometry.mts';
import {validateRelativePath} from '../material-composition/recipe.mts';
import {preparePolarContinuationAtlas,preparePolarSurfaceTransition} from './polar-continuation.mts';
import {measureScalarCoverage,finitePercentiles,falseColorMap} from './scalar-coverage.mts';
import {resizeObservedRgb,prepareMeasuredPolarAtlas} from '../observed-coverage.mts';
import {compositePolarOverlay,layoutPolarAtlasForCaps,writeDomeRings,type DomeRingWarp,type PoleProjection} from './polar-dome.mts';

export function parseObservedPolarRecipe(input: unknown) {
  const config=parseObservedPolarSource(input);
  if(config?.schema!=='cssearth-observed-polar-surfaces@1'||!/^[a-z][a-z0-9-]*$/.test(config.namespace)||typeof config.publicPrefix!=='string'||!/^\/[a-z0-9/-]+\/$/.test(config.publicPrefix))throw new TypeError('Invalid observed polar recipe.');
  if(!Array.isArray(config.lenses)||!config.lenses.length)throw new TypeError('Observed polar lenses must be declared.');
  const finite=(value: unknown)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('Observed polar parameters must be finite.');if(value&&typeof value==='object')Object.values(value).forEach(finite);};finite(config);
  for(const value of Object.values(config.dimensions))if(!Number.isSafeInteger(value)||value<16)throw new TypeError('Invalid observed polar raster dimensions.');
  latitudeRasterBands(config.packing.latitudeBoundsDegrees,config.dimensions.height);
  const ids=new Set(),outputs=new Set(),sourcePaths=new Set<string>();
  const source=(path: string)=>{validateRelativePath(path);sourcePaths.add(path);};
  for(const lens of config.lenses) {
    if(!/^[a-z][a-z0-9-]*$/.test(lens.id)||ids.has(lens.id)||!['rgb-polar-structure','scalar-observed-gaps'].includes(lens.operation))throw new TypeError('Invalid observed polar lens operation.');
    ids.add(lens.id);source(lens.source);
    for(const filename of Object.values(lens.files)){validateRelativePath(filename);if(outputs.has(filename))throw new TypeError('Observed polar outputs must be unique.');outputs.add(filename);}
    for(const detail of Object.values(lens.polarDetails??{})){source(detail.structure.path);if(detail.palette)source(detail.palette.path);}
    if(lens.operation==='rgb-polar-structure'&&(!Number.isInteger(lens.coverage.columnStride)||lens.coverage.columnStride<1))throw new TypeError('Invalid observed RGB coverage stride.');
    if(lens.operation==='scalar-observed-gaps'&&(!Array.isArray(lens.palette)||lens.palette.length<2||lens.scalar.noData!==0||lens.scalar.coverage!=='polar-connected-zero'||Object.keys(lens.polarDetails??{}).length>0))throw new TypeError('Invalid measured scalar parameters.');
  }
  return {...config,sourcePins:[...sourcePaths].map(path=>({path}))};
}

/** The projection every lens's pole tiles share (see PoleProjection). A dome shows every lens through the same rings and cap,
 * so the lenses must agree; each is latitude-linear from the pole to its edge. */
export function polarImageProjection(config: unknown): PoleProjection {
  const recipe=parseObservedPolarRecipe(config);
  const projections=recipe.lenses.map(lens=>{
    if(lens.operation==='rgb-polar-structure')return{id:lens.id,edgeLatitudeDegrees:lens.continuation.measuredProjectionEdgeLatitudeDegrees??lens.continuation.edgeLatitudeDegrees,scale:lens.continuation.overlap??1.035};
    if((lens.projection.projection??'latitude-linear')!=='latitude-linear')throw new TypeError(`${recipe.namespace} lens ${lens.id}: pole tiles in the ${lens.projection.projection} projection cannot share a dome with latitude-linear ones.`);
    return{id:lens.id,edgeLatitudeDegrees:lens.projection.boundaryLatitudeDegrees,scale:lens.projection.overlap??1.035};
  });
  const [first]=projections;
  if(!first)throw new TypeError(`${recipe.namespace}: no lens declares pole tiles.`);
  for(const projection of projections)if(projection.edgeLatitudeDegrees!==first.edgeLatitudeDegrees||projection.scale!==first.scale)
    throw new TypeError(`${recipe.namespace} lens ${projection.id}: pole tiles at edge ${projection.edgeLatitudeDegrees}° and scale ${projection.scale} differ from lens ${first.id}'s (${first.edgeLatitudeDegrees}°, ${first.scale}).`);
  return{edgeLatitudeDegrees:first.edgeLatitudeDegrees,scale:first.scale};
}

/** Observed RGB/scalar maps, projective band packing, and source-structured poles.
 * The original observations are the only input; encoded surfaces are consumed
 * directly in memory for their matching thumbnail. With a dome (giant-layers/geometry.mts domeRingWarp), the pole imagery is
 * composited into the map poleward of its edge, each dome ring's packed rows are written for its leaves, and the pole atlas
 * is laid out for the caps. */
export async function prepareObservedPolarSurfaces({sourceDirectory,publicDirectory,config,write=false,dome}: {sourceDirectory: string; publicDirectory: string; config: unknown; write?: boolean; dome?: DomeRingWarp}) {
  const recipe=parseObservedPolarRecipe(config);
  const poleProjection=dome?.length?polarImageProjection(config):null;
  const sources=await verifyObservationSources(sourceDirectory,recipe.sourcePins);
  if(write)await mkdir(publicDirectory,{recursive:true});
  const assets: {filename: string; data: Buffer; bytes: number; sha256: string; width: number; height: number}[]=[],
    maps=new Map<string, {data: Uint8Array; width: number; height: number; channels: number}>(),
    coverage: Record<string, Record<string, unknown>>={},controls=[];
  const {width,height,polarTileSize}=recipe.dimensions;
  const load=async (spec: DetailImage)=>{
    let pipeline=sharp(requireSource(sources,spec.path)).removeAlpha();
    if(spec.extract)pipeline=pipeline.extract(spec.extract);
    return pipeline.resize(polarTileSize*2,polarTileSize*2,spec.resize).raw().toBuffer({resolveWithObject:true});
  };
  const add=async(filename: string,data: Buffer)=>{
    const info=await sharp(data).metadata();
    if (!info.width || !info.height) throw new Error(`Observed asset has no dimensions: ${filename}`);
    const asset={filename,data,bytes:data.length,sha256:sha256(data),width:info.width,height:info.height};assets.push(asset);
    if(write)await writeFile(resolve(publicDirectory,filename),data);
    return asset;
  };
  const pack=async (source: ObservedRgb,rings?: DomeRingWarp)=>{
    const {width,height}=source.info, channels=requireChannels(source.info.channels);
    if (!Buffer.isBuffer(source.data)) throw new TypeError('Projective raster packing requires a byte buffer.');
    const packed=packProjectiveSurfaceRaster(source.data,{width,height,channels,bands:latitudeRasterBands(recipe.packing.latitudeBoundsDegrees,height),gutter:recipe.packing.gutter*height/recipe.dimensions.height});
    if(rings?.length)writeDomeRings(packed,source,rings,recipe.packing.latitudeBoundsDegrees);
    return sharp(packed.data,{raw:{width:packed.packedWidth,height:packed.packedHeight,channels}}).webp(recipe.encoding.surface).toBuffer();
  };
  for(const lens of recipe.lenses) {
    let source1x: ObservedRgb,source2x: ObservedRgb;
    let polar: ReturnType<typeof preparePolarContinuationAtlas> | ReturnType<typeof prepareMeasuredPolarAtlas>;
    let sourceRange: [number,number] | undefined;
    let measured: {firstMeasuredRow: number; lastMeasuredRow: number; sourceMissingPixels?: number};
    const bytes=requireSource(sources,lens.source),details: PolarDetails={};
    if(lens.operation==='rgb-polar-structure') {
      const original=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      measured=measureRgbCoverage(original,lens.coverage);
      source2x=await sharp(original.data,{raw:original.info}).resize(width*2,height*2,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      source1x=await sharp(original.data,{raw:original.info}).resize(width,height,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      for(const pole of ['north','south'] as const) { const detail=lens.polarDetails[pole]; if(detail)details[pole]={...detail,structure:await load(detail.structure),palette:await load(detail.palette)}; }
      const {edgeLatitudeDegrees,...continuation}=lens.continuation;
      polar=preparePolarContinuationAtlas({source:source2x,tileSize:polarTileSize*2,firstMeasuredRow:Math.round((90-edgeLatitudeDegrees)/180*(original.info.height-1)),lastMeasuredRow:Math.round((90+edgeLatitudeDegrees)/180*(original.info.height-1)),measuredHeight:original.info.height,polarDetails:details,...continuation});
      source2x=preparePolarSurfaceTransition({source:source2x,polarDetails:details,...lens.transition});
      source1x=preparePolarSurfaceTransition({source:source1x,polarDetails:details,...lens.transition});
    } else {
      const scalar=readFitsPrimary(bytes);
      if(scalar.bitpix!==lens.scalar.bitpix||scalar.width!==lens.scalar.width||scalar.height!==lens.scalar.height)throw new Error('Pinned scalar polar dimensions changed.');
      const measuredSource=measureScalarCoverage(scalar,lens.scalar);
      sourceRange=finitePercentiles(measuredSource.values,...lens.scalar.percentiles,lens.scalar.minimumCoverageFraction,measuredSource.missing);
      if(!(sourceRange[1]>sourceRange[0]))throw new Error('Scalar observation has no measured dynamic range.');
      const original={data:falseColorMap(measuredSource,lens.palette,...sourceRange),info:{width:scalar.width,height:scalar.height,channels:4},missing:measuredSource.missing};
      source2x=resizeObservedRgb(original,width*2,height*2);
      source1x=resizeObservedRgb(original,width,height);
      measured={firstMeasuredRow:measuredSource.firstMeasuredRow,lastMeasuredRow:measuredSource.lastMeasuredRow,sourceMissingPixels:measuredSource.sourceMissingPixels};
      polar=prepareMeasuredPolarAtlas(original,polarTileSize*2,{projection:'latitude-linear',...lens.projection});
    }
    if(poleProjection){
      source2x=compositePolarOverlay(source2x,polar,poleProjection);source1x=compositePolarOverlay(source1x,polar,poleProjection);
      polar={...polar,data:layoutPolarAtlasForCaps(polar)};
    }
    maps.set(lens.id,{data:source2x.data,...source2x.info});
    coverage[lens.id]={...measured,...Object.fromEntries(Object.entries(polar).filter(([key])=>key!=='data'))};
    const surface=await add(lens.files.surface,await pack(source1x,dome)),surface2x=await add(lens.files.surface2x,await pack(source2x,dome));
    const raw={width:polar.width,height:polar.height,channels:4 as const};
    const poles=await add(lens.files.poles,await sharp(polar.data,{raw}).resize(polarTileSize*2,polarTileSize).webp(recipe.encoding.polar).toBuffer());
    const poles2x=await add(lens.files.poles2x,await sharp(polar.data,{raw}).webp(recipe.encoding.polar).toBuffer());
    const thumbnail=await add(lens.files.thumbnail,await sharp(surface.data).resize(recipe.thumbnail.width,recipe.thumbnail.height,{fit:recipe.thumbnail.fit,position:recipe.thumbnail.position}).webp(recipe.encoding.thumbnail).toBuffer());
    if(lens.operation==='rgb-polar-structure'){controls.push(lens.control);continue;}
    if(!sourceRange) throw new Error('Scalar observation requires its measured range.');
    controls.push({id:lens.id,label:lens.label,shortLabel:lens.shortLabel,filter:lens.filter,wavelength:lens.wavelength,measurement:lens.measurement,
      thumbnailUrl:recipe.publicPrefix+lens.files.thumbnail,surfaceUrl:recipe.publicPrefix+lens.files.surface,surface2xUrl:recipe.publicPrefix+lens.files.surface2x,polesUrl:recipe.publicPrefix+lens.files.poles,poles2xUrl:recipe.publicPrefix+lens.files.poles2x,falseColor:true,qualification:lens.qualification,
      coveragePreparation:{model:polar.model,...measured,projectionEdgeLatitudeDegrees:polar.measuredProjectionEdgeLatitudeDegrees,bodyLatitudeBoundsDegrees:recipe.packing.latitudeBoundsDegrees,unmeasuredCoreRadius:('unmeasuredCoreRadius' in polar ? polar.unmeasuredCoreRadius : undefined),polarProjectionAngularSamples:('polarProjectionAngularSamples' in polar ? polar.polarProjectionAngularSamples : undefined),unmeasuredCoreHarmonicOrder:('unmeasuredCoreHarmonicOrder' in polar ? polar.unmeasuredCoreHarmonicOrder : undefined),detailedPoles:polar.detailedPoles,structuralAuthority:lens.structuralAuthority,structuralDetailMeasurement:false,spectralColorAuthority:lens.measurement,runtimeCoverageRepair:false},
      sourceFile:lens.source,sourceSha256:sha256(bytes),sourceRange:sourceRange.map(value=>Number(value.toPrecision(8))),assetSha256:{surface:surface.sha256,surface2x:surface2x.sha256,poles:poles.sha256,poles2x:poles2x.sha256,thumbnail:thumbnail.sha256}});
  }
  return {assets,maps,coverage,lenses:{...recipe.descriptor,controls}};
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

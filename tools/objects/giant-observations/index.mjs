import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {packProjectiveSurfaceRaster} from '../../../src/platform/projective-surface-raster.mjs';
import {readFitsPrimary} from '../static-surface/fits-map.mjs';
import {verifyObservationSources} from '../giant-layers/observations.mjs';
import {latitudeRasterBands} from '../giant-layers/geometry.mjs';
import {validateRelativePath} from '../material-composition/recipe.mjs';
import {preparePolarContinuationAtlas,preparePolarSurfaceTransition} from './polar-continuation.mjs';
import {completeScalarCoverage,finitePercentiles,falseColorMap} from './scalar-coverage.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function parseObservedPolarRecipe(config) {
  if(config?.schema!=='cssearth-observed-polar-surfaces@1'||!/^[a-z][a-z0-9-]*$/.test(config.namespace)||typeof config.publicPrefix!=='string'||!/^\/[a-z0-9/-]+\/$/.test(config.publicPrefix))throw new TypeError('Invalid observed polar recipe.');
  if(!Array.isArray(config.sourcePins)||!config.sourcePins.length||!Array.isArray(config.lenses)||!config.lenses.length)throw new TypeError('Observed polar inputs and lenses must be declared.');
  const finite=value=>{if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('Observed polar parameters must be finite.');if(value&&typeof value==='object')Object.values(value).forEach(finite);};finite(config);
  for(const value of Object.values(config.dimensions))if(!Number.isSafeInteger(value)||value<16)throw new TypeError('Invalid observed polar raster dimensions.');
  latitudeRasterBands(config.packing.latitudeBoundsDegrees,config.dimensions.height);
  const ids=new Set(),outputs=new Set(),pinned=new Set(config.sourcePins.map(pin=>pin.path));
  const source=path=>{validateRelativePath(path);if(!pinned.has(path))throw new TypeError('Every observed polar source must be pinned.');};
  for(const lens of config.lenses) {
    if(!/^[a-z][a-z0-9-]*$/.test(lens.id)||ids.has(lens.id)||!['rgb-polar-structure','scalar-harmonic-poles'].includes(lens.operation))throw new TypeError('Invalid observed polar lens operation.');
    ids.add(lens.id);source(lens.source);
    for(const filename of Object.values(lens.files)){validateRelativePath(filename);if(outputs.has(filename))throw new TypeError('Observed polar outputs must be unique.');outputs.add(filename);}
    for(const detail of Object.values(lens.polarDetails)){source(detail.structure.path);if(detail.palette)source(detail.palette.path);}
    if(lens.operation==='rgb-polar-structure'&&(!Number.isInteger(lens.coverage.columnStride)||lens.coverage.columnStride<1))throw new TypeError('Invalid observed RGB coverage stride.');
    if(lens.operation==='scalar-harmonic-poles'&&(!Array.isArray(lens.palette)||lens.palette.length<2||!Number.isInteger(lens.scalar.edgeTransitionRows)||lens.scalar.edgeTransitionRows<2))throw new TypeError('Invalid scalar continuation parameters.');
  }
  return config;
}

/** Observed RGB/scalar maps, projective band packing, and source-structured poles.
 * The original observations are the only input; encoded surfaces are consumed
 * directly in memory for their matching thumbnail. */
export async function prepareObservedPolarSurfaces({sourceDirectory,publicDirectory,config,write=false}) {
  const recipe=parseObservedPolarRecipe(config);
  const sources=await verifyObservationSources(sourceDirectory,recipe.sourcePins);
  if(write)await mkdir(publicDirectory,{recursive:true});
  const assets=[],maps=new Map(),coverage={},controls=[];
  const {width,height,polarTileSize}=recipe.dimensions;
  const load=async spec=>{
    let pipeline=sharp(sources.get(spec.path)).removeAlpha();
    if(spec.extract)pipeline=pipeline.extract(spec.extract);
    return pipeline.resize(polarTileSize*2,polarTileSize*2,spec.resize).raw().toBuffer({resolveWithObject:true});
  };
  const add=async(filename,data)=>{
    const info=await sharp(data).metadata();
    const asset={filename,data,bytes:data.length,sha256:hash(data),width:info.width,height:info.height};assets.push(asset);
    if(write)await writeFile(resolve(publicDirectory,filename),data);
    return asset;
  };
  const pack=async source=>{
    const {width,height,channels}=source.info;
    const packed=packProjectiveSurfaceRaster(source.data,{width,height,channels,bands:latitudeRasterBands(recipe.packing.latitudeBoundsDegrees,height),gutter:recipe.packing.gutter*height/recipe.dimensions.height});
    return sharp(packed.data,{raw:{width:packed.packedWidth,height:packed.packedHeight,channels}}).webp(recipe.encoding.surface).toBuffer();
  };
  for(const lens of recipe.lenses) {
    let source1x,source2x,polar,sourceRange,measured;
    const bytes=sources.get(lens.source),details={};
    if(lens.operation==='rgb-polar-structure') {
      const original=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      measured=measureRgbCoverage(original,lens.coverage);
      source2x=await sharp(original.data,{raw:original.info}).resize(width*2,height*2,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      source1x=await sharp(original.data,{raw:original.info}).resize(width,height,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      for(const [pole,detail] of Object.entries(lens.polarDetails))details[pole]={...detail,structure:await load(detail.structure),palette:await load(detail.palette)};
      const {edgeLatitudeDegrees,...continuation}=lens.continuation;
      polar=preparePolarContinuationAtlas({source:source2x,tileSize:polarTileSize*2,firstMeasuredRow:Math.round((90-edgeLatitudeDegrees)/180*(original.info.height-1)),lastMeasuredRow:Math.round((90+edgeLatitudeDegrees)/180*(original.info.height-1)),measuredHeight:original.info.height,polarDetails:details,...continuation});
      source2x=preparePolarSurfaceTransition({source:source2x,polarDetails:details,...lens.transition});
      source1x=preparePolarSurfaceTransition({source:source1x,polarDetails:details,...lens.transition});
    } else {
      const scalar=readFitsPrimary(bytes);
      if(scalar.bitpix!==lens.scalar.bitpix||scalar.width!==lens.scalar.width||scalar.height!==lens.scalar.height)throw new Error('Pinned scalar polar dimensions changed.');
      const complete=completeScalarCoverage(scalar,lens.scalar);
      sourceRange=finitePercentiles(complete.values,...lens.scalar.percentiles,lens.scalar.minimumCoverageFraction);
      if(!(sourceRange[1]>sourceRange[0]))throw new Error('Scalar observation has no measured dynamic range.');
      const rgba=falseColorMap(complete,lens.palette,...sourceRange);
      source2x=await sharp(rgba,{raw:{width:complete.width,height:complete.height,channels:4}}).resize(width*2,height*2,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      source1x=await sharp(source2x.data,{raw:source2x.info}).resize(width,height,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
      for(const[pole,detail]of Object.entries(lens.polarDetails))details[pole]={...detail,structure:await load(detail.structure),palette:source2x};
      measured={firstMeasuredRow:complete.firstMeasuredRow,lastMeasuredRow:complete.lastMeasuredRow};
      polar=preparePolarContinuationAtlas({source:source2x,tileSize:polarTileSize*2,...measured,measuredHeight:complete.height,polarDetails:details,...lens.continuation});
    }
    maps.set(lens.id,{data:source2x.data,...source2x.info});
    coverage[lens.id]={...measured,...Object.fromEntries(Object.entries(polar).filter(([key])=>key!=='data'))};
    const surface=await add(lens.files.surface,await pack(source1x)),surface2x=await add(lens.files.surface2x,await pack(source2x));
    const raw={width:polar.width,height:polar.height,channels:4};
    const poles=await add(lens.files.poles,await sharp(polar.data,{raw}).resize(polarTileSize*2,polarTileSize).webp(recipe.encoding.polar).toBuffer());
    const poles2x=await add(lens.files.poles2x,await sharp(polar.data,{raw}).webp(recipe.encoding.polar).toBuffer());
    const thumbnail=await add(lens.files.thumbnail,await sharp(surface.data).resize(recipe.thumbnail.width,recipe.thumbnail.height,{fit:recipe.thumbnail.fit,position:recipe.thumbnail.position}).webp(recipe.encoding.thumbnail).toBuffer());
    if(lens.control){controls.push(lens.control);continue;}
    controls.push({id:lens.id,label:lens.label,shortLabel:lens.shortLabel,filter:lens.filter,wavelength:lens.wavelength,measurement:lens.measurement,
      thumbnailUrl:recipe.publicPrefix+lens.files.thumbnail,surfaceUrl:recipe.publicPrefix+lens.files.surface,surface2xUrl:recipe.publicPrefix+lens.files.surface2x,polesUrl:recipe.publicPrefix+lens.files.poles,poles2xUrl:recipe.publicPrefix+lens.files.poles2x,falseColor:true,qualification:lens.qualification,
      coveragePreparation:{model:polar.model,...measured,projectionEdgeLatitudeDegrees:polar.measuredProjectionEdgeLatitudeDegrees,bodyLatitudeBoundsDegrees:recipe.packing.latitudeBoundsDegrees,unmeasuredCoreRadius:polar.unmeasuredCoreRadius,polarProjectionAngularSamples:polar.polarProjectionAngularSamples,unmeasuredCoreHarmonicOrder:polar.unmeasuredCoreHarmonicOrder,detailedPoles:polar.detailedPoles,structuralAuthority:lens.structuralAuthority,structuralDetailMeasurement:false,spectralColorAuthority:lens.measurement,runtimeCoverageRepair:false},
      sourceFile:lens.source,sourceSha256:hash(bytes),sourceRange:sourceRange.map(value=>Number(value.toPrecision(8))),assetSha256:{surface:surface.sha256,surface2x:surface2x.sha256,poles:poles.sha256,poles2x:poles2x.sha256,thumbnail:thumbnail.sha256}});
  }
  return {assets,maps,coverage,lenses:{...recipe.descriptor,controls}};
}

export function measureRgbCoverage(source,config) {
  const {width,height,channels}=source.info;
  if(!Number.isSafeInteger(config.columnStride)||config.columnStride<1||!Number.isFinite(config.minimumMean))throw new TypeError('Invalid RGB coverage sampling.');
  const mean=row=>{let sum=0,count=0;for(let column=0;column<width;column+=config.columnStride){const offset=(row*width+column)*channels;sum+=source.data[offset]+source.data[offset+1]+source.data[offset+2];count+=3;}return sum/count;};
  let firstMeasuredRow=0,lastMeasuredRow=height-1;
  while(firstMeasuredRow<height&&mean(firstMeasuredRow)<=config.minimumMean)firstMeasuredRow++;
  while(lastMeasuredRow>=0&&mean(lastMeasuredRow)<=config.minimumMean)lastMeasuredRow--;
  if(firstMeasuredRow!==config.firstMeasuredRow||lastMeasuredRow!==config.lastMeasuredRow)throw new Error('Pinned RGB polar coverage changed.');
  return {firstMeasuredRow,lastMeasuredRow};
}

import { sha256 } from '../../../src/platform/sha256.mts';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';
import type {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import type {RgbObservation} from './contracts.mts';
import type {RadialState} from './solid-contract.mts';
import { encodeBandColor, interpolatePalette } from '../color-transfer.mts';
import {parseSolidRasterConfig,parseSurfaceSource} from './solid-source.mts';
import {requireTerrainMesh} from './radial-terrain.mts';
import {shape,text,number} from './source-records.mts';
interface ObservationRaster extends RgbObservation {withheldSyntheticPixels?:number;sourceGeoreference?:unknown;}
import type {SolidSurface} from './solid-contract.mts';
export interface LambertAttenuationParameters {
  frameSize: number; columns: number; frameCount: number; terminatorWidth: number;
  directionalAmbient: number; fullPhaseAmbient: number; fullPhaseDiffuse: number; maximumOpacity: number;
}
interface SolidMaterialConfig {
  namespace: string; publicBase: string; raster: SolidRasterGrid;
  lighting: LambertAttenuationParameters & {logicalSize: number};
}
import type {Sharp,WebpOptions} from 'sharp';
import {hasErrorCode,requireRecord,requireString,requireFiniteNumber} from '../../sources/source-values.mts';
import {parseDimensions} from './source-records.mts';
export interface SolidRasterGrid {width:number;height:number;bandCount:number;gutter:number;poleSize:number;}
export interface TextureGridLens {textureScale?:number;monochromeBase?:string;previewGrid?:{width:number;height:number};surfaceSampling?:unknown;format?:string;}
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fromFile } from 'geotiff';
import { packProjectiveSurfaceRaster } from '../../../src/platform/projective-surface-raster.mts';
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mts';
import { reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from '../../../src/platform/prepare-solid-body-surface.mts';
import { colorForValue, loadScienceSurface, paintScienceSurface, prepareObservedColor } from './scientific-raster.mts';
import {prepareMaskedObservation, prepareFloatObservation, prepareIsisObservation, prepareRgbBandObservation} from './observed-geotiff.mts';
import { preparePdsRgbObservation } from './observed-pds-rgb.mts';
import { prepareByteObservation } from './observed-image.mts';
import { preparePds4Observation } from './observed-pds4.mts';
import { prepareFitsObservation } from './observed-fits.mts';
import { preparePdsByteMosaic } from './pds-byte-mosaic.mts';
import {loadControlledObservationGeometry,matchObservedColorLevels} from './photometric-observations.mts';
import { loadSurfaceObservation } from '../surface-observations/index.mts';
import { renderRadialSnapshot } from './radial-snapshot.mts';
import { radialModelForLens } from './radial-models.mts';
import { npyLonLatGridDependencies } from './npy-lonlat-grid.mts';
import { SHAPE_MATERIAL, shapeMaterialRaster } from './shape-material.mts';

/** An encoding with neither `lossless` nor `quality` is written in the lossy lane (lossy-lane.ts). One that fixes a quality,
 * and every lossless encoding, is written as given. */
export function createRasterEmitter(publicDirectory:string, publicBase:string) {
  return async (filename:string, pipeline:Sharp, encoding:WebpOptions = { lossless: true, effort: 4 }) => {
    const path = resolve(publicDirectory, filename);
    const bytes = !encoding.lossless && encoding.quality === undefined
      ? await writeLossyWebp(pipeline, path, encoding)
      : await pipeline.webp(encoding).toBuffer();
    if (encoding.lossless || encoding.quality !== undefined) await writeFile(path, bytes);
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) throw new Error(`Raster output has no dimensions: ${filename}`);
    return { url: `${publicBase}${filename}`, width, height, bytes: bytes.length,
      sha256: sha256(bytes) };
  };
}

// Terminal display encoding only, in the lossy lane (no quality: see createRasterEmitter). Source maps stay lossless for
// pole sampling.
const DISPLAY_ENCODING: WebpOptions = { alphaQuality: 100, effort: 4 };

export async function readObservation(sourceDirectory:string, entryInput:unknown, validityInput:unknown, width:number, height:number): Promise<ObservationRaster> {
  const entry=Object.assign({},requireRecord(entryInput),parseDimensions(entryInput));
  const validity=requireRecord(validityInput),kind=requireString(validity.kind);
  const sourcePath=requireString(entry.path);

  const path = resolve(sourceDirectory, sourcePath);
  if (kind === 'pds4-float-rgb') return preparePds4Observation(sourceDirectory, entry, validity, width, height);
  if (kind === 'pds3-rgb-zip') return preparePdsRgbObservation(path, entry, validity, width, height);
  if (kind === 'geotiff-rgb-bands') return prepareRgbBandObservation(path, entry, validity, width, height);
  if (kind === 'fits-byte-monochrome') return prepareFitsObservation(path, entry, validity, width, height);
  if (kind === 'pds3-byte-monochrome') return preparePdsByteMosaic(sourceDirectory, [entry], width, height, validity);
  if (kind === 'isis3-float-monochrome') return prepareIsisObservation(path, entry, validity, width, height);
  if (['geotiff-float-monochrome', 'geotiff-byte-monochrome'].includes(kind)) return prepareFloatObservation(path, entry, validity, width, height);
  const metadata = await sharp(path, { limitInputPixels: false }).metadata();
  if (metadata.width !== entry.width || metadata.height !== entry.height) throw new Error(`Observation source dimensions changed: ${entry.path}`);
  if (['image-monochrome-no-data', 'image-rgb-no-data'].includes(kind)) return prepareByteObservation(path, entry, validity, width, height);
  if(kind==='geotiff-rgb-alpha')return prepareMaskedObservation(path,entry,validity,width,height);
  if (kind === 'geotiff-monochrome-alpha' && typeof validity.resampling === 'string' && ['source-georeferenced-bilinear','source-georeferenced-nearest'].includes(validity.resampling)) {
    return prepareMaskedObservation(path, entry, {...validity, channels:'monochrome', zeroValidity:validity.zeroValidity ?? 'all-channels'}, width, height);
  }
  if (kind === 'south-connected-black') {
    const source = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sourceMissing = blackFillCoverage(source.data, source.info, { southConnected: true });
    const rgb = await sharp(path).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    return { rgb, missing: sampleCoverage(sourceMissing, source.info, width, height) };
  }
  if (kind !== 'geotiff-monochrome-alpha') throw new Error(`Unsupported observation validity: ${validity.kind}`);
  const tiff = await fromFile(path);
  let origin, resolution;
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys();
    if (!keys) throw new Error('Observation GeoTIFF has no source keys.');
    const referenceRadius=requireFiniteNumber(requireRecord(entry.projection).referenceRadiusMeters);
    origin = image.getOrigin(); resolution = image.getResolution();
    if (image.getWidth() !== entry.width || image.getHeight() !== entry.height || image.getGDALNoData() !== validity.noData ||
        resolution[0] <= 0 || resolution[1] >= 0 || keys.ProjCenterLongGeoKey !== validity.centerLongitude ||
        Math.abs(requireFiniteNumber(keys.GeogSemiMajorAxisGeoKey) - referenceRadius) > 0.01) {
      throw new Error(`Observation GeoTIFF coordinate mapping changed: ${entry.path}`);
    }
  } finally { await tiff.close(); }
  const source = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (source.info.channels !== 1) throw new Error('Monochrome source must have one channel.');
  const grayAlpha = Buffer.alloc(source.data.length * 2);
  for (let i = 0; i < source.data.length; i++) {
    grayAlpha[i * 2] = source.data[i];
    grayAlpha[i * 2 + 1] = source.data[i] === validity.noData ? 0 : 255;
  }
  const { data, info } = await sharp(grayAlpha, { raw: { width: entry.width, height: entry.height, channels: 2 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error('Monochrome resampling must retain its validity channel.');
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let i = 0; i < missing.length; i++) {
    rgb.set(data.subarray(i * 4, i * 4 + 3), i * 3);
    missing[i] = data[i * 4 + 3] < 255 ? 1 : 0;
  }
  return { rgb, missing, sourceGeoreference: { origin, resolution } };
}

/** Only facet-table previews may use a smaller flat map. Native triangle
 * materials still sample the complete source table and have their own atlas. */
export function scientificPreviewGrid(lens:TextureGridLens, raster:Pick<SolidRasterGrid,'width'|'height'|'bandCount'>) {
  const grid = lens.previewGrid;
  if (grid === undefined) return { width: raster.width, height: raster.height };
  if (lens.format !== 'facet-scalars' || !grid ||
      Object.keys(grid).some(key => !['width', 'height'].includes(key)) ||
      ![grid.width, grid.height].every(n => Number.isSafeInteger(n) && n > 0) ||
      grid.width !== grid.height * 2 || grid.width > raster.width || grid.height > raster.height ||
      grid.height % raster.bandCount !== 0) {
    throw new TypeError('Facet preview grid must be a bounded 2:1 integer raster compatible with its latitude bands.');
  }
  return { width: grid.width, height: grid.height };
}

/** A lower-resolution source can keep the exact existing atlas proportions.
 * CSS addresses and body geometry remain fixed; this only changes baked pixels.
 */
export function lensTextureGrid(lens:TextureGridLens, raster:SolidRasterGrid) {
  const scale = lens.textureScale ?? 1;
  const grid = {width:raster.width*scale,height:raster.height*scale,gutter:raster.gutter*scale,poleSize:raster.poleSize*scale};
  if (![1, .5, .25, .125].includes(scale) || Object.values(grid).some(n => !Number.isSafeInteger(n) || n <= 0) ||
      grid.height % raster.bandCount !== 0 || (scale !== 1 && (lens.monochromeBase || lens.previewGrid || lens.surfaceSampling))) {
    throw new TypeError('Lens texture scale must preserve integral atlas bands, gutters and poles.');
  }
  return grid;
}

/** Surface composition is source-dependent; the projection/packing is shared. */
interface RasterRadialModel { lensIds: string[]; radial: RadialState; config: {geometry: unknown}; }
const OBSERVATION_PREVIEW_DIVISOR = 4;

export async function prepareSolidRasters({ sourceDirectory, publicDirectory, outputDirectory, config:input, source, radial, radialModels }: {sourceDirectory:string;publicDirectory:string;outputDirectory:string;config:unknown;source:Awaited<ReturnType<typeof createSourceManifest>>;radial?:RadialState|null;radialModels?:readonly RasterRadialModel[]}) {
  const config=parseSolidRasterConfig(input);
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  const { width, height, bandCount, gutter } = config.raster;
  const modelForLens = (lensId: string) => radialModels?.length ? radialModelForLens(radialModels, lensId) : null;
  const emit = createRasterEmitter(publicDirectory, config.publicBase), surfaces: SolidSurface[] = [], observations = new Map<string,ObservationRaster>();
  const entries = config.raster.observations.length ? (await source.validateGroup('surfaces')).map(parseSurfaceSource) : [];
  if (entries.length !== config.raster.observations.length ||
      new Set(entries.map(entry => entry.lensId)).size !== entries.length ||
      entries.some(entry => !config.raster.observations.some(recipe => recipe.id === entry.lensId))) {
    throw new Error('Observation recipe does not consume its complete pinned surface group.');
  }
  for (const recipe of config.raster.observations) {
    const entry=entries.find(item=>item.lensId===recipe.id);
    if (!entry) throw new Error(`Observation ${recipe.id} has no pinned source.`);
    if (recipe.validity.labelPath && ![...source.manifest.inputs, ...source.manifest.documents].some(input => input.path === recipe.validity.labelPath)) throw new Error('Observation label has no source pin.');
    const grid = lensTextureGrid(recipe, config.raster);
    const observation = await readObservation(sourceDirectory, entry, recipe.validity, grid.width, grid.height);
    let monochromePixels=0;
    if(recipe.monochromeBase){const base=observations.get(recipe.monochromeBase);if(!base)throw new Error('Observed fallback ordering is invalid.');
      for(let i=0;i<observation.missing.length;i++)if(observation.missing[i]&&!base.missing[i]){observation.rgb.set(base.rgb.subarray(i*3,i*3+3),i*3);observation.missing[i]=0;monochromePixels++}}
    observations.set(entry.lensId, observation);
    surfaces.push(await packSurface(entry.lensId, observation.rgb, observation.missing, {
      label: entry.label, falseColor: entry.falseColor,
      source: { id: entry.id, width: entry.width, height: entry.height },
      projection: {...entry.projection,...recipe.projection}, coverage: entry.coverage,
      ...recipe.metadata,
      ...(recipe.reportComposition?{monochromePixels,withheldSyntheticPixels:observation.withheldSyntheticPixels??0}:{}),
      ...(recipe.monochromeBase&&!recipe.reportComposition?{monochromePixels}:{}),
      ...(observation.sourceGeoreference ? { sourceGeoreference: observation.sourceGeoreference } : {}),
      ...(recipe.textureScale ? { textureScale: recipe.textureScale } : {}),
    }, {...grid, ...(recipe.validity.resampling === 'source-georeferenced-nearest' ? {displaySampling:'nearest'} : {})}));
  }
  for (const view of config.raster.shapeViews ?? []) {
    const entries = await source.validateGroup(view.consumer);
    const modelConfig = modelForLens(view.id)?.config ?? config;
    const terrain = requireRecord(requireRecord(modelConfig.geometry).radialTerrain);
    const entry = entries.find(input => input.path === terrain.path);
    if (!entry) throw new Error('Shape display is not bound to the rendered source mesh.');
    const rgb = shapeMaterialRaster(width, height);
    surfaces.push(await packSurface(view.id, rgb, null, { label: view.label,
      appearance: SHAPE_MATERIAL.appearance,
      material: { kind: 'unobserved-neutral', color: SHAPE_MATERIAL.color },
      ...(config.raster.reportMissingPixels ? { missingPixels: width * height } : {}),
      source: { id: entry.id } }));
  }
  for (const recipe of config.raster.surfaceObservations ?? []) {
    const model = modelForLens(recipe.id), observationRadial = model?.radial ?? radial, observationConfig = model?.config ?? config;
    if (!observationRadial?.grid?.closestPoint) throw new Error('Georeferenced observations require source-preserving terrain.');
    const observation = await loadSurfaceObservation({ sourceDirectory, source, recipe, radial:{...observationRadial,grid:requireTerrainMesh(observationRadial.grid)}, config:{geometry:shape({radius:number,radiusKm:number,radialTerrain:shape({path:text,simplification:shape({method:text,maximumErrorMeters:number})})})(observationConfig.geometry),raster:config.raster} });
    observationRadial.observationSurfaces ??= new Map();
    observationRadial.observationSurfaces.set(recipe.id, observation);
    // The map of a photographed lens only gives its billboard colour and coverage count; the atlas and thumbnail sample the
    // photographs directly. A quarter of the map's width and height carries both.
    const previewWidth = Math.max(2, Math.round(width / OBSERVATION_PREVIEW_DIVISOR)), previewHeight = Math.max(1, Math.round(height / OBSERVATION_PREVIEW_DIVISOR));
    const { rgb, missing } = observation.preview(previewWidth, previewHeight);
    // A palette lens is false colour: its legend strip is emitted beside the surface, like a scientific lens.
    const display = requireRecord(recipe).display, palette = display === undefined ? undefined : requireRecord(display).palette as readonly string[] | undefined;
    const legend = palette ? await emit(`${config.namespace}-${recipe.id}-legend.webp`, sharp(Buffer.concat(Array.from({ length: 256 }, (_, x) => Buffer.from(interpolatePalette(palette, x / 255)))),
      { raw: { width: 256, height: 1, channels: 3 } }).resize(256, 16, { fit: 'fill', kernel: 'lanczos3' })) : null;
    const surface = await packSurface(recipe.id, rgb, missing, { ...recipe.metadata, ...(legend ? { falseColor: true, legend } : {}), observation: observation.report }, { width: previewWidth, height: previewHeight });
    const eye = observation.report.camera.positionKm;
    const snapshot = await renderRadialSnapshot({ faces: observationRadial.faces, sampleSurface: observation.samplePoint, size: 96,
      longitudeDegrees: Math.atan2(eye[1], eye[0]) * 180 / Math.PI,
      latitudeDegrees: Math.atan2(eye[2], Math.hypot(eye[0], eye[1])) * 180 / Math.PI, ambient: .4, diffuse: .6 });
    surface.thumbnail = await emit(`${config.namespace}-${recipe.id}-thumbnail.webp`, sharp(snapshot).resize(48, 48)
      .extend({ left: 24, right: 24, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }));
    surfaces.push(surface);
  }
  for (const lens of config.raster.scientific ?? []) {
    const model = modelForLens(lens.id), scienceRadial = model?.radial ?? radial, scienceConfig = model?.config ?? config;
    await source.validateGroup(lens.consumer);
    for(const mask of lens.qualityMasks??[])if(!source.manifest.inputs.some(input=>input.path===mask.path&&input.consumers.includes(lens.consumer)))
      throw new Error(`Scientific quality mask ${mask.path} lacks a pinned source in ${lens.consumer}.`);
    const sourcePath = lens.facetField?.path ?? lens.path;
    const entry = source.manifest.inputs.find(input => input.path === sourcePath && input.consumers.includes(lens.consumer));
    if (!entry) throw new Error(`Scientific source ${lens.id} differs from its manifest.`);
    if (lens.facetField && ![lens.path, lens.facetField.labelPath].every(path => source.manifest.inputs.some(input =>
      input.path === path && input.consumers.includes(lens.consumer)))) throw new Error('Facet field lacks its pinned source mesh or label.');
    const additionalSources = (lens.additionalGrids ?? []).map(grid => {
      const input = source.manifest.inputs.find(input => input.path === grid.path && input.consumers.includes(lens.consumer));
      if (!input) throw new Error(`Scientific grid ${grid.path} has no pinned source.`);
      return {id: input.id, width: requireRecord(input).width, height: requireRecord(input).height};
    });
    const renderedMeshPath = lens.format === 'vtk-cell-categories' ? requireString(lens.surfaceSampling?.renderedMeshPath) : ['facet-scalars', 'obj-uv-fits'].includes(lens.format) ? lens.meshPath : lens.path;
    const terrain = lens.surfaceSampling ? requireRecord(scienceConfig.geometry).radialTerrain : undefined;
    const terrainPath = terrain === undefined ? undefined : requireString(requireRecord(terrain).path);
    if (lens.surfaceSampling && (!scienceRadial?.grid?.closestPoint || (lens.format !== 'pds3-scalar-map' && renderedMeshPath !== terrainPath))) {
      throw new Error('Source-surface science requires the actual rendered source mesh.');
    }
    if (lens.format === 'pds3-scalar-map') {
      for (const path of [lens.labelPath, requireString(lens.surfaceSampling?.ambiguityReference?.path)]) {
        if (!source.manifest.inputs.some(input => input.path === path && input.consumers.includes(lens.consumer))) throw new Error(`Unpinned scalar-map dependency: ${path}`);
      }
    }
    const dependencies = lens.format === 'facet-scalars' ? [lens.meshPath, lens.table?.labelPath].filter(Boolean)
      : lens.format === 'obj-uv-fits' ? [lens.meshPath, lens.labelPath]
      : lens.format === 'vtk-cell-categories' ? [requireString(lens.surfaceSampling?.renderedMeshPath), lens.symbols?.paths, lens.symbols?.locations].filter(Boolean)
      : lens.format === 'image-plane-dem' ? [lens.comparison?.path].filter(Boolean)
      : lens.format === 'geologic-shapefile' ? [requireString(requireRecord(lens.grid).attributePath), requireString(requireRecord(lens.grid).projectionPath)]
      : lens.format === 'pds-image' ? [lens.labelPath]
      : lens.format === 'npy-lonlat-grid' ? npyLonLatGridDependencies(lens) : [];
    for (const pathValue of dependencies) {
      const path = requireString(pathValue);
      if (![...source.manifest.inputs, ...source.manifest.documents].some(input => input.path === path)) throw new Error(`Unpinned scientific dependency: ${path}`);
      if (lens.format === 'image-plane-dem') await source.validatePath(path);
    }
    // Reuse the already loaded geometry BVH, especially for large OLA meshes.
    const raster = await loadScienceSurface(sourceDirectory, lens, lens.surfaceSampling && scienceRadial ? requireTerrainMesh(scienceRadial.grid) : undefined);
    if (lens.surfaceSampling) {
      if (!scienceRadial) throw new Error('Source-surface science requires retained terrain.');
      scienceRadial.scientificSurfaces ??= new Map();
      scienceRadial.scientificSurfaces.set(lens.id, raster);
    }
    const grid = lensTextureGrid(lens, config.raster);
    const preview = scientificPreviewGrid(lens, { ...config.raster, ...grid });
    const { rgb, missing } = paintScienceSurface(raster, lens, preview.width, preview.height);
    const scale = Buffer.alloc(256 * 3);
    for (let x = 0; x < 256; x++) scale.set(colorForValue(lens.categories ? Math.min(lens.categories.length - 1, Math.floor(x * lens.categories.length / 256)) : lens.minimum + x / 255 * (lens.maximum - lens.minimum), lens), x * 3);
    const legend = await emit(`${config.namespace}-${lens.id}-legend.webp`, sharp(scale, { raw: { width: 256, height: 1, channels: 3 } }).resize(256, 16, { fit: 'fill', kernel: lens.categories ? 'nearest' : 'lanczos3' }));
    surfaces.push(await packSurface(lens.id, rgb, null, { label: lens.label, falseColor: true,
      source: { id: entry.id, width: requireRecord(entry).width, height: requireRecord(entry).height },
      ...(additionalSources.length ? {additionalSources} : {}),
      projection: requireRecord(entry).projection, coverage: requireRecord(entry).coverage, scientific: true, legend,
      ...(lens.previewGrid ? { previewGrid: preview } : {}),
      ...(raster.fieldReport ? { facetField: raster.fieldReport } : {}),
      ...(raster.report ? { scalarMap: raster.report } : {}),
      ...(lens.surfaceSampling ? { surfaceSampling: { ...lens.surfaceSampling,
        previewPolicy: 'Radial rays with more than one distinct source intersection are withheld; the triangle atlas samples the source surface in 3D.' } } : {}),
      ...(lens.textureScale ? { textureScale: lens.textureScale } : {}),
      missingPixels: missing.reduce((sum, value) => sum + value, 0) }, { categorical: Boolean(lens.categories), displaySampling: lens.displaySampling, ...preview, gutter: grid.gutter }));
  }
  for (const recipe of config.raster.observedColors ?? []) {
    const photometry=recipe.photometry?{profile:recipe.photometry.profile,geometry:await loadControlledObservationGeometry({sourceDirectory,entries:(await source.validateGroup(recipe.photometry.consumer)).map(shape({path:text,id:text,imageId:text})),vectors:recipe.photometry.vectors})}:null;
    const color = await prepareObservedColor({ sourceDirectory, entries: await source.validateGroup(recipe.consumer), profile: recipe.profile, width, height,photometry });
    const base = observations.get(recipe.monochromeBase);
    if (!base) throw new Error(`Color observation base does not exist: ${recipe.monochromeBase}`);
    if (photometry && !('owners' in color)) throw new Error('Corrected color has no observation ownership.');
    const levels=recipe.photometry && 'owners' in color ? matchObservedColorLevels(color,base,{width,height,...recipe.photometry.levels}):null;
    const rgb = color.rgb instanceof Uint8Array ? color.rgb : encodeBandColor(color.rgb,color.missing,color.display);
    let monochromePixels = 0;
    for (let i = 0; i < color.missing.length; i++) if (color.missing[i] && !base.missing[i]) {
      rgb.set(base.rgb.subarray(i * 3, i * 3 + 3), i * 3); color.missing[i] = 0; monochromePixels++;
    }
    surfaces.push(await packSurface(recipe.id, rgb, color.missing, {
      ...recipe.metadata, sourceIds: color.sourceIds, monochromePixels, observationCoverage: color.coverage,colorDisplay:color.colorDisplay,
      ...(photometry?{photometry:'photometry' in color ? color.photometry : undefined,levels}:{}),
    }));
  }
  async function packSurface(id: string, rgb: Uint8Array, missing: Uint8Array | null, metadata: Record<string, unknown>, { categorical = false, displaySampling,
    width = config.raster.width, height = config.raster.height, gutter = config.raster.gutter }: {categorical?: boolean; displaySampling?: string; width?: number; height?: number; gutter?: number} = {}): Promise<SolidSurface> {
    const nearest = categorical || displaySampling === 'nearest';
    const display = missing ? paintMissingCoverage(rgb, { width, height, channels: 3 }, missing) : rgb;
    const rgba = await sharp(display, { raw: { width, height, channels: 3 } }).ensureAlpha().raw().toBuffer();
    const stem = `${config.namespace}-${id}`, normalized = sharp(rgba, { raw: { width, height, channels: 4 } });
    const map = await emit(`${stem}-map.webp`, normalized.clone());
    const thumbnail = await emit(`${stem}-thumbnail.webp`, normalized.clone().resize(96, 48, { kernel: nearest ? 'nearest' : 'lanczos3' }));
    // A radial body draws its surface from a triangle atlas that prepareRadialMaterials writes over this surface and layout,
    // so the banded projection is not built or encoded for it; index.mts refuses a radial surface left without its atlas.
    let surface = map, layout: SolidSurface['layout'] = { kind: 'radial-triangle-atlas-pending' };
    if (!radial) {
      const projected = reprojectSolidBodySurfaceRaster(rgba, { width, height, latitudeSegments: bandCount, sampling: nearest ? 'nearest' : 'bilinear' });
      const packed = packProjectiveSurfaceRaster(projected, { width, height, bandCount, gutter });
      const { data, ...packedLayout } = packed;
      surface = await emit(`${stem}-surface@2x.webp`, sharp(data, { raw: { width: packed.packedWidth, height: packed.packedHeight, channels: 4 } }), nearest ? { lossless: true, effort: 4 } : DISPLAY_ENCODING);
      layout = packedLayout;
    }
    return { id, ...metadata, ...(categorical ? { categorical: true } : {}), ...(nearest ? { displaySampling: 'nearest' } : {}), map, surface, thumbnail, layout,
      ...(missing && config.raster.reportMissingPixels ? { missingPixels: missing.reduce((sum, value) => sum + value, 0) } : {}) };
  }
  await writeFile(resolve(outputDirectory, 'surfaces.json'), `${JSON.stringify({ objectId: config.namespace, surfaces })}\n`);
  return surfaces;
}

export function lambertAttenuationAtlas({ frameSize, columns, frameCount, terminatorWidth, directionalAmbient, fullPhaseAmbient, fullPhaseDiffuse, maximumOpacity }: LambertAttenuationParameters) {
  const rows = frameCount / columns, width = frameSize * columns, height = frameSize * rows;
  const pixels = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < frameCount; frame++) {
    const lz = -1 + 2 * frame / (frameCount - 1), lx = Math.sqrt(1 - lz * lz);
    for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
      const nx = (x - (frameSize - 1) / 2) / (frameSize / 2), ny = (y - (frameSize - 1) / 2) / (frameSize / 2), r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const direct = Math.max(0, nx * lx + Math.sqrt(1 - r2) * lz);
      const t = Math.min(1, direct / terminatorWidth), lit = t * t * (3 - 2 * t) * direct;
      const illumination = frame === frameCount - 1 ? fullPhaseAmbient + lit * fullPhaseDiffuse : directionalAmbient + lit;
      const offset = ((Math.floor(frame / columns) * frameSize + y) * width + frame % columns * frameSize + x) * 4;
      pixels[offset + 3] = Math.round(Math.min(maximumOpacity, Math.max(0, 1 - illumination)) * 255);
    }
  }
  return { pixels, width, height, rows };
}

export async function prepareSolidSurfacePoles({ surfaces, publicDirectory, config, radial = false }: {surfaces: SolidSurface[]; publicDirectory: string; config: Pick<SolidMaterialConfig, 'namespace' | 'publicBase' | 'raster'>; radial?: boolean}) {
  for (const surface of surfaces) {
    const { poleSize } = lensTextureGrid(surface, config.raster);
    const { data, info } = await sharp(resolve(publicDirectory, requireString(surface.map.url.split('/').at(-1)))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const filename = `${config.namespace}-${surface.id}-poles@2x.webp`;
    surface.polesUrl = `${config.publicBase}${filename}`;
    // A radial body's poles come from its triangle atlas (prepareRadialMaterials replaces polesUrl), so no pole image is drawn for it.
    if (!radial) {
      const atlas = prepareSolidBodyPoleRaster(data, { width: info.width, height: info.height, tileSize: poleSize, sampling: surface.displaySampling === 'nearest' ? 'nearest' : 'bilinear' });
      const poles = sharp(atlas, { raw: { width: poleSize * 2, height: poleSize, channels: 4 } }), path = resolve(publicDirectory, filename);
      if (surface.displaySampling === 'nearest') await poles.webp({ lossless: true, effort: 4 }).toFile(path);
      else await writeLossyWebp(poles, path, DISPLAY_ENCODING);
    }
    const mean = await sharp(data, { raw: info }).resize(1, 1).removeAlpha().raw().toBuffer();
    surface.billboardColor = `#${mean.subarray(0, 3).toString('hex')}`;
  }
}

export async function prepareSolidMaterial({ surfaces, publicDirectory, outputDirectory, config, radial = false }: {surfaces: SolidSurface[]; publicDirectory: string; outputDirectory: string; config: SolidMaterialConfig; radial?: boolean}) {
  await prepareSolidSurfacePoles({ surfaces, publicDirectory, config, radial });
  // A radial body's triangle atlases carry their own baked lighting, and its presentation draws no lighting frames.
  if (radial) return { surfaces, lighting: null };
  const { pixels, width, height, rows } = lambertAttenuationAtlas(config.lighting);
  const filename = `${config.namespace}-lighting.webp`, url = `${config.publicBase}${filename}`;
  await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, quality: 100, effort: 6 }).toFile(resolve(publicDirectory, filename));
  const { columns, frameCount, logicalSize } = config.lighting;
  const frames = Array.from({ length: frameCount }, (_, frame) => ({ resource: 'lighting', frame, row: 0,
    backgroundPosition: `${-(frame % columns) * logicalSize}px ${-Math.floor(frame / columns) * logicalSize}px`,
    backgroundSize: `${columns * logicalSize}px ${rows * logicalSize}px` }));
  const material = { surfaces, lighting: { url, columns, rowCount: rows, frameCount, frames } };
  await writeFile(resolve(outputDirectory, 'material.json'), `${JSON.stringify(material)}\n`);
  return material;
}

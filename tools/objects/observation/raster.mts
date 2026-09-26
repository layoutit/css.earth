// Observation interpretation for the generic raster lane (moved from the retired static lane's raster.mts):
// the Moon/Pluto path of coverage grids, signed DEM decoding, tonal presentation and GHRM science. It returns
// finished pixels; the shared raster lane packs, projects and encodes them.
import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';
import type { SourceScalar, SciencePalette } from '../terrestrial-layers/contracts.mts';
import { loadScienceSurface, paintScienceSurface } from '../terrestrial-layers/scientific-raster.mts';
import { blackFillCoverage, sampleCoverage, paintMissingCoverage } from '@cssearth/bake/raster';
import { object, string, number, boolean, optional, array, union, parse } from '@cssearth/core/schema';
import { decodeElevationGrid, elevationRaster } from './elevation.mts';
import type { ElevationRecipe } from './elevation.mts';

export interface RasterInfo {width: number; height: number; channels: 1 | 2 | 3 | 4;}
export interface RasterImage {data: Buffer; info: RasterInfo;}
export interface TonalPresentation {saturation: number; linearGain: number; linearOffset: number; sharpenSigma: number;}
export interface ObservationLens {
  id: string; input: string; output?: string; rasterScale?: number;
  nativeSourcePoles?: boolean;
  scientific?: SciencePalette & {displaySampling?: string};
  elevation?: ElevationRecipe;
  coverage?: {kind: string; southConnected: boolean};
  presentation?: TonalPresentation;
}
interface ObservationRasterInput {input: string; plan: Omit<ObservationLens, 'output'>; width: number; height: number;
  elevation?: ReturnType<typeof decodeElevationGrid> | null; scientific?: SourceScalar | null;
  source?: RasterImage | null; sourceMissing?: Uint8Array | null;}

const relief = object({referenceRadiusMeters: number, lightDirection: array(number), ambient: number, heightToMeters: optional(number)});
const scientific = union(
  object({categories: array(object({color: string})), minimum: optional(number), maximum: optional(number), colors: optional(array(string)), relief: optional(relief), outputLongitudeOrigin: optional(number), displaySampling: optional(string)}),
  object({categories: (value): value is undefined => value === undefined, minimum: number, maximum: number, colors: array(string), relief: optional(relief), outputLongitudeOrigin: optional(number), displaySampling: optional(string)}));
const observationLens = object({id: string, input: string, output: optional(string), rasterScale: optional(number), scientific: optional(scientific),
  nativeSourcePoles: optional(boolean),
  elevation: optional(object({noData: number, palette: array(array(number)), rangeMetres: number, relief: optional(relief)})),
  coverage: optional(object({kind: string, southConnected: boolean})),
  presentation: optional(object({saturation: number, linearGain: number, linearOffset: number, sharpenSigma: number}))});
/** Validate one surface's observation fields (the retired lane's `observation lens` record without a required output). */
export const parseObservationLens = (value: unknown) => parse(value, observationLens, 'observation lens');

/** Direct source sampler for a static photograph with the same normalized map domain as its established `fit: fill`
 * decode. Coverage is evaluated against every native bilinear contributor before the polar output paints its grid. */
export async function loadNativeObservationPoleSampler(input: string, plan: ObservationLens) {
  if (plan.scientific || plan.elevation) throw new TypeError('Native observation poles require a photographic source, not a numeric grid.');
  if (plan.presentation) throw new TypeError('Native observation poles cannot reproduce the resized-map Sharp tonal presentation.');
  if (plan.coverage && plan.coverage.kind !== 'black-fill') throw new TypeError('Unsupported native observation coverage source.');
  const source = await sharp(input, {limitInputPixels: false}).raw().toBuffer({resolveWithObject:true});
  const display = await sharp(input, {limitInputPixels: false}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  if (source.info.width !== display.info.width || source.info.height !== display.info.height || display.info.channels !== 3 ||
      source.info.width < 2 || source.info.height < 2) throw new Error('Native observation source decode drifted.');
  const missing = plan.coverage ? blackFillCoverage(source.data, source.info, {southConnected: plan.coverage.southConnected}) : null;
  const {width,height}=display.info, modulo=(value:number,divisor:number)=>((value%divisor)+divisor)%divisor;
  return {sample(longitudeDegrees:number,latitudeDegrees:number,color:number[]) {
    if (!Number.isFinite(longitudeDegrees) || !Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) return false;
    const sourceX=modulo(longitudeDegrees,360)/360*width-.5,sourceY=Math.max(0,Math.min(height-1,(90-latitudeDegrees)/180*height-.5));
    const x0=Math.floor(sourceX),y0=Math.floor(sourceY),x1=x0+1,y1=Math.min(height-1,y0+1),xAmount=sourceX-x0,yAmount=sourceY-y0;
    color[0]=color[1]=color[2]=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++) {
      const weight=(dx?xAmount:1-xAmount)*(dy?yAmount:1-yAmount);if(weight===0)continue;
      const x=modulo(dx?x1:x0,width),y=dy?y1:y0,index=y*width+x;
      if(missing?.[index])return false;
      for(let channel=0;channel<3;channel++)color[channel]=(color[channel]??0)+display.data[index*3+channel]*weight;
    }
    color[3]=255;return true;
  }};
}

/** The same source interpretation feeds globe atlases and small, unwarped maps. */
export async function observationRaster({ input, plan, width, height, elevation, scientific, source, sourceMissing }: ObservationRasterInput): Promise<RasterImage> {
  if (plan.scientific && (plan.elevation || plan.coverage || plan.presentation)) throw new Error('Scientific rasters require a single numeric interpretation.');
  scientific ??= plan.scientific ? await loadScienceSurface(dirname(input), {...plan.scientific, path: basename(input)}) : null;
  elevation ??= plan.elevation ? decodeElevationGrid(await readFile(input), plan.elevation) : null;
  source ??= plan.coverage ? await sharp(input, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true }) : null;
  if (plan.coverage && plan.coverage.kind !== 'black-fill') throw new TypeError('Unsupported observed coverage source.');
  sourceMissing ??= source && plan.coverage ? blackFillCoverage(source.data, source.info, { southConnected: plan.coverage.southConnected }) : null;
  let raster: RasterImage & {missing?: Uint8Array};
  if (scientific) {
    if (!plan.scientific) throw new Error('Scientific raster requires its palette recipe.');
    const {rgb, missing} = paintScienceSurface(scientific, plan.scientific, width, height);
    raster = {data: rgb, info: {width, height, channels: 3}, missing};
  } else if (elevation) raster = elevationRaster(elevation, width, height);
  else {
    let pipeline = sharp(input, { limitInputPixels: false }).resize(width, height, { fit: 'fill' }).removeAlpha();
    if (plan.presentation) pipeline = applyTonalPresentation(pipeline, plan.presentation);
    if (plan.coverage) pipeline = pipeline.toColourspace('srgb');
    raster = await pipeline.raw().toBuffer({ resolveWithObject: true });
  }
  const { info } = raster;
  const missing = raster.missing ?? (sourceMissing && source && sampleCoverage(sourceMissing, source.info, width, height));
  return { info, data: missing ? paintMissingCoverage(raster.data, info, missing) : raster.data };
}

/** The declared photographic presentation: saturation, linear gain/offset and sharpening, in that order. */
export function applyTonalPresentation(pipeline: Sharp, presentation: TonalPresentation) {
  return pipeline.modulate({ saturation: presentation.saturation }).linear(presentation.linearGain, presentation.linearOffset).sharpen({ sigma: presentation.sharpenSigma });
}

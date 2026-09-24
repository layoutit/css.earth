import type { createRasterEmitter } from './raster-output.mts';
import type { loadRadialTerrain } from './radial-terrain.mts';
import type { loadScienceSurface } from './scientific-raster.mts';
import type { SurfaceObservation } from '../surface-observations/index.mts';
import type { SciencePalette } from './contracts.mts';

export type RasterAsset = Awaited<ReturnType<ReturnType<typeof createRasterEmitter>>>;
export interface SolidSurface extends Record<string, unknown> {
  id: string; textureScale?: number; displaySampling?: string; map: RasterAsset; surface: RasterAsset; thumbnail: RasterAsset;
  shadowSurface?: RasterAsset; polesUrl?: string; layout: unknown;
}
/** Input map exists before radial preparation fills its output atlas fields. */
export interface RadialMaterialSurface extends Record<string, unknown> {
  id:string;map:{url:string};textureScale?:number;displaySampling?:string;
  surface?:RasterAsset;shadowSurface?:RasterAsset;thumbnail?:RasterAsset;polesUrl?:string;layout?:unknown;
}
export type ScientificLens = SciencePalette & {id: string; format: string; displaySampling?: string; symbols?: unknown;
  surfaceSampling?: {maximumDistanceMeters: number}};
export type RadialState = NonNullable<Awaited<ReturnType<typeof loadRadialTerrain>>> & {
  scientificSurfaces?: Map<string, Awaited<ReturnType<typeof loadScienceSurface>>>;
  observationSurfaces?: Map<string, SurfaceObservation>;
};
export interface RadialMaterialConfig {
  namespace: string; publicBase: string;
  geometry: {radius: number; radiusKm: number; radialTerrain: {sourceLighting?: unknown; thumbnail?: unknown}};
  raster: {width: number; scientific?: ScientificLens[];
    observations?: readonly {id:string;validity:unknown;nativePhotographicSampling?:import('./native-photograph.mts').NativePhotographicSampling}[]};
}

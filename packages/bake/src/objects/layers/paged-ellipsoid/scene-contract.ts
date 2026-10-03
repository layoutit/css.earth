import { type CameraPlan } from '@cssearth/objects';

import type {Polygon} from '@layoutit/polycss';

import type { RasterRect } from '../../../scene/index.ts';
export type { PagedGeometryParameters } from '@cssearth/objects';
import type { PagedGeometryParameters } from '@cssearth/objects';
export interface PagedSceneProfile {namespace: string; publicBase: string; geometry: PagedGeometryParameters; camera: CameraPlan; polarRadiusKm: number; equatorialRadiusKm: number; sceneBodyKey: string; interiorRadiusKey: string;}
export interface InteriorSource extends Record<string, unknown> {
  qualification: string; sourceUrl: string; sourceId: number; tomographyPath?: string;
  layers: readonly {id: string; label: string; outerRadiusKm: number; innerRadiusKm: number; color: string}[];
  presentation?: {cutThroughCenter?: boolean; thumbnailCutawayDegrees?: number};
}
export interface SurfaceRasterSource {width: number; height: number; bandCount: number; gutter: number; overscan: number;}
export type GlobeTexture = {width: number; height: number; presentationCellSize?: number; raster?: SurfaceRasterSource; two?: string} &
  ({url: string; one?: string} | {url?: undefined; one: string});
export interface SphereConfiguration {
  latitudeSegments: number; longitudeSegments: number; equatorialRadius: number; polarRadius: number;
  texture: GlobeTexture; poles: GlobeTexture; surfaceClassName: string; polarClassName: string;
  polarCapBandSpan?: number; surfaceOverlap?: number; textureSeamBleed?: number; polarSurfaceOverlap?: number;
}
export interface RasterPolygon extends Polygon {latitudeIndex?: number; longitudeIndex?: number; polarCap?: 'north' | 'south'; presentationCellSize?: number; surfaceRaster?: SurfaceRasterSource; surfaceSourceRect?: RasterRect;}
export interface SpherePolygon extends RasterPolygon {latitudeIndex: number;}

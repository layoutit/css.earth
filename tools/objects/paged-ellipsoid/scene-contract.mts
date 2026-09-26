import type {Polygon} from '@layoutit/polycss';
import type {CameraPlan} from '@cssearth/renderer/navigation/types.ts';
import type {RasterRect} from '../../../src/platform/projective-surface-raster.mts';
import type {Cutaway} from './contracts.mts';
import type {SeamOutsetProfile} from '../../../src/renderers/css/preparation/scene/seam-outset.ts';
export type PagedGeometryParameters = Record<'BODY_LATITUDE_SEGMENTS' | 'BODY_LONGITUDE_SEGMENTS' | 'EQUATORIAL_RADIUS' | 'TILE_SIZE' | 'SEAM_BLEED' | 'PLANET_SEAM_BLEED' | 'INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE' | 'SURFACE_OVERLAP' | 'POLAR_CAP_BAND_SPAN' | 'POLAR_SURFACE_OVERLAP' | 'POLAR_INNER_OVERLAP' | 'POLAR_INNER_INSET' | 'MESH_ROTATION_Z' | 'CAMERA_ZOOM' | 'CAMERA_MINIMUM_CONTROL_PITCH_DEGREES' | 'CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES' | 'CAMERA_MILLISECONDS_PER_CONTROL_DEGREE' | 'INTERIOR_LATITUDE_SEGMENTS' | 'INTERIOR_LONGITUDE_SEGMENTS' | 'rotationSeconds', number> & {interiorCutaway: Cutaway; seamOutset?: SeamOutsetProfile};
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
  texture: GlobeTexture; poles: GlobeTexture; surfaceClassName: string; polarClassName: string; polarInnerClassName: string;
  includePolarInner?: boolean; polarCapBandSpan?: number; surfaceOverlap?: number; textureSeamBleed?: number; polarSurfaceOverlap?: number;
}
export interface RasterPolygon extends Polygon {latitudeIndex?: number; longitudeIndex?: number; polarCap?: 'north' | 'south'; presentationCellSize?: number; surfaceRaster?: SurfaceRasterSource; surfaceSourceRect?: RasterRect;}
export interface SpherePolygon extends RasterPolygon {latitudeIndex: number;}

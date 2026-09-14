import {array, boolean, dictionary, literal, number, object, optional, parse, record, string, tuple, union} from '../material-composition/data-schema.mts';
import type {Guard, Infer} from '../material-composition/data-schema.mts';
import type {PagedAssetConfiguration} from './asset-contract.mts';
import type {PagedRasterConfiguration} from './surface-raster.mts';
import type {PagedGeometryParameters} from './scene-contract.mts';
import {camera} from '../camera-source.mts';
import {parsePageRecipe} from '../geographic-pages/source-records.mts';

const geometry: Guard<PagedGeometryParameters> = object({BODY_LATITUDE_SEGMENTS: number, BODY_LONGITUDE_SEGMENTS: number, EQUATORIAL_RADIUS: number,
  TILE_SIZE: number, SEAM_BLEED: number, PLANET_SEAM_BLEED: number, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE: number,
  SURFACE_OVERLAP: number, POLAR_CAP_BAND_SPAN: number, POLAR_SURFACE_OVERLAP: number, POLAR_INNER_OVERLAP: number, POLAR_INNER_INSET: number,
  OBLIQUITY_DEGREES: number, PRESENTATION_NODE_DEGREES: number, MESH_ROTATION_Z: number, CAMERA_ZOOM: number, CAMERA_SCENE_PITCH_DEGREES: number,
  CAMERA_MINIMUM_CONTROL_PITCH_DEGREES: number, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES: number, CAMERA_DEFAULT_CONTROL_PITCH_DEGREES: number,
  CAMERA_MILLISECONDS_PER_CONTROL_DEGREE: number, INTERIOR_LATITUDE_SEGMENTS: number, INTERIOR_LONGITUDE_SEGMENTS: number, rotationSeconds: number,
  interiorCutaway: object({centerLongitudeDegrees: number, widthDegrees: number})});
const relief = object({referenceRadiusMeters: number, heightToMeters: optional(number), lightDirection: array(number), ambient: number});
const advisory = object({status: string, date: string});
const enso = {date: string, baseline: string, checked: string, advisory};
const colorByte: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 255;
const opacity: Guard<number> = (value): value is number => number(value) && value >= 0 && value <= 1;
const scientific = union(
  object({kind: literal('gibs-mur-imagery'), ...enso}),
  object({kind: literal('coraltemp-anomaly'), ...enso, filename: string, minimum: number, maximum: number, palette: array(array(number)), missingColor: array(number)}),
  object({kind: literal('gebco-elevation'), metadata: string, grid: object({width: number, height: number, firstIndex: number, stride: number, nativeCellDegrees: number}),
    palette: array(object({meters: number, color: string})), relief: optional(relief), blocks: optional(array(object({path: string, rowOffset: number, rows: number}))),
    legend: object({image: string, width: number, height: number, minimum: number, maximum: number})}),
  object({kind: literal('black-marble-radiance'), member: string, year: number, product: string, band: string, units: string, archiveBytes: number, archiveSha256: string,
    grid: object({width: number, height: number, cellDegrees: number, bounds: tuple(number, number, number, number)}),
    display: object({missing: tuple(number, number, number), softening: number, maximum: number}), legend: object({image: string})}));
const assetConfiguration: Guard<PagedAssetConfiguration & PagedRasterConfiguration> = object({namespace: string, publicBase: string, sceneBodyKey: string,
  interiorRadiusKey: string, interiorSchema: string, interiorPath: string, equatorialRadiusKm: number, polarRadiusKm: number, geometry, camera,
  atlas: object({pageSize: number, density: number, gutter: number, sourceWidth: number}),
  material: object({tileSize: number, presentationSize: number, framesPerShard: number, frameCount: number, discRadius: number, worldLight: tuple(number, number, number), solarTint: string,
    shadowlessOverlay: optional(object({color: tuple(colorByte, colorByte, colorByte), opacity})),
    illumination: object({frameCount: number, minimumLightViewZ: number, maximumLightViewZ: number, baseLightAzimuthDegrees: number})}),
  atmosphere: object({sourcePath: string, responsePath: string, sourceId: string, maximumOpacityKey: string}),
  surface: object({width: number, height: number, quality: number, clouds: object({path: string, maximumAlpha: number, threshold: number, scale: number, color: tuple(number, number, number)}),
    maps: array(object({path: string, name: string, thumbnail: string, scientific: optional(scientific), compositeClouds: optional(boolean), displayGamma: optional(number), nativePhotographicSampling: optional(boolean),
      thumbnailRegion: optional(object({longitude: optional(number), latitude: optional(number), spanDegrees: optional(number)})),
      webp: optional(object({quality: optional(number), effort: optional(number)}))}))})});
const profile = object({textureLevels: optional(object({widths:array(number),hysteresis:number,texelsPerCssPixel:number})),schema: literal('cssearth-paged-ellipsoid@1'), displayName: string, cityPath: string,
  destinations: object({searchLabel: string, descriptionSuffix: string, statuses: object({detail: string, overview: string})}),
  geographic: object({pages: record, noise: object({poolSize: number})})});
export function parsePagedProfile(value: unknown) {
  const assets = parse(value, assetConfiguration, 'paged ellipsoid assets');
  const metadata = parse(value, profile, 'paged ellipsoid profile');
  // The geographic operator owns the complete page schema. Its decoder preserves
  // all source fields; the profile retains their original JSON values as well.
  const pages = parsePageRecipe(metadata.geographic.pages);
  return Object.assign({}, assets, metadata, {geographic: {...metadata.geographic, pages}});
}
export const isPagedEllipsoidRecipe = (value: unknown): boolean => record(value) && value.schema === 'cssearth-paged-ellipsoid@1';
const lens = object({id: string, maximumZoom: number, view: optional(string), surfaceBankId: optional(string), surfaceUrl: optional(string),
  polesUrl: optional(string), surfacePagePrefix: optional(string), cityZoom: optional(boolean), overlayId: optional(string), interiorTextures: optional(dictionary(string)),
  focus: optional(object({longitude: number, latitude: number, zoom: number, northUp: optional(boolean),
    transition: optional(object({durationMilliseconds: number, preserveZoom: boolean}))}))});
const lenses = object({defaultLens: string, controls: array(lens)});
export const parsePagedLensBindings = (value: unknown) => parse(value, lenses, 'paged lens bindings');
export type PagedLensBindings = Infer<typeof lenses>;

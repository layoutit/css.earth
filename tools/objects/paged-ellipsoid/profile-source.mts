import {array, boolean, dictionary, literal, number, object, optional, parse, record, string, tuple, union, type Guard, type Infer} from '@cssearth/core/schema';
import type {PagedAssetConfiguration} from './asset-contract.mts';
import type {PagedRasterConfiguration} from './surface-raster.mts';
import type {PagedGeometryParameters} from './scene-contract.mts';
import {DERIVED_CAMERA_ANGLE_FIELDS, recipeCamera} from '../camera-source.mts';
import {preparedControlPitch} from '@cssearth/engine';
import {LIT_DEFAULT_VIEW} from '../../../src/platform/default-camera.mts';

const geometry: Guard<PagedGeometryParameters> = object({BODY_LATITUDE_SEGMENTS: number, BODY_LONGITUDE_SEGMENTS: number, EQUATORIAL_RADIUS: number,
  TILE_SIZE: number, SEAM_BLEED: number, PLANET_SEAM_BLEED: number, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE: number,
  SURFACE_OVERLAP: number, POLAR_CAP_BAND_SPAN: number, POLAR_SURFACE_OVERLAP: number, POLAR_INNER_OVERLAP: number, POLAR_INNER_INSET: number,
  MESH_ROTATION_Z: number, CAMERA_ZOOM: number,
  CAMERA_MINIMUM_CONTROL_PITCH_DEGREES: number, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES: number,
  CAMERA_MILLISECONDS_PER_CONTROL_DEGREE: number, INTERIOR_LATITUDE_SEGMENTS: number, INTERIOR_LONGITUDE_SEGMENTS: number, rotationSeconds: number,
  interiorCutaway: object({centerLongitudeDegrees: number, widthDegrees: number}),
  seamOutset: optional(object({targetPixels: number, stepRatio: number, hysteresis: number, firstDiameter: number, lastDiameter: number}))});
const relief = object({referenceRadiusMeters: number, heightToMeters: optional(number), lightDirection: array(number), ambient: number});
const advisory = object({status: string, date: string});
const enso = {date: string, baseline: string, checked: string, advisory};
const colorByte: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 255;
const opacity: Guard<number> = (value): value is number => number(value) && value >= 0 && value <= 1;
const blendPixels: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 512;
const fillTolerance: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 32;
// A second edition of the same source month supplies the pixels the plain
// edition filled with one arbitrary constant; the rule states that constant.
const deepOceanFill = object({path: string, replacedColor: tuple(colorByte, colorByte, colorByte), tolerance: fillTolerance, blendSourcePixels: blendPixels});
const scientific = union(
  object({kind: literal('gibs-mur-imagery'), ...enso}),
  object({kind: literal('coraltemp-anomaly'), ...enso, filename: string, minimum: number, maximum: number, palette: array(array(number)), missingColor: array(number)}),
  object({kind: literal('gebco-elevation'), metadata: string, grid: object({width: number, height: number, firstIndex: number, stride: number, nativeCellDegrees: number}),
    palette: array(object({meters: number, color: string})), relief: optional(relief), blocks: optional(array(object({path: string, rowOffset: number, rows: number}))),
    legend: object({image: string, width: number, height: number, minimum: number, maximum: number})}),
  object({kind: literal('black-marble-radiance'), member: string, year: number, product: string, band: string, units: string, archiveBytes: number,
    grid: object({width: number, height: number, cellDegrees: number, bounds: tuple(number, number, number, number)}),
    display: object({missing: tuple(number, number, number), softening: number, maximum: number}), legend: object({image: string})}));
const assetConfiguration: Guard<Omit<PagedAssetConfiguration & PagedRasterConfiguration, 'camera'> & {camera: Infer<typeof recipeCamera>}> = object({namespace: string, publicBase: string, sceneBodyKey: string,
  interiorRadiusKey: string, interiorSchema: string, interiorPath: string, equatorialRadiusKm: number, polarRadiusKm: number, geometry, camera: recipeCamera,
  atlas: object({pageSize: number, density: number, gutter: number, sourceWidth: number}),
  material: object({tileSize: number, presentationSize: number, framesPerShard: number, frameCount: number, discRadius: number, solarTint: string,
    shadowlessOverlay: optional(object({color: tuple(colorByte, colorByte, colorByte), opacity})),
    illumination: object({frameCount: number, minimumLightViewZ: number, maximumLightViewZ: number, baseLightAzimuthDegrees: number})}),
  atmosphere: object({sourcePath: string, responsePath: string, sourceId: string, maximumOpacityKey: string}),
  surface: object({width: number, height: number, quality: number, clouds: object({path: string, maximumAlpha: number, threshold: number, scale: number, color: tuple(number, number, number)}),
    maps: array(object({path: string, name: string, thumbnail: string, scientific: optional(scientific), compositeClouds: optional(boolean), displayGamma: optional(number), nativePhotographicSampling: optional(boolean),
      deepOceanFill: optional(deepOceanFill),
      thumbnailRegion: optional(object({longitude: optional(number), latitude: optional(number), spanDegrees: optional(number)})),
      webp: optional(object({quality: optional(number), effort: optional(number)}))}))})});
const profile = object({textureLevels: optional(object({widths:array(number),fixedWidth:optional(number),maximumWidth:optional(number),hysteresis:number,texelsPerCssPixel:number})),schema: literal('cssearth-paged-ellipsoid@1'), displayName: string,
  destinations: object({searchLabel: string, descriptionSuffix: string, statuses: object({detail: string, overview: string})}),
  geographic: object({places: record})});
/** Orientation, light and default camera angles are derived at preparation; a recipe that states them is stale. */
const DERIVED_RECIPE_FIELDS = {geometry: ['OBLIQUITY_DEGREES', 'PRESENTATION_NODE_DEGREES', 'CAMERA_SCENE_PITCH_DEGREES', 'CAMERA_DEFAULT_CONTROL_PITCH_DEGREES'],
  material: ['worldLight'], camera: DERIVED_CAMERA_ANGLE_FIELDS} as const;
export function parsePagedProfile(value: unknown) {
  for (const [block, keys] of Object.entries(DERIVED_RECIPE_FIELDS)) {
    const section = record(value) ? value[block] : undefined;
    const stated = record(section) ? keys.filter(key => Object.hasOwn(section, key)) : [];
    if (stated.length) throw new TypeError(`Paged ellipsoid ${block} states ${stated.join(', ')}, which preparation derives.`);
  }
  const parsed = parse(value, assetConfiguration, 'paged ellipsoid assets');
  const controlPitch = preparedControlPitch(LIT_DEFAULT_VIEW.initialScenePitchDegrees, parsed.camera);
  const assets = {...parsed, camera: {...parsed.camera, ...LIT_DEFAULT_VIEW, defaultControlPitchDegrees: controlPitch,
    materialReferenceControlPitchDegrees: controlPitch, materialReferenceControlYawDegrees: LIT_DEFAULT_VIEW.defaultControlYawDegrees}};
  const metadata = parse(value, profile, 'paged ellipsoid profile');
    // The profile guard returns the recipe object itself, so the derived camera goes last.
  return Object.assign({}, assets, metadata, {camera: assets.camera});
}
export const isPagedEllipsoidRecipe = (value: unknown): boolean => record(value) && value.schema === 'cssearth-paged-ellipsoid@1';
const lens = object({id: string, maximumZoom: number, view: optional(string), surfaceBankId: optional(string), surfaceUrl: optional(string),
  polesUrl: optional(string), surfacePagePrefix: optional(string), interiorTextures: optional(dictionary(string)),
  focus: optional(object({longitude: number, latitude: number, zoom: number, northUp: optional(boolean),
    transition: optional(object({durationMilliseconds: number, preserveZoom: boolean}))}))});
const lenses = object({defaultLens: string, controls: array(lens)});
export const parsePagedLensBindings = (value: unknown) => parse(value, lenses, 'paged lens bindings');
export type PagedLensBindings = Infer<typeof lenses>;

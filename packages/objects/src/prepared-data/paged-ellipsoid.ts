import { PAGED_ELLIPSOID_SCHEMA } from './presentation-recipe-schemas.ts';
import {array, boolean, dictionary, literal, number, object, optional, parse, record, string, tuple, union, type Guard, type Infer} from '@cssearth/core/schema';
import { DERIVED_CAMERA_ANGLE_FIELDS, recipeCamera } from './authored-camera.ts';
const geometry = object({BODY_LATITUDE_SEGMENTS: number, BODY_LONGITUDE_SEGMENTS: number, EQUATORIAL_RADIUS: number,
  TILE_SIZE: number, SEAM_BLEED: number, PLANET_SEAM_BLEED: number, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE: number,
  SURFACE_OVERLAP: number, POLAR_CAP_BAND_SPAN: number, POLAR_SURFACE_OVERLAP: number,
  MESH_ROTATION_Z: number, CAMERA_ZOOM: number,
  CAMERA_MINIMUM_CONTROL_PITCH_DEGREES: number, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES: number,
  CAMERA_MILLISECONDS_PER_CONTROL_DEGREE: number, INTERIOR_LATITUDE_SEGMENTS: number, INTERIOR_LONGITUDE_SEGMENTS: number, rotationSeconds: number,
  interiorCutaway: object({centerLongitudeDegrees: number, widthDegrees: number}),
  seamOutset: optional(object({targetPixels: number, stepRatio: number, hysteresis: number, firstDiameter: number, lastDiameter: number}))});
const relief = object({referenceRadiusMeters: number, heightToMeters: optional(number), lightDirection: array(number), ambient: number});
const advisory = object({status: string, date: string});
const enso = {date: string, baseline: string, checked: string, advisory};
const colorByte: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 255;
const blendPixels: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 512;
const fillTolerance: Guard<number> = (value): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= 32;
// A second edition of the same source month supplies the pixels the plain
// edition filled with one arbitrary constant; the rule states that constant.
const deepOceanFill = object({path: string, replacedColor: tuple(colorByte, colorByte, colorByte), tolerance: fillTolerance, blendSourcePixels: blendPixels});
const scientific = union(
  object({kind: literal('gibs-mur-imagery'), ...enso}),
  object({kind: literal('gebco-elevation'), metadata: string, grid: object({width: number, height: number, firstIndex: number, stride: number, nativeCellDegrees: number}),
    palette: array(object({meters: number, color: string})), relief: optional(relief), blocks: optional(array(object({path: string, rowOffset: number, rows: number}))),
    legend: object({image: string, width: number, height: number, minimum: number, maximum: number})}));
const assetConfiguration = object({namespace: string, publicBase: string, sceneBodyKey: string,
  interiorRadiusKey: string, interiorSchema: string, interiorPath: string, equatorialRadiusKm: number, polarRadiusKm: number, geometry, camera: recipeCamera,
  atlas: object({pageSize: number, pageCells: number, density: number, gutter: number, sourceWidth: number}),
  material: object({tileSize: number, presentationSize: number, framesPerShard: number, frameCount: number, discRadius: number,
    illumination: object({frameCount: number, minimumLightViewZ: number, maximumLightViewZ: number, baseLightAzimuthDegrees: number})}),
  atmosphere: object({sourcePath: string, responsePath: string, sourceId: string, maximumOpacityKey: string}),
  limb: object({models: tuple(string, string, string), reference: string, referenceDisplayGamma: number}),
  surface: object({width: number, height: number, quality: number, clouds: object({path: string, maximumAlpha: number, threshold: number, scale: number, color: tuple(number, number, number)}),
    maps: array(object({path: string, name: string, thumbnail: string, scientific: optional(scientific), compositeClouds: optional(boolean), displayGamma: optional(number), nativePhotographicSampling: optional(boolean), maximumTextureWidth: optional(number),
      deepOceanFill: optional(deepOceanFill),
      thumbnailRegion: optional(object({longitude: optional(number), latitude: optional(number), spanDegrees: optional(number)})),
      webp: optional(object({quality: optional(number), effort: optional(number)}))}))})});
const profile = object({textureLevels: optional(object({widths:array(number),fixedWidth:optional(number),maximumWidth:optional(number),hysteresis:number,texelsPerCssPixel:number})),schema: literal(PAGED_ELLIPSOID_SCHEMA), displayName: string,
  destinations: object({searchLabel: string, descriptionSuffix: string, statuses: object({detail: string, overview: string})}),
  geographic: object({places: record})});
/** Orientation, light and default camera angles are derived at preparation; a recipe that states them is stale. */
const DERIVED_RECIPE_FIELDS = {geometry: ['OBLIQUITY_DEGREES', 'PRESENTATION_NODE_DEGREES', 'CAMERA_SCENE_PITCH_DEGREES', 'CAMERA_DEFAULT_CONTROL_PITCH_DEGREES'],
  material: ['worldLight'], camera: DERIVED_CAMERA_ANGLE_FIELDS} as const;
function parsePagedAssets(value: unknown) {
  for (const [block, keys] of Object.entries(DERIVED_RECIPE_FIELDS)) {
    const section = record(value) ? value[block] : undefined;
    const stated = record(section) ? keys.filter(key => Object.hasOwn(section, key)) : [];
    if (stated.length) throw new TypeError(`Paged ellipsoid ${block} states ${stated.join(', ')}, which preparation derives.`);
  }
  const parsed = parse(value, assetConfiguration, 'paged ellipsoid assets');
  const metadata = parse(value, profile, 'paged ellipsoid profile');
  return Object.assign({}, parsed, metadata);
}
export const isPagedEllipsoidRecipe = (value: unknown): boolean => record(value) && value.schema === PAGED_ELLIPSOID_SCHEMA;
const dataset = object({id: string, maximumZoom: number, view: optional(string), surfaceBankId: optional(string), surfaceUrl: optional(string),
  polesUrl: optional(string), surfacePagePrefix: optional(string), interiorTextures: optional(dictionary(string)),
  focus: optional(object({longitude: number, latitude: number, zoom: number, northUp: optional(boolean),
    transition: optional(object({durationMilliseconds: number, preserveZoom: boolean}))}))});
const datasets = object({defaultDataset: string, controls: array(dataset)});
export const parsePagedDatasetBindings = (value: unknown) => parse(value, datasets, 'paged dataset bindings');
export type PagedDatasetBindings = Infer<typeof datasets>;

export type PagedEllipsoidRecipe = ReturnType<typeof parsePagedAssets>;
export type PagedGeometryParameters = Infer<typeof geometry>;

/** Navigation reads historically admit only these fields, independently of full asset preparation. */
export function parsePagedRecipe(value: unknown): ReturnType<typeof parsePagedAssets>;
export function parsePagedRecipe(value: unknown, admission: 'surface-arc'): { sourceWidth: number; density: number; texelsPerCssPixel: number } | undefined;
export function parsePagedRecipe(value: unknown, admission: 'drag'): { model: string } | undefined;
export function parsePagedRecipe(value: unknown, admission?: 'surface-arc' | 'drag') {
  if (admission === undefined) return parsePagedAssets(value);
  const get = (v: unknown, key: string): unknown => v == null ? undefined : (Object(v) as Record<string, unknown>)[key];
  if (admission === 'surface-arc') {
    if (get(value, 'schema') !== PAGED_ELLIPSOID_SCHEMA) return undefined;
    const atlas = get(value, 'atlas'), levels = get(value, 'textureLevels');
    const sourceWidth = get(atlas, 'sourceWidth'), density = get(atlas, 'density'), texelsPerCssPixel = get(levels, 'texelsPerCssPixel');
    if (!(Number.isInteger(sourceWidth) && Number(sourceWidth) > 0 && Number.isInteger(density) && Number(density) > 0 && Number(texelsPerCssPixel) >= 1)) {
      throw new TypeError(`${String(get(value, 'namespace'))}: paged ellipsoid zoom limit needs atlas.sourceWidth, atlas.density and textureLevels.texelsPerCssPixel; found ${String(sourceWidth)}, ${String(density)} and ${String(texelsPerCssPixel)}.`);
    }
    return { sourceWidth: Number(sourceWidth), density: Number(density), texelsPerCssPixel: Number(texelsPerCssPixel) };
  }
  const drag = get(get(value, 'camera'), 'drag');
  if (drag === undefined) return undefined;
  const model = get(drag, 'model');
  if (model !== 'screen-axis-tumble' && model !== 'pole-held-tumble') {
    throw new TypeError(`${String(get(value, 'namespace'))}: paged-ellipsoid camera.drag.model must be screen-axis-tumble or pole-held-tumble; found ${JSON.stringify(drag)}.`);
  }
  return { model };
}

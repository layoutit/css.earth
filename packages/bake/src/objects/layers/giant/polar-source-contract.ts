import {array, boolean, dictionary, json, literal, number, object, optional, parse, string, tuple, union} from '@cssearth/core/schema';
const fit = literal('cover', 'contain', 'fill', 'inside', 'outside');
const files = object({surface: string, surface2x: string, poles: string, poles2x: string, thumbnail: string});
const control = object({id: string, label: string, shortLabel: string, measurement: string, thumbnailUrl: string, surfaceUrl: string, surface2xUrl: string,
  polesUrl: string, poles2xUrl: string, falseColor: boolean, qualification: string,
  step: optional(object({group:string,label:string}))});
const projection = object({boundaryLatitudeDegrees: number, projection: optional(literal('latitude-linear', 'orthographic')), overlap: optional(number), alphaOpaqueRadius: optional(number), alphaTransparentRadius: optional(number)});
/** Polar detail overrides are forbidden: all datasets use the recipe-level projection. */
const forbiddenPolarDetailOverride = (value: unknown): value is undefined => value === undefined;
const dataset = union(
  object({id:string, operation:literal('rgb-observed-gaps'), source:string, files, control,
    polarDetails:forbiddenPolarDetailOverride, coverageSources:array(string), planetographicAxisRatio:number, projection}),
  // A color map whose publisher marks its bad data in a mask image of the map's size: a pixel the mask shows darker than
  // half brightness is missing. Its rows are planetographic, as an `rgb-observed-gaps` map's are.
  object({id: string, operation: literal('rgb-published-mask'), source: string, files, control, polarDetails: forbiddenPolarDetailOverride,
    coverageMask: string, planetographicAxisRatio: number, projection}),
  // A color map with no per-band coverage maps: its measured rows are pinned, and every row outside them is missing.
  object({id: string, operation: literal('rgb-measured-rows'), source: string, files, control, polarDetails: forbiddenPolarDetailOverride,
    coverage: object({columnStride: number, minimumMean: number, firstMeasuredRow: number, lastMeasuredRow: number}), projection}),
  object({id: string, operation: literal('scalar-observed-gaps'), source: string, files, control: forbiddenPolarDetailOverride, polarDetails: forbiddenPolarDetailOverride,
    label: string, shortLabel: string, filter: string, wavelength: string, measurement: string, qualification: string, structuralAuthority: optional(string),
    palette: array(tuple(number, number, number)), scalar: object({bitpix: number, width: number, height: number, percentiles: tuple(number, number), minimumCoverageFraction: number,
      noData: literal(0), coverage: literal('polar-connected-zero','finite'), range:optional(tuple(number,number)), gamma:optional(number), lossless:optional(boolean)}),
    projection}));
const encoding = object({quality: optional(number), alphaQuality: optional(number), effort: optional(number), smartSubsample: optional(boolean)});
const recipe = object({schema: literal('cssearth-observed-polar-surfaces@2'), namespace: string, publicPrefix: string,
  datasets: array(dataset),
  dimensions: object({width: number, height: number, polarTileSize: number}), packing: object({latitudeBoundsDegrees: array(number), gutter: number}),
  thumbnail: object({width: number, height: number, fit, position: union(string, number)}),
  encoding: object({surface: encoding, polar: encoding, thumbnail: encoding}), descriptor: dictionary(json)});
export const parseObservedPolarSource = (value: unknown) => parse(value, recipe, 'observed polar recipe');

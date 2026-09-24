import {array, boolean, dictionary, json, literal, number, object, optional, parse, string, tuple, union} from '../material-composition/data-schema.mts';
import type {Infer} from '../material-composition/data-schema.mts';
const fit = literal('cover', 'contain', 'fill', 'inside', 'outside');
const resize = object({fit: optional(fit), position: optional(union(string, number))});
const detailImage = object({path: string, extract: optional(object({left: number, top: number, width: number, height: number})), resize: optional(resize)});
export type DetailImage = Infer<typeof detailImage>;
const detail = object({structure: detailImage, palette: detailImage, contrast: number, tint: number, structureRadius: optional(number)});
const details = object({north: optional(detail), south: optional(detail)});
const files = object({surface: string, surface2x: string, poles: string, poles2x: string, thumbnail: string});
const control = object({id: string, label: string, shortLabel: string, measurement: string, thumbnailUrl: string, surfaceUrl: string, surface2xUrl: string,
  polesUrl: string, poles2xUrl: string, falseColor: boolean, qualification: string});
const absent = (value: unknown): value is undefined => value === undefined;
const lens = union(
  object({id: string, operation: literal('rgb-polar-structure'), source: string, files, control, polarDetails: details,
    coverage: object({columnStride: number, minimumMean: number, firstMeasuredRow: number, lastMeasuredRow: number}),
    continuation: object({edgeLatitudeDegrees: number, overlap: optional(number), detailLookbackDegrees: optional(number), detailBlendStartRadius: optional(number),
      detailBlendEndRadius: optional(number), edgeStructureWeight: optional(number), alphaOpaqueRadius: optional(number), alphaTransparentRadius: optional(number), measuredProjectionEdgeLatitudeDegrees: optional(number)}),
    transition: object({transitionStartLatitudeDegrees: optional(number), transitionEndLatitudeDegrees: optional(number), edgeStructureWeight: optional(number), innerDetailRadius: optional(number), outerDetailRadius: optional(number)})}),
  object({id: string, operation: literal('scalar-observed-gaps'), source: string, files, control: absent, polarDetails: optional(details),
    label: string, shortLabel: string, filter: string, wavelength: string, measurement: string, qualification: string, structuralAuthority: optional(string),
    palette: array(tuple(number, number, number)), scalar: object({bitpix: number, width: number, height: number, percentiles: tuple(number, number), minimumCoverageFraction: number,
      noData: literal(0), coverage: literal('polar-connected-zero')}),
    projection: object({boundaryLatitudeDegrees: number, projection: optional(literal('latitude-linear', 'orthographic')), overlap: optional(number), alphaOpaqueRadius: optional(number), alphaTransparentRadius: optional(number)})}));
const encoding = object({quality: optional(number), alphaQuality: optional(number), effort: optional(number), smartSubsample: optional(boolean)});
const recipe = object({schema: literal('cssearth-observed-polar-surfaces@1'), namespace: string, publicPrefix: string,
  lenses: array(lens),
  dimensions: object({width: number, height: number, polarTileSize: number}), packing: object({latitudeBoundsDegrees: array(number), gutter: number}),
  thumbnail: object({width: number, height: number, fit, position: union(string, number)}),
  encoding: object({surface: encoding, polar: encoding, thumbnail: encoding}), descriptor: dictionary(json)});
export const parseObservedPolarSource = (value: unknown) => parse(value, recipe, 'observed polar recipe');

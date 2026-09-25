import {array, boolean, dictionary, json, literal, nil, number, object, optional, parse, string, union, type Infer} from '@cssearth/core/schema';
const axis = object({minimum: number, step: number, count: number});
const tomography = object({schema: literal('cssearth-mantle-tomography@1'), depth: axis, latitude: axis, longitude: axis,
  geographicLongitudeOffsetDegrees: number, sectionLongitudesDegrees: array(number), modelRadiusKm: number, shellDepthKm: number,
  gridPath: string, missingColor: string, palette: array(object({percent: number, color: string})),
  legend: object({image: string, width: number, height: number}), webp: optional(object({quality: number, effort: number, smartSubsample: (value): value is boolean => typeof value === 'boolean'})),
  schematicColors: optional(dictionary(string))});
export type TomographyRecipe = Infer<typeof tomography>;
export const parseTomographyRecipe = (value: unknown) => parse(value, tomography, 'mantle tomography recipe');
const response = object({schema: string, observedResponse: object({exposure: number, exposureRole: string, skyAlphaLuminanceScale: number}),
  cleanRoomTransfer: object({bodySunIntensitySource: string, mieContribution: number}),
  transferPolicy: object({googlePixelsRedistributed: literal(false), googleShaderBytesRedistributed: literal(false)})});
export function parseAtmosphereResponse(value: unknown) {
  // Preserve provenance and response fields beyond those consumed by this operator.
  parse(value, json, 'atmosphere response data');
  return parse(value, response, 'atmosphere response');
}
const murTile = object({row: number, col: number, url: string, actualTime: union(string, nil), actualLayer: union(string, nil), empty: boolean, bytes: number});
const murReceipt = object({schema: literal('cssearth-mur-gibs@1'), date: string, complete: boolean, grid: object({level: number}), tiles: array(murTile),
  checked: string, baseline: string, sourceBytes: number, archiveBytes: number,
  mosaic: object({width: number, height: number, sourceWidth: number, sourceHeight: number, sampling: string, covered: number, missing: number})});
export const parseMurReceipt = (value: unknown) => parse(value, murReceipt, 'MUR receipt');

const advisory = object({status: string, date: string});
const coraltemp = object({kind: literal('coraltemp-anomaly'), date: string, baseline: string, checked: string, advisory, filename: string,
  minimum: number, maximum: number, palette: array(array(number)), missingColor: array(number)});
export const parseCoraltempRecipe = (value: unknown) => parse(value, coraltemp, 'CoralTemp recipe');

const interiorSource = object({schema: string, qualification: string, sourceUrl: string, sourceId: number, tomographyPath: optional(string),
  layers: array(object({id: string, label: string, outerRadiusKm: number, innerRadiusKm: number, color: string})),
  presentation: optional(object({cutThroughCenter: optional(boolean), thumbnailCutawayDegrees: optional(number)}))});
export const parseInteriorSource = (value: unknown): import('./scene-contract.mts').InteriorSource => parse(value, interiorSource, 'interior source');
const mapFocusBindings = object({controls: array(object({surfacePagePrefix: optional(string), focus: optional(object({longitude: number}))}))});
export const parseMapFocusBindings = (value: unknown) => parse(value, mapFocusBindings, 'map focus bindings');

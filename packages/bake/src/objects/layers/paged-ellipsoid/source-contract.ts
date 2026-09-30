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
/** The native 1 km grid of one MUR analysis date: 80 × 40 tiles of 512 pixels. */
export const murTileCount = 3200;
// One analysis date's acquisition. Each tile's URL follows from the date and its row and column; each tile with
// observations attested that date and analysis in its response headers when it was acquired.
const murReceipt = object({schema: literal('cssearth-mur-gibs@2'), date: string, grid: object({level: number}),
  tiles: object({bytes: array(number), empty: array(number)}), checked: string, baseline: string, sourceBytes: number, archiveBytes: number,
  mosaic: object({width: number, height: number, sourceWidth: number, sourceHeight: number, sampling: string, covered: number, missing: number})});
export function parseMurReceipt(value: unknown) {
  const receipt = parse(value, murReceipt, 'MUR receipt');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.date) || receipt.tiles.bytes.length !== murTileCount || !receipt.tiles.bytes.every(bytes => Number.isInteger(bytes) && bytes > 0)
    || !receipt.tiles.empty.every((index, at, all) => Number.isInteger(index) && index >= 0 && index < murTileCount && (at === 0 || index > all[at - 1]!)))
    throw new TypeError(`MUR receipt ${receipt.date}: needs one positive byte count per tile of the ${murTileCount}-tile grid and ascending empty tile indices.`);
  return receipt;
}

const advisory = object({status: string, date: string});

const interiorSource = object({schema: string, qualification: string, sourceUrl: string, sourceId: number, tomographyPath: optional(string),
  layers: array(object({id: string, label: string, outerRadiusKm: number, innerRadiusKm: number, color: string})),
  presentation: optional(object({cutThroughCenter: optional(boolean), thumbnailCutawayDegrees: optional(number)}))});
export const parseInteriorSource = (value: unknown): import('./scene-contract.ts').InteriorSource => parse(value, interiorSource, 'interior source');
const mapFocusBindings = object({controls: array(object({surfacePagePrefix: optional(string), focus: optional(object({longitude: number}))}))});
export const parseMapFocusBindings = (value: unknown) => parse(value, mapFocusBindings, 'map focus bindings');

import * as s from '../material-composition/data-schema.mts';
const n = s.number, str = s.string, opt = s.optional, arr = s.array, obj = s.object;
export const vector2 = s.tuple(n, n), vector3 = s.tuple(n, n, n);
export const sourcePin = obj({path: str});
export type SourcePin = s.Infer<typeof sourcePin>;
export const webpEncoding = obj({quality: opt(n), alphaQuality: opt(n), lossless: opt(s.boolean), nearLossless: opt(s.boolean), smartSubsample: opt(s.boolean), effort: opt(n), preset: opt(s.literal('default', 'picture', 'photo', 'drawing', 'icon', 'text'))});
const radiusMapping = s.union(obj({kind: s.literal('linear'), scale: n}), obj({kind: s.literal('piecewise-log'), knots: arr(vector2)}));
export type RadiusMapping = s.Infer<typeof radiusMapping>;
const bandCommon = {color: vector3, opacity: n, arcs: opt(obj({centers: arr(n), halfWidth: n}))};
const band = s.union(
  obj({...bandCommon, envelope: s.literal('constant'), bounds: vector2, inclusive: opt(s.tuple(s.boolean, s.boolean))}),
  obj({...bandCommon, envelope: s.literal('tent'), center: n, width: n, edgeGain: n, minimumHalfWidthPixels: opt(n)}),
  obj({...bandCommon, envelope: s.literal('smooth-annulus'), bounds: vector2, fade: vector2, minimumPresentationWidth: opt(n)}),
);
export type RadialBand = s.Infer<typeof band>;
const shadow = obj({direction: vector3, equatorialRadius: n, polarRadius: n, luminance: n});
export type RadialShadow = s.Infer<typeof shadow>;
const variant = obj({output: str, palette: s.tuple(vector3, vector3, vector3), outerRadius: n, exponent: n, gain: n, outerGain: n, luminance: vector3, radialGains: arr(obj({upperBound: n, gain: n})), encoding: webpEncoding});
export type RadialVariant = s.Infer<typeof variant>;
const overlay = obj({kind: s.literal('projected-strip-shadow'), bodyRadius: n, outerRadius: n, direction: vector2, color: vector3, startFraction: n, edgeFraction: n, maximumAlpha: n, centerInset: n, marginPixels: n, output: str, encoding: webpEncoding});
export type RadialOverlay = s.Infer<typeof overlay>;
const common = {size: n, densities: arr(n), output: str, encoding: webpEncoding, densityMode: opt(s.literal('independent', 'downsample-highest')), overlays: opt(arr(overlay)), variants: opt(arr(variant))};
const annular = obj({...common, kind: s.literal('annular-field'), outerRadius: n, grid: obj({centerInset: n, sampleOffset: n, marginPixels: n, scaleOrder: s.literal('divide-multiply', 'multiply-hypot')}), composition: s.literal('maximum', 'front-to-back'), alphaUnits: n, maximumAlpha: n, mapping: radiusMapping, bands: arr(band), defaultColor: opt(vector3), shadow: opt(shadow), wedges: opt(obj({count: n}))});
export type AnnularLayer = s.Infer<typeof annular>;
const operationCommon = {bounds: vector2, inclusive: opt(s.tuple(s.boolean, s.boolean))};
const operation = s.union(
  obj({...operationCommon, kind: s.literal('clear')}),
  obj({...operationCommon, kind: s.literal('alpha-cap'), maximum: n}),
  obj({...operationCommon, kind: s.literal('alpha-gain'), gain: n}),
  obj({...operationCommon, kind: s.literal('edge-core'), center: n, sigma: n, baseDepth: n, peakDepth: n}),
);
/** A PDS3 occultation SERIES table: one row per radial bin with a normal optical depth column and a quality flag column. */
const opticalDepthProfile = obj({path: str, radiusColumn: n, opticalDepthColumn: n, flagColumn: n, corruptedFlag: n, missingValue: n});
const observed = obj({...common, kind: s.literal('observed-radial-profile'), bounds: vector2, sourceBounds: vector2, colorSource: opt(str), transparencySource: opt(str), opticalDepthProfile: opt(opticalDepthProfile), color: opt(vector3), channelFactors: vector3, interior: obj({color: vector3, centers: arr(n), sigma: n, baseAlpha: n, peakAlpha: n}), operations: arr(operation), readability: obj({features: arr(obj({kind: str, radius: n, additionalPixels: opt(n), alphaGain: opt(n), alphaScale: opt(n)})), alphaGain: n, minimumPixels: s.dictionary(n)})});
export type ObservedRadialLayer = s.Infer<typeof observed>;
export const radialRecipe = obj({schema: s.literal('cssearth-radial-layer-recipe@1'), units: s.literal('kilometers'), sources: arr(sourcePin), layers: arr(s.union(annular, observed))});
export type RadialLayerRecipe = s.Infer<typeof radialRecipe>;
export interface RadialProfile {color: Uint8Array; transparency: Uint8Array; width: number}
export const runtimeAssetManifest = obj({assets: arr(obj({filename:str,bytes:n,sha256:str}))});

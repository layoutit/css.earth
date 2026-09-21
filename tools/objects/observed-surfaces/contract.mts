import * as s from '../material-composition/data-schema.mts';
import {sourcePin, vector2, vector3, webpEncoding} from '../giant-layers/radial-contract.mts';
const n = s.number, str = s.string, opt = s.optional, arr = s.array, obj = s.object;
const region = obj({left: n, top: n, width: n, height: n});
export type Region = s.Infer<typeof region>;
const resizeOptions = obj({kernel: opt(s.literal('nearest', 'cubic', 'mitchell', 'lanczos2', 'lanczos3', 'mks2013', 'mks2021')), fit: opt(s.literal('cover', 'contain', 'fill', 'inside', 'outside')), withoutEnlargement: opt(s.boolean)});
const sharpenOptions = obj({sigma: n, m1: opt(n), m2: opt(n), x1: opt(n), y2: opt(n), y3: opt(n)});
const transform = s.union(obj({kind: s.literal('flip')}), obj({kind: s.literal('crop'), region}), obj({kind: s.literal('resize'), width: n, height: n, options: opt(resizeOptions)}), obj({kind: s.literal('sharpen'), options: sharpenOptions}));
export type ObservationTransform = s.Infer<typeof transform>;
const continuation = obj({boundaryFraction: n, exponent: n, minimumBoundarySum: opt(n)});
export type BoundaryContinuation = s.Infer<typeof continuation>;
const color = obj({channels: s.literal(3, 4), palette: s.tuple(vector3, vector3, vector3), percentiles: vector2, transfer: s.literal('sqrt', 'power'), exponent: n, minimumCoverage: n, positiveValidity: opt(s.boolean)});
export type FalseColor = s.Infer<typeof color>;
const decode = s.union(obj({kind: s.literal('raster'), channels: s.literal(3, 4), crop: opt(region), continuation: opt(continuation)}), obj({kind: s.literal('fits'), bitpix: n, width: n, height: n, color, continuation: opt(continuation)}));
const provenance = obj({authority: str, model: str, sourcePath: opt(str)});
export type BaselineProvenance = s.Infer<typeof provenance>;
const pixelPresence = {alphaValidity: opt(s.boolean), minimumBrightness: n};
export interface PixelPresence {alphaValidity?: boolean; minimumBrightness: number}
const coverage = s.union(obj({kind: s.literal('boundary-mean'), boundaryFraction: n, exponent: n, minimumBoundarySum: opt(n)}), obj({kind: s.literal('uniform-baseline'), ...pixelPresence, minimumCoverage: n, minimumRowCoverage: n, equatorialInsetRows: n, allowedBoundaryRange: vector2, transitionRows: n, baseline: opt(str), baselineProvenance: opt(provenance)}));
export type UniformCoverage = Extract<s.Infer<typeof coverage>, {kind: 'uniform-baseline'}>;
const baseline = obj({id: str, source: str, minimumBrightness: n, minimumCoverage: n, radiusFraction: n, minimumSampleShare: n, provenance});
export type DiscBaseline = s.Infer<typeof baseline>;
const calibration = obj({source: str, sourceSample: region, targetSample: region, reference: s.dictionary(str)});
export type Calibration = s.Infer<typeof calibration>;
const brightTail = obj({share: n, maximum: n, luminance: vector3});
export type BrightTail = s.Infer<typeof brightTail>;
const polarProjection = obj({tileSize: n, poles: arr(s.literal('north', 'south')), latitudeSegments: n, sampling: s.literal('nearest-closed', 'bilinear-wrapped'), angularMode: s.literal('direct-segment', 'boundary-difference')});
export type PolarProjection = s.Infer<typeof polarProjection>;
const productCommon = {filename: str, encoding: webpEncoding, transforms: opt(arr(transform)), removeAlpha: opt(s.boolean)};
const product = s.union(obj({...productCommon, kind: s.literal('surface'), packing: obj({bandCount: n, gutter: n, overscan: opt(n)})}), obj({...productCommon, kind: s.literal('poles'), projection: polarProjection}), obj({...productCommon, kind: s.literal('thumbnail')}));
const lens = obj({id: str, source: str, decode, products: arr(product), transforms: opt(arr(transform)), coverage: opt(coverage), calibration: opt(calibration), atmosphereColor: opt(brightTail), planetographicAxisRatio: opt(n)});
export const observedRecipe = obj({schema: s.literal('cssearth-observed-surfaces@1'), sources: arr(sourcePin), lenses: arr(lens), baselines: opt(arr(baseline))});
export type ObservedSurfaceRecipe = s.Infer<typeof observedRecipe>;
export interface RasterMap {data: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4; atmosphereColor?: number[]; calibration?: unknown; coverage?: {baselineColor: readonly number[]}; stretch?: number[]}
export interface Baseline {color: readonly number[]; provenance: BaselineProvenance}

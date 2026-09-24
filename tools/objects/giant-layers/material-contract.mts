import * as s from '@cssearth/core/schema';
import {vector2, vector3, webpEncoding} from './radial-contract.mts';
const n = s.number, str = s.string, opt = s.optional, arr = s.array, obj = s.object;
export const orientation = s.union(obj({kind: s.literal('normalize')}), obj({kind: s.literal('rotate'), axis: s.literal('x', 'y', 'z'), state: s.literal('scenePitchDegrees', 'systemObliquityDegrees'), factor: n}), obj({kind: s.literal('rotate'), axis: s.literal('x', 'y', 'z'), degrees: n}));
export type Orientation = s.Infer<typeof orientation>;
const pose = obj({scenePitchDegrees: n, systemObliquityDegrees: n});
export type MaterialPose = s.Infer<typeof pose>;
const grid = s.union(obj({kind: s.literal('projected-ellipsoid'), coverageScale: n, contentScale: n, depthBias: n}), obj({kind: s.literal('fixed-span'), span: n}));
const atmosphere = s.union(obj({model: s.literal('normalized-night-floor'), limbExponent: n, maximumAlpha: n, nightFloor: n}), obj({model: s.literal('additive-floor'), limbExponent: n, floor: n, gain: n}));
const raster = obj({shape: obj({equatorialRadius: n, polarRadius: n, arithmetic: s.literal('division', 'reciprocal'), rootSelection: s.literal('facing', 'positive'), includeDistance: opt(s.boolean)}), view: obj({right: vector3, down: vector3, forward: vector3, rotations: arr(orientation)}), light: obj({direction: vector3, operations: arr(orientation)}), grid, lighting: obj({ambient: n, terminator: vector2, terminatorWidth: opt(n), smoothstepOrder: s.literal('amount-first', 'direct-first'), alphaOrder: s.literal('atmosphere-first', 'lighting-first'), radialShadowGain: opt(n)}), atmosphere, silhouette: opt(obj({horizontalScale: n, verticalScale: n, fadeStart: n, opaqueAt: n, sideFadeStart: n, sideOpaqueAt: n}))});
export type MaterialRaster = s.Infer<typeof raster>;
const optimization = s.literal('display-lossless', 'q75');
const fixed = obj({filename: str, size: n, density: n, shadowless: s.boolean, encoding: webpEncoding, optimization: opt(optimization)});
export const ellipsoidMaterialRecipe = obj({schema: s.literal('cssearth-ellipsoid-materials@1'), urlPrefix: str, raster, fixedState: pose, bank: obj({frames: n, columns: n, frameSize: n, gutter: n, maximumScenePitchDegrees: n, presentationSize: n, encoding: webpEncoding, optimization: opt(optimization), systemObliquity: opt(obj({degrees: n, referencePitch: n})), presentationAssetUrl: opt(s.boolean)}), lenses: arr(obj({id: str, atmosphereFromMap: opt(s.boolean), atmosphere: opt(vector3), fixedBase: opt(vector3), bankBaseFromCoverage: opt(s.boolean), fixed: arr(fixed), rowOutput: str})), radialLayer: opt(obj({layerIndex: n, size: n, outerRadius: n}))});
export type EllipsoidMaterialRecipe = s.Infer<typeof ellipsoidMaterialRecipe>;
export interface RadialMaterialInput {data: Buffer; size: number; outerRadius: number}
export interface MaterialAsset {filename: string; width: number; height: number; bytes: number; sha256: string; data: Buffer}
export interface MaterialLeaf {tag: string; style: string}
export interface FixedMaterial {asset: MaterialAsset; leaf?: MaterialLeaf}
export interface MaterialPresentation {frameIndex: number; rowIndex: number; assetUrl?: string; scenePitchDegrees?: number; backgroundPosition: string; backgroundSize: string}
export interface MaterialBank {rows: MaterialAsset[]; presentations: MaterialPresentation[]; frameRawSha256: string[]; frameForegroundRingTexelCounts: number[]; frameRingShadowTexelCounts: number[]; encoding?: unknown}
export interface PreparedLensMaterial {fixed: Record<number, FixedMaterial>; shadowless: Record<number, FixedMaterial>; bank: MaterialBank}

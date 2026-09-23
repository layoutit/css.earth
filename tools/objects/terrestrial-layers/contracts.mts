import type { MissingCoverageStyle } from '../../../src/platform/prepare-missing-coverage.mts';
import type { SourceInput, SourceEntry, SourceManifest } from '../../../src/platform/source-manifest.mts';
/** Source-space geometry and numeric fields shared by preparation algorithms. */
export interface MeshDimensions { metersPerUnit:number; expectedVertices:number; expectedFaces:number }
export interface SurfaceHit { radius:number; faceId:number }
export interface ClosestSurfacePoint extends SurfaceHit { point:number[]; barycentric:number[]; normal:number[]; distanceMeters:number }
export interface SourceMesh {
  faceProvenance?:ArrayLike<number>; constraintFlags?:ArrayLike<number>; imageGrid?:{zOffsetMeters:number};
  vertices:number; faces:number; positions:number[][]; indices:number[][]; bounds:number[][];
  hit(longitude:number,latitude:number,requireUnique?:boolean):SurfaceHit|null;
  intersect(origin:readonly number[],direction:readonly number[],maximumDistance?:number,requireUnique?:boolean):SurfaceHit|null;
  closestPoint(point:readonly number[],maximumDistance?:number,requireUnique?:boolean):ClosestSurfacePoint|null;
  sample(longitude:number,latitude:number):number|null;
}
export interface SourceSurfaceSample extends ClosestSurfacePoint { value:number; sourceCell?:number }
export interface SourceScalar { sample(longitude:number,latitude:number):number|null; samplePoint?(point:readonly number[]):SourceSurfaceSample|null;
  /** True where a published boundary crosses this output pixel (`pixelDegrees` wide); it is drawn over the value. */
  outline?(longitude:number,latitude:number,pixelDegrees:number):boolean }
export interface RgbObservation { rgb:Uint8Array; missing:Uint8Array; width?:number; height?:number }
export interface SourceFace { id:number; a:number[]; ab:number[]; ac:number[]; min:number[]; max:number[] }
export type FaceTree = {min:number[];max:number[]} & ({items:SourceFace[];left?:never;right?:never}|{items?:never;left:FaceTree;right:FaceTree});
export interface PixelValidityPolicy { noData:number|null; zeroValidity?:string; withholdLatitudeDegrees?:number; withholdLongitudeDegrees?:number[] }
export interface RasterResult { data:Uint8Array; info:{width:number;height:number;channels:number} }
export interface PreparedTriangle { vertices:readonly (readonly number[])[]; normal:number[]; vertexNormals:number[][]; estimated?:boolean }
export interface GeologyPolygon { rings:number[][][]; south:number; north:number; category?:number|null }
export interface SymbolSegment {a:number[];b:number[];radius:number;category:number;id:number}
export interface PreparedSymbolSegment extends SymbolSegment {delta:number[];squared:number}
export interface LinearTransform {scale:number;offset:number}
export interface ScalarGrid {width:number;height:number;noData?:number|null;specialValueMagnitude?:number}
export interface ScienceProjection {referenceRadiusMeters:number;coordinates?:string;projection?:string;poleLatitude?:number;centerLongitude:number;longitudeRange?:number[];wrapLongitude?:boolean}
export interface Relief {referenceRadiusMeters:number;lightDirection:number[];ambient:number;heightToMeters?:number}
export type SciencePalette = ({categories:{color:string}[];minimum?:number;maximum?:number;colors?:string[]} | {categories?:undefined;minimum:number;maximum:number;colors:string[]}) & {relief?:Relief;outputLongitudeOrigin?:number;displaySampling?:string};
export interface ObservationGeometry {sun:number[];observer:number[]}
export interface ColorBand extends ScalarGrid {data:ArrayLike<number>;origin:number[];resolution:number[];filter:string;capture?:ObservationGeometry}
export interface ObservedColorProfile {filters:string[];referenceRadiusMeters:number;centerLongitude:number;displayRange?:readonly number[]}
/** Per-band level solving between observations: each observation's bands are scaled onto the reference observation's calibration
 * through the median ratios where their corrected footprints overlap, measured on a coarse grid of `cellDegrees`. */
export interface BandLevelPolicy {reference:string;cellDegrees:number;minimumOverlapPixels:number}
/** Whole-footprint band ratios tied to a published whole-disc colour: each band named in `ratios` is scaled so its mean over the
 * composed footprint, divided by the reference band's mean, equals the published ratio. `source` names the record in the manifest. */
export interface BandRatioPolicy {reference:string;ratios:Record<string,number>;source:string}
export interface PhotometryProfile {radiusKm:number;maximumIncidenceDegrees:number;maximumEmissionDegrees:number;referenceIncidenceDegrees:number;referenceEmissionDegrees:number;observationWeights:Record<string,number>;
  /** A pixel one observation views or lights too steeply: `monochrome` (default) keeps it for the base so no other date's colour fills it;
   * `next-observation` lets the next densest observation with acceptable geometry own it, for observations from one encounter. */
  withheld?:'monochrome'|'next-observation';bandLevels?:BandLevelPolicy;bandRatios?:BandRatioPolicy}
export interface ObservedColorContext {groups:ReadonlyMap<string,ColorBand[]>;profile:ObservedColorProfile;width:number;height:number;sourceIds?:string[]}
export interface PhasePhotometry {model:string;asymmetry:number;amplitude:number;width:number;minimumDegrees:number;maximumDegrees:number;referenceDegrees:number;maximumGain:number}
export interface DiskPhotometry {phaseCorrection?:PhasePhotometry;model?:string;maximumIncidenceDegrees:number;maximumEmissionDegrees:number;maximumGain:number;coefficient?:number;phaseCoefficientPerDegree?:number;weight?:number}
export interface GeoFrame {colorPlanes?:readonly ArrayLike<number>[];radianceFactor?:{factor:number;solarDistanceAu:number;solarFlux:number};width:number;height:number;planes:Record<string,ArrayLike<number>>;xyz(index:number):number[];valid(index:number):boolean;
  acceptPixel?(index:number):boolean;projectPoint?(point:readonly number[]):number[];quality?:{flags:ArrayLike<number>;allowLossy:boolean}}
export interface SipCamera {matrix:number[][];sip:{referencePixel:number[];a:number[][];b:number[][];offsetPixels:number[]}}

export interface ObservationSample {maximumIncidenceDegrees?:number;reason?:string; radiance?:number; maximumEmissionDegrees?:number}
export interface ObservationLevelPolicy {maximumAngleDegrees?:number;minimumPairs:number;maximumGain:number;samplesPerTriangle?:number}
export interface SourceAccess {manifest?:SourceManifest;validateGroup(consumer:string):Promise<readonly SourceInput[]>;validatePath(path:string):Promise<SourceEntry>}
export interface SurfaceConfig {geometry:{radius:number;radiusKm:number;radialTerrain:{path:string;format?:string;sourceTopology?:string;simplification:{method:string;maximumErrorMeters:number}}};raster:{height:number;missingCoverage?:MissingCoverageStyle}}
export interface RadialSurface {grid:SourceMesh;faces:PreparedTriangle[]}
export interface SurfaceOptions {sourceDirectory:string;source:SourceAccess;recipe:unknown;radial:RadialSurface;config:SurfaceConfig}
export type SurfaceColorSample = {reason:string;color:number[];radiance?:never;maximumEmissionDegrees?:never;maximumIncidenceDegrees?:never} |
  {reason?:undefined;color:number[];radiance:number;maximumIncidenceDegrees?:number;distanceMeters?:number;separationMeters?:number;gain?:number;maximumEmissionDegrees?:number;frameId?:string;frameIndex?:number};

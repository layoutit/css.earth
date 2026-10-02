/** Science raster, observation and color-composition records the raster loaders share. */
export interface RgbObservation { rgb:Uint8Array; missing:Uint8Array; width?:number; height?:number }
export interface PixelValidityPolicy { noData:number|null; zeroValidity?:string; withholdLatitudeDegrees?:number; withholdLongitudeDegrees?:number[] }
export interface RasterResult { data:Uint8Array; info:{width:number;height:number;channels:number} }
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
/** Whole-footprint band ratios tied to a published whole-disc color: each band named in `ratios` is scaled so its mean over the
 * composed footprint, divided by the reference band's mean, equals the published ratio. `source` names the record in the manifest. */
export interface BandRatioPolicy {reference:string;ratios:Record<string,number>;source:string}
export interface PhotometryProfile {radiusKm:number;maximumIncidenceDegrees:number;maximumEmissionDegrees:number;referenceIncidenceDegrees:number;referenceEmissionDegrees:number;observationWeights:Record<string,number>;
  /** A pixel one observation views or lights too steeply: `monochrome` (default) keeps it for the base so no other date's color fills it;
   * `next-observation` lets the next densest observation with acceptable geometry own it, for observations from one encounter. */
  withheld?:'monochrome'|'next-observation';bandLevels?:BandLevelPolicy;bandRatios?:BandRatioPolicy}
export interface ObservedColorContext {groups:ReadonlyMap<string,ColorBand[]>;profile:ObservedColorProfile;width:number;height:number;sourceIds?:string[]}

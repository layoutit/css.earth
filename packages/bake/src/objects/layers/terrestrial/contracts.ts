import type { MissingCoverageStyle } from '../../../raster/index.ts';
import type { PreparedTriangle, SourceMesh } from '../../geometry/index.ts';
import type { SourceInput, SourceEntry, SourceManifest } from '@cssearth/objects/node';
export interface PhasePhotometry {model:string;asymmetry:number;amplitude:number;width:number;minimumDegrees:number;maximumDegrees:number;referenceDegrees:number;maximumGain:number}
export interface DiskPhotometry {phaseCorrection?:PhasePhotometry;model?:string;maximumIncidenceDegrees:number;maximumEmissionDegrees:number;maximumGain:number;coefficient?:number;phaseCoefficientPerDegree?:number;weight?:number}
export interface GeoFrame {colorPlanes?:readonly ArrayLike<number>[];radianceFactor?:{factor:number;solarDistanceAu:number;solarFlux:number};width:number;height:number;planes:Record<string,ArrayLike<number>>;xyz(index:number):number[];valid(index:number):boolean;
  acceptPixel?(index:number):boolean;projectPoint?(point:readonly number[]):number[];quality?:{flags:ArrayLike<number>;allowLossy:boolean}}
export interface SipCamera {matrix:number[][];sip:{referencePixel:number[];a:number[][];b:number[][];offsetPixels:number[]}}

export interface ObservationSample {maximumIncidenceDegrees?:number;reason?:string; radiance?:number; maximumEmissionDegrees?:number}
export interface ObservationLevelPolicy {maximumAngleDegrees?:number;minimumPairs:number;maximumGain:number;samplesPerTriangle?:number}
export interface SurfaceConfig {geometry:{radius:number;radiusKm:number;radialTerrain:{path:string;format?:string;sourceTopology?:string;simplification:{method:string;maximumErrorMeters:number}}};raster:{height:number;missingCoverage?:MissingCoverageStyle}}
export interface RadialSurface {grid:SourceMesh;faces:PreparedTriangle[]}
export type SurfaceColorSample = {reason:string;color:number[];radiance?:never;maximumEmissionDegrees?:never;maximumIncidenceDegrees?:never} |
  {reason?:undefined;color:number[];radiance:number;maximumIncidenceDegrees?:number;distanceMeters?:number;separationMeters?:number;gain?:number;maximumEmissionDegrees?:number;frameId?:string;frameIndex?:number};
export interface SourceAccess {manifest?:SourceManifest;validateGroup(consumer:string):Promise<readonly SourceInput[]>;validatePath(path:string):Promise<SourceEntry>}
export interface SurfaceOptions {sourceDirectory:string;source:SourceAccess;recipe:unknown;radial:RadialSurface;config:SurfaceConfig}

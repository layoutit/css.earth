import type { Relief } from '../terrestrial-layers/contracts.mts';
import type { Polygon } from '@layoutit/polycss';
import type { CameraPlan } from '../../../src/renderers/css/navigation/types.ts';
export interface SurfaceTexture { one: string; two?: string; width: number; height: number; presentationCellSize?: number; }
export interface SurfacePolygon extends Polygon { latitudeIndex: number; longitudeIndex?: number | null; polarCap?: 'north' | 'south'; polarPart?: 'band' | 'center'; presentationCellSize?: number; }
interface SurfaceParameters { latitudeSegments: number; longitudeSegments: number; displayRadius: number; tileSize: number; surfaceOverlap: number; projectiveRasterScale: number; cameraPitch: number; cameraZoom: number; }
interface SceneMetadata extends Record<string, unknown> { schema: string; camera: CameraPlan & {style?: string}; body: Record<string, unknown>; counts: Record<string, number | boolean>; }
export interface BandSurfaceProfile {
  schema: 'cssearth-static-surface-geometry@1'; kind: 'disc-poles'; namespace: string;
  parameters: SurfaceParameters & {polarSurfaceOverlap: number; polarInnerOverlap: number; polarInnerInset: number; rotationSeconds: number};
  surface: SurfaceTexture; poles: SurfaceTexture; rasterAtlas?: RasterAtlas;
  metadata: SceneMetadata & {body: Record<string, unknown> & {systemTransform: string; meshTransform: string; latitudeSegments: number; assets: {surface: SurfaceTexture; poles: SurfaceTexture}}};
}
export interface SegmentedSurfaceProfile {
  schema: 'cssearth-static-surface-geometry@1'; kind: 'segmented-poles'; namespace: string;
  parameters: SurfaceParameters & {polarCellSize: number; polarInnerLatitudeDegrees: number; polarCenterOverlap: number; color: string; cameraYaw: number};
  surface: SurfaceTexture; poles: {one: string};
  metadata: SceneMetadata & {body: Record<string, unknown> & {axialTiltDegrees: number}; offLimbContext: {defaultUrl: string; defaultUrl2x?: string}; limbMaterial: {defaultUrl: string; defaultUrl2x?: string}};
}
export type SurfaceProfile = BandSurfaceProfile | SegmentedSurfaceProfile;
export interface RasterInfo {width: number; height: number; channels: 1 | 2 | 3 | 4;}
export interface RasterImage {data: Buffer; info: RasterInfo;}
export interface RasterAtlas {gutter: number; cellSize: number; columns: number; rows: number; width: number; height: number;}
export interface CurvatureMaterial {frameSize: number; radiusScale: number; limbFloor: number; output: string;}
export interface ElevationRecipe {noData: number; palette: readonly (readonly number[])[]; rangeMetres: number; relief?: Relief;}
export type FitsColor = {kind: 'signed-asinh'; palette: readonly (readonly number[])[]; softening: number; maximum: number}
  | {kind: 'positive-log'; palette: readonly (readonly number[])[]; range: readonly [number, number]};
export interface FitsMapRecipe {bitpix: number; width: number; height: number; latitude: 'sine-latitude' | 'equirectangular'; reverseLongitude?: boolean; positiveOnly?: boolean; nearestLatitudeLimit: number; color: FitsColor;}
export interface PhysicalInput {id: string; path: string; format: string; identity?: Readonly<Record<string, unknown>>; textPath?: string; anchors?: readonly string[]; tableRow?: string; expectedColumns?: readonly number[];}
export interface PhysicalFactsRecipe {schema: string; inputs: readonly PhysicalInput[]; constants: Readonly<Record<string, unknown>>; fields: Readonly<Record<string, {source: string; path: string}>>;}
export interface TonalPresentation {saturation: number; linearGain: number; linearOffset: number; sharpenSigma: number;}
export interface ObservationLens {
  id: string; input: string; output: string;
  scientific?: import('../terrestrial-layers/contracts.mts').SciencePalette & {displaySampling?: string};
  elevation?: ElevationRecipe;
  coverage?: {kind: string; southConnected: boolean};
  presentation?: TonalPresentation;
}
export interface ObservationRasterRecipe {
  schema: string; kind: 'observation-lenses'; surfaceProjection: string; lenses: readonly ObservationLens[];
  densities: readonly number[]; width: number; height: number; latitudeSegments: number;
  polarTile: number; thumbnail: string; material: CurvatureMaterial;
}
type OffLimbObservation = {observedFile: null; center: null; radius: null} | {observedFile: string; center: readonly [number, number]; radius: number};
export type ContinuumVariant = OffLimbObservation & {id: string; polarDetailSigma: number; kind: 'continuum-disc-mosaic'; mapFiles: readonly string[]; limbMode: 'continuum-darkening'};
export type EmissionVariant = ContinuumVariant | (OffLimbObservation & {id: string; polarDetailSigma: number; kind: 'fits-map'; mapFile: string; fits: FitsMapRecipe; limbMode: 'rim'});
export interface SynopticEmissionRecipe {
  schema: string; kind: 'synoptic-emission'; namespace: string; mapWidth: number; mapHeight: number; latitudeSegments: number;
  polarTile: number; offLimbSize: number; limbSize: number; bodyDiameter: number;
  continuum: {start: string; stop: string; maximumLatitudeDegrees: number; minimumDiscRadius: number; maximumDiscRadius: number; discBrightnessThreshold: number; solarPoleTiltDegrees: number};
  variants: readonly EmissionVariant[];
}

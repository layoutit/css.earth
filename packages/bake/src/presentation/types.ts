import { type PreparedPoseKeyframe, type CameraPlan, type CubicSkyPlan, type DirectionalSunPlan, type DatasetVolume, type ObjectControls, type ObjectRuntimeDefinition, type PreparedAssets, type PreparedTree, type PreparedVariant, type PreparedViewBinding, type PreparedMaterialTrack, type PreparedMaterialAddress, type PreparedMaterialRotation, type PreparedTextureLevels } from '@cssearth/objects';

import type { PreparedLeaf, PreparedSeamOutset } from '../scene/index.ts';

import type { RasterPagePlan } from '../raster/index.ts';
type SeamRepair = { outset?: PreparedSeamOutset };

export interface Dataset {
  id: string; view?: string; billboardColor: string;
  /** A dataset that names a companion cloud borrows another dataset's plates instead of owning any. */
  volume?: DatasetVolume;
  surfaceUrl: string; surface2xUrl?: string; polesUrl: string; poles2xUrl?: string;
  materialUrl: string; material2xUrl?: string;
  /** Emissive bodies: the stationary off-limb context and the limb plate of this dataset. */
  coronaUrl?: string; corona2xUrl?: string; limbUrl?: string; limb2xUrl?: string;
}
export interface Datasets { defaultDataset: string; controls: Dataset[]; }
export interface AtlasAddress { frameIndex: number; rowIndex: number; url: string; backgroundPosition: string; backgroundSize: string; }
export interface Billboard { schema: string; url: string; columns: number; rowCount: number; frameCount: number; presentations: AtlasAddress[]; shadowless: ShadowlessFrame; }
/** The last lighting frame alone: what a body shows with shadows off. */
export interface ShadowlessFrame { url: string; frameIndex: number; backgroundPosition: string; backgroundSize: string; }
export interface Bank { billboard: Billboard; presentations: AtlasAddress[]; rows: {url: string}[]; shadowless: ShadowlessFrame;
  transport: {framesPerRow: number; maximumRetainedRowCount: number; defaultFrame: number; initialWarmRows: number[]}; }
export interface RasterAssets {
  surfaceDimensions: { width: number; height: number };
  lighting: { banks: Record<string, Bank>; frameCount: number; minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number };
  interior?: Record<string, string>;
  /** An unlit body's plate sizes; present instead of a lighting bank. */
  emission?: { offLimbContext: { logicalSize: number }; limbMaterial: { logicalSize: number } };
}
export interface CompositeMaterial {
  lightingUrl: string; lighting2xUrl?: string; backgroundSize: string; backgroundPositions: string[];
  defaultFrame: number; minimumLightViewZ: number; maximumLightViewZ: number; frameCount: number;
  directionalFrameCount: number; baseLightAzimuthDegrees: number; frameColumns: number; frameRows: number;
}
export interface Scene {
  camera: CameraPlan & {defaultTransform: string}; systemTransform: string; bodyTransform: string;
  starfield: CubicSkyPlan;
  bodyLeaves: PreparedLeaf[]; body: {leaves: PreparedLeaf[]; seamRepair?: SeamRepair; surfacePages?: RasterPagePlan}; preparedSurface?: {seamRepair?: SeamRepair};
  interior?: {bodyTransform: string; outerBodyLeaves: PreparedLeaf[]; coreLeaves: PreparedLeaf[]; sectionLeaves: PreparedLeaf[];
    presentationOrbit: {durationMilliseconds: number; millisecondsPerControlDegree: number; keyframes: PreparedPoseKeyframe[]}};
  /** Flat discs in the body's equatorial plane, such as a ring, drawn under the same system node as the surface. */
  planes?: {id: string; className: string; url: string; color: string; radius: number; leaves: PreparedLeaf[]}[];
  material: CompositeMaterial;
}
export interface SolarSource { bodyId: string; }
export interface SourceMaterialTrack extends Omit<PreparedMaterialTrack, 'frame' | 'defaultFrame' | 'rotation' | 'banks'> {
  frame: {source: string; minimum: number; maximum: number; count: number; baseFrame: number;
    span?: number; maximumFrame?: number; remap: null};
  banks: { id: string; frames: PreparedMaterialAddress[]; default: PreparedMaterialAddress | null; fixed: PreparedMaterialAddress | null;
    rows?: {row: number; resource: string; firstFrame: number; lastFrame: number}[] }[];
  demand: {capacity: number; defaultFrame: number}; rotation: PreparedMaterialRotation & {source: string};
}
export interface PresentationDraft {
  schema: string; camera: CameraPlan; sky: Scene['starfield']; sun: DirectionalSunPlan | null;
  assets: PreparedAssets; tree: PreparedTree; variants: PreparedVariant[]; materials: SourceMaterialTrack[];
  resourceOrder?: 'materials-first';
  viewBindings: PreparedViewBinding[]; animations: ObjectRuntimeDefinition['animations'];
  motion?: NonNullable<ObjectRuntimeDefinition['motion']>;
  textureLevels?: PreparedTextureLevels;
}
export interface PresentationInputs {
  namespace: string; mode: 'row-bank-cutaway' | 'composite' | 'emissive';
  scene: Scene; assets: RasterAssets; datasets: Datasets; sun: DirectionalSunPlan | null;
  solarSource: SolarSource; controls: ObjectControls;
  /** Authored surface targets (positive-east degrees) a dataset selects; composite only. */
  datasetFocus?: Record<string, { longitudeDegrees: number; latitudeDegrees: number; zoom: number }>;
  /** A pulsating star's published light curve as veil opacity over one period (the photometry topic prepares it); emissive only. */
  lightCurve?: { readonly durationMs: number; readonly keyframes: readonly { readonly offset: number; readonly opacity: string }[] };
}

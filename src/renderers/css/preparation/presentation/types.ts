import type { PreparedLeaf } from '../scene/projector.js';
import type { CameraPlan } from '../../navigation/types.js';
import type { CubicSkyPlan } from '../../solar-system/cubic-sky-runtime.js';
import type { DirectionalSunPlan } from '../../solar-system/directional-sun-runtime.js';
import type { ObjectControls } from '../../runtime/object-contract.js';
import type { ObjectRuntimeDefinition } from '../../runtime/object-runtime-types.js';
import type { PreparedAssets } from '../../rendering/prepared-residency.js';
import type { PreparedTree, PreparedVariant, PreparedViewBinding } from '../../rendering/prepared-presentation.js';
import type { PreparedMaterialTrack, PreparedMaterialAddress, PreparedMaterialRotation } from '../../rendering/prepared-material.js';
import type { HeliocentricViewPlan } from '../../../../platform/heliocentric-view.mts';
type PreparedMarkers = Awaited<ReturnType<typeof import('../../../../../tools/objects/solar-system-markers.mts').prepareSolarSystemMarkerStrip>>['plan'];

export interface Lens {
  id: string; view?: string; billboardColor: string;
  surfaceUrl: string; surface2xUrl?: string; polesUrl: string; poles2xUrl?: string;
  materialUrl: string; material2xUrl?: string;
}
export interface Lenses { defaultLens: string; controls: Lens[]; }
export interface AtlasAddress { frameIndex: number; rowIndex: number; url: string; backgroundPosition: string; backgroundSize: string; }
export interface Billboard { schema: string; url: string; columns: number; rowCount: number; frameCount: number; presentations: AtlasAddress[]; }
export interface Bank { billboard: Billboard; presentations: AtlasAddress[]; rows: {url: string}[];
  transport: {framesPerRow: number; maximumRetainedRowCount: number; defaultFrame: number; initialWarmRows: number[]}; }
export interface RasterAssets {
  poles: { url: string; url2x?: string };
  lighting: { banks: Record<string, Bank>; frameCount: number; minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number };
  interior: Record<string, string>;
}
export interface CompositeMaterial {
  lightingUrl: string; lighting2xUrl?: string; backgroundSize: string; backgroundPositions: string[];
  defaultFrame: number; minimumLightViewZ: number; maximumLightViewZ: number; frameCount: number;
  directionalFrameCount: number; baseLightAzimuthDegrees: number; frameColumns: number; frameRows: number;
}
export interface Scene {
  camera: CameraPlan & {defaultTransform: string}; systemTransform: string; bodyTransform: string;
  starfield: CubicSkyPlan & {catalogueStars: {exposure: {fovDegrees: number}}};
  bodyLeaves: PreparedLeaf[]; body: {leaves: PreparedLeaf[]};
  interior: {bodyTransform: string; outerBodyLeaves: PreparedLeaf[]; coreLeaves: PreparedLeaf[]; sectionLeaves: PreparedLeaf[];
    presentationOrbit: {durationMilliseconds: number; millisecondsPerControlDegree: number; keyframes: Keyframe[]}};
  material: CompositeMaterial; heliocentricView: HeliocentricViewPlan;
}
export interface SolarSource { bodyId: string; markerAtlasUrl: string; captionNames: Record<string, string>; }
export interface SourceMaterialTrack extends Omit<PreparedMaterialTrack, 'frame' | 'defaultFrame' | 'rotation' | 'banks'> {
  frame: {source: string; minimum: number; maximum: number; count: number; baseFrame: number;
    span?: number; maximumFrame?: number; remap: null};
  banks: { id: string; frames: PreparedMaterialAddress[]; default: PreparedMaterialAddress | null; fixed: PreparedMaterialAddress | null;
    rows?: {row: number; resource: string; firstFrame: number; lastFrame: number}[] }[];
  demand: {capacity: number; defaultFrame: number}; rotation: PreparedMaterialRotation & {source: string};
}
export interface PresentationDraft {
  schema: string; camera: CameraPlan; sky: Scene['starfield']; sun: DirectionalSunPlan;
  assets: PreparedAssets; tree: PreparedTree; variants: PreparedVariant[]; materials: SourceMaterialTrack[];
  resourceOrder?: 'materials-first'; heliocentricView: ObjectRuntimeDefinition['heliocentricView'];
  viewBindings: PreparedViewBinding[]; animations: ObjectRuntimeDefinition['animations'];
}
export interface PresentationInputs {
  namespace: string; mode: 'row-bank-cutaway' | 'composite';
  scene: Scene; assets: RasterAssets; lenses: Lenses; sun: DirectionalSunPlan;
  markers?: PreparedMarkers; solarSource: SolarSource; controls: ObjectControls;
}

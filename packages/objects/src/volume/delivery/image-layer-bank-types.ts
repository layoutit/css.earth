import type { Vector3 } from '../emission/coordinates.js';
import { PREPARED_IMAGE_LAYER_BANK_SCHEMA } from './volume-schemas.js';
import type { VolumeAxis, PreparedCssVolume } from './css-volume-types.js';

export interface ImageLayerObservation { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number }

export type PreparedImageLayerLeaf = { id: string; axis: VolumeAxis; offsetKpc: number; centerUnits: Vector3; doubleSided: true; texturePath: string; widthPx: number; heightPx: number;
  verticesUnits: [Vector3, Vector3, Vector3, Vector3]; uvs: [[number, number], [number, number], [number, number], [number, number]];
  style: { width: string; height: string; transform: string; backgroundSize: string; backgroundPosition: string };
  bytes: number };
export interface PreparedImageLayerBank {
  schema: typeof PREPARED_IMAGE_LAYER_BANK_SCHEMA; id: string; frame: { referenceFrame: 'sun-icrf'; epochJdTt: 2461286.5;
    originM: Vector3; localToReferenceXyzw: [number, number, number, number]; metersPerUnit: number;
    boundsUnits: { min: Vector3; max: Vector3 } }; observation: ImageLayerObservation;
  /** `scenes`: the sizes of the consecutive runs of a stack's leaves that are drawn in a 3D scene of their own, in the
   * stack's order; without it the stack is one scene. */
  banks: { axis: VolumeAxis; normalUnits: Vector3; samplingStepUnits: number; leaves: PreparedImageLayerLeaf[]; scenes?: number[] }[]; resources: { path: string; bytes: number; width: number; height: number }[];
  provenance: unknown; approximation: { model: string; canonicalRecomposition: string; limitations: string[] };
}
export interface PreparedImageLayerView {
  readonly axis: 'x' | 'y' | 'z';
  readonly normalUnits: readonly [number, number, number];
  readonly samplingStepUnits: number;
  /** The sizes of the consecutive runs of the stack's leaves that share a 3D scene, when it has more than one scene. A
   * browser sorts the leaves of one scene by depth against one another, so leaves that cross each other, and more
   * leaves than a scene can sort in a frame, are spread over several; the scenes are painted in the stack's order. */
  readonly sceneSizes?: readonly number[];
}
export interface PreparedCssImageLayers extends PreparedCssVolume {
  readonly bankViews: readonly PreparedImageLayerView[];
}

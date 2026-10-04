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
  banks: { axis: VolumeAxis; normalUnits: Vector3; samplingStepUnits: number; leaves: PreparedImageLayerLeaf[] }[]; resources: { path: string; bytes: number; width: number; height: number }[];
  provenance: unknown; approximation: { model: string; canonicalRecomposition: string; limitations: string[] };
}
export interface PreparedImageLayerView {
  readonly axis: 'x' | 'y' | 'z';
  readonly normalUnits: readonly [number, number, number];
  readonly samplingStepUnits: number;
}
export interface PreparedCssImageLayers extends PreparedCssVolume {
  readonly bankViews: readonly PreparedImageLayerView[];
}

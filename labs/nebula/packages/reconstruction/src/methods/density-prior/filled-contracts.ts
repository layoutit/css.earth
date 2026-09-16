import type {FilledComponentsResult} from './filled-components.ts';
import type {FilledVolumePart} from './filled-parts.ts';
export type Vec3 = [number, number, number];
export type Bounds3 = { min: Vec3; max: Vec3 };
export type NumericArray = Float32Array<ArrayBufferLike> | Float64Array<ArrayBufferLike>;

export interface FilledPhotoTarget {
  width: number;
  height: number;
  rgb: Uint8Array<ArrayBufferLike>;
  /** Display intensity used by the filled-component decomposition. */
  intensity: NumericArray;
}

export interface FilledDepthPrior {
  density: NumericArray;
  dimensions: Vec3;
  boundsKpc: Bounds3;
}

export interface FilledVolumeChannels {
  compact: boolean;
  diffuse: boolean;
  extended: boolean;
}

export interface FilledVolumeOptions {
  target: FilledPhotoTarget;
  decomposition: FilledComponentsResult;
  boundsKpc: Bounds3;
  densityPrior?: FilledDepthPrior;
  mode: 'broad' | 'coherent';
  channels?: Partial<FilledVolumeChannels>;
  depth: {
    broadHalfThicknessKpc: number;
    diffuseHalfThicknessKpc: number;
    extendedMinimumHalfThicknessKpc: number;
    extendedDepthAspectRatio: number;
    compactMinimumHalfThicknessKpc: number;
    compactDepthAspectRatio: number;
    maxHalfThicknessKpc: number;
    maxLocalDepthOffsetKpc?: number;
  };
  /** Share of diffuse light following the stellar prior; defaults to 0.25. */
  diffusePriorWeight?: number;
  exposureGain?: number;
  maxDisplaySignal?: number;
}

export interface FilledVolumeDiagnostics {
  mode: 'broad' | 'coherent';
  channels: FilledVolumeChannels;
  photoDimensions: [number, number];
  positiveSelectedPixels: number;
  clippedSelectedPixels: number;
  maxInputAccountingError: number;
  compactFamilyCount: number;
  extendedFamilyCount: number;
  prior: { provided: boolean; positiveVoxels: number; locatedFamilies: number };
  depthPlane: { interceptKpc: number; xSlope: number; ySlope: number; compression: number };
  halfThicknessKpc: { minimum: number; maximum: number };
  opticalTransfer: string;
  claimLimitations: string[];
}

export interface FilledVolumeSampler {
  /** Allocation-free optical RGB emissivity per kpc in rectified observation coordinates. */
  sample(xKpc: number, yKpc: number, zKpc: number, out: Vec3): void;
  /** Exact optical RGB column that sample integrates to at a raster pixel centre. */
  integratedTargetAtPixel(pixel: number, out: Vec3): void;
  /** Selected display RGB before the nonlinear display-to-optical transfer. */
  displayTargetAtPixel(pixel: number, out: Vec3): void;
  /** Conservative tangent-space bounds containing every nonzero sample. */
  supportBoundsKpc: Bounds3;
  /** Frozen-geometry contribution samplers for offline independent banks. */
  parts: readonly FilledVolumePart[];
  diagnostics: FilledVolumeDiagnostics;
}

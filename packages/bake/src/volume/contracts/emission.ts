import type { EmissionFieldModel } from '@cssearth/objects';

import type { RetainedPhotometricEnvelope } from '@cssearth/objects';
import type { JointParameters } from '@cssearth/objects';
import type { CompilerControls } from '@cssearth/objects';

import type { EmissionWindow } from '@cssearth/objects';

import type { EmissionVector3, EmissionBounds, SkyBounds } from '@cssearth/objects';
export interface EmissionFitInput {
  /** Linear integrated relative emission (dimensionless display optical depth), never calibrated flux. */
  target: Float32Array; width: number; height: number; bounds: SkyBounds;
  /** One means observed, zero means unavailable. Unavailable is never treated as measured zero. */
  coverage?: Uint8Array;
  /** Authored source-footprint display selection, independent of source coverage/no-data. */
  emissionWindow?: EmissionWindow;
  scaffold?: JointParameters;
  /** Measured beam footprints establish coverage only, never unique depth. */
  velocityCoverage?: { x: number; y: number; radiusArcsec: number }[];
}
export interface EmissionFitResult {
  field: EmissionFieldModel;
  /** Same dimensions and linear integrated units as input, including predicted light in unobserved pixels. */
  projection: Float32Array;
  /** Target minus projection at covered pixels; no-data entries are zero and retain separate coverage. */
  residual: Float32Array; unassigned: Float32Array; coverage: Uint8Array;
  metrics: {
    /** The before value is the zero-emission baseline, measured on the same covered input pixels. */
    beforeRmse: number; afterRmse: number; relativeSquaredError: number;
    targetSum: number; modeledSum: number; unassignedSum: number; excessSum: number;
    coveredPixels: number; basisCount: number; componentCount: number; iterations: number;
    fitWidth: number; fitHeight: number; objectiveHistory: number[];
  };
}

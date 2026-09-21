import type { RetainedPhotometricEnvelope } from '../fields/photometric-emission.ts';
import type { JointParameters } from './joint-parameters.ts';
import type { CompilerControls } from './compiler-controls.ts';
import type { EmissionWindow } from '../fields/emission-window.ts';
export { defaultCompilerControls, readCompilerControls, type CompilerControls } from './compiler-controls.ts';

export type EmissionVector3 = [number, number, number];
export interface EmissionBounds { min: EmissionVector3; max: EmissionVector3 }
export interface SkyBounds {
  /** [minimum xWest, minimum yNorth], in arcseconds. */
  min: [number, number];
  /** [maximum xWest, maximum yNorth], in arcseconds. Raster row zero is maximum yNorth. */
  max: [number, number];
}
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
export interface EmissionComponent {
  id: string; basisId: string;
  center: EmissionVector3; sigma: EmissionVector3; angleRadians: number;
  /** Local depth-plane slopes [dz/dxWest, dz/dyNorth]; absent historical records are untilted. */
  depthGradient?: [number, number];
  /** This component's peak integrated projected emission; z integration recovers this weight. */
  projectedWeight: number;
  /** Historical halo-near/far records remain readable; new unconstrained supports use halo-diffuse. */
  depthAssignment: 'scaffold-near' | 'scaffold-far' | 'halo-near' | 'halo-far' | 'halo-diffuse' | 'evidence-surface' | 'simulation-prior' | 'unsupported-local';
  velocityCovered: boolean;
}
export interface EmissionFieldModel {
  schema: 'cssearth-conditional-emission-field@1'; identity: string;
  controls: CompilerControls; components: EmissionComponent[]; bounds: EmissionBounds;
  skyBounds: SkyBounds; scaffold: JointParameters | null;
  emissionWindow?: EmissionWindow;
  photometricEnvelope?: RetainedPhotometricEnvelope;
  depthConstraints?: {
    recipeId: string; evidenceSha256: string; paperGuidedComponents: number; authoredComponents: number;
    assignments: { componentId: string; featureId: string; methodId: string; evidenceIds: string[]; support: string }[];
  };
  assumptions: {
    kernel: string; projectionUnits: string; depth: string; halo: string;
    /** Projected extent used only to choose broad XY supports; never an inferred sphere radius. */
    haloRadiusArcsec: number;
    /** Authored diffuse maximum |z| at depth=1; absent in historical spherical-halo records. */
    diffuseDepthExtentArcsec?: number;
    /** Equal weights among scaffold intersections only; diffuse supports are centered at z=0. */
    equalNearFarSplit: boolean; velocityUncoveredComponents: number;
  };
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

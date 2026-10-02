import type { CompilerControls } from './compiler-controls.js';
import type { JointParameters } from './joint-parameters.js';
import type { EmissionVector3, EmissionBounds, SkyBounds } from './coordinates.js';
import type { EmissionWindow } from './emission-window.js';
import type { RetainedPhotometricEnvelope } from './photometric-emission.js';

export const EMISSION_FIELD_SCHEMA = 'cssearth-conditional-emission-field@1';

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
  schema: typeof EMISSION_FIELD_SCHEMA; identity: string;
  controls: CompilerControls; components: EmissionComponent[]; bounds: EmissionBounds;
  skyBounds: SkyBounds; scaffold: JointParameters | null;
  emissionWindow?: EmissionWindow;
  photometricEnvelope?: RetainedPhotometricEnvelope;
  depthConstraints?: {
    recipeId: string; evidencePath: string; paperGuidedComponents: number; authoredComponents: number;
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

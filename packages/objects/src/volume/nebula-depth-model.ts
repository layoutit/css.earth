/** Shared nebula depth model schema identifier; implementation stays with its consumers. */
export const NEBULA_DEPTH_MODEL_SCHEMA = 'cssearth-nebula-depth-model@1';

type Pair = [number, number];
type Triple = [number, number, number];
export interface DepthSurface {
  id: string; methodId: string; evidenceIds: string[];
  support: 'paper-guided' | 'unconstrained';
  /** A window scopes a hypothesis; it is not a measured nebular boundary. */
  centerArcsec: Pair; radiusArcsec: Pair; angleDegrees: number;
  depthArcsec: number; gradient: Pair; curvaturePerArcsec: Triple;
  thicknessArcsec: number; strength: number; rationale: string;
}
export interface DepthRecipe {
  schema: typeof NEBULA_DEPTH_MODEL_SCHEMA; id: string;
  centerIcrsDegrees: Pair;
  evidence: { path: string };
  background: DepthSurface; features: DepthSurface[];
  /** The unobserved normal thickness may shrink with projected feature scale, never grow into rods. */
  detailThicknessRatio: number; minimumThicknessArcsec: number;
  interpretation: string;
}

import { isRecord, isFiniteNumber } from '@cssearth/core';
/** Nebula depth recipe contract; evidence policy and sampling stay with consumers. */
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

const number = (v: unknown, low: number, high: number): v is number => isFiniteNumber(v) && v >= low && v <= high;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(v);
function pair(v: unknown, low: number, high: number): Pair {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(n => number(n, low, high))) throw new TypeError('Invalid depth-model pair.');
  return [v[0], v[1]];
}
function surface(v: unknown): DepthSurface {
  if (!isRecord(v) || !id(v.id) || v.methodId !== 'coherent-irregular-front' || !Array.isArray(v.evidenceIds) || !v.evidenceIds.length || !v.evidenceIds.every(id) ||
      (v.support !== 'paper-guided' && v.support !== 'unconstrained') || !number(v.angleDegrees, -360, 360) || !number(v.depthArcsec, -1e6, 1e6) ||
      !number(v.thicknessArcsec, .01, 1e5) || !number(v.strength, 0, 1) || typeof v.rationale !== 'string' || !v.rationale.trim() ||
      !Array.isArray(v.curvaturePerArcsec) || v.curvaturePerArcsec.length !== 3 || !v.curvaturePerArcsec.every(n => number(n, -.1, .1)))
    throw new TypeError('Invalid evidence-addressed depth surface.');
  return { id: v.id, methodId: v.methodId, evidenceIds: [...v.evidenceIds], support: v.support,
    centerArcsec: pair(v.centerArcsec, -1e6, 1e6), radiusArcsec: pair(v.radiusArcsec, .01, 1e6), angleDegrees: v.angleDegrees,
    depthArcsec: v.depthArcsec, gradient: pair(v.gradient, -50, 50), curvaturePerArcsec: [v.curvaturePerArcsec[0], v.curvaturePerArcsec[1], v.curvaturePerArcsec[2]],
    thicknessArcsec: v.thicknessArcsec, strength: v.strength, rationale: v.rationale };
}
export function parseDepthRecipe(v: unknown, allowedPath: (path: string) => boolean): DepthRecipe {
  if (!isRecord(v) || v.schema !== NEBULA_DEPTH_MODEL_SCHEMA || !id(v.id) || !isRecord(v.evidence) ||
      typeof v.evidence.path !== 'string' || !allowedPath(v.evidence.path) ||
      !Array.isArray(v.features) || v.features.length > 64 || !number(v.detailThicknessRatio, .05, 2) || !number(v.minimumThicknessArcsec, .01, 1000) ||
      typeof v.interpretation !== 'string' || !v.interpretation.trim()) throw new TypeError('Invalid nebula depth-model recipe.');
  const center = pair(v.centerIcrsDegrees, -360, 360), background = surface(v.background), features = v.features.map(surface);
  if (center[0] < 0 || center[0] >= 360 || Math.abs(center[1]) > 90 || new Set([background.id, ...features.map(f => f.id)]).size !== features.length + 1 ||
      background.support !== 'unconstrained') throw new TypeError('Invalid depth frame, duplicate surface, or unsupported background claim.');
  return { schema: v.schema, id: v.id, centerIcrsDegrees: center, evidence: { path: v.evidence.path }, background, features,
    detailThicknessRatio: v.detailThicknessRatio, minimumThicknessArcsec: v.minimumThicknessArcsec, interpretation: v.interpretation };
}

/** Publication ownership admission preserves receipts that retain only identity and an evidence pin.
 * Scientific recipe admission remains the full reader's responsibility. */
export function readPublishedDepthRecipe(value: unknown, expectedId: string): { evidence: unknown } {
  if (!isRecord(value) || value.schema !== NEBULA_DEPTH_MODEL_SCHEMA || value.id !== expectedId)
    throw new Error('Prepared depth recipe belongs to another nebula or has an invalid schema.');
  return { evidence: value.evidence };
}

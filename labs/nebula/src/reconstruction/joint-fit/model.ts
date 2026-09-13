import type { Matrix } from '../../alignment/observations-ui/model';

export type JointFamily = 'ellipsoid' | 'bipolar';
/** Angular model coordinates: west, north, away from Earth. No physical distance is inferred. */
export interface JointParameters {
  family: JointFamily; radiusArcsec: number; depthRatio: number; inclinationDegrees: number;
  positionAngleDegrees: number; expansionKmS: number; systemicLsrKmS: number;
}
export interface JointControls { ridgeThreshold: number; minLengthArcseconds: number; imageWeight: number; velocityWeight: number }
export const defaultJointControls: JointControls = { ridgeThreshold: .25, minLengthArcseconds: 40, imageWeight: 1, velocityWeight: 1 };
export interface JointRequest {
  action: 'apply'; imageId: 'joint-fit'; cataloguePath: string; recipePath: string;
  imageToFrame: Record<string, Matrix>; evidence: { sensitivity: number; weights: number[] }; controls: JointControls;
}
export interface JointRecipe {
  schema: 'cssearth-joint-fit-recipe@1'; id: string; molecularSource: string;
  centerIcrsDegrees: [number, number]; morphologyRadiusArcsec: [number, number];
  radiusSearchArcsec: number[]; systemicLsrKmS: number; systemicUncertaintyKmS: number;
  imageToleranceArcsec: number; velocityToleranceKmS: number; missingVelocityPenaltyKmS: number;
  interpretation: string;
}
export interface JointRidgePoint { x: number; y: number; weight: number; polylineId: string }
export interface JointVelocityPoint { id: string; pointingId: string; x: number; y: number; velocityLsrKmS: number; heldOut: boolean }
export interface JointEvidence { ridges: JointRidgePoint[]; velocities: JointVelocityPoint[]; beamFwhmArcsec: number }
export interface JointMetrics {
  imageResidualArcsec: number; unrepresentedRidgeFraction: number;
  trainingRmsKmS: number | null; heldOutRmsKmS: number | null; trainingCount: number; heldOutCount: number;
  missingTraining: number; missingHeldOut: number; objective: number;
}
export interface JointFit { parameters: JointParameters; metrics: JointMetrics; outline: [number, number][];
  residuals: { id: string; predictedLsrKmS: number | null; residualKmS: number; heldOut: boolean }[] }
export const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, min: number, max: number): v is number => finite(v) && v >= min && v <= max;
export const jointPath = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !v.startsWith('/') && !/[\\:?#\s]/.test(v) && v.split('/').every(p => p && p !== '.' && p !== '..');
export function readJointControls(v: unknown): JointControls {
  if (!jointRecord(v) || !range(v.ridgeThreshold, .05, .9) || !range(v.minLengthArcseconds, 10, 240) ||
      !range(v.imageWeight, 0, 4) || !range(v.velocityWeight, 0, 4) || v.imageWeight + v.velocityWeight === 0) throw new TypeError('Invalid joint fit controls.');
  return { ridgeThreshold: v.ridgeThreshold, minLengthArcseconds: v.minLengthArcseconds, imageWeight: v.imageWeight, velocityWeight: v.velocityWeight };
}
export function readJointParameters(v: unknown): JointParameters {
  if (!jointRecord(v) || (v.family !== 'ellipsoid' && v.family !== 'bipolar') || !range(v.radiusArcsec, 50, 1000) || !range(v.depthRatio, .5, 3) ||
      !range(v.inclinationDegrees, -85, 85) || !range(v.positionAngleDegrees, 0, 180) || !range(v.expansionKmS, 1, 80) || !range(v.systemicLsrKmS, -150, 150)) throw new TypeError('Invalid joint model parameters.');
  return { family: v.family, radiusArcsec: v.radiusArcsec, depthRatio: v.depthRatio, inclinationDegrees: v.inclinationDegrees,
    positionAngleDegrees: v.positionAngleDegrees, expansionKmS: v.expansionKmS, systemicLsrKmS: v.systemicLsrKmS };
}
export function readJointRecipe(v: unknown): JointRecipe {
  if (!jointRecord(v) || v.schema !== 'cssearth-joint-fit-recipe@1' || typeof v.id !== 'string' || !jointPath(v.molecularSource) ||
      !Array.isArray(v.centerIcrsDegrees) || v.centerIcrsDegrees.length !== 2 || !v.centerIcrsDegrees.every(finite) ||
      !Array.isArray(v.morphologyRadiusArcsec) || v.morphologyRadiusArcsec.length !== 2 || !v.morphologyRadiusArcsec.every(n => range(n, 0, 2000)) || v.morphologyRadiusArcsec[0] >= v.morphologyRadiusArcsec[1] ||
      !Array.isArray(v.radiusSearchArcsec) || v.radiusSearchArcsec.length < 1 || v.radiusSearchArcsec.length > 12 || !v.radiusSearchArcsec.every(n => range(n, 50, 1000)) ||
      !range(v.systemicLsrKmS, -150, 150) || !range(v.systemicUncertaintyKmS, .1, 20) || !range(v.imageToleranceArcsec, 1, 200) ||
      !range(v.velocityToleranceKmS, 1, 30) || !range(v.missingVelocityPenaltyKmS, 10, 200) || typeof v.interpretation !== 'string') throw new TypeError('Invalid joint fit recipe.');
  return { schema: v.schema, id: v.id, molecularSource: v.molecularSource, centerIcrsDegrees: [v.centerIcrsDegrees[0], v.centerIcrsDegrees[1]],
    morphologyRadiusArcsec: [v.morphologyRadiusArcsec[0], v.morphologyRadiusArcsec[1]], radiusSearchArcsec: [...v.radiusSearchArcsec],
    systemicLsrKmS: v.systemicLsrKmS, systemicUncertaintyKmS: v.systemicUncertaintyKmS, imageToleranceArcsec: v.imageToleranceArcsec,
    velocityToleranceKmS: v.velocityToleranceKmS, missingVelocityPenaltyKmS: v.missingVelocityPenaltyKmS, interpretation: v.interpretation };
}
export function readJointRequest(v: unknown): JointRequest {
  if (!jointRecord(v) || v.action !== 'apply' || v.imageId !== 'joint-fit' || !jointPath(v.cataloguePath) || !v.cataloguePath.startsWith('.local/nebula-lab/') ||
      !jointPath(v.recipePath) || !v.recipePath.startsWith('labs/nebula/models/') || !jointRecord(v.imageToFrame) || !jointRecord(v.evidence) ||
      !range(v.evidence.sensitivity, .25, 4) || !Array.isArray(v.evidence.weights) || v.evidence.weights.length < 2 || v.evidence.weights.length > 8 || !v.evidence.weights.every(n => range(n, 0, 1))) throw new TypeError('Invalid joint fit request.');
  const imageToFrame: Record<string, Matrix> = {};
  for (const [id, m] of Object.entries(v.imageToFrame)) {
    if (!/^[a-z0-9-]+$/.test(id) || !Array.isArray(m) || m.length !== 6 || !m.every(finite) || Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-12) throw new TypeError('Invalid joint image registration.');
    imageToFrame[id] = [m[0], m[1], m[2], m[3], m[4], m[5]];
  }
  return { action: v.action, imageId: v.imageId, cataloguePath: v.cataloguePath, recipePath: v.recipePath, imageToFrame,
    evidence: { sensitivity: v.evidence.sensitivity, weights: [...v.evidence.weights] }, controls: readJointControls(v.controls) };
}

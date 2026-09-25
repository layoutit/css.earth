import { readJointParameters, type JointParameters, type JointFamily } from '@cssearth/bake/volume';
export { readJointParameters, type JointParameters, type JointFamily } from '@cssearth/bake/volume';

export interface JointControls { ridgeThreshold: number; minLengthArcseconds: number; imageWeight: number; velocityWeight: number }
export const defaultJointControls: JointControls = { ridgeThreshold: .25, minLengthArcseconds: 40, imageWeight: 1, velocityWeight: 1 };
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

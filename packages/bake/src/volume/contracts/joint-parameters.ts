export type JointFamily = 'ellipsoid' | 'bipolar';
/** Angular model coordinates: west, north, away from Earth. No physical distance is inferred. */
export interface JointParameters {
  family: JointFamily; radiusArcsec: number; depthRatio: number; inclinationDegrees: number;
  positionAngleDegrees: number; expansionKmS: number; systemicLsrKmS: number;
}
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, min: number, max: number): v is number => finite(v) && v >= min && v <= max;
export function readJointParameters(v: unknown): JointParameters {
  if (!jointRecord(v) || (v.family !== 'ellipsoid' && v.family !== 'bipolar') || !range(v.radiusArcsec, 50, 1000) || !range(v.depthRatio, .5, 3) ||
      !range(v.inclinationDegrees, -85, 85) || !range(v.positionAngleDegrees, 0, 180) || !range(v.expansionKmS, 1, 80) || !range(v.systemicLsrKmS, -150, 150)) throw new TypeError('Invalid joint model parameters.');
  return { family: v.family, radiusArcsec: v.radiusArcsec, depthRatio: v.depthRatio, inclinationDegrees: v.inclinationDegrees,
    positionAngleDegrees: v.positionAngleDegrees, expansionKmS: v.expansionKmS, systemicLsrKmS: v.systemicLsrKmS };
}

import type { PitchCalibration, Quaternion, TrackballMetrics } from './math-types.js';
/** Control pitch and scene pitch are one linear scale: control 0 is the steepest scene pitch, the maximum control pitch
 * is a level scene. The default pose is a point on that scale, so a level default (scene pitch 0) needs no special case. */
export function preparedScenePitch(controlPitchDegrees: number, plan: PitchCalibration) {
  return plan.maximumScenePitchDegrees * (plan.maximumControlPitchDegrees - controlPitchDegrees) / plan.maximumControlPitchDegrees;
}

/** The control pitch whose scene pitch is `scenePitchDegrees`: the inverse of `preparedScenePitch`. */
export function preparedControlPitch(scenePitchDegrees: number, plan: Pick<PitchCalibration, 'maximumControlPitchDegrees' | 'maximumScenePitchDegrees'>) {
  return plan.maximumControlPitchDegrees * (1 - scenePitchDegrees / plan.maximumScenePitchDegrees);
}

export function conjugateRotation([x, y, z, w]: Quaternion): Quaternion {
  return [-x, -y, -z, w];
}

export function isTrackballMetrics(metrics: Pick<TrackballMetrics, "centerX" | "centerY" | "radius" | "opticalCenterX" | "opticalCenterY" | "pitchResponse"> | null | undefined): metrics is Pick<TrackballMetrics, "centerX" | "centerY" | "radius" | "opticalCenterX" | "opticalCenterY" | "pitchResponse"> {
  return metrics !== null && typeof metrics === "object" &&
    Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) &&
    (metrics.opticalCenterX === undefined || Number.isFinite(metrics.opticalCenterX)) &&
    (metrics.opticalCenterY === undefined || Number.isFinite(metrics.opticalCenterY)) &&
    Number.isFinite(metrics.radius) && metrics.radius > 0 &&
    (metrics.pitchResponse === undefined ||
      (Number.isFinite(metrics.pitchResponse) && metrics.pitchResponse > 0));
}

export function smoothstep(minimum: number, maximum: number, value: number) {
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

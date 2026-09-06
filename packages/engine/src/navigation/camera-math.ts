import type { PitchCalibration, Quaternion, TrackballMetrics } from './math-types.js';
export function preparedScenePitch(controlPitchDegrees: number, plan: PitchCalibration) {
  const progress = (
    controlPitchDegrees - plan.defaultControlPitchDegrees
  ) / (
    plan.maximumControlPitchDegrees - plan.defaultControlPitchDegrees
  );
  return plan.initialScenePitchDegrees * (1 - progress);
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

export function preparedScenePitch(controlPitchDegrees, plan) {
  const progress = (
    controlPitchDegrees - plan.defaultControlPitchDegrees
  ) / (
    plan.maximumControlPitchDegrees - plan.defaultControlPitchDegrees
  );
  return plan.initialScenePitchDegrees * (1 - progress);
}

export function conjugateRotation([x, y, z, w]) {
  return [-x, -y, -z, w];
}

export function isTrackballMetrics(metrics) {
  return metrics !== null && typeof metrics === "object" &&
    Number.isFinite(metrics.centerX) && Number.isFinite(metrics.centerY) &&
    (metrics.opticalCenterX === undefined || Number.isFinite(metrics.opticalCenterX)) &&
    (metrics.opticalCenterY === undefined || Number.isFinite(metrics.opticalCenterY)) &&
    Number.isFinite(metrics.radius) && metrics.radius > 0 &&
    (metrics.pitchResponse === undefined ||
      (Number.isFinite(metrics.pitchResponse) && metrics.pitchResponse > 0));
}

export function smoothstep(minimum, maximum, value) {
  const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

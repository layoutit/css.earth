// Camera-relative selection of prepared planet photometry. Source radii,
// albedos and the magnitude/exposure chain never enter this runtime module.
export const PREPARED_PLANET_POINT_SCHEMA = "cssearth-prepared-planet-point@1";

export function validPreparedPlanetPoint(point) {
  return point?.schema === PREPARED_PLANET_POINT_SCHEMA &&
    Number.isFinite(point.minimumLogDistance) && Number.isFinite(point.logDistanceStep) && point.logDistanceStep > 0 &&
    Number.isSafeInteger(point.distanceCount) && point.distanceCount >= 2 &&
    Number.isSafeInteger(point.phaseCount) && point.phaseCount >= 2 &&
    Array.isArray(point.samples) && point.samples.length === point.distanceCount * point.phaseCount * 3 &&
    point.samples.every((value, index) => Number.isFinite(value) && (index % 3 === 2 || value >= 0)) &&
    point.policy?.minimumRadiusPx > point.policy?.skipRadiusPx && point.policy.skipRadiusPx >= 0 &&
    point.policy.maximumRadiusPx >= point.policy.minimumRadiusPx &&
    point.policy.minimumAlpha > 0 && point.policy.minimumAlpha <= 1;
}

export function planetPointPresentation(point, distanceUnits, phaseAngleRadians, screenFactor = 1) {
  const distanceIndex = clamp((Math.log10(Math.max(distanceUnits, Number.MIN_VALUE)) - point.minimumLogDistance) /
    point.logDistanceStep, 0, point.distanceCount - 1);
  const phaseIndex = clamp(phaseAngleRadians / Math.PI * (point.phaseCount - 1), 0, point.phaseCount - 1);
  const di = Math.min(point.distanceCount - 2, Math.floor(distanceIndex));
  const pi = Math.min(point.phaseCount - 2, Math.floor(phaseIndex));
  const dt = distanceIndex - di;
  const pt = phaseIndex - pi;
  const sample = (channel) => {
    const offset = (di * point.phaseCount + pi) * 3 + channel;
    const next = offset + point.phaseCount * 3;
    return lerp(lerp(point.samples[offset], point.samples[offset + 3], pt),
      lerp(point.samples[next], point.samples[next + 3], pt), dt);
  };
  const rawRadiusPx = sample(0) * screenFactor;
  const policy = point.policy;
  const radiusPx = clamp(rawRadiusPx, policy.minimumRadiusPx, policy.maximumRadiusPx);
  const fade = clamp((rawRadiusPx - policy.skipRadiusPx) /
    (policy.minimumRadiusPx - policy.skipRadiusPx), 0, 1) ** 2;
  return Object.freeze({
    radiusPx,
    diameterPx: 2 * radiusPx,
    alpha: policy.minimumAlpha + (1 - policy.minimumAlpha) * sample(1) * fade,
    magnitude: sample(2),
  });
}

// Galaxio's global solar family has weight 1 and label base priority 1.
// Its orbit contributes only after crossing the .12 eligibility threshold.
export function planetOrbitLabelPriority(policy, sunDistanceUnits, bodyDistanceUnits, magnitude) {
  const angularDiameter = 2 * policy.radiusUnits / sunDistanceUnits;
  const readable = clamp((angularDiameter - policy.angularFadeInRadians) /
    (policy.angularFullRadians - policy.angularFadeInRadians), 0, 1);
  const nearBody = clamp((bodyDistanceUnits - policy.nearDistanceUnits) /
    (policy.farDistanceUnits - policy.nearDistanceUnits), 0, 1);
  const lineWeight = readable * nearBody;
  return -magnitude + (lineWeight >= policy.minimumEligibility ? 20 * lineWeight : 0);
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const lerp = (a, b, share) => a + (b - a) * share;

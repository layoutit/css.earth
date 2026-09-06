import {
  DISPLAY_GAMMA,
  HINT_RADIUS_PX,
  POINT_MIN_RADIUS_PX,
  SKIP_RADIUS_PX,
  magnitudeForRadiusPx,
  pointRadiusPx,
  toneMapped,
} from "./star-photometry.mjs";

// Galaxio's ordinary star-caption policy: its sole brightest named candidate
// enters the shared body/sky declutter; rejection never promotes another star.
export const STAR_LABEL_POLICY = Object.freeze({
  capPixels: 12,
  gapPixels: 7,
  spacingPixels: 4,
  boxHeightCaps: 2.2,
  poolSize: 1,
  maxAlpha: 0.55,
  maxAlphaStep: 0.1,
  capHeightEm: 0.72,
  magnitudeOffset: 0,
  color: "#f4f6fb",
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
});

export function selectStarLabel({ stars, rotation, focal, principalOffset, visibleRect, exposure }) {
  const magnitudeLimit = magnitudeForRadiusPx(exposure, HINT_RADIUS_PX) + STAR_LABEL_POLICY.magnitudeOffset;
  let selected = null;
  let selectedMagnitude = Number.POSITIVE_INFINITY;
  let anchorX = 0;
  let anchorY = 0;
  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index];
    if (typeof star.name !== "string" || star.name === "" ||
        !(star.magnitude <= magnitudeLimit) || star.magnitude >= selectedMagnitude) continue;
    const direction = star.direction;
    const x = rotation[0] * direction[0] + rotation[1] * direction[1] + rotation[2] * direction[2];
    const y = rotation[3] * direction[0] + rotation[4] * direction[1] + rotation[5] * direction[2];
    const depth = -(rotation[6] * direction[0] + rotation[7] * direction[1] + rotation[8] * direction[2]);
    if (!(depth > 0)) continue;
    const projectedX = principalOffset[0] + focal * x / depth;
    const projectedY = principalOffset[1] + focal * y / depth;
    if (!(projectedX >= visibleRect.left && projectedX <= visibleRect.right &&
          projectedY >= visibleRect.top && projectedY <= visibleRect.bottom)) continue;
    selected = star;
    selectedMagnitude = star.magnitude;
    anchorX = projectedX;
    anchorY = projectedY;
  }
  if (selected === null) return null;

  const rawRadius = pointRadiusPx(exposure, selectedMagnitude);
  const fade = rawRadius >= POINT_MIN_RADIUS_PX ? 1 :
    Math.max(0, (rawRadius - SKIP_RADIUS_PX) / (POINT_MIN_RADIUS_PX - SKIP_RADIUS_PX)) ** 2;
  // Captions use the uncapped point-source alpha; the star's intensity knob
  // and compact-PSF ceiling do not dim the text naming it.
  const pointAlpha = Math.min(1, Math.max(0, toneMapped(exposure, selectedMagnitude))) ** (1 / DISPLAY_GAMMA) * fade;
  return {
    id: selected.id ?? `star:${selected.hip}`,
    name: selected.name,
    magnitude: selectedMagnitude,
    anchor: [anchorX, anchorY],
    radiusPx: Math.min(exposure.maxRadiusPx, Math.max(POINT_MIN_RADIUS_PX, rawRadius)),
    alpha: pointAlpha * STAR_LABEL_POLICY.maxAlpha,
    priority: -selectedMagnitude,
  };
}

export interface ExposureOptions { fovDegrees: number; screenFactor?:number; adaptationLuminanceCdM2?:number; exposureScale?:number; intensityMax?:number; maxRadiusPx?:number; haloPeak?:number; linearScale?:number; }
export type Exposure = ReturnType<typeof createExposure>;
export type StarPresentation = NonNullable<ReturnType<typeof starPresentation>>;
export type ExposureKnobs = Pick<ExposureOptions, 'adaptationLuminanceCdM2'|'exposureScale'|'intensityMax'|'maxRadiusPx'|'haloPeak'|'linearScale'>;
// The point-source photometric chain the catalogue stars are drawn with:
// Stellarium Web's, as galaxio tunes it. Pure arithmetic shared by the
// preparation (prepare-catalogue-stars.mjs) and the runtime's session
// exposure knob (cubic-sky-runtime.mjs), so a tuned exposure recomputes the
// retained points with exactly the prepared chain.
//
// For a field of view F and a star of apparent magnitude m:
//   1. E = 2.53016e-6 * 10^(-0.4 m) lux (illuminance zero point);
//   2. L = E * lightGrasp(F) / 1.66138e-6 cd/m^2 (the eye's 2.5' PSF);
//   3. gain = exposureScale / ln(1 + p * adaptation), p = 2.2;
//   4. ld = ln(1 + p L) * gain (Schlick tone map);
//   5. raw = linearScale * screenFactor * ld^(1.1/2) px;
//   6. radius = clamp(raw, 0.6, maxRadiusPx); below 0.6 the star fades
//      instead of shrinking, and below 0.25 it is not drawn;
//   7. alpha = min(intensityMax, clamp(ld, 0, 1)^(1/2.2) * fade);
//   8. halo: a bloom of alpha 2 * haloPeak, 1.25 radii wide.
// The reference caps the disc at 1.25 px on purpose: past the cap,
// magnitude reaches the eye as luminance and halo, not size.

export const ILLUMINANCE_ZEROPOINT_LUX = 2.53016e-6;
export const EYE_PSF_SOLID_ANGLE_SR = 1.66138e-6;
export const TONEMAP_P = 2.2;
export const DISPLAY_GAMMA = 2.2;
// The reference's tuning (galaxio TUNING and STAR_* constants).
export const ADAPTATION_LUMINANCE_CD_M2 = 0.052;
export const EXPOSURE_SCALE = 2;
export const STAR_LINEAR_SCALE = 1.0727;
export const STAR_RELATIVE_SCALE = 1.1;
export const SKIP_RADIUS_PX = 0.25;
export const HINT_RADIUS_PX = 0.4;
export const POINT_MIN_RADIUS_PX = 0.6;
export const STAR_RADIUS_MAX_PX = 1.25;
export const STAR_INTENSITY_MAX = 0.95;
export const HALO_PEAK = 0.08;
export const HALO_BLUR_RADII = 1.25;
export const HALO_SPREAD_RADII = 0.25;
// The screen factor: 1 at a 600 px short side, clamped to 0.7..1.5. The
// prepared sizes are quoted at factor 1; the runtime applies the live
// viewport's factor through one CSS variable.
export const SCREEN_FACTOR_REFERENCE_PX = 600;
export const SCREEN_FACTOR_RANGE = Object.freeze([0.7, 1.5]);

// The knobs a session may turn, with the prepared chain's values.
export const EXPOSURE_KNOBS = Object.freeze({
  adaptationLuminanceCdM2: ADAPTATION_LUMINANCE_CD_M2,
  exposureScale: EXPOSURE_SCALE,
  intensityMax: STAR_INTENSITY_MAX,
  maxRadiusPx: STAR_RADIUS_MAX_PX,
  haloPeak: HALO_PEAK,
  linearScale: STAR_LINEAR_SCALE,
});

// The naked eye at 60 degrees: the reference's `lightGrasp(60)` is exactly 1.
export function lightGrasp(fovDegrees: number) {
  const magnification = 60 / Math.max(1e-6, fovDegrees);
  const stretch = Math.pow(Math.max(1, 5 / fovDegrees), 0.07);
  return Math.max(0.4, magnification * magnification * stretch);
}

export function screenFactor(viewportWidthPx: number, viewportHeightPx: number) {
  const smaller = Math.min(viewportWidthPx, viewportHeightPx);
  return Math.min(SCREEN_FACTOR_RANGE[1], Math.max(SCREEN_FACTOR_RANGE[0], smaller / SCREEN_FACTOR_REFERENCE_PX));
}

// The exposure state for a field, a screen factor and the knobs: the terms
// of the chain that do not depend on the star.
export function createExposure({
  fovDegrees,
  screenFactor: factor = 1,
  adaptationLuminanceCdM2 = EXPOSURE_KNOBS.adaptationLuminanceCdM2,
  exposureScale = EXPOSURE_KNOBS.exposureScale,
  intensityMax = EXPOSURE_KNOBS.intensityMax,
  maxRadiusPx = EXPOSURE_KNOBS.maxRadiusPx,
  haloPeak = EXPOSURE_KNOBS.haloPeak,
  linearScale = EXPOSURE_KNOBS.linearScale,
}: ExposureOptions = { fovDegrees: NaN }) {
  if (!(fovDegrees > 0) || !(factor > 0) || !(adaptationLuminanceCdM2 > 0) || !(exposureScale > 0) ||
      !(intensityMax > 0) || intensityMax > 1 || !(maxRadiusPx >= POINT_MIN_RADIUS_PX) ||
      !(haloPeak >= 0) || haloPeak > 0.5 || !(linearScale > 0)) {
    throw new TypeError("Star exposure arguments are invalid.");
  }
  const luminanceScale = ILLUMINANCE_ZEROPOINT_LUX * lightGrasp(fovDegrees) / EYE_PSF_SOLID_ANGLE_SR;
  const exposureGain = exposureScale / Math.log(1 + TONEMAP_P * adaptationLuminanceCdM2);
  return Object.freeze({
    fovDegrees, screenFactor: factor, adaptationLuminanceCdM2, exposureScale, intensityMax, maxRadiusPx, haloPeak, linearScale,
    luminanceScale, exposureGain,
    radiusScale: linearScale * factor,
    radiusExponent: STAR_RELATIVE_SCALE / 2,
  });
}

// Tone-mapped value `ld` of a point source of apparent magnitude m.
export function toneMapped(exposure: Exposure, magnitude: number) {
  const luminance = exposure.luminanceScale * Math.pow(10, -0.4 * magnitude);
  return Math.log(1 + TONEMAP_P * luminance) * exposure.exposureGain;
}

// Raw photometric radius in pixels (before the presentation cap), and the
// magnitude at which the radius equals `radiusPx` (the chain inverted in
// closed form), as the reference derives its limits.
export function pointRadiusPx(exposure: Exposure, magnitude: number) {
  return exposure.radiusScale * Math.pow(toneMapped(exposure, magnitude), exposure.radiusExponent);
}

export function magnitudeForRadiusPx(exposure: Exposure, radiusPx: number) {
  const ld = Math.pow(radiusPx / exposure.radiusScale, 1 / exposure.radiusExponent);
  const luminance = (Math.exp(ld / exposure.exposureGain) - 1) / TONEMAP_P;
  return -2.5 * Math.log10(luminance / exposure.luminanceScale);
}

// The magnitudes the exposure implies: nothing fainter than the limit is
// drawn; fainter than the pin a star is pinned at the minimum radius and
// faded; the hints limit is the reference's caption floor.
export function exposureLimits(exposure: Exposure) {
  return Object.freeze({
    limitingMagnitude: magnitudeForRadiusPx(exposure, SKIP_RADIUS_PX),
    hintsLimitMagnitude: magnitudeForRadiusPx(exposure, HINT_RADIUS_PX),
    pinMagnitude: magnitudeForRadiusPx(exposure, POINT_MIN_RADIUS_PX),
  });
}

// A star's presented radius (capped, as the reference's
// `presentedStarRadiusPx`), its display luminance 0..1 including the
// sub-pixel fade between the skip radius and the minimum radius, and its
// halo's alpha.
export function starPresentation(exposure: Exposure, magnitude: number) {
  const raw = pointRadiusPx(exposure, magnitude);
  if (raw < SKIP_RADIUS_PX) return null;
  const ld = toneMapped(exposure, magnitude);
  let luminance = Math.min(exposure.intensityMax, Math.pow(Math.min(1, Math.max(0, ld)), 1 / DISPLAY_GAMMA));
  let radius = raw;
  if (raw < POINT_MIN_RADIUS_PX) {
    const fade = (raw - SKIP_RADIUS_PX) / (POINT_MIN_RADIUS_PX - SKIP_RADIUS_PX);
    luminance *= fade * fade;
    radius = POINT_MIN_RADIUS_PX;
  }
  return Object.freeze({
    rawRadiusPx: raw,
    radiusPx: Math.min(exposure.maxRadiusPx, radius),
    luminance,
    haloAlpha: 2 * exposure.haloPeak,
  });
}

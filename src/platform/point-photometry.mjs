// How big and how bright an unresolved point source is drawn: Stellarium
// Web's photometric chain, as the reference engine (galaxio
// `pointPhotometry.ts`, `stars/starPhotometry.ts`, `stars/starPresentation.ts`
// and `stars/starColor.ts`) adopts it. Its numbers and physics are used; no
// code is copied from Stellarium Web. Pure functions over an explicit
// exposure record: there is no per-frame singleton here because this chain
// runs at PREPARE time (every star's radius and luminance are prepared) and
// its closed-form inverses gate which prepared bands a runtime shows.
//
//   m   ->  E (lux)      E  = 2.53016e-6 * 10^(-0.4 m)
//       ->  L (cd/m^2)   L  = E * G / A_psf        A_psf = 1.66138e-6 sr
//                                                  G     = light grasp (FOV)
//       ->  ld           ld = ln(1 + 2.2 L) * exposureScale / ln(1 + 2.2 Lwmax)
//       ->  radius px    r  = radiusScale * ld^0.55
//       ->  luminance    lum = clamp(ld, 0, 1)^(1/2.2)
//
// A_psf is the solid angle of the dark-adapted eye's own point-spread
// function (a 2.5 arcmin disc), which is what makes this a chain about a
// point rather than a surface. G is a simulated telescope: narrowing the
// field of view buys aperture, so a narrower field reveals fainter stars the
// way an instrument does. Lwmax is the luminance the eye is adapted to, held
// at its dark floor here (the reference chases it toward the brightest thing
// on screen; a retained CSS sky has no per-frame exposure pass, so the
// prepared field is the dark-adapted one). Every limit is DERIVED from the
// curve: the faintest star drawn is the one whose radius falls to the skip
// radius, the faintest worth naming the one at the hints radius, and both
// are exact inverses (`magnitudeForRadiusPx`), never typed-in magnitudes.

export const POINT_PHOTOMETRY = Object.freeze({
  source: "Stellarium Web engine photometric chain as adopted by galaxio " +
    "(pointPhotometry.ts); constants only, no code",
  // Illuminance in lux of a magnitude-0 source (1.07646e5 / 206264.806^2).
  illuminanceZeropointLux: 2.53016e-6,
  // Solid angle of the eye's point-spread function, a 2.5 arcmin disc.
  eyePsfSolidAngleSr: 1.66138e-6,
  // Schlick's tone-map parameter and the gain in front of it.
  tonemapP: 2.2,
  exposureScale: 2,
  // The dark-adapted floor of the adapting luminance maximum, cd/m^2.
  adaptationLuminanceCdM2: 0.052,
  // Radius gain and exponent (the reference's starLinearScale and half its
  // starRelativeScale).
  radiusLinearScale: 1.0727,
  radiusExponent: 0.55,
  // Below the skip radius nothing is drawn; between it and the minimum
  // radius the size is pinned and the light is taken away instead.
  skipRadiusPx: 0.25,
  hintsRadiusPx: 0.4,
  minRadiusPx: 0.6,
  maxRadiusPx: 50,
  displayGamma: 2.2,
  // Resolution compensation: clamp(min(w, h) / 600, 0.7, 1.5).
  screenFactorReferencePx: 600,
  screenFactorMin: 0.7,
  screenFactorMax: 1.5,
});

// Screen-space constraints on a STAR, measured by the reference from a
// public capture: a compact bloom rather than the wide body-marker halo,
// and a radius ceiling far below the chain's own 50 px, so that magnitude
// reaches the eye as luminance and halo once the disc is capped.
export const STAR_PRESENTATION = Object.freeze({
  maxRadiusPx: 1.25,
  haloRadii: 2.5,
  haloPeak: 0.08,
  intensityMax: 0.95,
});

export function lightGrasp(fovDegrees) {
  const fov = fovDegrees > 1e-6 ? fovDegrees : 1e-6;
  const magnification = 60 / fov;
  const stretch = Math.pow(Math.max(1, 5 / fov), 0.07);
  return Math.max(0.4, magnification * magnification * stretch);
}

export function screenFactor(viewportWidthPx, viewportHeightPx) {
  const smaller = Math.min(viewportWidthPx, viewportHeightPx);
  return Math.min(POINT_PHOTOMETRY.screenFactorMax,
    Math.max(POINT_PHOTOMETRY.screenFactorMin, smaller / POINT_PHOTOMETRY.screenFactorReferencePx));
}

// Everything in the chain that does not depend on the source's own
// magnitude, evaluated once for a field of view, a screen factor and an
// adaptation luminance.
// `adaptationLuminanceCdM2` says which eye is modelled: the reference's
// dark floor (0.052) is a fully dark-adapted eye, and raising it models a
// less adapted one (a lit screen beside a UI), which lowers every star's
// tone-mapped value in the same proportion in log space, preserving the
// ordering and moving every derived limit with it. `exposureScale` is the
// gain in front of the tone map, the blunt global lever.
export function createExposure({
  fovDegrees,
  screenFactor: factor = 1,
  adaptationLuminanceCdM2 = POINT_PHOTOMETRY.adaptationLuminanceCdM2,
  exposureScale = POINT_PHOTOMETRY.exposureScale,
} = {}) {
  if (!(fovDegrees > 0) || !(factor > 0) || !(adaptationLuminanceCdM2 > 0) || !(exposureScale > 0)) {
    throw new TypeError("Exposure needs a positive field of view, screen factor, adaptation luminance and exposure scale.");
  }
  const constants = POINT_PHOTOMETRY;
  return Object.freeze({
    fovDegrees,
    screenFactor: factor,
    adaptationLuminanceCdM2,
    exposureScale,
    lightGrasp: lightGrasp(fovDegrees),
    luminanceScale: constants.illuminanceZeropointLux * lightGrasp(fovDegrees) / constants.eyePsfSolidAngleSr,
    exposureGain: exposureScale / Math.log(1 + constants.tonemapP * adaptationLuminanceCdM2),
    radiusScale: constants.radiusLinearScale * factor,
    radiusExponent: constants.radiusExponent,
  });
}

export function apparentLuminance(exposure, magnitude) {
  return exposure.luminanceScale * Math.pow(10, -0.4 * magnitude);
}

export function displayValue(exposure, luminanceCdM2) {
  return Math.log(1 + POINT_PHOTOMETRY.tonemapP * luminanceCdM2) * exposure.exposureGain;
}

export function rawRadiusPx(exposure, magnitude) {
  const display = displayValue(exposure, apparentLuminance(exposure, magnitude));
  return display > 0 ? exposure.radiusScale * Math.pow(display, exposure.radiusExponent) : 0;
}

export function drawnRadiusPx(raw, { minRadiusPx = POINT_PHOTOMETRY.minRadiusPx, maxRadiusPx = POINT_PHOTOMETRY.maxRadiusPx } = {}) {
  if (raw < minRadiusPx) return minRadiusPx;
  return raw > maxRadiusPx ? maxRadiusPx : raw;
}

// The fade that takes a sub-pixel point to nothing instead of shrinking it:
// squared, because the drawn area is held while the light is removed.
export function faintFade(raw) {
  const min = POINT_PHOTOMETRY.minRadiusPx;
  if (raw >= min) return 1;
  if (raw <= POINT_PHOTOMETRY.skipRadiusPx) return 0;
  const t = (raw - POINT_PHOTOMETRY.skipRadiusPx) / (min - POINT_PHOTOMETRY.skipRadiusPx);
  return t * t;
}

export function pointLuminance(display) {
  const clamped = display > 1 ? 1 : display > 0 ? display : 0;
  return Math.pow(clamped, 1 / POINT_PHOTOMETRY.displayGamma);
}

// The whole chain, magnitude in, drawn alpha out: zero at and past the
// limiting magnitude, monotonically decreasing everywhere.
export function pointSourceAlpha(exposure, magnitude) {
  const display = displayValue(exposure, apparentLuminance(exposure, magnitude));
  const raw = display > 0 ? exposure.radiusScale * Math.pow(display, exposure.radiusExponent) : 0;
  const fade = faintFade(raw);
  return fade === 0 ? 0 : pointLuminance(display) * fade;
}

// The inverse in closed form: the apparent magnitude whose unclamped radius
// is exactly `radiusPx`.
export function magnitudeForRadiusPx(exposure, radiusPx) {
  if (!(radiusPx > 0) || !(exposure.radiusScale > 0)) return Number.NEGATIVE_INFINITY;
  const display = Math.pow(radiusPx / exposure.radiusScale, 1 / exposure.radiusExponent);
  const luminance = (Math.exp(display / exposure.exposureGain) - 1) / POINT_PHOTOMETRY.tonemapP;
  if (!(luminance > 0)) return Number.POSITIVE_INFINITY;
  return -2.5 * Math.log10(luminance / exposure.luminanceScale);
}

export function limitingMagnitude(exposure) {
  return magnitudeForRadiusPx(exposure, POINT_PHOTOMETRY.skipRadiusPx);
}

export function hintsLimitMagnitude(exposure) {
  return magnitudeForRadiusPx(exposure, POINT_PHOTOMETRY.hintsRadiusPx);
}

// The magnitude at which the drawn radius reaches the pin: fainter stars
// are drawn at the minimum radius with their light faded.
export function pinMagnitude(exposure) {
  return magnitudeForRadiusPx(exposure, POINT_PHOTOMETRY.minRadiusPx);
}

// A star's drawn radius: the chain's radius pinned at the minimum and
// capped at the star presentation's ceiling.
export function starRadiusPx(exposure, magnitude, maxRadiusPx = STAR_PRESENTATION.maxRadiusPx) {
  return Math.min(maxRadiusPx, drawnRadiusPx(rawRadiusPx(exposure, magnitude)));
}

export function starIntensity(exposure, magnitude, intensityMax = STAR_PRESENTATION.intensityMax) {
  return Math.min(intensityMax, pointSourceAlpha(exposure, magnitude));
}

// Distance modulus: m = M + 5 log10(d / 10 pc).
export function apparentMagnitudeFromAbsolute(absoluteMagnitude, distancePc) {
  const d = distancePc > 1e-6 ? distancePc : 1e-6;
  return absoluteMagnitude + 5 * Math.log10(d) - 5;
}

// Star colour for legibility rather than photometric accuracy: Tanner
// Helland's blackbody fit (1000-40000 K) from the effective temperature,
// Ballesteros (2012) for B-V when no temperature is published, neutral
// white when neither is.
const TEFF_MIN_K = 1000;
const TEFF_MAX_K = 40000;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function teffKToRgb(teffK) {
  const t = Math.min(TEFF_MAX_K, Math.max(TEFF_MIN_K, teffK)) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return Object.freeze([clamp01(red / 255), clamp01(green / 255), clamp01(blue / 255)]);
}

export function bvToTeffK(colorIndexBv) {
  const bv = Math.min(4, Math.max(-0.4, colorIndexBv));
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

export const NEUTRAL_STAR_COLOR = Object.freeze([1, 1, 1]);

export function starColorOf(teffK, colorIndexBv) {
  if (Number.isFinite(teffK)) return teffKToRgb(teffK);
  if (Number.isFinite(colorIndexBv)) return teffKToRgb(bvToTeffK(colorIndexBv));
  return NEUTRAL_STAR_COLOR;
}

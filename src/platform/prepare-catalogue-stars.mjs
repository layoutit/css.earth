// Preparation of a body's catalogue stars: which HYG stars are drawn in its
// sky, where (ICRS directions, the cube's own axes), and how big and bright.
// Runs in an object's prepare tools only; the runtime transports the result.
//
// Selection and appearance follow the reference engine (galaxio
// `stars/starPhotometry.ts`, `pointPhotometry.ts`, `stars/starColor.ts`),
// which adopts Stellarium Web's photometric chain: apparent magnitude to
// illuminance, through the dark-adapted eye's point-spread solid angle to a
// luminance, Schlick's tone map at the dark adaptation floor, then a radius
// in pixels and a display luminance. The field of view here is fixed (the
// prepared sky cube's 60 degrees), so the chain's light grasp is the naked
// eye's and the limiting magnitude is the one whose radius falls to the
// skip threshold; a zoom that changed the field would move it, and the
// bands below are the data such a zoom would switch between.
//
// The stars are split by apparent magnitude into bands: the brightest are
// retained DOM points on the sky cube (crisp, coloured, sized per star),
// the rest are stamped into the prepared cube faces at preparation. The
// photograph keeps only its diffuse light, so no star is drawn twice.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const PREPARED_CATALOGUE_STARS_SCHEMA = "cssearth-prepared-catalogue-stars@1";

// Stellarium Web's chain, as the reference has it (constants named there).
export const ILLUMINANCE_ZEROPOINT_LUX = 2.53016e-6;
export const EYE_PSF_SOLID_ANGLE_SR = 1.66138e-6;
export const TONEMAP_P = 2.2;
export const DISPLAY_GAMMA = 2.2;
// The reference's tuning at its dark floor (no adaptation: nothing in the
// prepared sky reports luminance).
export const ADAPTATION_LUMINANCE_CD_M2 = 0.052;
export const EXPOSURE_SCALE = 2;
export const STAR_LINEAR_SCALE = 1.5;
export const STAR_RELATIVE_SCALE = 1.1;
export const SKIP_RADIUS_PX = 0.25;
export const POINT_MIN_RADIUS_PX = 0.6;
export const STAR_RADIUS_MAX_PX = 1.25;
export const STAR_HALO_RADII = 2.5;
export const STAR_INTENSITY_MAX = 0.95;
// A deliberate departure for the retained band: the reference caps every
// presented star at 1.25 px to match its Galaxium captures, which draws
// Sirius and Polaris as the same dot. Here magnitude also reads as size,
// as the chain intends: the raw photometric radius scaled down, floored at
// the minimum point radius and ceilinged at three pixels.
export const RETAINED_RADIUS_SHARE = 0.22;
export const RETAINED_RADIUS_MAX_PX = 3;
// Reference viewport for the radius gain (the chain's screen factor is 1 at
// 600 px and clamped to 0.7-1.5); the prepared sizes are quoted at 900 px.
export const REFERENCE_VIEWPORT_HEIGHT_PX = 900;

// The naked eye at 60 degrees: the reference's `lightGrasp(60)` is exactly 1.
export function lightGrasp(fovDegrees) {
  const magnification = 60 / Math.max(1e-6, fovDegrees);
  const stretch = Math.pow(Math.max(1, 5 / fovDegrees), 0.07);
  return Math.max(0.4, magnification * magnification * stretch);
}

export function screenFactor(viewportWidthPx, viewportHeightPx) {
  const smaller = Math.min(viewportWidthPx, viewportHeightPx);
  return Math.min(1.5, Math.max(0.7, smaller / 600));
}

// The exposure state for a fixed field and viewport: the terms of the chain
// that do not depend on the star.
export function createExposure({ fovDegrees, viewportWidthPx, viewportHeightPx }) {
  const luminanceScale = ILLUMINANCE_ZEROPOINT_LUX * lightGrasp(fovDegrees) / EYE_PSF_SOLID_ANGLE_SR;
  const exposureGain = EXPOSURE_SCALE / Math.log(1 + TONEMAP_P * ADAPTATION_LUMINANCE_CD_M2);
  const radiusScale = STAR_LINEAR_SCALE * screenFactor(viewportWidthPx, viewportHeightPx);
  const radiusExponent = STAR_RELATIVE_SCALE / 2;
  return Object.freeze({ fovDegrees, luminanceScale, exposureGain, radiusScale, radiusExponent });
}

// Tone-mapped value `ld` of a point source of apparent magnitude m.
export function toneMapped(exposure, magnitude) {
  const luminance = exposure.luminanceScale * Math.pow(10, -0.4 * magnitude);
  return Math.log(1 + TONEMAP_P * luminance) * exposure.exposureGain;
}

// Raw photometric radius in pixels (before the presentation cap), and the
// magnitude at which the radius equals `radiusPx` (the chain inverted in
// closed form), as the reference derives its limits.
export function pointRadiusPx(exposure, magnitude) {
  return exposure.radiusScale * Math.pow(toneMapped(exposure, magnitude), exposure.radiusExponent);
}

export function magnitudeForRadiusPx(exposure, radiusPx) {
  const ld = Math.pow(radiusPx / exposure.radiusScale, 1 / exposure.radiusExponent);
  const luminance = (Math.exp(ld / exposure.exposureGain) - 1) / TONEMAP_P;
  return -2.5 * Math.log10(luminance / exposure.luminanceScale);
}

// A star's presented radius (capped, as the reference's `presentedStarRadiusPx`)
// and its display luminance 0..1, including the sub-pixel fade between the
// skip radius and the minimum radius.
export function starPresentation(exposure, magnitude) {
  const raw = pointRadiusPx(exposure, magnitude);
  if (raw < SKIP_RADIUS_PX) return null;
  const ld = toneMapped(exposure, magnitude);
  let luminance = Math.min(STAR_INTENSITY_MAX, Math.pow(Math.min(1, Math.max(0, ld)), 1 / DISPLAY_GAMMA));
  let radius = raw;
  if (raw < POINT_MIN_RADIUS_PX) {
    const fade = (raw - SKIP_RADIUS_PX) / (POINT_MIN_RADIUS_PX - SKIP_RADIUS_PX);
    luminance *= fade * fade;
    radius = POINT_MIN_RADIUS_PX;
  }
  return Object.freeze({
    rawRadiusPx: raw,
    radiusPx: Math.min(STAR_RADIUS_MAX_PX, radius),
    haloRadiusPx: Math.min(STAR_RADIUS_MAX_PX, radius) * STAR_HALO_RADII,
    retainedRadiusPx: Math.min(RETAINED_RADIUS_MAX_PX, Math.max(POINT_MIN_RADIUS_PX, raw * RETAINED_RADIUS_SHARE)),
    luminance,
  });
}

// Apparent magnitude from the catalogue's absolute magnitude and distance.
export function apparentMagnitude(absoluteMagnitude, distanceParsecs) {
  return absoluteMagnitude + 5 * Math.log10(Math.max(1e-6, distanceParsecs)) - 5;
}

// Blackbody colour at Teff (Tanner Helland's fit, as the reference uses),
// and Ballesteros' B-V to Teff where no Teff is published.
export function teffToRgb(teffK) {
  const t = Math.min(40000, Math.max(1000, teffK)) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = (value) => Math.round(Math.min(255, Math.max(0, value)));
  return [clamp(red), clamp(green), clamp(blue)];
}

export function bvToTeff(colorIndexBv) {
  const bv = Math.min(4, Math.max(-0.4, colorIndexBv));
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

export function starColor(teffK, colorIndexBv) {
  if (Number.isFinite(teffK)) return teffToRgb(teffK);
  if (Number.isFinite(colorIndexBv)) return teffToRgb(bvToTeff(colorIndexBv));
  return [255, 255, 255];
}

// The bands, by apparent magnitude: `retained` stars are DOM points; the
// others are stamped into the cube faces. The limit is derived from the
// chain (the magnitude whose raw radius falls to the skip threshold).
export const CATALOGUE_STAR_BANDS = Object.freeze([
  Object.freeze({ id: "brilliant", faintestMagnitude: 1.5, presentation: "retained" }),
  Object.freeze({ id: "bright", faintestMagnitude: 3.5, presentation: "retained" }),
  Object.freeze({ id: "naked-eye", faintestMagnitude: 5.0, presentation: "stamped" }),
  Object.freeze({ id: "faint", faintestMagnitude: Number.POSITIVE_INFINITY, presentation: "stamped" }),
]);

export async function loadCatalogue(path) {
  const { readCatalog } = await import("@cssearth/catalog").catch((cause) => {
    throw new Error("Preparation needs the vendored catalog package build (`pnpm build:catalog`).", { cause });
  });
  const bytes = await readFile(path);
  return readCatalog(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

export const HYG_CATALOGUE_PATH = resolve(import.meta.dirname, "../../data/catalogs/stars-hyg/v1/stars-hyg.gxct");

// Every catalogue star the chain draws at all, with its ICRS direction,
// magnitude, presentation and colour, sorted brightest first and banded.
export async function prepareCatalogueStars({
  cataloguePath = HYG_CATALOGUE_PATH,
  fovDegrees,
  viewportWidthPx = REFERENCE_VIEWPORT_HEIGHT_PX * 16 / 10,
  viewportHeightPx = REFERENCE_VIEWPORT_HEIGHT_PX,
  bands = CATALOGUE_STAR_BANDS,
  catalogue = null,
} = {}) {
  if (!(fovDegrees > 0) || !(viewportWidthPx > 0) || !(viewportHeightPx > 0)) {
    throw new TypeError("Catalogue star preparation arguments are invalid.");
  }
  const source = catalogue ?? await loadCatalogue(cataloguePath);
  const exposure = createExposure({ fovDegrees, viewportWidthPx, viewportHeightPx });
  const limitingMagnitude = magnitudeForRadiusPx(exposure, SKIP_RADIUS_PX);
  const position = source.numeric("posPc");
  const absoluteMagnitude = source.numeric("absMag");
  const teff = source.numeric("teffK");
  const colorIndex = source.numeric("colorIndexBv");
  const hip = source.numeric("hip");
  const names = source.strings("name");
  const stars = [];
  for (let index = 0; index < source.count; index += 1) {
    const x = position[3 * index];
    const y = position[3 * index + 1];
    const z = position[3 * index + 2];
    const distance = Math.hypot(x, y, z);
    if (!(distance > 0)) continue;
    const magnitude = apparentMagnitude(absoluteMagnitude[index], distance);
    if (!(magnitude <= limitingMagnitude)) continue;
    const presentation = starPresentation(exposure, magnitude);
    if (presentation === null) continue;
    const band = bands.find((entry) => magnitude <= entry.faintestMagnitude);
    stars.push(Object.freeze({
      hip: hip[index],
      name: names[index] || null,
      // Unit ICRS direction from the Sun (the cube's own axes).
      direction: Object.freeze([x / distance, y / distance, z / distance].map((value) => Number(value.toFixed(7)))),
      distanceParsecs: Number(distance.toFixed(3)),
      magnitude: Number(magnitude.toFixed(3)),
      band: band.id,
      presentation: band.presentation,
      radiusPx: Number(presentation.radiusPx.toFixed(3)),
      rawRadiusPx: Number(presentation.rawRadiusPx.toFixed(3)),
      retainedRadiusPx: Number(presentation.retainedRadiusPx.toFixed(3)),
      haloRadiusPx: Number(presentation.haloRadiusPx.toFixed(3)),
      luminance: Number(presentation.luminance.toFixed(4)),
      color: starColor(teff[index], colorIndex[index]),
    }));
  }
  stars.sort((a, b) => a.magnitude - b.magnitude);
  return Object.freeze({
    schema: PREPARED_CATALOGUE_STARS_SCHEMA,
    model: "stellarium-web-photometric-chain-at-fixed-field",
    source: source.meta,
    exposure,
    limitingMagnitude: Number(limitingMagnitude.toFixed(3)),
    bands: Object.freeze(bands.map((band) => Object.freeze({
      ...band,
      count: stars.filter((star) => star.band === band.id).length,
    }))),
    count: stars.length,
    retainedCount: stars.filter((star) => star.presentation === "retained").length,
    stars: Object.freeze(stars),
    runtimeGeometryDerivation: false,
  });
}

// Where a unit ICRS direction lands on the sky cube: the face and its (u, v)
// in -1..1, the inverse of the cube's own face sampling (front is -z, right
// +x, top -y; CSS axes with +y down). And the CSS transform that places a
// retained point on that direction just inside the faces, facing the eye at
// the cube's centre.
export function cubeFaceOf([x, y, z]) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) {
    return x > 0 ? { face: "right", u: z / x, v: y / x } : { face: "left", u: -z / -x, v: y / -x };
  }
  if (ay >= az) {
    return y > 0 ? { face: "bottom", u: x / y, v: z / y } : { face: "top", u: x / -y, v: -z / -y };
  }
  return z > 0 ? { face: "back", u: -x / z, v: y / z } : { face: "front", u: x / -z, v: y / -z };
}

export const RETAINED_STAR_RADIUS_SHARE_OF_HALF_SIDE = 0.99;

export function retainedStarTransform([x, y, z]) {
  const share = RETAINED_STAR_RADIUS_SHARE_OF_HALF_SIDE;
  const place = (component) => `calc(${Number((component * share).toFixed(6))} * var(--planet-cubic-sky-half-side))`;
  // The disc's normal must point at the origin: rotateY(A) rotateX(B) takes
  // +z to (cos B sin A, -sin B, cos B cos A) = -direction.
  const yaw = Math.atan2(-x, -z) * 180 / Math.PI;
  const pitch = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
  return `translate3d(${place(x)}, ${place(y)}, ${place(z)}) rotateY(${yaw.toFixed(3)}deg) rotateX(${pitch.toFixed(3)}deg)`;
}

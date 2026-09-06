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
// The stars are split by apparent magnitude into bands: to magnitude 5 they
// are retained DOM points on the sky cube (crisp, coloured, capped at the
// reference's 1.25 px, lit and haloed per star) and the photograph's own
// images of them are removed at preparation; the rest stay photographic,
// placed by the registered photograph. The retained population is what a
// session's exposure knob can move; the photograph keeps its own exposure.
//
// The prepared sizes are quoted at screen factor 1; the runtime applies the
// live viewport's factor (min(w, h) / 600, clamped to 0.7..1.5).

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SKIP_RADIUS_PX, createExposure, exposureLimits, starPresentation } from "./star-photometry.mjs";

export const PREPARED_CATALOGUE_STARS_SCHEMA = "cssearth-prepared-catalogue-stars@1";

// The chain itself lives in star-photometry.mjs (shared with the runtime's
// session exposure knob); re-exported here for the preparation's callers.
export {
  ADAPTATION_LUMINANCE_CD_M2, DISPLAY_GAMMA, EXPOSURE_KNOBS, EXPOSURE_SCALE, EYE_PSF_SOLID_ANGLE_SR, HALO_PEAK,
  ILLUMINANCE_ZEROPOINT_LUX, POINT_MIN_RADIUS_PX, SKIP_RADIUS_PX, STAR_INTENSITY_MAX, STAR_LINEAR_SCALE,
  STAR_RADIUS_MAX_PX, STAR_RELATIVE_SCALE, TONEMAP_P, createExposure, exposureLimits, lightGrasp,
  magnitudeForRadiusPx, pointRadiusPx, screenFactor, starPresentation, toneMapped,
} from "./star-photometry.mjs";

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

// The bands, by apparent magnitude: `retained` stars are DOM points, drawn
// from the catalogue with their photographic image removed; the others
// stay `photographic`, placed by the registered photograph itself. The
// limit is derived from the chain (the magnitude whose raw radius falls to
// the skip threshold) and bounds what the record lists.
// The reference's band edges (1, 2, 3, 4, 4.5, 5): 16, 34, 125, 340, 389
// and 695 stars, 1,599 retained points, measured free at frame publication.
export const CATALOGUE_STAR_BANDS = Object.freeze([
  Object.freeze({ id: "brilliant", faintestMagnitude: 1, presentation: "retained" }),
  Object.freeze({ id: "bright", faintestMagnitude: 2, presentation: "retained" }),
  Object.freeze({ id: "clear", faintestMagnitude: 3, presentation: "retained" }),
  Object.freeze({ id: "naked-eye", faintestMagnitude: 4, presentation: "retained" }),
  Object.freeze({ id: "faint", faintestMagnitude: 4.5, presentation: "retained" }),
  Object.freeze({ id: "faintest", faintestMagnitude: 5, presentation: "retained" }),
  Object.freeze({ id: "photographic", faintestMagnitude: Number.POSITIVE_INFINITY, presentation: "photographic" }),
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
  bands = CATALOGUE_STAR_BANDS,
  catalogue = null,
} = {}) {
  if (!(fovDegrees > 0)) {
    throw new TypeError("Catalogue star preparation arguments are invalid.");
  }
  const source = catalogue ?? await loadCatalogue(cataloguePath);
  const exposure = createExposure({ fovDegrees, screenFactor: 1 });
  const limits = exposureLimits(exposure);
  const limitingMagnitude = limits.limitingMagnitude;
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
      luminance: Number(presentation.luminance.toFixed(4)),
      haloAlpha: Number(presentation.haloAlpha.toFixed(3)),
      color: starColor(teff[index], colorIndex[index]),
    }));
  }
  stars.sort((a, b) => a.magnitude - b.magnitude);
  return Object.freeze({
    schema: PREPARED_CATALOGUE_STARS_SCHEMA,
    model: "stellarium-web-photometric-chain-at-fixed-field",
    source: source.meta,
    // The chain's inputs (the knobs a session may turn) and its limits.
    exposure: Object.freeze({
      fovDegrees: exposure.fovDegrees, screenFactor: exposure.screenFactor,
      adaptationLuminanceCdM2: exposure.adaptationLuminanceCdM2, exposureScale: exposure.exposureScale,
      intensityMax: exposure.intensityMax, maxRadiusPx: exposure.maxRadiusPx, haloPeak: exposure.haloPeak, linearScale: exposure.linearScale,
      hintsLimitMagnitude: Number(limits.hintsLimitMagnitude.toFixed(3)), pinMagnitude: Number(limits.pinMagnitude.toFixed(3)),
    }),
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

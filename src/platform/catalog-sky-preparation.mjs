// Prepares a catalogue sky from a `.gxct` star catalogue: selection by
// apparent magnitude, banding, every star's placement in the ICRF cube
// frame, its photometric radius, luminance and colour, and the named stars
// with their directions for captions. Runs in an object's prepare tools;
// the browser runtime only transports the result.
//
// Placement. The catalogue's `posPc` is ICRS cartesian (x toward the vernal
// equinox on the equator, z toward the north celestial pole) with the Sun
// at the origin; the direction alone places a star on the vault (the
// observer's offset from the Sun is a few au against parsecs: below one
// hundredth of a pixel for the nearest star). The cube frame is ICRF with
// cube-local x, y, z as ICRF x, y, z, exactly as the photographic sky is
// sampled (astrometric-sky-registration.mjs), so a direction d is placed by
// `rotateY(A) rotateX(B) translateZ(-R)` with
//   d = (-cos B sin A, sin B, -cos B cos A)   =>   B = asin(y), A = atan2(-x, -z)
// which faces the element toward the eye at the centre. The runtime writes
// R (the focal length over the screen factor) as a CSS variable, so a star's
// prepared radius in CSS pixels is its drawn radius at the view centre.

import { DEFAULT_LABEL_POLICY } from "./label-field.mjs";
import {
  CATALOG_SKY_COEXISTENCE_MODEL,
  CATALOG_SKY_CUBE_FRAME,
  CATALOG_SKY_LABEL_TYPOGRAPHY,
  CATALOG_SKY_MODEL,
  PREPARED_CATALOG_SKY_SCHEMA,
  STAR_HALO_PRESENTATION,
  STAR_ORDINARY_LABEL_LIMIT,
  validatePreparedCatalogSky,
} from "./catalog-sky-contract.mjs";
import {
  POINT_PHOTOMETRY,
  STAR_PRESENTATION,
  apparentMagnitudeFromAbsolute,
  createExposure,
  hintsLimitMagnitude,
  limitingMagnitude,
  pinMagnitude,
  starColorOf,
  starIntensity,
  starRadiusPx,
  rawRadiusPx,
} from "./point-photometry.mjs";

// Colour classes: effective-temperature bins, each drawn at the colour of
// its geometric-mean temperature. Twelve classes cover M dwarfs to O stars
// with steps the eye can order; the exact per-star colour is not preserved.
export const STAR_COLOR_CLASS_EDGES_K = Object.freeze([
  2500, 3300, 3700, 4300, 5000, 5600, 6200, 7000, 8000, 9500, 12000, 20000, 40000,
]);

// The label policy for star captions: the shared label policy's geometry
// (gap, spacing, box height, candidate capacity) with the cap height that
// lands the shell rail's 14 px font and the rail's opacity as the alpha
// ceiling. The retained pool is larger than the reference's one ordinary
// caption so the session knob can raise the budget without a remount.
export function starLabelPolicy(typography = CATALOG_SKY_LABEL_TYPOGRAPHY, overrides = {}) {
  const capPixels = Math.round(typography.fontSizePx * DEFAULT_LABEL_POLICY.capHeightEm * 1000) / 1000;
  return Object.freeze({
    ...DEFAULT_LABEL_POLICY,
    capPixels,
    poolSize: 12,
    maxAlpha: typography.opacity,
    ...overrides,
  });
}

export function prepareCatalogSky({
  catalog,
  provenance,
  projection,
  // Band edges in apparent magnitude, ascending; the last edge is the
  // faintest star prepared.
  bandEdges,
  labelMagnitudeLimit = null,
  labelPolicy = starLabelPolicy(),
  ordinaryLabelLimit = STAR_ORDINARY_LABEL_LIMIT,
  typography = CATALOG_SKY_LABEL_TYPOGRAPHY,
  halo = STAR_HALO_PRESENTATION,
  photographicCoexistence = null,
}) {
  if (!Array.isArray(bandEdges) || bandEdges.length < 1 ||
      bandEdges.some((edge, index) => !Number.isFinite(edge) || (index > 0 && !(edge > bandEdges[index - 1])))) {
    throw new TypeError("Band edges must be ascending finite magnitudes.");
  }
  if (!(projection?.horizontalFovDegrees > 0)) throw new TypeError("Projection needs a horizontal field of view.");
  const exposure = createExposure({ fovDegrees: projection.horizontalFovDegrees });
  const faintest = bandEdges[bandEdges.length - 1];
  const position = catalog.numeric("posPc");
  const absoluteMagnitude = catalog.numeric("absMag");
  const teff = catalog.numeric("teffK");
  const colorIndex = catalog.numeric("colorIndexBv");
  const hip = catalog.numeric("hip");
  const names = catalog.strings("name");
  const selected = [];
  for (let index = 0; index < catalog.count; index += 1) {
    const x = position[index * 3];
    const y = position[index * 3 + 1];
    const z = position[index * 3 + 2];
    const distance = Math.hypot(x, y, z);
    if (!(distance > 0) || !Number.isFinite(absoluteMagnitude[index])) continue;
    const magnitude = apparentMagnitudeFromAbsolute(absoluteMagnitude[index], distance);
    if (!(magnitude <= faintest)) continue;
    selected.push({ index, magnitude, direction: [x / distance, y / distance, z / distance] });
  }
  // Brightest first: bands are contiguous ranges, and captions insert
  // candidates in this order so a full pass drops the faintest.
  selected.sort((a, b) => a.magnitude - b.magnitude || a.index - b.index);
  const columns = {
    rotateYDegrees: [], rotateXDegrees: [], radiusPx: [], alpha: [], magnitude: [], colorClass: [], hip: [],
  };
  const named = [];
  const classCounts = new Array(STAR_COLOR_CLASS_EDGES_K.length - 1).fill(0);
  selected.forEach((star, row) => {
    const [x, y, z] = star.direction;
    columns.rotateYDegrees.push(round(Math.atan2(-x, -z) * 180 / Math.PI, 4));
    columns.rotateXDegrees.push(round(Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI, 4));
    columns.radiusPx.push(round(starRadiusPx(exposure, star.magnitude), 3));
    columns.alpha.push(round(starIntensity(exposure, star.magnitude), 3));
    columns.magnitude.push(round(star.magnitude, 3));
    const colorClass = colorClassOf(teff[star.index], colorIndex[star.index]);
    classCounts[colorClass] += 1;
    columns.colorClass.push(colorClass);
    columns.hip.push(hip[star.index]);
    const name = names[star.index];
    if (name !== "" && (labelMagnitudeLimit === null || star.magnitude <= labelMagnitudeLimit)) {
      named.push(Object.freeze({
        index: row,
        name,
        hip: hip[star.index],
        direction: Object.freeze(star.direction.map((value) => round(value, 6))),
      }));
    }
  });
  const bands = [];
  let start = 0;
  bandEdges.forEach((edge, bandIndex) => {
    let end = start;
    while (end < selected.length && selected[end].magnitude <= edge) end += 1;
    if (end === start) return;
    const faintestMagnitude = selected[end - 1].magnitude;
    bands.push(Object.freeze({
      index: bands.length,
      edgeMagnitude: edge,
      brightestMagnitude: round(selected[start].magnitude, 3),
      faintestMagnitude: round(faintestMagnitude, 3),
      start,
      end,
      count: end - start,
      // The screen factor at which the band's faintest star reaches the
      // skip radius (the radius scales linearly with the factor).
      minimumScreenFactor: round(POINT_PHOTOMETRY.skipRadiusPx / rawRadiusPx(exposure, faintestMagnitude), 4),
    }));
    start = end;
  });
  const hintsLimit = hintsLimitMagnitude(exposure);
  const plan = Object.freeze({
    schema: PREPARED_CATALOG_SKY_SCHEMA,
    model: CATALOG_SKY_MODEL,
    cubeFrame: CATALOG_SKY_CUBE_FRAME,
    source: Object.freeze({ ...provenance, totalRows: catalog.count, meta: Object.freeze({ ...catalog.meta }) }),
    projection: Object.freeze({
      horizontalFovDegrees: projection.horizontalFovDegrees,
      focalLengthOverViewportWidth: projection.focalLengthOverViewportWidth,
      cssPerspective: projection.cssPerspective,
    }),
    photometry: Object.freeze({
      ...POINT_PHOTOMETRY,
      exposure,
      limitingMagnitude: round(limitingMagnitude(exposure), 3),
      hintsLimitMagnitude: round(hintsLimit, 3),
      pinMagnitude: round(pinMagnitude(exposure), 3),
      star: STAR_PRESENTATION,
    }),
    presentation: Object.freeze({
      star: STAR_PRESENTATION,
      halo,
    }),
    placement: Object.freeze({
      model: "rotateY-rotateX-translateZ-facing-the-eye",
      rotateYDegrees: "atan2(-x, -z)",
      rotateXDegrees: "asin(y)",
      radius: "the focal length over the screen factor, written by the runtime as --planet-catalog-sky-radius",
    }),
    colorClasses: Object.freeze(STAR_COLOR_CLASS_EDGES_K.slice(0, -1).map((low, index) => {
      const high = STAR_COLOR_CLASS_EDGES_K[index + 1];
      const teffK = Math.round(Math.sqrt(low * high));
      const rgb = starColorOf(teffK, Number.NaN).map((value) => Math.round(value * 255));
      return Object.freeze({ index, minimumTeffK: low, maximumTeffK: high, teffK, rgb: Object.freeze(rgb), count: classCounts[index] });
    })),
    count: selected.length,
    bands: Object.freeze(bands),
    stars: Object.freeze(Object.fromEntries(Object.entries(columns).map(([name, values]) => [name, Object.freeze(values)]))),
    named: Object.freeze(named),
    labels: Object.freeze({
      typography,
      policy: labelPolicy,
      // The reference's ordinary-caption budget: how many named stars may
      // carry a caption at once, chosen by priority.
      ordinaryLimit: ordinaryLabelLimit,
      // Named stars fainter than this earn no caption: the derived hints
      // limit, or a stricter prepared choice.
      magnitudeLimit: round(labelMagnitudeLimit === null ? hintsLimit : Math.min(hintsLimit, labelMagnitudeLimit), 3),
      hintsLimitMagnitude: round(hintsLimit, 3),
      namedCount: named.length,
    }),
    coexistence: Object.freeze({
      model: CATALOG_SKY_COEXISTENCE_MODEL,
      pointFaintestMagnitude: round(selected.length ? selected[selected.length - 1].magnitude : Number.NaN, 3),
      pinMagnitude: round(pinMagnitude(exposure), 3),
      ...(photographicCoexistence ?? {}),
    }),
    runtimeGeometryDerivation: false,
  });
  return validatePreparedCatalogSky(plan);
}

export function colorClassOf(teffK, colorIndexBv) {
  const temperature = Number.isFinite(teffK)
    ? teffK
    : Number.isFinite(colorIndexBv) ? bvTemperature(colorIndexBv) : 6500;
  const edges = STAR_COLOR_CLASS_EDGES_K;
  for (let index = 1; index < edges.length - 1; index += 1) {
    if (temperature < edges[index]) return index - 1;
  }
  return edges.length - 2;
}

function bvTemperature(bv) {
  const clamped = Math.min(4, Math.max(-0.4, bv));
  return 4600 * (1 / (0.92 * clamped + 1.7) + 1 / (0.92 * clamped + 0.62));
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

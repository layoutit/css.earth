// The prepared catalogue sky: real catalogue stars as retained point sources
// in the same ICRF cube frame the photographic sky is sampled in, banded by
// apparent magnitude at preparation. Shared by the preparation
// (catalog-sky-preparation.mjs) and the runtime (catalog-sky-runtime.mjs);
// the runtime only transports what is prepared here.

export const PREPARED_CATALOG_SKY_SCHEMA = "cssearth-prepared-catalog-sky@1";
export const CATALOG_SKY_MODEL =
  "prepared-catalogue-point-sources-in-icrf-cube-frame-over-photographic-diffuse-sky";
export const CATALOG_SKY_CUBE_FRAME = "icrf-j2000-as-cube-local-axes";

// How the points and the astrometric photograph share the vault: the
// photograph keeps the diffuse Milky Way and every star below the point
// population's faintest band; the points draw the population whose
// photometric radius sits above the pin, where the attenuated photographic
// detail (the standard faces carry it at a fraction of the diffuse gain)
// cannot carry the magnitude hierarchy. Both ride one skybox matrix, so
// they cannot drift apart; the residual double image of a bright star is
// bounded by the photograph's own anchor registration.
export const CATALOG_SKY_COEXISTENCE_MODEL =
  "points-above-the-pin-over-photographic-diffuse-and-sub-pixel-detail";

// Star caption typography follows the shell's navigation rail (its
// `.scale-label`): the shell's UI font stack and secondary text colour as
// tokens, its measured 14 px size and 400 weight, and its 0.72 opacity as
// the alpha ceiling. Widths are measured per cap height from the retained
// DOM once at mount (galaxio's `labelWidthPerCapHeight`), so they follow
// the platform's resolved system font exactly as the shell's rail does.
// The reference's ordinary-caption budget (galaxio `starPresentation.ts`,
// ORDINARY_STAR_LABEL_LIMIT): at most one ordinary star is named at a
// time, chosen by the pass's priority order; the sky is deliberately not
// full of names. A session knob raises it, bounded by the retained pool.
export const STAR_ORDINARY_LABEL_LIMIT = 1;

// How a star's compact bloom is drawn without gradients: a soft shadow of
// the star's own colour reaching the reference's halo extent (2.5 radii:
// the disc, a quarter radius of spread and a blur of one and a quarter
// radii) whose colour alpha lands the reference's halo peak (0.08) at the
// disc's edge, where a blur of that width sits near half its colour.
export const STAR_HALO_PRESENTATION = Object.freeze({
  model: "box-shadow-bloom",
  haloRadii: 2.5,
  blurRadii: 1.25,
  spreadRadii: 0.25,
  alpha: 0.16,
  referencePeak: 0.08,
});

export const CATALOG_SKY_LABEL_TYPOGRAPHY = Object.freeze({
  model: "shell-navigation-rail-scale-label",
  fontFamilyToken: "--shell-ui-font",
  colorToken: "--shell-text-secondary",
  fontSizePx: 14,
  fontWeight: 400,
  lineHeight: 1.3,
  opacity: 0.72,
});

export function validatePreparedCatalogSky(plan) {
  if (plan?.schema !== PREPARED_CATALOG_SKY_SCHEMA || plan.model !== CATALOG_SKY_MODEL ||
      plan.cubeFrame !== CATALOG_SKY_CUBE_FRAME ||
      typeof plan.source?.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(plan.source.sha256) ||
      !(plan.projection?.horizontalFovDegrees > 0) ||
      !(plan.count > 0) || !Number.isSafeInteger(plan.count) ||
      !Array.isArray(plan.bands) || plan.bands.length === 0 ||
      !validColumns(plan.stars, plan.count) ||
      !Array.isArray(plan.named) || plan.named.some((entry) => !validNamed(entry, plan.count)) ||
      !Array.isArray(plan.colorClasses) || plan.colorClasses.length === 0 ||
      plan.colorClasses.some((entry) => !Array.isArray(entry.rgb) || entry.rgb.length !== 3 ||
        entry.rgb.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) ||
      !validLabels(plan.labels) ||
      plan.presentation?.halo?.model !== STAR_HALO_PRESENTATION.model ||
      !(plan.presentation.halo.blurRadii >= 0) || !(plan.presentation.halo.spreadRadii >= 0) ||
      !(plan.presentation.halo.alpha > 0) || plan.presentation.halo.alpha > 1 ||
      plan.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared catalogue sky is incompatible.");
  }
  let expectedStart = 0;
  let previousFaintest = Number.NEGATIVE_INFINITY;
  for (const band of plan.bands) {
    if (band.start !== expectedStart || !(band.end > band.start) || band.end > plan.count ||
        !(band.faintestMagnitude > previousFaintest) || !(band.edgeMagnitude >= band.faintestMagnitude) ||
        !(band.minimumScreenFactor > 0)) {
      throw new TypeError("Prepared catalogue sky bands are incompatible.");
    }
    expectedStart = band.end;
    previousFaintest = band.faintestMagnitude;
  }
  if (expectedStart !== plan.count) throw new TypeError("Prepared catalogue sky bands do not cover the stars.");
  return plan;
}

// The bands a runtime shows: every band whose faintest star still draws
// above the skip radius at the given screen factor, up to the band whose
// edge is the magnitude limit (the plan's faintest band by default; a
// session knob: "stars to magnitude 4" shows the bands with edges <= 4).
export function visibleBandCount(plan, { screenFactor, magnitudeLimit = Number.POSITIVE_INFINITY }) {
  let count = 0;
  for (const band of plan.bands) {
    if (band.minimumScreenFactor > screenFactor || band.edgeMagnitude > magnitudeLimit) break;
    count += 1;
  }
  return count;
}

function validColumns(stars, count) {
  const numeric = ["rotateYDegrees", "rotateXDegrees", "radiusPx", "alpha", "magnitude", "colorClass", "hip"];
  return numeric.every((name) => Array.isArray(stars?.[name]) && stars[name].length === count &&
    stars[name].every(Number.isFinite));
}

function validNamed(entry, count) {
  return Number.isSafeInteger(entry?.index) && entry.index >= 0 && entry.index < count &&
    typeof entry.name === "string" && entry.name.length > 0 &&
    Array.isArray(entry.direction) && entry.direction.length === 3 &&
    Math.abs(Math.hypot(...entry.direction) - 1) < 1e-3;
}

function validLabels(labels) {
  return labels?.typography?.model === CATALOG_SKY_LABEL_TYPOGRAPHY.model &&
    Number.isFinite(labels.magnitudeLimit) && labels.policy?.capPixels > 0 &&
    Number.isSafeInteger(labels.policy.poolSize) && labels.policy.poolSize > 0 &&
    Number.isSafeInteger(labels.ordinaryLimit) && labels.ordinaryLimit >= 1 &&
    labels.ordinaryLimit <= labels.policy.poolSize;
}

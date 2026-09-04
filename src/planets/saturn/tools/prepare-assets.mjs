import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { textureTintFactors } from "@layoutit/polycss";
import sharp from "sharp";
import {
  cropTransparentRgba,
  responsiveTransparentCrop,
} from "./prepare-rgba.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";

await validateSaturnSourceGroup("assets");

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source");
const publicRoot = resolve(objectRoot, "../../../public/scenes/saturn");
const sourceModulePath = resolve(objectRoot, "runtime/preparedRingPoints.mjs");
const colorPath = resolve(sourceRoot, "color_original_single.png");
const transparencyPath = resolve(sourceRoot, "trans_original_single.png");
const starfieldSourcePath = resolve(sourceRoot, "stars/hyg-v41-field.json");
const outputTexturePath = resolve(publicRoot, "saturn-rings.webp");
const outputTexture2xPath = resolve(publicRoot, "saturn-rings@2x.webp");
const outputShadowTexturePath = resolve(publicRoot, "saturn-ring-shadow.webp");
const outputStarfieldPath = resolve(publicRoot, "saturn-starfield.webp");
const MAIN_RING_MOTION_TEXTURE_SIZE = 1024;
const MAIN_RING_RASTERIZED_BANDS = Object.freeze(["c", "b-inner", "b-outer", "a"]);
const MAIN_RING_MOTION_TRANSPARENT_GUTTER = 1;
const G_RING_EXPANSION_GROUP_INDEX = 1;
const JANUS_EPIMETHEUS_EXPANSION_GROUP_INDEX = 2;

const RING_TEXTURE_SIZE = 2048;
const RING_TEXTURE_2X_SIZE = RING_TEXTURE_SIZE * 2;
const DPR1_RING_FEATURE_FLOOR = 4;
const DPR2_RING_FEATURE_FLOOR = 6;
const F_RING_ADDITIONAL_PHYSICAL_PIXELS = 2;
const BRIGHT_HAIRLINE_ALPHA_GAIN = 1.8;
const RING_SHADOW_TEXTURE_SIZE = 1024;
const RING_SHADOW_TRANSPARENT_GUTTER = 4;
const STARFIELD_WIDTH = 2560;
const STARFIELD_HEIGHT = 1440;
const STARFIELD_POINT_COUNT = 1100;
const STARFIELD_OPACITY = 0.5;
const BAKED_MAIN_ACCENT_COUNT = 0;
const MAIN_RING_MOTION_POINT_COUNT = 200;
const G_RING_POINT_COUNT = 400;
const JANUS_EPIMETHEUS_RING_POINT_COUNT = 60;
const E_RING_POINT_COUNT = 240;
const OUTER_DUST_POINT_COUNT = G_RING_POINT_COUNT +
  JANUS_EPIMETHEUS_RING_POINT_COUNT + E_RING_POINT_COUNT;
const POINT_COUNT = MAIN_RING_MOTION_POINT_COUNT;
const G_RING_BAND_POINT_COUNT = 336;
const G_RING_INNER_SHOULDER_POINT_COUNT = 24;
const G_RING_OUTER_SHOULDER_POINT_COUNT = 40;
const G_RING_PURPLE_POINT_COUNT = 40;
const G_RING_DUST_NEUTRAL = Object.freeze([232, 230, 226]);
const G_RING_DUST_PURPLES = Object.freeze([
  Object.freeze([220, 211, 237]),
  Object.freeze([211, 207, 233]),
]);
const E_RING_DUST_COLOR = Object.freeze([220, 232, 255]);
const SATURN_SOLAR_ALBEDO_MULTIPLIER = "#fff1ea";
const SATURN_SOLAR_COLOR_MODEL =
  "Planck-5772K-CIE1931-linear-sRGB-D65-max-normalized";
const ringSolarTint = textureTintFactors(
  Math.PI,
  SATURN_SOLAR_ALBEDO_MULTIPLIER,
  SATURN_SOLAR_ALBEDO_MULTIPLIER,
  0.05 * Math.PI,
);
const ringSolarMaximum = Math.max(
  ringSolarTint.r,
  ringSolarTint.g,
  ringSolarTint.b,
);
const RING_SOLAR_CHANNEL_FACTORS = Object.freeze([
  ringSolarTint.r / ringSolarMaximum,
  ringSolarTint.g / ringSolarMaximum,
  ringSolarTint.b / ringSolarMaximum,
]);
const RING_SOLAR_WHITE = Object.freeze(
  RING_SOLAR_CHANNEL_FACTORS.map((factor) => applyLinearTint(255, factor)),
);
const SATURN_GM_KM3_PER_S2 = 37_931_206.23;
const SATURN_REFERENCE_ROTATION_SECONDS = 10 * 3600 + 33 * 60 + 38;
const PRESENTATION_REFERENCE_ROTATION_SECONDS = 72;
const PRESENTATION_TIME_SCALE = SATURN_REFERENCE_ROTATION_SECONDS /
  PRESENTATION_REFERENCE_ROTATION_SECONDS;
const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_POLAR_RADIUS_KM = 54_364;
const DISPLAY_EQUATORIAL_RADIUS = 230;
const D_RING_INNER_KM = 66_900;
const OPENSPACE_TEXTURE_INNER_KM = 74_500;
const C_RING_OUTER_KM = 91_975;
const CASSINI_DIVISION_INNER_KM = 117_500;
const CASSINI_DIVISION_OUTER_KM = 122_050;
const ENCKE_GAP_INNER_KM = 133_423;
const ENCKE_GAP_OUTER_KM = 133_745;
const KEELER_GAP_INNER_KM = 136_487;
const KEELER_GAP_OUTER_KM = 136_522;
const A_RING_OUTER_KM = 136_770;
const ROCHE_DIVISION_OUTER_KM = 139_380;
const F_RING_INNER_KM = 139_826;
const F_RING_CORE_KM = 140_224;
const F_RING_OUTER_KM = 140_612;
const D_RING_RINGLET_RADII_KM = [67_580, 71_710];
const D_RING_RINGLET_PRESENTATION_SIGMA_KM = 105;
const D_RING_PRESENTATION_BASE_ALPHA = 0.025;
const D_RING_RINGLET_PRESENTATION_PEAK_ALPHA = 0.22;
const NAMED_RING_READABILITY_FEATURES = Object.freeze([
  ...D_RING_RINGLET_RADII_KM.map((radiusKm, index) => Object.freeze({
    id: `d-ring-ringlet-${index + 1}`,
    kind: "bright-hairline",
    radiusKm,
  })),
  Object.freeze({
    id: "encke-gap",
    kind: "dark-gap",
    radiusKm: (ENCKE_GAP_INNER_KM + ENCKE_GAP_OUTER_KM) / 2,
  }),
  Object.freeze({
    id: "keeler-gap",
    kind: "dark-gap",
    radiusKm: (KEELER_GAP_INNER_KM + KEELER_GAP_OUTER_KM) / 2,
  }),
  Object.freeze({
    id: "f-ring-core",
    kind: "bright-hairline",
    radiusKm: F_RING_CORE_KM,
  }),
]);
const SOURCE_PROFILE_READABILITY_FEATURES = Object.freeze([
  ["bright-hairline", 76_220],
  ["bright-hairline", 77_852],
  ["bright-hairline", 79_219],
  ["bright-hairline", 84_909],
  ["bright-hairline", 85_702],
  ["bright-hairline", 85_967],
  ["bright-hairline", 86_408],
  ["bright-hairline", 87_334],
  ["bright-hairline", 87_555],
  ["bright-hairline", 88_746],
  ["bright-hairline", 89_275],
  ["bright-hairline", 89_936],
  ["bright-hairline", 90_201],
  ["bright-hairline", 90_598],
  ["dark-gap", 117_678],
  ["bright-hairline", 117_943],
  ["bright-hairline", 120_236],
  ["dark-gap", 120_545],
  ["bright-hairline", 120_942],
  ["dark-gap", 123_411],
  ["bright-hairline", 130_997],
  ["bright-hairline", 132_012],
  ["bright-hairline", 132_585],
  ["bright-hairline", 134_526],
].map(([kind, radiusKm]) => Object.freeze({
  id: `source-${kind}-${radiusKm}`,
  kind,
  radiusKm,
  alphaGain: kind === "bright-hairline" ? 1.35 : undefined,
  alphaScale: kind === "bright-hairline" ? 0.5 : undefined,
})));
const RING_READABILITY_FEATURES = Object.freeze([
  ...NAMED_RING_READABILITY_FEATURES,
  ...SOURCE_PROFILE_READABILITY_FEATURES,
]);
const C_RING_PRESENTATION_ALPHA_GAIN = 2.25;
const MAIN_RING_INVERTED_LUMINANCE_THRESHOLD = 0.5;
const MAIN_RING_MAX_TRACER_INTENSITY = 0.72;
const MAIN_RING_POINT_SOURCE_OPACITY_RANGE = Object.freeze([0.48, 0.76]);
const MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE = Object.freeze([0.82, 1]);
const MAIN_RING_MOTION_FORMATIONS = Object.freeze({
  c: Object.freeze({
    kind: "wake-arcs",
    share: 0.4,
    centersRadians: Object.freeze([0.82, 3.94]),
    spreadRadians: 0.2,
    radialShearRadians: 0.18,
  }),
  "b-inner": Object.freeze({
    kind: "b-ring-spokes",
    share: 0.62,
    centersRadians: Object.freeze([0.82, 3.94]),
    spreadRadians: 0.045,
    radialShearRadians: 0,
  }),
  "b-outer": Object.freeze({
    kind: "b-ring-spokes",
    share: 0.62,
    centersRadians: Object.freeze([0.82, 3.94]),
    spreadRadians: 0.045,
    radialShearRadians: 0,
  }),
  a: Object.freeze({
    kind: "wake-arcs",
    share: 0.4,
    centersRadians: Object.freeze([1.38, 4.5]),
    spreadRadians: 0.2,
    radialShearRadians: -0.18,
  }),
  f: Object.freeze({
    kind: "uniform",
    share: 0,
    centersRadians: Object.freeze([]),
    spreadRadians: 0,
    radialShearRadians: 0,
  }),
});
const MAIN_RING_MOTION_BANDS = Object.freeze([
  Object.freeze({ id: "c", count: 30, boundsKm: [74_500, 91_975] }),
  Object.freeze({ id: "b-inner", count: 50, boundsKm: [91_975, 104_750] }),
  Object.freeze({ id: "b-outer", count: 55, boundsKm: [104_750, 117_500] }),
  Object.freeze({ id: "a", count: 55, boundsKm: [122_050, 136_770] }),
  Object.freeze({ id: "f", count: 10, boundsKm: [139_826, 140_612] }),
]);
const G_RING_INNER_KM = 166_000;
const G_RING_OUTER_KM = 173_200;
const G_RING_INNER_SHOULDER_MIN_KM = 158_000;
const G_RING_OUTER_SHOULDER_MAX_KM = 179_500;
const JANUS_EPIMETHEUS_RING_INNER_KM = 149_000;
const JANUS_EPIMETHEUS_RING_OUTER_KM = 154_000;
const E_RING_INNER_KM = 180_000;
const E_RING_OUTER_KM = 480_000;
const ENCELADUS_ORBIT_KM = 238_037;
const E_RING_MOTION_BANDS = Object.freeze([
  Object.freeze({
    id: "inner-wing",
    count: 48,
    boundsKm: [180_000, 220_000],
    verticalExtentKm: 10_000,
    distribution: "uniform",
  }),
  Object.freeze({
    id: "enceladus-core",
    count: 144,
    boundsKm: [220_000, 260_000],
    verticalExtentKm: 4_000,
    distribution: "triangular",
  }),
  Object.freeze({
    id: "outer-wing",
    count: 48,
    boundsKm: [260_000, 480_000],
    verticalExtentKm: 30_000,
    distribution: "inner-biased-cubic",
  }),
]);
const OUTER_VISUAL_ORBIT_SECONDS = visualOrbitSeconds(F_RING_OUTER_KM);
const STATIC_WORLD_LIGHT_DIRECTION = Object.freeze([
  0.883835,
  -0.385595,
  0.264864,
]);
const SATURN_OBLIQUITY_DEGREES = 26.73;
const STATIC_SYSTEM_TILT_AXIS = "source-x";
const STATIC_SYSTEM_NODE_DEGREES = -60;
const STATIC_MESH_ROTATION_DEGREES = 128;
const STATIC_OBJECT_LIGHT_DIRECTION = Object.freeze(rotateVectorZ(
  rotateVectorX(
    rotateVectorZ(
      normalizeVector(STATIC_WORLD_LIGHT_DIRECTION),
      -STATIC_SYSTEM_NODE_DEGREES * Math.PI / 180,
    ),
    -SATURN_OBLIQUITY_DEGREES * Math.PI / 180,
  ),
  -STATIC_MESH_ROTATION_DEGREES * Math.PI / 180,
));
const SATURN_SHADOW_RING_DIRECT_TRANSMISSION = 0.16;
const SATURN_SHADOW_DENSE_ALPHA_START = 16 / 255;
const SATURN_SHADOW_DENSE_ALPHA_END = 96 / 255;
const SATURN_SHADOW_EDGE_FEATHER_SIGMA = 6;
const SATURN_SHADOW_RING_SUPPORT_ALPHA = 32;

const colorSource = await readRgbRow(colorPath);
const transparencySource = await readRgbRow(transparencyPath);
const starfieldSource = JSON.parse(await readFile(starfieldSourcePath, "utf8"));
validateStarfieldSource(starfieldSource);
if (colorSource.width !== transparencySource.width) {
  throw new Error("Saturn ring source rows have different widths");
}
if (MAIN_RING_MOTION_BANDS.reduce((total, band) => total + band.count, 0) !==
    MAIN_RING_MOTION_POINT_COUNT) {
  throw new Error("Saturn main-ring motion point budget is inconsistent.");
}
if (E_RING_MOTION_BANDS.reduce((total, band) => total + band.count, 0) !==
    E_RING_POINT_COUNT) {
  throw new Error("Saturn E-ring point budget is inconsistent.");
}

const dpr1RingReadability = preparePhysicalRingReadability({
  features: RING_READABILITY_FEATURES,
  textureSize: RING_TEXTURE_SIZE,
  minimumPhysicalPixels: DPR1_RING_FEATURE_FLOOR,
});
const dpr2RingReadability = preparePhysicalRingReadability({
  features: RING_READABILITY_FEATURES,
  textureSize: RING_TEXTURE_2X_SIZE,
  minimumPhysicalPixels: DPR2_RING_FEATURE_FLOOR,
});
const rgba = renderResponsiveRingTexture({
  textureSize: RING_TEXTURE_SIZE,
  readabilitySamples: dpr1RingReadability.samplesByPhysicalPixel,
});
const rgba2x = renderResponsiveRingTexture({
  textureSize: RING_TEXTURE_2X_SIZE,
  readabilitySamples: dpr2RingReadability.samplesByPhysicalPixel,
});

const mainRingMotionGroups = MAIN_RING_MOTION_BANDS.map(
  (band, bandIndex) => prepareMainRingMotionGroup(band, bandIndex),
);
const mainRingMotionPlates = mainRingMotionGroups
  .filter((group) => MAIN_RING_RASTERIZED_BANDS.includes(
    group.population.replace("main-ring-", ""),
  ))
  .map(prepareMainRingMotionPlate);
// The 10 prepared F-ring accents were imperceptible at presentation scale.
// Do not exchange them for another large transparent motion plate.
const retainedMainRingMotionGroups = [];
// The detached G-ring and Janus-Epimetheus dust populations are source
// candidates only. The published scene keeps the four motion plates embedded
// in Saturn's main C, B, and A rings.
const gRingDustPlates = [];
const janusEpimetheusRingPlates = [];
const saturnShadowOnRings = createSaturnShadowOverlay(RING_SHADOW_TEXTURE_SIZE);
const featheredSaturnShadowRgba = await featherSaturnShadowOverlay({
  shadowRgba: saturnShadowOnRings.rgba,
  shadowTextureSize: RING_SHADOW_TEXTURE_SIZE,
  ringRgba: rgba,
  ringTextureSize: RING_TEXTURE_SIZE,
});
const croppedSaturnShadow = cropTransparentRgba({
  rgba: featheredSaturnShadowRgba,
  width: RING_SHADOW_TEXTURE_SIZE,
  height: RING_SHADOW_TEXTURE_SIZE,
  gutter: RING_SHADOW_TRANSPARENT_GUTTER,
});
const starfield = createStarfield(starfieldSource);
await Promise.all([
  sharp(rgba, {
    raw: { width: RING_TEXTURE_SIZE, height: RING_TEXTURE_SIZE, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputTexturePath),
  sharp(rgba2x, {
    raw: { width: RING_TEXTURE_2X_SIZE, height: RING_TEXTURE_2X_SIZE, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputTexture2xPath),
  sharp(croppedSaturnShadow.rgba, {
    raw: {
      width: croppedSaturnShadow.bounds.width,
      height: croppedSaturnShadow.bounds.height,
      channels: 4,
    },
  }).webp({ lossless: true, effort: 6 }).toFile(outputShadowTexturePath),
  sharp(starfield, {
    raw: { width: STARFIELD_WIDTH, height: STARFIELD_HEIGHT, channels: 3 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputStarfieldPath),
  ...mainRingMotionPlates.flatMap((plate) => [
    writePreparedRgbaWebp(
      plate.rgba,
      plate.textureWidth,
      plate.outputPath,
      plate.textureHeight,
    ),
    writePreparedRgbaWebp(
      plate.rgba2x,
      plate.texture2xWidth,
      plate.output2xPath,
      plate.texture2xHeight,
    ),
  ]),
  ...gRingDustPlates.flatMap((plate) => [
    writePreparedRgbaWebp(
      plate.rgba,
      plate.textureSize,
      plate.outputPath,
    ),
    writePreparedRgbaWebp(
      plate.rgba2x,
      plate.texture2xSize,
      plate.output2xPath,
    ),
  ]),
  ...janusEpimetheusRingPlates.flatMap((plate) => [
    writePreparedRgbaWebp(
      plate.rgba,
      plate.textureSize,
      plate.outputPath,
    ),
    writePreparedRgbaWebp(
      plate.rgba2x,
      plate.texture2xSize,
      plate.output2xPath,
    ),
  ]),
]);
const eRingDustGroups = E_RING_MOTION_BANDS.map(prepareERingDustGroup);
const orbitGroups = [
  ...retainedMainRingMotionGroups,
  ...eRingDustGroups,
];
// The broad E-ring points were not legible enough to justify retained DOM.
// All published dust now uses prepared plates; source candidates stay recorded.
const retainedOrbitGroups = [];

const sourceHashes = {
  color: await sha256(colorPath),
  transparency: await sha256(transparencyPath),
  starfield: await sha256(starfieldSourcePath),
};
const moduleSource = `// Generated by tools/prepare-assets.mjs.\n` +
  `export const PREPARED_RING_SOURCE = Object.freeze(${JSON.stringify({
    pointCount: POINT_COUNT,
    mainPointCount: MAIN_RING_MOTION_POINT_COUNT,
    mainPointLeafCount: retainedMainRingMotionGroups.reduce(
      (total, group) => total + group.points.length,
      0,
    ),
    mainMotionPlateCount: mainRingMotionPlates.length,
    omittedImperceptibleMainPointCount: mainRingMotionGroups.reduce(
      (total, group) => total + group.points.length,
      0,
    ) - mainRingMotionPlates.reduce(
      (total, plate) => total + plate.metadata.pointCount,
      0,
    ),
    gRingMotionPlateCount: gRingDustPlates.length,
    gRingBaseMotionPlateCount: 0,
    gRingExpansionMotionPlateCount: 0,
    janusEpimetheusMotionPlateCount: janusEpimetheusRingPlates.length,
    janusEpimetheusBaseMotionPlateCount: 0,
    janusEpimetheusExpansionMotionPlateCount: 0,
    bakedMainAccentCount: BAKED_MAIN_ACCENT_COUNT,
    outerDustPointCount: 0,
    outerDustSourceCandidatePointCount: OUTER_DUST_POINT_COUNT,
    orbitGroupCount: orbitGroups.length,
    mainOrbitGroupCount: mainRingMotionGroups.length,
    outerVisualOrbitSeconds: OUTER_VISUAL_ORBIT_SECONDS,
    planeVisualOrbitSeconds: OUTER_VISUAL_ORBIT_SECONDS,
    saturnGmKm3PerS2: SATURN_GM_KM3_PER_S2,
    referenceRotationRealSeconds: SATURN_REFERENCE_ROTATION_SECONDS,
    referenceRotationVisualSeconds: PRESENTATION_REFERENCE_ROTATION_SECONDS,
    presentationTimeScale: Number(PRESENTATION_TIME_SCALE.toFixed(6)),
    mainRingMotion: {
      model: "prepared-source-density-samples-with-banded-keplerian-orbits",
      pointCount: MAIN_RING_MOTION_POINT_COUNT,
      orbitGroupCount: mainRingMotionGroups.length,
      angularDistribution:
        "deterministic-uniform-field-with-two-b-ring-spokes-and-c-a-wake-arcs",
      sourceDensitySampling: "prepared-ring-alpha-rejection",
      maximumTracerCompositeIntensity: MAIN_RING_MAX_TRACER_INTENSITY,
      placementQualification:
        "prepared-contrast-aware-radial-selection-avoids-brightest-ring-texels",
      pointColorModel:
        "pearl-white-on-dark-ringlets-source-rgb-inversion-on-bright-ringlets",
      invertedLuminanceThreshold: MAIN_RING_INVERTED_LUMINANCE_THRESHOLD,
      invertedPointOpacity: 0.5,
      qualification:
        "motion-readability-presentation-not-resolved-physical-clump-density",
      bands: mainRingMotionGroups.map((group) => ({
        id: group.population.replace("main-ring-", ""),
        pointCount: group.points.length,
        sourceBoundsKm: group.sourceBoundsKm,
        representativeRadiusKm: group.representativeRadiusKm,
        durationSeconds: group.durationSeconds,
        formation: group.formation,
      })),
      runtimePhysics: false,
      runtimeJavaScriptWritesPerFrame: 0,
    },
    outerDust: {
      properDustOnly: true,
      properDustPointCount: 0,
      preparedRasterPointCount: 0,
      preparedRasterMaximumPointCount: 0,
      preparedRasterPlateCount: 0,
      sourceCandidatePointCount:
        G_RING_POINT_COUNT + JANUS_EPIMETHEUS_RING_POINT_COUNT,
      presentation: "omitted-detached-from-main-ring-system",
      gRingBoundsKm: [G_RING_INNER_KM, G_RING_OUTER_KM],
      gRingPointCount: G_RING_BAND_POINT_COUNT,
      adjacentShoulderPointCount:
        G_RING_INNER_SHOULDER_POINT_COUNT + G_RING_OUTER_SHOULDER_POINT_COUNT,
      radialDistribution: {
        model: "pds-g-ring-band-with-sparse-adjacent-ring-plane-shoulders",
        bandPointCount: G_RING_BAND_POINT_COUNT,
        innerShoulder: {
          pointCount: G_RING_INNER_SHOULDER_POINT_COUNT,
          boundsKm: [G_RING_INNER_SHOULDER_MIN_KM, G_RING_INNER_KM],
        },
        outerShoulder: {
          pointCount: G_RING_OUTER_SHOULDER_POINT_COUNT,
          boundsKm: [G_RING_OUTER_KM, G_RING_OUTER_SHOULDER_MAX_KM],
        },
        shoulderFalloffExponent: 2,
        minimumShoulderFraction: 0.005,
        selection: "independent-deterministic-index-permutation",
        exactShoulderBounds: false,
        presentationNote:
          "Sparse boundary softening within the adjacent gaps; PDS bounds remain the G-ring authority.",
        spreadAuthority:
          "https://science.nasa.gov/missions/cassini/cassini-finds-possible-origin-of-one-of-saturns-rings/",
      },
      colorVariance: {
        model: "prepared-neutral-dust-with-lavender-tail",
        neutralBaseColor: rgbHex(...G_RING_DUST_NEUTRAL),
        purpleBaseColors: G_RING_DUST_PURPLES.map((color) => rgbHex(...color)),
        purplePointCount: G_RING_PURPLE_POINT_COUNT,
        purpleShare: G_RING_PURPLE_POINT_COUNT / G_RING_POINT_COUNT,
        selection: "independent-deterministic-index-permutation",
      },
      authority: "https://pds-rings.seti.org/saturn/saturn_rings_table.html",
    },
    janusEpimetheusRing: {
      pointCount: 0,
      preparedRasterPointCount: 0,
      preparedRasterMaximumPointCount: 0,
      preparedRasterPlateCount: 0,
      sourceCandidatePointCount: JANUS_EPIMETHEUS_RING_POINT_COUNT,
      presentation: "omitted-detached-from-main-ring-system",
      sourceBoundsKm: [
        JANUS_EPIMETHEUS_RING_INNER_KM,
        JANUS_EPIMETHEUS_RING_OUTER_KM,
      ],
      opticalDepth: "1e-7",
      authority: "https://pds-rings.seti.org/saturn/saturn_rings_table.html",
      runtimePhysics: false,
      runtimeJavaScriptWritesPerFrame: 0,
    },
    eRing: {
      pointCount: E_RING_POINT_COUNT,
      publishedPointCount: 0,
      presentation: "omitted-after-visual-cost-review",
      sourceBoundsKm: [E_RING_INNER_KM, E_RING_OUTER_KM],
      peakRadiusKm: ENCELADUS_ORBIT_KM,
      opticalDepth: "5e-6",
      colorModel: "prepared-pearl-blue-icy-dust",
      bands: eRingDustGroups.map((group) => ({
        id: group.population.replace("e-ring-", ""),
        pointCount: group.points.length,
        sourceBoundsKm: group.sourceBoundsKm,
        representativeRadiusKm: group.representativeRadiusKm,
        durationSeconds: group.durationSeconds,
        verticalExtentKm: group.verticalExtentKm,
      })),
      authority: "https://pds-rings.seti.org/saturn/saturn_rings_table.html",
      peakAuthority: "https://science.nasa.gov/asset/hubble/saturns-e-ring-in-ultraviolet-light/",
      runtimePhysics: false,
      runtimeJavaScriptWritesPerFrame: 0,
    },
    textureSize: RING_TEXTURE_SIZE,
    texture2xSize: RING_TEXTURE_2X_SIZE,
    shadowTextureSourceSize: RING_SHADOW_TEXTURE_SIZE,
    shadowTextureBounds: croppedSaturnShadow.bounds,
    shadowTextureTransparentGutter: RING_SHADOW_TRANSPARENT_GUTTER,
    radialProfile: {
      model: "openspace-opacity-profile-with-pds-boundary-constraints",
      solarColor: SATURN_SOLAR_ALBEDO_MULTIPLIER,
      solarColorModel: SATURN_SOLAR_COLOR_MODEL,
      solarTintPreparation: "linear-light-static-albedo-multiplication",
      sourceSampleCount: colorSource.width,
      sourceBoundsKm: [OPENSPACE_TEXTURE_INNER_KM, F_RING_OUTER_KM],
      outputKmPerRadialPixel: Number(
        (F_RING_OUTER_KM / ((RING_TEXTURE_SIZE - 1) / 2)).toFixed(6)),
      authority: "https://pds-rings.seti.org/saturn/saturn_rings_table.html",
      dRingPresentation: {
        sourceBoundsKm: [D_RING_INNER_KM, OPENSPACE_TEXTURE_INNER_KM],
        sourceRingletRadiiKm: D_RING_RINGLET_RADII_KM,
        sourceOpticalDepthRange: [0.00001, 0.001],
        ringletSigmaKm: D_RING_RINGLET_PRESENTATION_SIGMA_KM,
        baseAlpha: D_RING_PRESENTATION_BASE_ALPHA,
        ringletPeakAlpha: D_RING_RINGLET_PRESENTATION_PEAK_ALPHA,
        qualification: "prepared-opacity-emphasis-preserves-source-ringlet-width",
      },
      cRingPresentation: {
        sourceBoundsKm: [OPENSPACE_TEXTURE_INNER_KM, C_RING_OUTER_KM],
        alphaGain: C_RING_PRESENTATION_ALPHA_GAIN,
        model: "source-alpha-complement-exponential-gain",
        qualification: "prepared-opacity-emphasis-preserves-radial-feature-widths",
      },
      responsiveReadability: {
        model: "prepared-source-feature-specific-width-and-alpha-contrast",
        selection: "css-image-set-density",
        featureIds: RING_READABILITY_FEATURES.map(({ id }) => id),
        sourceProfileFeatureCount: SOURCE_PROFILE_READABILITY_FEATURES.length,
        sourceProfileSelection:
          "prepared-prominence-width-curation-excludes-dense-b-ring",
        sourceProfileBrightAlphaScale: 0.5,
        dpr1: {
          assetUrl: "/scenes/saturn/saturn-rings.webp",
          textureSize: RING_TEXTURE_SIZE,
          minimumSalientFeaturePhysicalPixels: DPR1_RING_FEATURE_FLOOR,
          fRingCorePhysicalPixels:
            DPR1_RING_FEATURE_FLOOR + F_RING_ADDITIONAL_PHYSICAL_PIXELS,
        },
        dpr2: {
          assetUrl: "/scenes/saturn/saturn-rings@2x.webp",
          textureSize: RING_TEXTURE_2X_SIZE,
          minimumSalientFeaturePhysicalPixels: DPR2_RING_FEATURE_FLOOR,
          fRingCorePhysicalPixels:
            DPR2_RING_FEATURE_FLOOR + F_RING_ADDITIONAL_PHYSICAL_PIXELS,
        },
        brightHairlineAlphaGain: BRIGHT_HAIRLINE_ALPHA_GAIN,
        affects: ["narrow-bright-ringlets", "narrow-dark-gaps"],
        sourceGeometryAuthority: "unchanged",
        runtimeWork: false,
      },
      constrainedFeaturesKm: {
        cassiniDivision: [CASSINI_DIVISION_INNER_KM, CASSINI_DIVISION_OUTER_KM],
        enckeGap: [ENCKE_GAP_INNER_KM, ENCKE_GAP_OUTER_KM],
        keelerGap: [KEELER_GAP_INNER_KM, KEELER_GAP_OUTER_KM],
        rocheDivision: [A_RING_OUTER_KM, ROCHE_DIVISION_OUTER_KM],
        fRing: [F_RING_INNER_KM, F_RING_OUTER_KM],
        fRingCoreKm: F_RING_CORE_KM,
      },
    },
    shadowModel: {
      model: "prepared-static-mutual-ray-occlusion",
      worldLightDirection: STATIC_WORLD_LIGHT_DIRECTION,
      objectLightDirection: STATIC_OBJECT_LIGHT_DIRECTION,
      systemTiltDegrees: SATURN_OBLIQUITY_DEGREES,
      systemTiltAxis: STATIC_SYSTEM_TILT_AXIS,
      systemNodeDegrees: STATIC_SYSTEM_NODE_DEGREES,
      meshRotationDegrees: STATIC_MESH_ROTATION_DEGREES,
      saturnOnRings: {
        model: "ray-to-oblate-ellipsoid-prepared-alpha-overlay",
        directTransmission: SATURN_SHADOW_RING_DIRECT_TRANSMISSION,
        shadowedPixelCount: saturnShadowOnRings.shadowedPixelCount,
        meanCoverage: saturnShadowOnRings.meanCoverage,
        denseAlphaRamp: [
          SATURN_SHADOW_DENSE_ALPHA_START,
          SATURN_SHADOW_DENSE_ALPHA_END,
        ],
        edgeFeather: {
          model: "prepared-gaussian-alpha-penumbra-remasked-to-ring-support",
          sigmaTexturePixels: SATURN_SHADOW_EDGE_FEATHER_SIGMA,
          ringSupportAlpha: SATURN_SHADOW_RING_SUPPORT_ALPHA,
          runtimeWork: false,
        },
        overlayTextureUrl: "/scenes/saturn/saturn-ring-shadow.webp",
        authority: "https://science.nasa.gov/photojournal/saturns-shadow-upon-the-rings/",
      },
      ringsOnSaturn: {
        model: "ray-to-prepared-ring-alpha-profile",
        authority: "https://science.nasa.gov/photojournal/rings-and-shadows/",
      },
    },
    sourceHashes,
  })});\n` +
  `export const PREPARED_MAIN_RING_PLATES = Object.freeze(${JSON.stringify(
    mainRingMotionPlates.map((plate) => plate.metadata),
  )});\n` +
  `export const PREPARED_G_RING_PLATES = Object.freeze(${JSON.stringify(
    gRingDustPlates.map((plate) => plate.metadata),
  )});\n` +
  `export const PREPARED_JANUS_EPIMETHEUS_RING_PLATES = Object.freeze(${JSON.stringify(
    janusEpimetheusRingPlates.map((plate) => plate.metadata),
  )});\n` +
  `export const PREPARED_RING_GROUPS = Object.freeze(${JSON.stringify(
    retainedOrbitGroups,
  )});\n`;
await writeFile(sourceModulePath, moduleSource);

console.log(JSON.stringify({
  outputTexturePath,
  outputTexture2xPath,
  outputShadowTexturePath,
  outputStarfieldPath,
  sourceModulePath,
  pointCount: POINT_COUNT,
  orbitGroupDurations: orbitGroups.map(({ durationSeconds }) => durationSeconds),
  sourceHashes,
}, null, 2));

function preparedRingSample(radiusKm) {
  if (radiusKm < D_RING_INNER_KM || radiusKm > F_RING_OUTER_KM) {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }
  if (radiusKm < OPENSPACE_TEXTURE_INNER_KM) {
    const ringlet = Math.max(...D_RING_RINGLET_RADII_KM.map(
      (ringletRadius) => Math.exp(-Math.pow(
        (radiusKm - ringletRadius) / D_RING_RINGLET_PRESENTATION_SIGMA_KM,
        2,
      ))));
    return applyPreparedRingSolarColor({
      red: 184,
      green: 172,
      blue: 151,
      alpha: Math.round(255 * (
        D_RING_PRESENTATION_BASE_ALPHA
        + ringlet * D_RING_RINGLET_PRESENTATION_PEAK_ALPHA
      )),
    });
  }
  const sourceAmount = (radiusKm - OPENSPACE_TEXTURE_INNER_KM) /
    (F_RING_OUTER_KM - OPENSPACE_TEXTURE_INNER_KM);
  const sourceIndex = Math.max(0, Math.min(colorSource.width - 1,
    Math.round(sourceAmount * (colorSource.width - 1))));
  const offset = sourceIndex * 3;
  const transparency = (transparencySource.data[offset] +
    transparencySource.data[offset + 1] + transparencySource.data[offset + 2]) / 3;
  return applyPreparedRingSolarColor(emphasizeInnerRingOpacity(
    radiusKm,
    constrainPreparedRingSample(radiusKm, {
    red: colorSource.data[offset],
    green: colorSource.data[offset + 1],
    blue: colorSource.data[offset + 2],
    alpha: Math.max(0, Math.min(255, Math.round(255 - transparency))),
    }),
  ));
}

function renderResponsiveRingTexture({
  textureSize,
  readabilitySamples,
}) {
  const output = Buffer.alloc(textureSize * textureSize * 4);
  const textureCenter = (textureSize - 1) / 2;
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const radiusNorm = Math.hypot(
        x - textureCenter,
        y - textureCenter,
      ) / textureCenter;
      if (radiusNorm > 1) continue;
      const physicalRadiusPixel = Math.round(radiusNorm * textureCenter);
      const sample = readabilitySamples.get(physicalRadiusPixel) ??
        preparedRingSample(radiusNorm * F_RING_OUTER_KM);
      const outputIndex = (y * textureSize + x) * 4;
      output[outputIndex] = sample.red;
      output[outputIndex + 1] = sample.green;
      output[outputIndex + 2] = sample.blue;
      output[outputIndex + 3] = sample.alpha;
    }
  }
  return output;
}

function preparePhysicalRingReadability({
  features,
  textureSize,
  minimumPhysicalPixels,
}) {
  const samplesByPhysicalPixel = new Map();
  const textureOuterPixels = (textureSize - 1) / 2;
  for (const feature of features) {
    const featurePhysicalPixels = minimumPhysicalPixels +
      (feature.id === "f-ring-core" ? F_RING_ADDITIONAL_PHYSICAL_PIXELS : 0);
    const centerPixel = Math.round(
      feature.radiusKm / F_RING_OUTER_KM * textureOuterPixels,
    );
    const sourceSample = preparedRingSample(feature.radiusKm);
    const sample = feature.kind === "bright-hairline"
      ? {
          ...sourceSample,
          alpha: Math.round((1 - Math.pow(
            1 - sourceSample.alpha / 255,
            feature.alphaGain ?? BRIGHT_HAIRLINE_ALPHA_GAIN,
          )) * 255 * (feature.alphaScale ?? 1)),
        }
      : sourceSample;
    const firstOffset = -Math.floor((featurePhysicalPixels - 1) / 2);
    for (let index = 0; index < featurePhysicalPixels; index += 1) {
      samplesByPhysicalPixel.set(centerPixel + firstOffset + index, sample);
    }
  }
  return { samplesByPhysicalPixel };
}

function ringCompositeIntensity({ red, green, blue, alpha }) {
  return alpha / 255 * (
    0.2126 * red + 0.7152 * green + 0.0722 * blue
  ) / 255;
}

function emphasizeInnerRingOpacity(radiusKm, sample) {
  if (radiusKm < OPENSPACE_TEXTURE_INNER_KM || radiusKm > C_RING_OUTER_KM) {
    return sample;
  }
  const alpha = sample.alpha / 255;
  sample.alpha = Math.round(
    (1 - Math.pow(1 - alpha, C_RING_PRESENTATION_ALPHA_GAIN)) * 255,
  );
  return sample;
}

function applyPreparedRingSolarColor(sample) {
  sample.red = applyLinearTint(sample.red, RING_SOLAR_CHANNEL_FACTORS[0]);
  sample.green = applyLinearTint(sample.green, RING_SOLAR_CHANNEL_FACTORS[1]);
  sample.blue = applyLinearTint(sample.blue, RING_SOLAR_CHANNEL_FACTORS[2]);
  return sample;
}

function constrainPreparedRingSample(radiusKm, sample) {
  if (radiusKm >= CASSINI_DIVISION_INNER_KM &&
      radiusKm <= CASSINI_DIVISION_OUTER_KM) {
    sample.alpha = Math.min(sample.alpha, 46);
  }
  if ((radiusKm >= ENCKE_GAP_INNER_KM && radiusKm <= ENCKE_GAP_OUTER_KM) ||
      (radiusKm >= KEELER_GAP_INNER_KM && radiusKm <= KEELER_GAP_OUTER_KM) ||
      (radiusKm >= A_RING_OUTER_KM && radiusKm < F_RING_INNER_KM)) {
    sample.alpha = 0;
  }
  if (radiusKm >= F_RING_INNER_KM && radiusKm <= F_RING_OUTER_KM) {
    const sourceOffset = (colorSource.width - 1) * 3;
    const core = Math.exp(-Math.pow((radiusKm - F_RING_CORE_KM) / 70, 2));
    const opticalDepth = 0.01 + 0.19 * core;
    sample.red = colorSource.data[sourceOffset];
    sample.green = colorSource.data[sourceOffset + 1];
    sample.blue = colorSource.data[sourceOffset + 2];
    sample.alpha = Math.max(sample.alpha,
      Math.round(255 * (1 - Math.exp(-opticalDepth))));
  }
  return sample;
}

function createSaturnShadowOverlay(textureSize) {
  const center = (textureSize - 1) / 2;
  const sampleOffsets = [-0.25, 0.25];
  const shadowRgba = Buffer.alloc(textureSize * textureSize * 4);
  let shadowedPixelCount = 0;
  let coverageTotal = 0;
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const offset = (y * textureSize + x) * 4;
      const centerXKm = (x - center) / center * F_RING_OUTER_KM;
      const centerYKm = (y - center) / center * F_RING_OUTER_KM;
      const ringAlpha = preparedRingSample(
        Math.hypot(centerXKm, centerYKm)).alpha / 255;
      if (ringAlpha === 0) continue;
      let occludedSamples = 0;
      for (const offsetY of sampleOffsets) {
        for (const offsetX of sampleOffsets) {
          const ringXKm = (x + offsetX - center) / center * F_RING_OUTER_KM;
          const ringYKm = (y + offsetY - center) / center * F_RING_OUTER_KM;
          if (rayIntersectsSaturn([ringXKm, ringYKm, 0], STATIC_OBJECT_LIGHT_DIRECTION)) {
            occludedSamples += 1;
          }
        }
      }
      const coverage = occludedSamples / 4;
      if (coverage === 0) continue;
      const denseRingWeight = smoothstep(
        SATURN_SHADOW_DENSE_ALPHA_START,
        SATURN_SHADOW_DENSE_ALPHA_END,
        ringAlpha,
      );
      const overlayAlpha = coverage *
        (1 - SATURN_SHADOW_RING_DIRECT_TRANSMISSION) *
        denseRingWeight * ringAlpha * ringAlpha;
      if (overlayAlpha <= 1 / 255) continue;
      shadowRgba[offset] = 0;
      shadowRgba[offset + 1] = 0;
      shadowRgba[offset + 2] = 0;
      shadowRgba[offset + 3] = Math.round(overlayAlpha * 255);
      shadowedPixelCount += 1;
      coverageTotal += coverage;
    }
  }
  return {
    rgba: shadowRgba,
    shadowedPixelCount,
    meanCoverage: Number((coverageTotal / Math.max(1, shadowedPixelCount)).toFixed(6)),
  };
}

async function featherSaturnShadowOverlay({
  shadowRgba,
  shadowTextureSize,
  ringRgba,
  ringTextureSize,
}) {
  const blurredAlpha = await sharp(shadowRgba, {
    raw: {
      width: shadowTextureSize,
      height: shadowTextureSize,
      channels: 4,
    },
  })
    .extractChannel(3)
    .blur(SATURN_SHADOW_EDGE_FEATHER_SIGMA)
    .raw()
    .toBuffer();
  const ringAlpha = await sharp(ringRgba, {
    raw: {
      width: ringTextureSize,
      height: ringTextureSize,
      channels: 4,
    },
  })
    .resize(shadowTextureSize, shadowTextureSize, { kernel: "lanczos3" })
    .extractChannel(3)
    .raw()
    .toBuffer();
  const featheredRgba = Buffer.alloc(shadowRgba.byteLength);
  for (let pixel = 0; pixel < blurredAlpha.length; pixel += 1) {
    const ringSupport = Math.min(
      1,
      ringAlpha[pixel] / SATURN_SHADOW_RING_SUPPORT_ALPHA,
    );
    featheredRgba[pixel * 4 + 3] = Math.round(
      blurredAlpha[pixel] * ringSupport,
    );
  }
  return featheredRgba;
}

function rayIntersectsSaturn([x, y, z], [dx, dy, dz]) {
  const equatorialSquared = SATURN_EQUATORIAL_RADIUS_KM ** 2;
  const polarSquared = SATURN_POLAR_RADIUS_KM ** 2;
  const a = (dx * dx + dy * dy) / equatorialSquared + dz * dz / polarSquared;
  const b = 2 * ((x * dx + y * dy) / equatorialSquared + z * dz / polarSquared);
  const c = (x * x + y * y) / equatorialSquared + z * z / polarSquared - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  const root = Math.sqrt(discriminant);
  return (-b - root) / (2 * a) > 0 || (-b + root) / (2 * a) > 0;
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function rotateVectorZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function rotateVectorX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function prepareMainRingMotionGroup(band, bandIndex) {
  const bandRandom = mulberry32(
    (0x53415455 ^ Math.imul(bandIndex + 1, 0x9e3779b9)) >>> 0,
  );
  const formation = MAIN_RING_MOTION_FORMATIONS[band.id];
  const formationPointCount = Math.round(band.count * formation.share);
  const points = [];
  let radiusTotalKm = 0;
  let attempts = 0;
  while (points.length < band.count) {
    attempts += 1;
    if (attempts > band.count * 20_000) {
      throw new Error(`Could not prepare Saturn ${band.id} motion samples.`);
    }
    const radiusKm = mix(band.boundsKm[0], band.boundsKm[1], bandRandom());
    const sample = preparedRingSample(radiusKm);
    const density = sample.alpha / 255;
    const compositeIntensity = ringCompositeIntensity(sample);
    if (compositeIntensity > MAIN_RING_MAX_TRACER_INTENSITY) continue;
    const visibilityWeight = Math.pow(density, 0.5) *
      mix(1, 0.4, compositeIntensity);
    if (bandRandom() > visibilityWeight) continue;
    const inFormation = points.length < formationPointCount;
    const normalizedRadius = (radiusKm - band.boundsKm[0]) /
      (band.boundsKm[1] - band.boundsKm[0]);
    const formationCenter = inFormation
      ? formation.centersRadians[points.length % formation.centersRadians.length]
      : 0;
    const angle = inFormation
      ? formationCenter +
        (normalizedRadius - 0.5) * formation.radialShearRadians +
        normalishRandomWith(bandRandom) * formation.spreadRadians
      : bandRandom() * Math.PI * 2;
    const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
      radiusKm / SATURN_EQUATORIAL_RADIUS_KM;
    const inverted = compositeIntensity >=
      MAIN_RING_INVERTED_LUMINANCE_THRESHOLD;
    const baseColor = inverted
      ? [255 - sample.red, 255 - sample.green, 255 - sample.blue]
      : [
          mix(sample.red, RING_SOLAR_WHITE[0], 0.74),
          mix(sample.green, RING_SOLAR_WHITE[1], 0.74),
          mix(sample.blue, RING_SOLAR_WHITE[2], 0.74),
        ];
    const luminanceVariation = mix(0.96, 1.04, bandRandom());
    const red = Math.min(255, Math.round(
      baseColor[0] * luminanceVariation,
    ));
    const green = Math.min(255, Math.round(
      baseColor[1] * luminanceVariation,
    ));
    const blue = Math.min(255, Math.round(
      baseColor[2] * luminanceVariation,
    ));
    points.push([
      Number((Math.sin(angle) * displayRadius).toFixed(3)),
      Number((Math.cos(angle) * displayRadius).toFixed(3)),
      Number(mix(0.012, 0.028, bandRandom()).toFixed(3)),
      rgbHex(red, green, blue),
      Number(mix(0.5, inFormation ? 0.76 : 0.72, bandRandom()).toFixed(3)),
      inverted,
    ]);
    radiusTotalKm += radiusKm;
  }
  const representativeRadiusKm = Number(
    (radiusTotalKm / points.length).toFixed(3),
  );
  return {
    population: `main-ring-${band.id}`,
    durationSeconds: visualOrbitSeconds(representativeRadiusKm),
    sourceBoundsKm: band.boundsKm,
    representativeRadiusKm,
    formation: {
      kind: formation.kind,
      pointCount: formationPointCount,
      centersRadians: formation.centersRadians,
      spreadRadians: formation.spreadRadians,
      radialShearRadians: formation.radialShearRadians,
    },
    points,
  };
}

function prepareMainRingMotionPlate(group) {
  const id = group.population.replace("main-ring-", "");
  const filename = `saturn-ring-motion-${id}.webp`;
  const filename2x = `saturn-ring-motion-${id}@2x.webp`;
  const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
    group.sourceBoundsKm[1] / SATURN_EQUATORIAL_RADIUS_KM;
  const outerDisplayRadius = DISPLAY_EQUATORIAL_RADIUS *
    F_RING_OUTER_KM / SATURN_EQUATORIAL_RADIUS_KM;
  const textureSize = Math.ceil(
    MAIN_RING_MOTION_TEXTURE_SIZE * displayRadius / outerDisplayRadius / 64,
  ) * 64;
  const texture2xSize = textureSize * 2;
  const uncroppedRgba = renderMainRingMotionPlate(
    group,
    textureSize,
    displayRadius,
  );
  const uncroppedRgba2x = renderMainRingMotionPlate(
    group,
    texture2xSize,
    displayRadius,
  );
  const crop = responsiveTransparentCrop({
    rgba: uncroppedRgba,
    rgba2x: uncroppedRgba2x,
    textureSize,
    gutter: MAIN_RING_MOTION_TRANSPARENT_GUTTER,
  });
  return {
    outputPath: resolve(publicRoot, filename),
    output2xPath: resolve(publicRoot, filename2x),
    rgba: crop.rgba,
    rgba2x: crop.rgba2x,
    textureSize,
    texture2xSize,
    textureWidth: crop.bounds.width,
    textureHeight: crop.bounds.height,
    texture2xWidth: crop.bounds2x.width,
    texture2xHeight: crop.bounds2x.height,
    metadata: {
      population: group.population,
      pointCount: group.points.length,
      durationSeconds: group.durationSeconds,
      textureUrl: `/scenes/saturn/${filename}`,
      texture2xUrl: `/scenes/saturn/${filename2x}`,
      textureSize,
      texture2xSize,
      textureWidth: crop.bounds.width,
      textureHeight: crop.bounds.height,
      texture2xWidth: crop.bounds2x.width,
      texture2xHeight: crop.bounds2x.height,
      textureCropBounds: crop.bounds,
      textureTransparentGutter: MAIN_RING_MOTION_TRANSPARENT_GUTTER,
      displayRadius: Number(displayRadius.toFixed(6)),
      elevation: 0.02,
      sourceBoundsKm: group.sourceBoundsKm,
      formation: group.formation,
      runtimeRasterization: false,
    },
  };
}

function prepareDustMotionPlate(group, densityLayer, filenameStem) {
  const suffix = densityLayer === "base" ? "" : "-extra";
  const filename = `${filenameStem}${suffix}.webp`;
  const filename2x = `${filenameStem}${suffix}@2x.webp`;
  const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
    group.sourceBoundsKm[1] / SATURN_EQUATORIAL_RADIUS_KM;
  const outerDisplayRadius = DISPLAY_EQUATORIAL_RADIUS *
    F_RING_OUTER_KM / SATURN_EQUATORIAL_RADIUS_KM;
  const textureSize = Math.ceil(
    MAIN_RING_MOTION_TEXTURE_SIZE * displayRadius / outerDisplayRadius / 64,
  ) * 64;
  const texture2xSize = textureSize * 2;
  return {
    outputPath: resolve(publicRoot, filename),
    output2xPath: resolve(publicRoot, filename2x),
    rgba: renderMainRingMotionPlate(group, textureSize, displayRadius),
    rgba2x: renderMainRingMotionPlate(group, texture2xSize, displayRadius),
    textureSize,
    texture2xSize,
    metadata: {
      population: group.population,
      densityLayer,
      pointCount: group.points.length,
      durationSeconds: group.durationSeconds,
      textureUrl: `/scenes/saturn/${filename}`,
      texture2xUrl: `/scenes/saturn/${filename2x}`,
      textureSize,
      texture2xSize,
      displayRadius: Number(displayRadius.toFixed(6)),
      elevation: 0,
      sourceBoundsKm: group.sourceBoundsKm,
      compositeMode: "flat",
      runtimeRasterization: false,
    },
  };
}

function renderMainRingMotionPlate(group, textureSize, displayRadius) {
  const rgba = Buffer.alloc(textureSize * textureSize * 4);
  const center = (textureSize - 1) / 2;
  const pixelsPerWorldUnit = center / displayRadius;
  const pointRadius = 1.18 * pixelsPerWorldUnit;
  for (const [x, y, , color, sourceOpacity, inverted] of group.points) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const opacity = inverted
      ? 0.5
      : prepareMainRingPointOpacity(sourceOpacity);
    drawPreparedDisc(
      rgba,
      textureSize,
      center + x * pixelsPerWorldUnit,
      center + y * pixelsPerWorldUnit,
      pointRadius,
      [red, green, blue],
      opacity,
    );
  }
  return rgba;
}

function drawPreparedDisc(
  rgba,
  textureSize,
  centerX,
  centerY,
  radius,
  [red, green, blue],
  opacity,
) {
  const minimumX = Math.max(0, Math.floor(centerX - radius - 1));
  const maximumX = Math.min(textureSize - 1, Math.ceil(centerX + radius + 1));
  const minimumY = Math.max(0, Math.floor(centerY - radius - 1));
  const maximumY = Math.min(textureSize - 1, Math.ceil(centerY + radius + 1));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance));
      if (coverage === 0) continue;
      const sourceAlpha = opacity * coverage;
      const offset = (y * textureSize + x) * 4;
      const destinationAlpha = rgba[offset + 3] / 255;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const destinationAmount = destinationAlpha * (1 - sourceAlpha);
      rgba[offset] = Math.round(
        (red * sourceAlpha + rgba[offset] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 1] = Math.round(
        (green * sourceAlpha + rgba[offset + 1] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 2] = Math.round(
        (blue * sourceAlpha + rgba[offset + 2] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 3] = Math.round(outputAlpha * 255);
    }
  }
}

function prepareMainRingPointOpacity(sourceOpacity) {
  const [sourceMinimum, sourceMaximum] = MAIN_RING_POINT_SOURCE_OPACITY_RANGE;
  const normalized = Math.max(0, Math.min(1,
    (sourceOpacity - sourceMinimum) / (sourceMaximum - sourceMinimum)));
  return mix(
    MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE[0],
    MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE[1],
    normalized,
  );
}

function writePreparedRgbaWebp(rgba, textureWidth, outputPath,
  textureHeight = textureWidth) {
  return sharp(rgba, {
    raw: { width: textureWidth, height: textureHeight, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}

function prepareOuterDustPoints({
  count,
  radius,
  verticalExtentKm,
  color,
  opacity,
  randomSource,
}) {
  return Array.from({ length: count }, (_, index) => prepareOuterDustPoint({
    radiusKm: radius(index, randomSource),
    verticalExtentKm,
    color: typeof color === "function" ? color(index) : color,
    opacity,
    randomSource,
  }));
}

function prepareRingPointExpansion(point, index, groupIndex) {
  const [x, y, z, color, opacity, inverted = false] = point;
  const radius = Math.hypot(x, y);
  const sourceAngle = Math.atan2(x, y);
  const phaseTurns = (
    (index + 1) * 0.61803398875 +
    (groupIndex + 1) * 0.41421356237
  ) % 1;
  const angle = sourceAngle + phaseTurns * Math.PI * 2;
  return [
    Number((Math.sin(angle) * radius).toFixed(3)),
    Number((Math.cos(angle) * radius).toFixed(3)),
    Number((z * ((index + groupIndex) % 2 === 0 ? 1 : -1)).toFixed(3)),
    color,
    opacity,
    inverted,
  ];
}

function gRingDustRadius(index, randomSource) {
  const radialSample = randomSource();
  const cohortIndex = (index * 149 + 17) % G_RING_POINT_COUNT;
  const shoulderAmount = 0.005 + 0.995 * radialSample ** 2;
  if (cohortIndex < G_RING_INNER_SHOULDER_POINT_COUNT) {
    return G_RING_INNER_KM -
      (G_RING_INNER_KM - G_RING_INNER_SHOULDER_MIN_KM) * shoulderAmount;
  }
  if (cohortIndex < G_RING_INNER_SHOULDER_POINT_COUNT +
      G_RING_OUTER_SHOULDER_POINT_COUNT) {
    return G_RING_OUTER_KM +
      (G_RING_OUTER_SHOULDER_MAX_KM - G_RING_OUTER_KM) * shoulderAmount;
  }
  return mix(G_RING_INNER_KM, G_RING_OUTER_KM, radialSample);
}

function janusEpimetheusRingRadius(_index, randomSource) {
  return mix(
    JANUS_EPIMETHEUS_RING_INNER_KM,
    JANUS_EPIMETHEUS_RING_OUTER_KM,
    randomSource(),
  );
}

function prepareERingDustGroup(band, bandIndex) {
  const randomSource = mulberry32(
    (0x4552494e ^ Math.imul(bandIndex + 1, 0x9e3779b9)) >>> 0,
  );
  const radiiKm = Array.from(
    { length: band.count },
    () => prepareERingRadius(band, randomSource),
  );
  const representativeRadiusKm = Number((
    radiiKm.reduce((sum, radiusKm) => sum + radiusKm, 0) / radiiKm.length
  ).toFixed(3));
  return {
    population: `e-ring-${band.id}`,
    durationSeconds: visualOrbitSeconds(representativeRadiusKm),
    sourceBoundsKm: band.boundsKm,
    representativeRadiusKm,
    verticalExtentKm: band.verticalExtentKm,
    points: radiiKm.map((radiusKm) => prepareOuterDustPoint({
      radiusKm,
      verticalExtentKm: band.verticalExtentKm,
      color: E_RING_DUST_COLOR,
      opacity: [0.48, 0.66],
      randomSource,
    })),
  };
}

function prepareERingRadius(band, randomSource) {
  let amount = randomSource();
  if (band.distribution === "triangular") {
    amount = (amount + randomSource()) / 2;
  } else if (band.distribution === "inner-biased-cubic") {
    amount **= 3;
  }
  return mix(band.boundsKm[0], band.boundsKm[1], amount);
}

function gRingDustColor(index) {
  const cohortIndex = (index * 137 + 41) % G_RING_POINT_COUNT;
  if (cohortIndex >= G_RING_PURPLE_POINT_COUNT) return G_RING_DUST_NEUTRAL;
  return G_RING_DUST_PURPLES[cohortIndex % G_RING_DUST_PURPLES.length];
}

function prepareOuterDustPoint({
  radiusKm,
  verticalExtentKm,
  color,
  opacity,
  randomSource,
}) {
  const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
    radiusKm / SATURN_EQUATORIAL_RADIUS_KM;
  const angle = randomSource() * Math.PI * 2;
  const verticalKm = normalishRandomWith(randomSource) * verticalExtentKm / 4;
  const worldZ = DISPLAY_EQUATORIAL_RADIUS *
    verticalKm / SATURN_EQUATORIAL_RADIUS_KM;
  const luminanceVariation = mix(0.94, 1.06, randomSource());
  return [
    Number((Math.sin(angle) * displayRadius).toFixed(3)),
    Number((Math.cos(angle) * displayRadius).toFixed(3)),
    Number(worldZ.toFixed(3)),
    rgbHex(
      Math.min(255, Math.round(color[0] * luminanceVariation)),
      Math.min(255, Math.round(color[1] * luminanceVariation)),
      Math.min(255, Math.round(color[2] * luminanceVariation)),
    ),
    Number(mix(opacity[0], opacity[1], randomSource()).toFixed(3)),
  ];
}

function createStarfield({ presentation, stars }) {
  const pixels = Buffer.alloc(STARFIELD_WIDTH * STARFIELD_HEIGHT * 3);
  for (let offset = 2; offset < pixels.length; offset += 3) pixels[offset] = 3;

  for (const star of stars) {
    const brightnessRank = clamp(
      (presentation.faintestMagnitude - star.magnitude) /
        Math.max(
          0.01,
          presentation.faintestMagnitude - presentation.brightestMagnitude,
        ),
      0,
      1,
    );
    const intensity = 84 + 171 * Math.pow(brightnessRank, 0.48);
    const radius = brightnessRank > 0.68 ? 2 :
      brightnessRank > 0.32 ? 1 : 0;
    const sourceColor = blackbodyRgb(
      colorTemperatureFromBv(star.colorIndex),
    );
    const color = sourceColor.map(
      (channel) => (0.68 * channel + 0.32 * 255) *
        intensity / 255 * STARFIELD_OPACITY,
    );
    drawPreparedStar(
      pixels,
      Math.round(star.x * STARFIELD_WIDTH),
      Math.round(star.y * STARFIELD_HEIGHT),
      radius,
      color,
    );
  }
  return pixels;
}

function validateStarfieldSource(source) {
  if (source?.schema !== "csssaturn-prepared-star-source@1") {
    throw new TypeError("Saturn starfield source is incompatible.");
  }
  if (source.source?.license !== "CC-BY-SA-4.0" ||
      typeof source.source?.credit !== "string" ||
      typeof source.projection?.qualification !== "string") {
    throw new TypeError("Saturn starfield provenance is incomplete.");
  }
  if (source.presentation?.width !== STARFIELD_WIDTH ||
      source.presentation?.height !== STARFIELD_HEIGHT ||
      source.presentation?.selectedStars !== STARFIELD_POINT_COUNT ||
      source.presentation?.opacity !== STARFIELD_OPACITY ||
      source.stars?.length !== STARFIELD_POINT_COUNT) {
    throw new RangeError("Saturn starfield presentation plan is inconsistent.");
  }
  for (const star of source.stars) {
    if (!Number.isInteger(star.id) ||
        !Number.isFinite(star.x) || star.x < -0.011 || star.x > 1.011 ||
        !Number.isFinite(star.y) || star.y < -0.011 || star.y > 1.011 ||
        !Number.isFinite(star.magnitude) ||
        !Number.isFinite(star.colorIndex)) {
      throw new TypeError("Saturn starfield contains an invalid catalog row.");
    }
  }
}

function colorTemperatureFromBv(colorIndex) {
  const bv = clamp(colorIndex, -0.4, 2);
  return clamp(
    4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)),
    2500,
    12000,
  );
}

function blackbodyRgb(temperature) {
  const value = temperature / 100;
  const red = value <= 66 ? 255 :
    329.698727446 * Math.pow(value - 60, -0.1332047592);
  const green = value <= 66 ?
    99.4708025861 * Math.log(value) - 161.1195681661 :
    288.1221695283 * Math.pow(value - 60, -0.0755148492);
  const blue = value >= 66 ? 255 : value <= 19 ? 0 :
    138.5177312231 * Math.log(value - 10) - 305.044792731;
  return [red, green, blue].map((channel) => clamp(channel, 0, 255));
}

function drawPreparedStar(pixels, centerX, centerY, radius, color) {
  const extent = radius + 1;
  for (let y = centerY - extent; y <= centerY + extent; y += 1) {
    if (y < 0 || y >= STARFIELD_HEIGHT) continue;
    for (let x = centerX - extent; x <= centerX + extent; x += 1) {
      if (x < 0 || x >= STARFIELD_WIDTH) continue;
      const distance = Math.hypot(x - centerX, y - centerY);
      const weight = radius === 0
        ? (distance === 0 ? 1 : 0)
        : Math.max(0, 1 - distance / (radius + 0.75));
      if (weight === 0) continue;
      const offset = (y * STARFIELD_WIDTH + x) * 3;
      pixels[offset] = Math.max(pixels[offset], Math.round(color[0] * weight));
      pixels[offset + 1] = Math.max(pixels[offset + 1], Math.round(color[1] * weight));
      pixels[offset + 2] = Math.max(pixels[offset + 2], Math.round(color[2] * weight));
    }
  }
}

function normalishRandomWith(randomSource) {
  return randomSource() + randomSource() + randomSource() + randomSource() - 2;
}

function visualOrbitSeconds(radiusKm) {
  const realPeriodSeconds = 2 * Math.PI * Math.sqrt(
    Math.pow(radiusKm, 3) / SATURN_GM_KM3_PER_S2,
  );
  return Number((realPeriodSeconds / PRESENTATION_TIME_SCALE).toFixed(3));
}

async function readRgbRow(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  if (info.height !== 1 || info.channels !== 3) {
    throw new Error(`Expected one RGB row at ${path}`);
  }
  return { data, width: info.width };
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function rgbHex(red, green, blue) {
  return `#${[red, green, blue].map(
    (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function applyLinearTint(channel, factor) {
  const srgb = channel / 255;
  const linear = srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
  const lit = Math.max(0, Math.min(1, linear * factor));
  const encoded = lit <= 0.0031308
    ? lit * 12.92
    : 1.055 * Math.pow(lit, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  buildPolyMeshTransform,
  buildSeamBleedPolygonEdges,
  computeSolidTrianglePlan,
  computeTextureAtlasPlanPublic,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
  spherePolygons,
} from "@layoutit/polycss";
import { PREPARED_RING_SOURCE } from "../runtime/preparedRingPoints.mjs";
import {
  extractRgbaBounds,
  responsiveTransparentCrop,
  visibleRgbaMatches,
} from "./prepare-rgba.mjs";
import {
  optimizePreparedQ75Webp,
  PREPARED_Q75_WEBP_ENCODING,
} from "../../../../tools/prepared-webp.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";
import {
  ensureSaturnPreparationDirectories,
  SATURN_PUBLIC_ROOT,
  SATURN_STAGING_ROOT,
} from "./preparation-paths.mjs";

await validateSaturnSourceGroup("moons");
await ensureSaturnPreparationDirectories();

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(objectRoot, "source/moons");
const publicRoot = SATURN_PUBLIC_ROOT;
const stagingRoot = SATURN_STAGING_ROOT;
const outputModulePath = resolve(objectRoot, "runtime/preparedMoons.mjs");
const motionModulePath = resolve(
  objectRoot,
  "runtime/preparedMoonMotion.mjs",
);
const atlasPath = resolve(stagingRoot, "saturn-moons.webp");
const atlas2xPath = resolve(stagingRoot, "saturn-moons@2x.webp");
const billboardAtlasPath = resolve(publicRoot, "saturn-moon-billboards.webp");
const billboardAtlas2xPath = resolve(
  publicRoot,
  "saturn-moon-billboards@2x.webp",
);
const shadowAtlasPath = resolve(stagingRoot, "saturn-moon-shadows.webp");
const shadowAtlas2xPath = resolve(stagingRoot, "saturn-moon-shadows@2x.webp");
const shadowRuntimeAtlasPath = resolve(publicRoot, "saturn-moon-shadows.webp");
const shadowRuntimeAtlas2xPath = resolve(
  publicRoot,
  "saturn-moon-shadows@2x.webp",
);
const moonShadowRowUrl = (rowIndex) =>
  `/scenes/saturn/saturn-moon-shadows-row-${String(rowIndex).padStart(2, "0")}.webp`;
const moonShadowRow2xUrl = (rowIndex) =>
  `/scenes/saturn/saturn-moon-shadows-row-${String(rowIndex).padStart(2, "0")}@2x.webp`;
const moonShadowRowPath = (rowIndex) => resolve(
  publicRoot,
  `saturn-moon-shadows-row-${String(rowIndex).padStart(2, "0")}.webp`,
);
const moonShadowRow2xPath = (rowIndex) => resolve(
  publicRoot,
  `saturn-moon-shadows-row-${String(rowIndex).padStart(2, "0")}@2x.webp`,
);
const PREPARED_Q75_MOON_SHADOW_ASSET_URLS = new Set([
  moonShadowRowUrl(5),
  moonShadowRow2xUrl(5),
  moonShadowRowUrl(6),
  moonShadowRowUrl(7),
]);
const moonCatalog = JSON.parse(await readFile(
  resolve(sourceRoot, "saturn-moons.json"),
  "utf8",
));

const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_DISPLAY_RADIUS = 230;
const SATURN_REFERENCE_ROTATION_SECONDS = 10 * 3600 + 33 * 60 + 38;
const SATURN_VISUAL_ROTATION_SECONDS = 72;
const PRESENTATION_TIME_SCALE =
  SATURN_REFERENCE_ROTATION_SECONDS / SATURN_VISUAL_ROTATION_SECONDS;
const MOON_RADIUS_PRESENTATION_SCALE = 1.5;
const MOON_RADIUS_PRESENTATION_SCALE_OVERRIDES = Object.freeze({ titan: 1 });
const MOON_ORBIT_PRESENTATION_INNER_RADIUS = 650;
const MOON_ORBIT_PRESENTATION_OUTER_RADIUS = 1_200;
const MOON_ORBIT_PRESENTATION_DISTANT_RADIUS = 1_650;
const MINOR_MOON_PRESENTATION_RADIUS = 0.9;
const MINOR_MOON_COLOR = "#c8c1b7";
const MINOR_MOON_MAXIMUM_SCENE_SCALE = 0.08;
const MOON_LATITUDE_SEGMENTS = 8;
const MOON_LONGITUDE_SEGMENTS = 12;
const MOON_SURFACE_OVERLAP = 0.016;
const MOON_POLAR_SURFACE_OVERLAP = 1.035;
const MOON_POLAR_SUPERSAMPLING = 2;
const TILE_SIZE = 50;
const SEAM_BLEED = 0.35;
const ATLAS_COLUMNS = 16;
const ATLAS_CONTENT_SIZE = 32;
const ATLAS_GUTTER = 1;
const ATLAS_CELL_SIZE = ATLAS_CONTENT_SIZE + ATLAS_GUTTER * 2;
const MOON_ATLAS_URL = "/scenes/saturn/saturn-moons.webp";
const MOON_ATLAS_2X_URL = "/scenes/saturn/saturn-moons@2x.webp";
const MOON_BILLBOARD_ATLAS_URL = "/scenes/saturn/saturn-moon-billboards.webp";
const MOON_BILLBOARD_ATLAS_2X_URL =
  "/scenes/saturn/saturn-moon-billboards@2x.webp";
const MOON_BILLBOARD_CONTENT_SIZE = 64;
const MOON_BILLBOARD_GUTTER = 2;
const MOON_BILLBOARD_STRIDE =
  MOON_BILLBOARD_CONTENT_SIZE + MOON_BILLBOARD_GUTTER * 2;
const MOON_BILLBOARD_COLUMNS = 4;
const MOON_BILLBOARD_ROWS = 2;
const MOON_BILLBOARD_ATLAS_WIDTH =
  MOON_BILLBOARD_COLUMNS * MOON_BILLBOARD_STRIDE;
const MOON_BILLBOARD_ATLAS_HEIGHT =
  MOON_BILLBOARD_ROWS * MOON_BILLBOARD_STRIDE;
const MOON_BILLBOARD_SUPERSAMPLING = 2;
const MOON_SHADOW_ATLAS_URL = "/scenes/saturn/saturn-moon-shadows.webp";
const MOON_SHADOW_ATLAS_2X_URL = "/scenes/saturn/saturn-moon-shadows@2x.webp";
const MOON_SHADOW_FRAME_COUNT = 256;
const MOON_SHADOW_FRAME_COLUMNS = 16;
const MOON_SHADOW_FRAME_ROWS = 16;
const MOON_SHADOW_CONTENT_SIZE = 128;
const MOON_SHADOW_GUTTER = 2;
const MOON_SHADOW_TRANSPARENT_GUTTER = 1;
const MOON_SHADOW_FRAME_STRIDE =
  MOON_SHADOW_CONTENT_SIZE + MOON_SHADOW_GUTTER * 2;
const MOON_SHADOW_ATLAS_WIDTH =
  MOON_SHADOW_FRAME_COLUMNS * MOON_SHADOW_FRAME_STRIDE;
const MOON_SHADOW_ATLAS_HEIGHT =
  MOON_SHADOW_FRAME_ROWS * MOON_SHADOW_FRAME_STRIDE;
const MOON_SHADOW_MAXIMUM_SCENE_PITCH = 65;
const MOON_SHADOW_DEFAULT_SCENE_PITCH = 40;
const MOON_SHADOW_SYSTEM_OBLIQUITY = 26.73;
const MOON_SHADOW_PRESENTATION_NODE = -60;
const MOON_SHADOW_COVERAGE_SCALE = 1.002;
const MOON_SHADOW_DEPTH_BIAS = 0.04;
const MOON_SHADOW_SUPERSAMPLING = 2;
const MOON_SHADOW_GAMMA = 2.2;
const MOON_LABEL_DEFAULT_SCENE_SCALE = 0.023;
const MOON_LABEL_GAP_PX = 10;
const MOON_LABEL_WIDTH_PX = 80;
const SOLAR_COLOR = Object.freeze([1, 0.945, 0.9]);
const TITAN_COLOR = Object.freeze([1.28, 0.82, 0.46]);
const LIGHTING = Object.freeze({
  directionalLight: Object.freeze({
    direction: PREPARED_RING_SOURCE.shadowModel.worldLightDirection,
    color: "#fff1ea",
    intensity: Math.PI,
  }),
  ambientLight: Object.freeze({
    color: "#fff1ea",
    intensity: 0.05 * Math.PI,
  }),
});
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: SEAM_BLEED,
  ...LIGHTING,
});

// JPL SAT441 mean elements at 2000-01-01.5 TDB. Radii use JPL mean values,
// except Mimas and Hyperion, whose OpenSpace axes preserve their visible shape.
const DETAILED_MOONS = Object.freeze([
  moon({
    id: "mimas", name: "Mimas", source: "mimas.jpg",
    radiiKm: [207, 197, 191], meanRadiusKm: 198.2,
    orbitKm: 186_000, eccentricity: 0.02, periodDays: 0.942422,
    inclinationDeg: 1.6, nodeDeg: 66.2, periapsisDeg: 160.4,
    meanAnomalyDeg: 275.3,
  }),
  moon({
    id: "enceladus", name: "Enceladus", source: "enceladus.jpg",
    meanRadiusKm: 252.1, orbitKm: 238_400, eccentricity: 0.005,
    periodDays: 1.370218, inclinationDeg: 0, nodeDeg: 0,
    periapsisDeg: 119.5, meanAnomalyDeg: 57,
  }),
  moon({
    id: "tethys", name: "Tethys", source: "tethys.jpg",
    meanRadiusKm: 531.1, orbitKm: 295_000, eccentricity: 0.001,
    periodDays: 1.887802, inclinationDeg: 1.1, nodeDeg: 273,
    periapsisDeg: 335.3, meanAnomalyDeg: 0,
  }),
  moon({
    id: "dione", name: "Dione", source: "dione.jpg",
    meanRadiusKm: 561.4, orbitKm: 377_700, eccentricity: 0.002,
    periodDays: 2.736916, inclinationDeg: 0, nodeDeg: 0,
    periapsisDeg: 116, meanAnomalyDeg: 212,
  }),
  moon({
    id: "rhea", name: "Rhea", source: "rhea.jpg",
    meanRadiusKm: 763.5, orbitKm: 527_200, eccentricity: 0.001,
    periodDays: 4.517503, inclinationDeg: 0.3, nodeDeg: 133.7,
    periapsisDeg: 44.3, meanAnomalyDeg: 31.5,
  }),
  moon({
    id: "titan", name: "Titan", source: "titan.tif",
    meanRadiusKm: 2574.76, orbitKm: 1_221_900, eccentricity: 0.029,
    periodDays: 15.945448, inclinationDeg: 0.3, nodeDeg: 78.6,
    periapsisDeg: 78.3, meanAnomalyDeg: 11.7,
    tint: TITAN_COLOR,
  }),
  moon({
    id: "hyperion", name: "Hyperion", source: null,
    radiiKm: [180.1, 133, 102.7], meanRadiusKm: 135,
    orbitKm: 1_481_500, eccentricity: 0.105, periodDays: 21.276658,
    inclinationDeg: 0.6, nodeDeg: 87.1, periapsisDeg: 214,
    meanAnomalyDeg: 122.9, solidColor: "#8f7964",
  }),
  moon({
    id: "iapetus", name: "Iapetus", source: "iapetus.jpg",
    meanRadiusKm: 734.3, orbitKm: 3_561_700, eccentricity: 0.028,
    periodDays: 79.331002, inclinationDeg: 7.6, nodeDeg: 86.5,
    periapsisDeg: 254.5, meanAnomalyDeg: 74.8,
  }),
]);

if (moonCatalog.schema !== "csssaturn-moon-catalog@1" ||
    moonCatalog.counts?.confirmed !== 293 ||
    moonCatalog.moons?.length !== 293) {
  throw new Error("Prepared Saturn moon catalog drifted.");
}
const detailedMoonIds = new Set(DETAILED_MOONS.map(({ id }) => id));
const MINOR_MOONS = Object.freeze(moonCatalog.moons
  .filter(({ id }) => !detailedMoonIds.has(id))
  .map((entry) => minorMoon(entry)));
if (MINOR_MOONS.length !== 285) {
  throw new Error(`Prepared minor moon count drifted: ${MINOR_MOONS.length}.`);
}
const MOONS = Object.freeze([...DETAILED_MOONS, ...MINOR_MOONS]);

function moon(definition) {
  const radius = definition.meanRadiusKm;
  return Object.freeze({
    tint: SOLAR_COLOR,
    radiiKm: [radius, radius, radius],
    ...definition,
  });
}

function minorMoon(entry) {
  return Object.freeze({
    id: entry.id,
    name: entry.name,
    minor: true,
    source: null,
    solidColor: MINOR_MOON_COLOR,
    meanRadiusKm: null,
    radiiKm: null,
    presentationRadii: Object.freeze([
      MINOR_MOON_PRESENTATION_RADIUS,
      MINOR_MOON_PRESENTATION_RADIUS,
      MINOR_MOON_PRESENTATION_RADIUS,
    ]),
    orbitKm: entry.semiMajorAxisKm,
    eccentricity: entry.eccentricity,
    periodDays: entry.periodDays,
    inclinationDeg: entry.inclinationDeg,
    nodeDeg: entry.ascendingNodeDeg,
    periapsisDeg: entry.argumentOfPeriapsisDeg,
    meanAnomalyDeg: entry.meanAnomalyDeg,
    catalogRecord: entry.sourceRecord,
    parameterQualification: entry.parameterQualification,
  });
}

function prepareMinorMoonDot(definition) {
  const displayOrbitRadius = presentationOrbitRadius(definition.orbitKm);
  const visualPeriodSeconds =
    definition.periodDays * 86_400 / PRESENTATION_TIME_SCALE;
  const phaseDegrees = normalizeDegrees(
    definition.periapsisDeg + definition.meanAnomalyDeg,
  );
  const nodeRadians = definition.nodeDeg * Math.PI / 180;
  const inclinationRadians = definition.inclinationDeg * Math.PI / 180;
  const translateAt = (offset) => {
    const angle = -offset * Math.PI * 2;
    let position = [
        displayOrbitRadius * Math.cos(angle),
        displayOrbitRadius * Math.sin(angle),
        0,
    ];
    position = rotateVectorX(position, inclinationRadians);
    position = rotateVectorZ(position, nodeRadians);
    return position
      .map((value) => `${round(value * TILE_SIZE, 4)}px`)
      .join(" ");
  };
  const maximumZoomSpeedPxPerSecond = 2 * Math.PI * displayOrbitRadius *
    MINOR_MOON_MAXIMUM_SCENE_SCALE / visualPeriodSeconds;
  const initialTranslate = translateAt(phaseDegrees / 360);
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    sourceModel: "JPL-mean-elements-prepared-static-epoch-translate",
    catalogRecord: definition.catalogRecord,
    parameterQualification: definition.parameterQualification,
    orbitKm: definition.orbitKm,
    displayOrbitRadius: round(displayOrbitRadius, 6),
    eccentricity: definition.eccentricity,
    inclinationDeg: definition.inclinationDeg,
    nodeDeg: definition.nodeDeg,
    periapsisDeg: definition.periapsisDeg,
    meanAnomalyDeg: definition.meanAnomalyDeg,
    periodDays: definition.periodDays,
    visualPeriodSeconds: round(visualPeriodSeconds, 6),
    phaseDegrees: round(phaseDegrees, 6),
    animated: false,
    maximumZoomSpeedPxPerSecond: round(maximumZoomSpeedPxPerSecond, 9),
    style: `translate:${initialTranslate}`,
  });
}

const texturedMoonPlans = [];
const billboardMoonPlans = [];
const preparedMoonGeometry = [];

for (const definition of DETAILED_MOONS) {
  const source = definition.source
    ? await prepareSourceRaster(definition)
    : null;
  const tileIndex = billboardMoonPlans.length;
  billboardMoonPlans.push(Object.freeze({ definition, source, tileIndex }));
  preparedMoonGeometry.push(Object.freeze({
    definition,
    billboard: true,
    tileIndex,
    solid: false,
  }));
}

const ATLAS_ROWS = Math.max(
  1,
  Math.ceil(texturedMoonPlans.length / ATLAS_COLUMNS),
);
const ATLAS_WIDTH = ATLAS_COLUMNS * ATLAS_CELL_SIZE;
const ATLAS_HEIGHT = ATLAS_ROWS * ATLAS_CELL_SIZE;
const shadowAtlasRgba = renderMoonShadowAtlas(1);
const shadowAtlas2xRgba = renderMoonShadowAtlas(2);
const shadowAtlasCrop = responsiveTransparentCrop({
  rgba: shadowAtlasRgba,
  rgba2x: shadowAtlas2xRgba,
  textureSize: MOON_SHADOW_ATLAS_WIDTH,
  gutter: MOON_SHADOW_TRANSPARENT_GUTTER,
});

await Promise.all([
  writeAtlas(atlasPath, 1),
  writeAtlas(atlas2xPath, 2),
  writeMoonBillboardAtlas(billboardAtlasPath, 1),
  writeMoonBillboardAtlas(billboardAtlas2xPath, 2),
  writeRgbaWebp(
    shadowAtlasPath,
    shadowAtlasCrop.rgba,
    shadowAtlasCrop.bounds.width,
    shadowAtlasCrop.bounds.height,
  ),
  writeRgbaWebp(
    shadowAtlas2xPath,
    shadowAtlasCrop.rgba2x,
    shadowAtlasCrop.bounds2x.width,
    shadowAtlasCrop.bounds2x.height,
  ),
]);
await Promise.all([
  optimizePreparedQ75Webp(billboardAtlasPath),
  optimizePreparedQ75Webp(billboardAtlas2xPath),
]);
const shadowRuntimeRows = await prepareMoonShadowRuntimeRows({
  rgba: shadowAtlasRgba,
  rgba2x: shadowAtlas2xRgba,
});

const [shadowRuntimeAtlas, shadowRuntimeAtlas2x] = await Promise.all([
  prepareMoonShadowRuntimeAtlas({ density: 1, rows: shadowRuntimeRows }),
  prepareMoonShadowRuntimeAtlas({ density: 2, rows: shadowRuntimeRows }),
]);

const [shadowAtlasAsset, shadowAtlas2xAsset] = await Promise.all([
  readFile(shadowRuntimeAtlasPath),
  readFile(shadowRuntimeAtlas2xPath),
]);

const defaultMoonShadowFrame = moonShadowFrameForScenePitch(
  MOON_SHADOW_DEFAULT_SCENE_PITCH,
);
const defaultMoonShadowRow = Math.floor(
  defaultMoonShadowFrame / MOON_SHADOW_FRAME_COLUMNS,
);
const initialMoonShadowRows = Object.freeze([
  defaultMoonShadowRow - 1,
  defaultMoonShadowRow,
  defaultMoonShadowRow + 1,
].filter((rowIndex) => rowIndex >= 0 &&
  rowIndex < MOON_SHADOW_FRAME_ROWS));
const moonShadowRuntimePresentations = Object.freeze(Array.from(
  { length: MOON_SHADOW_FRAME_COUNT },
  (_, frameIndex) => {
    const column = frameIndex % MOON_SHADOW_FRAME_COLUMNS;
    const rowIndex = Math.floor(frameIndex / MOON_SHADOW_FRAME_COLUMNS);
    return Object.freeze({
      frameIndex,
      rowIndex,
      assetUrl: MOON_SHADOW_ATLAS_URL,
      asset2xUrl: MOON_SHADOW_ATLAS_2X_URL,
      backgroundPosition:
        `${-(column * MOON_SHADOW_FRAME_STRIDE + MOON_SHADOW_GUTTER)}px ` +
        `${-(rowIndex * MOON_SHADOW_FRAME_STRIDE +
          MOON_SHADOW_GUTTER)}px`,
      backgroundSize:
        `${MOON_SHADOW_ATLAS_WIDTH}px ${MOON_SHADOW_ATLAS_HEIGHT}px`,
    });
  },
));

const preparedMoons = preparedMoonGeometry.map((geometry) => {
  const { definition } = geometry;
  const visualPeriodSeconds =
    definition.periodDays * 86_400 / PRESENTATION_TIME_SCALE;
  const phaseDegrees = normalizeDegrees(
    definition.periapsisDeg + definition.meanAnomalyDeg,
  );
  const displayOrbitRadius = presentationOrbitRadius(definition.orbitKm);
  const billboard = geometry.billboard
    ? prepareMoonBillboardProjection(
      definition,
      visualPeriodSeconds,
      phaseDegrees,
      displayOrbitRadius,
    )
    : null;
  const leaves = geometry.billboard
    ? [prepareMoonBillboardLeaf(geometry, billboard)]
    : geometry.solid
      ? prepareSolidLeaves(geometry)
      : prepareTextureLeaves(geometry);
  const shadow = definition.minor || definition.source === null
    ? null
    : prepareMoonShadow(definition, visualPeriodSeconds, phaseDegrees);
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    minor: definition.minor === true,
    sourceModel: geometry.billboard
      ? definition.minor
        ? "JPL-mean-elements-on-prepared-shared-marker-plane"
        : definition.source
        ? "openspace-synchronized-map-on-prepared-camera-facing-plane"
        : "openspace-shape-ratios-on-prepared-camera-facing-plane"
      : "openspace-synchronized-map-on-prepared-low-poly-uv-sphere",
    surfaceTopology: geometry.billboard
      ? "prepared-camera-facing-alpha-plane"
      : "projective-quad-uv-sphere-with-polar-caps",
    meanRadiusKm: definition.meanRadiusKm,
    radiiKm: definition.radiiKm,
    markerRadius: definition.minor ? MINOR_MOON_PRESENTATION_RADIUS : null,
    radiusPresentationScale: moonRadiusPresentationScale(definition),
    orbitKm: definition.orbitKm,
    displayOrbitRadius: round(displayOrbitRadius, 6),
    eccentricity: definition.eccentricity,
    inclinationDeg: definition.inclinationDeg,
    nodeDeg: definition.nodeDeg,
    periapsisDeg: definition.periapsisDeg,
    meanAnomalyDeg: definition.meanAnomalyDeg,
    catalogRecord: definition.catalogRecord ?? null,
    parameterQualification: definition.parameterQualification ??
      "detailed-source-backed-moon",
    periodDays: definition.periodDays,
    visualPeriodSeconds: round(visualPeriodSeconds, 6),
    phaseDegrees: round(phaseDegrees, 6),
    orbitTransform: `transform:${buildPolyMeshTransform({
      rotation: [definition.inclinationDeg, 0, definition.nodeDeg],
    })};animation-duration:${round(visualPeriodSeconds, 6)}s;` +
      `animation-delay:${round(-visualPeriodSeconds * phaseDegrees / 360, 6)}s`,
    bodyTransform: `transform:${buildPolyMeshTransform({
      position: [displayOrbitRadius, 0, 0],
    })}`,
    latitudeSegments: geometry.billboard || geometry.solid
      ? 0
      : MOON_LATITUDE_SEGMENTS,
    longitudeSegments: geometry.billboard || geometry.solid
      ? 0
      : MOON_LONGITUDE_SEGMENTS,
    polarCapLeafCount: geometry.billboard || geometry.solid ? 0 : 2,
    leafCount: leaves.length,
    textureLeafCount: geometry.solid ? 0 : leaves.length,
    solidLeafCount: geometry.solid ? leaves.length : 0,
    billboard,
    label: billboard && !definition.minor
      ? prepareMoonLabel(definition.name, billboard)
      : null,
    shadowLeafCount: shadow ? 1 : 0,
    shadow,
    leaves,
  });
});

const textureLeafCount = preparedMoons.reduce(
  (count, entry) => count + entry.textureLeafCount,
  0,
);
const solidLeafCount = preparedMoons.reduce(
  (count, entry) => count + entry.solidLeafCount,
  0,
);
const shadowLeafCount = preparedMoons.reduce(
  (count, entry) => count + entry.shadowLeafCount,
  0,
);
const detailedPreparedMoons = Object.freeze(preparedMoons);
const minorMoonDots = Object.freeze(MINOR_MOONS.map(
  prepareMinorMoonDot,
));
const animatedMinorMoonCount = 0;
const preparedMoonMotion = Object.freeze({
  schema: "csssaturn-prepared-billboard-moon-motion@1",
  moons: Object.freeze(detailedPreparedMoons.map(({ id, billboard }) =>
    Object.freeze({ id, motion: billboard.motion }))),
});
const output = `// Generated by tools/prepare-moons.mjs. Do not edit by hand.\n` +
  `export const PREPARED_SATURN_MOONS = ${JSON.stringify(Object.freeze({
    schema: "csssaturn-prepared-low-poly-moons@4",
    sourceAuthority: {
      physicalParameters: "JPL-satellite-mean-elements-snapshot",
      meanElementsEpoch: "2000-01-01.5-TDB",
      confirmedMoonCount: moonCatalog.counts.confirmed,
      catalogRetrievedAt: moonCatalog.retrievedAt,
      catalogSources: moonCatalog.sources,
      textureAuthority: "OpenSpace-synchronized-resources",
      titanTextureAuthority: "USGS-NASA-PDS-Cassini-ISS",
    },
    presentation: {
      model:
        "prepared-billboard-moons-on-mean-circular-orbits",
      sharedPhysicalToVisualTimeScale: round(PRESENTATION_TIME_SCALE, 6),
      radiusScale: MOON_RADIUS_PRESENTATION_SCALE,
      radiusScaleOverrides: MOON_RADIUS_PRESENTATION_SCALE_OVERRIDES,
      orbitDistanceModel: "logarithmic-compression-preserving-source-order",
      orbitDistanceRange: [
        round(presentationOrbitRadius(
          Math.min(...MOONS.map(({ orbitKm }) => orbitKm)),
        ), 6),
        MOON_ORBIT_PRESENTATION_DISTANT_RADIUS,
      ],
      detailedOrbitDistanceRange: [
        MOON_ORBIT_PRESENTATION_INNER_RADIUS,
        MOON_ORBIT_PRESENTATION_OUTER_RADIUS,
      ],
      minorMoonModel:
        "one-dot-leaf-one-prepared-static-epoch-translate",
      minorMoonMarkerRadius: MINOR_MOON_PRESENTATION_RADIUS,
      minorMoonPhysicalPixelFloor: Object.freeze({ dpr1: 2, dpr2: 3 }),
      minorMoonShadows: false,
      minorMoonLabels: false,
      minorMoonPreparedPositionCount: 1,
      minorMoonMaximumSceneScale: MINOR_MOON_MAXIMUM_SCENE_SCALE,
      animatedMinorMoonCount,
      staticEpochMinorMoonCount: minorMoonDots.length -
        animatedMinorMoonCount,
      runtimeStreamMath: false,
      runtimeStreamTransformWritesPerFrame: 0,
      sourceOrbitOrderPreserved: true,
      eccentricityPublishedButNotApplied: true,
      runtimeGeometryPreparation: false,
      runtimeTexturePreparation: false,
      runtimeJavaScriptWritesPerFrame: 0,
      billboardModel:
        "prepared-alpha-planes-readdressed-only-on-camera-input",
      lightingModel:
        "prepared-sun-fixed-alpha-plane-with-compositor-orbit-compensation",
      hyperionLightingQualification:
        "approximate-baked-irregular-solid-pending-chaotic-tumble-model",
    },
    atlas: {
      url: MOON_ATLAS_URL,
      url2x: MOON_ATLAS_2X_URL,
      width: ATLAS_WIDTH,
      height: ATLAS_HEIGHT,
      width2x: ATLAS_WIDTH * 2,
      height2x: ATLAS_HEIGHT * 2,
      tileCount: texturedMoonPlans.length,
      selectedDensityImageCount: 1,
    },
    billboardAtlas: {
      url: MOON_BILLBOARD_ATLAS_URL,
      url2x: MOON_BILLBOARD_ATLAS_2X_URL,
      width: MOON_BILLBOARD_ATLAS_WIDTH,
      height: MOON_BILLBOARD_ATLAS_HEIGHT,
      width2x: MOON_BILLBOARD_ATLAS_WIDTH * 2,
      height2x: MOON_BILLBOARD_ATLAS_HEIGHT * 2,
      tileCount: billboardMoonPlans.length,
      tileSize: MOON_BILLBOARD_CONTENT_SIZE,
      tileGutter: MOON_BILLBOARD_GUTTER,
      selectedDensityImageCount: 1,
      encoding: PREPARED_Q75_WEBP_ENCODING,
    },
    shadowAtlas: {
      model: "prepared-fixed-world-light-view-bank",
      url: MOON_SHADOW_ATLAS_URL,
      url2x: MOON_SHADOW_ATLAS_2X_URL,
      bytes: shadowAtlasAsset.byteLength,
      bytes2x: shadowAtlas2xAsset.byteLength,
      sha256: createHash("sha256").update(shadowAtlasAsset).digest("hex"),
      sha256_2x: createHash("sha256").update(shadowAtlas2xAsset).digest("hex"),
      frameCount: MOON_SHADOW_FRAME_COUNT,
      frameColumns: MOON_SHADOW_FRAME_COLUMNS,
      frameRows: MOON_SHADOW_FRAME_ROWS,
      tileSize: MOON_SHADOW_CONTENT_SIZE,
      frameGutter: MOON_SHADOW_GUTTER,
      frameStride: MOON_SHADOW_FRAME_STRIDE,
      width: shadowRuntimeAtlas.width,
      height: shadowRuntimeAtlas.height,
      width2x: shadowRuntimeAtlas2x.width,
      height2x: shadowRuntimeAtlas2x.height,
      logicalWidth: MOON_SHADOW_ATLAS_WIDTH,
      logicalHeight: MOON_SHADOW_ATLAS_HEIGHT,
      textureCropBounds: shadowAtlasCrop.bounds,
      textureTransparentGutter: MOON_SHADOW_TRANSPARENT_GUTTER,
      minimumScenePitchDegrees: 0,
      maximumScenePitchDegrees: MOON_SHADOW_MAXIMUM_SCENE_PITCH,
      defaultScenePitchDegrees: MOON_SHADOW_DEFAULT_SCENE_PITCH,
      defaultFrame: defaultMoonShadowFrame,
      backgroundPositions: Object.freeze(Array.from(
        { length: MOON_SHADOW_FRAME_COUNT },
        (_, frameIndex) => moonShadowBackgroundPosition(frameIndex),
      )),
      runtimeShards: Object.freeze({
        model: "prepared-canonical-high-density-single-atlas",
        selectedDensity: "canonical-2x",
        alphaExactDecodedCropVerification: true,
        selectiveVisibleRgbEncoding: PREPARED_Q75_WEBP_ENCODING,
        q75AssetUrls: Object.freeze([
          ...PREPARED_Q75_MOON_SHADOW_ASSET_URLS,
        ]),
        defaultPreparedFrame: defaultMoonShadowFrame,
        defaultPreparedRow: defaultMoonShadowRow,
        initialWarmRows: initialMoonShadowRows,
        maximumRetainedAtlasCount: 1,
        runtimeAtlas: Object.freeze({
          assetUrl: shadowRuntimeAtlas.assetUrl,
          asset2xUrl: shadowRuntimeAtlas2x.assetUrl,
          assetBytes: shadowRuntimeAtlas.assetBytes,
          assetBytes2x: shadowRuntimeAtlas2x.assetBytes,
          assetSha256: shadowRuntimeAtlas.assetSha256,
          assetSha2562x: shadowRuntimeAtlas2x.assetSha256,
          width: shadowRuntimeAtlas.width,
          height: shadowRuntimeAtlas.height,
          width2x: shadowRuntimeAtlas2x.width,
          height2x: shadowRuntimeAtlas2x.height,
          decodedRgbaBytes: shadowRuntimeAtlas.decodedRgbaBytes,
          decodedRgbaBytes2x: shadowRuntimeAtlas2x.decodedRgbaBytes,
        }),
        rows: shadowRuntimeRows,
        presentations: moonShadowRuntimePresentations,
        initialDecodedWorkingSetBytes: Object.freeze({
          dpr1: shadowRuntimeAtlas.decodedRgbaBytes,
          dpr2: shadowRuntimeAtlas2x.decodedRgbaBytes,
        }),
        maximumDecodedWorkingSetBytes: Object.freeze({
          dpr1: shadowRuntimeAtlas.decodedRgbaBytes,
          dpr2: shadowRuntimeAtlas2x.decodedRgbaBytes,
        }),
        fullAtlasDecodedRgbaBytes: Object.freeze({
          dpr1: shadowAtlasCrop.bounds.width *
            shadowAtlasCrop.bounds.height * 4,
          dpr2: shadowAtlasCrop.bounds2x.width *
            shadowAtlasCrop.bounds2x.height * 4,
        }),
        exactVisibleDecodedCropVerification: true,
        runtimeDecodePolicy: "one-selected-density-atlas-decoded-before-input",
      }),
      alphaModel: `black-overlay-linear-light-gamma-${MOON_SHADOW_GAMMA}`,
      supersampling: MOON_SHADOW_SUPERSAMPLING,
      runtimeRasterization: false,
      runtimePlaybackWritesPerFrame: 0,
      runtimeInputAddressWrites: "one-per-retained-moon-shadow-leaf",
    },
    moons: detailedPreparedMoons,
    minorMoonDots,
    counts: {
      confirmedMoonCount: detailedPreparedMoons.length +
        minorMoonDots.length,
      preparedMoonCount: detailedPreparedMoons.length +
        minorMoonDots.length,
      detailedMoonCount: detailedPreparedMoons.length,
      minorMoonCount: minorMoonDots.length,
      moonCount: detailedPreparedMoons.length + minorMoonDots.length,
      moonLeafCount: textureLeafCount + solidLeafCount + shadowLeafCount +
        minorMoonDots.length,
      moonSurfaceLeafCount: textureLeafCount + solidLeafCount +
        minorMoonDots.length,
      moonTextureLeafCount: textureLeafCount + shadowLeafCount,
      moonSolidLeafCount: solidLeafCount,
      moonDotLeafCount: minorMoonDots.length,
      moonShadowLeafCount: shadowLeafCount,
      moonLabelCount: detailedPreparedMoons.filter(({ label }) => label).length,
      moonTransformGroupCount: detailedPreparedMoons.length * 3,
      moonAnimationCount: detailedPreparedMoons.length +
        animatedMinorMoonCount,
    },
  }))};\n`;
const motionOutput =
  `// Generated by tools/prepare-moons.mjs. Do not edit by hand.\n` +
  `export const PREPARED_SATURN_MOON_MOTION = ` +
  `${JSON.stringify(preparedMoonMotion)};\n`;
await Promise.all([
  writeFile(outputModulePath, output),
  writeFile(motionModulePath, motionOutput),
]);
console.log(`wrote ${outputModulePath} (${Buffer.byteLength(output)} bytes)`);
console.log(
  `wrote ${motionModulePath} (${Buffer.byteLength(motionOutput)} bytes)`,
);
console.log(`wrote ${atlasPath} and ${atlas2xPath}`);

async function prepareSourceRaster(definition) {
  const { data, info } = await sharp(resolve(sourceRoot, definition.source))
    .rotate()
    .resize(1024, 512, { fit: "fill" })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Object.freeze({ data, width: info.width, height: info.height, channels: 4 });
}

function createUvSphereMoonPolygons(
  definition,
  surfaceOverlap = MOON_SURFACE_OVERLAP,
) {
  const radiusPresentationScale = moonRadiusPresentationScale(definition);
  const radii = definition.radiiKm.map((radiusKm) =>
    physicalToDisplay(radiusKm) * radiusPresentationScale);
  const polygons = [];
  const latitudeStep = Math.PI / MOON_LATITUDE_SEGMENTS;
  const longitudeStep = Math.PI * 2 / MOON_LONGITUDE_SEGMENTS;
  for (
    let latitudeIndex = 0;
    latitudeIndex < MOON_LATITUDE_SEGMENTS;
    latitudeIndex += 1
  ) {
    if (
      latitudeIndex === 0 ||
      latitudeIndex === MOON_LATITUDE_SEGMENTS - 1
    ) {
      polygons.push(createMoonPolarCapPolygon(
        latitudeIndex === 0 ? "south" : "north",
        radii,
      ));
      continue;
    }
    const v0 = latitudeIndex / MOON_LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / MOON_LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (
      let longitudeIndex = 0;
      longitudeIndex < MOON_LONGITUDE_SEGMENTS;
      longitudeIndex += 1
    ) {
      const u0 = longitudeIndex / MOON_LONGITUDE_SEGMENTS;
      const u1 = (longitudeIndex + 1) / MOON_LONGITUDE_SEGMENTS;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = u1 * Math.PI * 2;
      const latitudeOverlap = latitudeStep * surfaceOverlap;
      const longitudeOverlap = longitudeStep * surfaceOverlap;
      polygons.push(texturePolygon(
        [
          moonSpherePoint(
            latitude0 - latitudeOverlap,
            longitude0 - longitudeOverlap,
            radii,
          ),
          moonSpherePoint(
            latitude0 - latitudeOverlap,
            longitude1 + longitudeOverlap,
            radii,
          ),
          moonSpherePoint(
            latitude1 + latitudeOverlap,
            longitude1 + longitudeOverlap,
            radii,
          ),
          moonSpherePoint(
            latitude1 + latitudeOverlap,
            longitude0 - longitudeOverlap,
            radii,
          ),
        ],
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        Object.freeze({ u0, u1, v0, v1 }),
      ));
    }
  }
  return polygons;
}

function moonSpherePoint(latitude, longitude, radii) {
  const latitudeRadius = Math.cos(latitude);
  return [
    radii[0] * latitudeRadius * Math.cos(longitude),
    radii[1] * latitudeRadius * Math.sin(longitude),
    radii[2] * Math.sin(latitude),
  ];
}

function createMoonPolarCapPolygon(pole, radii) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 -
    Math.PI / MOON_LATITUDE_SEGMENTS;
  const radiusX = radii[0] * Math.cos(boundaryLatitude) *
    MOON_POLAR_SURFACE_OVERLAP;
  const radiusY = radii[1] * Math.cos(boundaryLatitude) *
    MOON_POLAR_SURFACE_OVERLAP;
  const z = sign * (
    radii[2] * Math.sin(boundaryLatitude) + radii[2] * 0.001
  );
  const vertices = north
    ? [[-radiusX, -radiusY, z], [radiusX, -radiusY, z],
      [radiusX, radiusY, z], [-radiusX, radiusY, z]]
    : [[-radiusX, radiusY, z], [radiusX, radiusY, z],
      [radiusX, -radiusY, z], [-radiusX, -radiusY, z]];
  const uvs = north
    ? [[0, 0], [1, 0], [1, 1], [0, 1]]
    : [[0, 1], [1, 1], [1, 0], [0, 0]];
  return {
    ...texturePolygon(vertices, uvs, Object.freeze({
      u0: 0,
      u1: 1,
      v0: north ? 0 : 1 - 1 / MOON_LATITUDE_SEGMENTS,
      v1: north ? 1 / MOON_LATITUDE_SEGMENTS : 1,
    })),
    polarCap: pole,
    polarBoundaryLatitude: boundaryLatitude,
    radii,
  };
}

function texturePolygon(vertices, uvs, sourceUv) {
  return {
    vertices,
    uvs,
    sourceUv,
    texture: MOON_ATLAS_URL,
    color: "#ffffff",
  };
}

function createSolidHyperionPolygons(definition) {
  const radiusPresentationScale = moonRadiusPresentationScale(definition);
  const radii = definition.radiiKm.map((radiusKm) =>
    physicalToDisplay(radiusKm) * radiusPresentationScale);
  return spherePolygons({
    radius: 1,
    subdivisions: 0,
    color: definition.solidColor,
  }).map((polygon) => ({
    ...polygon,
    vertices: polygon.vertices.map(([x, y, z]) =>
      [x * radii[0], y * radii[1], z * radii[2]]),
  }));
}

function preparedAtlasDimensions(width, height) {
  return (width === 64 ? "" :
    `;--polycss-atlas-width:${formatCssLength(width)}`) +
    (height === 64 ? "" :
      `;--polycss-atlas-height:${formatCssLength(height)}`);
}

function prepareTextureLeaves(geometry) {
  return geometry.faces.map(({ polygon, faceIndex, tileIndex }) => {
    if (polygon.vertices.length !== 4) {
      throw new Error(
        `${geometry.definition.name} textured face ${faceIndex} is not a quad.`,
      );
    }
    const projection = "projective";
    const column = tileIndex % ATLAS_COLUMNS;
    const row = Math.floor(tileIndex / ATLAS_COLUMNS);
    const sourceRect = {
      x: column * ATLAS_CELL_SIZE + ATLAS_GUTTER,
      y: row * ATLAS_CELL_SIZE + ATLAS_GUTTER,
      width: ATLAS_CONTENT_SIZE,
      height: ATLAS_CONTENT_SIZE,
    };
    const preparedPolygon = {
      ...polygon,
      textureImageSource: {
        url: MOON_ATLAS_URL,
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
        sourceRect,
      },
      texturePresentation: {
        backend: "image",
        lighting: "source",
        projection,
      },
    };
    const plan = computeTextureAtlasPlanPublic(preparedPolygon, faceIndex, {
      ...PLAN_OPTIONS,
      seamEdges: geometry.seamEdges.get(faceIndex),
    });
    const leaf = plan && resolvePolyTextureLeafGeometry(plan, {
      backend: "image",
      lighting: "source",
      projection,
    });
    if (!leaf) {
      throw new Error(`${geometry.definition.name} face ${faceIndex} did not prepare.`);
    }
    const positionX = leaf.backgroundPosition[0] === 0
      ? "0px"
      : formatCssLength(leaf.backgroundPosition[0]);
    const positionY = leaf.backgroundPosition[1] === 0
      ? "0px"
      : formatCssLength(leaf.backgroundPosition[1]);
    return Object.freeze({
      tag: "s",
      style: `transform:matrix3d(${leaf.matrix})` +
        preparedAtlasDimensions(leaf.leafWidth, leaf.leafHeight) +
        `;background-image:url("${MOON_ATLAS_2X_URL}")` +
        `;background-position:${positionX} ${positionY}` +
        `;background-size:${formatCssLength(leaf.backgroundSize[0])} ` +
          formatCssLength(leaf.backgroundSize[1]),
    });
  });
}

function prepareMoonBillboardProjection(
  definition,
  visualPeriodSeconds,
  phaseDegrees,
  displayOrbitRadius,
) {
  const radiusPresentationScale = moonRadiusPresentationScale(definition);
  const radii = definition.presentationRadii ?? definition.radiiKm.map(
    (radiusKm) => physicalToDisplay(radiusKm) * radiusPresentationScale,
  );
  return Object.freeze({
    motion: prepareMoonCompositeMotion(
      definition,
      displayOrbitRadius,
      visualPeriodSeconds,
      phaseDegrees,
    ),
    radii,
    coverageScale: 1.002,
    textureSize: MOON_BILLBOARD_CONTENT_SIZE,
    depthBias: 0,
    presentationNodeDegrees: MOON_SHADOW_PRESENTATION_NODE,
    tileSize: TILE_SIZE,
  });
}

function prepareMoonCompositeMotion(
  definition,
  displayOrbitRadius,
  visualPeriodSeconds,
  phaseDegrees,
) {
  const orbitPlane = buildPolyMeshTransform({
    rotation: [definition.inclinationDeg, 0, definition.nodeDeg],
  }) ?? "";
  const orbitPosition = buildPolyMeshTransform({
    position: [displayOrbitRadius, 0, 0],
  });
  const facingPlane =
    `rotateZ(${round(definition.nodeDeg, 6)}deg) ` +
    `rotateY(${round(definition.inclinationDeg, 6)}deg)`;
  const durationSeconds = round(visualPeriodSeconds, 6);
  const delaySeconds = round(
    -visualPeriodSeconds * phaseDegrees / 360,
    6,
  );
  return Object.freeze({
    model: "prepared-orbit-translation-and-counter-rotation",
    keyframes: Object.freeze([
      Object.freeze({
        transform:
          `rotateZ(0deg) ${orbitPlane} ${orbitPosition} ` +
          `rotateZ(0deg) ${facingPlane}`,
      }),
      Object.freeze({
        transform:
          `rotateZ(-360deg) ${orbitPlane} ${orbitPosition} ` +
          `rotateZ(360deg) ${facingPlane}`,
      }),
    ]),
    durationMilliseconds: durationSeconds * 1_000,
    delayMilliseconds: delaySeconds * 1_000,
  });
}

function prepareMoonCounterTransform(
  definition,
  visualPeriodSeconds,
  phaseDegrees,
) {
  return `--moon-orbit-inclination:${round(definition.inclinationDeg, 6)}deg;` +
    `--moon-orbit-node:${round(definition.nodeDeg, 6)}deg;` +
    `animation-duration:${round(visualPeriodSeconds, 6)}s;` +
    `animation-delay:${round(-visualPeriodSeconds * phaseDegrees / 360, 6)}s`;
}

function prepareMoonBillboardLeaf(
  geometry,
  projection,
) {
  const matrix = prepareMoonShadowPlaneMatrix({
    radii: projection.radii,
    scenePitchDegrees: MOON_SHADOW_DEFAULT_SCENE_PITCH,
    systemObliquityDegrees: MOON_SHADOW_SYSTEM_OBLIQUITY,
    coverageScale: projection.coverageScale,
    textureSize: projection.textureSize,
    depthBias: projection.depthBias,
  });
  const column = geometry.tileIndex % MOON_BILLBOARD_COLUMNS;
  const row = Math.floor(geometry.tileIndex / MOON_BILLBOARD_COLUMNS);
  const positionX = -(column * MOON_BILLBOARD_STRIDE + MOON_BILLBOARD_GUTTER);
  const positionY = -(row * MOON_BILLBOARD_STRIDE + MOON_BILLBOARD_GUTTER);
  return Object.freeze({
    tag: "s",
    style: `transform:matrix3d(${matrix.join(",")})` +
      preparedAtlasDimensions(
        MOON_BILLBOARD_CONTENT_SIZE,
        MOON_BILLBOARD_CONTENT_SIZE,
      ) +
      `;background-image:url("${MOON_BILLBOARD_ATLAS_2X_URL}")` +
      `;background-position:${positionX}px ${positionY}px` +
      `;background-size:${MOON_BILLBOARD_ATLAS_WIDTH}px ` +
        `${MOON_BILLBOARD_ATLAS_HEIGHT}px` +
      ";backface-visibility:visible",
  });
}

function prepareMoonLabel(name, projection) {
  const matrix = prepareMoonLabelPlaneMatrix({
    projection,
    scenePitchDegrees: MOON_SHADOW_DEFAULT_SCENE_PITCH,
    systemObliquityDegrees: MOON_SHADOW_SYSTEM_OBLIQUITY,
    sceneScale: MOON_LABEL_DEFAULT_SCENE_SCALE,
  });
  return Object.freeze({
    text: name,
    style: `transform:matrix3d(${matrix.join(",")})`,
  });
}

function prepareSolidLeaves(geometry) {
  const seamEdges = buildSeamBleedPolygonEdges(geometry.faces, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
  });
  return geometry.faces.map((polygon, index) => {
    const plan = computeSolidTrianglePlan(polygon, index, {
      ...PLAN_OPTIONS,
      seamBleed: 0.6,
      seamEdges: seamEdges.get(index),
    });
    if (!plan) throw new Error(`Hyperion face ${index} did not prepare.`);
    return Object.freeze({ tag: "u", style: plan.styleText });
  });
}

function prepareMoonShadow(definition, visualPeriodSeconds, phaseDegrees) {
  const radiusPresentationScale = moonRadiusPresentationScale(definition);
  const radii = definition.radiiKm.map((radiusKm) =>
    physicalToDisplay(radiusKm) * radiusPresentationScale);
  const matrix = prepareMoonShadowPlaneMatrix({
    radii,
    scenePitchDegrees: MOON_SHADOW_DEFAULT_SCENE_PITCH,
    systemObliquityDegrees: MOON_SHADOW_SYSTEM_OBLIQUITY,
  });
  return Object.freeze({
    model: "prepared-fixed-world-light-retained-alpha-plane",
    counterTransform: prepareMoonCounterTransform(
      definition,
      visualPeriodSeconds,
      phaseDegrees,
    ),
    projection: Object.freeze({
      radii,
      coverageScale: MOON_SHADOW_COVERAGE_SCALE,
      textureSize: MOON_SHADOW_CONTENT_SIZE,
      depthBias: MOON_SHADOW_DEPTH_BIAS,
      presentationNodeDegrees: MOON_SHADOW_PRESENTATION_NODE,
      tileSize: TILE_SIZE,
    }),
    leaf: Object.freeze({
      tag: "s",
      style: `transform:matrix3d(${matrix.join(",")})` +
        `;--polycss-atlas-width:${MOON_SHADOW_CONTENT_SIZE}px` +
        `;--polycss-atlas-height:${MOON_SHADOW_CONTENT_SIZE}px` +
        `;background-image:url("${MOON_SHADOW_ATLAS_2X_URL}")` +
        `;background-position:${moonShadowBackgroundPosition(
          defaultMoonShadowFrame,
        )}` +
        `;background-size:${MOON_SHADOW_ATLAS_WIDTH}px ` +
          `${MOON_SHADOW_ATLAS_HEIGHT}px` +
        ";backface-visibility:visible",
    }),
  });
}

async function writeAtlas(outputPath, density) {
  const contentSize = ATLAS_CONTENT_SIZE * density;
  const gutter = ATLAS_GUTTER * density;
  const cellSize = ATLAS_CELL_SIZE * density;
  const width = ATLAS_WIDTH * density;
  const height = ATLAS_HEIGHT * density;
  const output = Buffer.alloc(width * height * 4);
  for (const plan of texturedMoonPlans) {
    const tile = renderAtlasTile(plan, contentSize, gutter);
    const column = plan.tileIndex % ATLAS_COLUMNS;
    const row = Math.floor(plan.tileIndex / ATLAS_COLUMNS);
    blitRgba(tile, cellSize, cellSize, output, width,
      column * cellSize, row * cellSize);
  }
  await sharp(output, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

async function writeMoonBillboardAtlas(outputPath, density) {
  const stride = MOON_BILLBOARD_STRIDE * density;
  const width = MOON_BILLBOARD_ATLAS_WIDTH * density;
  const height = MOON_BILLBOARD_ATLAS_HEIGHT * density;
  const output = Buffer.alloc(width * height * 4);
  for (const plan of billboardMoonPlans) {
    const tile = renderMoonBillboardTile(plan, density);
    const column = plan.tileIndex % MOON_BILLBOARD_COLUMNS;
    const row = Math.floor(plan.tileIndex / MOON_BILLBOARD_COLUMNS);
    blitRgba(
      tile,
      stride,
      stride,
      output,
      width,
      column * stride,
      row * stride,
    );
  }
  await sharp(output, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

function renderMoonBillboardTile({ definition, source }, density) {
  const contentSize = MOON_BILLBOARD_CONTENT_SIZE * density;
  const gutter = MOON_BILLBOARD_GUTTER * density;
  const stride = MOON_BILLBOARD_STRIDE * density;
  const output = Buffer.alloc(stride * stride * 4);
  const sampleCount = MOON_BILLBOARD_SUPERSAMPLING ** 2;
  const { right, down, view } = prepareMoonScreenBasis(
    MOON_SHADOW_DEFAULT_SCENE_PITCH,
    MOON_SHADOW_SYSTEM_OBLIQUITY,
  );
  const solid = source === null ? parseHexColor(definition.solidColor) : null;
  for (let row = 0; row < contentSize; row += 1) {
    for (let column = 0; column < contentSize; column += 1) {
      const premultiplied = [0, 0, 0];
      let coverage = 0;
      for (let sampleY = 0;
        sampleY < MOON_BILLBOARD_SUPERSAMPLING;
        sampleY += 1) {
        for (let sampleX = 0;
          sampleX < MOON_BILLBOARD_SUPERSAMPLING;
          sampleX += 1) {
          const x = (
            column + (sampleX + 0.5) / MOON_BILLBOARD_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const y = (
            row + (sampleY + 0.5) / MOON_BILLBOARD_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const radiusSquared = x * x + y * y;
          if (radiusSquared > 1) continue;
          const z = Math.sqrt(Math.max(0, 1 - radiusSquared));
          const normal = normalizeVector([0, 1, 2].map((axis) =>
            right[axis] * x + down[axis] * y + view[axis] * z));
          if (source) {
            const u = normalizeUnit(
              Math.atan2(normal[1], normal[0]) / (Math.PI * 2),
            );
            const v = clamp(
              (Math.asin(clamp(normal[2], -1, 1)) + Math.PI / 2) / Math.PI,
              0,
              1,
            );
            const sourceOffset = sourcePixelOffset(source, u, v);
            for (let channel = 0; channel < 3; channel += 1) {
              premultiplied[channel] += applyLinearFactor(
                source.data[sourceOffset + channel],
                definition.tint[channel],
              );
            }
          } else {
            const light = 0.62 + 0.38 * Math.max(0, z);
            for (let channel = 0; channel < 3; channel += 1) {
              premultiplied[channel] += solid[channel] * light;
            }
          }
          coverage += 1;
        }
      }
      if (coverage === 0) continue;
      const outputOffset = (
        (row + gutter) * stride + column + gutter
      ) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = Math.round(
          premultiplied[channel] / coverage,
        );
      }
      output[outputOffset + 3] = Math.round(coverage / sampleCount * 255);
    }
  }
  return output;
}

function renderMoonShadowAtlas(density) {
  const contentSize = MOON_SHADOW_CONTENT_SIZE * density;
  const gutter = MOON_SHADOW_GUTTER * density;
  const stride = MOON_SHADOW_FRAME_STRIDE * density;
  const width = MOON_SHADOW_ATLAS_WIDTH * density;
  const height = MOON_SHADOW_ATLAS_HEIGHT * density;
  const output = Buffer.alloc(width * height * 4);
  for (let frameIndex = 0;
    frameIndex < MOON_SHADOW_FRAME_COUNT;
    frameIndex += 1) {
    const amount = frameIndex / (MOON_SHADOW_FRAME_COUNT - 1);
    const scenePitchDegrees = MOON_SHADOW_MAXIMUM_SCENE_PITCH * (1 - amount);
    const systemObliquityDegrees = MOON_SHADOW_SYSTEM_OBLIQUITY *
      scenePitchDegrees / MOON_SHADOW_DEFAULT_SCENE_PITCH;
    const frame = renderMoonShadowFrame({
      contentSize,
      scenePitchDegrees,
      systemObliquityDegrees,
    });
    const column = frameIndex % MOON_SHADOW_FRAME_COLUMNS;
    const row = Math.floor(frameIndex / MOON_SHADOW_FRAME_COLUMNS);
    const frameX = column * stride + gutter;
    const frameY = row * stride + gutter;
    blitRgba(frame, contentSize, contentSize, output, width, frameX, frameY);
  }
  return output;
}

function writeRgbaWebp(outputPath, rgba, width, height) {
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(outputPath);
}

async function writeVerifiedMoonShadowRow({
  density,
  rowIndex,
  source,
}) {
  const width = MOON_SHADOW_ATLAS_WIDTH * density;
  const height = MOON_SHADOW_FRAME_STRIDE * density;
  const url = density === 2
    ? moonShadowRow2xUrl(rowIndex)
    : moonShadowRowUrl(rowIndex);
  const path = density === 2
    ? moonShadowRow2xPath(rowIndex)
    : moonShadowRowPath(rowIndex);
  await writeRgbaWebp(path, source, width, height);
  const q75 = PREPARED_Q75_MOON_SHADOW_ASSET_URLS.has(url)
    ? await optimizePreparedQ75Webp(path)
    : null;
  const asset = await readFile(path);
  const { data, info } = await sharp(asset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visibleTexelsMatch = visibleRgbaMatches(data, source);
  const alphaMatchesSource = alphaMatches(data, source);
  if (info.width !== width || info.height !== height || info.channels !== 4 ||
      !alphaMatchesSource || (!q75 && !visibleTexelsMatch)) {
    throw new Error(`Saturn moon shadow row changed texels: ${url}.`);
  }
  return Object.freeze({
    url,
    bytes: asset.byteLength,
    sha256: createHash("sha256").update(asset).digest("hex"),
    width,
    height,
    decodedRgbaBytes: width * height * 4,
    encoding: q75?.encoding === PREPARED_Q75_WEBP_ENCODING
      ? PREPARED_Q75_WEBP_ENCODING
      : "lossless-webp",
    alphaMatchesSource: true,
    visibleTexelsMatchSource: visibleTexelsMatch,
    transparentRgbCanonicalizedByWebp: !data.equals(source),
  });
}

function alphaMatches(candidate, source) {
  for (let offset = 3; offset < source.length; offset += 4) {
    if (candidate[offset] !== source[offset]) return false;
  }
  return true;
}

async function prepareMoonShadowRuntimeRows({ rgba, rgba2x }) {
  const rows = [];
  for (let rowIndex = 0;
    rowIndex < MOON_SHADOW_FRAME_ROWS;
    rowIndex += 1) {
    const bounds = Object.freeze({
      x: 0,
      y: rowIndex * MOON_SHADOW_FRAME_STRIDE,
      width: MOON_SHADOW_ATLAS_WIDTH,
      height: MOON_SHADOW_FRAME_STRIDE,
    });
    const bounds2x = Object.freeze({
      x: 0,
      y: bounds.y * 2,
      width: bounds.width * 2,
      height: bounds.height * 2,
    });
    const [asset, asset2x] = await Promise.all([
      writeVerifiedMoonShadowRow({
        density: 1,
        rowIndex,
        source: extractRgbaBounds({
          rgba,
          width: MOON_SHADOW_ATLAS_WIDTH,
          bounds,
        }),
      }),
      writeVerifiedMoonShadowRow({
        density: 2,
        rowIndex,
        source: extractRgbaBounds({
          rgba: rgba2x,
          width: MOON_SHADOW_ATLAS_WIDTH * 2,
          bounds: bounds2x,
        }),
      }),
    ]);
    rows.push(Object.freeze({
      rowIndex,
      assetUrl: asset.url,
      asset2xUrl: asset2x.url,
      bytes: asset.bytes,
      bytes2x: asset2x.bytes,
      sha256: asset.sha256,
      sha256_2x: asset2x.sha256,
      width: asset.width,
      height: asset.height,
      width2x: asset2x.width,
      height2x: asset2x.height,
      decodedRgbaBytes: asset.decodedRgbaBytes,
      decodedRgbaBytes2x: asset2x.decodedRgbaBytes,
      encoding: Object.freeze({
        dpr1: asset.encoding,
        dpr2: asset2x.encoding,
      }),
      alphaMatchesSource: true,
      visibleTexelsMatchSource: Object.freeze({
        dpr1: asset.visibleTexelsMatchSource,
        dpr2: asset2x.visibleTexelsMatchSource,
      }),
    }));
  }
  return Object.freeze(rows);
}

async function prepareMoonShadowRuntimeAtlas({ density, rows }) {
  const width = MOON_SHADOW_ATLAS_WIDTH * density;
  const height = MOON_SHADOW_ATLAS_HEIGHT * density;
  const rowHeight = MOON_SHADOW_FRAME_STRIDE * density;
  const output = Buffer.alloc(width * height * 4);
  for (const row of rows) {
    const assetUrl = density === 2 ? row.asset2xUrl : row.assetUrl;
    const assetPath = density === 2
      ? moonShadowRow2xPath(row.rowIndex)
      : moonShadowRowPath(row.rowIndex);
    const { data, info } = await sharp(assetPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== width || info.height !== rowHeight ||
        info.channels !== 4) {
      throw new Error(`Saturn moon shadow atlas row is invalid: ${assetUrl}.`);
    }
    blitRgba(
      data,
      width,
      rowHeight,
      output,
      width,
      0,
      row.rowIndex * rowHeight,
    );
  }
  const path = density === 2
    ? shadowRuntimeAtlas2xPath
    : shadowRuntimeAtlasPath;
  const assetUrl = density === 2
    ? MOON_SHADOW_ATLAS_2X_URL
    : MOON_SHADOW_ATLAS_URL;
  await writeRgbaWebp(path, output, width, height);
  const bytes = await readFile(path);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 4 ||
      !alphaMatches(data, output) || !visibleRgbaMatches(data, output)) {
    throw new Error(`Saturn moon shadow runtime atlas changed texels: ${assetUrl}.`);
  }
  return Object.freeze({
    assetUrl,
    assetBytes: bytes.byteLength,
    assetSha256: createHash("sha256").update(bytes).digest("hex"),
    width,
    height,
    decodedRgbaBytes: width * height * 4,
    encoding: "lossless-webp",
    alphaMatchesSource: true,
    visibleTexelsMatchSource: true,
  });
}

function renderMoonShadowFrame({
  contentSize,
  scenePitchDegrees,
  systemObliquityDegrees,
}) {
  const output = Buffer.alloc(contentSize * contentSize * 4);
  const { right, down, view } = prepareMoonScreenBasis(
    scenePitchDegrees,
    systemObliquityDegrees,
  );
  const lightDirection = prepareMoonObjectLightDirection(
    systemObliquityDegrees,
  );
  const sampleCount = MOON_SHADOW_SUPERSAMPLING ** 2;
  for (let row = 0; row < contentSize; row += 1) {
    for (let column = 0; column < contentSize; column += 1) {
      let alpha = 0;
      for (let sampleY = 0;
        sampleY < MOON_SHADOW_SUPERSAMPLING;
        sampleY += 1) {
        for (let sampleX = 0;
          sampleX < MOON_SHADOW_SUPERSAMPLING;
          sampleX += 1) {
          const x = (
            column + (sampleX + 0.5) / MOON_SHADOW_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const y = (
            row + (sampleY + 0.5) / MOON_SHADOW_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const radiusSquared = x * x + y * y;
          if (radiusSquared > 1) continue;
          const z = Math.sqrt(Math.max(0, 1 - radiusSquared));
          const normal = normalizeVector([0, 1, 2].map((axis) =>
            right[axis] * x + down[axis] * y + view[axis] * z));
          const light = moonLightFactor(normal, lightDirection);
          alpha += 1 - Math.pow(light, 1 / MOON_SHADOW_GAMMA);
        }
      }
      if (alpha <= 0) continue;
      const offset = (row * contentSize + column) * 4;
      output[offset + 3] = Math.round(alpha / sampleCount * 255);
    }
  }
  return output;
}

function moonShadowFrameForScenePitch(scenePitchDegrees) {
  const normalizedPitch = (
    MOON_SHADOW_MAXIMUM_SCENE_PITCH - scenePitchDegrees
  ) / MOON_SHADOW_MAXIMUM_SCENE_PITCH;
  return Math.round(clamp(normalizedPitch, 0, 1) *
    (MOON_SHADOW_FRAME_COUNT - 1));
}

function moonShadowBackgroundPosition(
  frameIndex,
  cropBounds = { x: 0, y: 0 },
) {
  const column = frameIndex % MOON_SHADOW_FRAME_COLUMNS;
  const row = Math.floor(frameIndex / MOON_SHADOW_FRAME_COLUMNS);
  return `${cropBounds.x -
    (column * MOON_SHADOW_FRAME_STRIDE + MOON_SHADOW_GUTTER)}px ` +
    `${cropBounds.y -
    (row * MOON_SHADOW_FRAME_STRIDE + MOON_SHADOW_GUTTER)}px`;
}

function prepareMoonShadowPlaneMatrix({
  radii,
  scenePitchDegrees,
  systemObliquityDegrees,
  coverageScale = MOON_SHADOW_COVERAGE_SCALE,
  textureSize = MOON_SHADOW_CONTENT_SIZE,
  depthBias = MOON_SHADOW_DEPTH_BIAS,
}) {
  const { right, down, view } = prepareMoonScreenBasis(
    scenePitchDegrees,
    systemObliquityDegrees,
  );
  const projectedRadius = (direction) => Math.sqrt(
    radii[0] ** 2 * direction[0] ** 2 +
    radii[1] ** 2 * direction[1] ** 2 +
    radii[2] ** 2 * direction[2] ** 2
  );
  const radiusX = projectedRadius(right) * coverageScale;
  const radiusY = projectedRadius(down) * coverageScale;
  const frontDepth = projectedRadius(view) + depthBias;
  const scaleVector = (vector, scale) =>
    vector.map((component) => component * scale);
  const addVectors = (...vectors) => [0, 1, 2].map((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
  const worldToCss = ([x, y, z]) => [
    y * TILE_SIZE,
    x * TILE_SIZE,
    z * TILE_SIZE,
  ];
  const basisX = worldToCss(scaleVector(
    right,
    radiusX * 2 / textureSize,
  ));
  const basisY = worldToCss(scaleVector(
    down,
    radiusY * 2 / textureSize,
  ));
  const basisZ = worldToCss(view);
  const origin = worldToCss(addVectors(
    scaleVector(right, -radiusX),
    scaleVector(down, -radiusY),
    scaleVector(view, frontDepth),
  ));
  return [
    ...basisX, 0,
    ...basisY, 0,
    ...basisZ, 0,
    ...origin, 1,
  ].map((value) => Number(value.toFixed(12)));
}

function prepareMoonLabelPlaneMatrix({
  projection,
  scenePitchDegrees,
  systemObliquityDegrees,
  sceneScale,
}) {
  const { right, down, view } = prepareMoonScreenBasis(
    scenePitchDegrees,
    systemObliquityDegrees,
  );
  const projectedRadius = (direction) => Math.sqrt(
    projection.radii[0] ** 2 * direction[0] ** 2 +
    projection.radii[1] ** 2 * direction[1] ** 2 +
    projection.radii[2] ** 2 * direction[2] ** 2
  );
  const radiusY = projectedRadius(down) * projection.coverageScale;
  const frontDepth = projectedRadius(view) + projection.depthBias;
  const worldUnitsPerCssPixel = 1 / (sceneScale * projection.tileSize);
  const scaleVector = (vector, scale) =>
    vector.map((component) => component * scale);
  const addVectors = (...vectors) => [0, 1, 2].map((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
  const worldToCss = ([x, y, z]) => [
    y * projection.tileSize,
    x * projection.tileSize,
    z * projection.tileSize,
  ];
  const basisX = worldToCss(scaleVector(right, worldUnitsPerCssPixel));
  const basisY = worldToCss(scaleVector(down, worldUnitsPerCssPixel));
  const basisZ = worldToCss(view);
  const origin = worldToCss(addVectors(
    scaleVector(
      right,
      -MOON_LABEL_WIDTH_PX * 0.5 * worldUnitsPerCssPixel,
    ),
    scaleVector(
      down,
      radiusY + MOON_LABEL_GAP_PX * worldUnitsPerCssPixel,
    ),
    scaleVector(view, frontDepth + 0.01),
  ));
  return [
    ...basisX, 0,
    ...basisY, 0,
    ...basisZ, 0,
    ...origin, 1,
  ].map((value) => Number(value.toFixed(12)));
}

function prepareMoonScreenBasis(
  scenePitchDegrees,
  systemObliquityDegrees,
) {
  const screenToObject = (vector) => {
    let result = rotateVectorY(
      vector,
      scenePitchDegrees * Math.PI / 180,
    );
    result = rotateVectorZ(
      result,
      -MOON_SHADOW_PRESENTATION_NODE * Math.PI / 180,
    );
    return rotateVectorX(
      result,
      -systemObliquityDegrees * Math.PI / 180,
    );
  };
  return Object.freeze({
    right: normalizeVector(screenToObject([0, 1, 0])),
    down: normalizeVector(screenToObject([1, 0, 0])),
    view: normalizeVector(screenToObject([0, 0, 1])),
  });
}

function prepareMoonObjectLightDirection(systemObliquityDegrees) {
  let direction = normalizeVector(
    PREPARED_RING_SOURCE.shadowModel.worldLightDirection,
  );
  direction = rotateVectorZ(
    direction,
    -MOON_SHADOW_PRESENTATION_NODE * Math.PI / 180,
  );
  direction = rotateVectorX(
    direction,
    -systemObliquityDegrees * Math.PI / 180,
  );
  return normalizeVector(direction);
}

function renderAtlasTile({ definition, polygon, source }, contentSize, gutter) {
  const cellSize = contentSize + gutter * 2;
  const output = Buffer.alloc(cellSize * cellSize * 4);
  if (polygon.polarCap) {
    renderPolarAtlasTile({
      definition,
      polygon,
      source,
      output,
      contentSize,
      gutter,
      cellSize,
    });
    return output;
  }
  for (let y = 0; y < cellSize; y += 1) {
    const sourceY = clamp(y - gutter, 0, contentSize - 1);
    const v = polygon.sourceUv.v0 +
      (sourceY + 0.5) / contentSize *
      (polygon.sourceUv.v1 - polygon.sourceUv.v0);
    for (let x = 0; x < cellSize; x += 1) {
      const sourceX = clamp(x - gutter, 0, contentSize - 1);
      const u = polygon.sourceUv.u0 +
        (sourceX + 0.5) / contentSize *
        (polygon.sourceUv.u1 - polygon.sourceUv.u0);
      const wrappedU = u - Math.floor(u);
      const sampleX = clamp(
        Math.floor(wrappedU * source.width),
        0,
        source.width - 1,
      );
      const sampleY = clamp(Math.floor(v * source.height), 0, source.height - 1);
      const sourceOffset = (sampleY * source.width + sampleX) * source.channels;
      const outputOffset = (y * cellSize + x) * 4;
      writeTintedPixel(output, outputOffset, source, sourceOffset, definition);
      output[outputOffset + 3] = 255;
    }
  }
  return output;
}

function renderPolarAtlasTile({
  definition,
  polygon,
  source,
  output,
  contentSize,
  gutter,
  cellSize,
}) {
  const sampleCount = MOON_POLAR_SUPERSAMPLING ** 2;
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < cellSize; x += 1) {
      const premultiplied = [0, 0, 0];
      let coverage = 0;
      for (
        let sampleY = 0;
        sampleY < MOON_POLAR_SUPERSAMPLING;
        sampleY += 1
      ) {
        for (
          let sampleX = 0;
          sampleX < MOON_POLAR_SUPERSAMPLING;
          sampleX += 1
        ) {
          const unitX = (
            x - gutter +
            (sampleX + 0.5) / MOON_POLAR_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const unitY = (
            y - gutter +
            (sampleY + 0.5) / MOON_POLAR_SUPERSAMPLING
          ) / contentSize * 2 - 1;
          const radius = Math.hypot(unitX, unitY);
          if (radius > 1) continue;
          const sample = prepareMoonPolarSample(polygon, unitX, unitY, radius);
          const sourceOffset = sourcePixelOffset(source, sample.u, sample.v);
          for (let channel = 0; channel < 3; channel += 1) {
            premultiplied[channel] += applyLinearFactor(
              source.data[sourceOffset + channel],
              definition.tint[channel],
            );
          }
          coverage += 1;
        }
      }
      if (coverage === 0) continue;
      const outputOffset = (y * cellSize + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = Math.round(
          premultiplied[channel] / coverage,
        );
      }
      output[outputOffset + 3] = Math.round(coverage / sampleCount * 255);
    }
  }
}

function prepareMoonPolarSample(polygon, unitX, unitY, radius) {
  const horizontalRadius = Math.min(
    1,
    radius * Math.cos(polygon.polarBoundaryLatitude),
  );
  const latitudeMagnitude = Math.acos(horizontalRadius);
  const latitude = polygon.polarCap === "north"
    ? latitudeMagnitude
    : -latitudeMagnitude;
  let longitude = Math.atan2(unitY, unitX);
  if (longitude < 0) longitude += Math.PI * 2;
  const position = moonSpherePoint(latitude, longitude, polygon.radii);
  const normal = normalizeVector([
    position[0] / polygon.radii[0] ** 2,
    position[1] / polygon.radii[1] ** 2,
    position[2] / polygon.radii[2] ** 2,
  ]);
  return {
    normal,
    u: longitude / (Math.PI * 2),
    v: 0.5 - latitude / Math.PI,
  };
}

function sourcePixelOffset(source, u, v) {
  const wrappedU = u - Math.floor(u);
  const sampleX = clamp(
    Math.floor(wrappedU * source.width),
    0,
    source.width - 1,
  );
  const sampleY = clamp(
    Math.floor(v * source.height),
    0,
    source.height - 1,
  );
  return (sampleY * source.width + sampleX) * source.channels;
}

function moonLightFactor(normal, lightDirection) {
  const lambert = Math.max(0, dot(normal, lightDirection));
  const terminator = smoothstep(0, 0.1, lambert);
  return 0.11 + 0.89 * terminator;
}

function writeTintedPixel(
  output,
  outputOffset,
  source,
  sourceOffset,
  definition,
) {
  for (let channel = 0; channel < 3; channel += 1) {
    output[outputOffset + channel] = applyLinearFactor(
      source.data[sourceOffset + channel],
      definition.tint[channel],
    );
  }
}

function blitRgba(source, sourceWidth, sourceHeight, destination,
  destinationWidth, left, top) {
  for (let y = 0; y < sourceHeight; y += 1) {
    source.copy(
      destination,
      ((top + y) * destinationWidth + left) * 4,
      y * sourceWidth * 4,
      (y + 1) * sourceWidth * 4,
    );
  }
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function dot(left, right) {
  return left.reduce((sum, value, axis) => sum + value * right[axis], 0);
}

function rotateVectorX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateVectorY([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateVectorZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function applyLinearFactor(channel, factor) {
  const srgb = channel / 255;
  const linear = srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
  const lit = clamp(linear * factor, 0, 1);
  const encoded = lit <= 0.0031308
    ? lit * 12.92
    : 1.055 * Math.pow(lit, 1 / 2.4) - 0.055;
  return Math.round(clamp(encoded, 0, 1) * 255);
}

function physicalToDisplay(kilometers) {
  return kilometers * SATURN_DISPLAY_RADIUS / SATURN_EQUATORIAL_RADIUS_KM;
}

function presentationOrbitRadius(kilometers) {
  const minimum = DETAILED_MOONS[0].orbitKm;
  const detailedMaximum = DETAILED_MOONS.at(-1).orbitKm;
  if (kilometers > detailedMaximum) {
    const catalogMaximum = Math.max(...MOONS.map(({ orbitKm }) => orbitKm));
    const progress = (Math.log(kilometers) - Math.log(detailedMaximum)) /
      (Math.log(catalogMaximum) - Math.log(detailedMaximum));
    return MOON_ORBIT_PRESENTATION_OUTER_RADIUS + progress *
      (MOON_ORBIT_PRESENTATION_DISTANT_RADIUS -
        MOON_ORBIT_PRESENTATION_OUTER_RADIUS);
  }
  const progress = (Math.log(kilometers) - Math.log(minimum)) /
    (Math.log(detailedMaximum) - Math.log(minimum));
  return MOON_ORBIT_PRESENTATION_INNER_RADIUS + progress *
    (MOON_ORBIT_PRESENTATION_OUTER_RADIUS - MOON_ORBIT_PRESENTATION_INNER_RADIUS);
}

function moonRadiusPresentationScale(definition) {
  if (definition.minor) return 1;
  return MOON_RADIUS_PRESENTATION_SCALE_OVERRIDES[definition.id] ??
    MOON_RADIUS_PRESENTATION_SCALE;
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 360) % 360;
}

function normalizeUnit(value) {
  return (value % 1 + 1) % 1;
}

function parseHexColor(value) {
  const match = /^#([0-9a-f]{6})$/iu.exec(value);
  if (!match) throw new Error(`Unsupported moon color: ${value}`);
  return [0, 2, 4].map((offset) =>
    Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

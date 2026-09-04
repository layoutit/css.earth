import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  buildPolyCameraSceneTransform,
  buildPolyMeshTransform,
  buildSeamBleedPolygonEdges,
  computeSolidTrianglePlan,
  computeTextureAtlasPlanPublic,
  createPolyCamera,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
  textureTintFactors,
  worldPositionToCss,
} from "@layoutit/polycss";
import {
  PREPARED_MAIN_RING_PLATES,
  PREPARED_RING_GROUPS,
  PREPARED_RING_SOURCE,
} from "../runtime/preparedRingPoints.mjs";
import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE,
  packProjectiveSurfaceRaster,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import {
  extractRgbaBounds,
  visibleRgbaMatches,
} from "./prepare-rgba.mjs";
import {
  optimizePreparedQ75Webp,
  PREPARED_Q75_WEBP_ENCODING,
} from "../../../../tools/prepared-webp.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";
import {
  ensureSaturnPreparationDirectories,
  SATURN_STAGING_ROOT,
} from "./preparation-paths.mjs";

await Promise.all([
  validateSaturnSourceGroup("scene"),
  validateSaturnSourceGroup("interior"),
]);
await ensureSaturnPreparationDirectories();

const DEFAULT_LENS_ID = "normal";
const PROJECTIVE_TEXTURE_RASTER_SCALE = 2;
const MATERIAL_MODES = Object.freeze([
  "full",
  "no-shadows",
  "ringless",
  "ringless-no-shadows",
]);
const materialVariantId = (lensId, mode) =>
  mode === "full" ? lensId : `${lensId}-${mode}`;
const INTERIOR_SOURCE = JSON.parse(await readFile(new URL(
  "../source/interior/manifest.json",
  import.meta.url,
), "utf8"));
const INTERIOR_CUTAWAY = Object.freeze(INTERIOR_SOURCE.cutaway);
let PREPARED_SATURN_MOONS;
let PREPARED_SATURN_LENSES;
let PREPARED_SATURN_VIEWS;

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const INTERIOR_LATITUDE_SEGMENTS = 8;
const INTERIOR_LONGITUDE_SEGMENTS = 16;
const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_POLAR_RADIUS_KM = 54_364;
const F_RING_OUTER_RADIUS_KM = 140_612;
const EQUATORIAL_RADIUS = 230;
const POLAR_RADIUS = EQUATORIAL_RADIUS *
  SATURN_POLAR_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM;
const RING_OUTER_RADIUS = EQUATORIAL_RADIUS *
  F_RING_OUTER_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM;
const PLANET_SURFACE_TEXTURE_URL = "/scenes/saturn/saturn-surface.jpg";
const PLANET_BODY_SURFACE_TEXTURE_URL =
  "/scenes/saturn/saturn-surface-body.jpg";
const PLANET_POLAR_TEXTURE_URL = "/scenes/saturn/saturn-poles.webp";
const PLANET_FIXED_MATERIAL_TEXTURE_URL =
  "/scenes/saturn/saturn-fixed-material.webp";
const PLANET_ORBIT_MATERIAL_TEXTURE_URL =
  "/scenes/saturn/saturn-orbit-material.webp";
const PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL =
  "/scenes/saturn/saturn-orbit-material-default.webp";
const orbitMaterialVariantTextureUrl = (variantId) =>
  variantId === DEFAULT_LENS_ID
    ? PLANET_ORBIT_MATERIAL_TEXTURE_URL
    : `/scenes/saturn/saturn-orbit-material-${variantId}.webp`;
const orbitMaterialVariantTexturePath = (variantId) =>
  publicTexturePath(orbitMaterialVariantTextureUrl(variantId));
const orbitMaterialPreparationPath = (variantId) => resolve(
  SATURN_STAGING_ROOT,
  orbitMaterialVariantTextureUrl(variantId).split("/").at(-1),
);
const INTERIOR_ATMOSPHERE_TEXTURE_URL =
  "/scenes/saturn/saturn-interior-atmosphere.webp";
const interiorMaterialVariantTextureUrl = (variantId) =>
  variantId === DEFAULT_LENS_ID
    ? INTERIOR_ATMOSPHERE_TEXTURE_URL
    : `/scenes/saturn/saturn-interior-atmosphere-${variantId}.webp`;
const interiorMaterialPreparationPath = (variantId) => resolve(
  SATURN_STAGING_ROOT,
  interiorMaterialVariantTextureUrl(variantId).split("/").at(-1),
);
const PLANET_WEATHER_TEXTURE_URL = "/scenes/saturn/saturn-weather.webp";
const RING_TEXTURE_URL = "/scenes/saturn/saturn-rings.webp";
const RING_TEXTURE_2X_URL = "/scenes/saturn/saturn-rings@2x.webp";
const RING_SHADOW_TEXTURE_URL = "/scenes/saturn/saturn-ring-shadow.webp";
const RING_SHADOW_DIRECT_TRANSMISSION =
  PREPARED_RING_SOURCE.shadowModel.saturnOnRings.directTransmission;
const RING_SHADOW_FOOTPRINT_BLUR_SIGMA = 6;
const PLANET_SOURCE_TEXTURE_WIDTH = 2880;
const PLANET_SOURCE_TEXTURE_HEIGHT = 1440;
const CASSINI_POLAR_SOURCE_WIDTH = 2048;
const CASSINI_POLAR_SOURCE_HEIGHT = 1024;
const CASSINI_POLAR_TILE_SIZE = 1024;
const CASSINI_2017_TILE_LEFT = 1024;
const CASSINI_POLAR_CENTER = CASSINI_POLAR_TILE_SIZE / 2;
const CASSINI_POLAR_KM_PER_PIXEL = 25;
const CASSINI_POLAR_BLEND_START = 0.94;
const PLANET_FRAME_WIDTH = 960;
const PLANET_FRAME_HEIGHT = 480;
const PLANET_ROTATION_SECONDS = 72;
const PLANET_LIGHTING_FPS = 30;
const PLANET_LIGHTING_FRAME_COUNT = PLANET_ROTATION_SECONDS * PLANET_LIGHTING_FPS;
const PLANET_SOURCE_CELL_WIDTH = PLANET_SOURCE_TEXTURE_WIDTH / LONGITUDE_SEGMENTS;
const PLANET_SOURCE_CELL_HEIGHT = PLANET_SOURCE_TEXTURE_HEIGHT / LATITUDE_SEGMENTS;
const PLANET_RASTER_CELL_SIZE = 64;
const PLANET_RASTER_SOURCE_WIDTH =
  LONGITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE;
const PLANET_RASTER_SOURCE_HEIGHT =
  LATITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE;
const PLANET_RASTER_GUTTER = PLANET_RASTER_CELL_SIZE / 4;
const PLANET_RASTER_OVERSCAN = 0;
const PLANET_POLAR_TEXTURE_SIZE = 512;
const PLANET_POLAR_TEXTURE_TILE_COUNT = 8;
const PLANET_POLAR_TEXTURE_WIDTH =
  PLANET_POLAR_TEXTURE_SIZE * PLANET_POLAR_TEXTURE_TILE_COUNT;
const PLANET_POLAR_TEXTURE_HEIGHT = PLANET_POLAR_TEXTURE_SIZE;
const PLANET_POLAR_SURFACE_TILE = Object.freeze({ north: 0, south: 1 });
const PLANET_POLAR_MATERIAL_TILE = Object.freeze({ north: 2, south: 3 });
const PLANET_POLAR_INNER_SURFACE_TILE = Object.freeze({ north: 4, south: 5 });
const PLANET_POLAR_INNER_MATERIAL_TILE = Object.freeze({ north: 6, south: 7 });
const PLANET_POLAR_BOUNDARY_LATITUDE = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
const PLANET_POLAR_RADIUS =
  EQUATORIAL_RADIUS * Math.cos(PLANET_POLAR_BOUNDARY_LATITUDE);
const PLANET_POLAR_BOUNDARY_Z =
  POLAR_RADIUS * Math.sin(PLANET_POLAR_BOUNDARY_LATITUDE);
const PLANET_POLAR_PLANE_Z = PLANET_POLAR_BOUNDARY_Z + 0.1;
const PLANET_POLAR_SURFACE_OVERLAP = 1.035;
const PLANET_POLAR_INNER_OVERLAP = 1.05;
const PLANET_POLAR_INNER_INSET = 2.4;
const PLANET_POLAR_MATERIAL_OVERLAP = PLANET_POLAR_SURFACE_OVERLAP;
const PLANET_POLAR_MATERIAL_OFFSET = 0.04;
const PLANET_POLAR_SUPERSAMPLING = 2;
const PLANET_LIGHTING_CELL_WIDTH = 4;
const PLANET_LIGHTING_CELL_HEIGHT = 4;
const SURFACE_OVERLAP = 0.008;
const PLANET_LIGHTING_FRAME_GUTTER = 1;
const PLANET_TEXTURE_FACE_COUNT =
  (LATITUDE_SEGMENTS - 2) * LONGITUDE_SEGMENTS;
const PLANET_LIGHTING_FIELD_WIDTH =
  LONGITUDE_SEGMENTS * PLANET_LIGHTING_CELL_WIDTH;
const PLANET_LIGHTING_FIELD_HEIGHT =
  (LATITUDE_SEGMENTS - 2) * PLANET_LIGHTING_CELL_HEIGHT;
const PLANET_LIGHTING_FRAME_STRIDE_X =
  PLANET_LIGHTING_FIELD_WIDTH + PLANET_LIGHTING_FRAME_GUTTER * 2;
const PLANET_LIGHTING_FRAME_STRIDE_Y =
  PLANET_LIGHTING_FIELD_HEIGHT + PLANET_LIGHTING_FRAME_GUTTER * 2;
const PLANET_LIGHTING_FRAME_COLUMNS = 48;
const PLANET_LIGHTING_FRAME_ROWS = Math.ceil(
  PLANET_LIGHTING_FRAME_COUNT / PLANET_LIGHTING_FRAME_COLUMNS,
);
const PLANET_LIGHTING_TEXTURE_WIDTH =
  PLANET_LIGHTING_FRAME_COLUMNS * PLANET_LIGHTING_FRAME_STRIDE_X;
const PLANET_LIGHTING_TEXTURE_HEIGHT =
  PLANET_LIGHTING_FRAME_ROWS * PLANET_LIGHTING_FRAME_STRIDE_Y;
const PLANET_LIGHTING_PRESENTATION_SCALE_X =
  PLANET_RASTER_CELL_SIZE /
    (PLANET_LIGHTING_CELL_WIDTH * (1 + SURFACE_OVERLAP * 2));
const PLANET_LIGHTING_PRESENTATION_SCALE_Y =
  PLANET_RASTER_CELL_SIZE /
    (PLANET_LIGHTING_CELL_HEIGHT * (1 + SURFACE_OVERLAP * 2));
const PLANET_LIGHTING_PRESENTATION_WIDTH =
  PLANET_LIGHTING_TEXTURE_WIDTH * PLANET_LIGHTING_PRESENTATION_SCALE_X;
const PLANET_LIGHTING_PRESENTATION_HEIGHT =
  PLANET_LIGHTING_TEXTURE_HEIGHT * PLANET_LIGHTING_PRESENTATION_SCALE_Y;
const PLANET_LIGHTING_REFERENCE_CHANNEL = 160;
const PLANET_FIXED_MATERIAL_SIZE = 1024;
const PLANET_ORBIT_MATERIAL_SIZE = 256;
const PLANET_ORBIT_MATERIAL_GUTTER = 2;
const PLANET_ORBIT_MATERIAL_STRIDE =
  PLANET_ORBIT_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const PLANET_ORBIT_MATERIAL_FRAME_COUNT = 256;
const PLANET_ORBIT_MATERIAL_COLUMNS = 16;
const PLANET_ORBIT_MATERIAL_ROWS = 16;
const PLANET_ORBIT_MATERIAL_GRID_WIDTH =
  PLANET_ORBIT_MATERIAL_COLUMNS * PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_GRID_HEIGHT =
  PLANET_ORBIT_MATERIAL_ROWS * PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_DEFAULT_X =
  PLANET_ORBIT_MATERIAL_GRID_WIDTH + PLANET_ORBIT_MATERIAL_GUTTER;
const PLANET_ORBIT_MATERIAL_DEFAULT_Y = PLANET_ORBIT_MATERIAL_GUTTER;
const PLANET_ORBIT_MATERIAL_WIDTH = PLANET_ORBIT_MATERIAL_GRID_WIDTH +
  PLANET_FIXED_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const PLANET_ORBIT_MATERIAL_HEIGHT = PLANET_ORBIT_MATERIAL_GRID_HEIGHT;
const PLANET_ORBIT_MATERIAL_ROW_WIDTH = PLANET_ORBIT_MATERIAL_GRID_WIDTH;
const PLANET_ORBIT_MATERIAL_ROW_HEIGHT = PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE =
  PLANET_FIXED_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const INTERIOR_ATMOSPHERE_SIZE = 256;
const INTERIOR_ATMOSPHERE_GUTTER = 2;
const INTERIOR_ATMOSPHERE_STRIDE =
  INTERIOR_ATMOSPHERE_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const INTERIOR_ATMOSPHERE_FRAME_COUNT = 128;
const INTERIOR_ATMOSPHERE_COLUMNS = 16;
const INTERIOR_ATMOSPHERE_ROWS = 8;
const INTERIOR_ATMOSPHERE_GRID_WIDTH =
  INTERIOR_ATMOSPHERE_COLUMNS * INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_DEFAULT_X =
  INTERIOR_ATMOSPHERE_GRID_WIDTH + INTERIOR_ATMOSPHERE_GUTTER;
const INTERIOR_ATMOSPHERE_DEFAULT_Y = INTERIOR_ATMOSPHERE_GUTTER;
const INTERIOR_ATMOSPHERE_WIDTH = INTERIOR_ATMOSPHERE_GRID_WIDTH +
  PLANET_FIXED_MATERIAL_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const INTERIOR_ATMOSPHERE_HEIGHT =
  INTERIOR_ATMOSPHERE_ROWS * INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_ROW_WIDTH = INTERIOR_ATMOSPHERE_GRID_WIDTH;
const INTERIOR_ATMOSPHERE_ROW_HEIGHT = INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE =
  PLANET_FIXED_MATERIAL_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const PLANET_FIXED_MATERIAL_DEFAULT_RAW_SHA256 =
  "3fdfb71ce5a47cad74872b822876b8de91207d070e9fc2ec4649a02efa8a7aa5";
const PLANET_FIXED_MATERIAL_CONTENT_SCALE = 0.992;
const PLANET_FIXED_MATERIAL_COVERAGE_SCALE = 1.002;
const PLANET_FIXED_MATERIAL_DEPTH_BIAS = 0.5;
const PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING = 4;
const ATMOSPHERE_COLOR = Object.freeze([238, 244, 251]);
const ATMOSPHERE_MAXIMUM_ALPHA = 0.72;
const ATMOSPHERE_LIMB_EXPONENT = 1.75;
const ATMOSPHERE_NIGHT_FLOOR = 0.22;
const WEATHER_CELL_SIZE = 32;
const WEATHER_FRAME_GUTTER = 1;
const WEATHER_FRAME_RATE = 0;
const WEATHER_FRAME_COUNT = 1;
const WEATHER_FRAME_COLUMNS = 1;
const WEATHER_FRAME_ROWS = 1;
const WEATHER_PATCH_COLUMNS = 3;
const WEATHER_VARIANT_COUNT = 3;
const WEATHER_FIELD_COLUMNS = WEATHER_PATCH_COLUMNS * WEATHER_VARIANT_COUNT;
const WEATHER_FIELD_ROWS = 1;
const WEATHER_FIELD_WIDTH = WEATHER_CELL_SIZE * WEATHER_FIELD_COLUMNS;
const WEATHER_FIELD_HEIGHT = WEATHER_CELL_SIZE * WEATHER_FIELD_ROWS;
const WEATHER_OPACITY = 0.5;
const WEATHER_FRAME_STRIDE_X = WEATHER_FIELD_WIDTH + WEATHER_FRAME_GUTTER * 2;
const WEATHER_FRAME_STRIDE_Y = WEATHER_FIELD_HEIGHT + WEATHER_FRAME_GUTTER * 2;
const WEATHER_TEXTURE_WIDTH =
  WEATHER_FRAME_COLUMNS * WEATHER_FRAME_STRIDE_X;
const WEATHER_TEXTURE_HEIGHT =
  WEATHER_FRAME_ROWS * WEATHER_FRAME_STRIDE_Y;
const WEATHER_PRESENTATION_SCALE =
  MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE / WEATHER_CELL_SIZE;
const WEATHER_PRESENTATION_WIDTH =
  WEATHER_TEXTURE_WIDTH * WEATHER_PRESENTATION_SCALE;
const WEATHER_PRESENTATION_HEIGHT =
  WEATHER_TEXTURE_HEIGHT * WEATHER_PRESENTATION_SCALE;
const WEATHER_STORMS = Object.freeze([
  Object.freeze({
    latitudeIndex: 11,
    longitudeStartIndex: 9,
    longitudeCount: WEATHER_PATCH_COLUMNS,
    sourceCenter: Object.freeze([137, 58]),
    sourceRadius: Object.freeze([105, 34]),
    phaseOffsetTurns: 0,
    rotationTurnsPerCycle: 1,
    sourceMotionGain: 1.75,
    armCount: 2,
    armProfileExponent: 3,
    radialFrequency: 13,
    armPhaseRate: 1.4,
    eyeWallRadius: 0.28,
    eyeWallWidth: 0.09,
    brightArmAmplitude: 70,
    brightEyeWallAmplitude: 44,
    bodyLiftAmplitude: 10,
    darkEyeAmplitude: 26,
  }),
  Object.freeze({
    latitudeIndex: 9,
    longitudeStartIndex: 20,
    longitudeCount: WEATHER_PATCH_COLUMNS,
    sourceCenter: Object.freeze([110, 68]),
    sourceRadius: Object.freeze([98, 31]),
    phaseOffsetTurns: 0.37,
    rotationTurnsPerCycle: 1,
    sourceMotionGain: 1.45,
    armCount: 0,
    armProfileExponent: 3,
    radialFrequency: 0,
    armPhaseRate: 0,
    eyeWallRadius: 0.34,
    eyeWallWidth: 0.14,
    brightArmAmplitude: 0,
    brightEyeWallAmplitude: 48,
    bodyLiftAmplitude: 11,
    darkEyeAmplitude: 20,
  }),
  Object.freeze({
    latitudeIndex: 8,
    longitudeStartIndex: 30,
    longitudeCount: WEATHER_PATCH_COLUMNS,
    sourceCenter: Object.freeze([122, 62]),
    sourceRadius: Object.freeze([76, 27]),
    phaseOffsetTurns: 0.68,
    rotationTurnsPerCycle: 1,
    sourceMotionGain: 1.38,
    armCount: 0,
    armProfileExponent: 3,
    radialFrequency: 0,
    armPhaseRate: 0,
    eyeWallRadius: 0.25,
    eyeWallWidth: 0.1,
    brightArmAmplitude: 0,
    brightEyeWallAmplitude: 42,
    bodyLiftAmplitude: 9,
    darkEyeAmplitude: 17,
  }),
]);
const WEATHER_TARGET_FACE_COUNT = WEATHER_STORMS.length * WEATHER_PATCH_COLUMNS;
const WEATHER_TARGET_FACE_INDICES = Object.freeze(WEATHER_STORMS.flatMap(
  (storm) => Array.from(
    { length: storm.longitudeCount },
    (_, offset) => (storm.latitudeIndex - 1) * LONGITUDE_SEGMENTS +
      (storm.longitudeStartIndex + offset) % LONGITUDE_SEGMENTS,
  ),
));
const WEATHER_TARGET_FACE_ORDINALS = Object.freeze(Array.from(
  { length: PLANET_TEXTURE_FACE_COUNT },
  (_, faceIndex) => weatherTargetOrdinal(faceIndex),
));

function weatherTargetOrdinal(faceIndex) {
  const lightingBandIndex = Math.floor(faceIndex / LONGITUDE_SEGMENTS);
  const longitudeIndex = faceIndex % LONGITUDE_SEGMENTS;
  for (let stormIndex = 0; stormIndex < WEATHER_STORMS.length; stormIndex += 1) {
    const storm = WEATHER_STORMS[stormIndex];
    if (lightingBandIndex !== storm.latitudeIndex - 1) continue;
    const stormOffset = (
      longitudeIndex - storm.longitudeStartIndex + LONGITUDE_SEGMENTS
    ) % LONGITUDE_SEGMENTS;
    if (stormOffset < storm.longitudeCount) {
      return stormIndex * WEATHER_PATCH_COLUMNS + stormOffset;
    }
  }
  return -1;
}
const SATURN_REFERENCE_ROTATION_SECONDS = 10 * 3600 + 33 * 60 + 38;
const SATURN_EQUATOR_CLOUD_ROTATION_SECONDS = 10 * 3600 + 15 * 60;
const SATURN_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS = 10 * 3600 + 38 * 60;
const PRESENTATION_TIME_SCALE = SATURN_REFERENCE_ROTATION_SECONDS /
  PLANET_ROTATION_SECONDS;
const SATURN_OBLIQUITY_DEGREES = 26.73;
const SATURN_PRESENTATION_NODE_DEGREES = -60;
const CAMERA_ORBITAL_ELEVATION_DEGREES = 50;
const CAMERA_ZOOM = 1.1;
const CAMERA_ROTATION_X_DEGREES = 90 - CAMERA_ORBITAL_ELEVATION_DEGREES;
const CAMERA_ORBIT_MINIMUM_CONTROL_PITCH_DEGREES = 0;
const CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES = 89;
const CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES = 65;
const MESH_ROTATION_Z = 128;
const BODY_VISIBILITY_FRAME_COUNT = 128;
const BODY_VISIBILITY_RANGE_BANK_COUNT = 8;
const BODY_VISIBILITY_PITCH_SAMPLES_PER_RANGE = 5;
const BODY_VISIBILITY_PHASE_SAMPLES_PER_STATE = 7;
const BODY_VISIBILITY_PERSPECTIVE_PX = 1_000_000;
const POINT_LOCAL_SCALE = 50 / CAMERA_ZOOM;
const RING_POINT_SOURCE_OPACITY_RANGE = Object.freeze([0.48, 0.76]);
const RING_POINT_PRESENTATION_OPACITY_RANGE = Object.freeze([0.82, 1]);
const TILE_SIZE = 50;
const SEAM_BLEED = 0.15;
const PLANET_SEAM_BLEED = 0;
const SOLAR_EFFECTIVE_TEMPERATURE_KELVIN = 5772;
const SATURN_SOLAR_ALBEDO_MULTIPLIER = "#fff1ea";
const OPENSPACE_GLOBE_AMBIENT_INTENSITY = 0.05;
const OPENSPACE_GLOBE_OREN_NAYAR_ROUGHNESS = 0;
const OPENSPACE_GLOBE_TERMINATOR_SMOOTHSTEP = Object.freeze([0, 0.1]);
const LIGHTING = Object.freeze({
  directionalLight: Object.freeze({
    direction: PREPARED_RING_SOURCE.shadowModel.worldLightDirection,
    color: SATURN_SOLAR_ALBEDO_MULTIPLIER,
    intensity: Math.PI,
  }),
  ambientLight: Object.freeze({
    color: SATURN_SOLAR_ALBEDO_MULTIPLIER,
    intensity: OPENSPACE_GLOBE_AMBIENT_INTENSITY * Math.PI,
  }),
});
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: SEAM_BLEED,
  ...LIGHTING,
});
const OUTPUT_URL = new URL("../runtime/preparedScene.mjs", import.meta.url);
const RUNTIME_OUTPUT_URL = new URL(
  "../runtime/preparedSceneRuntime.mjs",
  import.meta.url,
);
const PLANET_SOURCE_TEXTURE_PATH = fileURLToPath(
  new URL("../source/saturn-surface-original.jpg", import.meta.url));
const CASSINI_POLAR_SOURCE_PATH = fileURLToPath(
  new URL("../source/cassini-pia21611.jpg", import.meta.url));
const PLANET_SURFACE_TEXTURE_PATH = resolve(
  SATURN_STAGING_ROOT,
  "saturn-surface.jpg",
);
const PLANET_BODY_SURFACE_TEXTURE_PATH = fileURLToPath(new URL(
  "../../../../public/scenes/saturn/saturn-surface-body.jpg",
  import.meta.url,
));
const PLANET_POLAR_TEXTURE_PATH = fileURLToPath(
  new URL("../../../../public/scenes/saturn/saturn-poles.webp", import.meta.url));
const PLANET_FIXED_MATERIAL_TEXTURE_PATH = resolve(
  SATURN_STAGING_ROOT,
  "saturn-fixed-material.webp",
);
const PLANET_FIXED_MATERIAL_SOURCE_PATH = fileURLToPath(new URL(
  "../source/approved/saturn-fixed-material.webp",
  import.meta.url,
));
const PLANET_ORBIT_MATERIAL_TEXTURE_PATH = resolve(
  SATURN_STAGING_ROOT,
  "saturn-orbit-material.webp",
);
const orbitMaterialRowTextureUrl = (rowIndex) =>
  `/scenes/saturn/saturn-orbit-material-row-${String(rowIndex).padStart(2, "0")}.webp`;
const orbitMaterialVariantDefaultTextureUrl = (variantId) =>
  variantId === DEFAULT_LENS_ID
    ? PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL
    : `/scenes/saturn/saturn-orbit-material-${variantId}-default.webp`;
const orbitMaterialVariantDefaultTexturePath = (variantId) =>
  publicTexturePath(orbitMaterialVariantDefaultTextureUrl(variantId));
const orbitMaterialVariantRowTextureUrl = (variantId, rowIndex) =>
  variantId === DEFAULT_LENS_ID
    ? orbitMaterialRowTextureUrl(rowIndex)
    : `/scenes/saturn/saturn-orbit-material-${variantId}-row-${
      String(rowIndex).padStart(2, "0")}.webp`;
const orbitMaterialVariantRowTexturePath = (variantId, rowIndex) =>
  publicTexturePath(orbitMaterialVariantRowTextureUrl(variantId, rowIndex));
const PREPARED_Q75_ORBIT_ASSET_URLS = new Set([
  PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL,
  ...[5, 6, 7].map(orbitMaterialRowTextureUrl),
]);
const INTERIOR_ATMOSPHERE_TEXTURE_PATH = resolve(
  SATURN_STAGING_ROOT,
  "saturn-interior-atmosphere.webp",
);
const interiorAtmosphereShardTextureUrl = (assetUrl, suffix) =>
  assetUrl.replace(/\.webp$/, `-${suffix}.webp`);
const interiorAtmosphereShardTexturePath = (assetUrl, suffix) =>
  publicTexturePath(interiorAtmosphereShardTextureUrl(assetUrl, suffix));
const PLANET_WEATHER_TEXTURE_PATH = fileURLToPath(
  new URL("../../../../public/scenes/saturn/saturn-weather.webp", import.meta.url));
const PLANET_WEATHER_SOURCE_PATH = fileURLToPath(
  new URL("../source/saturn-weather-static.webp", import.meta.url));
const RING_TEXTURE_PATH = fileURLToPath(
  new URL("../../../../public/scenes/saturn/saturn-rings.webp", import.meta.url));

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    EQUATORIAL_RADIUS * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * Math.sin(latitude),
  ];
}

function createPolarCapPolygon(pole, role = "surface") {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const isInner = role.startsWith("inner");
  const isMaterial = role.endsWith("material");
  const radius = PLANET_POLAR_RADIUS * (
    isInner
      ? PLANET_POLAR_INNER_OVERLAP
      : isMaterial
        ? PLANET_POLAR_MATERIAL_OVERLAP
        : PLANET_POLAR_SURFACE_OVERLAP
  );
  const planeOffset = (isInner ? -PLANET_POLAR_INNER_INSET : 0) +
    (isMaterial ? PLANET_POLAR_MATERIAL_OFFSET : 0);
  const z = sign * (PLANET_POLAR_PLANE_Z + planeOffset);
  const vertices = north
    ? [[-radius, -radius, z], [radius, -radius, z],
      [radius, radius, z], [-radius, radius, z]]
    : [[-radius, radius, z], [radius, radius, z],
      [radius, -radius, z], [-radius, -radius, z]];
  const uvs = north
    ? [[0, 0], [1, 0], [1, 1], [0, 1]]
    : [[0, 1], [1, 1], [1, 0], [0, 0]];
  const tile = isInner
    ? isMaterial
      ? PLANET_POLAR_INNER_MATERIAL_TILE[pole]
      : PLANET_POLAR_INNER_SURFACE_TILE[pole]
    : isMaterial
      ? PLANET_POLAR_MATERIAL_TILE[pole]
      : PLANET_POLAR_SURFACE_TILE[pole];
  return {
    latitudeIndex: north ? LATITUDE_SEGMENTS - 1 : 0,
    vertices,
    uvs,
    texture: PLANET_POLAR_TEXTURE_URL,
    textureImageSource: {
      url: PLANET_POLAR_TEXTURE_URL,
      width: PLANET_POLAR_TEXTURE_WIDTH,
      height: PLANET_POLAR_TEXTURE_HEIGHT,
      sourceRect: {
        x: tile * PLANET_POLAR_TEXTURE_SIZE,
        y: 0,
        width: PLANET_POLAR_TEXTURE_SIZE,
        height: PLANET_POLAR_TEXTURE_SIZE,
      },
    },
    texturePresentation: {
      backend: "image", lighting: "source", projection: "projective",
    },
    color: "#ffffff",
    polarCap: pole,
    polarRole: role,
  };
}

function createUvSpherePolygons(surfaceOverlap = SURFACE_OVERLAP) {
  const polygons = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      polygons.push(createPolarCapPolygon(
        latitudeIndex === 0 ? "south" : "north",
      ));
      continue;
    }
    const v0 = latitudeIndex / LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const u0 = longitudeIndex / LONGITUDE_SEGMENTS;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const latitudeOverlap = Math.PI / LATITUDE_SEGMENTS * surfaceOverlap;
      const longitudeOverlap = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
      const surfaceLatitude0 = Math.max(-Math.PI / 2, latitude0 - latitudeOverlap);
      const surfaceLatitude1 = Math.min(Math.PI / 2, latitude1 + latitudeOverlap);
      const surfaceLongitude0 = longitude0 - longitudeOverlap;
      const surfaceLongitude1 = surfaceOverlap === 0 &&
          longitudeIndex === LONGITUDE_SEGMENTS - 1
        ? 0
        : longitude1 + longitudeOverlap;
      const southWest = spherePoint(surfaceLatitude0, surfaceLongitude0);
      const southEast = spherePoint(surfaceLatitude0, surfaceLongitude1);
      const northEast = spherePoint(surfaceLatitude1, surfaceLongitude1);
      const northWest = spherePoint(surfaceLatitude1, surfaceLongitude0);
      const textureFaceIndex =
        (latitudeIndex - 1) * LONGITUDE_SEGMENTS + longitudeIndex;
      const sourceRect = {
        x: longitudeIndex * PLANET_SOURCE_CELL_WIDTH,
        y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * PLANET_SOURCE_CELL_HEIGHT,
        width: PLANET_SOURCE_CELL_WIDTH,
        height: PLANET_SOURCE_CELL_HEIGHT,
      };
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [southWest, southEast, northEast, northWest],
        uvs: [[u0, v0], [u0 + 1 / LONGITUDE_SEGMENTS, v0],
          [u0 + 1 / LONGITUDE_SEGMENTS, v1], [u0, v1]],
        texture: PLANET_BODY_SURFACE_TEXTURE_URL,
        textureImageSource: {
          url: PLANET_BODY_SURFACE_TEXTURE_URL,
          width: PLANET_SOURCE_TEXTURE_WIDTH,
          height: PLANET_SOURCE_TEXTURE_HEIGHT,
          sourceRect,
        },
        texturePresentation: {
          backend: "image", lighting: "source", projection: "projective",
        },
        color: "#c3a36f",
        lightingFaceIndex: textureFaceIndex,
      });
    }
  }
  return polygons;
}

function prepareBodySeamEdges() {
  const topology = createUvSpherePolygons(0);
  const seamEdges = buildSeamBleedPolygonEdges(topology, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
  });
  for (let index = 0; index < topology.length; index += 1) {
    const polygon = topology[index];
    if (polygon.longitudeIndex === 0 && !seamEdges.get(index)?.has(3)) {
      throw new Error(
        `Saturn latitude ${polygon.latitudeIndex} west wrap edge is not shared.`,
      );
    }
    if (polygon.longitudeIndex === LONGITUDE_SEGMENTS - 1 &&
        !seamEdges.get(index)?.has(1)) {
      throw new Error(
        `Saturn latitude ${polygon.latitudeIndex} east wrap edge is not shared.`,
      );
    }
  }
  return seamEdges;
}

function createRingPlane(
  textureUrl = RING_TEXTURE_URL,
  elevation = 0,
  textureSize = PREPARED_RING_SOURCE.textureSize,
  radius = RING_OUTER_RADIUS,
) {
  return {
    vertices: [
      [-radius, -radius, elevation], [radius, -radius, elevation],
      [radius, radius, elevation], [-radius, radius, elevation],
    ],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    texture: textureUrl,
    textureImageSource: {
      url: textureUrl,
      width: textureSize,
      height: textureSize,
      sourceRect: {
        x: 0, y: 0,
        width: textureSize,
        height: textureSize,
      },
    },
    texturePresentation: {
      backend: "image", lighting: "source", projection: "projective",
    },
    color: "#c8b58d",
    doubleSided: true,
  };
}

function preparedAtlasDimensions(width, height) {
  return (width === 64 ? "" :
    `;--polycss-atlas-width:${formatCssLength(width)}`) +
    (height === 64 ? "" :
      `;--polycss-atlas-height:${formatCssLength(height)}`);
}

function textureStyle(polygon, index, seamEdges, seamBleed = SEAM_BLEED) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed,
    ...(seamEdges ? { seamEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !geometry) throw new Error(`Texture leaf ${index} did not prepare.`);
  const preparedLighting = Number.isSafeInteger(polygon.lightingFaceIndex);
  const weatherTargetIndex = preparedLighting
    ? weatherTargetOrdinal(polygon.lightingFaceIndex)
    : -1;
  const preparedWeather = weatherTargetIndex >= 0;
  const sourceFittedGeometry = preparedLighting
    ? fitTextureGeometry(geometry, PLANET_RASTER_CELL_SIZE, PLANET_RASTER_CELL_SIZE)
    : geometry;
  const fittedGeometry = preparedLighting
    ? fitProjectiveTextureGeometryToStableLayout(sourceFittedGeometry)
    : sourceFittedGeometry;
  const surfacePresentation = preparedLighting
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: PLANET_RASTER_SOURCE_WIDTH,
      sourceHeight: PLANET_RASTER_SOURCE_HEIGHT,
      sourceRect: {
        x: polygon.longitudeIndex * PLANET_RASTER_CELL_SIZE,
        y: (LATITUDE_SEGMENTS - 1 - polygon.latitudeIndex) *
          PLANET_RASTER_CELL_SIZE,
        width: PLANET_RASTER_CELL_SIZE,
        height: PLANET_RASTER_CELL_SIZE,
      },
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fittedGeometry.backgroundPosition,
      backgroundSize: fittedGeometry.backgroundSize,
      leafWidth: fittedGeometry.leafWidth,
      leafHeight: fittedGeometry.leafHeight,
      bandCount: LATITUDE_SEGMENTS,
      gutter: PLANET_RASTER_GUTTER,
      overscan: PLANET_RASTER_OVERSCAN,
    })
    : fittedGeometry;
  const backgroundPositionX = surfacePresentation.backgroundPosition[0] === 0
    ? "0px"
    : formatCssLength(surfacePresentation.backgroundPosition[0]);
  const backgroundPositionY = surfacePresentation.backgroundPosition[1] === 0
    ? "0px"
    : formatCssLength(surfacePresentation.backgroundPosition[1]);
  const weatherBackgroundPositionX = preparedWeather
    ? formatCssLength(-(
      WEATHER_FRAME_GUTTER + weatherTargetIndex * WEATHER_CELL_SIZE -
        SURFACE_OVERLAP * WEATHER_CELL_SIZE
    ) * fittedGeometry.leafWidth / WEATHER_CELL_SIZE)
    : null;
  const weatherBackgroundPositionY = preparedWeather
    ? formatCssLength(-(
      WEATHER_FRAME_GUTTER - SURFACE_OVERLAP * WEATHER_CELL_SIZE
    ) * fittedGeometry.leafHeight / WEATHER_CELL_SIZE)
    : null;
  const backgroundPosition = `${backgroundPositionX} ${backgroundPositionY}`;
  const surfaceBackgroundSize =
    `${formatCssLength(surfacePresentation.backgroundSize[0])} ` +
    formatCssLength(surfacePresentation.backgroundSize[1]);
  const preparedBackgroundImages = preparedLighting
    ? preparedWeather
      ? `url(${PLANET_WEATHER_TEXTURE_URL}),` +
        "var(--polycss-projective-texture-image)"
      : "var(--polycss-projective-texture-image)"
    : `url(${fittedGeometry.url})`;
  const preparedBackgroundPosition = preparedWeather
    ? `${weatherBackgroundPositionX} ${weatherBackgroundPositionY},` +
      backgroundPosition
    : backgroundPosition;
  const preparedBackgroundSize = preparedWeather
    ? `${formatCssLength(WEATHER_PRESENTATION_WIDTH)} ` +
      `${formatCssLength(WEATHER_PRESENTATION_HEIGHT)},` +
      surfaceBackgroundSize
    : surfaceBackgroundSize;
  const style = `transform:matrix3d(${fittedGeometry.matrix})` +
    preparedAtlasDimensions(
      fittedGeometry.leafWidth,
      fittedGeometry.leafHeight,
    ) +
    (preparedLighting
      ? `;--saturn-surface-position:${backgroundPosition}`
      : "") +
    `;background-image:${preparedBackgroundImages}` +
    `;background-position:${preparedBackgroundPosition}` +
    `;background-size:${preparedBackgroundSize}`;
  return {
    ...(preparedWeather
      ? { className: "saturn-weather-surface" }
      : {}),
    style,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fittedGeometry.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    sourceRect: fittedGeometry.sourceRect,
    leafWidth: fittedGeometry.leafWidth,
    leafHeight: fittedGeometry.leafHeight,
    projection: fittedGeometry.projection,
    lighting: preparedLighting ? "baked" : "source",
    lightingOverlay: false,
    ...(preparedWeather
      ? {
        preparedWeather: true,
        weatherTargetOrdinal: weatherTargetIndex,
        weatherSurfacePositionX: backgroundPositionX,
        weatherSurfacePositionY: backgroundPositionY,
      }
      : {}),
  };
}

function canonicalRingTextureStyle() {
  const leaf = textureStyle(createRingPlane(), 0);
  const source = `background-image:url(${RING_TEXTURE_URL})`;
  const canonical = `background-image:url(\"${RING_TEXTURE_2X_URL}\")`;
  if (!leaf.style.includes(source)) {
    throw new Error("Prepared Saturn ring texture style is incompatible.");
  }
  return {
    ...leaf,
    style: leaf.style.replace(source, canonical),
  };
}

function croppedRingShadowTextureStyle() {
  const sourceSize = PREPARED_RING_SOURCE.shadowTextureSourceSize;
  const bounds = PREPARED_RING_SOURCE.shadowTextureBounds;
  const leaf = textureStyle(createRingPlane(
    RING_SHADOW_TEXTURE_URL,
    0.04,
    sourceSize,
  ), 1);
  const fullPosition = "background-position:0px 0px";
  const fullSize = `background-size:${formatCssLength(sourceSize)} ` +
    formatCssLength(sourceSize);
  if (!leaf.style.includes(fullPosition) || !leaf.style.includes(fullSize)) {
    throw new Error("Prepared Saturn ring-shadow crop is incompatible.");
  }
  return {
    ...leaf,
    style: leaf.style
      .replace(
        fullPosition,
        `background-position:${formatCssLength(bounds.x)} ` +
          formatCssLength(bounds.y),
      )
      .replace(
        fullSize,
        `background-size:${formatCssLength(bounds.width)} ` +
          formatCssLength(bounds.height),
      ),
    preparedCrop: {
      sourceSize,
      bounds,
      transparentGutter:
        PREPARED_RING_SOURCE.shadowTextureTransparentGutter,
      retainedLogicalPlaneSize: sourceSize,
      runtimeWork: false,
    },
  };
}

function cropRingMotionLeaf(leaf, plate) {
  const { x, y, width, height } = plate.textureCropBounds;
  const fullPosition = "background-position:0px 0px";
  const fullBackground =
    `background-size:${formatCssLength(plate.textureSize)} ` +
    formatCssLength(plate.textureSize);
  const croppedBackground =
    `background-size:${formatCssLength(width)} ${formatCssLength(height)}`;
  if (!leaf.style.includes(fullPosition) ||
      !leaf.style.includes(fullBackground)) {
    throw new Error(`Prepared Saturn ${plate.population} crop is incompatible.`);
  }
  return {
    ...leaf,
    style: leaf.style
      .replace(
        fullPosition,
        `background-position:${formatCssLength(x)} ${formatCssLength(y)}`,
      )
      .replace(fullBackground, croppedBackground),
  };
}

function canonicalRingMotionPlateStyle(plate, index) {
  const leaf = cropRingMotionLeaf(textureStyle(createRingPlane(
    plate.textureUrl,
    plate.elevation,
    plate.textureSize,
    plate.displayRadius,
  ), index + 2), plate);
  const source = `background-image:url(${plate.textureUrl})`;
  const canonical = `background-image:url(\"${plate.texture2xUrl}\")`;
  if (!leaf.style.includes(source)) {
    throw new Error(`Prepared Saturn ${plate.population} plate is incompatible.`);
  }
  return {
    ...plate,
    preparedCrop: {
      sourceSize: plate.textureSize,
      bounds: plate.textureCropBounds,
      transparentGutter: plate.textureTransparentGutter,
      runtimeWork: false,
    },
    leaf: {
      ...leaf,
      style: leaf.style.replace(source, canonical),
    },
  };
}

function preparedCanonicalTextureStyle(
  polygon,
  index,
  {
    url2x,
    presentationWidth,
    presentationHeight,
    backfaceVisible = false,
    sharedTexture = false,
  },
) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed: 0,
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !geometry) {
    throw new Error(`Prepared Saturn interior leaf ${index} did not prepare.`);
  }
  const fitted = fitTextureGeometry(
    geometry,
    presentationWidth,
    presentationHeight,
  );
  const backgroundPosition = fitted.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value))
    .join(" ");
  const backgroundSize = fitted.backgroundSize
    .map(formatCssLength)
    .join(" ");
  return Object.freeze({
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(fitted.leafWidth, fitted.leafHeight) +
      (sharedTexture
        ? ""
        : `;background-image:url(\"${url2x}\")`) +
      `;background-position:${backgroundPosition}` +
      (sharedTexture ? "" : `;background-size:${backgroundSize}`) +
      (backfaceVisible ? ";backface-visibility:visible" : ""),
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fitted.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    sourceRect: fitted.sourceRect,
    leafWidth: fitted.leafWidth,
    leafHeight: fitted.leafHeight,
    projection: fitted.projection,
    lighting: "prepared-source",
    lightingOverlay: false,
  });
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function interiorLongitudeRemoved(longitudeDegrees) {
  return Math.abs(normalizeDegrees(
    longitudeDegrees - INTERIOR_CUTAWAY.centerLongitudeDegrees,
  )) <= INTERIOR_CUTAWAY.widthDegrees / 2;
}

function scaledSpherePoint(latitude, longitude, radiusScale) {
  const latitudeRadius = Math.cos(latitude);
  return [
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * radiusScale * Math.sin(latitude),
  ];
}

function createInteriorPolarCapPolygon(pole, radiusScale, asset) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI / INTERIOR_LATITUDE_SEGMENTS;
  const radius = EQUATORIAL_RADIUS * radiusScale *
    Math.cos(boundaryLatitude) * 1.025;
  const z = sign * (
    POLAR_RADIUS * radiusScale * Math.sin(boundaryLatitude) + 0.05
  );
  return {
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
      width: asset.width,
      height: asset.height,
      sourceRect: {
        x: north ? 0 : asset.height,
        y: 0,
        width: asset.height,
        height: asset.height,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    polarCap: pole,
  };
}

function createInteriorShellPolygons({ radiusScale, surface, poles, cutaway }) {
  const polygons = [];
  for (let latitudeIndex = 1;
    latitudeIndex < INTERIOR_LATITUDE_SEGMENTS - 1;
    latitudeIndex += 1) {
    const v0 = latitudeIndex / INTERIOR_LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / INTERIOR_LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < INTERIOR_LONGITUDE_SEGMENTS;
      longitudeIndex += 1) {
      const centerLongitudeDegrees = (longitudeIndex + 0.5) *
        360 / INTERIOR_LONGITUDE_SEGMENTS;
      if (cutaway && interiorLongitudeRemoved(centerLongitudeDegrees)) continue;
      const u0 = longitudeIndex / INTERIOR_LONGITUDE_SEGMENTS;
      const u1 = (longitudeIndex + 1) / INTERIOR_LONGITUDE_SEGMENTS;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = u1 * Math.PI * 2;
      polygons.push({
        vertices: [
          scaledSpherePoint(latitude0, longitude0, radiusScale),
          scaledSpherePoint(latitude0, longitude1, radiusScale),
          scaledSpherePoint(latitude1, longitude1, radiusScale),
          scaledSpherePoint(latitude1, longitude0, radiusScale),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: surface.url,
        textureImageSource: {
          url: surface.url,
          width: surface.width,
          height: surface.height,
          sourceRect: {
            x: longitudeIndex * surface.width / INTERIOR_LONGITUDE_SEGMENTS,
            y: (INTERIOR_LATITUDE_SEGMENTS - 1 - latitudeIndex) *
              surface.height / INTERIOR_LATITUDE_SEGMENTS,
            width: surface.width / INTERIOR_LONGITUDE_SEGMENTS,
            height: surface.height / INTERIOR_LATITUDE_SEGMENTS,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
      });
    }
  }
  polygons.push(
    createInteriorPolarCapPolygon("north", radiusScale, poles),
    createInteriorPolarCapPolygon("south", radiusScale, poles),
  );
  return polygons;
}

function prepareInteriorShell(options) {
  return Object.freeze(createInteriorShellPolygons(options).map(
    (polygon, index) => Object.freeze({
      tag: "s",
      ...(polygon.polarCap
        ? { className: `saturn-interior-pole saturn-interior-pole-${polygon.polarCap}` }
        : {}),
      ...preparedCanonicalTextureStyle(polygon, index, {
        url2x: polygon.polarCap ? options.poles.url2x : options.surface.url2x,
        presentationWidth: polygon.polarCap ? 256 : 64,
        presentationHeight: polygon.polarCap ? 256 : 64,
        sharedTexture: !polygon.polarCap,
      }),
    }),
  ));
}

function createInteriorSectionPolygon(longitudeDegrees, faceIndex) {
  const longitude = longitudeDegrees * Math.PI / 180;
  const direction = [Math.cos(longitude), Math.sin(longitude)];
  const asset = PREPARED_SATURN_VIEWS.assets.section;
  return {
    vertices: [
      [0, 0, -POLAR_RADIUS],
      [direction[0] * EQUATORIAL_RADIUS,
        direction[1] * EQUATORIAL_RADIUS, -POLAR_RADIUS],
      [direction[0] * EQUATORIAL_RADIUS,
        direction[1] * EQUATORIAL_RADIUS, POLAR_RADIUS],
      [0, 0, POLAR_RADIUS],
    ],
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
      width: asset.width,
      height: asset.height,
      sourceRect: {
        x: faceIndex * asset.width / 2,
        y: 0,
        width: asset.width / 2,
        height: asset.height,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
  };
}

function prepareInteriorSectionLeaves() {
  const { centerLongitudeDegrees, widthDegrees } =
    PREPARED_SATURN_VIEWS.cutaway;
  return Object.freeze([
    centerLongitudeDegrees - widthDegrees / 2,
    centerLongitudeDegrees + widthDegrees / 2,
  ].map((longitudeDegrees, index) => {
    const polygon = createInteriorSectionPolygon(longitudeDegrees, index);
    return Object.freeze({
      tag: "s",
      className: "saturn-interior-section-face",
      ...preparedCanonicalTextureStyle(polygon, index, {
        url2x: PREPARED_SATURN_VIEWS.assets.section.url2x,
        presentationWidth: 256,
        presentationHeight: 512,
        backfaceVisible: true,
      }),
    });
  }));
}

function createCutawayOuterPolarCapPolygon(pole, asset) {
  const polygon = createPolarCapPolygon(pole);
  return {
    ...polygon,
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
      width: asset.width,
      height: asset.height,
      sourceRect: {
        x: pole === "north" ? 0 : asset.height,
        y: 0,
        width: asset.height,
        height: asset.height,
      },
    },
  };
}

function prepareCutawayOuterPolarLeaves() {
  const asset = PREPARED_SATURN_VIEWS.assets.outerPoles.normal;
  return Object.freeze(["south", "north"].map((pole, index) => ({
    latitudeIndex: pole === "north" ? LATITUDE_SEGMENTS - 1 : 0,
    leaf: Object.freeze({
      tag: "s",
      className: `saturn-cutaway-outer-pole saturn-cutaway-outer-pole-${pole}`,
      ...preparedCanonicalTextureStyle(
        createCutawayOuterPolarCapPolygon(pole, asset),
        index,
        {
          url2x: asset.url2x,
          presentationWidth: 256,
          presentationHeight: 256,
        },
      ),
    }),
  })));
}

function fitTextureGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Prepared Saturn texture matrix is invalid.");
  }
  const matrixScaleX = geometry.leafWidth / leafWidth;
  const matrixScaleY = geometry.leafHeight / leafHeight;
  for (const index of [0, 1, 2, 3]) matrix[index] *= matrixScaleX;
  for (const index of [4, 5, 6, 7]) matrix[index] *= matrixScaleY;
  const rasterScaleX = leafWidth / geometry.leafWidth;
  const rasterScaleY = leafHeight / geometry.leafHeight;
  return {
    ...geometry,
    matrix: matrix.map((value) => Number(value.toFixed(6))).join(","),
    leafWidth,
    leafHeight,
    backgroundPosition: [
      geometry.backgroundPosition[0] * rasterScaleX,
      geometry.backgroundPosition[1] * rasterScaleY,
    ],
    backgroundSize: [
      geometry.backgroundSize[0] * rasterScaleX,
      geometry.backgroundSize[1] * rasterScaleY,
    ],
  };
}

function prepareFixedMaterialPlane({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  objectLight,
  objectView,
  scenePitchDegrees,
  systemObliquityDegrees,
  textureUrl = PLANET_FIXED_MATERIAL_TEXTURE_URL,
  outputSize = PLANET_FIXED_MATERIAL_SIZE,
  preparedMeshSilhouette = false,
  materialMode = "full",
}) {
  const screenToObject = (vector) => {
    let result = rotateY(
      vector,
      scenePitchDegrees * Math.PI / 180,
    );
    result = rotateZ(
      result,
      -SATURN_PRESENTATION_NODE_DEGREES * Math.PI / 180,
    );
    result = rotateX(
      result,
      -systemObliquityDegrees * Math.PI / 180,
    );
    return rotateZ(result, -MESH_ROTATION_Z * Math.PI / 180);
  };
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  if (view.some((component, index) =>
    Math.abs(component - objectView[index]) > 1e-12)) {
    throw new Error("Saturn fixed-material view projection drifted.");
  }
  const projectedRadius = (direction) => Math.sqrt(
    EQUATORIAL_RADIUS ** 2 *
      (direction[0] ** 2 + direction[1] ** 2) +
    POLAR_RADIUS ** 2 * direction[2] ** 2,
  );
  const radiusX = projectedRadius(right);
  const radiusY = projectedRadius(down);
  const frontDepth = projectedRadius(view);
  const scaledRadiusX = radiusX * PLANET_FIXED_MATERIAL_COVERAGE_SCALE;
  const scaledRadiusY = radiusY * PLANET_FIXED_MATERIAL_COVERAGE_SCALE;
  const silhouetteCoverage = preparedMeshSilhouette
    ? prepareProjectedMeshSilhouetteCoverage({
      right,
      down,
      scaledRadiusX,
      scaledRadiusY,
      outputSize,
      supersampling: PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING,
    })
    : null;
  const ringShadowSampleRadiusPixels = preparedMeshSilhouette
    ? ringTextureWidth / outputSize * 0.5
    : 0;
  const output = Buffer.alloc(
    outputSize * outputSize * 4,
  );
  let ringShadowedTexelCount = 0;
  let ringShadowOpacityTotal = 0;
  let maxSampledRingOpacity = 0;
  let visibleRingShadowWeightTotal = 0;
  let visibleRingShadowWeightedColumn = 0;
  let visibleRingShadowWeightedRow = 0;
  let visibleRingShadowMinimumColumn = outputSize;
  let visibleRingShadowMinimumRow = outputSize;
  let visibleRingShadowMaximumColumn = -1;
  let visibleRingShadowMaximumRow = -1;
  let foregroundRingCompositedTexelCount = 0;
  let foregroundRingOpacityTotal = 0;
  for (let row = 0; row < outputSize; row += 1) {
    const screenY = (
      (row + 0.5) / outputSize * 2 - 1
    ) * radiusY;
    for (let column = 0; column < outputSize; column += 1) {
      const screenX = (
        (column + 0.5) / outputSize * 2 - 1
      ) * radiusX;
      let sampledScreenX = screenX;
      let sampledScreenY = screenY;
      let coverageOrigin = [0, 1, 2].map((axis) =>
        right[axis] * sampledScreenX + down[axis] * sampledScreenY);
      let coverageHit = intersectViewRayWithSaturn(coverageOrigin, view);
      if (!coverageHit) continue;
      const materialSampleScale =
        PLANET_FIXED_MATERIAL_COVERAGE_SCALE /
          PLANET_FIXED_MATERIAL_CONTENT_SCALE;
      const materialOrigin = [0, 1, 2].map((axis) =>
        right[axis] * sampledScreenX * materialSampleScale +
          down[axis] * sampledScreenY * materialSampleScale);
      let hit = intersectViewRayWithSaturn(materialOrigin, view);
      if (!hit) {
        let lowerScale = 1;
        let upperScale = materialSampleScale;
        hit = coverageHit;
        for (let step = 0; step < 12; step += 1) {
          const sampleScale = (lowerScale + upperScale) / 2;
          const candidateOrigin = [0, 1, 2].map((axis) =>
            right[axis] * sampledScreenX * sampleScale +
              down[axis] * sampledScreenY * sampleScale);
          const candidateHit = intersectViewRayWithSaturn(candidateOrigin, view);
          if (candidateHit) {
            lowerScale = sampleScale;
            hit = candidateHit;
          } else {
            upperScale = sampleScale;
          }
        }
      }
      const lambert = Math.max(0, dotVector(hit.normal, objectLight));
      const ringOpacity = ringData
        ? sampleRingShadowOpacity(
          hit.position,
          objectLight,
          ringData,
          ringTextureWidth,
          ringShadowSampleRadiusPixels,
        )
        : 0;
      const directTransmission = mix(
        1,
        RING_SHADOW_DIRECT_TRANSMISSION,
        ringOpacity,
      );
      if (lambert > 0 && ringOpacity > 1 / 255) {
        ringShadowedTexelCount += 1;
        ringShadowOpacityTotal += ringOpacity;
        maxSampledRingOpacity = Math.max(maxSampledRingOpacity, ringOpacity);
        const visibleShadowWeight = ringOpacity * lambert;
        visibleRingShadowWeightTotal += visibleShadowWeight;
        visibleRingShadowWeightedColumn += column * visibleShadowWeight;
        visibleRingShadowWeightedRow += row * visibleShadowWeight;
        visibleRingShadowMinimumColumn = Math.min(
          visibleRingShadowMinimumColumn,
          column,
        );
        visibleRingShadowMinimumRow = Math.min(
          visibleRingShadowMinimumRow,
          row,
        );
        visibleRingShadowMaximumColumn = Math.max(
          visibleRingShadowMaximumColumn,
          column,
        );
        visibleRingShadowMaximumRow = Math.max(
          visibleRingShadowMaximumRow,
          row,
        );
      }
      const tint = textureTintFactors(
        LIGHTING.directionalLight.intensity *
          prepareOpenSpaceGlobeDiffusePower(lambert) * directTransmission,
        LIGHTING.directionalLight.color,
        LIGHTING.ambientLight.color,
        LIGHTING.ambientLight.intensity,
      );
      const outputOffset = (row * outputSize + column) * 4;
      const atmosphereAlpha = preparedAtmosphereOpacity(
        hit.normal,
        objectLight,
        view,
      );
      let cutawayMaterialRemoved = false;
      if (materialMode === "cutaway-full") {
        const longitudeDegrees = Math.atan2(
          hit.position[1],
          hit.position[0],
        ) * 180 / Math.PI;
        cutawayMaterialRemoved = interiorLongitudeRemoved(longitudeDegrees);
      }
      if (!cutawayMaterialRemoved) {
        writePreparedMaterialOverlay(
          output,
          outputOffset,
          tint,
          maximumLightingFactor,
          atmosphereAlpha,
        );
      }
      const surfaceDistance = dotVector(
        subtractVector(coverageHit.position, coverageOrigin),
        view,
      );
      const foregroundRingSample = sampleForegroundRing(
        coverageOrigin,
        view,
        surfaceDistance,
        foregroundRingData,
        ringTextureWidth,
      );
      if (foregroundRingSample) {
        const ringAlpha = foregroundRingSample[3] / 255;
        if (cutawayMaterialRemoved) {
          const destinationAlpha = output[outputOffset + 3] / 255;
          const compositeAlpha = ringAlpha +
            destinationAlpha * (1 - ringAlpha);
          for (let channel = 0; channel < 3; channel += 1) {
            output[outputOffset + channel] = compositeAlpha > 0
              ? Math.round((
                foregroundRingSample[channel] * ringAlpha +
                output[outputOffset + channel] * destinationAlpha *
                  (1 - ringAlpha)
              ) / compositeAlpha)
              : 0;
          }
          output[outputOffset + 3] = Math.round(compositeAlpha * 255);
        } else {
          for (let channel = 0; channel < 3; channel += 1) {
            output[outputOffset + channel] = Math.round(mix(
              output[outputOffset + channel],
              foregroundRingSample[channel],
              ringAlpha,
            ));
          }
        }
        foregroundRingCompositedTexelCount += 1;
        foregroundRingOpacityTotal += ringAlpha;
      }
      if (silhouetteCoverage) {
        output[outputOffset + 3] = Math.round(
          output[outputOffset + 3] *
            silhouetteCoverage[row * outputSize + column] / 255,
        );
      }
    }
  }

  const scaleVector = (vector, scale) =>
    vector.map((component) => component * scale);
  const addVectors = (...vectors) => [0, 1, 2].map((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
  const basisX = worldPositionToCss(scaleVector(
    right,
    scaledRadiusX * 2 / outputSize,
  ));
  const basisY = worldPositionToCss(scaleVector(
    down,
    scaledRadiusY * 2 / outputSize,
  ));
  const basisZ = worldPositionToCss(view);
  const origin = worldPositionToCss(addVectors(
    scaleVector(right, -scaledRadiusX),
    scaleVector(down, -scaledRadiusY),
    scaleVector(view, frontDepth + PLANET_FIXED_MATERIAL_DEPTH_BIAS),
  ));
  const matrix = [
    ...basisX, 0,
    ...basisY, 0,
    ...basisZ, 0,
    ...origin, 1,
  ];
  return Object.freeze({
    output,
    matrix: Object.freeze(matrix),
    projection: Object.freeze({
      model: "prepared-oblate-ellipsoid-camera-projection",
      width: outputSize,
      height: outputSize,
      presentationScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
      radiusX,
      radiusY,
      frontDepth,
      depthBias: PLANET_FIXED_MATERIAL_DEPTH_BIAS,
      silhouetteCoverage: Object.freeze({
        model: "prepared-analytic-oblate-ellipsoid-proportional-overscan",
        coverageScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
        materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
        rimFill: "prepared-radial-binary-clamp-to-material-limb",
        sourcePixelBleed: 0,
        runtime: false,
      }),
      right,
      down,
      view,
      screenshotDerived: false,
    }),
    leaf: Object.freeze({
      tag: "s",
      style: `transform:matrix3d(${matrix.join(",")})` +
        `;--polycss-atlas-width:${outputSize}px` +
        `;--polycss-atlas-height:${outputSize}px` +
        `;background-image:url(${textureUrl})` +
        `;background-size:${outputSize}px ${outputSize}px` +
        ";backface-visibility:visible",
    }),
    ringShadowedTexelCount,
    meanSampledRingOpacity: Number((ringShadowOpacityTotal /
      Math.max(1, ringShadowedTexelCount)).toFixed(6)),
    maxSampledRingOpacity: Number(maxSampledRingOpacity.toFixed(6)),
    visibleRingShadowCentroid: visibleRingShadowWeightTotal > 0
      ? Object.freeze([
        Number((visibleRingShadowWeightedColumn /
          visibleRingShadowWeightTotal).toFixed(3)),
        Number((visibleRingShadowWeightedRow /
          visibleRingShadowWeightTotal).toFixed(3)),
      ])
      : null,
    visibleRingShadowBounds: visibleRingShadowMaximumColumn >= 0
      ? Object.freeze({
        minimumColumn: visibleRingShadowMinimumColumn,
        minimumRow: visibleRingShadowMinimumRow,
        maximumColumn: visibleRingShadowMaximumColumn,
        maximumRow: visibleRingShadowMaximumRow,
      })
      : null,
    foregroundRingCompositedTexelCount,
    meanForegroundRingOpacity: Number((foregroundRingOpacityTotal /
      Math.max(1, foregroundRingCompositedTexelCount)).toFixed(6)),
  });
}

function prepareOrbitMaterialAtlas({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  defaultFrame,
  approvedReferenceFrameChanged,
  shadowless = false,
}) {
  const output = Buffer.alloc(
    PLANET_ORBIT_MATERIAL_WIDTH * PLANET_ORBIT_MATERIAL_HEIGHT * 4,
  );
  const maximumScenePitch = 65;
  const ringShadowMeasurements = [];
  for (let frameIndex = 0;
    frameIndex < PLANET_ORBIT_MATERIAL_FRAME_COUNT;
    frameIndex += 1) {
    const amount = frameIndex / (PLANET_ORBIT_MATERIAL_FRAME_COUNT - 1);
    const scenePitchDegrees = maximumScenePitch * (1 - amount);
    const systemObliquityDegrees = SATURN_OBLIQUITY_DEGREES *
      scenePitchDegrees / CAMERA_ROTATION_X_DEGREES;
    const objectView = prepareObjectViewDirection(
      scenePitchDegrees,
      systemObliquityDegrees,
    );
    const objectLight = shadowless
      ? objectView
      : prepareObjectLightDirection(systemObliquityDegrees);
    const frame = prepareFixedMaterialPlane({
      ringData,
      foregroundRingData,
      ringTextureWidth,
      maximumLightingFactor,
      objectLight,
      objectView,
      scenePitchDegrees,
      systemObliquityDegrees,
      textureUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
      outputSize: PLANET_ORBIT_MATERIAL_SIZE,
      preparedMeshSilhouette: true,
    });
    ringShadowMeasurements.push(Object.freeze({
      frameIndex,
      scenePitchDegrees: Number(scenePitchDegrees.toFixed(6)),
      shadowedTexelCount: frame.ringShadowedTexelCount,
      visibleCentroid: frame.visibleRingShadowCentroid,
      visibleBounds: frame.visibleRingShadowBounds,
    }));
    const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
    const frameRow = Math.floor(frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS);
    const frameX = frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
      PLANET_ORBIT_MATERIAL_GUTTER;
    const frameY = frameRow * PLANET_ORBIT_MATERIAL_STRIDE +
      PLANET_ORBIT_MATERIAL_GUTTER;
    writeMaterialAtlasTile({
      output,
      outputWidth: PLANET_ORBIT_MATERIAL_WIDTH,
      source: frame.output,
      sourceSize: PLANET_ORBIT_MATERIAL_SIZE,
      frameX,
      frameY,
      gutter: PLANET_ORBIT_MATERIAL_GUTTER,
    });
  }
  writeMaterialAtlasTile({
    output,
    outputWidth: PLANET_ORBIT_MATERIAL_WIDTH,
    source: defaultFrame,
    sourceSize: PLANET_FIXED_MATERIAL_SIZE,
    frameX: PLANET_ORBIT_MATERIAL_DEFAULT_X,
    frameY: PLANET_ORBIT_MATERIAL_DEFAULT_Y,
    gutter: PLANET_ORBIT_MATERIAL_GUTTER,
  });
  const visibleRingShadowMeasurements = ringShadowMeasurements.filter(
    ({ visibleCentroid }) => visibleCentroid,
  );
  if (ringData && visibleRingShadowMeasurements.length < 2) {
    throw new Error("Prepared orbit bank did not move the visible ring shadow.");
  }
  const ringShadowCentroidColumns = visibleRingShadowMeasurements.map(
    ({ visibleCentroid }) => visibleCentroid[0],
  );
  const ringShadowCentroidRows = visibleRingShadowMeasurements.map(
    ({ visibleCentroid }) => visibleCentroid[1],
  );
  return Object.freeze({
    output,
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees: maximumScenePitch,
    preparedMeshSilhouette: Object.freeze({
      model: "prepared-projected-lowpoly-hull-alpha-coverage",
      longitudeCount: LONGITUDE_SEGMENTS,
      latitudeCount: LATITUDE_SEGMENTS,
      supersampling:
        PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING,
      atlasAlphaOnly: true,
      runtimeWork: false,
    }),
    ringShadowFootprint: Object.freeze({
      model: "prepared-center-weighted-five-tap-orbit-texel-footprint",
      sourceBlurSigmaPixels: RING_SHADOW_FOOTPRINT_BLUR_SIGMA,
      orbitSampleRadiusPixels: Number((
        ringTextureWidth / PLANET_ORBIT_MATERIAL_SIZE * 0.5
      ).toFixed(3)),
      approvedReferenceFrameChanged,
      runtimeWork: false,
    }),
    ringShadowMotionEvidence: Object.freeze({
      model: "prepared-visible-ray-occlusion-centroid-span",
      frameCount: ringShadowMeasurements.length,
      visibleFrameCount: visibleRingShadowMeasurements.length,
      centroidColumnSpan: ringShadowCentroidColumns.length > 0
        ? Number((Math.max(...ringShadowCentroidColumns) -
          Math.min(...ringShadowCentroidColumns)).toFixed(3))
        : 0,
      centroidRowSpan: ringShadowCentroidRows.length > 0
        ? Number((Math.max(...ringShadowCentroidRows) -
          Math.min(...ringShadowCentroidRows)).toFixed(3))
        : 0,
      minimumShadowedTexelCount: Math.min(
        ...ringShadowMeasurements.map(({ shadowedTexelCount }) =>
          shadowedTexelCount),
      ),
      maximumShadowedTexelCount: Math.max(
        ...ringShadowMeasurements.map(({ shadowedTexelCount }) =>
          shadowedTexelCount),
      ),
    }),
  });
}

async function writeVerifiedPreparedShard({
  assetUrl,
  path,
  source,
  sourceBounds,
}) {
  await sharp(source, {
    raw: {
      width: sourceBounds.width,
      height: sourceBounds.height,
      channels: 4,
    },
  })
    .webp({ lossless: true, effort: 6 })
    .toFile(path);
  const q75 = PREPARED_Q75_ORBIT_ASSET_URLS.has(assetUrl)
    ? await optimizePreparedQ75Webp(path)
    : null;
  const asset = await readFile(path);
  const { data, info } = await sharp(asset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visibleTexelsMatch = visibleRgbaMatches(data, source);
  const alphaMatchesSource = alphaMatches(data, source);
  if (info.width !== sourceBounds.width ||
      info.height !== sourceBounds.height ||
      info.channels !== 4 ||
      !alphaMatchesSource ||
      (!q75 && !visibleTexelsMatch)) {
    throw new Error(`Saturn prepared shard changed texels: ${assetUrl}.`);
  }
  return Object.freeze({
    assetUrl,
    assetBytes: asset.byteLength,
    assetSha256: createHash("sha256").update(asset).digest("hex"),
    width: sourceBounds.width,
    height: sourceBounds.height,
    decodedRgbaBytes: sourceBounds.width * sourceBounds.height * 4,
    sourceBounds: Object.freeze(sourceBounds),
    encoding: q75?.encoding === PREPARED_Q75_WEBP_ENCODING
      ? PREPARED_Q75_WEBP_ENCODING
      : "lossless-webp",
    alphaMatchesSource: true,
    visibleTexelsMatchSource: visibleTexelsMatch,
    transparentRgbCanonicalizedByWebp: !data.equals(source),
  });
}

async function writePreparedRuntimeAtlas({
  assetUrl,
  path,
  width,
  height,
  placements,
}) {
  const output = Buffer.alloc(width * height * 4);
  for (const { asset, x, y } of placements) {
    const { data, info } = await sharp(publicTexturePath(asset.assetUrl))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== asset.width || info.height !== asset.height ||
        info.channels !== 4 || x < 0 || y < 0 ||
        x + info.width > width || y + info.height > height) {
      throw new Error(`Saturn runtime atlas placement is invalid: ${assetUrl}.`);
    }
    for (let row = 0; row < info.height; row += 1) {
      const sourceStart = row * info.width * 4;
      const targetStart = ((y + row) * width + x) * 4;
      data.copy(
        output,
        targetStart,
        sourceStart,
        sourceStart + info.width * 4,
      );
    }
  }
  await sharp(output, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(path);
  const bytes = await readFile(path);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 4 ||
      !alphaMatches(data, output) || !visibleRgbaMatches(data, output)) {
    throw new Error(`Saturn runtime atlas changed visible texels: ${assetUrl}.`);
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

function alphaMatches(candidate, source) {
  for (let offset = 3; offset < source.length; offset += 4) {
    if (candidate[offset] !== source[offset]) return false;
  }
  return true;
}

async function prepareOrbitMaterialRuntimeShards({ variantId, path }) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== PLANET_ORBIT_MATERIAL_WIDTH ||
      info.height !== PLANET_ORBIT_MATERIAL_HEIGHT ||
      info.channels !== 4) {
    throw new Error(
      `Saturn orbit material runtime shard source changed: ${variantId}.`,
    );
  }
  const defaultBounds = Object.freeze({
    x: PLANET_ORBIT_MATERIAL_GRID_WIDTH,
    y: 0,
    width: PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE,
    height: PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE,
  });
  const defaultAsset = await writeVerifiedPreparedShard({
    assetUrl: orbitMaterialVariantDefaultTextureUrl(variantId),
    path: orbitMaterialVariantDefaultTexturePath(variantId),
    source: extractRgbaBounds({ rgba: data, width: info.width, bounds: defaultBounds }),
    sourceBounds: defaultBounds,
  });
  const rows = [];
  for (let rowIndex = 0;
    rowIndex < PLANET_ORBIT_MATERIAL_ROWS;
    rowIndex += 1) {
    const sourceBounds = Object.freeze({
      x: 0,
      y: rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
      width: PLANET_ORBIT_MATERIAL_ROW_WIDTH,
      height: PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
    });
    rows.push(await writeVerifiedPreparedShard({
      assetUrl: orbitMaterialVariantRowTextureUrl(variantId, rowIndex),
      path: orbitMaterialVariantRowTexturePath(variantId, rowIndex),
      source: extractRgbaBounds({ rgba: data, width: info.width, bounds: sourceBounds }),
      sourceBounds,
    }));
  }
  const runtimeAtlas = await writePreparedRuntimeAtlas({
    assetUrl: orbitMaterialVariantTextureUrl(variantId),
    path: orbitMaterialVariantTexturePath(variantId),
    width: PLANET_ORBIT_MATERIAL_WIDTH,
    height: PLANET_ORBIT_MATERIAL_HEIGHT,
    placements: Object.freeze([
      ...rows.map((asset, rowIndex) => Object.freeze({
        asset,
        x: 0,
        y: rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
      })),
      Object.freeze({
        asset: defaultAsset,
        x: PLANET_ORBIT_MATERIAL_GRID_WIDTH,
        y: 0,
      }),
    ]),
  });
  const assets = [defaultAsset, ...rows];
  const q75AssetUrls = Object.freeze(assets
    .filter(({ encoding }) => encoding === PREPARED_Q75_WEBP_ENCODING)
    .map(({ assetUrl }) => assetUrl));
  return Object.freeze({
    variantId,
    runtimeAtlas,
    defaultAsset,
    rows: Object.freeze(rows),
    sourceDecodedSha256: createHash("sha256").update(data).digest("hex"),
    alphaExactDecodedCropVerification: true,
    selectiveVisibleRgbEncoding: q75AssetUrls.length > 0
      ? PREPARED_Q75_WEBP_ENCODING
      : "none",
    q75AssetUrls,
    exactVisibleDecodedCropVerification:
      assets.every(({ visibleTexelsMatchSource }) => visibleTexelsMatchSource),
  });
}

async function prepareInteriorAtmosphereRuntimeShards({ assetUrl, path }) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== INTERIOR_ATMOSPHERE_WIDTH ||
      info.height !== INTERIOR_ATMOSPHERE_HEIGHT ||
      info.channels !== 4) {
    throw new Error(`Saturn interior atmosphere source changed: ${assetUrl}.`);
  }
  const defaultBounds = Object.freeze({
    x: INTERIOR_ATMOSPHERE_GRID_WIDTH,
    y: 0,
    width: INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE,
    height: INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE,
  });
  const defaultAssetUrl = interiorAtmosphereShardTextureUrl(
    assetUrl,
    "default",
  );
  const defaultAsset = await writeVerifiedPreparedShard({
    assetUrl: defaultAssetUrl,
    path: interiorAtmosphereShardTexturePath(assetUrl, "default"),
    source: extractRgbaBounds({
      rgba: data,
      width: info.width,
      bounds: defaultBounds,
    }),
    sourceBounds: defaultBounds,
  });
  const rows = [];
  for (let rowIndex = 0;
    rowIndex < INTERIOR_ATMOSPHERE_ROWS;
    rowIndex += 1) {
    const sourceBounds = Object.freeze({
      x: 0,
      y: rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT,
      width: INTERIOR_ATMOSPHERE_ROW_WIDTH,
      height: INTERIOR_ATMOSPHERE_ROW_HEIGHT,
    });
    const suffix = `row-${String(rowIndex).padStart(2, "0")}`;
    rows.push(await writeVerifiedPreparedShard({
      assetUrl: interiorAtmosphereShardTextureUrl(assetUrl, suffix),
      path: interiorAtmosphereShardTexturePath(assetUrl, suffix),
      source: extractRgbaBounds({
        rgba: data,
        width: info.width,
        bounds: sourceBounds,
      }),
      sourceBounds,
    }));
  }
  const runtimeAtlas = await writePreparedRuntimeAtlas({
    assetUrl,
    path: publicTexturePath(assetUrl),
    width: INTERIOR_ATMOSPHERE_WIDTH,
    height: INTERIOR_ATMOSPHERE_HEIGHT,
    placements: Object.freeze([
      ...rows.map((asset, rowIndex) => Object.freeze({
        asset,
        x: 0,
        y: rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT,
      })),
      Object.freeze({
        asset: defaultAsset,
        x: INTERIOR_ATMOSPHERE_GRID_WIDTH,
        y: 0,
      }),
    ]),
  });
  return Object.freeze({
    sourceAssetUrl: assetUrl,
    sourceDecodedSha256: createHash("sha256").update(data).digest("hex"),
    exactVisibleDecodedCropVerification: true,
    runtimeAtlas,
    defaultAsset,
    rows: Object.freeze(rows),
  });
}

function prepareInteriorMaterialAtlas({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  defaultFrame,
  shadowless = false,
}) {
  const output = Buffer.alloc(
    INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
  );
  const maximumScenePitchDegrees = CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES;
  for (let frameIndex = 0;
    frameIndex < INTERIOR_ATMOSPHERE_FRAME_COUNT;
    frameIndex += 1) {
    const amount = frameIndex / (INTERIOR_ATMOSPHERE_FRAME_COUNT - 1);
    const scenePitchDegrees = maximumScenePitchDegrees * (1 - amount);
    const systemObliquityDegrees = SATURN_OBLIQUITY_DEGREES *
      scenePitchDegrees / CAMERA_ROTATION_X_DEGREES;
    const objectView = prepareObjectViewDirection(
      scenePitchDegrees,
      systemObliquityDegrees,
    );
    const frame = prepareFixedMaterialPlane({
      ringData,
      foregroundRingData,
      ringTextureWidth,
      maximumLightingFactor,
      objectLight: shadowless
        ? objectView
        : prepareObjectLightDirection(systemObliquityDegrees),
      objectView,
      scenePitchDegrees,
      systemObliquityDegrees,
      textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
      outputSize: INTERIOR_ATMOSPHERE_SIZE,
      preparedMeshSilhouette: true,
      materialMode: "cutaway-full",
    });
    const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
    const frameRow = Math.floor(frameIndex / INTERIOR_ATMOSPHERE_COLUMNS);
    writeMaterialAtlasTile({
      output,
      outputWidth: INTERIOR_ATMOSPHERE_WIDTH,
      source: frame.output,
      sourceSize: INTERIOR_ATMOSPHERE_SIZE,
      frameX: frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
        INTERIOR_ATMOSPHERE_GUTTER,
      frameY: frameRow * INTERIOR_ATMOSPHERE_STRIDE +
        INTERIOR_ATMOSPHERE_GUTTER,
      gutter: INTERIOR_ATMOSPHERE_GUTTER,
    });
  }
  writeMaterialAtlasTile({
    output,
    outputWidth: INTERIOR_ATMOSPHERE_WIDTH,
    source: defaultFrame,
    sourceSize: PLANET_FIXED_MATERIAL_SIZE,
    frameX: INTERIOR_ATMOSPHERE_DEFAULT_X,
    frameY: INTERIOR_ATMOSPHERE_DEFAULT_Y,
    gutter: INTERIOR_ATMOSPHERE_GUTTER,
  });
  return Object.freeze({
    output,
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees,
  });
}

function publicTexturePath(textureUrl) {
  if (!/^\/scenes\/saturn\/[a-z0-9@.-]+$/u.test(textureUrl)) {
    throw new Error(`Saturn prepared texture URL is invalid: ${textureUrl}`);
  }
  return fileURLToPath(new URL(`../../../../public${textureUrl}`, import.meta.url));
}

function writeMaterialAtlasTile({
  output,
  outputWidth,
  source,
  sourceSize,
  frameX,
  frameY,
  gutter,
}) {
  for (let row = 0; row < sourceSize; row += 1) {
    const sourceStart = row * sourceSize * 4;
    const targetStart = ((frameY + row) * outputWidth + frameX) * 4;
    source.copy(
      output,
      targetStart,
      sourceStart,
      sourceStart + sourceSize * 4,
    );
    for (let amount = 1; amount <= gutter; amount += 1) {
      output.copy(
        output,
        targetStart - amount * 4,
        targetStart,
        targetStart + 4,
      );
      const sourceEnd = targetStart + (sourceSize - 1) * 4;
      output.copy(
        output,
        sourceEnd + amount * 4,
        sourceEnd,
        sourceEnd + 4,
      );
    }
  }
  const rowBytes = (sourceSize + gutter * 2) * 4;
  const firstRowStart = (
    frameY * outputWidth + frameX - gutter
  ) * 4;
  const lastRowStart = firstRowStart +
    (sourceSize - 1) * outputWidth * 4;
  for (let amount = 1; amount <= gutter; amount += 1) {
    output.copy(
      output,
      firstRowStart - amount * outputWidth * 4,
      firstRowStart,
      firstRowStart + rowBytes,
    );
    output.copy(
      output,
      lastRowStart + amount * outputWidth * 4,
      lastRowStart,
      lastRowStart + rowBytes,
    );
  }
}

async function preparePlanetTextures({ baseOnly = false } = {}) {
  const approvedFixedMaterialAsset = await readFile(
    PLANET_FIXED_MATERIAL_SOURCE_PATH,
  );
  const {
    data: approvedReferenceFixedMaterial,
    info: approvedReferenceFixedMaterialInfo,
  } = await sharp(approvedFixedMaterialAsset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const approvedReferenceFixedMaterialRawSha256 = createHash("sha256")
    .update(approvedReferenceFixedMaterial)
    .digest("hex");
  if (approvedReferenceFixedMaterialInfo.width !== PLANET_FIXED_MATERIAL_SIZE ||
      approvedReferenceFixedMaterialInfo.height !== PLANET_FIXED_MATERIAL_SIZE ||
      approvedReferenceFixedMaterialRawSha256 !==
        PLANET_FIXED_MATERIAL_DEFAULT_RAW_SHA256) {
    throw new Error("Saturn approved reference material source changed.");
  }
  const maximumTint = textureTintFactors(
    LIGHTING.directionalLight.intensity,
    LIGHTING.directionalLight.color,
    LIGHTING.ambientLight.color,
    LIGHTING.ambientLight.intensity,
  );
  const maximumLightingFactor = Math.max(
    maximumTint.r,
    maximumTint.g,
    maximumTint.b,
  );
  const surfaceChannelFactors = prepareSurfaceChannelFactors(
    maximumTint,
    maximumLightingFactor,
  );
  await prepareSolarTintedSurface(surfaceChannelFactors);
  const [metadata, cassiniMetadata, preparedSurface] =
    await Promise.all([
    sharp(PLANET_SOURCE_TEXTURE_PATH).metadata(),
    sharp(CASSINI_POLAR_SOURCE_PATH).metadata(),
    sharp(PLANET_SURFACE_TEXTURE_PATH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  if (
    metadata.width !== PLANET_SOURCE_TEXTURE_WIDTH
    || metadata.height !== PLANET_SOURCE_TEXTURE_HEIGHT
  ) {
    throw new Error("Saturn source texture dimensions changed.");
  }
  if (
    cassiniMetadata.width !== CASSINI_POLAR_SOURCE_WIDTH
    || cassiniMetadata.height !== CASSINI_POLAR_SOURCE_HEIGHT
  ) {
    throw new Error("Cassini PIA21611 polar source dimensions changed.");
  }
  if (!Number.isInteger(PLANET_SOURCE_CELL_WIDTH)
    || !Number.isInteger(PLANET_SOURCE_CELL_HEIGHT)) {
    throw new Error("Saturn source texture no longer divides into the UV grid.");
  }
  const rasterSource = await sharp(preparedSurface.data, {
    raw: preparedSurface.info,
  }).resize(
    PLANET_RASTER_SOURCE_WIDTH,
    PLANET_RASTER_SOURCE_HEIGHT,
    { kernel: sharp.kernel.lanczos3 },
  ).raw().toBuffer({ resolveWithObject: true });
  const packedSurface = packProjectiveSurfaceRaster(rasterSource.data, {
    width: rasterSource.info.width,
    height: rasterSource.info.height,
    channels: rasterSource.info.channels,
    bandCount: LATITUDE_SEGMENTS,
    gutter: PLANET_RASTER_GUTTER,
  });
  await sharp(packedSurface.data, { raw: {
    width: packedSurface.packedWidth,
    height: packedSurface.packedHeight,
    channels: rasterSource.info.channels,
  } })
    .removeAlpha()
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
    .toFile(PLANET_BODY_SURFACE_TEXTURE_PATH);
  const { data: ringData, info: ringInfo } = await sharp(RING_TEXTURE_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: filteredRingShadowData, info: filteredRingShadowInfo } =
    await sharp(RING_TEXTURE_PATH)
      .ensureAlpha()
      .blur(RING_SHADOW_FOOTPRINT_BLUR_SIGMA)
      .raw()
      .toBuffer({ resolveWithObject: true });
  if (
    ringInfo.width !== PREPARED_RING_SOURCE.textureSize
    || ringInfo.height !== PREPARED_RING_SOURCE.textureSize
    || ringInfo.channels !== 4
    || filteredRingShadowInfo.width !== ringInfo.width
    || filteredRingShadowInfo.height !== ringInfo.height
    || filteredRingShadowInfo.channels !== 4
  ) {
    throw new Error("Saturn prepared ring texture dimensions changed.");
  }
  const staticWeatherAsset = await readFile(PLANET_WEATHER_SOURCE_PATH);
  const staticWeatherInfo = await sharp(staticWeatherAsset).metadata();
  if (staticWeatherInfo.width !== WEATHER_TEXTURE_WIDTH ||
      staticWeatherInfo.height !== WEATHER_TEXTURE_HEIGHT ||
      staticWeatherInfo.format !== "webp") {
    throw new Error("Saturn static weather source dimensions changed.");
  }
  const initialObjectLight = PREPARED_RING_SOURCE.shadowModel.objectLightDirection;
  const initialObjectView = prepareInitialObjectViewDirection();
  const polarOutput = await preparePolarTextureAtlas({
    ringData: filteredRingShadowData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    surfaceChannelFactors,
  });
  const defaultFixedMaterial = prepareFixedMaterialPlane({
    ringData: filteredRingShadowData,
    foregroundRingData: ringData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
    systemObliquityDegrees: SATURN_OBLIQUITY_DEGREES,
  });
  const defaultInteriorMaterial = prepareFixedMaterialPlane({
    ringData: filteredRingShadowData,
    foregroundRingData: ringData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
    systemObliquityDegrees: SATURN_OBLIQUITY_DEGREES,
    textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
    materialMode: "cutaway-full",
  });
  const preparedMaterialModes = Object.freeze(Object.fromEntries(
    MATERIAL_MODES.map((mode) => {
      const shadowless = mode === "no-shadows" ||
        mode === "ringless-no-shadows";
      const modeRingData = mode === "full" ? filteredRingShadowData : null;
      const modeForegroundRingData = mode.startsWith("ringless")
        ? null
        : ringData;
      const exteriorDefault = mode === "full"
        ? defaultFixedMaterial
        : prepareFixedMaterialPlane({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          objectLight: shadowless ? initialObjectView : initialObjectLight,
          objectView: initialObjectView,
          scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
          systemObliquityDegrees: SATURN_OBLIQUITY_DEGREES,
        });
      const interiorDefault = mode === "full"
        ? defaultInteriorMaterial
        : prepareFixedMaterialPlane({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          objectLight: shadowless ? initialObjectView : initialObjectLight,
          objectView: initialObjectView,
          scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
          systemObliquityDegrees: SATURN_OBLIQUITY_DEGREES,
          textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
          materialMode: "cutaway-full",
        });
      return [mode, Object.freeze({
        exteriorDefault,
        interiorDefault,
        orbitAtlas: prepareOrbitMaterialAtlas({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          defaultFrame: exteriorDefault.output,
          approvedReferenceFrameChanged: mode === "full"
            ? !exteriorDefault.output.equals(approvedReferenceFixedMaterial)
            : null,
          shadowless,
        }),
        interiorAtlas: prepareInteriorMaterialAtlas({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          defaultFrame: interiorDefault.output,
          shadowless,
        }),
      })];
    }),
  ));
  const defaultFixedMaterialRawSha256 = createHash("sha256")
    .update(defaultFixedMaterial.output)
    .digest("hex");
  const approvedReferenceMatchesDefault =
    defaultFixedMaterialRawSha256 === approvedReferenceFixedMaterialRawSha256;
  const orbitMaterialAtlas = preparedMaterialModes.full.orbitAtlas;
  const interiorAtmosphereAtlas = preparedMaterialModes.full.interiorAtlas;
  const interiorLensMaterialAtlases = baseOnly
    ? Object.freeze({})
    : Object.freeze(Object.fromEntries(
      PREPARED_SATURN_LENSES.controls
        .filter(({ falseColor }) => falseColor)
        .map(({ id, interiorMaterialPreparationFile }) => [id, Object.freeze({
          id,
          url: `/scenes/saturn/saturn-interior-atmosphere-${id}.webp`,
          path: resolve(SATURN_STAGING_ROOT, interiorMaterialPreparationFile),
        })]),
    ));
  await Promise.all([
    sharp(polarOutput, {
      raw: {
        width: PLANET_POLAR_TEXTURE_WIDTH,
        height: PLANET_POLAR_TEXTURE_HEIGHT,
        channels: 4,
      },
    })
      .webp({ lossless: true, effort: 6 })
      .toFile(PLANET_POLAR_TEXTURE_PATH),
    writeFile(PLANET_WEATHER_TEXTURE_PATH, staticWeatherAsset),
    sharp(defaultFixedMaterial.output, {
      raw: {
        width: PLANET_FIXED_MATERIAL_SIZE,
        height: PLANET_FIXED_MATERIAL_SIZE,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(PLANET_FIXED_MATERIAL_TEXTURE_PATH),
    sharp(orbitMaterialAtlas.output, {
      raw: {
        width: PLANET_ORBIT_MATERIAL_WIDTH,
        height: PLANET_ORBIT_MATERIAL_HEIGHT,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(PLANET_ORBIT_MATERIAL_TEXTURE_PATH),
    sharp(interiorAtmosphereAtlas.output, {
      raw: {
        width: INTERIOR_ATMOSPHERE_WIDTH,
        height: INTERIOR_ATMOSPHERE_HEIGHT,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(INTERIOR_ATMOSPHERE_TEXTURE_PATH),
    ...MATERIAL_MODES.filter((mode) => mode !== "full").flatMap((mode) => {
      const variantId = materialVariantId(DEFAULT_LENS_ID, mode);
      const prepared = preparedMaterialModes[mode];
      return [
        sharp(prepared.orbitAtlas.output, {
          raw: {
            width: PLANET_ORBIT_MATERIAL_WIDTH,
            height: PLANET_ORBIT_MATERIAL_HEIGHT,
            channels: 4,
          },
        })
          .webp({
            quality: 95,
            alphaQuality: 100,
            smartSubsample: true,
            effort: 6,
          })
          .toFile(orbitMaterialPreparationPath(variantId)),
        sharp(prepared.interiorAtlas.output, {
        raw: {
          width: INTERIOR_ATMOSPHERE_WIDTH,
          height: INTERIOR_ATMOSPHERE_HEIGHT,
          channels: 4,
        },
      })
        .webp({ quality: 96, alphaQuality: 100, smartSubsample: true, effort: 6 })
          .toFile(interiorMaterialPreparationPath(variantId)),
      ];
    }),
  ]);
  await Promise.all([
    optimizePreparedQ75Webp(PLANET_POLAR_TEXTURE_PATH),
  ]);
  if (baseOnly) return;
  const materialLensIds = Object.freeze([
    DEFAULT_LENS_ID,
    ...PREPARED_SATURN_LENSES.controls
      .filter(({ falseColor }) => falseColor)
      .map(({ id }) => id),
  ]);
  const materialVariantIds = Object.freeze(materialLensIds.flatMap((lensId) =>
    MATERIAL_MODES.map((mode) => materialVariantId(lensId, mode))));
  const orbitMaterialRuntimeVariants = Object.freeze(Object.fromEntries(
    await Promise.all(materialVariantIds.map(async (variantId) => [
      variantId,
      await prepareOrbitMaterialRuntimeShards({
        variantId,
        path: orbitMaterialPreparationPath(variantId),
      }),
    ])),
  ));
  const orbitMaterialRuntimeShards =
    orbitMaterialRuntimeVariants[DEFAULT_LENS_ID];
  const interiorAtmosphereRuntimeShards = Object.freeze(Object.fromEntries(
    await Promise.all(materialVariantIds.map(async (variantId) => [
      variantId,
      await prepareInteriorAtmosphereRuntimeShards({
        assetUrl: interiorMaterialVariantTextureUrl(variantId),
        path: interiorMaterialPreparationPath(variantId),
      }),
    ])),
  ));
  const [
    surfaceAsset,
    bodySurfaceAsset,
    polarAsset,
    fixedMaterialAsset,
    orbitMaterialAsset,
    interiorAtmosphereAsset,
    weatherAsset,
  ] =
    await Promise.all([
    readFile(PLANET_SURFACE_TEXTURE_PATH),
    readFile(PLANET_BODY_SURFACE_TEXTURE_PATH),
    readFile(PLANET_POLAR_TEXTURE_PATH),
    readFile(PLANET_FIXED_MATERIAL_TEXTURE_PATH),
    readFile(publicTexturePath(PLANET_ORBIT_MATERIAL_TEXTURE_URL)),
    readFile(publicTexturePath(INTERIOR_ATMOSPHERE_TEXTURE_URL)),
    readFile(PLANET_WEATHER_TEXTURE_PATH),
    ]);
  const interiorAtmosphereLensAssets = Object.freeze(Object.fromEntries(
    await Promise.all(Object.values(interiorLensMaterialAtlases).map(
      async (atlas) => {
        const bytes = await readFile(publicTexturePath(atlas.url));
        return [atlas.id, Object.freeze({
          url: atlas.url,
          bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        })];
      },
    )),
  ));
  const fixedMaterialLeaf = Object.freeze({
    ...defaultFixedMaterial.leaf,
    style: defaultFixedMaterial.leaf.style
      .replace(
        `background-image:url(${PLANET_FIXED_MATERIAL_TEXTURE_URL})`,
        `background-image:url(${PLANET_ORBIT_MATERIAL_TEXTURE_URL})`,
      )
      .replace(
        `background-size:${PLANET_FIXED_MATERIAL_SIZE}px ` +
          `${PLANET_FIXED_MATERIAL_SIZE}px`,
        `background-position:-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px` +
          `;background-size:${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
      ),
  });
  const orbitMaterialPresentationScale =
    PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE;
  const orbitMaterialDefaultPreparedFrame = Math.round(
    (CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES -
      CAMERA_ROTATION_X_DEGREES) /
      CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES *
      (PLANET_ORBIT_MATERIAL_FRAME_COUNT - 1),
  );
  const orbitMaterialDefaultPreparedRow = Math.floor(
    orbitMaterialDefaultPreparedFrame / PLANET_ORBIT_MATERIAL_COLUMNS,
  );
  const orbitMaterialInitialWarmRows = Object.freeze([
    orbitMaterialDefaultPreparedRow - 1,
    orbitMaterialDefaultPreparedRow,
    orbitMaterialDefaultPreparedRow + 1,
  ].filter((rowIndex) => rowIndex >= 0 &&
    rowIndex < PLANET_ORBIT_MATERIAL_ROWS));
  const orbitMaterialRuntimeVariantPlans = Object.freeze(Object.fromEntries(
    Object.entries(orbitMaterialRuntimeVariants).map(([id, shards]) => {
      const presentations = Object.freeze(Array.from(
        { length: PLANET_ORBIT_MATERIAL_FRAME_COUNT },
        (_, frameIndex) => {
          const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
          const rowIndex = Math.floor(
            frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS,
          );
          return Object.freeze({
            frameIndex,
            rowIndex,
            assetUrl: shards.runtimeAtlas.assetUrl,
            backgroundPosition:
              `${-(frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
                PLANET_ORBIT_MATERIAL_GUTTER) *
                orbitMaterialPresentationScale}px ` +
              `${-(rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT +
                PLANET_ORBIT_MATERIAL_GUTTER) *
                orbitMaterialPresentationScale}px`,
            backgroundSize:
              `${PLANET_ORBIT_MATERIAL_WIDTH *
                orbitMaterialPresentationScale}px ` +
              `${PLANET_ORBIT_MATERIAL_HEIGHT *
                orbitMaterialPresentationScale}px`,
          });
        },
      ));
      return [id, Object.freeze({
        id,
        sourceDecodedSha256: shards.sourceDecodedSha256,
        exactVisibleDecodedCropVerification:
          shards.exactVisibleDecodedCropVerification,
        runtimeAtlas: shards.runtimeAtlas,
        initialWarmRows: orbitMaterialInitialWarmRows,
        defaultPresentation: Object.freeze({
          ...shards.runtimeAtlas,
          backgroundPosition:
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
          backgroundSize:
            `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
            `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        }),
        rows: shards.rows,
        presentations,
      })];
    }),
  ));
  const orbitMaterialRuntimePresentations =
    orbitMaterialRuntimeVariantPlans[DEFAULT_LENS_ID].presentations;
  const interiorAtmospherePresentationScale =
    PLANET_FIXED_MATERIAL_SIZE / INTERIOR_ATMOSPHERE_SIZE;
  const interiorAtmosphereDefaultFrame = Math.round(
    (CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES -
      CAMERA_ROTATION_X_DEGREES) /
      CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES *
      (INTERIOR_ATMOSPHERE_FRAME_COUNT - 1),
  );
  const interiorAtmosphereDefaultPreparedRow = Math.floor(
    interiorAtmosphereDefaultFrame / INTERIOR_ATMOSPHERE_COLUMNS,
  );
  const interiorAtmosphereInitialWarmRows = Object.freeze([
    interiorAtmosphereDefaultPreparedRow - 1,
    interiorAtmosphereDefaultPreparedRow,
    interiorAtmosphereDefaultPreparedRow + 1,
  ].filter((rowIndex) => rowIndex >= 0 &&
    rowIndex < INTERIOR_ATMOSPHERE_ROWS));
  const interiorAtmosphereRuntimeVariants = Object.freeze(Object.fromEntries(
    Object.entries(interiorAtmosphereRuntimeShards).map(([id, shards]) => {
      const presentations = Object.freeze(Array.from(
        { length: INTERIOR_ATMOSPHERE_FRAME_COUNT },
        (_, frameIndex) => {
          const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
          const rowIndex = Math.floor(
            frameIndex / INTERIOR_ATMOSPHERE_COLUMNS,
          );
          return Object.freeze({
            frameIndex,
            rowIndex,
            assetUrl: shards.runtimeAtlas.assetUrl,
            backgroundPosition:
              `${-(frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px ` +
              `${-(rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px`,
            backgroundSize:
              `${INTERIOR_ATMOSPHERE_WIDTH *
                interiorAtmospherePresentationScale}px ` +
              `${INTERIOR_ATMOSPHERE_HEIGHT *
                interiorAtmospherePresentationScale}px`,
          });
        },
      ));
      return [id, Object.freeze({
        sourceAssetUrl: shards.sourceAssetUrl,
        sourceDecodedSha256: shards.sourceDecodedSha256,
        exactVisibleDecodedCropVerification:
          shards.exactVisibleDecodedCropVerification,
        runtimeAtlas: shards.runtimeAtlas,
        defaultPresentation: Object.freeze({
          ...shards.runtimeAtlas,
          backgroundPosition:
            `-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
            `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px`,
          backgroundSize:
            `${INTERIOR_ATMOSPHERE_WIDTH}px ` +
            `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
        }),
        rows: shards.rows,
        presentations,
      })];
    }),
  ));
  const interiorAtmosphereLeaf = Object.freeze({
    ...defaultInteriorMaterial.leaf,
    className: "saturn-interior-material",
    style: defaultInteriorMaterial.leaf.style
      .replace(
        `background-image:url(${INTERIOR_ATMOSPHERE_TEXTURE_URL})`,
        `background-image:url(${INTERIOR_ATMOSPHERE_TEXTURE_URL})`,
      )
      .replace(
        `background-size:${PLANET_FIXED_MATERIAL_SIZE}px ` +
          `${PLANET_FIXED_MATERIAL_SIZE}px`,
        `background-position:-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
          `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px` +
          `;background-size:${INTERIOR_ATMOSPHERE_WIDTH}px ` +
          `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
      ),
  });
  return Object.freeze({
    surface: Object.freeze({
      mode: "prepared-static-hd-equirectangular-surface",
      sourcePath: "source/saturn-surface-original.jpg",
      assetUrl: PLANET_BODY_SURFACE_TEXTURE_URL,
      assetBytes: bodySurfaceAsset.byteLength,
      assetSha256: createHash("sha256")
        .update(bodySurfaceAsset)
        .digest("hex"),
      sourceAssetUrl: PLANET_SURFACE_TEXTURE_URL,
      sourceAssetBytes: surfaceAsset.byteLength,
      sourceAssetSha256: createHash("sha256")
        .update(surfaceAsset)
        .digest("hex"),
      faceCount: PLANET_TEXTURE_FACE_COUNT,
      uvLayout: "equirectangular-2-to-1-direct-longitude-latitude",
      sourceCellWidth: PLANET_SOURCE_CELL_WIDTH,
      sourceCellHeight: PLANET_SOURCE_CELL_HEIGHT,
      rasterCellSize: PLANET_RASTER_CELL_SIZE,
      solarColor: SATURN_SOLAR_ALBEDO_MULTIPLIER,
      solarColorModel:
        "Planck-5772K-CIE1931-linear-sRGB-D65-max-normalized",
      solarTintPreparation: "linear-light-static-albedo-multiplication",
      projectiveLeafOrientation:
        "prepared-latitude-strip-north-south-correction",
      polarCaps: Object.freeze({
        model: "prepared-cassini-north-polar-projection-under-fixed-world-material-plane",
        assetUrl: PLANET_POLAR_TEXTURE_URL,
        assetBytes: polarAsset.byteLength,
        assetSha256: createHash("sha256").update(polarAsset).digest("hex"),
        encoding: PREPARED_Q75_WEBP_ENCODING,
        alphaEncoding: "lossless",
        tileSize: PLANET_POLAR_TEXTURE_SIZE,
        tileCount: PLANET_POLAR_TEXTURE_TILE_COUNT,
        atlasWidth: PLANET_POLAR_TEXTURE_WIDTH,
        atlasHeight: PLANET_POLAR_TEXTURE_HEIGHT,
        sourceLatitudeRowsPerPole: PLANET_SOURCE_CELL_HEIGHT,
        surfaceLeafCount: 2,
        innerSurfaceLeafCount: 2,
        materialLeafCount: 0,
        innerMaterialLeafCount: 0,
        innerOverlap: PLANET_POLAR_INNER_OVERLAP,
        innerInset: PLANET_POLAR_INNER_INSET,
        innerBoundarySampling: "outer-cap-boundary-clamped",
        fixedWorldMaterial: true,
        runtimeMath: false,
        northSource: Object.freeze({
          product: "Cassini PIA21611 2017 natural-color polar stereographic map",
          sourcePath: "source/cassini-pia21611.jpg",
          sourceSha256:
            "2e9765b2ffada33d74bfbe0443ea0bbf59bb15f27a128b7ba99160fdeb78f177",
          sourceTile: Object.freeze({
            x: CASSINI_2017_TILE_LEFT,
            y: 0,
            width: CASSINI_POLAR_TILE_SIZE,
            height: CASSINI_POLAR_TILE_SIZE,
          }),
          projection: "north-polar-stereographic",
          sourceKmPerPixel: CASSINI_POLAR_KM_PER_PIXEL,
          boundaryBlendStart: CASSINI_POLAR_BLEND_START,
          boundaryAuthority: "OpenSpace saturn.jpg",
          authority:
            "https://science.nasa.gov/photojournal/saturns-hexagon-as-summer-solstice-approaches/",
        }),
      }),
      atlasWidth: PLANET_SOURCE_TEXTURE_WIDTH,
      atlasHeight: PLANET_SOURCE_TEXTURE_HEIGHT,
      equivalentBodySampleWidth: LONGITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE,
      equivalentBodySampleHeight:
        (LATITUDE_SEGMENTS - 2) * PLANET_RASTER_CELL_SIZE,
      seamRepair: Object.freeze({
        model: "prepared-zero-seam-bleed-with-compositor-overlap",
        seamBleed: PLANET_SEAM_BLEED,
        topologyOverlap: 0,
        presentationOverlap: SURFACE_OVERLAP,
        rasterGutter: PLANET_RASTER_GUTTER,
        rasterOverscan: PLANET_RASTER_OVERSCAN,
        runtimeEdgeDiscovery: false,
      }),
    }),
    lighting: Object.freeze({
      mode: "prepared-view-bank-single-material-plane-orbit-projection",
      sourceUrl: PLANET_SURFACE_TEXTURE_URL,
      assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
      assetBytes: orbitMaterialAsset.byteLength,
      assetSha256: createHash("sha256").update(orbitMaterialAsset).digest("hex"),
      frameCount: PLANET_ORBIT_MATERIAL_FRAME_COUNT,
      frameRate: 0,
      faceCount: 1,
      tileWidth: PLANET_FIXED_MATERIAL_SIZE,
      tileHeight: PLANET_FIXED_MATERIAL_SIZE,
      defaultViewDegrees: CAMERA_ROTATION_X_DEGREES,
      defaultFrameRawSha256: defaultFixedMaterialRawSha256,
      approvedReferenceFrameRawSha256:
        approvedReferenceFixedMaterialRawSha256,
      approvedReferenceMatchesDefault,
      defaultAsset: Object.freeze({
        preparationPath: ".prepared/saturn-fixed-material.webp",
        assetBytes: fixedMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(fixedMaterialAsset)
          .digest("hex"),
        embeddedInOrbitAtlas: true,
        backgroundPosition:
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
        backgroundSize:
          `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        runtimePresentation: Object.freeze({
          assetUrl: orbitMaterialRuntimeShards.runtimeAtlas.assetUrl,
          assetBytes: orbitMaterialRuntimeShards.runtimeAtlas.assetBytes,
          assetSha256:
            orbitMaterialRuntimeShards.runtimeAtlas.assetSha256,
          backgroundPosition:
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
          backgroundSize:
            `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
            `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
          exactDecodedCrop: true,
        }),
      }),
      approvedReferenceAsset: Object.freeze({
        sourcePath: "source/approved/saturn-fixed-material.webp",
        assetBytes: approvedFixedMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(approvedFixedMaterialAsset)
          .digest("hex"),
        rawSha256: approvedReferenceFixedMaterialRawSha256,
        embeddedInOrbitAtlas: false,
      }),
      presentationScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
      projection: defaultFixedMaterial.projection,
      leaf: fixedMaterialLeaf,
      interpolation:
        "dense-nearest-prepared-view-with-continuous-plane-projection",
      lightSpace: "prepared-fixed-world-light-per-orbit-view",
      addressPublication:
        "single-transform-and-prepared-background-address-on-input-frame",
      composition:
        "prepared-final-material-composite-over-retained-scene-with-foreground-ring-rgb-ordering",
      retainedOverlayBinding:
        "one-mount-time-retained-final-composite-texture-leaf",
      foregroundRingOrdering: Object.freeze({
        model: "prepared-ring-rgb-over-material-with-material-alpha-retained",
        sourceAssetUrl: RING_TEXTURE_URL,
        compositedTexelCount:
          defaultFixedMaterial.foregroundRingCompositedTexelCount,
        meanSampledOpacity: defaultFixedMaterial.meanForegroundRingOpacity,
        screenshotDerived: false,
        runtimeMath: false,
        extraDomLeaves: 0,
      }),
      animatedCustomProperties: 0,
      animatedPseudoElements: 0,
      runtimeBlendMode: false,
      runtimeFilter: false,
      runtimeLightingMath: false,
      runtimeRasterization: false,
      runtimeAddressWrites:
        "one-retained-leaf-prepared-address-on-published-input-frame",
      runtimeMatrixFormatting: false,
      extraDomLeaves: 1,
      materialModel:
        "openspace-globe-solar-rgb-lambert-terminator-attenuation-oblate-texels",
      atmosphere: Object.freeze({
        model: "prepared-view-light-limb-scattering-oblate-texels",
        compositedIntoMaterialAsset: true,
        assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
        assetBytes: orbitMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(orbitMaterialAsset)
          .digest("hex"),
        color: `#${ATMOSPHERE_COLOR.map((channel) =>
          channel.toString(16).padStart(2, "0")).join("")}`,
        maximumAlpha: ATMOSPHERE_MAXIMUM_ALPHA,
        limbExponent: ATMOSPHERE_LIMB_EXPONENT,
        nightFloor: ATMOSPHERE_NIGHT_FLOOR,
        initialObjectViewDirection: initialObjectView.map((component) =>
          Number(component.toFixed(6))),
        retainedOverlayBinding:
          "one-mount-time-retained-final-composite-texture-leaf",
        atlasLayer: "prepared-approved-material-plane",
        runtimeMath: false,
        extraDomLeaves: 1,
      }),
      interiorAtmosphere: Object.freeze({
        model: "prepared-cutaway-full-exterior-material-oblate-texels",
        assetUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
        assetBytes: interiorAtmosphereAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(interiorAtmosphereAsset)
          .digest("hex"),
        lensAssets: Object.freeze({
          normal: Object.freeze({
            url: INTERIOR_ATMOSPHERE_TEXTURE_URL,
            bytes: interiorAtmosphereAsset.byteLength,
            sha256: createHash("sha256")
              .update(interiorAtmosphereAsset)
              .digest("hex"),
          }),
          ...interiorAtmosphereLensAssets,
        }),
        runtimeShards: Object.freeze({
          model: "prepared-variant-single-atlas",
          defaultVariant: DEFAULT_LENS_ID,
          defaultPreparedFrame: interiorAtmosphereDefaultFrame,
          defaultPreparedRow: interiorAtmosphereDefaultPreparedRow,
          initialWarmRows: interiorAtmosphereInitialWarmRows,
          maximumRetainedAtlasCount: 1,
          variants: interiorAtmosphereRuntimeVariants,
          initialDecodedWorkingSetBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          maximumDecodedWorkingSetBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          fullAtlasDecodedRgbaBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          runtimeDecodePolicy:
            "one-active-variant-atlas-decoded-before-presentation",
        }),
        frameCount: INTERIOR_ATMOSPHERE_FRAME_COUNT,
        frameColumns: INTERIOR_ATMOSPHERE_COLUMNS,
        frameRows: INTERIOR_ATMOSPHERE_ROWS,
        tileSize: INTERIOR_ATMOSPHERE_SIZE,
        frameGutter: INTERIOR_ATMOSPHERE_GUTTER,
        frameStride: INTERIOR_ATMOSPHERE_STRIDE,
        atlasWidth: INTERIOR_ATMOSPHERE_WIDTH,
        atlasHeight: INTERIOR_ATMOSPHERE_HEIGHT,
        presentationTileSize: PLANET_FIXED_MATERIAL_SIZE,
        presentationAtlasWidth: INTERIOR_ATMOSPHERE_WIDTH *
          interiorAtmospherePresentationScale,
        presentationAtlasHeight: INTERIOR_ATMOSPHERE_HEIGHT *
          interiorAtmospherePresentationScale,
        minimumScenePitchDegrees: 0,
        maximumScenePitchDegrees:
          CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES,
        defaultFrame: interiorAtmosphereDefaultFrame,
        defaultBackgroundPosition:
          `-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
          `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px`,
        defaultBackgroundSize:
          `${INTERIOR_ATMOSPHERE_WIDTH}px ` +
          `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
        backgroundPositions: Object.freeze(Array.from(
          { length: INTERIOR_ATMOSPHERE_FRAME_COUNT },
          (_, frameIndex) => {
            const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
            const frameRow = Math.floor(
              frameIndex / INTERIOR_ATMOSPHERE_COLUMNS,
            );
            return `${-(frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
              INTERIOR_ATMOSPHERE_GUTTER) *
              interiorAtmospherePresentationScale}px ` +
              `${-(frameRow * INTERIOR_ATMOSPHERE_STRIDE +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px`;
          },
        )),
        leaf: interiorAtmosphereLeaf,
        cutaway: PREPARED_SATURN_VIEWS.cutaway,
        composition:
          "same-exterior-light-terminator-ring-shadow-atmosphere-and-ring-ordering",
        defaultHighResolution: true,
        interpolation: "nearest-prepared-view",
        runtimeRasterization: false,
        runtimeLightingMath: false,
        extraDomLeaves: 1,
      }),
      orbitAtlas: Object.freeze({
        model: "prepared-fixed-world-light-and-ring-shadow-view-bank",
        assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
        assetBytes: orbitMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(orbitMaterialAsset)
          .digest("hex"),
        frameCount: PLANET_ORBIT_MATERIAL_FRAME_COUNT,
        frameColumns: PLANET_ORBIT_MATERIAL_COLUMNS,
        frameRows: PLANET_ORBIT_MATERIAL_ROWS,
        tileSize: PLANET_ORBIT_MATERIAL_SIZE,
        frameGutter: PLANET_ORBIT_MATERIAL_GUTTER,
        frameStride: PLANET_ORBIT_MATERIAL_STRIDE,
        atlasWidth: PLANET_ORBIT_MATERIAL_WIDTH,
        atlasHeight: PLANET_ORBIT_MATERIAL_HEIGHT,
        presentationTileSize: PLANET_FIXED_MATERIAL_SIZE,
        presentationAtlasWidth:
          PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE,
        presentationAtlasHeight:
          PLANET_ORBIT_MATERIAL_HEIGHT *
            PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE,
        defaultBackgroundPosition:
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
        defaultBackgroundSize:
          `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        minimumScenePitchDegrees:
          orbitMaterialAtlas.minimumScenePitchDegrees,
        maximumScenePitchDegrees:
          orbitMaterialAtlas.maximumScenePitchDegrees,
        preparedMeshSilhouette:
          orbitMaterialAtlas.preparedMeshSilhouette,
        ringShadowFootprint:
          orbitMaterialAtlas.ringShadowFootprint,
        backgroundPositions: Object.freeze(Array.from(
          { length: PLANET_ORBIT_MATERIAL_FRAME_COUNT },
          (_, frameIndex) => {
            const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
            const frameRow = Math.floor(
              frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS,
            );
            const presentationScale = PLANET_FIXED_MATERIAL_SIZE /
              PLANET_ORBIT_MATERIAL_SIZE;
            return `${-(frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
              PLANET_ORBIT_MATERIAL_GUTTER) * presentationScale}px ` +
              `${-(frameRow * PLANET_ORBIT_MATERIAL_STRIDE +
                PLANET_ORBIT_MATERIAL_GUTTER) * presentationScale}px`;
          },
        )),
        runtimeShards: Object.freeze({
          model: "prepared-variant-single-atlas",
          defaultVariant: DEFAULT_LENS_ID,
          variants: orbitMaterialRuntimeVariantPlans,
          sourceAssetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
          sourceDecodedSha256:
            orbitMaterialRuntimeShards.sourceDecodedSha256,
          alphaExactDecodedCropVerification:
            orbitMaterialRuntimeShards.alphaExactDecodedCropVerification,
          selectiveVisibleRgbEncoding:
            orbitMaterialRuntimeShards.selectiveVisibleRgbEncoding,
          q75AssetUrls: orbitMaterialRuntimeShards.q75AssetUrls,
          exactVisibleDecodedCropVerification:
            orbitMaterialRuntimeShards.exactVisibleDecodedCropVerification,
          defaultPreparedFrame: orbitMaterialDefaultPreparedFrame,
          defaultPreparedRow: orbitMaterialDefaultPreparedRow,
          initialWarmRows: orbitMaterialInitialWarmRows,
          maximumRetainedAtlasCount: 1,
          defaultPresentation: Object.freeze({
            ...orbitMaterialRuntimeShards.runtimeAtlas,
            backgroundPosition:
              `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
              `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
            backgroundSize:
              `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
              `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
          }),
          rows: orbitMaterialRuntimeShards.rows,
          presentations: orbitMaterialRuntimePresentations,
          initialDecodedWorkingSetBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          maximumDecodedWorkingSetBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          fullAtlasDecodedRgbaBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          runtimeDecodePolicy:
            "one-active-variant-atlas-decoded-before-presentation",
        }),
        ringShadowMotionEvidence:
          orbitMaterialAtlas.ringShadowMotionEvidence,
        runtimeRasterization: false,
        runtimeAddressWrites:
          "single-background-position-on-published-input-frame",
      }),
      weather: Object.freeze({
        model: "prepared-source-texel-independent-fixed-center-curls",
        assetUrl: PLANET_WEATHER_TEXTURE_URL,
        assetBytes: weatherAsset.byteLength,
        assetSha256: createHash("sha256").update(weatherAsset).digest("hex"),
        encoding: PREPARED_Q75_WEBP_ENCODING,
        alphaEncoding: "lossless",
        opacity: WEATHER_OPACITY,
        targetFaceCount: WEATHER_TARGET_FACE_COUNT,
        targetFaceIndices: WEATHER_TARGET_FACE_INDICES,
        targetFaceOrdinals: WEATHER_TARGET_FACE_ORDINALS,
        storms: Object.freeze(WEATHER_STORMS.map((storm, stormIndex) =>
          Object.freeze({
            stormIndex,
            latitudeIndex: storm.latitudeIndex,
            latitudeDegrees: Number((
              -90 + (storm.latitudeIndex + 0.5) * 180 / LATITUDE_SEGMENTS
            ).toFixed(3)),
            longitudeStartIndex: storm.longitudeStartIndex,
            longitudeCount: storm.longitudeCount,
            targetFaceIndices: Object.freeze(
              WEATHER_TARGET_FACE_INDICES.slice(
                stormIndex * WEATHER_PATCH_COLUMNS,
                (stormIndex + 1) * WEATHER_PATCH_COLUMNS,
              ),
            ),
            sourceRect: Object.freeze({
              x: storm.longitudeStartIndex * PLANET_SOURCE_CELL_WIDTH,
              y: (LATITUDE_SEGMENTS - 1 - storm.latitudeIndex) *
                PLANET_SOURCE_CELL_HEIGHT,
              width: storm.longitudeCount * PLANET_SOURCE_CELL_WIDTH,
              height: PLANET_SOURCE_CELL_HEIGHT,
            }),
            sourceCenter: storm.sourceCenter,
            sourceRadius: storm.sourceRadius,
            phaseOffsetTurns: storm.phaseOffsetTurns,
            rotationTurnsPerCycle: storm.rotationTurnsPerCycle,
            sourceMotionGain: storm.sourceMotionGain,
            armCount: storm.armCount,
            armProfileExponent: storm.armProfileExponent,
            radialFrequency: storm.radialFrequency,
            armPhaseRate: storm.armPhaseRate,
            eyeWallRadius: storm.eyeWallRadius,
            eyeWallWidth: storm.eyeWallWidth,
            brightArmAmplitude: storm.brightArmAmplitude,
            brightEyeWallAmplitude: storm.brightEyeWallAmplitude,
            bodyLiftAmplitude: storm.bodyLiftAmplitude,
            darkEyeAmplitude: storm.darkEyeAmplitude,
          }),
        )),
        cellSize: WEATHER_CELL_SIZE,
        fieldColumns: WEATHER_FIELD_COLUMNS,
        fieldRows: WEATHER_FIELD_ROWS,
        fieldWidth: WEATHER_FIELD_WIDTH,
        fieldHeight: WEATHER_FIELD_HEIGHT,
        frameCount: WEATHER_FRAME_COUNT,
        frameRate: WEATHER_FRAME_RATE,
        frameGutter: WEATHER_FRAME_GUTTER,
        frameStrideX: WEATHER_FRAME_STRIDE_X,
        frameStrideY: WEATHER_FRAME_STRIDE_Y,
        frameColumns: WEATHER_FRAME_COLUMNS,
        frameRows: WEATHER_FRAME_ROWS,
        atlasWidth: WEATHER_TEXTURE_WIDTH,
        atlasHeight: WEATHER_TEXTURE_HEIGHT,
        presentationScale: WEATHER_PRESENTATION_SCALE,
        sourceSnapshotPath: "source/saturn-weather-static.webp",
        sourceSnapshotSha256: createHash("sha256")
          .update(staticWeatherAsset)
          .digest("hex"),
        retainedOverlayBinding: "existing-mount-time-retained-bare-texture-leaf-references",
        addressPublication: "none-static-prepared-texels",
        runtimePlayback: false,
        lensVisibility: "normal-visible-color-only",
        runtimeMath: false,
        runtimeRasterization: false,
        extraDomLeaves: 0,
      }),
      sourceRenderer:
        "OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl",
      illuminationDirectionAuthority: "OpenSpace default scene-graph Sun direction",
      solarEffectiveTemperatureKelvin: SOLAR_EFFECTIVE_TEMPERATURE_KELVIN,
      rendererAlbedoMultiplier: SATURN_SOLAR_ALBEDO_MULTIPLIER,
      rendererAlbedoMultiplierModel:
        "Planck-5772K-CIE1931-linear-sRGB-D65-max-normalized",
      ambientIntensity: OPENSPACE_GLOBE_AMBIENT_INTENSITY,
      orenNayarRoughness: OPENSPACE_GLOBE_OREN_NAYAR_ROUGHNESS,
      terminatorSmoothstep: OPENSPACE_GLOBE_TERMINATOR_SMOOTHSTEP,
      directionalLight: LIGHTING.directionalLight,
      ambientLight: LIGHTING.ambientLight,
      mutualShadows: Object.freeze({
        model: PREPARED_RING_SOURCE.shadowModel.model,
        runtime: false,
        saturnOnRings: PREPARED_RING_SOURCE.shadowModel.saturnOnRings,
        ringsOnSaturn: Object.freeze({
          ...PREPARED_RING_SOURCE.shadowModel.ringsOnSaturn,
          directTransmissionAtOpaqueRing: RING_SHADOW_DIRECT_TRANSMISSION,
          shadowedTexelCount: defaultFixedMaterial.ringShadowedTexelCount,
          meanSampledOpacity: defaultFixedMaterial.meanSampledRingOpacity,
          maxSampledOpacity: defaultFixedMaterial.maxSampledRingOpacity,
          footprintFilter: Object.freeze({
            model: "prepared-gaussian-ring-opacity-footprint",
            sigmaPixels: RING_SHADOW_FOOTPRINT_BLUR_SIGMA,
            runtime: false,
          }),
        }),
      }),
    }),
  });
}

function encodePreparedLightingSchedule(materialOutput) {
  const bandCount = LATITUDE_SEGMENTS - 2;
  const facesPerBand = LONGITUDE_SEGMENTS;
  const frameCount = PLANET_LIGHTING_FRAME_COUNT;
  const visibility = prepareDilatedBodyFaceVisibility();
  const offsets = new Uint32Array(bandCount * (frameCount + 1));
  const visibleOffsets = new Uint32Array(bandCount * (frameCount + 1));
  const localFaceIndices = [];
  const visibleLocalFaceIndices = [];
  let maximumAssignmentsPerBandFrame = 0;
  let maximumVisibleFacesPerBandFrame = 0;
  let exactHeldTransitionCount = 0;
  let hiddenTransitionSuppressionCount = 0;
  let visibleEntryCatchupCount = 0;
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const offsetBase = bandIndex * (frameCount + 1);
    offsets[offsetBase] = localFaceIndices.length;
    visibleOffsets[offsetBase] = visibleLocalFaceIndices.length;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const previousFrame = (frameIndex + frameCount - 1) % frameCount;
      const assignmentStart = localFaceIndices.length;
      const visibleStart = visibleLocalFaceIndices.length;
      for (let localFaceIndex = 0; localFaceIndex < facesPerBand; localFaceIndex += 1) {
        const faceIndex = bandIndex * facesPerBand + localFaceIndex;
        const visibilityIndex = (
          (bandIndex * frameCount + frameIndex) * facesPerBand + localFaceIndex
        );
        if (visibility[visibilityIndex] === 0) {
          hiddenTransitionSuppressionCount += 1;
          continue;
        }
        visibleLocalFaceIndices.push(localFaceIndex);
        const previousVisibilityIndex = (
          (bandIndex * frameCount + previousFrame) * facesPerBand + localFaceIndex
        );
        const becameVisible = visibility[previousVisibilityIndex] === 0;
        const preparedWeatherTransition =
          weatherTargetOrdinal(faceIndex) >= 0 &&
          frameIndex % WEATHER_LIGHTING_FRAME_DIVISOR === 0;
        if (
          !becameVisible &&
          !preparedWeatherTransition &&
          preparedOverlayCellEquals(
            materialOutput,
            faceIndex,
            previousFrame,
            frameIndex,
          )
        ) {
          exactHeldTransitionCount += 1;
          continue;
        }
        if (becameVisible) visibleEntryCatchupCount += 1;
        localFaceIndices.push(localFaceIndex);
      }
      const assignmentCount = localFaceIndices.length - assignmentStart;
      const visibleCount = visibleLocalFaceIndices.length - visibleStart;
      maximumAssignmentsPerBandFrame = Math.max(
        maximumAssignmentsPerBandFrame,
        assignmentCount,
      );
      maximumVisibleFacesPerBandFrame = Math.max(
        maximumVisibleFacesPerBandFrame,
        visibleCount,
      );
      offsets[offsetBase + frameIndex + 1] = localFaceIndices.length;
      visibleOffsets[offsetBase + frameIndex + 1] = visibleLocalFaceIndices.length;
    }
  }
  const headerBytes = 32;
  const assignmentCount = localFaceIndices.length;
  const visibleAssignmentCount = visibleLocalFaceIndices.length;
  const bytes = Buffer.alloc(
    headerBytes + offsets.byteLength + assignmentCount +
      visibleOffsets.byteLength + visibleAssignmentCount,
  );
  bytes.write("CSLS", 0, 4, "ascii");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(4, 2, true);
  view.setUint16(6, bandCount, true);
  view.setUint16(8, facesPerBand, true);
  view.setUint16(10, frameCount, true);
  view.setUint32(12, assignmentCount, true);
  view.setUint32(16, offsets.length, true);
  view.setUint32(20, visibleAssignmentCount, true);
  view.setUint32(24, visibleOffsets.length, true);
  view.setUint32(28, headerBytes, true);
  let cursor = headerBytes;
  Buffer.from(offsets.buffer, offsets.byteOffset, offsets.byteLength).copy(bytes, cursor);
  cursor += offsets.byteLength;
  Buffer.from(localFaceIndices).copy(bytes, cursor);
  cursor += assignmentCount;
  Buffer.from(
    visibleOffsets.buffer,
    visibleOffsets.byteOffset,
    visibleOffsets.byteLength,
  ).copy(bytes, cursor);
  cursor += visibleOffsets.byteLength;
  Buffer.from(visibleLocalFaceIndices).copy(bytes, cursor);
  return Object.freeze({
    bytes,
    offsetsCount: offsets.length,
    assignmentCount,
    visibleOffsetsCount: visibleOffsets.length,
    visibleAssignmentCount,
    meanAssignmentsPerBandFrame: Number(
      (assignmentCount / (bandCount * frameCount)).toFixed(6),
    ),
    meanVisibleFacesPerBandFrame: Number(
      (visibleAssignmentCount / (bandCount * frameCount)).toFixed(6),
    ),
    maximumAssignmentsPerBandFrame,
    maximumVisibleFacesPerBandFrame,
    exactHeldTransitionCount,
    hiddenTransitionSuppressionCount,
    visibleEntryCatchupCount,
  });
}

function prepareDilatedBodyFaceVisibility() {
  const bandCount = LATITUDE_SEGMENTS - 2;
  const frameCount = PLANET_LIGHTING_FRAME_COUNT;
  const facesPerBand = LONGITUDE_SEGMENTS;
  const raw = new Uint8Array(bandCount * frameCount * facesPerBand);
  const dilated = new Uint8Array(raw.length);
  const faceNormals = prepareBodyFaceNormals();
  const initialObjectView = prepareInitialObjectViewDirection();
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const phase = frameIndex / frameCount * Math.PI * 2;
      const objectView = rotateZ(initialObjectView, -phase);
      const frameBase = (
        bandIndex * frameCount + frameIndex
      ) * facesPerBand;
      for (let localFaceIndex = 0;
        localFaceIndex < facesPerBand;
        localFaceIndex += 1) {
        const normal = faceNormals[bandIndex * facesPerBand + localFaceIndex];
        raw[frameBase + localFaceIndex] = dotVector(normal, objectView) > 0 ? 1 : 0;
      }
    }
  }
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const previousFrame = (frameIndex + frameCount - 1) % frameCount;
      const nextFrame = (frameIndex + 1) % frameCount;
      const frameBase = (
        bandIndex * frameCount + frameIndex
      ) * facesPerBand;
      const previousBase = (
        bandIndex * frameCount + previousFrame
      ) * facesPerBand;
      const nextBase = (
        bandIndex * frameCount + nextFrame
      ) * facesPerBand;
      for (let localFaceIndex = 0;
        localFaceIndex < facesPerBand;
        localFaceIndex += 1) {
        dilated[frameBase + localFaceIndex] =
          raw[previousBase + localFaceIndex] |
          raw[frameBase + localFaceIndex] |
          raw[nextBase + localFaceIndex];
      }
    }
  }
  return dilated;
}

function prepareBodyFaceNormals() {
  const normals = Array(PLANET_TEXTURE_FACE_COUNT);
  for (const polygon of createUvSpherePolygons(0)) {
    if (!Number.isSafeInteger(polygon.lightingFaceIndex)) continue;
    const [origin, east, , north] = polygon.vertices;
    const eastEdge = subtractVector(east, origin);
    const northEdge = subtractVector(north, origin);
    let normal = normalizeVector(crossVector(eastEdge, northEdge));
    const center = polygon.vertices.reduce(
      (sum, vertex) => sum.map((value, index) => value + vertex[index]),
      [0, 0, 0],
    );
    if (dotVector(normal, center) < 0) normal = normal.map((value) => -value);
    normals[polygon.lightingFaceIndex] = normal;
  }
  if (normals.some((normal) => !normal)) {
    throw new Error("Saturn prepared face visibility normals drifted.");
  }
  return normals;
}

function preparedOverlayCellEquals(overlayOutput, faceIndex, leftFrame, rightFrame) {
  const bandIndex = Math.floor(faceIndex / LONGITUDE_SEGMENTS);
  const longitudeIndex = faceIndex % LONGITUDE_SEGMENTS;
  const fieldX = longitudeIndex * PLANET_LIGHTING_CELL_WIDTH;
  const fieldY = (LATITUDE_SEGMENTS - 3 - bandIndex) *
    PLANET_LIGHTING_CELL_HEIGHT;
  const leftX = (leftFrame % PLANET_LIGHTING_FRAME_COLUMNS) *
    PLANET_LIGHTING_FRAME_STRIDE_X + PLANET_LIGHTING_FRAME_GUTTER + fieldX;
  const leftY = Math.floor(leftFrame / PLANET_LIGHTING_FRAME_COLUMNS) *
    PLANET_LIGHTING_FRAME_STRIDE_Y + PLANET_LIGHTING_FRAME_GUTTER + fieldY;
  const rightX = (rightFrame % PLANET_LIGHTING_FRAME_COLUMNS) *
    PLANET_LIGHTING_FRAME_STRIDE_X + PLANET_LIGHTING_FRAME_GUTTER + fieldX;
  const rightY = Math.floor(rightFrame / PLANET_LIGHTING_FRAME_COLUMNS) *
    PLANET_LIGHTING_FRAME_STRIDE_Y + PLANET_LIGHTING_FRAME_GUTTER + fieldY;
  for (let row = 0; row < PLANET_LIGHTING_CELL_HEIGHT; row += 1) {
    for (let column = 0; column < PLANET_LIGHTING_CELL_WIDTH; column += 1) {
      const leftOffset = (
        (leftY + row) * PLANET_LIGHTING_TEXTURE_WIDTH + leftX + column
      ) * 4;
      const rightOffset = (
        (rightY + row) * PLANET_LIGHTING_TEXTURE_WIDTH + rightX + column
      ) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (overlayOutput[leftOffset + channel] !==
            overlayOutput[rightOffset + channel]) return false;
      }
    }
  }
  return true;
}

function prepareSurfaceChannelFactors(maximumTint, maximumLightingFactor) {
  return [maximumTint.r, maximumTint.g, maximumTint.b]
    .map((factor) => factor / maximumLightingFactor);
}

async function prepareSolarTintedSurface(channelFactors) {
  const { data, info } = await sharp(PLANET_SOURCE_TEXTURE_PATH)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = applyLinearTint(
        data[offset + channel],
        channelFactors[channel],
      );
    }
  }
  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
    .toFile(PLANET_SURFACE_TEXTURE_PATH);
}

async function preparePolarTextureAtlas({
  ringData,
  ringTextureWidth,
  maximumLightingFactor,
  objectLight,
  objectView,
  surfaceChannelFactors,
}) {
  const [surface, cassiniNorthPolar] = await Promise.all([
    sharp(PLANET_SURFACE_TEXTURE_PATH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(CASSINI_POLAR_SOURCE_PATH)
      .extract({
        left: CASSINI_2017_TILE_LEFT,
        top: 0,
        width: CASSINI_POLAR_TILE_SIZE,
        height: CASSINI_POLAR_TILE_SIZE,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  const { data: surfaceData, info: surfaceInfo } = surface;
  const cassiniBoundaryGains = prepareCassiniBoundaryGains({
    surfaceData,
    surfaceInfo,
    cassiniNorthPolar,
    surfaceChannelFactors,
  });
  const output = Buffer.alloc(
    PLANET_POLAR_TEXTURE_WIDTH * PLANET_POLAR_TEXTURE_HEIGHT * 4,
  );
  const sampleCount = PLANET_POLAR_SUPERSAMPLING ** 2;
  for (const pole of ["north", "south"]) {
    for (const layer of ["outer", "inner"]) {
      const inner = layer === "inner";
      const surfaceTile = inner
        ? PLANET_POLAR_INNER_SURFACE_TILE[pole]
        : PLANET_POLAR_SURFACE_TILE[pole];
      const materialTile = inner
        ? PLANET_POLAR_INNER_MATERIAL_TILE[pole]
        : PLANET_POLAR_MATERIAL_TILE[pole];
      const radialSampleScale = inner
        ? PLANET_POLAR_INNER_OVERLAP / PLANET_POLAR_SURFACE_OVERLAP
        : 1;
      for (let y = 0; y < PLANET_POLAR_TEXTURE_SIZE; y += 1) {
        for (let x = 0; x < PLANET_POLAR_TEXTURE_SIZE; x += 1) {
          const surfaceChannels = [0, 0, 0];
          const materialPremultiplied = [0, 0, 0];
          let surfaceCoverage = 0;
          let materialAlpha = 0;
          for (let sampleY = 0; sampleY < PLANET_POLAR_SUPERSAMPLING; sampleY += 1) {
            for (let sampleX = 0; sampleX < PLANET_POLAR_SUPERSAMPLING; sampleX += 1) {
              const unitX = (
                x + (sampleX + 0.5) / PLANET_POLAR_SUPERSAMPLING
              ) / PLANET_POLAR_TEXTURE_SIZE * 2 - 1;
              const unitY = (
                y + (sampleY + 0.5) / PLANET_POLAR_SUPERSAMPLING
              ) / PLANET_POLAR_TEXTURE_SIZE * 2 - 1;
              const radius = Math.hypot(unitX, unitY);
              if (radius > 1) continue;
              const projectedRadius = Math.min(1, radius * radialSampleScale);
              const projectedScale = radius > 0 ? projectedRadius / radius : 0;
              const sample = preparePolarSample(
                pole,
                unitX * projectedScale,
                unitY * projectedScale,
                projectedRadius,
              );
              const openSpaceSurface = samplePolarSurfaceRgba(
                surfaceData,
                surfaceInfo,
                sample,
                projectedRadius,
              );
              const surface = pole === "north"
                ? sampleCassiniNorthPolarRgba({
                  openSpaceSurface,
                  cassiniNorthPolar,
                  sample,
                  radius: projectedRadius,
                  surfaceChannelFactors,
                  boundaryGains: cassiniBoundaryGains,
                })
                : openSpaceSurface;
              for (let channel = 0; channel < 3; channel += 1) {
                surfaceChannels[channel] += surface[channel];
              }
              surfaceCoverage += 1;
              const material = preparePolarMaterialSample({
                normal: sample.normal,
                position: sample.position,
                objectLight,
                objectView,
                ringData,
                ringTextureWidth,
                maximumLightingFactor,
              });
              materialAlpha += material.alpha;
              for (let channel = 0; channel < 3; channel += 1) {
                materialPremultiplied[channel] += material.color[channel] * material.alpha;
              }
            }
          }
          const surfaceOffset = polarTextureOffset(surfaceTile, x, y);
          if (surfaceCoverage > 0) {
            for (let channel = 0; channel < 3; channel += 1) {
              output[surfaceOffset + channel] = Math.round(
                surfaceChannels[channel] / surfaceCoverage,
              );
            }
            output[surfaceOffset + 3] = Math.round(surfaceCoverage / sampleCount * 255);
          }
          const materialOffset = polarTextureOffset(materialTile, x, y);
          const averagedMaterialAlpha = materialAlpha / sampleCount;
          if (averagedMaterialAlpha > 0) {
            for (let channel = 0; channel < 3; channel += 1) {
              output[materialOffset + channel] = Math.round(
                materialPremultiplied[channel] / materialAlpha,
              );
            }
            output[materialOffset + 3] = Math.round(averagedMaterialAlpha * 255);
          }
        }
      }
    }
  }
  return output;
}

function polarTextureOffset(tile, x, y) {
  return (
    y * PLANET_POLAR_TEXTURE_WIDTH + tile * PLANET_POLAR_TEXTURE_SIZE + x
  ) * 4;
}

function preparePolarSample(pole, unitX, unitY, radius) {
  const latitudeMagnitude = Math.acos(
    Math.min(1, radius * Math.cos(PLANET_POLAR_BOUNDARY_LATITUDE)),
  );
  const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
  let longitude = Math.atan2(unitY, unitX);
  if (longitude < 0) longitude += Math.PI * 2;
  const position = spherePoint(latitude, longitude);
  const normal = normalizeVector([
    position[0] / (EQUATORIAL_RADIUS ** 2),
    position[1] / (EQUATORIAL_RADIUS ** 2),
    position[2] / (POLAR_RADIUS ** 2),
  ]);
  return {
    latitude,
    longitude,
    position,
    normal,
    sourceX: longitude / (Math.PI * 2) * PLANET_SOURCE_TEXTURE_WIDTH - 0.5,
    sourceY: (Math.PI / 2 - latitude) / Math.PI * PLANET_SOURCE_TEXTURE_HEIGHT - 0.5,
  };
}

function prepareCassiniBoundaryGains({
  surfaceData,
  surfaceInfo,
  cassiniNorthPolar,
  surfaceChannelFactors,
}) {
  const openSpaceTotals = [0, 0, 0];
  const cassiniTotals = [0, 0, 0];
  const sampleCount = 720;
  const boundaryRadius = 0.965;
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = index / sampleCount * Math.PI * 2;
    const unitX = Math.cos(angle) * boundaryRadius;
    const unitY = Math.sin(angle) * boundaryRadius;
    const sample = preparePolarSample("north", unitX, unitY, boundaryRadius);
    const openSpace = samplePolarSurfaceRgba(
      surfaceData,
      surfaceInfo,
      sample,
      boundaryRadius,
    );
    const cassini = sampleCassiniSourceRgba(
      cassiniNorthPolar,
      sample,
      surfaceChannelFactors,
    );
    for (let channel = 0; channel < 3; channel += 1) {
      openSpaceTotals[channel] += openSpace[channel];
      cassiniTotals[channel] += cassini[channel];
    }
  }
  return openSpaceTotals.map((total, channel) => Math.max(
    0.65,
    Math.min(1.45, total / cassiniTotals[channel]),
  ));
}

function sampleCassiniNorthPolarRgba({
  openSpaceSurface,
  cassiniNorthPolar,
  sample,
  radius,
  surfaceChannelFactors,
  boundaryGains,
}) {
  const cassini = sampleCassiniSourceRgba(
    cassiniNorthPolar,
    sample,
    surfaceChannelFactors,
  );
  const boundaryAmount = smootherStep(
    CASSINI_POLAR_BLEND_START,
    1,
    radius,
  );
  return [0, 1, 2].map((channel) => mix(
    Math.max(0, Math.min(255, cassini[channel] * boundaryGains[channel])),
    openSpaceSurface[channel],
    boundaryAmount,
  )).concat(openSpaceSurface[3]);
}

function sampleCassiniSourceRgba(
  cassiniNorthPolar,
  sample,
  surfaceChannelFactors,
) {
  const projectedRadiusKm = 2 * SATURN_EQUATORIAL_RADIUS_KM * Math.tan(
    (Math.PI / 2 - sample.latitude) / 2,
  );
  const pixelRadius = projectedRadiusKm / CASSINI_POLAR_KM_PER_PIXEL;
  const sourceX = CASSINI_POLAR_CENTER + Math.cos(sample.longitude) * pixelRadius;
  const sourceY = CASSINI_POLAR_CENTER - Math.sin(sample.longitude) * pixelRadius;
  const sampled = sampleClampedBilinearRgb(
    cassiniNorthPolar.data,
    cassiniNorthPolar.info,
    sourceX,
    sourceY,
  );
  return sampled.map((channel, index) => applyLinearTint(
    channel,
    surfaceChannelFactors[index],
  )).concat(255);
}

function sampleClampedBilinearRgb(data, info, sourceX, sourceY) {
  const x = Math.max(0, Math.min(info.width - 1, sourceX));
  const y = Math.max(0, Math.min(info.height - 1, sourceY));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(info.width - 1, x0 + 1);
  const y1 = Math.min(info.height - 1, y0 + 1);
  const xAmount = x - x0;
  const yAmount = y - y0;
  return [0, 1, 2].map((channel) => {
    const top = mix(
      data[(y0 * info.width + x0) * info.channels + channel],
      data[(y0 * info.width + x1) * info.channels + channel],
      xAmount,
    );
    const bottom = mix(
      data[(y1 * info.width + x0) * info.channels + channel],
      data[(y1 * info.width + x1) * info.channels + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

function smootherStep(edge0, edge1, value) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function samplePolarSurfaceRgba(data, info, sample, radius) {
  const poleBlendRadius = 2 / PLANET_POLAR_TEXTURE_SIZE;
  const direct = sampleWrappedBilinearRgba(
    data,
    info,
    sample.sourceX,
    sample.sourceY,
  );
  if (radius >= poleBlendRadius) return direct;
  const longitudinalAverage = [0, 0, 0, 0];
  for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
    const poleSample = sampleWrappedBilinearRgba(
      data,
      info,
      (longitudeIndex + 0.5) / LONGITUDE_SEGMENTS * info.width - 0.5,
      sample.sourceY,
    );
    for (let channel = 0; channel < 4; channel += 1) {
      longitudinalAverage[channel] += poleSample[channel];
    }
  }
  const directAmount = radius / poleBlendRadius;
  return longitudinalAverage.map((sum, channel) =>
    directAmount * direct[channel] +
    (1 - directAmount) * sum / LONGITUDE_SEGMENTS
  );
}

function sampleWrappedBilinearRgba(data, info, sourceX, sourceY) {
  const x0 = Math.floor(sourceX);
  const clampedY = Math.max(0, Math.min(info.height - 1, sourceY));
  const y0 = Math.floor(clampedY);
  const xAmount = sourceX - x0;
  const yAmount = clampedY - y0;
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(info.height - 1, y0 + 1));
  const wrappedX0 = ((x0 % info.width) + info.width) % info.width;
  const wrappedX1 = ((x1 % info.width) + info.width) % info.width;
  return Array.from({ length: 4 }, (_, channel) => {
    const top = mix(
      data[(y0 * info.width + wrappedX0) * info.channels + channel],
      data[(y0 * info.width + wrappedX1) * info.channels + channel],
      xAmount,
    );
    const bottom = mix(
      data[(y1 * info.width + wrappedX0) * info.channels + channel],
      data[(y1 * info.width + wrappedX1) * info.channels + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

function preparePolarMaterialSample({
  normal,
  position,
  objectLight,
  objectView,
  ringData,
  ringTextureWidth,
  maximumLightingFactor,
}) {
  const lambert = Math.max(0, dotVector(normal, objectLight));
  const diffusePower = prepareOpenSpaceGlobeDiffusePower(lambert);
  const ringOpacity = sampleRingShadowOpacity(
    position,
    objectLight,
    ringData,
    ringTextureWidth,
  );
  const directTransmission = mix(
    1,
    RING_SHADOW_DIRECT_TRANSMISSION,
    ringOpacity,
  );
  const tint = textureTintFactors(
    LIGHTING.directionalLight.intensity * diffusePower * directTransmission,
    LIGHTING.directionalLight.color,
    LIGHTING.ambientLight.color,
    LIGHTING.ambientLight.intensity,
  );
  const lightingAlpha = preparedLightingAlpha(tint, maximumLightingFactor);
  const atmosphereAlpha = preparedAtmosphereOpacity(normal, objectLight, objectView);
  const alpha = 1 - (1 - lightingAlpha) * (1 - atmosphereAlpha);
  return {
    alpha,
    color: alpha > 0
      ? ATMOSPHERE_COLOR.map((channel) => channel * atmosphereAlpha / alpha)
      : [0, 0, 0],
  };
}

function writePreparedMaterialOverlay(
  output,
  offset,
  tint,
  maximumLightingFactor,
  atmosphereAlpha,
) {
  const lightingAlpha = preparedLightingAlpha(tint, maximumLightingFactor);
  const alpha = 1 - (1 - atmosphereAlpha) * (1 - lightingAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    output[offset + channel] = alpha > 0
      ? Math.round(ATMOSPHERE_COLOR[channel] * atmosphereAlpha / alpha)
      : 0;
  }
  output[offset + 3] = Math.round(alpha * 255);
}

function preparedLightingAlpha(tint, maximumLightingFactor) {
  const lightingFactor = Math.max(tint.r, tint.g, tint.b) / maximumLightingFactor;
  const desiredChannel = applyLinearTint(
    PLANET_LIGHTING_REFERENCE_CHANNEL,
    lightingFactor,
  );
  return Math.max(0, Math.min(
    1,
    1 - desiredChannel / PLANET_LIGHTING_REFERENCE_CHANNEL,
  ));
}

function prepareOpenSpaceGlobeDiffusePower(lambert) {
  const [edge0, edge1] = OPENSPACE_GLOBE_TERMINATOR_SMOOTHSTEP;
  const amount = Math.max(0, Math.min(1, (lambert - edge0) / (edge1 - edge0)));
  const terminator = amount * amount * (3 - 2 * amount);
  return lambert * terminator;
}

function preparedAtmosphereOpacity(normal, objectLight, objectView) {
  const viewAlignment = Math.max(0, dotVector(normal, objectView));
  const limb = Math.pow(1 - viewAlignment, ATMOSPHERE_LIMB_EXPONENT);
  const lightAlignment = Math.max(0, dotVector(normal, objectLight));
  const sunwardAmount = ATMOSPHERE_NIGHT_FLOOR +
    (1 - ATMOSPHERE_NIGHT_FLOOR) * Math.sqrt(lightAlignment);
  return Math.max(0, Math.min(
    ATMOSPHERE_MAXIMUM_ALPHA,
    limb * ATMOSPHERE_MAXIMUM_ALPHA * sunwardAmount,
  ));
}

function replicatePreparedOverlayFrameGutter(output, frameX, frameY) {
  const copyPixel = (sourceX, sourceY, targetX, targetY) => {
    const sourceOffset = (
      sourceY * PLANET_LIGHTING_TEXTURE_WIDTH + sourceX
    ) * 4;
    const targetOffset = (
      targetY * PLANET_LIGHTING_TEXTURE_WIDTH + targetX
    ) * 4;
    output.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
  };
  const rightX = frameX + PLANET_LIGHTING_FIELD_WIDTH - 1;
  const bottomY = frameY + PLANET_LIGHTING_FIELD_HEIGHT - 1;
  for (let row = 0; row < PLANET_LIGHTING_FIELD_HEIGHT; row += 1) {
    const y = frameY + row;
    copyPixel(rightX, y, frameX - 1, y);
    copyPixel(frameX, y, rightX + 1, y);
  }
  for (let x = frameX - 1; x <= rightX + 1; x += 1) {
    copyPixel(x, frameY, x, frameY - 1);
    copyPixel(x, bottomY, x, bottomY + 1);
  }
}

function prepareBodyTexelSample(
  latitudeIndex,
  longitudeIndex,
  cellRow,
  cellColumn,
  cellWidth,
  cellHeight,
) {
  const latitudeStep = Math.PI / LATITUDE_SEGMENTS;
  const longitudeStep = Math.PI * 2 / LONGITUDE_SEGMENTS;
  const south = -Math.PI / 2 + latitudeIndex * latitudeStep;
  const north = -Math.PI / 2 + (latitudeIndex + 1) * latitudeStep;
  const west = longitudeIndex * longitudeStep;
  const east = (longitudeIndex + 1) * longitudeStep;
  const rowAmount = (cellRow + 0.5) / cellHeight;
  const columnAmount = (cellColumn + 0.5) / cellWidth;
  const latitude = mix(north, south, rowAmount);
  const longitude = mix(west, east, columnAmount);
  const sourceX = Math.max(0, Math.min(
    PLANET_FRAME_WIDTH - 1,
    Math.floor((longitude / (Math.PI * 2) % 1 + 1) % 1 * PLANET_FRAME_WIDTH),
  ));
  const sourceY = Math.max(0, Math.min(
    PLANET_FRAME_HEIGHT - 1,
    Math.floor((Math.PI / 2 - latitude) / Math.PI * PLANET_FRAME_HEIGHT),
  ));
  const latitudeRadius = Math.cos(latitude);
  const position = [
    EQUATORIAL_RADIUS * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * Math.sin(latitude),
  ];
  const normal = normalizeVector([
    latitudeRadius * Math.cos(longitude) / EQUATORIAL_RADIUS,
    latitudeRadius * Math.sin(longitude) / EQUATORIAL_RADIUS,
    Math.sin(latitude) / POLAR_RADIUS,
  ]);
  return { normal, position, sourceX, sourceY };
}

function prepareBodyLightingProjectionMatrices() {
  const polygons = createUvSpherePolygons();
  const seamEdges = prepareBodySeamEdges();
  const matrices = Array(PLANET_TEXTURE_FACE_COUNT);
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    const polygon = polygons[polygonIndex];
    if (!Number.isSafeInteger(polygon.lightingFaceIndex)) continue;
    const plan = computeTextureAtlasPlanPublic(polygon, polygonIndex, {
      ...PLAN_OPTIONS,
      seamBleed: PLANET_SEAM_BLEED,
      seamEdges: seamEdges.get(polygonIndex),
    });
    const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
      backend: "image",
      lighting: "source",
      projection: "projective",
    });
    if (!geometry) {
      throw new Error(`Saturn lighting projection ${polygonIndex} did not prepare.`);
    }
    const fitted = fitTextureGeometry(
      geometry,
      PLANET_RASTER_CELL_SIZE,
      PLANET_RASTER_CELL_SIZE,
    );
    const matrix = String(fitted.matrix).split(",").map(Number);
    if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
      throw new Error(`Saturn lighting projection ${polygonIndex} is invalid.`);
    }
    matrices[polygon.lightingFaceIndex] = matrix;
  }
  for (let index = 0; index < matrices.length; index += 1) {
    if (!Array.isArray(matrices[index])) {
      throw new Error(`Saturn lighting projection matrix ${index} is missing.`);
    }
  }
  return matrices;
}

function prepareProjectedBodyMaterialSample(
  matrix,
  cellRow,
  cellColumn,
  objectView,
  fallback,
) {
  const localX = (
    cellColumn + 0.5 + SURFACE_OVERLAP * PLANET_LIGHTING_CELL_WIDTH
  ) * PLANET_LIGHTING_PRESENTATION_SCALE_X;
  const localY = (
    cellRow + 0.5 + SURFACE_OVERLAP * PLANET_LIGHTING_CELL_HEIGHT
  ) * PLANET_LIGHTING_PRESENTATION_SCALE_Y;
  const homogeneousX = matrix[0] * localX + matrix[4] * localY + matrix[12];
  const homogeneousY = matrix[1] * localX + matrix[5] * localY + matrix[13];
  const homogeneousZ = matrix[2] * localX + matrix[6] * localY + matrix[14];
  const homogeneousW = matrix[3] * localX + matrix[7] * localY + matrix[15];
  if (!Number.isFinite(homogeneousW) || Math.abs(homogeneousW) < 1e-9) {
    return fallback;
  }
  const planarPosition = [
    homogeneousY / homogeneousW / TILE_SIZE,
    homogeneousX / homogeneousW / TILE_SIZE,
    homogeneousZ / homogeneousW / TILE_SIZE,
  ];
  return intersectViewRayWithSaturn(planarPosition, objectView) ?? fallback;
}

function intersectViewRayWithSaturn(origin, direction) {
  const equatorialSquared = EQUATORIAL_RADIUS ** 2;
  const polarSquared = POLAR_RADIUS ** 2;
  const coefficientA =
    (direction[0] ** 2 + direction[1] ** 2) / equatorialSquared +
    direction[2] ** 2 / polarSquared;
  const coefficientB = 2 * (
    (origin[0] * direction[0] + origin[1] * direction[1]) /
      equatorialSquared +
    origin[2] * direction[2] / polarSquared
  );
  const coefficientC =
    (origin[0] ** 2 + origin[1] ** 2) / equatorialSquared +
    origin[2] ** 2 / polarSquared - 1;
  const discriminant = coefficientB ** 2 - 4 * coefficientA * coefficientC;
  if (!Number.isFinite(discriminant) || discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [
    (-coefficientB - root) / (2 * coefficientA),
    (-coefficientB + root) / (2 * coefficientA),
  ].map((distance) => {
    const position = [
      origin[0] + direction[0] * distance,
      origin[1] + direction[1] * distance,
      origin[2] + direction[2] * distance,
    ];
    const normal = normalizeVector([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return { position, normal, visibility: dotVector(normal, direction) };
  });
  const selected = candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
  return { position: selected.position, normal: selected.normal };
}

function sampleRingShadowOpacity(
  position,
  [lightX, lightY, lightZ],
  ringData,
  textureSize,
  sampleRadiusPixels = 0,
) {
  const rayDistance = -position[2] / lightZ;
  if (rayDistance <= 0) return 0;
  const ringX = position[0] + rayDistance * lightX;
  const ringY = position[1] + rayDistance * lightY;
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return 0;
  const textureX = (ringX / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const textureY = (ringY / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const center = sampleAlphaBilinear(
    ringData,
    textureSize,
    textureX,
    textureY,
  );
  if (sampleRadiusPixels <= 0) return center;
  const samples = [
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX - sampleRadiusPixels,
      textureY,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX + sampleRadiusPixels,
      textureY,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX,
      textureY - sampleRadiusPixels,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX,
      textureY + sampleRadiusPixels,
    ),
  ];
  return (center * 4 + samples.reduce((sum, value) => sum + value, 0)) / 8;
}

function prepareProjectedMeshSilhouetteCoverage({
  right,
  down,
  scaledRadiusX,
  scaledRadiusY,
  outputSize,
  supersampling,
}) {
  const projectedVertices = [];
  for (let latitudeIndex = 0;
    latitudeIndex <= LATITUDE_SEGMENTS;
    latitudeIndex += 1) {
    const latitude = -Math.PI / 2 +
      latitudeIndex / LATITUDE_SEGMENTS * Math.PI;
    const longitudeCount = latitudeIndex === 0 ||
        latitudeIndex === LATITUDE_SEGMENTS
      ? 1
      : LONGITUDE_SEGMENTS;
    for (let longitudeIndex = 0;
      longitudeIndex < longitudeCount;
      longitudeIndex += 1) {
      const longitude = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const position = spherePoint(latitude, longitude);
      projectedVertices.push({
        x: (dotVector(position, right) / scaledRadiusX + 1) *
          0.5 * outputSize,
        y: (dotVector(position, down) / scaledRadiusY + 1) *
          0.5 * outputSize,
      });
    }
  }
  const hull = convexHull2d(projectedVertices);
  if (hull.length < 3) {
    throw new Error("Prepared Saturn silhouette hull is invalid.");
  }
  const accumulatedCoverage = new Float32Array(outputSize * outputSize);
  for (let row = 0; row < outputSize; row += 1) {
    for (let sampleIndex = 0;
      sampleIndex < supersampling;
      sampleIndex += 1) {
      const sampleY = row + (sampleIndex + 0.5) / supersampling;
      const intersections = [];
      for (let pointIndex = 0; pointIndex < hull.length; pointIndex += 1) {
        const start = hull[pointIndex];
        const end = hull[(pointIndex + 1) % hull.length];
        if (start.y === end.y) continue;
        const minimumY = Math.min(start.y, end.y);
        const maximumY = Math.max(start.y, end.y);
        if (sampleY < minimumY || sampleY >= maximumY) continue;
        intersections.push(start.x +
          (sampleY - start.y) / (end.y - start.y) * (end.x - start.x));
      }
      if (intersections.length < 2) continue;
      const left = Math.max(0, Math.min(...intersections));
      const rightEdge = Math.min(outputSize, Math.max(...intersections));
      const minimumColumn = Math.max(0, Math.floor(left));
      const maximumColumn = Math.min(
        outputSize - 1,
        Math.floor(Math.max(left, rightEdge - Number.EPSILON)),
      );
      for (let column = minimumColumn;
        column <= maximumColumn;
        column += 1) {
        const horizontalCoverage = Math.max(
          0,
          Math.min(column + 1, rightEdge) - Math.max(column, left),
        );
        accumulatedCoverage[row * outputSize + column] +=
          horizontalCoverage / supersampling;
      }
    }
  }
  const coverage = Buffer.alloc(outputSize * outputSize);
  for (let index = 0; index < coverage.length; index += 1) {
    coverage[index] = Math.round(
      Math.max(0, Math.min(1, accumulatedCoverage[index])) * 255,
    );
  }
  return coverage;
}

function convexHull2d(points) {
  const sorted = [...points].sort((left, right) =>
    left.x - right.x || left.y - right.y);
  const cross = (origin, left, right) =>
    (left.x - origin.x) * (right.y - origin.y) -
      (left.y - origin.y) * (right.x - origin.x);
  const halfHull = (ordered) => {
    const result = [];
    for (const point of ordered) {
      while (result.length >= 2 &&
          cross(result.at(-2), result.at(-1), point) <= 0) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  const lower = halfHull(sorted);
  const upper = halfHull([...sorted].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function sampleForegroundRing(
  origin,
  view,
  surfaceDistance,
  ringData,
  textureSize,
) {
  if (!ringData || Math.abs(view[2]) < 1e-9) return null;
  const ringDistance = -origin[2] / view[2];
  if (ringDistance <= surfaceDistance) return null;
  const ringX = origin[0] + ringDistance * view[0];
  const ringY = origin[1] + ringDistance * view[1];
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return null;
  const textureX = (ringX / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const textureY = (ringY / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const sample = sampleRgbaBilinear(
    ringData,
    textureSize,
    textureX,
    textureY,
  );
  return sample[3] > 0 ? sample : null;
}

function sampleRgbaBilinear(data, size, x, y) {
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(y)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const amountX = x - x0;
  const amountY = y - y0;
  return Array.from({ length: 4 }, (_, channel) => {
    const sample = (sampleX, sampleY) =>
      data[(sampleY * size + sampleX) * 4 + channel];
    return mix(
      mix(sample(x0, y0), sample(x1, y0), amountX),
      mix(sample(x0, y1), sample(x1, y1), amountX),
      amountY,
    );
  });
}

function sampleAlphaBilinear(data, size, x, y) {
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(y)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const amountX = x - x0;
  const amountY = y - y0;
  const alpha00 = data[(y0 * size + x0) * 4 + 3] / 255;
  const alpha10 = data[(y0 * size + x1) * 4 + 3] / 255;
  const alpha01 = data[(y1 * size + x0) * 4 + 3] / 255;
  const alpha11 = data[(y1 * size + x1) * 4 + 3] / 255;
  return mix(
    mix(alpha00, alpha10, amountX),
    mix(alpha01, alpha11, amountX),
    amountY,
  );
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

function dotVector(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function subtractVector(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function crossVector(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function prepareObjectViewDirection(
  scenePitchDegrees,
  systemObliquityDegrees,
) {
  let direction = [0, 0, 1];
  direction = rotateY(direction, scenePitchDegrees * Math.PI / 180);
  direction = rotateZ(direction, -SATURN_PRESENTATION_NODE_DEGREES * Math.PI / 180);
  direction = rotateX(direction, -systemObliquityDegrees * Math.PI / 180);
  direction = rotateZ(direction, -MESH_ROTATION_Z * Math.PI / 180);
  return normalizeVector(direction);
}

function prepareObjectLightDirection(systemObliquityDegrees) {
  let direction = normalizeVector(
    PREPARED_RING_SOURCE.shadowModel.worldLightDirection,
  );
  direction = rotateZ(
    direction,
    -SATURN_PRESENTATION_NODE_DEGREES * Math.PI / 180,
  );
  direction = rotateX(
    direction,
    -systemObliquityDegrees * Math.PI / 180,
  );
  direction = rotateZ(direction, -MESH_ROTATION_Z * Math.PI / 180);
  return normalizeVector(direction);
}

function prepareInitialObjectViewDirection() {
  return prepareObjectViewDirection(
    CAMERA_ROTATION_X_DEGREES,
    SATURN_OBLIQUITY_DEGREES,
  );
}

function rotateX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function preparedInteractionFrames(scene) {
  const frameCount = PLANET_ORBIT_MATERIAL_FRAME_COUNT;
  const prepareFrame = (scenePitchDegrees) => {
    const systemObliquityDegrees = SATURN_OBLIQUITY_DEGREES *
      scenePitchDegrees / CAMERA_ROTATION_X_DEGREES;
    const projection = scene.fixedMaterialPlane.interactionProjection;
    const materialMatrix = preparedInteractionMaterialMatrix({
      scenePitchDegrees,
      systemObliquityDegrees,
      projection,
    });
    const moonBasis = preparedInteractionMoonBasis({
      scenePitchDegrees,
      systemObliquityDegrees,
      presentationNodeDegrees:
        scene.moons.moons[0]?.billboard?.presentationNodeDegrees,
    });
    const moonPresentationMatrix = preparedInteractionMoonBasisMatrix(
      moonBasis,
      scene.moons.moons[0]?.billboard?.tileSize,
    );
    const moonBillboardMatrices = [];
    const moonLabelMatrices = [];
    const moonShadowMatrices = [];
    for (const moon of scene.moons.moons) {
      const radii = preparedInteractionProjectedRadii(
        moonBasis,
        moon.billboard.radii,
      );
      moonBillboardMatrices.push(preparedInteractionLocalPlaneMatrix(
        moon.billboard,
        radii,
      ));
      moonLabelMatrices.push(moon.label
        ? preparedInteractionLabelMatrix(moon.billboard, radii)
        : null);
      if (moon.shadow) {
        moonShadowMatrices.push(preparedInteractionLocalPlaneMatrix(
          moon.shadow.projection,
          radii,
        ));
      }
    }
    return Object.freeze({
      materialTransform: matrixStyle(materialMatrix),
      moonPresentationTransform: matrixStyle(moonPresentationMatrix),
      moonBillboardTransforms: Object.freeze(
        moonBillboardMatrices.map(matrixStyle),
      ),
      moonLabelTransforms: Object.freeze(
        moonLabelMatrices.map((matrix) => matrix ? matrixStyle(matrix) : null),
      ),
      moonShadowTransforms: Object.freeze(
        moonShadowMatrices.map(matrixStyle),
      ),
    });
  };
  return Object.freeze({
    schema: "csssaturn-prepared-interaction-frames@1",
    frameCount,
    runtimeGeometry: false,
    runtimeMatrixFormatting: false,
    defaultFrame: prepareFrame(CAMERA_ROTATION_X_DEGREES),
    frames: Object.freeze(Array.from({ length: frameCount }, (_, index) =>
      prepareFrame(CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES *
        (1 - index / (frameCount - 1))))),
  });
}

function preparedInteractionMaterialMatrix({
  scenePitchDegrees,
  systemObliquityDegrees,
  projection,
}) {
  const radians = Math.PI / 180;
  const screenToObject = (vector) => rotateZ(
    rotateX(
      rotateZ(
        rotateY(vector, scenePitchDegrees * radians),
        -projection.presentationNodeDegrees * radians,
      ),
      -systemObliquityDegrees * radians,
    ),
    -projection.meshRotationDegrees * radians,
  );
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const projectedRadius = (direction) => Math.sqrt(
    projection.equatorialRadius ** 2 *
      (direction[0] ** 2 + direction[1] ** 2) +
    projection.polarRadius ** 2 * direction[2] ** 2
  );
  const radiusX = projectedRadius(right) * projection.coverageScale;
  const radiusY = projectedRadius(down) * projection.coverageScale;
  const frontDepth = projectedRadius(view) + projection.depthBias;
  const scaleVector = (vector, scale) =>
    vector.map((value) => value * scale);
  const addVectors = (...vectors) => [0, 1, 2].map((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
  return [
    ...worldPositionToCss(scaleVector(
      right,
      radiusX * 2 / projection.textureSize,
    )), 0,
    ...worldPositionToCss(scaleVector(
      down,
      radiusY * 2 / projection.textureSize,
    )), 0,
    ...worldPositionToCss(view), 0,
    ...worldPositionToCss(addVectors(
      scaleVector(right, -radiusX),
      scaleVector(down, -radiusY),
      scaleVector(view, frontDepth),
    )), 1,
  ];
}

function preparedInteractionMoonBasis({
  scenePitchDegrees,
  systemObliquityDegrees,
  presentationNodeDegrees,
}) {
  const radians = Math.PI / 180;
  const screenToObject = (vector) => rotateX(
    rotateZ(
      rotateY(vector, scenePitchDegrees * radians),
      -presentationNodeDegrees * radians,
    ),
    -systemObliquityDegrees * radians,
  );
  return Object.freeze({
    right: normalizeVector(screenToObject([0, 1, 0])),
    down: normalizeVector(screenToObject([1, 0, 0])),
    view: normalizeVector(screenToObject([0, 0, 1])),
  });
}

function preparedInteractionProjectedRadii(basis, radii) {
  const projectedRadius = (direction) => Math.sqrt(
    radii[0] ** 2 * direction[0] ** 2 +
    radii[1] ** 2 * direction[1] ** 2 +
    radii[2] ** 2 * direction[2] ** 2
  );
  return Object.freeze([
    projectedRadius(basis.right),
    projectedRadius(basis.down),
    projectedRadius(basis.view),
  ]);
}

function preparedInteractionMoonBasisMatrix({ right, down, view }, tileSize) {
  const toCss = ([x, y, z]) => [y * tileSize, x * tileSize, z * tileSize];
  return [
    ...toCss(right), 0,
    ...toCss(down), 0,
    ...toCss(view), 0,
    0, 0, 0, 1,
  ];
}

function preparedInteractionLocalPlaneMatrix(projection, radii) {
  const radiusX = radii[0] * projection.coverageScale;
  const radiusY = radii[1] * projection.coverageScale;
  const frontDepth = radii[2] + projection.depthBias;
  return [
    radiusX * 2 / projection.textureSize, 0, 0, 0,
    0, radiusY * 2 / projection.textureSize, 0, 0,
    0, 0, 1, 0,
    -radiusX, -radiusY, frontDepth, 1,
  ];
}

function preparedInteractionLabelMatrix(projection, radii) {
  const radiusY = radii[1] * projection.coverageScale;
  const frontDepth = radii[2] + projection.depthBias;
  const worldUnitsPerCssPixel = 1 / (CAMERA_ZOOM * 0.02 *
    projection.tileSize);
  return [
    worldUnitsPerCssPixel, 0, 0, 0,
    0, worldUnitsPerCssPixel, 0, 0,
    0, 0, 1, 0,
    -80 * 0.5 * worldUnitsPerCssPixel,
    radiusY + 10 * worldUnitsPerCssPixel,
    frontDepth + 0.01,
    1,
  ];
}

function matrixStyle(matrix) {
  return `matrix3d(${matrix.map((value) =>
    Number(value.toFixed(12))).join(",")})`;
}

function identityMatrix4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function multiplyMatrix4(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        result[column * 4 + row] +=
          left[inner * 4 + row] * right[column * 4 + inner];
      }
    }
  }
  return result;
}

function cssRotateXMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ];
}

function cssRotateYMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ];
}

function cssRotateZMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function cssScaleMatrix(scaleX, scaleY = scaleX) {
  // CSS scale() is two-dimensional. It deliberately leaves Z unscaled.
  return [
    scaleX, 0, 0, 0,
    0, scaleY, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function cssTranslateMatrix(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function parsePreparedTransformList(transform) {
  let matrix = identityMatrix4();
  let matchCount = 0;
  const functions = transform.matchAll(
    /(matrix3d|scale|rotateX|rotateY|rotateZ|rotate|translate3d)\(([^)]*)\)/gu,
  );
  for (const match of functions) {
    matchCount += 1;
    const values = match[2].split(",").map((value) => Number.parseFloat(value));
    let next;
    switch (match[1]) {
      case "matrix3d":
        if (values.length !== 16 || values.some((value) => !Number.isFinite(value))) {
          throw new Error("Saturn prepared matrix3d visibility input drifted.");
        }
        next = values;
        break;
      case "scale":
        next = cssScaleMatrix(values[0], values[1] ?? values[0]);
        break;
      case "rotateX":
        next = cssRotateXMatrix(values[0]);
        break;
      case "rotateY":
        next = cssRotateYMatrix(values[0]);
        break;
      case "rotateZ":
      case "rotate":
        next = cssRotateZMatrix(values[0]);
        break;
      case "translate3d":
        next = cssTranslateMatrix(values[0], values[1], values[2]);
        break;
      default:
        throw new Error(`Unsupported prepared transform function ${match[1]}.`);
    }
    if (next.some((value) => !Number.isFinite(value))) {
      throw new Error("Saturn prepared visibility transform is not finite.");
    }
    matrix = multiplyMatrix4(matrix, next);
  }
  if (matchCount === 0) {
    throw new Error("Saturn prepared visibility transform is missing.");
  }
  return matrix;
}

function transformPreparedPoint(matrix, [x, y, z, w]) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w,
  ];
}

function preparedProjectedArea(parent, leaf) {
  const project = (point) => {
    const [x, y, , w] = transformPreparedPoint(parent, point);
    return [x / w, y / w];
  };
  const origin = project(leaf.points[0]);
  const east = project(leaf.points[1]);
  const south = project(leaf.points[2]);
  return (east[0] - origin[0]) * (south[1] - origin[1]) -
    (east[1] - origin[1]) * (south[0] - origin[0]);
}

function prepareBodyVisibility({
  bodyBands,
  defaultControlPitch,
  orbitStartRemaining,
  orbitTransform,
  systemTransform,
}) {
  const leaves = bodyBands.flatMap(({ leaves: bandLeaves }) => bandLeaves).map(
    (leaf) => {
      const matrix = parsePreparedTransformList(leaf.style);
      const width = Number.parseFloat(
        /--polycss-atlas-width:([\d.]+)px/u.exec(leaf.style)?.[1] ?? "64",
      );
      const height = Number.parseFloat(
        /--polycss-atlas-height:([\d.]+)px/u.exec(leaf.style)?.[1] ?? "64",
      );
      return Object.freeze({
        points: Object.freeze([
          transformPreparedPoint(matrix, [0, 0, 0, 1]),
          transformPreparedPoint(matrix, [width, 0, 0, 1]),
          transformPreparedPoint(matrix, [0, height, 0, 1]),
        ]),
      });
    },
  );
  const frameCount = BODY_VISIBILITY_FRAME_COUNT;
  const phaseSampleCount = frameCount * 2;
  const stateStrideBytes = Math.ceil(leaves.length / 8);
  const pitchBanks = [Object.freeze({
    model: "approved-default-exact",
    minimumControlPitchDegrees: defaultControlPitch,
    maximumControlPitchDegrees: defaultControlPitch,
    samples: Object.freeze([defaultControlPitch]),
  })];
  for (let bankIndex = 0;
    bankIndex < BODY_VISIBILITY_RANGE_BANK_COUNT;
    bankIndex += 1) {
    const minimum = CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES *
      bankIndex / BODY_VISIBILITY_RANGE_BANK_COUNT;
    const maximum = CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES *
      (bankIndex + 1) / BODY_VISIBILITY_RANGE_BANK_COUNT;
    pitchBanks.push(Object.freeze({
      model: "conservative-range",
      minimumControlPitchDegrees: minimum,
      maximumControlPitchDegrees: maximum,
      samples: Object.freeze(Array.from(
        { length: BODY_VISIBILITY_PITCH_SAMPLES_PER_RANGE },
        (_, sampleIndex) => mix(
          minimum,
          maximum,
          sampleIndex / (BODY_VISIBILITY_PITCH_SAMPLES_PER_RANGE - 1),
        ),
      )),
    }));
  }
  const perspective = identityMatrix4();
  perspective[11] = -1 / BODY_VISIBILITY_PERSPECTIVE_PX;
  const system = parsePreparedTransformList(systemTransform);
  const uniquePitches = [...new Set(pitchBanks.flatMap(({ samples }) => samples))];
  const positiveByPitch = new Map();
  for (const controlPitch of uniquePitches) {
    const remaining = orbitStartRemaining * (
      1 - controlPitch / CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES
    );
    const camera = parsePreparedTransformList(orbitTransform(remaining));
    const cameraSystem = multiplyMatrix4(
      multiplyMatrix4(perspective, camera),
      system,
    );
    const phaseStates = [];
    for (let phaseSample = 0; phaseSample < phaseSampleCount; phaseSample += 1) {
      const body = cssRotateZMatrix(
        -MESH_ROTATION_Z - phaseSample / phaseSampleCount * 360,
      );
      const parent = multiplyMatrix4(cameraSystem, body);
      const bits = new Uint8Array(stateStrideBytes);
      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex += 1) {
        if (preparedProjectedArea(parent, leaves[leafIndex]) <= 0) continue;
        bits[leafIndex >> 3] |= 1 << (leafIndex & 7);
      }
      phaseStates.push(bits);
    }
    positiveByPitch.set(controlPitch, phaseStates);
  }
  const states = Buffer.alloc(
    pitchBanks.length * frameCount * stateStrideBytes,
    0xff,
  );
  let minimumHiddenLeafCount = leaves.length;
  let maximumHiddenLeafCount = 0;
  let hiddenLeafCountTotal = 0;
  for (let bankIndex = 0; bankIndex < pitchBanks.length; bankIndex += 1) {
    const bank = pitchBanks[bankIndex];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const stateOffset = (
        bankIndex * frameCount + frameIndex
      ) * stateStrideBytes;
      const phaseSampleStart = frameIndex * 2 - 2;
      for (const controlPitch of bank.samples) {
        const phaseStates = positiveByPitch.get(controlPitch);
        for (let sampleIndex = 0;
          sampleIndex < BODY_VISIBILITY_PHASE_SAMPLES_PER_STATE;
          sampleIndex += 1) {
          const phaseSample = (
            phaseSampleStart + sampleIndex + phaseSampleCount
          ) % phaseSampleCount;
          const positive = phaseStates[phaseSample];
          for (let byteIndex = 0; byteIndex < stateStrideBytes; byteIndex += 1) {
            states[stateOffset + byteIndex] &= positive[byteIndex];
          }
        }
      }
      let hiddenLeafCount = 0;
      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex += 1) {
        hiddenLeafCount += Number(Boolean(
          states[stateOffset + (leafIndex >> 3)] & (1 << (leafIndex & 7)),
        ));
      }
      minimumHiddenLeafCount = Math.min(minimumHiddenLeafCount, hiddenLeafCount);
      maximumHiddenLeafCount = Math.max(maximumHiddenLeafCount, hiddenLeafCount);
      hiddenLeafCountTotal += hiddenLeafCount;
    }
  }
  return Object.freeze({
    schema: "csssaturn-prepared-body-visibility@1",
    model: "prepared-projective-matrix-backface-ownership",
    durationMilliseconds: PLANET_ROTATION_SECONDS * 1_000,
    frameCount,
    frameMilliseconds: PLANET_ROTATION_SECONDS * 1_000 / frameCount,
    leafCount: leaves.length,
    stateStrideBytes,
    bankCount: pitchBanks.length,
    defaultBankIndex: 0,
    defaultControlPitchDegrees: defaultControlPitch,
    minimumControlPitchDegrees: CAMERA_ORBIT_MINIMUM_CONTROL_PITCH_DEGREES,
    maximumControlPitchDegrees: CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES,
    rangeBankCount: BODY_VISIBILITY_RANGE_BANK_COUNT,
    pitchBanks: Object.freeze(pitchBanks.map((bank) => Object.freeze({
      model: bank.model,
      minimumControlPitchDegrees: bank.minimumControlPitchDegrees,
      maximumControlPitchDegrees: bank.maximumControlPitchDegrees,
    }))),
    pitchSamplesPerRange: BODY_VISIBILITY_PITCH_SAMPLES_PER_RANGE,
    phaseSamplesPerState: BODY_VISIBILITY_PHASE_SAMPLES_PER_STATE,
    phaseSafetyFrames: Object.freeze([-1, 2]),
    perspectivePixels: BODY_VISIBILITY_PERSPECTIVE_PX,
    stateEncoding: "bank-frame-leaf-lsb-bitset-base64",
    statesBase64: states.toString("base64"),
    minimumHiddenLeafCount,
    maximumHiddenLeafCount,
    meanHiddenLeafCount: Number((
      hiddenLeafCountTotal / (pitchBanks.length * frameCount)
    ).toFixed(6)),
    runtimeGeometry: false,
    runtimeMatrixMath: false,
    browserBackfaceRetentionAtTransitions: true,
  });
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

function prepareBody() {
  const polygons = createUvSpherePolygons();
  // Detect shared edges from the unexpanded source topology. The tiny
  // presentation overlap intentionally moves neighboring vertices apart and
  // therefore cannot be the authority for seam ownership.
  const seamEdges = prepareBodySeamEdges();
  return polygons.map((polygon, index) => {
    const sharedEdges = seamEdges.get(index);
    if (polygon.texture) {
      return {
        latitudeIndex: polygon.latitudeIndex,
        ...(Number.isSafeInteger(polygon.longitudeIndex)
          ? { longitudeIndex: polygon.longitudeIndex }
          : {}),
        ...(Number.isSafeInteger(polygon.lightingFaceIndex)
          ? { lightingFaceIndex: polygon.lightingFaceIndex }
          : {}),
        leaf: {
          tag: "s",
          ...(polygon.polarCap
            ? { className: `saturn-polar-surface saturn-polar-${polygon.polarCap}` }
            : {}),
          ...textureStyle(
            polygon,
            index,
            sharedEdges,
            polygon.polarCap ? 0 : PLANET_SEAM_BLEED,
          ),
        },
      };
    }
    const plan = computeSolidTrianglePlan(
      polygon,
      index,
      {
        ...PLAN_OPTIONS,
        seamBleed: PLANET_SEAM_BLEED,
        ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
      },
    );
    if (!plan) throw new Error(`Solid body leaf ${index} did not prepare.`);
    return {
      latitudeIndex: polygon.latitudeIndex,
      leaf: { tag: "u", style: plan.styleText },
    };
  });
}

function preparePolarMaterialLeaves() {
  return ["outer", "inner"].flatMap((layer) =>
    ["south", "north"].map((pole, index) => ({
      tag: "s",
      className: `saturn-polar-material saturn-polar-${layer}-material saturn-polar-${layer}-material-${pole}`,
      ...textureStyle(
        createPolarCapPolygon(
          pole,
          layer === "inner" ? "inner-material" : "material",
        ),
        index,
        null,
        0,
      ),
    }))
  );
}

function preparePolarInnerLeaves() {
  return ["south", "north"].map((pole, index) => ({
    latitudeIndex: pole === "north" ? LATITUDE_SEGMENTS - 1 : 0,
    leaf: {
      tag: "s",
      className: `saturn-polar-inner saturn-polar-inner-${pole}`,
      ...textureStyle(createPolarCapPolygon(pole, "inner"), index, null, 0),
    },
  }));
}

function prepareBodyBands(preparedBodyLeaves) {
  return Array.from({ length: LATITUDE_SEGMENTS }, (_, latitudeIndex) => {
    const latitudeDegrees = -90 +
      (latitudeIndex + 0.5) * 180 / LATITUDE_SEGMENTS;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const highLatitudeAmount = Math.pow(Math.sin(latitudeRadians), 2);
    const realRotationSeconds = mix(
      SATURN_EQUATOR_CLOUD_ROTATION_SECONDS,
      SATURN_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS,
      highLatitudeAmount,
    );
    // Keep every latitude carrier on one shared geometric phase so adjacent
    // low-poly band boundaries remain aligned throughout the rotation.
    const visualRotationSeconds = PLANET_ROTATION_SECONDS;
    return {
      latitudeIndex,
      latitudeDegrees: Number(latitudeDegrees.toFixed(3)),
      realRotationSeconds: Number(realRotationSeconds.toFixed(3)),
      visualRotationSeconds: Number(visualRotationSeconds.toFixed(3)),
      leaves: preparedBodyLeaves
        .filter((preparedLeaf) => preparedLeaf.latitudeIndex === latitudeIndex)
        .map((preparedLeaf) => preparedLeaf.leaf),
    };
  });
}

function prepareMaterialFaceColumns(bodyBands) {
  const bodyBand = bodyBands.find((band) =>
    band.leaves.some(({ preparedMaterial }) => preparedMaterial));
  const materialLeaves = bodyBand?.leaves.filter(({ preparedMaterial }) =>
    preparedMaterial) ?? [];
  if (materialLeaves.length !== LONGITUDE_SEGMENTS) {
    throw new Error("Saturn prepared material longitude binding drifted.");
  }
  return Object.freeze(materialLeaves.map((leaf, longitudeIndex) =>
    Object.freeze(Array.from(
      { length: PLANET_LIGHTING_FRAME_COLUMNS },
      (_, frameColumn) => {
        const lightingX = formatCssLength(-(
          frameColumn * PLANET_LIGHTING_FRAME_STRIDE_X +
          PLANET_LIGHTING_FRAME_GUTTER +
          (longitudeIndex - SURFACE_OVERLAP) *
            PLANET_LIGHTING_CELL_WIDTH
        ) * PLANET_LIGHTING_PRESENTATION_SCALE_X);
        return `${lightingX},${leaf.materialSurfacePositionX}`;
      },
    ))));
}

function prepareMaterialBandRows(bodyBands) {
  let materialBandIndex = 0;
  return Object.freeze(bodyBands.flatMap((band) => {
    const materialLeaf = band.leaves.find(({ preparedMaterial }) => preparedMaterial);
    if (!materialLeaf) return [];
    const fieldY = (LATITUDE_SEGMENTS - 3 - materialBandIndex) *
      PLANET_LIGHTING_CELL_HEIGHT;
    materialBandIndex += 1;
    return [Object.freeze(Array.from(
      { length: PLANET_LIGHTING_FRAME_ROWS },
      (_, frameRow) => {
        const lightingY = formatCssLength(-(
          frameRow * PLANET_LIGHTING_FRAME_STRIDE_Y +
          PLANET_LIGHTING_FRAME_GUTTER + fieldY -
          SURFACE_OVERLAP * PLANET_LIGHTING_CELL_HEIGHT
        ) * PLANET_LIGHTING_PRESENTATION_SCALE_Y);
        return `${lightingY},${materialLeaf.materialSurfacePositionY}`;
      },
    ))];
  }));
}

function prepareRingPoint(point, index, pointMode) {
  const [x, y, z, color, sourceOpacity, inverted = false] = point;
  const [cssX, cssY, cssZ] = worldPositionToCss([x, y, z]);
  const opacity = inverted ? 0.5 : prepareRingPointOpacity(sourceOpacity);
  const halfSize = 1.18;
  const polygon = {
    vertices: [
      [x - halfSize, y - halfSize, z], [x + halfSize, y - halfSize, z],
      [x + halfSize, y + halfSize, z], [x - halfSize, y + halfSize, z],
    ],
    color,
  };
  const plan = computeTextureAtlasPlanPublic(polygon, index, PLAN_OPTIONS);
  if (!plan) throw new Error(`Ring point ${index} did not prepare.`);
  const transform = pointMode === "billboard"
    ? `${buildPolyMeshTransform({ rotation: [-SATURN_OBLIQUITY_DEGREES, 0, 0] })} ` +
      `${buildPolyMeshTransform({ rotation: [0, 0, -SATURN_PRESENTATION_NODE_DEGREES] })} ` +
      `rotateX(${-CAMERA_ROTATION_X_DEGREES}deg) scale(${POINT_LOCAL_SCALE}) ` +
      `translate(-50%, -50%)`
    : `scale(${POINT_LOCAL_SCALE}) translate(-50%, -50%)`;
  return {
    style: `translate:${formatCssLength(cssX)} ${formatCssLength(cssY)} ` +
      `${formatCssLength(cssZ)};transform:${transform}` +
      `;color:${plan.shadedColor};opacity:${opacity}`,
    opacity: String(opacity),
  };
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

function ringPointMode(population) {
  return population.startsWith("main-ring-") ||
      population === "g-ring-dust" ||
      population === "janus-epimetheus-ring-dust"
    ? "surface"
    : "billboard";
}

function ringPointCompositeMode(population) {
  return population === "g-ring-dust" || population.startsWith("e-ring-")
    ? "flat"
    : "preserve-3d";
}

function ringPointAnimated(population) {
  return !population.startsWith("e-ring-");
}

function prepareRingPointOpacity(sourceOpacity) {
  const [sourceMinimum, sourceMaximum] = RING_POINT_SOURCE_OPACITY_RANGE;
  const normalized = Math.max(0, Math.min(1,
    (sourceOpacity - sourceMinimum) / (sourceMaximum - sourceMinimum)));
  return Number(mix(
    RING_POINT_PRESENTATION_OPACITY_RANGE[0],
    RING_POINT_PRESENTATION_OPACITY_RANGE[1],
    normalized,
  ).toFixed(3));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

const PREPARATION_PHASE = process.argv.includes("--base")
  ? "base"
  : "complete";

if (PREPARATION_PHASE === "base") {
  await preparePlanetTextures({ baseOnly: true });
  console.log("Prepared Saturn base surface, poles, and material masters.");
} else {
  const [moonsModule, lensesModule, viewsModule] = await Promise.all([
    import("../runtime/preparedMoons.mjs"),
    import("../runtime/preparedLenses.mjs"),
    import("../runtime/preparedViews.mjs"),
  ]);
  PREPARED_SATURN_MOONS = moonsModule.PREPARED_SATURN_MOONS;
  PREPARED_SATURN_LENSES = lensesModule.PREPARED_SATURN_LENSES;
  PREPARED_SATURN_VIEWS = viewsModule.PREPARED_SATURN_VIEWS;
  if (PREPARED_SATURN_LENSES.defaultLens !== DEFAULT_LENS_ID) {
    throw new Error("Saturn default lens changed before scene preparation.");
  }
  await prepareCompleteScene();
}

async function prepareCompleteScene() {
const meshTransform = `transform:${buildPolyMeshTransform({ rotation: [0, 0, MESH_ROTATION_Z] })}`;
const systemTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, SATURN_PRESENTATION_NODE_DEGREES],
})} ${buildPolyMeshTransform({ rotation: [SATURN_OBLIQUITY_DEGREES, 0, 0] })}`;
const camera = createPolyCamera({
  zoom: CAMERA_ZOOM,
  rotX: CAMERA_ROTATION_X_DEGREES,
  rotY: 0,
  target: [0, 0, 0],
});
const {
  surface: preparedSurface,
  lighting: preparedLighting,
} = await preparePlanetTextures();
const polarInnerLeaves = preparePolarInnerLeaves();
const preparedBodyLeaves = prepareBody();
const bodyLeaves = [...polarInnerLeaves, ...preparedBodyLeaves];
const bodyBands = prepareBodyBands(bodyLeaves);
const cutawayOuterBodyLeaves = [
  ...prepareCutawayOuterPolarLeaves(),
  ...preparedBodyLeaves.filter((preparedLeaf) =>
    Number.isSafeInteger(preparedLeaf.longitudeIndex) &&
    !interiorLongitudeRemoved(
      (preparedLeaf.longitudeIndex + 0.5) * 360 / LONGITUDE_SEGMENTS,
    )),
];
const cutawayBodyBands = prepareBodyBands(cutawayOuterBodyLeaves);
const interiorMetallicLeaves = prepareInteriorShell({
  radiusScale: PREPARED_SATURN_VIEWS.cutaway.metallicShellRadius,
  surface: PREPARED_SATURN_VIEWS.assets.metallic,
  poles: PREPARED_SATURN_VIEWS.assets.metallicPoles,
  cutaway: true,
});
const interiorCoreLeaves = prepareInteriorShell({
  radiusScale: PREPARED_SATURN_VIEWS.cutaway.diffuseCoreVisualRadius,
  surface: PREPARED_SATURN_VIEWS.assets.core,
  poles: PREPARED_SATURN_VIEWS.assets.corePoles,
  cutaway: false,
});
const interiorSectionLeaves = prepareInteriorSectionLeaves();
const cutawayBodyLeafCount = cutawayBodyBands.reduce(
  (count, band) => count + band.leaves.length,
  0,
);
const interiorLeafCount = cutawayBodyLeafCount +
  interiorMetallicLeaves.length + interiorCoreLeaves.length +
  interiorSectionLeaves.length;
const bodyLeafCount = bodyBands.reduce((count, band) => count + band.leaves.length, 0);
const preparedRingPointGroups = PREPARED_RING_GROUPS.map((group, retainedIndex) => {
  const groupIndex = group.expansionGroupIndex ??
    (retainedIndex === 0 ? 0 : retainedIndex + 1);
  const pointMode = ringPointMode(group.population);
  const expansionPoints = group.points.map((point, index) =>
    prepareRingPointExpansion(point, index, groupIndex));
  return {
    population: group.population,
    pointMode,
    compositeMode: ringPointCompositeMode(group.population),
    animated: ringPointAnimated(group.population),
    pointCount: group.points.length,
    expansionPointCount: expansionPoints.length,
    durationSeconds: group.durationSeconds,
    leaves: group.points.map((point, index) =>
      prepareRingPoint(point, index, pointMode)),
    expansionLeaves: expansionPoints.map((point, index) => prepareRingPoint(
      point,
      group.points.length + index,
      pointMode,
    )),
  };
});
const baselineRingPointLeafCount = preparedRingPointGroups.reduce(
  (count, group) => count + group.leaves.length,
  0,
);
const expansionRingPointLeafCount = preparedRingPointGroups.reduce(
  (count, group) => count + group.expansionLeaves.length,
  0,
);
const preparedRingMotionPlates = PREPARED_MAIN_RING_PLATES.map(
  canonicalRingMotionPlateStyle,
);
const preparedRingMotionExpansionPlates = [];
const orbitDefaultControlPitch =
  CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES *
  (1 - CAMERA_ROTATION_X_DEGREES /
    CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES);
const orbitStartRemaining =
  CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES /
  (CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES -
    orbitDefaultControlPitch);
const orbitTransform = (remaining) => {
  const scenePitch = CAMERA_ROTATION_X_DEGREES * remaining;
  const systemTilt = -SATURN_OBLIQUITY_DEGREES * remaining;
  const cameraTransform = buildPolyCameraSceneTransform({
    ...camera.state,
    rotX: scenePitch,
  });
  const systemNode = -SATURN_PRESENTATION_NODE_DEGREES;
  return `${cameraTransform} rotateZ(${systemNode}deg) ` +
    `rotateY(${systemTilt}deg) ` +
    `rotateY(${SATURN_OBLIQUITY_DEGREES}deg) ` +
    `rotateZ(${-systemNode}deg)`;
};
const preparedBodyVisibility = prepareBodyVisibility({
  bodyBands,
  defaultControlPitch: orbitDefaultControlPitch,
  orbitStartRemaining,
  orbitTransform,
  systemTransform,
});
const scene = {
  schema: "csssaturn-prepared-retained-scene@30",
  camera: {
    state: camera.state,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
    orbitPlayback: {
      schema: "csssaturn-prepared-camera-orbit@3",
      minimumControlPitchDegrees:
        CAMERA_ORBIT_MINIMUM_CONTROL_PITCH_DEGREES,
      maximumControlPitchDegrees:
        CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES,
      defaultControlPitchDegrees: orbitDefaultControlPitch,
      maximumScenePitchDegrees: CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES,
      durationMilliseconds:
        CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES * 1_000,
      millisecondsPerControlDegree: 1_000,
      keyframes: [
        { transform: orbitTransform(orbitStartRemaining) },
        { transform: orbitTransform(0) },
      ],
      interpolation: "linear-same-axis-transform-functions",
      runtimeTransport:
        "prepared-two-keyframe-compositor-scrub",
      runtimeMatrixConstructionForPitch: false,
      runtimeTransformStringFormattingForPitch: false,
    },
  },
  systemTransform,
  meshTransform,
  planetFaceRetention: {
    model: "complete-source-longitudes-prepared-projective-backface-ownership",
    longitudeCount: LONGITUDE_SEGMENTS,
    preparedVisibility: preparedBodyVisibility,
  },
  preparedSurface,
  preparedLighting,
  fixedMaterialPlane: {
    model:
      "approved-default-continuously-projected-dense-state-oblate-material-plane",
    transform: meshTransform,
    leaf: preparedLighting.leaf,
    runtimeWork: "single-transform-and-address-on-input-change",
    interactionProjection: {
      equatorialRadius: EQUATORIAL_RADIUS,
      polarRadius: POLAR_RADIUS,
      coverageScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      textureSize: PLANET_FIXED_MATERIAL_SIZE,
      depthBias: PLANET_FIXED_MATERIAL_DEPTH_BIAS,
      presentationNodeDegrees: SATURN_PRESENTATION_NODE_DEGREES,
      meshRotationDegrees: MESH_ROTATION_Z,
      tileSize: TILE_SIZE,
    },
  },
  preparedRingSource: PREPARED_RING_SOURCE,
  ringPlane: canonicalRingTextureStyle(),
  ringMotionPlates: preparedRingMotionPlates,
  ringMotionExpansionPlates: preparedRingMotionExpansionPlates,
  ringShadowPlane: croppedRingShadowTextureStyle(),
  ringPointGroups: preparedRingPointGroups,
  moons: PREPARED_SATURN_MOONS,
  bodyBands,
  interior: {
    schema: "csssaturn-prepared-cutaway@1",
    qualification: PREPARED_SATURN_VIEWS.cutaway.qualification,
    cutaway: PREPARED_SATURN_VIEWS.cutaway,
    outerBodyBands: cutawayBodyBands,
    shells: [
      {
        id: "metallic-hydrogen",
        className: "saturn-interior-metallic-shell",
        leaves: interiorMetallicLeaves,
      },
      {
        id: "diffuse-core",
        className: "saturn-interior-core-shell",
        leaves: interiorCoreLeaves,
      },
    ],
    sectionLeaves: interiorSectionLeaves,
    atmosphere: preparedLighting.interiorAtmosphere,
    runtimeGeometry: false,
    runtimeRasterization: false,
    leafCount: interiorLeafCount,
  },
  preparedMotion: {
    model: "nasa-cloud-periods-shared-phase-rotation-under-fixed-world-material-plane",
    referenceRotationRealSeconds: SATURN_REFERENCE_ROTATION_SECONDS,
    referenceRotationVisualSeconds: PLANET_ROTATION_SECONDS,
    presentationTimeScale: Number(PRESENTATION_TIME_SCALE.toFixed(6)),
    equatorCloudRotationRealSeconds: SATURN_EQUATOR_CLOUD_ROTATION_SECONDS,
    highLatitudeCloudRotationRealSeconds:
      SATURN_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS,
    obliquityDegrees: SATURN_OBLIQUITY_DEGREES,
    obliquityAxis: "source-x",
    obliquityOwner: "retained-saturn-system-parent",
    presentationNodeDegrees: SATURN_PRESENTATION_NODE_DEGREES,
    cameraOrbitalElevationDegrees: CAMERA_ORBITAL_ELEVATION_DEGREES,
    cameraRotationXDegrees: CAMERA_ROTATION_X_DEGREES,
    ringPointPresentation: {
      primitive: "prepared-mode-polycss-point-leaf",
      surfacePointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "surface")
        .reduce((count, group) => count + group.points.length, 0),
      preparedRasterPointCount:
        PREPARED_MAIN_RING_PLATES.reduce(
          (count, plate) => count + plate.pointCount,
          0,
        ),
      preparedRasterPlateCount: preparedRingMotionPlates.length,
      preparedRasterExpansionPointCount: 0,
      preparedRasterExpansionPlateCount: 0,
      billboardPointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "billboard")
        .reduce((count, group) => count + group.points.length, 0),
      animatedBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) =>
          ringPointMode(group.population) === "billboard" &&
          ringPointAnimated(group.population))
        .reduce((count, group) => count + group.points.length, 0),
      staticBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) =>
          ringPointMode(group.population) === "billboard" &&
          !ringPointAnimated(group.population))
        .reduce((count, group) => count + group.points.length, 0),
      maximumSurfacePointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "surface")
        .reduce((count, group) => count + group.points.length * 2, 0),
      maximumBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "billboard")
        .reduce((count, group) => count + group.points.length * 2, 0),
      densityRange: [1, 1],
      defaultDensity: 1,
      surfaceMode: "coplanar-ring-quad-no-counter-rotation",
      freeDustMode: "none",
      localScale: Number(POINT_LOCAL_SCALE.toFixed(6)),
      varianceModel: "prepared-continuous-opacity-with-fixed-point-size",
      sourceOpacityRange: RING_POINT_SOURCE_OPACITY_RANGE,
      presentationOpacityRange: RING_POINT_PRESENTATION_OPACITY_RANGE,
      runtimeJavaScriptWritesPerFrame: 0,
    },
    viewingGeometry: "fixed-camera-independent-orbital-frame-presentation",
  },
  counts: {
    polygonCount: 2 + preparedRingMotionPlates.length +
      preparedRingMotionExpansionPlates.length +
      baselineRingPointLeafCount + expansionRingPointLeafCount +
      PREPARED_SATURN_MOONS.counts.moonLeafCount +
      bodyLeafCount + interiorLeafCount + 2,
    planetPolygonCount: bodyLeafCount + 1,
    interiorLeafCount,
    cutawayBodyLeafCount,
    interiorMetallicLeafCount: interiorMetallicLeaves.length,
    interiorCoreLeafCount: interiorCoreLeaves.length,
    interiorSectionLeafCount: interiorSectionLeaves.length,
    interiorAtmosphereLeafCount: 1,
    polarInnerLeafCount: polarInnerLeaves.length,
    polarSurfaceLeafCount: 2,
    polarMaterialLeafCount: 0,
    polarInnerMaterialLeafCount: 0,
    fixedMaterialPlaneLeafCount: 1,
    ringPlaneCount: 1,
    ringShadowPlaneCount: 1,
    ringPointCount: PREPARED_RING_SOURCE.pointCount,
    baselineRingPointLeafCount,
    ringPointExpansionLeafCount: expansionRingPointLeafCount,
    ringPointLeafCount:
      baselineRingPointLeafCount + expansionRingPointLeafCount,
    ringMotionPlateLeafCount: preparedRingMotionPlates.length,
    ringMotionExpansionPlateLeafCount:
      preparedRingMotionExpansionPlates.length,
    ringDustTextureLeafCount: 0,
    ringPointGroupCount: PREPARED_RING_GROUPS.length,
    ...PREPARED_SATURN_MOONS.counts,
    bodyBandCount: bodyBands.length,
    textureLeafCount: 3 + preparedRingMotionPlates.length +
      preparedRingMotionExpansionPlates.length +
      bodyLeafCount + interiorLeafCount + 1 +
      PREPARED_SATURN_MOONS.counts.moonTextureLeafCount,
  },
};
scene.interactionFrames = preparedInteractionFrames(scene);

function runtimeLeaf(leaf) {
  return {
    ...(leaf.tag ? { tag: leaf.tag } : {}),
    ...(leaf.className ? { className: leaf.className } : {}),
    style: leaf.style,
    ...(leaf.projectiveTextureLayer
      ? { projectiveTextureLayer: leaf.projectiveTextureLayer }
      : {}),
  };
}

function runtimeBodyBand(band) {
  return {
    visualRotationSeconds: band.visualRotationSeconds,
    leaves: band.leaves.map(runtimeLeaf),
  };
}

function runtimePreparedPresentation(presentation) {
  return {
    ...(presentation.assetUrl ? { assetUrl: presentation.assetUrl } : {}),
    ...(presentation.asset2xUrl
      ? { asset2xUrl: presentation.asset2xUrl }
      : {}),
    ...(presentation.frameIndex === undefined
      ? {}
      : { frameIndex: presentation.frameIndex }),
    ...(presentation.rowIndex === undefined
      ? {}
      : { rowIndex: presentation.rowIndex }),
    ...(presentation.backgroundPosition
      ? { backgroundPosition: presentation.backgroundPosition }
      : {}),
    ...(presentation.backgroundSize
      ? { backgroundSize: presentation.backgroundSize }
      : {}),
  };
}

function runtimePreparedRowPlan(plan) {
  const runtimeVariant = (variant) => ({
    runtimeAtlas: runtimePreparedPresentation(variant.runtimeAtlas),
    ...(variant.defaultPresentation ? {
      defaultPresentation: runtimePreparedPresentation(
        variant.defaultPresentation,
      ),
    } : {}),
    rows: variant.rows.map(runtimePreparedPresentation),
    presentations: variant.presentations.map(runtimePreparedPresentation),
  });
  return {
    model: plan.model,
    ...(plan.defaultVariant ? { defaultVariant: plan.defaultVariant } : {}),
    defaultPreparedFrame: plan.defaultPreparedFrame,
    defaultPreparedRow: plan.defaultPreparedRow,
    initialWarmRows: plan.initialWarmRows,
    maximumRetainedAtlasCount: plan.maximumRetainedAtlasCount,
    ...(plan.variants ? {
      variants: Object.fromEntries(Object.entries(plan.variants).map(
        ([id, variant]) => [id, runtimeVariant(variant)],
      )),
    } : runtimeVariant(plan)),
    initialDecodedWorkingSetBytes: plan.initialDecodedWorkingSetBytes,
    maximumDecodedWorkingSetBytes: plan.maximumDecodedWorkingSetBytes,
    fullAtlasDecodedRgbaBytes: plan.fullAtlasDecodedRgbaBytes,
  };
}

function runtimeInteriorAtmosphere(atmosphere) {
  return {
    model: atmosphere.model,
    frameCount: atmosphere.frameCount,
    minimumScenePitchDegrees: atmosphere.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atmosphere.maximumScenePitchDegrees,
    leaf: runtimeLeaf(atmosphere.leaf),
    runtimeShards: runtimePreparedRowPlan(atmosphere.runtimeShards),
  };
}

function runtimeMoonShadowAtlas(atlas) {
  return {
    frameCount: atlas.frameCount,
    minimumScenePitchDegrees: atlas.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atlas.maximumScenePitchDegrees,
    runtimeShards: runtimePreparedRowPlan(atlas.runtimeShards),
  };
}

function createRuntimeScenePlan(source) {
  return {
    schema: "csssaturn-prepared-runtime-scene@1",
    camera: source.camera,
    systemTransform: source.systemTransform,
    meshTransform: source.meshTransform,
    preparedSurface: {
      mode: source.preparedSurface.mode,
      assetUrl: source.preparedSurface.assetUrl,
      assetBytes: source.preparedSurface.assetBytes,
      assetSha256: source.preparedSurface.assetSha256,
      faceCount: source.preparedSurface.faceCount,
      uvLayout: source.preparedSurface.uvLayout,
      equivalentBodySampleWidth:
        source.preparedSurface.equivalentBodySampleWidth,
      equivalentBodySampleHeight:
        source.preparedSurface.equivalentBodySampleHeight,
      seamRepair: source.preparedSurface.seamRepair,
    },
    transport: {
      sourceSchema: source.schema,
      sourceMetadataModule: "preparedScene.mjs",
      retainedLeafFields: [
        "tag",
        "className",
        "style",
        "projectiveTextureLayer",
      ],
      minorMoonFields: ["style"],
      runtimeSourceParsing: false,
    },
    preparedLighting: {
      mode: source.preparedLighting.mode,
      orbitAtlas: {
        frameCount: source.preparedLighting.orbitAtlas.frameCount,
        frameRows: source.preparedLighting.orbitAtlas.frameRows,
        minimumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.minimumScenePitchDegrees,
        maximumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.maximumScenePitchDegrees,
        runtimeShards: runtimePreparedRowPlan(
          source.preparedLighting.orbitAtlas.runtimeShards,
        ),
      },
    },
    fixedMaterialPlane: {
      transform: source.fixedMaterialPlane.transform,
      leaf: runtimeLeaf(source.fixedMaterialPlane.leaf),
      interactionProjection: source.fixedMaterialPlane.interactionProjection,
    },
    interactionFrames: source.interactionFrames,
    preparedRingSource: {
      planeVisualOrbitSeconds: source.preparedRingSource.planeVisualOrbitSeconds,
      saturnGmKm3PerS2: source.preparedRingSource.saturnGmKm3PerS2,
      shadowModel: {
        systemTiltDegrees:
          source.preparedRingSource.shadowModel.systemTiltDegrees,
        systemNodeDegrees:
          source.preparedRingSource.shadowModel.systemNodeDegrees,
      },
    },
    ringPlane: runtimeLeaf(source.ringPlane),
    ringMotionPlates: source.ringMotionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: plate.compositeMode,
      durationSeconds: plate.durationSeconds,
      textureUrl: plate.textureUrl,
      texture2xUrl: plate.texture2xUrl,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringMotionExpansionPlates: source.ringMotionExpansionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: plate.compositeMode,
      durationSeconds: plate.durationSeconds,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringShadowPlane: runtimeLeaf(source.ringShadowPlane),
    ringPointGroups: source.ringPointGroups.map((group) => ({
      pointMode: group.pointMode,
      animated: group.animated,
      compositeMode: group.compositeMode,
      durationSeconds: group.durationSeconds,
      leaves: group.leaves.map(runtimeLeaf),
      expansionLeaves: group.expansionLeaves.map(runtimeLeaf),
    })),
    moons: {
      presentation: {
        minorMoonPreparedPositionCount:
          source.moons.presentation.minorMoonPreparedPositionCount,
      },
      shadowAtlas: runtimeMoonShadowAtlas(source.moons.shadowAtlas),
      moons: source.moons.moons.map((moon) => ({
        id: moon.id,
        orbitTransform: moon.orbitTransform,
        bodyTransform: moon.bodyTransform,
        leaves: moon.leaves.map(runtimeLeaf),
        ...(moon.billboard ? { billboard: moon.billboard } : {}),
        ...(moon.label ? { label: moon.label } : {}),
        ...(moon.shadow ? {
          shadow: {
            counterTransform: moon.shadow.counterTransform,
            projection: moon.shadow.projection,
            leaf: runtimeLeaf(moon.shadow.leaf),
          },
        } : {}),
      })),
      minorMoonDots: source.moons.minorMoonDots.map(({ style }) => ({ style })),
      counts: source.moons.counts,
    },
    bodyBands: source.bodyBands.map(runtimeBodyBand),
    interior: {
      schema: source.interior.schema,
      outerBodyBands: source.interior.outerBodyBands.map(runtimeBodyBand),
      shells: source.interior.shells.map((shell) => ({
        className: shell.className,
        leaves: shell.leaves.map(runtimeLeaf),
      })),
      sectionLeaves: source.interior.sectionLeaves.map(runtimeLeaf),
      atmosphere: runtimeInteriorAtmosphere(source.interior.atmosphere),
      leafCount: source.interior.leafCount,
    },
    preparedMotion: {
      referenceRotationVisualSeconds:
        source.preparedMotion.referenceRotationVisualSeconds,
      obliquityDegrees: source.preparedMotion.obliquityDegrees,
      cameraRotationXDegrees: source.preparedMotion.cameraRotationXDegrees,
    },
    counts: source.counts,
  };
}

const runtimeScene = createRuntimeScenePlan(scene);
const output = `// Generated by tools/prepare-scene.mjs. Do not edit by hand.\n` +
  `export const PREPARED_SATURN_SCENE = ${JSON.stringify(scene)};\n`;
const runtimeOutput =
  `// Generated by tools/prepare-scene.mjs. Do not edit by hand.\n` +
  `export const PREPARED_SATURN_RUNTIME_SCENE = ` +
  `${JSON.stringify(runtimeScene)};\n`;
await Promise.all([
  writeFile(OUTPUT_URL, output),
  writeFile(RUNTIME_OUTPUT_URL, runtimeOutput),
]);
console.log(`wrote ${fileURLToPath(OUTPUT_URL)} (${Buffer.byteLength(output)} bytes)`);
console.log(
  `wrote ${fileURLToPath(RUNTIME_OUTPUT_URL)} ` +
  `(${Buffer.byteLength(runtimeOutput)} bytes)`,
);
}

#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import {
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
  worldPositionToCss,
} from "@layoutit/polycss";

import {
  optimizePreparedLosslessWebp,
  optimizePreparedQ75Webp,
  PREPARED_Q75_WEBP_ENCODING,
} from "../../../../tools/prepared-webp.mjs";
import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  packProjectiveSurfaceRaster,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import { validateNeptuneSourceGroup } from "./source-manifest.mjs";

const preserveSkybox = process.argv.includes("--preserve-skybox");
const PROJECTIVE_TEXTURE_RASTER_SCALE = 4;

const publicRoot = resolve(import.meta.dirname, "../../../../public/scenes/neptune");
const sourceRoot = resolve(import.meta.dirname, "../source");
const TRUE_COLOR_REFERENCE_PATH = resolve(
  sourceRoot,
  "color/ras-oxford-neptune-true-colors-2024.jpg",
);
const TRUE_COLOR_REFERENCE_SAMPLE = Object.freeze({
  left: 1780,
  top: 1070,
  width: 200,
  height: 200,
});
const OPAL_TRUE_COLOR_SAMPLE = Object.freeze({
  left: 0,
  top: 150,
  width: 720,
  height: 80,
});
await Promise.all([
  mkdir(publicRoot, { recursive: true }),
  mkdir(resolve(import.meta.dirname, "../runtime"), { recursive: true }),
  mkdir(resolve(import.meta.dirname, "../site"), { recursive: true }),
]);
await Promise.all([
  validateNeptuneSourceGroup("scene"),
  validateNeptuneSourceGroup("lenses"),
  ...(preserveSkybox ? [] : [validateNeptuneSourceGroup("stars")]),
  validateNeptuneSourceGroup("rings"),
  validateNeptuneSourceGroup("moons"),
]);

const EQUATORIAL_RADIUS_KM = 24_764;
const POLAR_RADIUS_KM = 24_314;
const EQUATORIAL_RADIUS = 220;
const POLAR_RADIUS = EQUATORIAL_RADIUS * POLAR_RADIUS_KM / EQUATORIAL_RADIUS_KM;
const OUTER_RING_RADIUS_KM = 62_933;
const OUTER_RING_RADIUS = EQUATORIAL_RADIUS * OUTER_RING_RADIUS_KM / EQUATORIAL_RADIUS_KM;
const LATITUDES = 20;
const LONGITUDES = 40;
const TILE_SIZE = 50;
const SURFACE_WIDTH = 2880;
const SURFACE_HEIGHT = 1440;
const SURFACE_RASTER_CELL_SIZE = 64;
const SURFACE_SOURCE_CELL_WIDTH = SURFACE_WIDTH / LONGITUDES;
const SURFACE_SOURCE_CELL_HEIGHT = SURFACE_HEIGHT / LATITUDES;
const SURFACE_RASTER_GUTTER = SURFACE_SOURCE_CELL_HEIGHT / 4;
const SURFACE_OVERLAP = 0.05;
const SURFACE_RASTER_OVERSCAN = 0;
const SURFACE_SEAM_BLEED = 0;
const POLAR_TILE = 128;
const MATERIAL_SIZE = 1024;
const MATERIAL_COVERAGE_SCALE = 1.002;
const MATERIAL_CONTENT_SCALE = 0.992;
const MATERIAL_DEPTH_BIAS = 0.5;
const ORBIT_MATERIAL_SIZE = 256;
const ORBIT_MATERIAL_GUTTER = 2;
const ORBIT_MATERIAL_STRIDE =
  ORBIT_MATERIAL_SIZE + ORBIT_MATERIAL_GUTTER * 2;
const ORBIT_MATERIAL_FRAME_COUNT = 256;
const ORBIT_MATERIAL_COLUMNS = 16;
const ORBIT_MATERIAL_ROWS = 16;
const ORBIT_MATERIAL_ROW_WIDTH =
  ORBIT_MATERIAL_COLUMNS * ORBIT_MATERIAL_STRIDE;
const ORBIT_MATERIAL_ROW_HEIGHT = ORBIT_MATERIAL_STRIDE;
const MOON_ATLAS_CELL_SIZE = 32;
const MOON_ATLAS_URL = "/scenes/neptune/neptune-moon-dots.webp";
const MOON_ATLAS_2X_URL = "/scenes/neptune/neptune-moon-dots@2x.webp";
const MOON_BASE_COLOR = Object.freeze([201, 216, 234]);
const MOON_SHADOW_COLOR = Object.freeze([14, 29, 52]);
const MOON_GLOW_COLOR = Object.freeze([159, 202, 255]);
const MOON_GLOW_RADIUS = 5;
const POLAR_BOUNDARY_LATITUDE = Math.PI / 2 - Math.PI / LATITUDES;
const POLAR_BOUNDARY_RADIUS = EQUATORIAL_RADIUS * Math.cos(POLAR_BOUNDARY_LATITUDE);
const POLAR_BOUNDARY_Z = POLAR_RADIUS * Math.sin(POLAR_BOUNDARY_LATITUDE);
const POLAR_SURFACE_OVERLAP = 1.035;
const POLAR_INNER_OVERLAP = 1.05;
const POLAR_INNER_INSET = 2.4;
const PRESENTATION_NODE_DEGREES = -60;
const MESH_ROTATION_DEGREES = 128;
const SYSTEM_OBLIQUITY_DEGREES = 28.32;
const MATERIAL_AMBIENT_FRACTION = 0.22;
const MATERIAL_TERMINATOR_SMOOTHSTEP = Object.freeze([0, 0.1]);
const MATERIAL_ATMOSPHERE_MAXIMUM_ALPHA = 0.72;
const MATERIAL_ATMOSPHERE_LIMB_EXPONENT = 1.75;
const MATERIAL_ATMOSPHERE_NIGHT_FLOOR = 0.22;
const SURFACE_URLS = Object.freeze({
  normal: "/scenes/neptune/neptune-surface-normal.webp",
  methane: "/scenes/neptune/neptune-surface-methane.webp",
  "near-infrared": "/scenes/neptune/neptune-surface-near-infrared.webp",
});
const POLE_URLS = Object.freeze({
  normal: "/scenes/neptune/neptune-poles-normal.webp",
  methane: "/scenes/neptune/neptune-poles-methane.webp",
  "near-infrared": "/scenes/neptune/neptune-poles-near-infrared.webp",
});
const CAMERA_MIN = 0;
const CAMERA_MAX = 89;
const CAMERA_STEP = 0.01;
const CAMERA_MAX_SCENE_PITCH = 65;
const CAMERA_INITIAL_SCENE_PITCH = 40;
const CAMERA_INITIAL_ZOOM = 1.1;
const CAMERA_DEFAULT_CONTROL_PITCH = CAMERA_MAX * (1 - CAMERA_INITIAL_SCENE_PITCH / CAMERA_MAX_SCENE_PITCH);
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: SURFACE_SEAM_BLEED,
  directionalLight: Object.freeze({ direction: Object.freeze([0.42, -0.73, 0.54]), color: "#dce9ff", intensity: Math.PI }),
  ambientLight: Object.freeze({ color: "#9bbcf0", intensity: 0.22 * Math.PI }),
});

const preparedSurfaces = await prepareSurfaces();
await Promise.all([
  ...(preserveSkybox ? [] : [prepareStarfield()]),
  prepareRings(),
]);
const moons = await prepareMoons();
await prepareMoonAtlas(moons);
const bodyBands = prepareBodyBands();
const BODY_LEAF_COUNT = bodyBands.reduce(
  (sum, band) => sum + band.leaves.length,
  0,
);
const ringLeaf = prepareRingLeaf();
const CAMERA_STATE_COUNT = Math.round((CAMERA_MAX - CAMERA_MIN) / CAMERA_STEP) + 1;
const INITIAL_CAMERA_TRANSFORM =
  `scale(${0.02 * CAMERA_INITIAL_ZOOM}) ` +
  `rotateX(${CAMERA_INITIAL_SCENE_PITCH}deg) rotate(0deg) ` +
  "translate3d(0px, 0px, 0px)";
const scene = deepFreeze({
  schema: "cssneptune-prepared-runtime-scene@1",
  camera: {
    style: "perspective:1000000px",
    minimumControlPitchDegrees: CAMERA_MIN,
    maximumControlPitchDegrees: CAMERA_MAX,
    maximumScenePitchDegrees: CAMERA_MAX_SCENE_PITCH,
    stateStepDegrees: CAMERA_STEP,
    stateCount: CAMERA_STATE_COUNT,
    defaultControlPitchDegrees: CAMERA_DEFAULT_CONTROL_PITCH,
    initialZoom: CAMERA_INITIAL_ZOOM,
    minimumZoom: 0.42,
    maximumZoom: 4,
    initialTransform: INITIAL_CAMERA_TRANSFORM,
    orbitPlayback: {
      schema: "cssneptune-prepared-camera-orbit@1",
      stateStepDegrees: CAMERA_STEP,
      stateCount: CAMERA_STATE_COUNT,
      interpolation: "none-exact-quantized-camera-state",
      runtimeTransport: "embedded-gzip-matrix-bank-direct-retained-root-publication",
      initialScenePitchDegrees: CAMERA_INITIAL_SCENE_PITCH,
      initialSystemTiltDegrees: -SYSTEM_OBLIQUITY_DEGREES,
      systemNodeDegrees: -PRESENTATION_NODE_DEGREES,
    },
  },
  systemTransform: "transform:rotateZ(60deg) rotateY(-28.32deg)",
  meshTransform: "transform:rotateZ(-128deg)",
  fixedMaterialPlane: {
    model: "prepared-transparent-front-tangent-depth-plane",
    transform: "transform:rotateZ(-128deg)",
    leaf: preparedSurfaces[0].materialLeaf,
    runtimeWork: "single-transform-and-prepared-address-on-input-change",
    interactionProjection: {
      equatorialRadius: EQUATORIAL_RADIUS,
      polarRadius: POLAR_RADIUS,
      coverageScale: MATERIAL_COVERAGE_SCALE,
      textureSize: MATERIAL_SIZE,
      depthBias: MATERIAL_DEPTH_BIAS,
      presentationNodeDegrees: PRESENTATION_NODE_DEGREES,
      meshRotationDegrees: MESH_ROTATION_DEGREES,
      tileSize: TILE_SIZE,
    },
  },
  bodyBands,
  ring: {
    leaf: ringLeaf,
    outerRadiusKm: OUTER_RING_RADIUS_KM,
    outerRadius: OUTER_RING_RADIUS,
    source: "NASA PDS Rings Node Neptune table",
  },
  moons,
  moonPresentation: {
    model: "prepared-source-radius-scaled-camera-facing-shaded-dot-atlas",
    billboardModel:
      "prepared-orbit-counter-rotation-with-camera-and-system-counter-rotation",
    source: "NASA/JPL Solar System Dynamics physical radii",
    asset: {
      url: MOON_ATLAS_URL,
      url2x: MOON_ATLAS_2X_URL,
      cellSize: MOON_ATLAS_CELL_SIZE,
      width: MOON_ATLAS_CELL_SIZE * moons.length,
      height: MOON_ATLAS_CELL_SIZE,
      frameCount: moons.length,
    },
    baseColor: MOON_BASE_COLOR,
    shadowColor: MOON_SHADOW_COLOR,
    glowColor: MOON_GLOW_COLOR,
    glowRadius: MOON_GLOW_RADIUS,
    runtimeRasterization: false,
  },
  lenses: preparedSurfaces,
  motion: { referenceRotationHours: 16, bodyVisualRotationSeconds: 72, visualMoonTimeScale: "presentation-scaled from JPL periods" },
  preparedLighting: {
    mode: "prepared-view-bank-shared-scene-transparent-material-overlay",
    surfaceOwner: `${BODY_LEAF_COUNT} retained source-textured PolyCSS face leaves`,
    overlayModel:
      "saturn-schema-directional-attenuation-and-source-derived-atmospheric-limb-over-retained-face-textures",
    worldLightDirection: PLAN_OPTIONS.directionalLight.direction,
    ambientFraction: MATERIAL_AMBIENT_FRACTION,
    atmosphereColorModel:
      "true-colour-calibrated-normal-or-declared-false-colour-source-bright-tail-chromaticity",
    fullColorSurfaceInMaterial: false,
    runtimeLightingMath: false,
    runtimeRasterization: false,
  },
  counts: { bodyLeafCount: BODY_LEAF_COUNT, polarSurfaceLeafCount: 2, polarInnerLeafCount: 2, fixedMaterialPlaneLeafCount: 1, ringLeafCount: 1, moonCount: moons.length, detailedMoonCount: moons.filter(({ group }) => group === "major").length, textureLeafCount: BODY_LEAF_COUNT + 2 },
  surfacePreparation: {
    sourceProjection: "OPAL 2-pixel-per-degree global map",
    unobservedNorthPolarTreatment: "prepared source-derived extrapolation from the +30 degree latitude row to its longitudinal mean at the pole",
    retainedSurface: `${BODY_LEAF_COUNT} prepared projective PolyCSS surface leaves plus one prepared projective PolyCSS material leaf`,
    projectiveLeafOrientation: "prepared latitude-strip north-south correction",
    seamRepair: {
      model: "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed: SURFACE_SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: SURFACE_RASTER_GUTTER,
      rasterOverscan: SURFACE_RASTER_OVERSCAN,
      runtimeEdgeDiscovery: false,
    },
    fixedMaterialPresentation: "retained s leaf in the shared PolyCSS scene for body-ring-moon depth sorting; no ordinary image or disk element",
    runtimeImageProcessing: false,
  },
  provenance: { shape: "OpenSpace Neptune globe asset at commit 56e29b54b8592084ff1fef47c2e08de0b22ce516", surface: "Hubble OPAL Cycle 32 Neptune 2025b detail calibrated to the Irwin et al. 2024 true-colour reconstruction", rings: "NASA PDS Rings Node", moons: "NASA/JPL Solar System Dynamics" },
});
await Promise.all([
  writeFile(resolve(import.meta.dirname, "../runtime/preparedScene.mjs"), `// Generated by tools/prepare-scene.mjs; runtime transports this retained plan.\nexport const PREPARED_NEPTUNE_SCENE = Object.freeze(${JSON.stringify(scene)});\n`),
  writeFile(resolve(import.meta.dirname, "../runtime/preparedLenses.mjs"), `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_NEPTUNE_LENSES = Object.freeze(${JSON.stringify({ schema: "cssneptune-prepared-lenses@1", defaultLens: "normal", runtimeFilters: false, runtimeRasterization: false, controls: preparedSurfaces })});\n`),
  writeFile(resolve(import.meta.dirname, "../runtime/preparedMoons.mjs"), `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_NEPTUNE_MOONS = Object.freeze(${JSON.stringify({ schema: "cssneptune-prepared-moons@1", count: moons.length, moons, source: "NASA/JPL Solar System Dynamics NEP097 mean elements and discovery tables" })});\n`),
]);
console.log(JSON.stringify({ bodyLeaves: scene.counts.bodyLeafCount, moons: moons.length, lenses: preparedSurfaces.length, cameraStates: CAMERA_STATE_COUNT }, null, 2));

async function prepareSurfaces() {
  const visiblePath = resolve(sourceRoot, "opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif");
  const visibleSource = await sharp(visiblePath)
    .extract({ left: 0, top: 0, width: 720, height: 360 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const trueColorCalibration = await prepareVisibleTrueColorCalibration(
    visibleSource,
    720,
    360,
  );
  const visiblePreparedSource = applyVisibleTrueColorCalibration(
    fillUnobservedVisiblePixels(visibleSource, 720, 360),
    trueColorCalibration,
  );
  const visible = await sharp(visiblePreparedSource, {
    raw: { width: 720, height: 360, channels: 3 },
  }).resize(SURFACE_WIDTH, SURFACE_HEIGHT, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
  const methane = await fitsFalseColour(resolve(sourceRoot, "opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_fq619n_v1_globalmap.fits"), [[4, 17, 31], [26, 108, 139], [205, 245, 246]]);
  const infrared = await fitsFalseColour(resolve(sourceRoot, "opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f845m_v1_globalmap.fits"), [[7, 8, 20], [49, 46, 105], [214, 183, 244]]);
  const sources = { normal: visible, methane, "near-infrared": infrared };
  const controls = [];
  for (const [id, buffer] of Object.entries(sources)) {
    const sourceInfo = { width: SURFACE_WIDTH, height: SURFACE_HEIGHT, channels: 3 };
    const body1x = packProjectiveSurfaceRaster(
      buffer,
      {
        ...sourceInfo,
        bandCount: LATITUDES,
        gutter: SURFACE_RASTER_GUTTER,
      },
    );
    const source2x = await sharp(buffer, { raw: sourceInfo })
      .resize(5120, 2560, { kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const body2x = packProjectiveSurfaceRaster(source2x.data, {
      width: source2x.info.width,
      height: source2x.info.height,
      channels: source2x.info.channels,
      bandCount: LATITUDES,
      gutter: SURFACE_RASTER_GUTTER * source2x.info.height / SURFACE_HEIGHT,
    });
    const output1 = resolve(publicRoot, `neptune-surface-${id}.webp`);
    const output2 = resolve(publicRoot, `neptune-surface-${id}@2x.webp`);
    const poleOutput = resolve(publicRoot, `neptune-poles-${id}.webp`);
    const materialOutput = resolve(publicRoot, `neptune-material-${id}.webp`);
    const shadowlessMaterialOutput = resolve(
      publicRoot,
      `neptune-material-${id}-shadowless.webp`,
    );
    const thumbOutput = resolve(publicRoot, `neptune-lens-${id}.webp`);
    const atmosphereColor = prepareSourceAtmosphereColor(buffer);
    const material = prepareFixedMaterialPlane(id, { atmosphereColor });
    const shadowlessMaterial = prepareFixedMaterialPlane(id, {
      atmosphereColor,
      shadowless: true,
      textureUrl: `/scenes/neptune/neptune-material-${id}-shadowless.webp`,
    });
    await Promise.all([
      sharp(body1x.data, {
        raw: {
          width: body1x.packedWidth,
          height: body1x.packedHeight,
          channels: sourceInfo.channels,
        },
      }).webp({ quality: 92, smartSubsample: true, effort: 6 })
        .toFile(output1),
      sharp(body2x.data, {
        raw: {
          width: body2x.packedWidth,
          height: body2x.packedHeight,
          channels: source2x.info.channels,
        },
      }).webp({ quality: 90, smartSubsample: true, effort: 6 })
        .toFile(output2),
      preparePoles(buffer, poleOutput),
      sharp(material.output, {
        raw: { width: MATERIAL_SIZE, height: MATERIAL_SIZE, channels: 4 },
      }).webp({ lossless: true, effort: 6 })
        .toFile(materialOutput),
      sharp(shadowlessMaterial.output, {
        raw: { width: MATERIAL_SIZE, height: MATERIAL_SIZE, channels: 4 },
      }).webp({ lossless: true, effort: 6 })
        .toFile(shadowlessMaterialOutput),
      sharp(buffer, { raw: sourceInfo }).extract({
        left: Math.round((SURFACE_WIDTH - 512) / 2),
        top: Math.round((SURFACE_HEIGHT - 512) / 2),
        width: 512,
        height: 512,
      }).resize(48, 48).webp({ quality: 90, effort: 6 }).toFile(thumbOutput),
    ]);
    await optimizePreparedLosslessWebp(materialOutput);
    await optimizePreparedLosslessWebp(shadowlessMaterialOutput);
    const orbitMaterial = await prepareOrbitMaterialRows(id, atmosphereColor);
    controls.push(deepFreeze({
      id,
      label: id === "normal" ? "Normal" : id === "methane" ? "Methane" : "Near infrared",
      shortLabel: id === "normal" ? "RGB" : id === "methane" ? "CH₄" : "NIR",
      filter: id === "normal" ? "F467M/F547M/F657N" : id === "methane" ? "FQ619N" : "F845M",
      wavelength: id === "normal" ? "467/547/657 nm" : id === "methane" ? "619 nm" : "845 nm",
      thumbnailUrl: `/scenes/neptune/neptune-lens-${id}.webp`,
      surfaceUrl: SURFACE_URLS[id],
      surface2xUrl: SURFACE_URLS[id].replace(".webp", "@2x.webp"),
      polesUrl: POLE_URLS[id],
      materialUrl: `/scenes/neptune/neptune-material-${id}.webp`,
      shadowlessMaterialUrl:
        `/scenes/neptune/neptune-material-${id}-shadowless.webp`,
      materialLeaf: material.leaf,
      orbitMaterial,
      preparedMaterial: {
        mode: "transparent-directional-lighting-and-atmospheric-limb-overlay",
        atmosphereColor,
        atmosphereColorSource:
          "brightest source quintile mean chromaticity normalized to 248",
        encoding: "webp-lossless-visible-rgba",
        fullColorSurfaceInMaterial: false,
        ...(id === "normal"
          ? { trueColorCalibration }
          : {}),
      },
      falseColor: id !== "normal",
      qualification: id === "normal" ? "OPAL 2025b visible detail calibrated at prepare time to the Irwin et al. 2024 true-colour reconstruction" : `OPAL ${id === "methane" ? "FQ619N methane-sensitive" : "F845M near-infrared"} single-band data in a declared false-colour palette`,
    }));
  }
  return controls;
}

async function prepareVisibleTrueColorCalibration(source, width, height) {
  const sourceMoments = rgbMoments(
    source,
    width,
    height,
    OPAL_TRUE_COLOR_SAMPLE,
  );
  const { data: reference, info } = await sharp(TRUE_COLOR_REFERENCE_PATH)
    .extract(TRUE_COLOR_REFERENCE_SAMPLE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const targetMoments = rgbMoments(reference, info.width, info.height, {
    left: 0,
    top: 0,
    width: info.width,
    height: info.height,
  });
  const scale = sourceMoments.standardDeviation.map((value, channel) =>
    targetMoments.standardDeviation[channel] / value);
  const offset = sourceMoments.mean.map((value, channel) =>
    targetMoments.mean[channel] - scale[channel] * value);
  return deepFreeze({
    model: "prepared-per-channel-affine-mean-standard-deviation-match",
    sourceSample: OPAL_TRUE_COLOR_SAMPLE,
    targetSample: TRUE_COLOR_REFERENCE_SAMPLE,
    sourceMean: sourceMoments.mean.map((value) => fixed(value, 6)),
    sourceStandardDeviation: sourceMoments.standardDeviation.map((value) =>
      fixed(value, 6)),
    targetMean: targetMoments.mean.map((value) => fixed(value, 6)),
    targetStandardDeviation: targetMoments.standardDeviation.map((value) =>
      fixed(value, 6)),
    scale: scale.map((value) => fixed(value, 9)),
    offset: offset.map((value) => fixed(value, 9)),
    reference: {
      source: "Irwin et al. 2024 true-colour Neptune reconstruction",
      credit: "Patrick Irwin, University of Oxford, and NASA",
      distribution: "Royal Astronomical Society CC BY 4.0",
      sourcePath: "source/color/ras-oxford-neptune-true-colors-2024.jpg",
    },
    runtimeColorProcessing: false,
  });
}

function applyVisibleTrueColorCalibration(source, calibration) {
  const output = Buffer.allocUnsafe(source.length);
  for (let offset = 0; offset < source.length; offset += 3) {
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = Math.round(clamp(
        source[offset + channel] * calibration.scale[channel] +
          calibration.offset[channel],
        0,
        255,
      ));
    }
  }
  return output;
}

function rgbMoments(source, width, height, sample) {
  if (sample.left < 0 || sample.top < 0 ||
      sample.left + sample.width > width ||
      sample.top + sample.height > height) {
    throw new RangeError("Neptune true-colour calibration sample drifted.");
  }
  const sum = [0, 0, 0];
  const squaredSum = [0, 0, 0];
  const count = sample.width * sample.height;
  for (let y = sample.top; y < sample.top + sample.height; y += 1) {
    for (let x = sample.left; x < sample.left + sample.width; x += 1) {
      const sourceOffset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const value = source[sourceOffset + channel];
        sum[channel] += value;
        squaredSum[channel] += value ** 2;
      }
    }
  }
  const mean = sum.map((value) => value / count);
  const standardDeviation = squaredSum.map((value, channel) =>
    Math.sqrt(value / count - mean[channel] ** 2));
  if (standardDeviation.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Neptune true-colour calibration variance drifted.");
  }
  return { mean, standardDeviation };
}

function fillUnobservedVisiblePixels(source, width, height) {
  const output = Buffer.from(source);
  const firstCompleteRow = Math.round(height / 3);
  for (let x = 0; x < width; x += 1) {
    const offset = (firstCompleteRow * width + x) * 3;
    if (source[offset] + source[offset + 1] + source[offset + 2] <= 18) {
      throw new Error("OPAL visible map reconstruction boundary is not fully observed.");
    }
  }
  const mean = [0, 1, 2].map((channel) => {
    let sum = 0;
    for (let x = 0; x < width; x += 1) sum += source[(firstCompleteRow * width + x) * 3 + channel];
    return sum / width;
  });
  for (let y = 0; y < firstCompleteRow; y += 1) {
    const sourceWeight = Math.pow(y / firstCompleteRow, 3);
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (firstCompleteRow * width + x) * 3;
      const targetOffset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        output[targetOffset + channel] = Math.round(
          mean[channel] * (1 - sourceWeight) + source[sourceOffset + channel] * sourceWeight,
        );
      }
    }
  }
  return output;
}

function prepareSourceAtmosphereColor(source) {
  const histogram = new Uint32Array(256);
  const pixelCount = source.length / 3;
  for (let offset = 0; offset < source.length; offset += 3) {
    const luminance = Math.round(
      source[offset] * 0.2126 +
      source[offset + 1] * 0.7152 +
      source[offset + 2] * 0.0722,
    );
    histogram[luminance] += 1;
  }
  const targetCount = Math.ceil(pixelCount * 0.2);
  let included = 0;
  let threshold = 255;
  for (; threshold > 0 && included < targetCount; threshold -= 1) {
    included += histogram[threshold];
  }
  const sums = [0, 0, 0];
  let count = 0;
  for (let offset = 0; offset < source.length; offset += 3) {
    const luminance = Math.round(
      source[offset] * 0.2126 +
      source[offset + 1] * 0.7152 +
      source[offset + 2] * 0.0722,
    );
    if (luminance <= threshold) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      sums[channel] += source[offset + channel];
    }
    count += 1;
  }
  if (count === 0) {
    throw new Error("Neptune source atmosphere color has no bright samples.");
  }
  const mean = sums.map((sum) => sum / count);
  const maximum = Math.max(...mean);
  return mean.map((channel) => Math.round(channel / maximum * 248));
}

async function fitsFalseColour(path, palette) {
  const bytes = await readFile(path);
  const header = fitsHeader(bytes);
  if (header.bitpix !== -32 || header.width !== 721 || header.height !== 361) throw new Error(`Unsupported Neptune FITS geometry: ${path}.`);
  const values = new Float32Array(header.width * header.height);
  const finite = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = bytes.readFloatBE(header.dataOffset + index * 4);
    values[index] = value;
  }
  extrapolateUnobservedNorthPole(values, header.width, header.height);
  for (const value of values) {
    if (Number.isFinite(value) && value > 0) finite.push(value);
  }
  finite.sort((left, right) => left - right);
  const low = finite[Math.floor(finite.length * 0.01)];
  const high = finite[Math.floor(finite.length * 0.995)];
  const rgb = Buffer.alloc(header.width * header.height * 3);
  for (let index = 0; index < values.length; index += 1) {
    const normalized = Number.isFinite(values[index]) ? clamp((values[index] - low) / (high - low), 0, 1) : 0;
    const colour = paletteColour(palette, Math.pow(normalized, 0.72));
    rgb[index * 3] = colour[0]; rgb[index * 3 + 1] = colour[1]; rgb[index * 3 + 2] = colour[2];
  }
  return sharp(rgb, { raw: { width: header.width, height: header.height, channels: 3 } }).flip().extract({ left: 0, top: 0, width: 720, height: 360 }).resize(SURFACE_WIDTH, SURFACE_HEIGHT, { kernel: sharp.kernel.lanczos3 }).sharpen({ sigma: 0.55 }).raw().toBuffer();
}

function extrapolateUnobservedNorthPole(values, width, height) {
  const boundary = Math.round(height / 3);
  let mean = 0;
  for (let x = 0; x < width; x += 1) {
    const value = values[boundary * width + x];
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("OPAL FITS reconstruction boundary is not fully observed.");
    }
    mean += value;
  }
  mean /= width;
  for (let y = 0; y < boundary; y += 1) {
    const sourceWeight = Math.pow(y / boundary, 3);
    for (let x = 0; x < width; x += 1) {
      const boundaryValue = values[boundary * width + x];
      values[y * width + x] = mean * (1 - sourceWeight) + boundaryValue * sourceWeight;
    }
  }
}

function fitsHeader(bytes) {
  const values = {}; let end = -1;
  for (let offset = 0; offset < bytes.length; offset += 80) {
    const card = bytes.toString("ascii", offset, offset + 80);
    const key = card.slice(0, 8).trim();
    if (key === "END") { end = offset + 80; break; }
    if (card[8] !== "=") continue;
    values[key] = Number(card.slice(10).split("/")[0].trim());
  }
  if (end < 0) throw new Error("FITS header is missing END.");
  return { bitpix: values.BITPIX, width: values.NAXIS1, height: values.NAXIS2, dataOffset: Math.ceil(end / 2880) * 2880 };
}

async function preparePoles(source, output) {
  const atlas = Buffer.alloc(POLAR_TILE * 4 * POLAR_TILE * 4);
  for (const [tileIndex, pole] of ["north", "south", "north", "south"].entries()) {
    for (let row = 0; row < POLAR_TILE; row += 1) {
      for (let column = 0; column < POLAR_TILE; column += 1) {
        const x = ((column + 0.5) / POLAR_TILE * 2 - 1);
        const y = ((row + 0.5) / POLAR_TILE * 2 - 1);
        const radial = Math.hypot(x, y);
        if (radial > 1) continue;
        const latitude = pole === "north"
          ? Math.PI / 2 - radial * Math.PI / LATITUDES
          : -Math.PI / 2 + radial * Math.PI / LATITUDES;
        const longitude = Math.atan2(y, x);
        const colour = sampleEquirectangular(source, latitude, longitude);
        const target = (row * POLAR_TILE * 4 + tileIndex * POLAR_TILE + column) * 4;
        atlas[target] = colour[0];
        atlas[target + 1] = colour[1];
        atlas[target + 2] = colour[2];
        atlas[target + 3] = 255;
      }
    }
  }
  await sharp(atlas, {
    raw: { width: POLAR_TILE * 4, height: POLAR_TILE, channels: 4 },
  }).webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(output);
}

function prepareFixedMaterialPlane(id, {
  scenePitchDegrees = CAMERA_INITIAL_SCENE_PITCH,
  systemObliquityDegrees = SYSTEM_OBLIQUITY_DEGREES,
  outputSize = MATERIAL_SIZE,
  textureUrl = `/scenes/neptune/neptune-material-${id}.webp`,
  atmosphereColor,
  shadowless = false,
} = {}) {
  if (!Array.isArray(atmosphereColor) || atmosphereColor.length !== 3 ||
      atmosphereColor.some((channel) =>
        !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new TypeError("Neptune prepared atmosphere color is required.");
  }
  const screenToObject = (vector) => rotateVectorZ(
    rotateVectorX(
      rotateVectorZ(
        rotateVectorY(vector, scenePitchDegrees * Math.PI / 180),
        -PRESENTATION_NODE_DEGREES * Math.PI / 180,
      ),
      -systemObliquityDegrees * Math.PI / 180,
    ),
    -MESH_ROTATION_DEGREES * Math.PI / 180,
  );
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const objectLight = shadowless
    ? view
    : prepareObjectLightDirection(systemObliquityDegrees);
  const projectedRadius = (direction) => Math.sqrt(
    EQUATORIAL_RADIUS ** 2 * (direction[0] ** 2 + direction[1] ** 2) +
      POLAR_RADIUS ** 2 * direction[2] ** 2,
  );
  const radiusX = projectedRadius(right);
  const radiusY = projectedRadius(down);
  const frontDepth = projectedRadius(view);
  const scaledRadiusX = radiusX * MATERIAL_COVERAGE_SCALE;
  const scaledRadiusY = radiusY * MATERIAL_COVERAGE_SCALE;
  const output = Buffer.alloc(outputSize * outputSize * 4);
  for (let row = 0; row < outputSize; row += 1) {
    const screenY = ((row + 0.5) / outputSize * 2 - 1) * radiusY;
    for (let column = 0; column < outputSize; column += 1) {
      const screenX = ((column + 0.5) / outputSize * 2 - 1) * radiusX;
      const coverageOrigin = addVectors(
        scaleVector(right, screenX),
        scaleVector(down, screenY),
      );
      const coverageHit = intersectViewRayWithNeptune(coverageOrigin, view);
      if (!coverageHit) continue;
      const materialScale = MATERIAL_COVERAGE_SCALE / MATERIAL_CONTENT_SCALE;
      const materialOrigin = addVectors(
        scaleVector(right, screenX * materialScale),
        scaleVector(down, screenY * materialScale),
      );
      const hit = intersectViewRayWithNeptune(materialOrigin, view) ?? coverageHit;
      const lambert = Math.max(0, dotVector(hit.normal, objectLight));
      const [edge0, edge1] = MATERIAL_TERMINATOR_SMOOTHSTEP;
      const amount = clamp((lambert - edge0) / (edge1 - edge0), 0, 1);
      const terminator = amount * amount * (3 - 2 * amount);
      const diffuse = lambert * terminator;
      const light = MATERIAL_AMBIENT_FRACTION +
        (1 - MATERIAL_AMBIENT_FRACTION) * diffuse;
      const lightingAlpha = 1 - light;
      const viewAlignment = Math.max(0, dotVector(hit.normal, view));
      const limb = Math.pow(
        1 - viewAlignment,
        MATERIAL_ATMOSPHERE_LIMB_EXPONENT,
      );
      const sunwardAmount = MATERIAL_ATMOSPHERE_NIGHT_FLOOR +
        (1 - MATERIAL_ATMOSPHERE_NIGHT_FLOOR) * Math.sqrt(lambert);
      const atmosphereAlpha = clamp(
        limb * MATERIAL_ATMOSPHERE_MAXIMUM_ALPHA * sunwardAmount,
        0,
        MATERIAL_ATMOSPHERE_MAXIMUM_ALPHA,
      );
      const alpha = 1 - (1 - atmosphereAlpha) * (1 - lightingAlpha);
      const target = (row * outputSize + column) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        output[target + channel] = alpha > 0
          ? Math.round(
            atmosphereColor[channel] * atmosphereAlpha / alpha,
          )
          : 0;
      }
      output[target + 3] = Math.round(alpha * 255);
    }
  }
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
    scaleVector(view, frontDepth + MATERIAL_DEPTH_BIAS),
  ));
  const matrix = [...basisX, 0, ...basisY, 0, ...basisZ, 0, ...origin, 1]
    .map((value) => Number(value.toFixed(12)));
  return {
    output,
    leaf: {
      tag: "s",
      style: `transform:matrix3d(${matrix.join(",")})` +
        `;--polycss-atlas-width:${outputSize}px` +
        `;--polycss-atlas-height:${outputSize}px` +
        `;background-image:url(${textureUrl})` +
        `;background-size:${outputSize}px ${outputSize}px` +
        ";backface-visibility:visible",
    },
  };
}

async function prepareOrbitMaterialRows(id, atmosphereColor) {
  const presentationScale = MATERIAL_SIZE / ORBIT_MATERIAL_SIZE;
  const rows = [];
  const presentations = new Array(ORBIT_MATERIAL_FRAME_COUNT);
  for (let rowIndex = 0; rowIndex < ORBIT_MATERIAL_ROWS; rowIndex += 1) {
    const row = Buffer.alloc(
      ORBIT_MATERIAL_ROW_WIDTH * ORBIT_MATERIAL_ROW_HEIGHT * 4,
    );
    for (let column = 0; column < ORBIT_MATERIAL_COLUMNS; column += 1) {
      const frameIndex = rowIndex * ORBIT_MATERIAL_COLUMNS + column;
      const amount = frameIndex / (ORBIT_MATERIAL_FRAME_COUNT - 1);
      const scenePitchDegrees = CAMERA_MAX_SCENE_PITCH * (1 - amount);
      const systemObliquityDegrees = SYSTEM_OBLIQUITY_DEGREES *
        scenePitchDegrees / CAMERA_INITIAL_SCENE_PITCH;
      const frame = prepareFixedMaterialPlane(id, {
        scenePitchDegrees,
        systemObliquityDegrees,
        outputSize: ORBIT_MATERIAL_SIZE,
        textureUrl: `/scenes/neptune/neptune-orbit-material-${id}-row-${String(rowIndex).padStart(2, "0")}.webp`,
        atmosphereColor,
      });
      const frameX = column * ORBIT_MATERIAL_STRIDE +
        ORBIT_MATERIAL_GUTTER;
      writeMaterialAtlasTile({
        output: row,
        outputWidth: ORBIT_MATERIAL_ROW_WIDTH,
        source: frame.output,
        sourceSize: ORBIT_MATERIAL_SIZE,
        frameX,
        frameY: ORBIT_MATERIAL_GUTTER,
        gutter: ORBIT_MATERIAL_GUTTER,
      });
      presentations[frameIndex] = deepFreeze({
        frameIndex,
        rowIndex,
        assetUrl: `/scenes/neptune/neptune-orbit-material-${id}-row-${String(rowIndex).padStart(2, "0")}.webp`,
        backgroundPosition:
          `${-frameX * presentationScale}px ` +
          `${-ORBIT_MATERIAL_GUTTER * presentationScale}px`,
        backgroundSize:
          `${ORBIT_MATERIAL_ROW_WIDTH * presentationScale}px ` +
          `${ORBIT_MATERIAL_ROW_HEIGHT * presentationScale}px`,
      });
    }
    const assetUrl = `/scenes/neptune/neptune-orbit-material-${id}-row-${String(rowIndex).padStart(2, "0")}.webp`;
    await sharp(row, {
      raw: {
        width: ORBIT_MATERIAL_ROW_WIDTH,
        height: ORBIT_MATERIAL_ROW_HEIGHT,
        channels: 4,
      },
    }).webp({ lossless: true, effort: 6 })
      .toFile(resolve(publicRoot, assetUrl.split("/").at(-1)));
    await optimizePreparedQ75Webp(
      resolve(publicRoot, assetUrl.split("/").at(-1)),
    );
    rows.push(deepFreeze({ rowIndex, assetUrl }));
  }
  return deepFreeze({
    schema: "cssneptune-prepared-orbit-material@1",
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees: CAMERA_MAX_SCENE_PITCH,
    frameCount: ORBIT_MATERIAL_FRAME_COUNT,
    frameColumns: ORBIT_MATERIAL_COLUMNS,
    frameRows: ORBIT_MATERIAL_ROWS,
    frameSize: ORBIT_MATERIAL_SIZE,
    gutter: ORBIT_MATERIAL_GUTTER,
    rows,
    presentations,
    encoding: PREPARED_Q75_WEBP_ENCODING,
    runtimeRasterization: false,
  });
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
  const firstRowStart = (frameY * outputWidth + frameX - gutter) * 4;
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

function intersectViewRayWithNeptune(origin, direction) {
  const inverseEquatorialSquared = 1 / EQUATORIAL_RADIUS ** 2;
  const inversePolarSquared = 1 / POLAR_RADIUS ** 2;
  const quadratic = (vectorA, vectorB) =>
    (vectorA[0] * vectorB[0] + vectorA[1] * vectorB[1]) *
      inverseEquatorialSquared + vectorA[2] * vectorB[2] * inversePolarSquared;
  const a = quadratic(direction, direction);
  const b = 2 * quadratic(origin, direction);
  const c = quadratic(origin, origin) - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const distance = (-b + Math.sqrt(discriminant)) / (2 * a);
  const position = addVectors(origin, scaleVector(direction, distance));
  const normal = normalizeVector([
    position[0] * inverseEquatorialSquared,
    position[1] * inverseEquatorialSquared,
    position[2] * inversePolarSquared,
  ]);
  return { position, normal };
}

function sampleEquirectangular(source, latitude, longitude) {
  const u = ((longitude / (Math.PI * 2)) % 1 + 1) % 1;
  const v = clamp((Math.PI / 2 - latitude) / Math.PI, 0, 1);
  const x = u * SURFACE_WIDTH;
  const y = v * (SURFACE_HEIGHT - 1);
  const x0 = Math.floor(x) % SURFACE_WIDTH;
  const x1 = (x0 + 1) % SURFACE_WIDTH;
  const y0 = Math.floor(y);
  const y1 = Math.min(SURFACE_HEIGHT - 1, y0 + 1);
  const tx = x - Math.floor(x);
  const ty = y - y0;
  return [0, 1, 2].map((channel) => {
    const top = mix(
      source[(y0 * SURFACE_WIDTH + x0) * 3 + channel],
      source[(y0 * SURFACE_WIDTH + x1) * 3 + channel],
      tx,
    );
    const bottom = mix(
      source[(y1 * SURFACE_WIDTH + x0) * 3 + channel],
      source[(y1 * SURFACE_WIDTH + x1) * 3 + channel],
      tx,
    );
    return Math.round(mix(top, bottom, ty));
  });
}

async function prepareStarfield() {
  const data = JSON.parse(await readFile(resolve(sourceRoot, "stars/hyg-v41-field.json"), "utf8"));
  const width = data.presentation.width;
  const height = data.presentation.height;
  const pixels = Buffer.alloc(width * height * 4);
  for (const star of data.stars) {
    const x = Math.round(star.x * (width - 1));
    const y = Math.round(star.y * (height - 1));
    const radius = star.magnitude < 1.5 ? 2 : star.magnitude < 3.5 ? 1 : 0;
    const colour = starColour(star.colorIndex);
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius + 0.3) continue;
      const px = x + dx; const py = y + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const offset = (py * width + px) * 4;
      const fade = radius === 0 ? 0.58 : dx === 0 && dy === 0 ? 0.92 : 0.38;
      pixels[offset] = colour[0]; pixels[offset + 1] = colour[1]; pixels[offset + 2] = colour[2]; pixels[offset + 3] = Math.round(255 * fade);
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(resolve(publicRoot, "neptune-starfield.webp"));
}

async function prepareRings() {
  for (const density of [1, 2]) {
    const size = 1024 * density;
    const pixels = Buffer.alloc(size * size * 4);
    const center = (size - 1) / 2;
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const dx = x - center; const dy = y - center;
      const radiusKm = Math.hypot(dx, dy) / center * OUTER_RING_RADIUS_KM;
      const angle = Math.atan2(dy, dx);
      let alpha = 0;
      if (radiusKm >= 41_000 && radiusKm <= 43_000) alpha = 8;
      if (radiusKm >= 53_150 && radiusKm <= 53_250) alpha = 48;
      if (radiusKm >= 53_200 && radiusKm <= 57_200) alpha = Math.max(alpha, 10);
      if (Math.abs(radiusKm - 57_200) < 90) alpha = Math.max(alpha, 32);
      if (Math.abs(radiusKm - 61_953) < 90) alpha = Math.max(alpha, 20);
      if (Math.abs(radiusKm - 62_900) < 75) alpha = Math.max(alpha, 82);
      const arc = Math.max(...[-2.6, -2.25, -1.85, -1.45].map((centerAngle) => angularDistance(angle, centerAngle) < 0.13 ? 1 : 0));
      if (arc && Math.abs(radiusKm - 62_900) < 115) alpha = 165;
      if (alpha === 0) continue;
      const offset = (y * size + x) * 4;
      pixels[offset] = 144; pixels[offset + 1] = 174; pixels[offset + 2] = 207; pixels[offset + 3] = alpha;
    }
    await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(resolve(publicRoot, `neptune-rings${density === 2 ? "@2x" : ""}.webp`));
  }
}

function prepareBodyBands() {
  const topology = createBodyPolygons(0).filter(({ polarCap }) => !polarCap);
  const seamEdges = buildSeamBleedPolygonEdges(topology, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
  });
  const prepared = [];
  for (const pole of ["south", "north"]) {
    for (const role of ["inner", "surface"]) {
      const polygon = createPolarCap(pole, role);
      prepared.push({
        latitudeIndex: polygon.latitudeIndex,
        leaf: prepareTextureLeaf(polygon, prepared.length, null, 0),
      });
    }
  }
  const polygons = createBodyPolygons(SURFACE_OVERLAP)
    .filter(({ polarCap }) => !polarCap);
  for (const [index, polygon] of polygons.entries()) {
    prepared.push({
      latitudeIndex: polygon.latitudeIndex,
      leaf: {
        ...prepareTextureLeaf(
          polygon,
          index,
          seamEdges.get(index),
          SURFACE_SEAM_BLEED,
        ),
        className: "neptune-surface-face",
      },
    });
  }
  return Array.from({ length: LATITUDES }, (_, latitudeIndex) => ({ latitudeIndex, leaves: prepared.filter((entry) => entry.latitudeIndex === latitudeIndex).map((entry) => entry.leaf) }));
}

function createBodyPolygons(overlap) {
  const polygons = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDES; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDES - 1) { polygons.push(createPolarCap(latitudeIndex === 0 ? "south" : "north")); continue; }
    const v0 = latitudeIndex / LATITUDES;
    const v1 = (latitudeIndex + 1) / LATITUDES;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDES; longitudeIndex += 1) {
      const u0 = longitudeIndex / LONGITUDES;
      const u1 = u0 + 1 / LONGITUDES;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = overlap === 0 && longitudeIndex === LONGITUDES - 1
        ? 0
        : (longitudeIndex + 1) / LONGITUDES * Math.PI * 2;
      const latitudeOverlap = Math.PI / LATITUDES * overlap;
      const longitudeOverlap = Math.PI * 2 / LONGITUDES * overlap;
      const surfaceLatitude0 = Math.max(-Math.PI / 2, latitude0 - latitudeOverlap);
      const surfaceLatitude1 = Math.min(Math.PI / 2, latitude1 + latitudeOverlap);
      polygons.push({
        latitudeIndex, longitudeIndex,
        vertices: [spherePoint(surfaceLatitude0, longitude0 - longitudeOverlap), spherePoint(surfaceLatitude0, longitude1 + longitudeOverlap), spherePoint(surfaceLatitude1, longitude1 + longitudeOverlap), spherePoint(surfaceLatitude1, longitude0 - longitudeOverlap)],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: SURFACE_URLS.normal,
        textureImageSource: {
          url: SURFACE_URLS.normal,
          width: SURFACE_WIDTH,
          height: SURFACE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * SURFACE_SOURCE_CELL_WIDTH,
            y: (LATITUDES - 1 - latitudeIndex) *
              SURFACE_SOURCE_CELL_HEIGHT,
            width: SURFACE_SOURCE_CELL_WIDTH,
            height: SURFACE_SOURCE_CELL_HEIGHT,
          },
        },
        texturePresentation: { backend: "image", lighting: "source", projection: "projective" },
        color: "#4777b8",
      });
    }
  }
  return polygons;
}

function createPolarCap(pole, role = "surface") {
  const north = pole === "north"; const sign = north ? 1 : -1;
  const inner = role === "inner";
  const radius = POLAR_BOUNDARY_RADIUS * (inner ? POLAR_INNER_OVERLAP : POLAR_SURFACE_OVERLAP);
  const z = sign * (POLAR_BOUNDARY_Z + 0.1 - (inner ? POLAR_INNER_INSET : 0));
  const tileIndex = inner ? (north ? 2 : 3) : (north ? 0 : 1);
  return {
    latitudeIndex: north ? LATITUDES - 1 : 0,
    vertices: north ? [[-radius, -radius, z], [radius, -radius, z], [radius, radius, z], [-radius, radius, z]] : [[-radius, radius, z], [radius, radius, z], [radius, -radius, z], [-radius, -radius, z]],
    uvs: north ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: POLE_URLS.normal,
    textureImageSource: { url: POLE_URLS.normal, width: POLAR_TILE * 4, height: POLAR_TILE, sourceRect: { x: tileIndex * POLAR_TILE, y: 0, width: POLAR_TILE, height: POLAR_TILE } },
    texturePresentation: { backend: "image", lighting: "source", projection: "projective" },
    color: "#4777b8", polarCap: pole, polarRole: role,
  };
}

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [EQUATORIAL_RADIUS * latitudeRadius * Math.cos(longitude), EQUATORIAL_RADIUS * latitudeRadius * Math.sin(longitude), POLAR_RADIUS * Math.sin(latitude)];
}

function prepareRingLeaf() {
  const radius = OUTER_RING_RADIUS;
  const polygon = { vertices: [[-radius, -radius, 0], [radius, -radius, 0], [radius, radius, 0], [-radius, radius, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: "/scenes/neptune/neptune-rings.webp", textureImageSource: { url: "/scenes/neptune/neptune-rings.webp", width: 1024, height: 1024, sourceRect: { x: 0, y: 0, width: 1024, height: 1024 } }, texturePresentation: { backend: "image", lighting: "source", projection: "projective" }, color: "#8caeca", doubleSided: true };
  const leaf = prepareTextureLeaf(polygon, 0, null, 0, { fitSurface: false });
  leaf.style += ";backface-visibility:visible";
  return leaf;
}

function prepareTextureLeaf(
  polygon,
  index,
  seamEdges,
  seamBleed,
  { fitSurface = !polygon.polarCap } = {},
) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, { ...PLAN_OPTIONS, seamBleed, ...(seamEdges ? { seamEdges } : {}) });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: "image", lighting: "source", projection: "projective" });
  if (!geometry) throw new Error(`Neptune texture leaf ${index} did not prepare.`);
  const sourceFittedGeometry = fitSurface
    ? fitTextureGeometry(
      geometry,
      SURFACE_RASTER_CELL_SIZE,
      SURFACE_RASTER_CELL_SIZE,
    )
    : geometry;
  const fittedGeometry = fitSurface
    ? fitProjectiveTextureGeometryToStableLayout(sourceFittedGeometry)
    : sourceFittedGeometry;
  const rasterPresentation = fitSurface && polygon.texture ===
      SURFACE_URLS.normal
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: SURFACE_WIDTH,
      sourceHeight: SURFACE_HEIGHT,
      sourceRect: polygon.textureImageSource.sourceRect,
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fittedGeometry.backgroundPosition,
      backgroundSize: fittedGeometry.backgroundSize,
      leafWidth: fittedGeometry.leafWidth,
      leafHeight: fittedGeometry.leafHeight,
      bandCount: LATITUDES,
      gutter: SURFACE_RASTER_GUTTER,
      overscan: SURFACE_RASTER_OVERSCAN,
    })
    : fittedGeometry;
  const position = `${formatCssLength(rasterPresentation.backgroundPosition[0])} ${formatCssLength(rasterPresentation.backgroundPosition[1])}`;
  const size = `${formatCssLength(rasterPresentation.backgroundSize[0])} ${formatCssLength(rasterPresentation.backgroundSize[1])}`;
  return {
    tag: "s",
    ...(polygon.polarCap ? { className: `neptune-polar-${polygon.polarRole === "inner" ? "inner" : "surface"} neptune-polar-${polygon.polarCap}` } : {}),
    style: `transform:matrix3d(${fittedGeometry.matrix})` +
      (fittedGeometry.leafWidth === 64 ? "" :
        `;--polycss-atlas-width:${formatCssLength(fittedGeometry.leafWidth)}`) +
      (fittedGeometry.leafHeight === 64 ? "" :
        `;--polycss-atlas-height:${formatCssLength(fittedGeometry.leafHeight)}`) +
      (polygon.polarCap ? `;background-image:url(${fittedGeometry.url})` : "") +
      `;background-position:${position}` +
      `;background-size:${size}`,
    ...(fitSurface ? {
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fittedGeometry.matrix,
        PROJECTIVE_TEXTURE_RASTER_SCALE,
      ),
    } : {}),
  };
}

function fitTextureGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Prepared Neptune texture matrix is invalid.");
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

async function prepareMoons() {
  const [elementsHtml, physicalHtml, discoveryHtml] = await Promise.all([
    readFile(resolve(sourceRoot, "jpl/elements.html"), "utf8"),
    readFile(resolve(sourceRoot, "jpl/physical.html"), "utf8"),
    readFile(resolve(sourceRoot, "jpl/discovery.html"), "utf8"),
  ]);
  const section = elementsHtml.slice(elementsHtml.indexOf("Satellites of Neptune"), elementsHtml.indexOf("Satellites of Pluto"));
  const tables = htmlTables(section).slice(0, 3);
  const elementRows = tables.flat();
  if (elementRows.length !== 16) throw new Error(`JPL Neptune mean-elements table contains ${elementRows.length} rows.`);
  const physicalRows = htmlTables(physicalHtml.slice(physicalHtml.indexOf("Satellites of Neptune")))[0];
  const radii = new Map(physicalRows.map((row) => [row[0], Number(row[2].match(/[\d.]+/u)?.[0])]));
  const discoverySection = discoveryHtml.slice(
    discoveryHtml.indexOf("Satellites of  Neptune:"),
    discoveryHtml.indexOf("Satellites of Dwarf Planet Pluto:"),
  );
  const discoveries = [...discoverySection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((cell) => htmlText(cell[1])))
    .filter((row) => row.length === 6)
    .map((row) => [row[1] || normalizeMoonName(row[2]), ...row.slice(2)]);
  if (discoveries.length !== 16) throw new Error(`JPL Neptune discovery table contains ${discoveries.length} rows.`);
  const discoveryNames = new Set(discoveries.map((row) => normalizeMoonName(row[0])));
  const raw = elementRows.map((row) => ({
    name: normalizeMoonName(row[0]),
    code: row[1],
    semimajorAxisKm: Number(row[2]),
    eccentricity: Number(row[3]),
    periapsisDegrees: Number(row[4]),
    meanAnomalyDegrees: Number(row[5]),
    inclinationDegrees: Number(row[6]),
    nodeDegrees: Number(row[7]),
    periodDays: Math.abs(Number(row[8])),
    radiusKm: radii.get(normalizeMoonName(row[0])) ?? null,
  }));
  const unreconciled = raw.filter(({ name, semimajorAxisKm, periodDays,
    meanAnomalyDegrees, inclinationDegrees, nodeDegrees }) =>
    !discoveryNames.has(name) || !Number.isFinite(semimajorAxisKm) ||
    !Number.isFinite(periodDays) || !Number.isFinite(meanAnomalyDegrees) ||
    !Number.isFinite(inclinationDegrees) || !Number.isFinite(nodeDegrees));
  if (unreconciled.length > 0) {
    throw new Error(`JPL Neptune moon tables no longer reconcile: ${JSON.stringify(unreconciled)}.`);
  }
  const minimum = Math.min(...raw.map(({ semimajorAxisKm }) => semimajorAxisKm));
  const maximum = Math.max(...raw.map(({ semimajorAxisKm }) => semimajorAxisKm));
  return raw.map((moon, index) => {
    const normalized = Math.log(moon.semimajorAxisKm / minimum) / Math.log(maximum / minimum);
    const radius = 330 + normalized * 560;
    const group = new Set(["Triton", "Nereid", "Naiad", "Thalassa", "Despina", "Galatea", "Larissa", "Proteus"]).has(moon.name) ? "major" : "minor";
    const visualSize = moon.radiusKm ? clamp(3 + Math.sqrt(moon.radiusKm) * 0.32, 4, 16) : 3;
    const duration = clamp(28 + Math.log10(moon.periodDays + 1) * 24, 32, 170);
    const displayOrbitRadius = fixed(radius, 3);
    const phaseDegrees = fixed(moon.meanAnomalyDegrees, 3);
    const visualDurationSeconds = fixed(duration, 3);
    const retrograde = moon.inclinationDegrees > 90;
    const animationDelaySeconds = fixed(
      -(phaseDegrees / 360) * visualDurationSeconds,
      6,
    );
    return deepFreeze({
      ...moon,
      id: moon.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-"),
      group,
      displayOrbitRadius,
      visualSize: fixed(visualSize, 2),
      phaseDegrees,
      visualDurationSeconds,
      retrograde,
      label: new Set(["Triton", "Nereid", "Proteus", "Hippocamp"]).has(moon.name),
      orbitStyle:
        `transform:rotateY(${-moon.inclinationDegrees}deg) ` +
        `rotateZ(${-moon.nodeDegrees}deg);` +
        `animation-duration:${visualDurationSeconds}s;` +
        `animation-delay:${animationDelaySeconds}s`,
      bodyStyle:
        `transform:translate3d(0px,` +
        `${fixed(displayOrbitRadius * 50, 3)}px,0px)`,
      presentationStyle:
        `--neptune-moon-orbit-inclination:${moon.inclinationDegrees}deg;` +
        `--neptune-moon-orbit-node:${moon.nodeDegrees}deg;` +
        `--neptune-camera-pitch:${CAMERA_INITIAL_SCENE_PITCH}deg;` +
        `--neptune-system-tilt:${-SYSTEM_OBLIQUITY_DEGREES}deg;` +
        `--neptune-moon-presentation-scale:${fixed(
          1 / (0.02 * CAMERA_INITIAL_ZOOM),
          6,
        )};` +
        `animation-duration:${visualDurationSeconds}s;` +
        `animation-delay:${animationDelaySeconds}s`,
      dotStyle:
        `width:${MOON_ATLAS_CELL_SIZE}px;` +
        `height:${MOON_ATLAS_CELL_SIZE}px;` +
        `background-position:${-index * MOON_ATLAS_CELL_SIZE}px 0;` +
        `background-size:${MOON_ATLAS_CELL_SIZE * raw.length}px ` +
        `${MOON_ATLAS_CELL_SIZE}px`,
    });
  });
}

async function prepareMoonAtlas(moons) {
  for (const density of [1, 2]) {
    const cellSize = MOON_ATLAS_CELL_SIZE * density;
    const width = cellSize * moons.length;
    const pixels = Buffer.alloc(width * cellSize * 4);
    for (let frame = 0; frame < moons.length; frame += 1) {
      const radius = moons[frame].visualSize / 2;
      const center = MOON_ATLAS_CELL_SIZE / 2;
      for (let y = 0; y < cellSize; y += 1) {
        for (let x = 0; x < cellSize; x += 1) {
          const logicalX = (x + 0.5) / density - center;
          const logicalY = (y + 0.5) / density - center;
          const distance = Math.hypot(logicalX, logicalY);
          const offset = (y * width + frame * cellSize + x) * 4;
          if (distance <= radius) {
            const edge = clamp((distance - radius + 0.75) / 0.75, 0, 1);
            const directional = clamp(
              (logicalX + logicalY + radius * 0.25) / (radius * 1.75),
              0,
              1,
            );
            const shadow = 0.72 * directional * (0.4 + edge * 0.6);
            for (let channel = 0; channel < 3; channel += 1) {
              pixels[offset + channel] = Math.round(mix(
                MOON_BASE_COLOR[channel],
                MOON_SHADOW_COLOR[channel],
                shadow,
              ));
            }
            pixels[offset + 3] = 255;
            continue;
          }
          const glowDistance = distance - radius;
          if (glowDistance >= MOON_GLOW_RADIUS) continue;
          pixels[offset] = MOON_GLOW_COLOR[0];
          pixels[offset + 1] = MOON_GLOW_COLOR[1];
          pixels[offset + 2] = MOON_GLOW_COLOR[2];
          pixels[offset + 3] = Math.round(
            255 * 0.38 * (1 - glowDistance / MOON_GLOW_RADIUS) ** 2,
          );
        }
      }
    }
    const output = resolve(
      publicRoot,
      `neptune-moon-dots${density === 2 ? "@2x" : ""}.webp`,
    );
    await sharp(pixels, {
      raw: { width, height: cellSize, channels: 4 },
    }).webp({ lossless: true, effort: 6 }).toFile(output);
    await optimizePreparedLosslessWebp(output);
  }
}

function htmlTables(html) {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gu)].map((table) => [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)].map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((cell) => htmlText(cell[1]))).filter((row) => row.length));
}
function htmlText(value) { return value.replace(/<[^>]*>/gu, " ").replaceAll("&nbsp;", " ").replaceAll("&minus;", "-").replace(/&[^;]+;/gu, " ").replace(/\s+/gu, " ").trim(); }
function normalizeMoonName(value) {
  if (new Set(["S2002_N5", "S/2002 N5"]).has(value)) return "S/2002 N 5";
  if (new Set(["S2021_N1", "S/2021 N1"]).has(value)) return "S/2021 N 1";
  return value;
}
function paletteColour(palette, value) { const segment = value < 0.5 ? 0 : 1; const amount = value < 0.5 ? value * 2 : (value - 0.5) * 2; return palette[segment].map((channel, index) => Math.round(channel + (palette[segment + 1][index] - channel) * amount)); }
function starColour(index) { if (!Number.isFinite(index)) return [225, 232, 245]; if (index < 0) return [179, 207, 255]; if (index > 1.2) return [255, 207, 153]; return [235, 238, 243]; }
function angularDistance(left, right) { const delta = Math.abs(left - right) % (Math.PI * 2); return Math.min(delta, Math.PI * 2 - delta); }
function scaleVector(vector, scale) { return vector.map((value) => value * scale); }
function addVectors(...vectors) { return [0, 1, 2].map((axis) => vectors.reduce((sum, vector) => sum + vector[axis], 0)); }
function dotVector(left, right) { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
function normalizeVector(vector) { const length = Math.hypot(...vector) || 1; return vector.map((value) => value / length); }
function prepareObjectLightDirection(systemObliquityDegrees) {
  let direction = normalizeVector(PLAN_OPTIONS.directionalLight.direction);
  direction = rotateVectorZ(
    direction,
    -PRESENTATION_NODE_DEGREES * Math.PI / 180,
  );
  direction = rotateVectorX(
    direction,
    -systemObliquityDegrees * Math.PI / 180,
  );
  direction = rotateVectorZ(
    direction,
    -MESH_ROTATION_DEGREES * Math.PI / 180,
  );
  return normalizeVector(direction);
}
function rotateVectorX([x, y, z], angle) { const cosine = Math.cos(angle); const sine = Math.sin(angle); return [x, y * cosine - z * sine, y * sine + z * cosine]; }
function rotateVectorY([x, y, z], angle) { const cosine = Math.cos(angle); const sine = Math.sin(angle); return [x * cosine + z * sine, y, -x * sine + z * cosine]; }
function rotateVectorZ([x, y, z], angle) { const cosine = Math.cos(angle); const sine = Math.sin(angle); return [x * cosine - y * sine, x * sine + y * cosine, z]; }
function mix(start, end, amount) { return start + (end - start) * amount; }
function radians(degrees) { return degrees * Math.PI / 180; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function fixed(value, digits) { return Number(value.toFixed(digits)); }
function deepFreeze(value) { for (const child of Object.values(value)) if (child && typeof child === "object") deepFreeze(child); return Object.freeze(value); }

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  buildPolyCameraSceneTransform,
  buildPolyMeshTransform,
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  createPolyCamera,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
} from "@layoutit/polycss";

import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  packProjectiveSurfaceRaster,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import { validateUranusSourceGroup } from "./source-manifest.mjs";
import {
  ensureUranusPreparationDirectories,
  URANUS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";
import { createRuntimeScenePlan } from "./runtime-scene-plan.mjs";

const LATITUDE_SEGMENTS = 24;
const LONGITUDE_SEGMENTS = 48;
const SURFACE_ATLAS_WIDTH = 1920;
const SURFACE_ATLAS_HEIGHT = 960;
const SURFACE_LEAF_SIZE = 64;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 2.5;
const POLAR_TILE_SIZE = 128;
const EQUATORIAL_RADIUS = 230;
const POLAR_RADIUS = EQUATORIAL_RADIUS * 24_973 / 25_559;
const RING_SIZE = 1200;
const MOON_TILE = 96;
const URANUS_RADIUS_KM = 25_559;
const RING_OUTER_KM = 106_200;
const RING_OUTER_RADIUS = EQUATORIAL_RADIUS * RING_OUTER_KM / URANUS_RADIUS_KM;
const BODY_ROTATION_SECONDS = 72;
const DEFAULT_CONTROL_PITCH = 34.230769230769226;
const MAXIMUM_SCENE_PITCH = 65;
const CAMERA_ZOOM = 1.1;
const AXIAL_TILT_DEGREES = -82.23;
const PRESENTATION_NODE_DEGREES = -14;
const MESH_ROTATION_DEGREES = 176;
const SURFACE_OVERLAP = 0.05;
const SURFACE_CELL_WIDTH = SURFACE_ATLAS_WIDTH / LONGITUDE_SEGMENTS;
const SURFACE_CELL_HEIGHT = SURFACE_ATLAS_HEIGHT / LATITUDE_SEGMENTS;
const SURFACE_RASTER_GUTTER = SURFACE_CELL_HEIGHT / 4;
const SURFACE_RASTER_OVERSCAN = 0;
const PLANET_SEAM_BLEED = 0;
const MATERIAL_FRAME_SIZE = 256;
const MATERIAL_FRAME_COUNT = 256;
const MATERIAL_ROW_COLUMNS = 16;
const MATERIAL_FRAME_GUTTER = 2;
const MATERIAL_FRAME_STRIDE = MATERIAL_FRAME_SIZE + MATERIAL_FRAME_GUTTER * 2;
const MATERIAL_DEPTH_BIAS = 0.5;
const MATERIAL_SILHOUETTE_HORIZONTAL_SCALE = 1.012;
const MATERIAL_SILHOUETTE_VERTICAL_SCALE = 0.988;
const MATERIAL_SILHOUETTE_FADE_START = 0.14;
const MATERIAL_SILHOUETTE_OPAQUE_AT = 0.06;
const MATERIAL_SILHOUETTE_SIDE_FADE_START = 0.8;
const MATERIAL_SILHOUETTE_SIDE_OPAQUE_AT = 0.9;
const MATERIAL_ROW_COUNT = MATERIAL_FRAME_COUNT / MATERIAL_ROW_COLUMNS;
const MATERIAL_ROW_WIDTH = MATERIAL_FRAME_STRIDE * MATERIAL_ROW_COLUMNS;
const MATERIAL_ROW_HEIGHT = MATERIAL_FRAME_STRIDE;
const EPHEMERIS_PRESENTATION_EPOCH = "2026-08-30.5 TDB";
const PLAN_OPTIONS = Object.freeze({
  tileSize: 50,
  layerElevation: 50,
  textureLighting: "source",
  seamBleed: 0.15,
});
const DPR_VALUES = Object.freeze([1, 2]);
const source = (path) => resolve(import.meta.dirname, "../source", path);

await Promise.all([
  validateUranusSourceGroup("scene"),
  validateUranusSourceGroup("lenses"),
  validateUranusSourceGroup("rings"),
  validateUranusSourceGroup("moons"),
]);
await ensureUranusPreparationDirectories();
const publicRoot = URANUS_PUBLIC_ROOT;
await Promise.all([
  mkdir(resolve(import.meta.dirname, "../runtime"), { recursive: true }),
  mkdir(resolve(import.meta.dirname, "../site"), { recursive: true }),
]);

const voyagerBaseline = await loadVoyagerBaseline();
const [visibleMap, methaneMap, infraredMap, rings, moons] = await Promise.all([
  loadVisibleMap(voyagerBaseline),
  loadFitsMap("observations/hlsp_opal_hst_wfc3-uvis_uranus-2025a_fq727n_v1_globalmap.fits", {
    low: [5, 18, 23], middle: [25, 105, 116], high: [196, 243, 238],
  }),
  loadFitsMap("observations/hlsp_opal_hst_wfc3-uvis_uranus-2025a_f845m_v1_globalmap.fits", {
    low: [7, 5, 24], middle: [61, 44, 132], high: [237, 214, 255],
  }),
  prepareRings(),
  prepareMoons(),
]);

const lenses = Object.freeze([
  lens("normal", "Normal", "RGB", visibleMap, "Hubble OPAL F657N/F547M/F467M visible-color composite", false),
  lens("methane", "Methane", "727", methaneMap, "Hubble OPAL FQ727N single-band false color", true),
  lens("near-infrared", "Near infrared", "845", infraredMap, "Hubble OPAL F845M single-band false color", true),
]);
const ringMaterial = Object.freeze({
  data: rasterRings(rings.records, RING_SIZE),
  size: RING_SIZE,
});

const surfaceAssets = {};
for (const plan of lenses) {
  surfaceAssets[plan.id] = {};
  for (const density of DPR_VALUES) {
    const width = SURFACE_ATLAS_WIDTH * density;
    const height = SURFACE_ATLAS_HEIGHT * density;
    const { data, info } = await sharp(plan.map.data, {
      raw: { width: plan.map.width, height: plan.map.height, channels: 4 },
    }).resize(width, height, { kernel: sharp.kernel.lanczos3 }).raw()
      .toBuffer({ resolveWithObject: true });
    const packed = packProjectiveSurfaceRaster(data, {
      width,
      height,
      channels: info.channels,
      bandCount: LATITUDE_SEGMENTS,
      gutter: SURFACE_RASTER_GUTTER * density,
    });
    const filename = `uranus-surface-${plan.id}${density === 2 ? "@2x" : ""}.webp`;
    const bytes = await sharp(packed.data, { raw: {
      width: packed.packedWidth,
      height: packed.packedHeight,
      channels: info.channels,
    } })
      .webp({ quality: 94, alphaQuality: 100, smartSubsample: true })
      .toBuffer();
    await writeFile(resolve(publicRoot, filename), bytes);
    const polar = preparePolarAtlas(plan.map, density);
    const polarFilename = `uranus-poles-${plan.id}${density === 2 ? "@2x" : ""}.webp`;
    const polarBytes = await sharp(polar, {
      raw: {
        width: POLAR_TILE_SIZE * 2 * density,
        height: POLAR_TILE_SIZE * density,
        channels: 4,
      },
    }).webp({ quality: 94, alphaQuality: 100, smartSubsample: true }).toBuffer();
    await writeFile(resolve(publicRoot, polarFilename), polarBytes);
    surfaceAssets[plan.id][density] = Object.freeze({
      surface: asset(
        filename,
        bytes,
        packed.packedWidth,
        packed.packedHeight,
      ),
      poles: asset(
        polarFilename,
        polarBytes,
        POLAR_TILE_SIZE * 2 * density,
        POLAR_TILE_SIZE * density,
      ),
    });
  }
  const thumbnailFilename = `uranus-lens-${plan.id}.webp`;
  const thumbnailSize = 64;
  const thumbnailBytes = await prepareLensTexelThumbnail(
    plan.map,
    thumbnailSize,
  );
  await writeFile(resolve(publicRoot, thumbnailFilename), thumbnailBytes);
  surfaceAssets[plan.id].thumbnail = asset(
    thumbnailFilename,
    thumbnailBytes,
    thumbnailSize,
    thumbnailSize,
  );
}

const [
  fixedMaterialAssets,
  shadowlessMaterialAssets,
  materialViewBank,
] = await Promise.all([
  prepareFixedMaterialAssets(ringMaterial),
  prepareFixedMaterialAssets(ringMaterial, { shadowless: true }),
  prepareMaterialViewBank(lenses, ringMaterial),
]);
const cameraStates = Object.freeze(Array.from({ length: 8_901 }, (_, index) => {
  const controlPitch = index / 100;
  const scenePitch = MAXIMUM_SCENE_PITCH * (1 - controlPitch / 89);
  const camera = createPolyCamera({
    zoom: CAMERA_ZOOM,
    rotX: scenePitch,
    rotY: 0,
    target: [0, 0, 0],
  });
  return Object.freeze({
    controlPitch,
    scenePitch: Number(scenePitch.toFixed(4)),
    sceneTransform: buildPolyCameraSceneTransform(camera.state),
  });
}));
const preparedBody = prepareBodyLeaves();
const bodyBands = prepareBodyBands(preparedBody);
const ringPlane = prepareRingPlane();
const fixedMaterialOrbit = Object.freeze(cameraStates.map(({ scenePitch }, index) =>
  prepareFixedMaterialPlane(scenePitch, index).style
    .split(";", 1)[0]
    .slice("transform:".length)));
const orbitBank = prepareOrbitBank(cameraStates, fixedMaterialOrbit);
const systemTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, PRESENTATION_NODE_DEGREES],
})} ${buildPolyMeshTransform({ rotation: [AXIAL_TILT_DEGREES, 0, 0] })}`;
const meshTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, MESH_ROTATION_DEGREES],
})}`;

const preparedLenses = Object.freeze({
  schema: "cssuranus-prepared-lenses@1",
  defaultLens: "normal",
  runtimeFilters: false,
  runtimeRasterization: false,
  controls: lenses.map((plan) => Object.freeze({
    id: plan.id,
    label: plan.label,
    shortLabel: plan.shortLabel,
    falseColor: plan.falseColor,
    qualification: plan.qualification,
    surfaceUrl: surfaceAssets[plan.id][1].surface.url,
    surface2xUrl: surfaceAssets[plan.id][2].surface.url,
    polesUrl: surfaceAssets[plan.id][1].poles.url,
    poles2xUrl: surfaceAssets[plan.id][2].poles.url,
    materialUrl: fixedMaterialAssets[plan.id][1].url,
    material2xUrl: fixedMaterialAssets[plan.id][2].url,
    shadowlessMaterialUrl: shadowlessMaterialAssets[plan.id][1].url,
    shadowlessMaterial2xUrl: shadowlessMaterialAssets[plan.id][2].url,
    materialViewBank: materialViewBank.variants[plan.id],
    thumbnailUrl: surfaceAssets[plan.id].thumbnail.url,
  })),
  provenance: Object.freeze({
    authority: "Hubble OPAL Uranus Cycle 33 rotation A",
    sourceUrl: "https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33",
    coverageComposition: visibleMap.coverage,
    baselineAuthority: voyagerBaseline.provenance,
  }),
});
const preparedScene = Object.freeze({
  schema: "cssuranus-prepared-retained-scene@1",
  runtimeGeometry: false,
  runtimeRasterization: false,
  dimensions: Object.freeze({
    equatorialRadiusKm: URANUS_RADIUS_KM,
    polarRadiusKm: 24_973,
    axialTiltDegrees: 97.77,
    equatorialPresentationRadius: EQUATORIAL_RADIUS,
    polarPresentationRadius: Number(POLAR_RADIUS.toFixed(4)),
    ringSize: RING_SIZE,
  }),
  systemTransform,
  meshTransform,
  camera: Object.freeze({
    state: Object.freeze({
      target: Object.freeze([0, 0, 0]),
      rotX: 40,
      rotY: 0,
      zoom: CAMERA_ZOOM,
      distance: 0,
    }),
    style: "perspective:1000000px",
    sceneStyle: `transform:${cameraStates[Math.round(DEFAULT_CONTROL_PITCH * 100)].sceneTransform}`,
    orbitPlayback: Object.freeze({
      schema: "cssuranus-prepared-camera-orbit@1",
      minimumControlPitchDegrees: 0,
      maximumControlPitchDegrees: 89,
      defaultControlPitchDegrees: DEFAULT_CONTROL_PITCH,
      maximumScenePitchDegrees: MAXIMUM_SCENE_PITCH,
      stateStepDegrees: 0.01,
      stateCount: cameraStates.length,
      interpolation: "none-exact-quantized-camera-state",
      runtimeTransport: "prepared-module-direct-retained-root-publication",
    }),
    minimumPitch: 0,
    maximumPitch: 89,
    defaultPitch: DEFAULT_CONTROL_PITCH,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom: 1,
  }),
  motion: Object.freeze({
    rotation: "retrograde",
    bodyRotationSeconds: BODY_ROTATION_SECONDS,
    visualDirection: "reverse",
  }),
  assets: Object.freeze({
    surfaces: surfaceAssets,
    fixedMaterial: fixedMaterialAssets,
    shadowlessMaterial: shadowlessMaterialAssets,
    materialViewBank: materialViewBank.variants,
    rings,
    moonAtlas: moons.atlas,
  }),
  rings: rings.records,
  ringPlane,
  ringShadowPlane: rings.shadowPlane,
  bodyBands,
  fixedMaterialPlane: Object.freeze({
    model: "prepared-front-depth-biased-camera-facing-material-plane",
    transform: "",
    leaf: prepareFixedMaterialPlane(
      cameraStates[Math.round(DEFAULT_CONTROL_PITCH * 100)].scenePitch,
      Math.round(DEFAULT_CONTROL_PITCH * 100),
    ),
    runtimeWork: "single-shared-scene-prepared-plane-transform-publication-on-input-change",
    depthBias: MATERIAL_DEPTH_BIAS,
    silhouetteBacking: Object.freeze({
      model: "prepared-horizontal-resolved-limb-backing",
      horizontalScale: MATERIAL_SILHOUETTE_HORIZONTAL_SCALE,
      verticalScale: MATERIAL_SILHOUETTE_VERTICAL_SCALE,
      viewAlignmentFadeStart: MATERIAL_SILHOUETTE_FADE_START,
      viewAlignmentOpaqueAt: MATERIAL_SILHOUETTE_OPAQUE_AT,
      sideDirectionFadeStart: MATERIAL_SILHOUETTE_SIDE_FADE_START,
      sideDirectionOpaqueAt: MATERIAL_SILHOUETTE_SIDE_OPAQUE_AT,
      runtimeGeometry: false,
    }),
    orbitPlayback: Object.freeze({
      stateCount: fixedMaterialOrbit.length,
      stateStepDegrees: 0.01,
      runtimeGeometry: false,
    }),
  }),
  preparedSurface: Object.freeze({
    mode: "prepared-static-hd-equirectangular-surface",
    faceCount: preparedBody.filter(({ leaf }) =>
      leaf.className === "uranus-surface-face").length,
    uvLayout: "equirectangular-2-to-1-direct-longitude-latitude",
    atlasWidth: SURFACE_ATLAS_WIDTH,
    atlasHeight: SURFACE_ATLAS_HEIGHT,
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed: PLANET_SEAM_BLEED,
      topologyOverlap: 0,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: SURFACE_RASTER_GUTTER,
      rasterOverscan: SURFACE_RASTER_OVERSCAN,
      runtimeEdgeDiscovery: false,
    }),
  }),
  preparedLighting: Object.freeze({
    mode: "prepared-view-bank-shared-scene-single-material-plane-orbit-projection",
    frameCount: MATERIAL_FRAME_COUNT,
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees: MAXIMUM_SCENE_PITCH,
    frameSize: MATERIAL_FRAME_SIZE,
    rowCount: MATERIAL_ROW_COUNT,
    rowColumns: MATERIAL_ROW_COLUMNS,
    frameStride: MATERIAL_FRAME_STRIDE,
    presentations: materialViewBank.presentations,
    lightSpace: "prepared-fixed-world-light-per-camera-view",
    sourceComposition:
      "Hubble-observed detail over NASA-JPL-Voyager-disc chromatic baseline",
    interpolation: "dense-nearest-prepared-view",
    runtimeAddressing: "prepared-row-url-and-background-address-publication",
    foregroundRingOrdering: materialViewBank.foregroundRingOrdering,
    runtimeRasterization: false,
  }),
  planetFaceRetention: Object.freeze({
    model: "complete-source-longitudes-browser-backface-culling",
    longitudeCount: LONGITUDE_SEGMENTS,
  }),
  preparedRingSource: Object.freeze({
    planeVisualOrbitSeconds: 112,
    shadowModel: Object.freeze({
      systemTiltDegrees: AXIAL_TILT_DEGREES,
      systemNodeDegrees: PRESENTATION_NODE_DEGREES,
    }),
  }),
  moons: Object.freeze({
    schema: "cssuranus-prepared-moons@1",
    presentation: Object.freeze({ minorMoonPreparedPositionCount: 24 }),
    moons: moons.records,
    minorMoonDots: moons.records.filter(({ major }) => !major),
    counts: Object.freeze({
      confirmedMoonCount: moons.records.length,
      detailedMoonCount: moons.records.filter(({ major }) => major).length,
      minorMoonCount: moons.records.filter(({ major }) => !major).length,
      billboardCount: moons.records.length,
      shadowLeafCount: moons.records.filter(({ shadow }) => shadow)
        .reduce((total, { shadow }) => total + shadow.leafCount, 0),
    }),
  }),
  preparedMotion: Object.freeze({
    referenceRotationVisualSeconds: BODY_ROTATION_SECONDS,
    obliquityDegrees: 97.77,
    presentationEquivalentObliquityDegrees: AXIAL_TILT_DEGREES,
    cameraRotationXDegrees: 40,
  }),
  counts: Object.freeze({
    polygonCount: bodyBands.reduce((count, band) => count + band.leaves.length, 0) +
      moons.records.length + moons.records.filter(({ shadow }) => shadow).length + 3,
    planetPolygonCount: bodyBands.reduce((count, band) => count + band.leaves.length, 0) + 1,
    bodyBandCount: bodyBands.length,
    fixedMaterialPlaneLeafCount: 1,
    ringPlaneCount: 1,
    ringShadowPlaneCount: 1,
    confirmedMoonCount: moons.records.length,
    moonCount: moons.records.length,
    moonLeafCount: moons.records.length +
      moons.records.filter(({ shadow }) => shadow).length,
    majorMoonShadowLeafCount: moons.records.filter(({ shadow }) => shadow).length,
    polarInnerLeafCount: 2,
    polarSurfaceLeafCount: 2,
    majorMoonBillboards: moons.records.filter(({ major }) => major).length,
    minorMoonDots: moons.records.filter(({ major }) => !major).length,
  }),
  provenance: Object.freeze({
    body: visibleMap.coverage,
    rings: "PDS Rings Node Uranus ring table",
    moons: "JPL discovery, mean-elements, and physical-parameter tables; NASA/JPL PIA01361 for five major portraits and their source-observed darkening",
    preparation: "all CSS surface matrices, atlas addressing, view-indexed material rows, projective ring shadow, evidence-bound source composition, ring rasterization, epoch-bound moon placement, and camera addressing prepared before runtime",
  }),
});

const runtimeScene = createRuntimeScenePlan(preparedScene);

await Promise.all([
  writeFile(resolve(import.meta.dirname, "../runtime/preparedLenses.mjs"),
    `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_URANUS_LENSES = Object.freeze(${JSON.stringify(preparedLenses)});\n`),
  writeFile(resolve(import.meta.dirname, "../runtime/preparedScene.mjs"),
    `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_URANUS_SCENE = Object.freeze(${JSON.stringify(preparedScene)});\n`),
  writeFile(resolve(import.meta.dirname, "../runtime/preparedSceneRuntime.mjs"),
    `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_URANUS_RUNTIME_SCENE = Object.freeze(${JSON.stringify(runtimeScene)});\n`),
  writeFile(resolve(import.meta.dirname, "../runtime/preparedOrbitBank.mjs"),
    `// Generated by tools/prepare-scene.mjs.\nexport const PREPARED_URANUS_ORBIT_BANK = Object.freeze(${JSON.stringify(orbitBank.descriptor)});\nexport const PREPARED_URANUS_ORBIT_BANK_GZIP_BASE64 = ${JSON.stringify(orbitBank.bytes.toString("base64"))};\n`),
]);

function lens(id, label, shortLabel, map, qualification, falseColor) {
  return Object.freeze({ id, label, shortLabel, map, qualification, falseColor });
}

async function loadVoyagerBaseline() {
  const relativePath = "navigation/uranus.jpg";
  const { data, info } = await sharp(source(relativePath))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const present = [];
  let minimumX = info.width;
  let minimumY = info.height;
  let maximumX = -1;
  let maximumY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const brightness = data[offset] + data[offset + 1] + data[offset + 2];
      if (brightness <= 48) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
      present.push([x, y, offset]);
    }
  }
  if (present.length < info.width * info.height * 0.25) {
    throw new Error("NASA/JPL Voyager Uranus disc coverage drifted.");
  }
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  const radiusX = (maximumX - minimumX + 1) / 2;
  const radiusY = (maximumY - minimumY + 1) / 2;
  const totals = [0, 0, 0];
  let sampleCount = 0;
  for (const [x, y, offset] of present) {
    const radial = Math.hypot(
      (x - centerX) / radiusX,
      (y - centerY) / radiusY,
    );
    if (radial > 0.45) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      totals[channel] += data[offset + channel];
    }
    sampleCount += 1;
  }
  if (sampleCount < present.length * 0.08) {
    throw new Error("NASA/JPL Voyager Uranus baseline sample drifted.");
  }
  const color = totals.map((total) => Math.round(total / sampleCount));
  return Object.freeze({
    color: Object.freeze(color),
    provenance: Object.freeze({
      authority: "NASA/JPL-Caltech Voyager 2 PIA18182 full-disc observation",
      sourcePath: relativePath,
      model: "central-disc chromatic baseline with no synthesized local features",
      sampleCount,
      color: Object.freeze(color),
    }),
  });
}

async function loadVisibleMap(voyagerBaseline) {
  const input = source("observations/hlsp_opal_hst_wfc3-uvis_uranus-2025a_f657n-f547m-f467m_v1_globalmap.tif");
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const map = completeCoverage({
    data,
    width: info.width,
    height: info.height,
    channels: 4,
    baseline: voyagerBaseline.color,
    baselineAuthority: voyagerBaseline.provenance.authority,
    baselineModel: voyagerBaseline.provenance.model,
  });
  return Object.freeze({ ...map, sourceMode: "visible-color" });
}

async function loadFitsMap(relativePath, palette) {
  const bytes = await readFile(source(relativePath));
  const header = parseFitsHeader(bytes);
  if (header.bitpix !== -32 || header.axes.length !== 2) {
    throw new Error(`Uranus FITS layout changed for ${relativePath}.`);
  }
  const [width, height] = header.axes;
  const values = new Float32Array(width * height);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = bytes.readFloatBE(header.dataOffset + index * 4);
  }
  const finite = [...values].filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (finite.length < width * height * 0.25) {
    throw new Error(`Uranus FITS coverage is unexpectedly sparse for ${relativePath}.`);
  }
  const lower = finite[Math.floor(finite.length * 0.015)];
  const upper = finite[Math.floor(finite.length * 0.995)];
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const valid = Number.isFinite(value) && value > 0;
    const normalized = valid ? clamp((value - lower) / (upper - lower)) : 0;
    const color = paletteColor(palette, Math.sqrt(normalized));
    const offset = index * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = valid ? 255 : 0;
  }
  const observedBaseline = observedDiscMean({
    data: rgba,
    width,
    height,
    channels: 4,
    alphaValidity: true,
  });
  const map = completeCoverage({
    data: rgba,
    width,
    height,
    channels: 4,
    alphaValidity: true,
    baseline: observedBaseline,
    baselineAuthority: relativePath,
    baselineModel: "source-filter observed-disc chromatic mean with no synthesized local features",
  });
  return Object.freeze({ ...map, sourceMode: "single-band-false-color", stretch: [lower, upper] });
}

function parseFitsHeader(bytes) {
  const cards = [];
  let offset = 0;
  while (offset + 80 <= bytes.length) {
    const card = bytes.subarray(offset, offset + 80).toString("ascii");
    cards.push(card);
    offset += 80;
    if (card.startsWith("END")) break;
  }
  const value = (name) => {
    const card = cards.find((entry) => entry.startsWith(name.padEnd(8)));
    return card ? card.slice(10).split("/")[0].trim() : null;
  };
  const axisCount = Number(value("NAXIS"));
  return Object.freeze({
    bitpix: Number(value("BITPIX")),
    axes: Array.from({ length: axisCount }, (_, index) => Number(value(`NAXIS${index + 1}`))),
    dataOffset: Math.ceil(offset / 2880) * 2880,
  });
}

function observedDiscMean({ data, width, height, channels, alphaValidity }) {
  const totals = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const present = alphaValidity
        ? data[offset + 3] > 0
        : data[offset] + data[offset + 1] + data[offset + 2] > 5;
      if (!present) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        totals[channel] += data[offset + channel];
      }
      count += 1;
    }
  }
  if (count < width * height * 0.25) {
    throw new Error("Uranus observed-disc baseline coverage drifted.");
  }
  return Object.freeze(totals.map((total) => Math.round(total / count)));
}

function completeCoverage({
  data,
  width,
  height,
  channels,
  alphaValidity = false,
  baseline,
  baselineAuthority,
  baselineModel,
}) {
  const validRows = [];
  for (let y = 0; y < height; y += 1) {
    let valid = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const present = alphaValidity
        ? data[offset + 3] > 0
        : data[offset] + data[offset + 1] + data[offset + 2] > 5;
      valid += Number(present);
    }
    if (valid / width > 0.5) validRows.push(y);
  }
  const detectedBoundaryRow = validRows.at(-1);
  const conservativeEquatorialBoundary = Math.floor((height - 1) / 2) - 6;
  const boundaryRow = Math.min(detectedBoundaryRow, conservativeEquatorialBoundary);
  if (!Number.isSafeInteger(boundaryRow) || boundaryRow < height * 0.25 || boundaryRow > height * 0.75) {
    throw new Error("Uranus OPAL observed-coverage boundary drifted.");
  }
  if (!Array.isArray(baseline) ||
      baseline.length !== 3 || baseline.some((value) =>
        !Number.isSafeInteger(value) || value < 0 || value > 255) ||
      typeof baselineAuthority !== "string" || baselineAuthority.length === 0 ||
      typeof baselineModel !== "string" || baselineModel.length === 0) {
    throw new Error("Uranus evidence-bound baseline is incompatible.");
  }
  const output = Buffer.from(data);
  let filledPixelCount = 0;
  const transitionRows = 12;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const present = alphaValidity
        ? output[offset + 3] > 0
        : output[offset] + output[offset + 1] + output[offset + 2] > 5;
      if (present && y <= boundaryRow) {
        const transitionStart = boundaryRow - transitionRows + 1;
        if (y >= transitionStart) {
          const observedWeight = (boundaryRow - y + 1) / (transitionRows + 1);
          for (let channel = 0; channel < 3; channel += 1) {
            output[offset + channel] = Math.round(
              baseline[channel] * (1 - observedWeight) +
              output[offset + channel] * observedWeight,
            );
          }
        }
        output[offset + 3] = 255;
        continue;
      }
      output[offset] = baseline[0];
      output[offset + 1] = baseline[1];
      output[offset + 2] = baseline[2];
      output[offset + 3] = 255;
      filledPixelCount += 1;
    }
  }
  return Object.freeze({
    data: output,
    width,
    height,
    coverage: Object.freeze({
      sourceWidth: width,
      sourceHeight: height,
      lastObservedRow: boundaryRow,
      detectedNonblackBoundaryRow: detectedBoundaryRow,
      filledPixelCount,
      compositionModel: "observed-map-over-authoritative-uniform-disc-baseline",
      baselineAuthority,
      baselineModel,
      baselineColor: Object.freeze([...baseline]),
      transitionRows,
      inventedLocalFeatures: false,
    }),
  });
}

function spherePoint(latitude, longitude, radiusScale = 1) {
  const latitudeRadius = Math.cos(latitude);
  return [
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * radiusScale * Math.sin(latitude),
  ];
}

function createSurfacePolygon(
  latitudeIndex,
  longitudeIndex,
  radiusScale = 1,
  surfaceOverlap = SURFACE_OVERLAP,
) {
  const latitudeStep = Math.PI / LATITUDE_SEGMENTS;
  const longitudeStep = Math.PI * 2 / LONGITUDE_SEGMENTS;
  const latitude0 = -Math.PI / 2 + latitudeIndex * latitudeStep;
  const latitude1 = latitude0 + latitudeStep;
  const longitude0 = longitudeIndex * longitudeStep;
  const longitude1 = longitude0 + longitudeStep;
  const latitudeOverlap = latitudeStep * surfaceOverlap;
  const longitudeOverlap = longitudeStep * surfaceOverlap;
  const surfaceLatitude0 = latitude0 - latitudeOverlap;
  const surfaceLatitude1 = latitude1 + latitudeOverlap;
  const surfaceLongitude0 = longitude0 - longitudeOverlap;
  const surfaceLongitude1 = surfaceOverlap === 0 &&
      longitudeIndex === LONGITUDE_SEGMENTS - 1
    ? 0
    : longitude1 + longitudeOverlap;
  return {
    latitudeIndex,
    longitudeIndex,
    centerLatitude: (latitude0 + latitude1) / 2,
    centerLongitude: (longitude0 + longitude1) / 2,
    vertices: [
      spherePoint(surfaceLatitude0, surfaceLongitude0, radiusScale),
      spherePoint(surfaceLatitude0, surfaceLongitude1, radiusScale),
      spherePoint(surfaceLatitude1, surfaceLongitude1, radiusScale),
      spherePoint(surfaceLatitude1, surfaceLongitude0, radiusScale),
    ],
    uvs: [
      [longitudeIndex / LONGITUDE_SEGMENTS, latitudeIndex / LATITUDE_SEGMENTS],
      [(longitudeIndex + 1) / LONGITUDE_SEGMENTS, latitudeIndex / LATITUDE_SEGMENTS],
      [(longitudeIndex + 1) / LONGITUDE_SEGMENTS, (latitudeIndex + 1) / LATITUDE_SEGMENTS],
      [longitudeIndex / LONGITUDE_SEGMENTS, (latitudeIndex + 1) / LATITUDE_SEGMENTS],
    ],
    texture: "/scenes/uranus/uranus-surface-normal.webp",
    textureImageSource: {
      url: "/scenes/uranus/uranus-surface-normal.webp",
      width: SURFACE_ATLAS_WIDTH,
      height: SURFACE_ATLAS_HEIGHT,
      sourceRect: {
        x: longitudeIndex * SURFACE_CELL_WIDTH,
        y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * SURFACE_CELL_HEIGHT,
        width: SURFACE_CELL_WIDTH,
        height: SURFACE_CELL_HEIGHT,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#a7dce2",
  };
}

function createPolarPolygon(pole, layer = "surface") {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundary = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
  const inner = layer === "inner";
  const radius = EQUATORIAL_RADIUS * Math.cos(boundary) *
    (inner ? 1.05 : 1.035);
  const boundaryZ = POLAR_RADIUS * Math.sin(boundary);
  const z = sign * (inner ? boundaryZ - 2.4 : boundaryZ + 0.1);
  return {
    latitudeIndex: north ? LATITUDE_SEGMENTS - 1 : 0,
    centerLatitude: sign * Math.PI / 2,
    centerLongitude: 0,
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: "/scenes/uranus/uranus-poles-normal.webp",
    textureImageSource: {
      url: "/scenes/uranus/uranus-poles-normal.webp",
      width: POLAR_TILE_SIZE * 2,
      height: POLAR_TILE_SIZE,
      sourceRect: {
        x: (north ? 0 : 1) * POLAR_TILE_SIZE,
        y: 0,
        width: POLAR_TILE_SIZE,
        height: POLAR_TILE_SIZE,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#a7dce2",
    polarCap: pole,
    polarLayer: layer,
  };
}

function prepareBodyLeaves() {
  const seamEdges = prepareBodySeamEdges();
  const prepared = [];
  for (const pole of ["south", "north"]) {
    for (const layer of ["inner", "surface"]) {
      const polygon = createPolarPolygon(pole, layer);
      prepared.push(Object.freeze({
        latitudeIndex: polygon.latitudeIndex,
        leaf: Object.freeze({
          tag: "s",
          className: layer === "inner"
            ? `uranus-polar-inner uranus-polar-inner-${pole}`
            : `uranus-polar-surface uranus-polar-${pole}`,
          ...textureLeafStyle(polygon, prepared.length, {
            leafWidth: POLAR_TILE_SIZE,
            leafHeight: POLAR_TILE_SIZE,
            seamBleed: 0,
          }),
        }),
      }));
    }
  }
  let surfaceIndex = 0;
  for (let latitudeIndex = 1;
    latitudeIndex < LATITUDE_SEGMENTS - 1;
    latitudeIndex += 1) {
    for (let longitudeIndex = 0;
      longitudeIndex < LONGITUDE_SEGMENTS;
      longitudeIndex += 1) {
      const polygon = createSurfacePolygon(latitudeIndex, longitudeIndex);
      prepared.push(Object.freeze({
        latitudeIndex,
        longitudeIndex,
        leaf: Object.freeze({
          tag: "s",
          className: "uranus-surface-face",
          ...textureLeafStyle(polygon, surfaceIndex, {
            leafWidth: SURFACE_LEAF_SIZE,
            leafHeight: SURFACE_LEAF_SIZE,
            seamEdges: seamEdges.get(surfaceIndex),
            seamBleed: PLANET_SEAM_BLEED,
          }),
        }),
      }));
      surfaceIndex += 1;
    }
  }
  return Object.freeze(prepared);
}

function prepareBodySeamEdges() {
  const topology = Array.from(
    { length: LATITUDE_SEGMENTS - 2 },
    (_, latitudeOffset) => Array.from(
      { length: LONGITUDE_SEGMENTS },
      (_, longitudeIndex) => createSurfacePolygon(
        latitudeOffset + 1,
        longitudeIndex,
        1,
        0,
      ),
    ),
  ).flat();
  const seamEdges = buildSeamBleedPolygonEdges(topology, {
    tileSize: PLAN_OPTIONS.tileSize,
    layerElevation: PLAN_OPTIONS.layerElevation,
  });
  for (let index = 0; index < topology.length; index += 1) {
    const polygon = topology[index];
    if (polygon.longitudeIndex === 0 && !seamEdges.get(index)?.has(3)) {
      throw new Error(`Uranus latitude ${polygon.latitudeIndex} west wrap edge is not shared.`);
    }
    if (polygon.longitudeIndex === LONGITUDE_SEGMENTS - 1 &&
        !seamEdges.get(index)?.has(1)) {
      throw new Error(`Uranus latitude ${polygon.latitudeIndex} east wrap edge is not shared.`);
    }
  }
  return seamEdges;
}

function prepareBodyBands(preparedBodyLeaves) {
  return Object.freeze(Array.from({ length: LATITUDE_SEGMENTS }, (_, latitudeIndex) => {
    const latitudeDegrees = -90 +
      (latitudeIndex + 0.5) * 180 / LATITUDE_SEGMENTS;
    return Object.freeze({
      latitudeIndex,
      latitudeDegrees: Number(latitudeDegrees.toFixed(3)),
      visualRotationSeconds: BODY_ROTATION_SECONDS,
      leaves: Object.freeze(preparedBodyLeaves
        .filter((preparedLeaf) => preparedLeaf.latitudeIndex === latitudeIndex)
        .map((preparedLeaf) => preparedLeaf.leaf)),
    });
  }));
}

async function prepareFixedMaterialAssets(
  ringMaterial,
  { shadowless = false } = {},
) {
  const palettes = Object.freeze({
    normal: Object.freeze({
      base: Object.freeze([166, 218, 225]),
      atmosphere: Object.freeze([157, 229, 238]),
    }),
    methane: Object.freeze({
      base: Object.freeze([60, 121, 132]),
      atmosphere: Object.freeze([121, 218, 228]),
    }),
    "near-infrared": Object.freeze({
      base: Object.freeze([90, 68, 151]),
      atmosphere: Object.freeze([194, 183, 245]),
    }),
  });
  const prepared = {};
  for (const [lensId, palette] of Object.entries(palettes)) {
    prepared[lensId] = {};
    for (const density of DPR_VALUES) {
      const size = 512 * density;
      const { rgba } = rasterFixedMaterial(
        size,
        palette,
        40,
        ringMaterial,
        { shadowless },
      );
      const filename = `uranus-fixed-material-${lensId}${
        shadowless ? "-shadowless" : ""}${
        density === 2 ? "@2x" : ""}.webp`;
      const bytes = await sharp(rgba, {
        raw: { width: size, height: size, channels: 4 },
      }).webp({ quality: 94, alphaQuality: 100, smartSubsample: true }).toBuffer();
      await writeFile(resolve(publicRoot, filename), bytes);
      prepared[lensId][density] = asset(filename, bytes, size, size);
    }
  }
  return Object.freeze(Object.fromEntries(Object.entries(prepared).map(
    ([lensId, densities]) => [lensId, Object.freeze(densities)],
  )));
}

async function prepareMaterialViewBank(lensPlans, ringMaterial) {
  const variants = {};
  const expectedFiles = new Set();
  for (const plan of lensPlans) {
    const palette = materialPalette(plan);
    const rows = [];
    const frameRawSha256 = [];
    const frameForegroundRingTexelCounts = [];
    const frameRingShadowTexelCounts = [];
    for (let rowIndex = 0; rowIndex < MATERIAL_ROW_COUNT; rowIndex += 1) {
      const row = Buffer.alloc(MATERIAL_ROW_WIDTH * MATERIAL_ROW_HEIGHT * 4);
      for (let column = 0; column < MATERIAL_ROW_COLUMNS; column += 1) {
        const frameIndex = rowIndex * MATERIAL_ROW_COLUMNS + column;
        const scenePitch = MAXIMUM_SCENE_PITCH *
          (1 - frameIndex / (MATERIAL_FRAME_COUNT - 1));
        const preparedFrame = rasterFixedMaterial(
          MATERIAL_FRAME_SIZE,
          palette,
          scenePitch,
          ringMaterial,
        );
        frameRawSha256.push(createHash("sha256")
          .update(preparedFrame.rgba).digest("hex"));
        frameForegroundRingTexelCounts.push(
          preparedFrame.foregroundRingTexelCount,
        );
        frameRingShadowTexelCounts.push(preparedFrame.ringShadowTexelCount);
        writeMaterialRowFrame(row, preparedFrame.rgba, column);
      }
      const filename = `uranus-orbit-material-${plan.id}-row-${
        String(rowIndex).padStart(2, "0")}.webp`;
      const bytes = await sharp(row, {
        raw: {
          width: MATERIAL_ROW_WIDTH,
          height: MATERIAL_ROW_HEIGHT,
          channels: 4,
        },
      }).webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
        .toBuffer();
      await writeFile(resolve(publicRoot, filename), bytes);
      expectedFiles.add(filename);
      rows.push(asset(
        filename,
        bytes,
        MATERIAL_ROW_WIDTH,
        MATERIAL_ROW_HEIGHT,
      ));
    }
    const bank = Object.freeze({
      densityIndependentPreparedRows: true,
      rows: Object.freeze(rows),
      frameRawSha256: Object.freeze(frameRawSha256),
      frameForegroundRingTexelCounts: Object.freeze(
        frameForegroundRingTexelCounts,
      ),
      frameRingShadowTexelCounts: Object.freeze(frameRingShadowTexelCounts),
      initialWarmRows: Object.freeze([5, 6, 7]),
      maximumRetainedRowCount: 3,
      initialDecodedWorkingSetBytes: rows.slice(5, 8).reduce(
        (total, row) => total + row.width * row.height * 4,
        0,
      ),
      maximumDecodedWorkingSetBytes: rows.slice(5, 8).reduce(
        (total, row) => total + row.width * row.height * 4,
        0,
      ),
      fullAtlasDecodedRgbaBytes: rows.reduce(
        (total, row) => total + row.width * row.height * 4,
        0,
      ),
    });
    variants[plan.id] = Object.freeze({
      1: bank,
      2: bank,
    });
  }
  for (const filename of await readdir(publicRoot)) {
    if (/^uranus-orbit-material-.+-row-\d{2}(?:@2x)?\.webp$/u.test(filename) &&
        !expectedFiles.has(filename)) {
      await unlink(resolve(publicRoot, filename));
    }
    if (/^uranus-camera-material-orbit-[a-f0-9]+\.bin$/u.test(filename)) {
      await unlink(resolve(publicRoot, filename));
    }
  }
  const presentations = Object.freeze(Array.from(
    { length: MATERIAL_FRAME_COUNT },
    (_, frameIndex) => {
      const rowIndex = Math.floor(frameIndex / MATERIAL_ROW_COLUMNS);
      const column = frameIndex % MATERIAL_ROW_COLUMNS;
      return Object.freeze({
        frameIndex,
        rowIndex,
        scenePitchDegrees: Number((MAXIMUM_SCENE_PITCH *
          (1 - frameIndex / (MATERIAL_FRAME_COUNT - 1))).toFixed(6)),
        backgroundPosition:
          `${-(column * MATERIAL_FRAME_STRIDE + MATERIAL_FRAME_GUTTER)}px ` +
          `${-MATERIAL_FRAME_GUTTER}px`,
        backgroundSize: `${MATERIAL_ROW_WIDTH}px ${MATERIAL_ROW_HEIGHT}px`,
      });
    },
  ));
  return Object.freeze({
    variants: Object.freeze(variants),
    presentations,
    foregroundRingOrdering: Object.freeze({
      model: "prepared-ring-rgb-over-material-with-material-alpha-retained",
      sourceAssetUrl: "/scenes/uranus/uranus-rings.webp",
      compositedTexelCount: variants.normal[1]
        .frameForegroundRingTexelCounts.reduce((total, count) => total + count, 0),
      ringShadowedTexelCount: variants.normal[1]
        .frameRingShadowTexelCounts.reduce((total, count) => total + count, 0),
      screenshotDerived: false,
      runtimeMath: false,
      ringSource: "PDS Rings Node Uranus table",
    }),
  });
}

function materialPalette(plan) {
  const atmosphere = Object.freeze({
    normal: Object.freeze([157, 229, 238]),
    methane: Object.freeze([121, 218, 228]),
    "near-infrared": Object.freeze([194, 183, 245]),
  })[plan.id];
  const base = plan.map?.coverage?.baselineColor;
  if (!atmosphere || !Array.isArray(base) || base.length !== 3) {
    throw new Error(`Uranus material palette is missing for ${plan.id}.`);
  }
  return Object.freeze({ base, atmosphere });
}

function writeMaterialRowFrame(row, frame, column) {
  const targetX = column * MATERIAL_FRAME_STRIDE + MATERIAL_FRAME_GUTTER;
  const targetY = MATERIAL_FRAME_GUTTER;
  for (let y = 0; y < MATERIAL_FRAME_SIZE; y += 1) {
    const sourceStart = y * MATERIAL_FRAME_SIZE * 4;
    const targetStart = ((targetY + y) * MATERIAL_ROW_WIDTH + targetX) * 4;
    frame.copy(
      row,
      targetStart,
      sourceStart,
      sourceStart + MATERIAL_FRAME_SIZE * 4,
    );
    for (let amount = 1; amount <= MATERIAL_FRAME_GUTTER; amount += 1) {
      row.copy(row, targetStart - amount * 4, targetStart, targetStart + 4);
      const finalPixel = targetStart + (MATERIAL_FRAME_SIZE - 1) * 4;
      row.copy(row, finalPixel + amount * 4, finalPixel, finalPixel + 4);
    }
  }
  const rowBytes = (MATERIAL_FRAME_SIZE + MATERIAL_FRAME_GUTTER * 2) * 4;
  const firstRow = (targetY * MATERIAL_ROW_WIDTH +
    targetX - MATERIAL_FRAME_GUTTER) * 4;
  const finalRow = firstRow +
    (MATERIAL_FRAME_SIZE - 1) * MATERIAL_ROW_WIDTH * 4;
  for (let amount = 1; amount <= MATERIAL_FRAME_GUTTER; amount += 1) {
    row.copy(
      row,
      firstRow - amount * MATERIAL_ROW_WIDTH * 4,
      firstRow,
      firstRow + rowBytes,
    );
    row.copy(
      row,
      finalRow + amount * MATERIAL_ROW_WIDTH * 4,
      finalRow,
      finalRow + rowBytes,
    );
  }
}

function rasterFixedMaterial(
  size,
  palette,
  scenePitchDegrees,
  ringMaterial,
  { shadowless = false } = {},
) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const pixelToObject = 512 / size;
  const defaultLight = normalize([-0.45, -0.29, 0.845]);
  const worldLight = rotateX(defaultLight, -40 * Math.PI / 180);
  const screenLight = normalize(rotateX(
    worldLight,
    scenePitchDegrees * Math.PI / 180,
  ));
  const right = screenToUranus([1, 0, 0], scenePitchDegrees);
  const down = screenToUranus([0, 1, 0], scenePitchDegrees);
  const view = screenToUranus([0, 0, 1], scenePitchDegrees);
  const light = shadowless
    ? view
    : screenToUranus(screenLight, scenePitchDegrees);
  let foregroundRingTexelCount = 0;
  let ringShadowTexelCount = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const screenX = (x - center) * pixelToObject;
      const screenY = (y - center) * pixelToObject;
      const sideDirection = Math.abs(screenX) /
        Math.max(1e-9, Math.hypot(screenX, screenY));
      const sideCoverage = clamp(
        (sideDirection - MATERIAL_SILHOUETTE_SIDE_FADE_START) /
        (MATERIAL_SILHOUETTE_SIDE_OPAQUE_AT -
          MATERIAL_SILHOUETTE_SIDE_FADE_START),
      );
      const backingHorizontalScale = 1 +
        (MATERIAL_SILHOUETTE_HORIZONTAL_SCALE - 1) * sideCoverage;
      const backingVerticalScale = MATERIAL_SILHOUETTE_VERTICAL_SCALE +
        (1 - MATERIAL_SILHOUETTE_VERTICAL_SCALE) * sideCoverage;
      const origin = addVectors(
        scaleVector(right, screenX),
        scaleVector(down, screenY),
      );
      const surfaceHit = intersectViewRayWithUranus(origin, view);
      const backingOrigin = addVectors(
        scaleVector(
          right,
          screenX / backingHorizontalScale,
        ),
        scaleVector(down, screenY / backingVerticalScale),
      );
      const backingHit = intersectViewRayWithUranus(backingOrigin, view);
      if (!backingHit) continue;
      const hit = surfaceHit ?? backingHit;
      let direct = Math.max(0, dot(hit.normal, light));
      const ringShadowOpacity = shadowless
        ? 0
        : sampleUranusRingShadow(hit.position, light, ringMaterial);
      if (ringShadowOpacity > 1 / 255 && direct > 0) {
        direct *= 1 - ringShadowOpacity * 0.82;
        ringShadowTexelCount += 1;
      }
      const terminatorAmount = clamp((direct - 0.04) / 0.2);
      const softenedDirect = direct * terminatorAmount * terminatorAmount *
        (3 - 2 * terminatorAmount);
      const illumination = 0.24 + softenedDirect * 0.76;
      const lightingAlpha = clamp(1 - illumination);
      const viewAlignment = Math.max(0, dot(hit.normal, view));
      const limb = Math.pow(1 - viewAlignment, 1.72);
      const atmosphereAlpha = clamp(limb * (0.04 + Math.sqrt(direct) * 0.2));
      let alpha = 1 - (1 - lightingAlpha) * (1 - atmosphereAlpha);
      const limbCoverage = clamp(
        (MATERIAL_SILHOUETTE_FADE_START - viewAlignment) /
        (MATERIAL_SILHOUETTE_FADE_START -
          MATERIAL_SILHOUETTE_OPAQUE_AT),
      );
      const backingViewAlignment = Math.max(
        0,
        dot(backingHit.normal, view),
      );
      const backingLimbCoverage = clamp(
        (MATERIAL_SILHOUETTE_FADE_START - backingViewAlignment) /
        (MATERIAL_SILHOUETTE_FADE_START -
          MATERIAL_SILHOUETTE_OPAQUE_AT),
      );
      const silhouetteCoverage = surfaceHit
        ? Math.max(limbCoverage, backingLimbCoverage)
        : sideCoverage;
      const surfaceTransmission = illumination * (1 - atmosphereAlpha);
      const resolvedAlpha = surfaceHit
        ? alpha * (1 - silhouetteCoverage) + silhouetteCoverage
        : sideCoverage;
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const overlayPremultiplied =
          palette.atmosphere[channel] * atmosphereAlpha;
        const resolvedSurface = overlayPremultiplied +
          palette.base[channel] * surfaceTransmission;
        const resolvedPremultiplied = surfaceHit
          ? overlayPremultiplied * (1 - silhouetteCoverage) +
            resolvedSurface * silhouetteCoverage
          : resolvedSurface * sideCoverage;
        rgba[offset + channel] = resolvedAlpha > 0
          ? clampInt(Math.round(
            resolvedPremultiplied / resolvedAlpha,
          ), 0, 255)
          : 0;
      }
      alpha = resolvedAlpha;
      rgba[offset + 3] = clampInt(Math.round(alpha * 255), 0, 255);
      const surfaceDistance = dot(subtractVectors(hit.position, origin), view);
      const foregroundRing = sampleUranusForegroundRing(
        origin,
        view,
        surfaceDistance,
        ringMaterial,
      );
      if (!foregroundRing) continue;
      const ringAlpha = foregroundRing[3] / 255;
      const compositeAlpha = ringAlpha + alpha * (1 - ringAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = compositeAlpha > 0
          ? clampInt(Math.round((
            foregroundRing[channel] * ringAlpha +
            rgba[offset + channel] * alpha * (1 - ringAlpha)
          ) / compositeAlpha), 0, 255)
          : 0;
      }
      alpha = compositeAlpha;
      rgba[offset + 3] = clampInt(Math.round(compositeAlpha * 255), 0, 255);
      foregroundRingTexelCount += 1;
    }
  }
  return Object.freeze({
    rgba,
    foregroundRingTexelCount,
    ringShadowTexelCount,
  });
}

function screenToUranus(vector, scenePitchDegrees) {
  let result = rotateX(vector, -scenePitchDegrees * Math.PI / 180);
  result = rotateZ(result, -14 * Math.PI / 180);
  result = rotateY(result, -82.23 * Math.PI / 180);
  return rotateZ(result, 176 * Math.PI / 180);
}

function intersectViewRayWithUranus(origin, direction) {
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
    const position = addVectors(origin, scaleVector(direction, distance));
    const normal = normalize([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return Object.freeze({
      position,
      normal,
      distance,
      visibility: dot(normal, direction),
    });
  });
  return candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
}

function sampleUranusRingShadow(position, light, ringMaterial) {
  if (!ringMaterial || Math.abs(light[2]) < 1e-9) return 0;
  const distance = -position[2] / light[2];
  if (distance <= 0) return 0;
  const ringX = position[0] + distance * light[0];
  const ringY = position[1] + distance * light[1];
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return 0;
  return sampleRingRgba(ringX, ringY, ringMaterial)[3] / 255;
}

function sampleUranusForegroundRing(
  origin,
  view,
  surfaceDistance,
  ringMaterial,
) {
  if (!ringMaterial || Math.abs(view[2]) < 1e-9) return null;
  const ringDistance = -origin[2] / view[2];
  if (ringDistance <= surfaceDistance) return null;
  const ringX = origin[0] + ringDistance * view[0];
  const ringY = origin[1] + ringDistance * view[1];
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return null;
  const sample = sampleRingRgba(ringX, ringY, ringMaterial);
  return sample[3] > 0 ? sample : null;
}

function sampleRingRgba(ringX, ringY, ringMaterial) {
  const textureX = (ringX / RING_OUTER_RADIUS + 1) *
    0.5 * (ringMaterial.size - 1);
  const textureY = (ringY / RING_OUTER_RADIUS + 1) *
    0.5 * (ringMaterial.size - 1);
  const x0 = Math.max(0, Math.min(ringMaterial.size - 1, Math.floor(textureX)));
  const y0 = Math.max(0, Math.min(ringMaterial.size - 1, Math.floor(textureY)));
  const x1 = Math.min(ringMaterial.size - 1, x0 + 1);
  const y1 = Math.min(ringMaterial.size - 1, y0 + 1);
  const amountX = textureX - x0;
  const amountY = textureY - y0;
  const mix = (start, end, amount) => start + (end - start) * amount;
  return Array.from({ length: 4 }, (_, channel) => {
    const value = (x, y) => ringMaterial.data[
      (y * ringMaterial.size + x) * 4 + channel
    ];
    return mix(
      mix(value(x0, y0), value(x1, y0), amountX),
      mix(value(x0, y1), value(x1, y1), amountX),
      amountY,
    );
  });
}

function dot(left, right) {
  return left.reduce((total, value, index) =>
    total + value * right[index], 0);
}

function scaleVector(vector, scale) {
  return vector.map((value) => value * scale);
}

function addVectors(...vectors) {
  return [0, 1, 2].map((axis) =>
    vectors.reduce((total, vector) => total + vector[axis], 0));
}

function subtractVectors(left, right) {
  return left.map((value, index) => value - right[index]);
}

function prepareOrbitBank(cameraStates, materialTransforms) {
  if (cameraStates.length !== materialTransforms.length) {
    throw new Error("Uranus prepared orbit transform counts drifted.");
  }
  const decoded = Buffer.from(`${cameraStates.map(({ sceneTransform }, index) =>
    `${sceneTransform}\t${materialTransforms[index]}`).join("\n")}\n`);
  const bytes = gzipSync(decoded, { level: 9 });
  return Object.freeze({
    bytes,
    descriptor: Object.freeze({
      schema: "cssuranus-prepared-orbit-bank@1",
      encoding: "gzip-newline-separated-scene-tab-material-transform",
      encodedByteLength: bytes.byteLength,
      decodedByteLength: decoded.byteLength,
      stateCount: cameraStates.length,
      stateStepDegrees: 0.01,
      minimumControlPitchDegrees: 0,
      maximumControlPitchDegrees: 89,
      runtimeInterpolation: false,
      runtimeMatrixConstruction: false,
    }),
  });
}

function prepareFixedMaterialPlane(scenePitch) {
  const halfSize = MATERIAL_FRAME_SIZE / 2;
  const radians = -scenePitch * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scale = PLAN_OPTIONS.layerElevation * 512 / MATERIAL_FRAME_SIZE;
  const frontDepth = (EQUATORIAL_RADIUS + MATERIAL_DEPTH_BIAS) *
    PLAN_OPTIONS.layerElevation;
  const matrix = [
    scale, 0, 0, 0,
    0, scale * cosine, scale * sine, 0,
    0, -scale * sine, scale * cosine, 0,
    -halfSize * scale,
    -halfSize * scale * cosine - frontDepth * sine,
    -halfSize * scale * sine + frontDepth * cosine,
    1,
  ].map((value) => Number(value.toFixed(6))).join(",");
  return Object.freeze({
    tag: "s",
    className: "uranus-fixed-material-leaf",
    style: `transform:matrix3d(${matrix});--polycss-atlas-width:${MATERIAL_FRAME_SIZE}px;` +
      `--polycss-atlas-height:${MATERIAL_FRAME_SIZE}px;background-position:0px 0px;` +
      `background-size:${MATERIAL_FRAME_SIZE}px ${MATERIAL_FRAME_SIZE}px;` +
      "backface-visibility:visible",
    leafWidth: MATERIAL_FRAME_SIZE,
    leafHeight: MATERIAL_FRAME_SIZE,
    projection: "prepared-camera-facing-plane",
    lighting: "prepared-material",
    lightingOverlay: true,
  });
}

function prepareRingPlane() {
  const polygon = {
    vertices: [
      [-RING_OUTER_RADIUS, -RING_OUTER_RADIUS, 0],
      [RING_OUTER_RADIUS, -RING_OUTER_RADIUS, 0],
      [RING_OUTER_RADIUS, RING_OUTER_RADIUS, 0],
      [-RING_OUTER_RADIUS, RING_OUTER_RADIUS, 0],
    ],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    texture: "/scenes/uranus/uranus-rings.webp",
    textureImageSource: {
      url: "/scenes/uranus/uranus-rings.webp",
      width: RING_SIZE,
      height: RING_SIZE,
      sourceRect: { x: 0, y: 0, width: RING_SIZE, height: RING_SIZE },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#839297",
    doubleSided: true,
  };
  const leaf = textureLeafStyle(polygon, 0, {
    leafWidth: RING_SIZE,
    leafHeight: RING_SIZE,
    seamBleed: 0,
  });
  return Object.freeze({
    ...leaf,
    style: `${leaf.style};backface-visibility:visible`,
  });
}

function prepareRingShadowPlane() {
  const polygon = {
    vertices: [
      [-RING_OUTER_RADIUS, -RING_OUTER_RADIUS, 0.12],
      [RING_OUTER_RADIUS, -RING_OUTER_RADIUS, 0.12],
      [RING_OUTER_RADIUS, RING_OUTER_RADIUS, 0.12],
      [-RING_OUTER_RADIUS, RING_OUTER_RADIUS, 0.12],
    ],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    texture: "/scenes/uranus/uranus-ring-shadow-plane.webp",
    textureImageSource: {
      url: "/scenes/uranus/uranus-ring-shadow-plane.webp",
      width: RING_SIZE,
      height: RING_SIZE,
      sourceRect: { x: 0, y: 0, width: RING_SIZE, height: RING_SIZE },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#020608",
    doubleSided: true,
  };
  const leaf = textureLeafStyle(polygon, 0, {
    leafWidth: RING_SIZE,
    leafHeight: RING_SIZE,
    seamBleed: 0,
  });
  return Object.freeze({
    tag: "s",
    className: "uranus-ring-shadow-leaf",
    ...leaf,
    style: `${leaf.style};backface-visibility:visible`,
  });
}

function textureLeafStyle(
  polygon,
  index,
  {
    leafWidth,
    leafHeight,
    geometryOnly = false,
    seamEdges = null,
    seamBleed = PLAN_OPTIONS.seamBleed,
  },
) {
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
  if (!geometry) throw new Error(`Uranus retained texture leaf ${index} did not prepare.`);
  const sourceFitted = fitTextureGeometry(geometry, leafWidth, leafHeight);
  const preparedSurface = polygon.texture ===
    "/scenes/uranus/uranus-surface-normal.webp" && !geometryOnly;
  const fitted = preparedSurface
    ? fitProjectiveTextureGeometryToStableLayout(sourceFitted)
    : sourceFitted;
  const rasterPresentation = preparedSurface
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: SURFACE_ATLAS_WIDTH,
      sourceHeight: SURFACE_ATLAS_HEIGHT,
      sourceRect: polygon.textureImageSource.sourceRect,
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fitted.backgroundPosition,
      backgroundSize: fitted.backgroundSize,
      leafWidth: fitted.leafWidth,
      leafHeight: fitted.leafHeight,
      bandCount: LATITUDE_SEGMENTS,
      gutter: SURFACE_RASTER_GUTTER,
      overscan: SURFACE_RASTER_OVERSCAN,
    })
    : fitted;
  const backgroundPosition = rasterPresentation.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value))
    .join(" ");
  const backgroundSize = rasterPresentation.backgroundSize
    .map(formatCssLength).join(" ");
  return Object.freeze({
    style: `transform:matrix3d(${fitted.matrix})` +
      (fitted.leafWidth === 64 && fitted.leafHeight === 64
        ? ""
        : `;--polycss-atlas-width:${fitted.leafWidth}px;--polycss-atlas-height:${fitted.leafHeight}px`) +
      (geometryOnly
        ? ""
        : `;background-position:${backgroundPosition};background-size:${backgroundSize}`),
    ...(preparedSurface ? {
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fitted.matrix,
        PROJECTIVE_TEXTURE_RASTER_SCALE,
      ),
    } : {}),
    sourceRect: fitted.sourceRect,
    leafWidth: fitted.leafWidth,
    leafHeight: fitted.leafHeight,
    projection: fitted.projection,
    lighting: geometryOnly ? "prepared-material" : "source",
    lightingOverlay: geometryOnly,
  });
}

function fitTextureGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Prepared Uranus texture matrix is invalid.");
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

function preparePolarAtlas(map, density) {
  const tile = POLAR_TILE_SIZE * density;
  const output = Buffer.alloc(tile * 2 * tile * 4);
  const boundaryLatitude = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
  for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
    const north = poleIndex === 0;
    for (let y = 0; y < tile; y += 1) {
      for (let x = 0; x < tile; x += 1) {
        const nx = (x + 0.5) / tile * 2 - 1;
        const ny = (y + 0.5) / tile * 2 - 1;
        const radius = Math.hypot(nx, ny);
        if (radius > 1) continue;
        const latitudeMagnitude = Math.PI / 2 -
          radius * (Math.PI / 2 - boundaryLatitude);
        const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
        const longitude = (Math.atan2(ny, nx) + Math.PI * 2) % (Math.PI * 2);
        const sourceX = Math.round(longitude / (Math.PI * 2) * (map.width - 1));
        const sourceY = Math.round((Math.PI / 2 - latitude) / Math.PI * (map.height - 1));
        const sourceOffset = (sourceY * map.width + sourceX) * 4;
        const targetOffset = (y * tile * 2 + poleIndex * tile + x) * 4;
        map.data.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
      }
    }
  }
  return output;
}

async function prepareLensTexelThumbnail(map, size) {
  const cropSize = Math.floor(map.height / 2);
  return sharp(map.data, {
    raw: { width: map.width, height: map.height, channels: 4 },
  }).extract({
    left: Math.floor((map.width - cropSize) / 2),
    top: Math.floor((map.height - cropSize) / 2),
    width: cropSize,
    height: cropSize,
  }).resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .webp({ quality: 90, effort: 6 })
    .toBuffer();
}

async function prepareRings() {
  const html = await readFile(source("rings/uranus-rings-table.html"), "utf8");
  const records = Object.freeze([
    ring("Zeta", 39_600, 3_500, 0.0045, "gray"),
    ring("6", 41_838, 1.53, 0.3, "gray", "Six"),
    ring("5", 42_234, 2.28, 0.5, "gray", "Five"),
    ring("4", 42_571, 2.33, 0.3, "gray", "Four"),
    ring("Alpha", 44_718, 8.46, 0.4, "gray"),
    ring("Beta", 45_661, 9.49, 0.3, "gray"),
    ring("Eta", 47_176, 1.6, 0.4, "gray"),
    ring("Gamma", 47_627, 2.15, 0.3, "gray"),
    ring("Delta", 48_300, 4.6, 0.5, "gray"),
    ring("Lambda", 50_024, 2.3, 0.1, "gray"),
    ring("Epsilon", 51_149, 58.1, 1.4, "gray"),
    ring("Nu", 67_300, 3_800, 0.0000056, "red"),
    ring("Mu", 97_700, 17_000, 0.0000085, "blue"),
  ]);
  for (const record of records) {
    if (!html.includes(`>${record.sourceLabel}<`) && !html.includes(`>${record.sourceLabel} `)) {
      throw new Error(`PDS Uranus ring table no longer contains ${record.name}.`);
    }
  }
  const result = { records, shadow: {} };
  for (const density of DPR_VALUES) {
    const size = RING_SIZE * density;
    const full = rasterRings(records, size);
    const filename = `uranus-rings${density === 2 ? "@2x" : ""}.webp`;
    const bytes = await sharp(full, { raw: { width: size, height: size, channels: 4 } })
      .webp({ quality: 96, alphaQuality: 100 }).toBuffer();
    await writeFile(resolve(publicRoot, filename), bytes);
    result[density] = asset(filename, bytes, size, size);
    const shadow = rasterRingShadow(full, size);
    const shadowFilename = `uranus-ring-shadow-plane${
      density === 2 ? "@2x" : ""}.webp`;
    const shadowBytes = await sharp(shadow, {
      raw: { width: size, height: size, channels: 4 },
    }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    await writeFile(resolve(publicRoot, shadowFilename), shadowBytes);
    result.shadow[density] = asset(shadowFilename, shadowBytes, size, size);
  }
  result.shadow = Object.freeze(result.shadow);
  result.shadowPlane = prepareRingShadowPlane();
  return Object.freeze(result);
}

function ring(name, radiusKm, widthKm, opticalDepth, color, sourceLabel = name) {
  return Object.freeze({
    name,
    radiusKm,
    widthKm,
    opticalDepth,
    color,
    sourceLabel,
    widthQualification: widthKm < 200
      ? "source-center-radius-with-minimum-pixel-readability-width"
      : "source-scaled-width",
  });
}

function rasterRings(records, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const maximumRadius = center - 8;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radiusKm = Math.hypot(x - center, y - center) / maximumRadius * RING_OUTER_KM;
      let alpha = 0;
      let color = [133, 145, 150];
      for (const record of records) {
        const physicalHalfWidth = record.widthKm / 2;
        const minimumHalfWidth = record.widthKm < 200
          ? RING_OUTER_KM / maximumRadius * 0.72
          : physicalHalfWidth;
        const halfWidth = Math.max(physicalHalfWidth, minimumHalfWidth);
        const distance = Math.abs(radiusKm - record.radiusKm);
        if (distance > halfWidth) continue;
        const edge = 1 - distance / halfWidth;
        const sourceAlpha = record.widthKm > 1000
          ? Math.min(72, Math.sqrt(record.opticalDepth) * 440)
          : 68 + Math.min(1, record.opticalDepth) * 140;
        const contribution = sourceAlpha * Math.min(1, edge * 2.5);
        alpha = Math.max(alpha, contribution);
        color = record.color === "red"
          ? [141, 91, 86]
          : record.color === "blue" ? [103, 151, 181] : [125, 137, 140];
      }
      if (alpha <= 0) continue;
      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = clampInt(Math.round(alpha), 0, 235);
    }
  }
  return rgba;
}

function rasterRingShadow(ringRgba, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const maximumRadius = center - 8;
  const planetRadiusPixels = URANUS_RADIUS_KM / RING_OUTER_KM * maximumRadius;
  const direction = normalize([0.91, 0.414]);
  const perpendicular = [-direction[1], direction[0]];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const ringAlpha = ringRgba[offset + 3] / 255;
      if (ringAlpha <= 0) continue;
      const dx = x - center;
      const dy = y - center;
      const along = dx * direction[0] + dy * direction[1];
      const across = Math.abs(dx * perpendicular[0] + dy * perpendicular[1]);
      if (along <= planetRadiusPixels * 0.72 || across >= planetRadiusPixels) continue;
      const edge = clamp((planetRadiusPixels - across) / Math.max(1, size * 0.012));
      rgba[offset] = 1;
      rgba[offset + 1] = 5;
      rgba[offset + 2] = 7;
      rgba[offset + 3] = clampInt(Math.round(ringAlpha * edge * 178), 0, 178);
    }
  }
  return rgba;
}

async function prepareMoons() {
  const [discoveryHtml, elementsHtml, physicalHtml] = await Promise.all([
    readFile(source("moons/jpl-discovery.html"), "utf8"),
    readFile(source("moons/jpl-elements.html"), "utf8"),
    readFile(source("physical/jpl-physical.html"), "utf8"),
  ]);
  const discoveries = parseDiscoveryRows(discoveryHtml);
  const elements = parseElementRows(elementsHtml);
  const physical = parsePhysicalRows(physicalHtml);
  if (discoveries.length !== 29 || elements.length !== 29 || physical.length !== 5) {
    throw new Error(
      `JPL Uranus moon counts drifted: ${discoveries.length}/${elements.length}/${physical.length}.`,
    );
  }
  const elementsByIdentity = new Map(elements.map((entry) => [identity(entry.satellite), entry]));
  const majors = new Map(["Miranda", "Ariel", "Umbriel", "Titania", "Oberon"].map((name, index) => [name, index]));
  const physicalByIdentity = new Map(physical.map((entry) =>
    [identity(entry.satellite), entry]));
  const majorRadii = [...majors.keys()].map((name) => {
    const match = physicalByIdentity.get(identity(name));
    if (!match) throw new Error(`JPL physical-parameter row is missing for ${name}.`);
    return match.meanRadiusKm;
  });
  const maximumMajorRadius = Math.max(...majorRadii);
  const portraitDiameters = Object.freeze(majorRadii.map((radius) =>
    Math.round(88 * radius / maximumMajorRadius)));
  const atlas = {};
  for (const density of DPR_VALUES) {
    atlas[density] = await prepareMoonAtlas(density, portraitDiameters);
  }
  const detailedSemiMajorAxes = [...majors.keys()].map((name) => {
    const match = elementsByIdentity.get(identity(name));
    if (!match) throw new Error(`JPL mean-elements row is missing for ${name}.`);
    return match.semiMajorAxisKm;
  });
  const detailedMinimum = Math.min(...detailedSemiMajorAxes);
  const detailedMaximum = Math.max(...detailedSemiMajorAxes);
  const catalogMaximum = Math.max(...elements.map(({ semiMajorAxisKm }) =>
    semiMajorAxisKm));
  const records = discoveries.map((discovery) => {
    const displayName = discovery.name || discovery.provisionalDesignation;
    const match = elementsByIdentity.get(identity(displayName)) ||
      elementsByIdentity.get(identity(discovery.provisionalDesignation));
    if (!match) throw new Error(`No JPL mean-elements row matches ${displayName}.`);
    const majorIndex = majors.get(displayName);
    const visualRadius = presentationOrbitRadius(
      match.semiMajorAxisKm,
      detailedMinimum,
      detailedMaximum,
      catalogMaximum,
    );
    const elapsedDays = (
      epochMilliseconds(EPHEMERIS_PRESENTATION_EPOCH) -
      epochMilliseconds(match.epoch)
    ) / 86_400_000;
    const phase = modulo(
      match.meanAnomalyDegrees + elapsedDays / match.periodDays * 360,
      360,
    );
    const phaseDegrees = Number(phase.toFixed(3));
    const visualPeriodSeconds = Number(
      Math.max(18, Math.abs(match.periodDays) * 5).toFixed(2),
    );
    const animationDelaySeconds = Number(
      (-visualPeriodSeconds * phaseDegrees / 360).toFixed(6),
    );
    const meanRadiusKm = majorIndex === undefined
      ? null
      : majorRadii[majorIndex];
    const counterTransform =
      `--uranus-moon-orbit-inclination:${match.inclinationDeg}deg;` +
      `--uranus-moon-orbit-node:${match.nodeDeg}deg;` +
      `animation-duration:${visualPeriodSeconds}s;` +
      `animation-delay:${animationDelaySeconds}s`;
    return Object.freeze({
      id: slug(displayName),
      name: displayName,
      provisionalDesignation: discovery.provisionalDesignation,
      major: majorIndex !== undefined,
      atlasIndex: majorIndex ?? null,
      meanRadiusKm,
      portraitDiameter: majorIndex === undefined
        ? null
        : portraitDiameters[majorIndex],
      semiMajorAxisKm: match.semiMajorAxisKm,
      periodDays: match.periodDays,
      meanAnomalyDegrees: match.meanAnomalyDegrees,
      inclinationDeg: match.inclinationDeg,
      nodeDeg: match.nodeDeg,
      sourceEpoch: match.epoch,
      presentationEpoch: EPHEMERIS_PRESENTATION_EPOCH,
      phaseDegrees,
      phaseQualification:
        "JPL mean anomaly propagated to the fixed presentation epoch using the source mean period",
      x: Number((Math.cos(phase * Math.PI / 180) * visualRadius).toFixed(2)),
      y: Number((Math.sin(phase * Math.PI / 180) * visualRadius * 0.36).toFixed(2)),
      visualRadius: Number(visualRadius.toFixed(2)),
      displayOrbitRadius: Number(visualRadius.toFixed(2)),
      visualPeriodSeconds,
      animationDelaySeconds,
      orbitTransform:
        `transform:rotateY(${-match.inclinationDeg}deg) ` +
          `rotateZ(${-match.nodeDeg}deg);` +
        `animation-duration:${visualPeriodSeconds}s;` +
        `animation-delay:${animationDelaySeconds}s`,
      bodyTransform: `transform:translate3d(${
        Number((visualRadius * 50).toFixed(2))}px,0px,0px)`,
      billboard: Object.freeze({
        model: "prepared-orbit-counter-camera-facing-plane",
        counterTransform,
      }),
      ...(majorIndex === undefined ? {} : {
        label: Object.freeze({
          text: displayName,
          style: `top:${Number((portraitDiameters[majorIndex] / 2 + 8).toFixed(2))}px`,
        }),
        shadow: Object.freeze({
          model: "prepared-source-observed-darkening-alpha-plane",
          leafCount: 1,
        }),
      }),
      guideDiameter: Number((visualRadius * 100).toFixed(2)),
    });
  }).sort((left, right) => left.semiMajorAxisKm - right.semiMajorAxisKm);
  return Object.freeze({ atlas: Object.freeze(atlas), records: Object.freeze(records) });
}

function presentationOrbitRadius(
  kilometers,
  detailedMinimum,
  detailedMaximum,
  catalogMaximum,
) {
  const innerRadius = 650;
  const outerRadius = 1_200;
  const distantRadius = 1_650;
  if (kilometers > detailedMaximum) {
    const progress = (Math.log(kilometers) - Math.log(detailedMaximum)) /
      (Math.log(catalogMaximum) - Math.log(detailedMaximum));
    return outerRadius + progress * (distantRadius - outerRadius);
  }
  const progress = (Math.log(kilometers) - Math.log(detailedMinimum)) /
    (Math.log(detailedMaximum) - Math.log(detailedMinimum));
  return innerRadius + progress * (outerRadius - innerRadius);
}

async function prepareMoonAtlas(density, portraitDiameters) {
  const tile = MOON_TILE * density;
  const sourceImage = source("moons/pia01361-major-moons.jpg");
  const crops = [
    { left: 80, top: 322, width: 142, height: 142 },
    { left: 470, top: 250, width: 300, height: 300 },
    { left: 970, top: 220, width: 370, height: 370 },
    { left: 1475, top: 178, width: 420, height: 420 },
    { left: 2000, top: 177, width: 420, height: 420 },
  ];
  if (!Array.isArray(portraitDiameters) || portraitDiameters.length !== 5) {
    throw new TypeError("Uranus prepared moon portrait diameters are invalid.");
  }
  const atlas = Buffer.alloc(tile * 5 * tile * 2 * 4);
  for (let index = 0; index < crops.length; index += 1) {
    const contentDiameter = portraitDiameters[index] * density;
    const { data } = await sharp(sourceImage)
      .extract(crops[index])
      .resize(contentDiameter, contentDiameter, {
        fit: "contain",
        kernel: sharp.kernel.lanczos3,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const samples = [];
    for (let offset = 0; offset < data.length; offset += 3) {
      const brightness = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      if (brightness > 2) samples.push(brightness);
    }
    samples.sort((left, right) => left - right);
    const brightReference = samples[Math.floor((samples.length - 1) * 0.95)];
    const inset = Math.floor((tile - contentDiameter) / 2);
    for (let y = 0; y < contentDiameter; y += 1) {
      for (let x = 0; x < contentDiameter; x += 1) {
        const sourceOffset = (y * contentDiameter + x) * 3;
        const targetX = index * tile + inset + x;
        const targetY = inset + y;
        const baseOffset = (targetY * tile * 5 + targetX) * 4;
        const shadowOffset = ((tile + targetY) * tile * 5 + targetX) * 4;
        const channels = [
          data[sourceOffset],
          data[sourceOffset + 1],
          data[sourceOffset + 2],
        ];
        const brightness = Math.max(...channels);
        const sourceAlpha = clampInt((brightness - 2) * 32, 0, 255) / 255;
        if (sourceAlpha <= 0) continue;
        const observedDarkening = clamp(1 - brightness / brightReference) * 0.72;
        const maximumLift = Math.max(0, 1 - brightness / 255);
        const shadowFraction = Math.min(observedDarkening, maximumLift, 0.82);
        const shadowAlpha = sourceAlpha * shadowFraction;
        const baseAlpha = (sourceAlpha - shadowAlpha) / (1 - shadowAlpha);
        for (let channel = 0; channel < 3; channel += 1) {
          atlas[baseOffset + channel] = clampInt(
            Math.round(channels[channel] / (1 - shadowFraction)),
            0,
            255,
          );
          atlas[shadowOffset + channel] = 0;
        }
        atlas[baseOffset + 3] = clampInt(Math.round(baseAlpha * 255), 0, 255);
        atlas[shadowOffset + 3] = clampInt(Math.round(shadowAlpha * 255), 0, 255);
      }
    }
  }
  const filename = `uranus-moon-billboards${density === 2 ? "@2x" : ""}.webp`;
  const bytes = await sharp(atlas, {
    raw: { width: tile * 5, height: tile * 2, channels: 4 },
  }).webp({ lossless: true, alphaQuality: 100 }).toBuffer();
  await writeFile(resolve(publicRoot, filename), bytes);
  return asset(filename, bytes, tile * 5, tile * 2);
}

function parseDiscoveryRows(html) {
  const start = html.indexOf("Satellites of  Uranus:");
  const end = html.indexOf("Satellites of  Neptune:", start);
  if (start < 0 || end < 0) throw new Error("JPL Uranus discovery section is missing.");
  return tableRows(html.slice(start, end))
    .filter((cells) => cells.length === 6)
    .map((cells) => Object.freeze({
      romanNumeral: cells[0] || null,
      name: cells[1] || null,
      provisionalDesignation: cells[2] || null,
    }));
}

function parseElementRows(html) {
  const sectionStart = html.indexOf("Satellites of Uranus");
  const sectionEnd = html.indexOf("Satellites of Neptune", sectionStart);
  const section = sectionStart >= 0
    ? html.slice(sectionStart, sectionEnd >= 0 ? sectionEnd : undefined)
    : "";
  const tables = [...section.matchAll(
    /<p[^>]*>[\s\S]*?<b>Epoch:<\/b>\s*([^\n<]+)[\s\S]*?<\/p>[\s\S]*?<table class="sat-elem[^"]*"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gu,
  )].map((match) => Object.freeze({
    epoch: match[1].replace(/\s+/gu, " ").trim(),
    body: match[2],
  }));
  if (tables.length !== 3) throw new Error("JPL Uranus mean-elements tables are missing.");
  const entries = tables.flatMap(({ epoch, body }) => tableRows(body)
    .filter((cells) => cells.length === 12 || cells.length === 15)
    .map((cells) => Object.freeze({
      satellite: cells[0],
      semiMajorAxisKm: numeric(cells[2], "semi-major axis"),
      meanAnomalyDegrees: numeric(cells[5], "mean anomaly"),
      inclinationDeg: numeric(cells[6], "inclination"),
      nodeDeg: modulo(numeric(cells[7], "node"), 360),
      periodDays: numeric(cells[8], "period"),
      epoch,
    })));
  return [...new Map(entries.map((entry) => [identity(entry.satellite), entry])).values()];
}

function parsePhysicalRows(html) {
  const sectionStart = html.indexOf("Satellites of Uranus");
  const sectionEnd = html.indexOf("Satellites of Neptune", sectionStart);
  if (sectionStart < 0 || sectionEnd < 0) {
    throw new Error("JPL Uranus physical-parameter table is missing.");
  }
  return tableRows(html.slice(sectionStart, sectionEnd))
    .filter((cells) => cells.length === 4)
    .map((cells) => Object.freeze({
      satellite: cells[0],
      meanRadiusKm: leadingNumeric(cells[2], "mean radius"),
    }));
}

function tableRows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)].map((row) =>
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((cell) => plainText(cell[1])));
}

function plainText(html) {
  return html.replace(/<br\s*\/?\s*>/giu, " ").replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ").replace(/&amp;/gu, "&").replace(/&#x2F;/gu, "/")
    .replace(/\s+/gu, " ").trim();
}

function numeric(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`JPL Uranus ${field} is invalid: ${value}.`);
  return number;
}

function leadingNumeric(value, field) {
  const match = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)/u.exec(value);
  if (!match) throw new Error(`JPL Uranus ${field} is invalid: ${value}.`);
  return numeric(match[0], field);
}

function paletteColor(palette, value) {
  const amount = clamp(value) * 2;
  const start = amount < 1 ? palette.low : palette.middle;
  const end = amount < 1 ? palette.middle : palette.high;
  const local = amount < 1 ? amount : amount - 1;
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * local));
}

function identity(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function epochMilliseconds(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\.(\d+))?\s+TDB$/u.exec(value);
  if (!match) throw new Error(`JPL Uranus epoch is invalid: ${value}.`);
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ) + fraction * 86_400_000;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
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

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function clampInt(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function asset(filename, bytes, width, height) {
  return Object.freeze({
    filename,
    url: `/scenes/uranus/${filename}`,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width,
    height,
  });
}

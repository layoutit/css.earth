#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

import {
  buildPolyCameraSceneTransform,
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  createPolyCamera,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
} from "@layoutit/polycss";

import { CUBIC_SKY_STANDARD } from
  "../../../platform/cubic-sky-contract.mjs";
import {
  fitProjectiveTextureGeometryToStableLayout,
  prepareProjectiveTextureLayer,
} from
  "../../../platform/projective-surface-raster.mjs";
import { PREPARED_SUN_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { validateSunSourceGroup } from "./source-manifest.mjs";

await validateSunSourceGroup("scene");

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const RADIUS = 248;
const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 512;
const CELL_WIDTH = SOURCE_WIDTH / LONGITUDE_SEGMENTS;
const CELL_HEIGHT = SOURCE_HEIGHT / LATITUDE_SEGMENTS;
const POLAR_CELL = 64;
const POLAR_ATLAS_WIDTH = POLAR_CELL * LONGITUDE_SEGMENTS;
const POLAR_ATLAS_HEIGHT = POLAR_CELL * 3;
const POLAR_BOUNDARY_LATITUDE = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
const POLAR_INNER_LATITUDE = 89 * Math.PI / 180;
const SURFACE_URL = "/scenes/sun/sun-surface-photosphere.webp";
const POLAR_URL = "/scenes/sun/sun-poles-photosphere.webp";
const TILE_SIZE = 50;
const overlap = 0.008;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 2;

const topology = createSpherePolygons(0);
const seamEdges = buildSeamBleedPolygonEdges(topology, {
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
});
const leaves = createSpherePolygons(overlap).map((polygon, index) => {
  const sharedEdges = polygon.polarCap ? null : seamEdges.get(index);
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
    textureLighting: "baked",
    seamBleed: polygon.polarCap ? 0 : 24,
    directionalLight: Object.freeze({
      direction: Object.freeze([0, 0, 1]),
      color: "#ffffff",
      intensity: 0,
    }),
    ambientLight: Object.freeze({ color: "#ffffff", intensity: Math.PI }),
    ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
  });
  const sourceGeometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !sourceGeometry) {
    throw new Error(`Sun texture leaf ${index} did not prepare.`);
  }
  const geometry = fitProjectiveTextureGeometryToStableLayout(sourceGeometry);
  const position = geometry.backgroundPosition.map((value) =>
    value === 0 ? "0px" : formatCssLength(value)).join(" ");
  const size = geometry.backgroundSize.map(formatCssLength).join(" ");
  return Object.freeze({
    tag: "s",
    className: polygon.polarCap
      ? `sun-polar sun-polar-${polygon.polarCap} ` +
        `sun-polar-${polygon.polarPart}`
      : "",
    style: `transform:matrix3d(${geometry.matrix});` +
      `--polycss-atlas-width:${formatCssLength(geometry.leafWidth)};` +
      `--polycss-atlas-height:${formatCssLength(geometry.leafHeight)};` +
      `background-image:url(${geometry.url});` +
      `background-position:${position};background-size:${size}`,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      geometry.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    polarCap: polygon.polarCap ?? null,
    polarPart: polygon.polarPart ?? null,
    longitudeIndex: polygon.longitudeIndex ?? null,
    latitudeIndex: polygon.latitudeIndex,
    leafWidth: geometry.leafWidth,
    leafHeight: geometry.leafHeight,
    projection: geometry.projection,
  });
});

const defaultControlPitchDegrees = 34.230769230769226;
const camera = createPolyCamera({
  target: [0, 0, 0],
  rotX: defaultControlPitchDegrees,
  rotY: CUBIC_SKY_STANDARD.defaultControlYawDegrees,
  zoom: 1.25,
  distance: 0,
});
const prepared = Object.freeze({
  schema: "csssun-prepared-runtime-scene@2",
  runtimeGeometry: false,
  runtimeRasterization: false,
  camera: Object.freeze({
    state: Object.freeze({ ...camera.state }),
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
    minimumControlPitchDegrees: 0,
    maximumControlPitchDegrees: 89,
    defaultControlPitchDegrees,
    defaultControlYawDegrees: CUBIC_SKY_STANDARD.defaultControlYawDegrees,
    materialReferenceControlPitchDegrees: defaultControlPitchDegrees,
    materialReferenceControlYawDegrees:
      CUBIC_SKY_STANDARD.defaultControlYawDegrees,
    initialScenePitchDegrees: 40,
    maximumScenePitchDegrees: 65,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom: 1.25,
    sceneScale: 0.025,
    logicalBodyDiameter: RADIUS * 2,
    cameraModel: "accumulated-matrix3d",
    horizontalOrbit: true,
    pitchBounded: false,
    yawBounded: false,
    responsiveFit: Object.freeze({
      model: "continuous-aspect-smoothstep",
      portraitBaseWidthShare: 0.34,
      narrowPortraitWidthShareGain: 0.08,
      landscapeWidthShareGain: 0.02,
      narrowPortraitAspectRatio: 0.46,
      portraitAspectRatio: 0.75,
      squareAspectRatio: 1,
      maximumHeightShare: 0.61,
      maximumMobilePreviewShare: 0.925,
      minimumZoom: 0.42,
      maximumZoom: 2,
    }),
  }),
  body: Object.freeze({
    leaves: Object.freeze(leaves),
    radius: RADIUS,
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    axialTiltDegrees: 7.25,
    sourceMapSize: Object.freeze([SOURCE_WIDTH, SOURCE_HEIGHT]),
    sourceProjection: "source-backed CR2311 continuum mosaic and Carrington full-surface maps normalized to equal-latitude equirectangular projective leaves",
    continuumPreparation: "daily central-meridian HMI continuum observations blended by Carrington time with source-derived limb normalization",
    polarPreparation: "Saturn-standard retained 32-segment polar band plus one center cap per pole, continued from the measured high-latitude boundary; not a polar observation",
    sourceRotation: 2311,
    sourceTimeRange: "2026-05-12 through 2026-06-09",
  }),
  offLimbContext: Object.freeze({
    defaultUrl: "/scenes/sun/sun-corona-photosphere.webp",
    defaultUrl2x: "/scenes/sun/sun-corona-photosphere@2x.webp",
    logicalSize: 768,
    source: "lens-specific pinned CR2311 Earth-facing SDO observation; transparent for continuum and magnetic lenses",
    composition: "source-disc-registered prepared off-limb pixels behind the retained Carrington sphere",
    rotation: "stationary observed context; never presented as rotating global material",
    runtimeAlphaProcessing: false,
  }),
  limbMaterial: Object.freeze({
    defaultUrl: "/scenes/sun/sun-limb-photosphere.webp",
    defaultUrl2x: "/scenes/sun/sun-limb-photosphere@2x.webp",
    logicalSize: 496,
    composition: "body-registered lens-derived rim and continuum source-derived limb-darkening plate over visible retained leaves",
    surfaceReplacement: false,
    runtimeAlphaProcessing: false,
  }),
  starfield: PREPARED_SUN_STARFIELD,
  animation: Object.freeze({
    rotationVisualSeconds: 72,
    model: "retained-global-carrington-surface-longitude-rotation",
    flatDiscRotation: false,
  }),
  counts: Object.freeze({
    polygonCount: leaves.length,
    textureLeafCount: leaves.length,
    polarLeafCount: leaves.filter(({ polarCap }) => polarCap).length,
  }),
});

await writeFile(
  new URL("../runtime/preparedScene.mjs", import.meta.url),
  "// Generated by tools/prepare-scene.mjs.\n" +
    `export const PREPARED_SUN_SCENE = Object.freeze(${JSON.stringify(prepared)});\n`,
);

function createSpherePolygons(surfaceOverlap) {
  const polygons = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      polygons.push(...createPolarLeaves(
        latitudeIndex === 0 ? "south" : "north",
        surfaceOverlap,
      ));
      continue;
    }
    const latitude0 = -Math.PI / 2 + latitudeIndex / LATITUDE_SEGMENTS * Math.PI;
    const latitude1 = -Math.PI / 2 + (latitudeIndex + 1) / LATITUDE_SEGMENTS * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const latitudeBleed = Math.PI / LATITUDE_SEGMENTS * surfaceOverlap;
      const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(latitude0 - latitudeBleed, longitude0 - longitudeBleed),
          spherePoint(latitude0 - latitudeBleed, longitude1 + longitudeBleed),
          spherePoint(latitude1 + latitudeBleed, longitude1 + longitudeBleed),
          spherePoint(latitude1 + latitudeBleed, longitude0 - longitudeBleed),
        ],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: SURFACE_URL,
        textureImageSource: {
          url: SURFACE_URL,
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * CELL_WIDTH,
            y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * CELL_HEIGHT,
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#f5a623",
      });
    }
  }
  return polygons;
}

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    RADIUS * latitudeRadius * Math.cos(longitude),
    RADIUS * latitudeRadius * Math.sin(longitude),
    RADIUS * Math.sin(latitude),
  ];
}

function createPolarLeaves(pole, surfaceOverlap) {
  const north = pole === "north";
  const latitudeIndex = north ? LATITUDE_SEGMENTS - 1 : 0;
  const latitude0 = north
    ? POLAR_BOUNDARY_LATITUDE
    : -POLAR_INNER_LATITUDE;
  const latitude1 = north
    ? POLAR_INNER_LATITUDE
    : -POLAR_BOUNDARY_LATITUDE;
  const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
  const leaves = Array.from(
    { length: LONGITUDE_SEGMENTS },
    (_, longitudeIndex) => {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 =
        (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      return {
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(latitude0, longitude0 - longitudeBleed),
          spherePoint(latitude0, longitude1 + longitudeBleed),
          spherePoint(latitude1, longitude1 + longitudeBleed),
          spherePoint(latitude1, longitude0 - longitudeBleed),
        ],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: POLAR_URL,
        textureImageSource: {
          url: POLAR_URL,
          width: POLAR_ATLAS_WIDTH,
          height: POLAR_ATLAS_HEIGHT,
          sourceRect: {
            x: longitudeIndex * POLAR_CELL,
            y: north ? 0 : POLAR_CELL,
            width: POLAR_CELL,
            height: POLAR_CELL,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#f5a623",
        polarCap: pole,
        polarPart: "band",
      };
    },
  );
  const sign = north ? 1 : -1;
  const centerRadius = RADIUS * Math.cos(POLAR_INNER_LATITUDE) * 1.05;
  const centerZ = sign * RADIUS * Math.sin(POLAR_INNER_LATITUDE);
  leaves.push({
    latitudeIndex,
    longitudeIndex: null,
    vertices: north
      ? [[-centerRadius, -centerRadius, centerZ],
        [centerRadius, -centerRadius, centerZ],
        [centerRadius, centerRadius, centerZ],
        [-centerRadius, centerRadius, centerZ]]
      : [[-centerRadius, centerRadius, centerZ],
        [centerRadius, centerRadius, centerZ],
        [centerRadius, -centerRadius, centerZ],
        [-centerRadius, -centerRadius, centerZ]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: POLAR_URL,
    textureImageSource: {
      url: POLAR_URL,
      width: POLAR_ATLAS_WIDTH,
      height: POLAR_ATLAS_HEIGHT,
      sourceRect: {
        x: north ? 0 : POLAR_CELL,
        y: POLAR_CELL * 2,
        width: POLAR_CELL,
        height: POLAR_CELL,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#f5a623",
    polarCap: pole,
    polarPart: "center",
  });
  return leaves;
}

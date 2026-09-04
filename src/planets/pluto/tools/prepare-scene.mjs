#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildPolyCameraSceneTransform,
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  createPolyCamera,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
} from "@layoutit/polycss";

import { prepareProjectiveTextureLayer } from
  "../../../platform/projective-surface-raster.mjs";

import { readPlutoFacts } from "./physical-source.mjs";
import { validatePlutoSourceGroup } from "./source-manifest.mjs";

await validatePlutoSourceGroup("scene");
const source = await readPlutoFacts();

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const DISPLAY_RADIUS = 230;
const TILE_SIZE = 50;
const SURFACE_OVERLAP = 0.008;
const POLAR_SURFACE_OVERLAP = 1.035;
const POLAR_INNER_OVERLAP = 1.05;
const POLAR_INNER_INSET = 2.4;
const CAMERA_ZOOM = 1.1;
const CAMERA_PITCH = 40;
const ROTATION_SECONDS = 84;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 2;
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: 0.15,
});
const config = Object.freeze({
  latitudeSegments: LATITUDE_SEGMENTS,
  longitudeSegments: LONGITUDE_SEGMENTS,
  equatorialRadius: DISPLAY_RADIUS,
  polarRadius: DISPLAY_RADIUS,
  texture: Object.freeze({
    one: "/scenes/pluto/pluto-surface.webp",
    two: "/scenes/pluto/pluto-surface@2x.webp",
    width: 1024,
    height: 512,
    presentationCellSize: 32,
  }),
  poles: Object.freeze({
    one: "/scenes/pluto/pluto-surface-poles.webp",
    two: "/scenes/pluto/pluto-surface-poles@2x.webp",
    width: 512,
    height: 128,
  }),
});

const camera = createPolyCamera({
  target: [0, 0, 0],
  rotX: CAMERA_PITCH,
  rotY: 0,
  zoom: CAMERA_ZOOM,
  distance: 0,
});
const bands = prepareSphereBands(config);
const leafCount = bands.reduce((sum, band) => sum + band.leaves.length, 0);
const scene = Object.freeze({
  schema: "csspluto-prepared-retained-scene@1",
  camera: Object.freeze({
    cameraModel: "accumulated-matrix3d",
    minimumControlPitchDegrees: 0,
    maximumControlPitchDegrees: 89,
    defaultControlPitchDegrees: 34.230769230769226,
    defaultControlYawDegrees: 0,
    materialReferenceControlPitchDegrees: 34.230769230769226,
    materialReferenceControlYawDegrees: 0,
    initialScenePitchDegrees: CAMERA_PITCH,
    maximumScenePitchDegrees: 65,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom: CAMERA_ZOOM,
    sceneScale: 0.022,
    logicalBodyDiameter: DISPLAY_RADIUS * 2,
    pitchBounded: false,
    yawBounded: false,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
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
    meanRadiusKm: source.meanRadiusKm,
    meanDensityGPerCm3: source.meanDensityGPerCm3,
    orbitalPeriodYears: source.orbitalPeriodYears,
    displayAxisTiltDegrees: source.displayAxisTiltDegrees,
    displayRadius: DISPLAY_RADIUS,
    rotationSeconds: ROTATION_SECONDS,
    systemTransform: `transform:rotateY(-${source.displayAxisTiltDegrees}deg)`,
    meshTransform: "transform:rotateZ(180deg)",
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    assets: Object.freeze({
      surface: config.texture,
      poles: config.poles,
    }),
    bands,
  }),
  counts: Object.freeze({
    retainedLeafCount: leafCount,
    materialLeafCount: 1,
    retainedSkyboxFaceCount: 6,
    directionalSunLeafCount: 1,
    runtimeGeometryPreparation: false,
    runtimeRasterization: false,
  }),
  qualification: "Source-backed standalone Pluto presentation; no epoch-specific ephemeris or native camera parity is claimed.",
});

await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedScene.mjs"),
  "// Generated from checked Pluto sources. Do not edit by hand.\n" +
    `export const PREPARED_PLUTO_SCENE = ${JSON.stringify(scene)};\n`,
);

function prepareSphereBands(body) {
  const leaves = [
    ...prepareSphereLeaves(body),
    ...preparePolarInnerLeaves(body),
  ];
  return Object.freeze(Array.from(
    { length: body.latitudeSegments },
    (_, latitudeIndex) => Object.freeze({
      latitudeIndex,
      visualRotationSeconds: ROTATION_SECONDS,
      leaves: Object.freeze(leaves
        .filter((entry) => entry.latitudeIndex === latitudeIndex)
        .map((entry) => entry.leaf)),
    }),
  ));
}

function prepareSphereLeaves(body) {
  const polygons = createSpherePolygons(body, SURFACE_OVERLAP);
  const topology = createSpherePolygons(body, 0);
  const seamEdges = buildSeamBleedPolygonEdges(topology, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
  });
  return Object.freeze(polygons.map((polygon, index) => Object.freeze({
    latitudeIndex: polygon.latitudeIndex,
    longitudeIndex: polygon.longitudeIndex,
    polarCap: polygon.polarCap,
    leaf: Object.freeze({
      tag: "s",
      className: polygon.polarCap
        ? `pluto-polar-surface pluto-polar-surface-${polygon.polarCap}`
        : "pluto-surface-leaf",
      ...textureStyle(polygon, index, seamEdges.get(index)),
    }),
  })));
}

function preparePolarInnerLeaves(body) {
  return Object.freeze(["south", "north"].map((pole, index) => {
    const polygon = createPolarCapPolygon(body, pole, "inner");
    return Object.freeze({
      latitudeIndex: polygon.latitudeIndex,
      leaf: Object.freeze({
        tag: "s",
        className: `pluto-polar-inner pluto-polar-inner-${pole}`,
        ...textureStyle(polygon, index, null),
      }),
    });
  }));
}

function createSpherePolygons(body, overlap) {
  const polygons = [];
  for (let latitudeIndex = 0;
    latitudeIndex < body.latitudeSegments;
    latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === body.latitudeSegments - 1) {
      polygons.push(createPolarCapPolygon(
        body,
        latitudeIndex === 0 ? "south" : "north",
      ));
      continue;
    }
    const v0 = latitudeIndex / body.latitudeSegments;
    const v1 = (latitudeIndex + 1) / body.latitudeSegments;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < body.longitudeSegments;
      longitudeIndex += 1) {
      const u0 = longitudeIndex / body.longitudeSegments;
      const u1 = (longitudeIndex + 1) / body.longitudeSegments;
      const latitudeOverlap = Math.PI / body.latitudeSegments * overlap;
      const longitudeOverlap = Math.PI * 2 / body.longitudeSegments * overlap;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = overlap === 0 &&
          longitudeIndex === body.longitudeSegments - 1
        ? 0
        : u1 * Math.PI * 2;
      const sourceWidth = body.texture.width / body.longitudeSegments;
      const sourceHeight = body.texture.height / body.latitudeSegments;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(body, latitude0 - latitudeOverlap, longitude0 - longitudeOverlap),
          spherePoint(body, latitude0 - latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(body, latitude1 + latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(body, latitude1 + latitudeOverlap, longitude0 - longitudeOverlap),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: body.texture.one,
        textureImageSource: {
          url: body.texture.one,
          width: body.texture.width,
          height: body.texture.height,
          sourceRect: {
            x: longitudeIndex * sourceWidth,
            y: (body.latitudeSegments - 1 - latitudeIndex) * sourceHeight,
            width: sourceWidth,
            height: sourceHeight,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#ffffff",
        presentationCellSize: body.texture.presentationCellSize,
      });
    }
  }
  return polygons;
}

function createPolarCapPolygon(body, pole, role = "surface") {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundary = Math.PI / 2 - Math.PI / body.latitudeSegments;
  const inner = role === "inner";
  const radius = body.equatorialRadius * Math.cos(boundary) *
    (inner ? POLAR_INNER_OVERLAP : POLAR_SURFACE_OVERLAP);
  const z = sign * (body.polarRadius * Math.sin(boundary) + 0.1 -
    (inner ? POLAR_INNER_INSET : 0));
  const tileSize = body.poles.height;
  return {
    latitudeIndex: north ? body.latitudeSegments - 1 : 0,
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: body.poles.one,
    textureImageSource: {
      url: body.poles.one,
      width: body.poles.width,
      height: body.poles.height,
      sourceRect: {
        x: (inner ? tileSize * 2 : 0) + (north ? 0 : tileSize),
        y: 0,
        width: tileSize,
        height: tileSize,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#ffffff",
    polarCap: pole,
  };
}

function spherePoint(body, latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    body.equatorialRadius * latitudeRadius * Math.cos(longitude),
    body.equatorialRadius * latitudeRadius * Math.sin(longitude),
    body.polarRadius * Math.sin(latitude),
  ];
}

function textureStyle(polygon, index, seamEdges) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed: 0,
    ...(seamEdges ? { seamEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) throw new Error(`Pluto texture leaf ${index} did not prepare.`);
  const fitted = fitTextureGeometry(
    geometry,
    polygon.presentationCellSize ?? geometry.leafWidth,
    polygon.presentationCellSize ?? geometry.leafHeight,
  );
  return {
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(fitted.leafWidth, fitted.leafHeight) +
      `;background-position:${fitted.backgroundPosition
        .map((value) => value === 0 ? "0px" : formatCssLength(value)).join(" ")}` +
      `;background-size:${fitted.backgroundSize.map(formatCssLength).join(" ")}`,
    ...(!polygon.polarCap ? {
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fitted.matrix,
        PROJECTIVE_TEXTURE_RASTER_SCALE,
      ),
    } : {}),
    sourceRect: fitted.sourceRect,
    leafWidth: fitted.leafWidth,
    leafHeight: fitted.leafHeight,
    projection: fitted.projection,
    lighting: "source",
    lightingOverlay: false,
  };
}

function fitTextureGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Prepared Pluto texture matrix is invalid.");
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

function preparedAtlasDimensions(width, height) {
  return (width === 64 ? "" :
    `;--polycss-atlas-width:${formatCssLength(width)}`) +
    (height === 64 ? "" :
      `;--polycss-atlas-height:${formatCssLength(height)}`);
}

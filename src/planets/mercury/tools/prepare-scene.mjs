#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildPolyCameraSceneTransform,
  buildPolyMeshTransform,
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
} from "@layoutit/polycss";

import { CUBIC_SKY_STANDARD } from "../../../platform/cubic-sky-contract.mjs";
import { viewSunDirectionToPreparedLightDirection } from
  "../../../platform/directional-sun-coordinate.mjs";
import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import { PREPARED_MERCURY_ASSETS } from "../runtime/preparedAssets.mjs";
import { PREPARED_MERCURY_SKY_SUN } from
  "../runtime/preparedSkySun.mjs";
import { PREPARED_MERCURY_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const RADIUS = 230;
const SOURCE_WIDTH = 2048;
const SOURCE_HEIGHT = 1024;
const SOURCE_CELL_WIDTH = SOURCE_WIDTH / LONGITUDE_SEGMENTS;
const SOURCE_CELL_HEIGHT = SOURCE_HEIGHT / LATITUDE_SEGMENTS;
const SURFACE_RASTER_GUTTER = SOURCE_CELL_HEIGHT / 4;
const POLAR_TILE_SIZE = 256;
const SURFACE_OVERLAP = 0.005;
const SURFACE_RASTER_OVERSCAN = 0;
const TILE_SIZE = 50;
const LAYER_ELEVATION = 50;
const SEAM_BLEED = 0;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 4;
const CAMERA_ZOOM = 1.1;
const TARGET_CAMERA_SCENE_PITCH = 40;
const MINIMUM_CONTROL_PITCH = 0;
const MAXIMUM_CONTROL_PITCH = 89;
const MAXIMUM_SCENE_PITCH = 65;
const DEFAULT_CONTROL_PITCH = MAXIMUM_CONTROL_PITCH *
  (1 - TARGET_CAMERA_SCENE_PITCH / MAXIMUM_SCENE_PITCH);
const DEFAULT_CAMERA_SCENE_PITCH = TARGET_CAMERA_SCENE_PITCH;
const DEFAULT_CONTROL_YAW = CUBIC_SKY_STANDARD.defaultControlYawDegrees;
const RESPONSIVE_FIT = Object.freeze({
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
});
const CAMERA_MILLISECONDS_PER_CONTROL_DEGREE = 1_000;
const CAMERA_DURATION_MILLISECONDS =
  (MAXIMUM_CONTROL_PITCH - MINIMUM_CONTROL_PITCH) *
    CAMERA_MILLISECONDS_PER_CONTROL_DEGREE;
const INTERIOR_ASSIST_START_CONTROL_PITCH = 55;
const INTERIOR_ASSIST_MAXIMUM_DEGREES = 32;
const MESH_ROTATION_Z = 118;
const PRESENTATION_ROTATION_SECONDS = 72;
const CUTAWAY_CENTER_LONGITUDE_DEGREES =
  PREPARED_MERCURY_ASSETS.interior.cutaway.centerLongitudeDegrees;
const CUTAWAY_WIDTH_DEGREES =
  PREPARED_MERCURY_ASSETS.interior.cutaway.widthDegrees;
const INTERIOR_LATITUDE_SEGMENTS = 8;
const INTERIOR_LONGITUDE_SEGMENTS = 32;
const INTERIOR_TEXTURE_WIDTH = 1024;
const INTERIOR_TEXTURE_HEIGHT = 512;
const INTERIOR_CELL_WIDTH = INTERIOR_TEXTURE_WIDTH /
  INTERIOR_LONGITUDE_SEGMENTS;
const INTERIOR_CELL_HEIGHT = INTERIOR_TEXTURE_HEIGHT /
  INTERIOR_LATITUDE_SEGMENTS;
const INTERIOR_POLE_TILE_SIZE = 256;
const INTERIOR_POLE_TEXTURE_WIDTH = 512;
const INTERIOR_POLE_TEXTURE_HEIGHT = 256;
const INTERIOR_SECTION_WIDTH = 2048;
const INTERIOR_SECTION_HEIGHT = 2048;
const INTERIOR_SECTION_PRESENTATION_WIDTH = 256;
const INTERIOR_SECTION_PRESENTATION_HEIGHT = 512;
const planOptions = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: LAYER_ELEVATION,
  textureLighting: "baked",
  seamBleed: SEAM_BLEED,
  directionalLight: Object.freeze({
    direction: viewSunDirectionToPreparedLightDirection(
      PREPARED_MERCURY_SKY_SUN.referenceViewDirection,
    ),
    color: "#ffffff",
    intensity: Math.PI,
  }),
  ambientLight: Object.freeze({
    color: "#ffffff",
    intensity: PREPARED_MERCURY_ASSETS.lighting.ambientIntensity * Math.PI,
  }),
});

await validateMercurySourceGroup("scene");

const polygons = createSpherePolygons(SURFACE_OVERLAP);
const seamEdges = buildSeamBleedPolygonEdges(createSpherePolygons(0), {
  tileSize: TILE_SIZE,
  layerElevation: LAYER_ELEVATION,
});
const leaves = polygons.map((polygon, index) => prepareLeaf(
  polygon,
  index,
  seamEdges.get(index),
));
const innerPolarLeaves = ["north", "south"].map((pole, index) => prepareLeaf(
  createPolarCapPolygon(pole, true),
  polygons.length + index,
  null,
));
const cutawayBodyPolygons = Object.freeze([
  ...["south", "north"].map(createCutawayOuterPolarCapPolygon),
  ...polygons.filter((polygon) =>
    !polygon.polar && outsideCutaway(polygon, LONGITUDE_SEGMENTS)),
]);
const cutawayBodyLeaves = Object.freeze([
  ...cutawayBodyPolygons.slice(0, 2).map((polygon, index) => prepareLeaf(
    polygon,
    index,
    null,
  )),
  ...polygons.flatMap((polygon, index) =>
    !polygon.polar && outsideCutaway(polygon, LONGITUDE_SEGMENTS)
      ? [leaves[index]]
      : []),
]);
const corePolygons = createInteriorSpherePolygons(
  RADIUS * PREPARED_MERCURY_ASSETS.interior.metallicCoreRadiusFraction,
  PREPARED_MERCURY_ASSETS.interior.coreUrl,
  PREPARED_MERCURY_ASSETS.interior.corePolesUrl,
);
const cutawayCorePolygons = Object.freeze(corePolygons.filter((polygon) =>
  polygon.polar || outsideCutaway(polygon, INTERIOR_LONGITUDE_SEGMENTS)));
const coreLeaves = Object.freeze(cutawayCorePolygons
  .map((polygon, index) => prepareInteriorLeaf(
    polygon,
    index,
    polygon.polar
      ? `mercury-interior-core-leaf mercury-interior-pole ` +
        `mercury-interior-pole-${polygon.polar}`
      : "mercury-interior-core-leaf",
  )));
const sectionLeaves = Object.freeze([
  -CUTAWAY_WIDTH_DEGREES / 2 + CUTAWAY_CENTER_LONGITUDE_DEGREES,
  CUTAWAY_WIDTH_DEGREES / 2 + CUTAWAY_CENTER_LONGITUDE_DEGREES,
].map((longitudeDegrees, index) => prepareInteriorSectionLeaf(
  longitudeDegrees,
  index,
)));
const defaultFrame = PREPARED_MERCURY_ASSETS.lighting.defaultFrame;
const scene = Object.freeze({
  schema: "cssmercury-prepared-retained-scene@3",
  camera: Object.freeze({
    state: Object.freeze({
      target: Object.freeze([0, 0, 0]),
      rotX: DEFAULT_CONTROL_PITCH,
      rotY: DEFAULT_CONTROL_YAW,
      zoom: CAMERA_ZOOM,
      distance: 0,
    }),
    minimumControlPitchDegrees: MINIMUM_CONTROL_PITCH,
    maximumControlPitchDegrees: MAXIMUM_CONTROL_PITCH,
    defaultControlPitchDegrees: DEFAULT_CONTROL_PITCH,
    defaultControlYawDegrees: DEFAULT_CONTROL_YAW,
    initialScenePitchDegrees: TARGET_CAMERA_SCENE_PITCH,
    maximumScenePitchDegrees: MAXIMUM_SCENE_PITCH,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom: CAMERA_ZOOM,
    logicalBodyDiameter: RADIUS * 2,
    responsiveFit: RESPONSIVE_FIT,
    sceneScale: CAMERA_ZOOM / TILE_SIZE,
    horizontalOrbit: true,
    pitchBounded: false,
    yawBounded: false,
    cameraModel: "accumulated-matrix3d",
    defaultTransform: buildPolyCameraSceneTransform({
      target: [0, 0, 0],
      rotX: DEFAULT_CAMERA_SCENE_PITCH,
      rotY: DEFAULT_CONTROL_YAW,
      zoom: CAMERA_ZOOM,
      distance: 0,
    }),
    runtimeGeometryDerivation: false,
  }),
  systemTransform: buildPolyMeshTransform({ rotation: [2, 0, -20] }),
  meshRotationDegrees: MESH_ROTATION_Z,
  bodyTransform: buildPolyMeshTransform({ rotation: [0, 0, MESH_ROTATION_Z] }),
  bodyLeaves: Object.freeze([...leaves, ...innerPolarLeaves]),
  preparedSurface: Object.freeze({
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    radius: RADIUS,
    bodyFaceCount: leaves.filter(({ polar }) => !polar).length,
    polarLeafCount: leaves.filter(({ polar }) => polar).length + innerPolarLeaves.length,
    sourceWidth: SOURCE_WIDTH,
    sourceHeight: SOURCE_HEIGHT,
    retainedSourceLongitudes: LONGITUDE_SEGMENTS,
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed: SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: SURFACE_RASTER_GUTTER,
      rasterOverscan: SURFACE_RASTER_OVERSCAN,
      runtimeEdgeDiscovery: false,
    }),
  }),
  material: Object.freeze({
    schema: "cssmercury-prepared-material-presentation@2",
    frameCount: PREPARED_MERCURY_ASSETS.lighting.frameCount,
    logicalDiameter: RADIUS * 2,
    defaultFrame,
    runtimeLighting: false,
  }),
  starfield: Object.freeze({
    ...PREPARED_MERCURY_STARFIELD,
    cameraContract: "inverse-unbounded-accumulated-matrix3d",
  }),
  interior: Object.freeze({
    ...PREPARED_MERCURY_ASSETS.interior,
    schema: "cssmercury-prepared-cutaway@1",
    presentation: "retained-three-dimensional-source-dimensioned-cutaway",
    cutaway: Object.freeze({
      centerLongitudeDegrees: CUTAWAY_CENTER_LONGITUDE_DEGREES,
      widthDegrees: CUTAWAY_WIDTH_DEGREES,
      removedLongitudeCount: polygons.filter((polygon) =>
        !polygon.polar && !outsideCutaway(polygon, LONGITUDE_SEGMENTS)).length /
          (LATITUDE_SEGMENTS - 2),
      removedCoreLongitudeCount: corePolygons.filter((polygon) =>
        !polygon.polar &&
        !outsideCutaway(polygon, INTERIOR_LONGITUDE_SEGMENTS)).length /
          (INTERIOR_LATITUDE_SEGMENTS - 2),
    }),
    coreLatitudeSegments: INTERIOR_LATITUDE_SEGMENTS,
    coreLongitudeSegments: INTERIOR_LONGITUDE_SEGMENTS,
    bodyTransform: buildPolyMeshTransform({ rotation: [0, 0, MESH_ROTATION_Z] }),
    outerBodyLeaves: cutawayBodyLeaves,
    coreLeaves,
    sectionLeaves,
    leafCount: cutawayBodyLeaves.length + coreLeaves.length + sectionLeaves.length,
    runtimeGeometry: false,
    runtimeRasterization: false,
    cameraCoupling: "same-retained-scene-and-unbounded-accumulated-matrix3d-camera-as-exterior",
    presentationOrbit: Object.freeze({
      schema: "cssmercury-prepared-interior-presentation-orbit@1",
      durationMilliseconds: CAMERA_DURATION_MILLISECONDS,
      millisecondsPerControlDegree: CAMERA_MILLISECONDS_PER_CONTROL_DEGREE,
      assistStartsAtControlPitchDegrees: INTERIOR_ASSIST_START_CONTROL_PITCH,
      maximumAssistDegrees: INTERIOR_ASSIST_MAXIMUM_DEGREES,
      keyframes: Object.freeze([
        Object.freeze({ transform: "rotateX(0deg)", offset: 0 }),
        Object.freeze({
          transform: "rotateX(0deg)",
          offset: INTERIOR_ASSIST_START_CONTROL_PITCH /
            MAXIMUM_CONTROL_PITCH,
        }),
        Object.freeze({
          transform: `rotateX(${INTERIOR_ASSIST_MAXIMUM_DEGREES}deg)`,
          offset: 1,
        }),
      ]),
      model: "presentation-only-pole-on-cutaway-legibility-assist",
      changesPhysicalAxialTiltClaim: false,
      runtimeTransformConstruction: false,
    }),
  }),
  motion: Object.freeze({
    visualRotationSeconds: PRESENTATION_ROTATION_SECONDS,
    physicalSiderealRotationEarthDays: 58.646,
    speedStates: Object.freeze({
      normal: 1,
      fast: 2,
      fastest: 4,
      superfast: 8,
      off: 0,
    }),
  }),
  counts: Object.freeze({
    bodyLeafCount: leaves.length + innerPolarLeaves.length,
    interiorLeafCount: cutawayBodyLeaves.length + coreLeaves.length +
      sectionLeaves.length,
    textureLeafCount: leaves.length + innerPolarLeaves.length + 1 +
      cutawayBodyLeaves.length + coreLeaves.length + sectionLeaves.length,
    retainedRootCount: 4,
    starfieldFaceCount: PREPARED_MERCURY_STARFIELD.faces.length,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
  }),
});

await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedScene.mjs"),
  "// Generated by tools/prepare-scene.mjs. Do not edit by hand.\n" +
    `export const PREPARED_MERCURY_SCENE = Object.freeze(${JSON.stringify(scene)});\n`,
);
console.log(`Prepared Mercury retained scene with ${scene.counts.bodyLeafCount} body leaves.`);

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    RADIUS * latitudeRadius * Math.cos(longitude),
    RADIUS * latitudeRadius * Math.sin(longitude),
    RADIUS * Math.sin(latitude),
  ];
}

function spherePointAtRadius(radius, latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    radius * latitudeRadius * Math.cos(longitude),
    radius * latitudeRadius * Math.sin(longitude),
    radius * Math.sin(latitude),
  ];
}

function createSpherePolygons(overlap) {
  const output = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      output.push(createPolarCapPolygon(
        latitudeIndex === 0 ? "south" : "north",
        false,
      ));
      continue;
    }
    const v0 = latitudeIndex / LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const u0 = longitudeIndex / LONGITUDE_SEGMENTS;
      const u1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS;
      const latitudeOverlap = Math.PI / LATITUDE_SEGMENTS * overlap;
      const longitudeOverlap = Math.PI * 2 / LONGITUDE_SEGMENTS * overlap;
      const surfaceLatitude0 = latitude0 - latitudeOverlap;
      const surfaceLatitude1 = latitude1 + latitudeOverlap;
      const surfaceLongitude0 = u0 * Math.PI * 2 - longitudeOverlap;
      const surfaceLongitude1 = overlap === 0 &&
          longitudeIndex === LONGITUDE_SEGMENTS - 1
        ? 0
        : u1 * Math.PI * 2 + longitudeOverlap;
      output.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(surfaceLatitude0, surfaceLongitude0),
          spherePoint(surfaceLatitude0, surfaceLongitude1),
          spherePoint(surfaceLatitude1, surfaceLongitude1),
          spherePoint(surfaceLatitude1, surfaceLongitude0),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: "/scenes/mercury/mercury-surface-normal.webp",
        textureImageSource: {
          url: "/scenes/mercury/mercury-surface-normal.webp",
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * SOURCE_CELL_WIDTH,
            y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * SOURCE_CELL_HEIGHT,
            width: SOURCE_CELL_WIDTH,
            height: SOURCE_CELL_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#aaa097",
      });
    }
  }
  return output;
}

function createInteriorSpherePolygons(radius, texture, poleTexture) {
  const output = [];
  for (let latitudeIndex = 0;
    latitudeIndex < INTERIOR_LATITUDE_SEGMENTS;
    latitudeIndex += 1) {
    if (latitudeIndex === 0 ||
        latitudeIndex === INTERIOR_LATITUDE_SEGMENTS - 1) {
      output.push(createInteriorPolarCapPolygon(
        latitudeIndex === 0 ? "south" : "north",
        radius,
        poleTexture,
      ));
      continue;
    }
    const v0 = latitudeIndex / INTERIOR_LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / INTERIOR_LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < INTERIOR_LONGITUDE_SEGMENTS;
      longitudeIndex += 1) {
      const u0 = longitudeIndex / INTERIOR_LONGITUDE_SEGMENTS;
      const u1 = (longitudeIndex + 1) / INTERIOR_LONGITUDE_SEGMENTS;
      output.push({
        latitudeIndex,
        longitudeIndex,
          vertices: [
          spherePointAtRadius(
            radius,
            latitude0,
            u0 * Math.PI * 2,
          ),
          spherePointAtRadius(
            radius,
            latitude0,
            u1 * Math.PI * 2,
          ),
          spherePointAtRadius(
            radius,
            latitude1,
            u1 * Math.PI * 2,
          ),
          spherePointAtRadius(
            radius,
            latitude1,
            u0 * Math.PI * 2,
          ),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture,
        textureImageSource: {
          url: texture,
          width: INTERIOR_TEXTURE_WIDTH,
          height: INTERIOR_TEXTURE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * INTERIOR_CELL_WIDTH,
            y: (INTERIOR_LATITUDE_SEGMENTS - 1 - latitudeIndex) *
              INTERIOR_CELL_HEIGHT,
            width: INTERIOR_CELL_WIDTH,
            height: INTERIOR_CELL_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#8f5d3d",
      });
    }
  }
  return output;
}

function createInteriorPolarCapPolygon(pole, radius, texture) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 -
    Math.PI / INTERIOR_LATITUDE_SEGMENTS;
  const boundaryRadius = radius * Math.cos(boundaryLatitude) * 1.025;
  const z = sign * (radius * Math.sin(boundaryLatitude) + 0.05);
  const vertices = north
    ? [[-boundaryRadius, -boundaryRadius, z], [boundaryRadius, -boundaryRadius, z],
      [boundaryRadius, boundaryRadius, z], [-boundaryRadius, boundaryRadius, z]]
    : [[-boundaryRadius, boundaryRadius, z], [boundaryRadius, boundaryRadius, z],
      [boundaryRadius, -boundaryRadius, z], [-boundaryRadius, -boundaryRadius, z]];
  return {
    latitudeIndex: north ? INTERIOR_LATITUDE_SEGMENTS - 1 : 0,
    polar: pole,
    vertices,
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture,
    textureImageSource: {
      url: texture,
      width: INTERIOR_POLE_TEXTURE_WIDTH,
      height: INTERIOR_POLE_TEXTURE_HEIGHT,
      sourceRect: {
        x: north ? 0 : INTERIOR_POLE_TILE_SIZE,
        y: 0,
        width: INTERIOR_POLE_TILE_SIZE,
        height: INTERIOR_POLE_TILE_SIZE,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#8f5d3d",
  };
}

function outsideCutaway(polygon, longitudeSegments) {
  if (polygon.polar) return true;
  const centerLongitudeDegrees = (polygon.longitudeIndex + 0.5) *
    360 / longitudeSegments;
  return !interiorLongitudeRemoved(centerLongitudeDegrees);
}

function createCutawayOuterPolarCapPolygon(pole) {
  const polygon = createPolarCapPolygon(pole, false);
  return {
    ...polygon,
    className: `mercury-polar mercury-cutaway-outer-pole ` +
      `mercury-cutaway-outer-pole-${pole}`,
    texture: PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
    textureImageSource: {
      url: PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
      width: INTERIOR_POLE_TEXTURE_WIDTH,
      height: INTERIOR_POLE_TEXTURE_HEIGHT,
      sourceRect: {
        x: pole === "north" ? 0 : INTERIOR_POLE_TILE_SIZE,
        y: 0,
        width: INTERIOR_POLE_TILE_SIZE,
        height: INTERIOR_POLE_TILE_SIZE,
      },
    },
  };
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function interiorLongitudeRemoved(longitudeDegrees) {
  return Math.abs(normalizeDegrees(
    longitudeDegrees - CUTAWAY_CENTER_LONGITUDE_DEGREES,
  )) <= CUTAWAY_WIDTH_DEGREES / 2;
}

function createPolarCapPolygon(pole, inner) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
  const boundaryRadius = RADIUS * Math.cos(boundaryLatitude);
  const capRadius = boundaryRadius * (inner ? 1.05 : 1.035);
  const z = sign * (RADIUS * Math.sin(boundaryLatitude) +
    (inner ? -2.4 : 0.1));
  const vertices = north
    ? [[-capRadius, -capRadius, z], [capRadius, -capRadius, z],
      [capRadius, capRadius, z], [-capRadius, capRadius, z]]
    : [[-capRadius, capRadius, z], [capRadius, capRadius, z],
      [capRadius, -capRadius, z], [-capRadius, -capRadius, z]];
  const uvs = north
    ? [[0, 0], [1, 0], [1, 1], [0, 1]]
    : [[0, 1], [1, 1], [1, 0], [0, 0]];
  const sourceX = (north ? 0 : 1) * POLAR_TILE_SIZE;
  return {
    latitudeIndex: north ? LATITUDE_SEGMENTS - 1 : 0,
    polar: pole,
    inner,
    vertices,
    uvs,
    texture: "/scenes/mercury/mercury-poles.webp",
    textureImageSource: {
      url: "/scenes/mercury/mercury-poles.webp",
      width: POLAR_TILE_SIZE * 6,
      height: POLAR_TILE_SIZE,
      sourceRect: {
        x: sourceX,
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
    color: "#aaa097",
  };
}

function prepareLeaf(polygon, index, sharedEdges) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...planOptions,
    seamBleed: polygon.polar ? 0 : SEAM_BLEED,
    ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) throw new Error(`Mercury texture leaf ${index} did not prepare.`);
  const sourceFitted = fitGeometry(
    geometry,
    polygon.polar ? POLAR_TILE_SIZE : SOURCE_CELL_WIDTH,
    polygon.polar ? POLAR_TILE_SIZE : SOURCE_CELL_HEIGHT,
  );
  const fitted = polygon.polar
    ? sourceFitted
    : fitProjectiveTextureGeometryToStableLayout(sourceFitted);
  const rasterPresentation = polygon.polar
    ? fitted
    : createProjectiveSurfaceRasterPresentation({
      sourceWidth: SOURCE_WIDTH,
      sourceHeight: SOURCE_HEIGHT,
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
    });
  const backgroundPosition = rasterPresentation.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value))
    .join(" ");
  const backgroundSize = rasterPresentation.backgroundSize
    .map(formatCssLength).join(" ");
  const variable = polygon.polar
    ? `--mercury-pole-position:${backgroundPosition};`
    : `--mercury-surface-position:${backgroundPosition};`;
  return Object.freeze({
    tag: "s",
    className: polygon.className ?? (polygon.polar
      ? `mercury-polar mercury-polar-${polygon.polar}${polygon.inner ? " mercury-polar-inner" : ""}`
      : ""),
    style: `transform:matrix3d(${fitted.matrix});${variable}` +
      `background-position:var(${polygon.polar ? "--mercury-pole-position" : "--mercury-surface-position"});` +
      `background-size:${backgroundSize};` +
      `--polycss-atlas-width:${fitted.leafWidth}px;` +
      `--polycss-atlas-height:${fitted.leafHeight}px`,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fitted.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    polar: polygon.polar ?? null,
  });
}

function prepareInteriorLeaf(polygon, index, className) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...planOptions,
    seamBleed: polygon.polar ? 0 : 8,
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) {
    throw new Error(`Mercury interior leaf ${index} did not prepare.`);
  }
  const sourceFitted = fitGeometry(
    geometry,
    polygon.polar ? INTERIOR_POLE_TILE_SIZE : INTERIOR_CELL_WIDTH,
    polygon.polar ? INTERIOR_POLE_TILE_SIZE : INTERIOR_CELL_HEIGHT,
  );
  const fitted = polygon.polar
    ? sourceFitted
    : fitProjectiveTextureGeometryToStableLayout(sourceFitted);
  return Object.freeze({
    tag: "s",
    className,
    style: `transform:matrix3d(${fitted.matrix});` +
      `background-position:${fitted.backgroundPosition.map(formatCssLength).join(" ")};` +
      `background-size:${fitted.backgroundSize.map(formatCssLength).join(" ")};` +
      `--polycss-atlas-width:${fitted.leafWidth}px;` +
      `--polycss-atlas-height:${fitted.leafHeight}px`,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fitted.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    polar: polygon.polar ?? null,
  });
}

function prepareInteriorSectionLeaf(longitudeDegrees, index) {
  const longitude = longitudeDegrees * Math.PI / 180;
  const radial = [Math.cos(longitude), Math.sin(longitude), 0];
  const polygon = {
    vertices: [
      [0, 0, -RADIUS],
      [radial[0] * RADIUS, radial[1] * RADIUS, -RADIUS],
      [radial[0] * RADIUS, radial[1] * RADIUS, RADIUS],
      [0, 0, RADIUS],
    ],
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: PREPARED_MERCURY_ASSETS.interior.sectionUrl,
    textureImageSource: {
      url: PREPARED_MERCURY_ASSETS.interior.sectionUrl,
      width: INTERIOR_SECTION_WIDTH,
      height: INTERIOR_SECTION_HEIGHT,
      sourceRect: {
        x: index * INTERIOR_SECTION_WIDTH / 2,
        y: 0,
        width: INTERIOR_SECTION_WIDTH / 2,
        height: INTERIOR_SECTION_HEIGHT,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#8f5d3d",
  };
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...planOptions,
    seamBleed: 0,
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) {
    throw new Error(`Mercury interior section ${index} did not prepare.`);
  }
  const fitted = fitGeometry(
    geometry,
    INTERIOR_SECTION_PRESENTATION_WIDTH,
    INTERIOR_SECTION_PRESENTATION_HEIGHT,
  );
  return Object.freeze({
    tag: "s",
    className: "mercury-interior-section-leaf",
    style: `transform:matrix3d(${fitted.matrix});` +
      `background-position:${fitted.backgroundPosition.map(formatCssLength).join(" ")};` +
      `background-size:${fitted.backgroundSize.map(formatCssLength).join(" ")};` +
      `--polycss-atlas-width:${fitted.leafWidth}px;` +
      `--polycss-atlas-height:${fitted.leafHeight}px;` +
      "backface-visibility:visible",
    longitudeDegrees,
  });
}

function fitGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Mercury texture matrix is invalid.");
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

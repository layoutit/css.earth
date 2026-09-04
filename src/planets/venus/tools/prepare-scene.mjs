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

import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import { PREPARED_VENUS_STARFIELD } from
  "../runtime/preparedStarfield.mjs";
import {
  deriveVenusPreparedMaterial,
  readVenusAtmosphereSource,
} from "./atmosphere-source.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";
import {
  SUN_INITIAL_VIEW_DIRECTION,
  VENUS_DEFAULT_CONTROL_YAW_DEGREES,
} from "./sun-presentation.mjs";

await validateVenusSourceGroup("scene");
const atmosphereSource = await readVenusAtmosphereSource();
const materialModel = deriveVenusPreparedMaterial(atmosphereSource);

const LATITUDE_SEGMENTS = 16;
const LONGITUDE_SEGMENTS = 32;
const RADIUS = 248;
const POLAR_RADIUS = RADIUS;
const SOURCE_WIDTH = 1024;
const SOURCE_LATITUDE_HEIGHT = 512;
const SOURCE_BAND_GUTTER = SOURCE_LATITUDE_HEIGHT / LATITUDE_SEGMENTS / 4;
const SOURCE_BAND_STRIDE = SOURCE_LATITUDE_HEIGHT / LATITUDE_SEGMENTS +
  SOURCE_BAND_GUTTER * 2;
const SOURCE_HEIGHT = SOURCE_BAND_STRIDE * LATITUDE_SEGMENTS;
const SOURCE_CELL_WIDTH = SOURCE_WIDTH / LONGITUDE_SEGMENTS;
const SOURCE_CELL_HEIGHT = SOURCE_LATITUDE_HEIGHT / LATITUDE_SEGMENTS;
const SURFACE_RASTER_OVERSCAN = 0;
const POLAR_TILE = 256;
const SURFACE_URL = "/scenes/venus/venus-clouds.webp";
const POLAR_URL = "/scenes/venus/venus-poles-clouds.webp";
const TILE_SIZE = 50;
const SURFACE_OVERLAP = 0.008;
const SURFACE_SEAM_BLEED = 0;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 2;
const MATERIAL_LOGICAL_SIZE = 512;
const MATERIAL_TILE_SIZE = 256;
const MATERIAL_DIRECTIONAL_FRAME_COUNT = 31;
const MATERIAL_FRAME_COUNT = 32;
const MATERIAL_FRAME_COLUMNS = 8;
const MATERIAL_FRAME_ROWS = 4;
const MATERIAL_MINIMUM_LIGHT_VIEW_Z = -0.98;
const MATERIAL_MAXIMUM_LIGHT_VIEW_Z = 0.98;
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: 0.15,
  directionalLight: Object.freeze({
    direction: SUN_INITIAL_VIEW_DIRECTION,
    color: "#fff1df",
    intensity: Math.PI,
  }),
  ambientLight: Object.freeze({
    color: "#fff1df",
    intensity: 0.16 * Math.PI,
  }),
});

const topology = createSpherePolygons(0);
const seamEdges = buildSeamBleedPolygonEdges(topology, {
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
});
const polygons = createSpherePolygons(SURFACE_OVERLAP);
const leaves = polygons.map((polygon, index) => {
  const sharedEdges = seamEdges.get(index);
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed: polygon.polarCap ? 0 : SURFACE_SEAM_BLEED,
    ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !geometry) {
    throw new Error(`Venus texture leaf ${index} did not prepare.`);
  }
  const fittedGeometry = polygon.polarCap
    ? geometry
    : fitProjectiveTextureGeometryToStableLayout(geometry);
  const rasterPresentation = polygon.polarCap
    ? fittedGeometry
    : createProjectiveSurfaceRasterPresentation({
      sourceWidth: SOURCE_WIDTH,
      sourceHeight: SOURCE_LATITUDE_HEIGHT,
      sourceRect: polygon.surfaceSourceRect,
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fittedGeometry.backgroundPosition,
      backgroundSize: fittedGeometry.backgroundSize,
      leafWidth: fittedGeometry.leafWidth,
      leafHeight: fittedGeometry.leafHeight,
      bandCount: LATITUDE_SEGMENTS,
      gutter: SOURCE_BAND_GUTTER,
      overscan: SURFACE_RASTER_OVERSCAN,
    });
  const position = rasterPresentation.backgroundPosition.map((value) =>
    value === 0 ? "0px" : formatCssLength(value)).join(" ");
  const size = rasterPresentation.backgroundSize.map(formatCssLength).join(" ");
  const dimensions =
    `--polycss-atlas-width:${formatCssLength(fittedGeometry.leafWidth)};` +
    `--polycss-atlas-height:${formatCssLength(fittedGeometry.leafHeight)}`;
  return Object.freeze({
    tag: "s",
    className: polygon.polarCap ? `venus-polar venus-polar-${polygon.polarCap}` : "",
    style: `transform:matrix3d(${fittedGeometry.matrix});${dimensions};` +
      `background-image:url(${fittedGeometry.url});` +
      `background-position:${position};background-size:${size}`,
    ...(!polygon.polarCap ? {
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fittedGeometry.matrix,
        PROJECTIVE_TEXTURE_RASTER_SCALE,
      ),
    } : {}),
    polarCap: polygon.polarCap ?? null,
    longitudeIndex: polygon.longitudeIndex ?? null,
    latitudeIndex: polygon.latitudeIndex,
  });
});

const initialScenePitchDegrees = 40;
const maximumScenePitchDegrees = 65;
const maximumControlPitchDegrees = 89;
const defaultControlPitchDegrees = maximumControlPitchDegrees *
  (1 - initialScenePitchDegrees / maximumScenePitchDegrees);
const defaultZoom = 1.9;
const responsiveFit = Object.freeze({
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
const materialFramePositions = Object.freeze(Array.from(
  { length: MATERIAL_FRAME_COUNT },
  (_, frame) => {
    const column = frame % MATERIAL_FRAME_COLUMNS;
    const row = Math.floor(frame / MATERIAL_FRAME_COLUMNS);
    return `${-column * MATERIAL_LOGICAL_SIZE}px ${-row * MATERIAL_LOGICAL_SIZE}px`;
  },
));
const defaultMaterialFrame = MATERIAL_FRAME_COUNT - 1;
const camera = createPolyCamera({
  target: [0, 0, 0],
  rotX: initialScenePitchDegrees,
  rotY: VENUS_DEFAULT_CONTROL_YAW_DEGREES,
  zoom: defaultZoom,
  distance: 0,
});
const prepared = Object.freeze({
  schema: "cssvenus-prepared-runtime-scene@1",
  runtimeGeometry: false,
  runtimeRasterization: false,
  camera: Object.freeze({
    state: Object.freeze({ ...camera.state }),
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
    minimumControlPitchDegrees: 0,
    maximumControlPitchDegrees,
    defaultControlPitchDegrees,
    defaultControlYawDegrees: VENUS_DEFAULT_CONTROL_YAW_DEGREES,
    initialScenePitchDegrees,
    maximumScenePitchDegrees,
    minimumZoom: 0.42,
    maximumZoom: 4,
    defaultZoom,
    logicalBodyDiameter: RADIUS * 2,
    responsiveFit,
    horizontalOrbit: true,
    pitchBounded: false,
    yawBounded: false,
    cameraModel: "accumulated-matrix3d",
  }),
  body: Object.freeze({
    leaves: Object.freeze(leaves),
    equatorialRadius: RADIUS,
    polarRadius: POLAR_RADIUS,
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    axialTiltDegrees: 3,
    rotationDirection: "retrograde",
    rotationPeriodEarthDays: 243,
    sourceMapSize: Object.freeze([SOURCE_WIDTH, SOURCE_HEIGHT]),
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed: SURFACE_SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: SOURCE_BAND_GUTTER,
      rasterOverscan: SURFACE_RASTER_OVERSCAN,
      runtimeEdgeDiscovery: false,
    }),
  }),
  material: Object.freeze({
    schema: "cssvenus-prepared-view-material@1",
    model: "source-parameter-bound-light-terminator-and-atmosphere-phase-bank",
    materialUrl: "/scenes/venus/venus-material.webp",
    material2xUrl: "/scenes/venus/venus-material@2x.webp",
    observationMaterialUrl:
      "/scenes/venus/venus-observation-material.webp",
    observationMaterial2xUrl:
      "/scenes/venus/venus-observation-material@2x.webp",
    lightingUrl: "/scenes/venus/venus-lighting.webp",
    lighting2xUrl: "/scenes/venus/venus-lighting@2x.webp",
    logicalSize: MATERIAL_LOGICAL_SIZE,
    tileSize: MATERIAL_TILE_SIZE,
    directionalFrameCount: MATERIAL_DIRECTIONAL_FRAME_COUNT,
    frameCount: MATERIAL_FRAME_COUNT,
    frameColumns: MATERIAL_FRAME_COLUMNS,
    frameRows: MATERIAL_FRAME_ROWS,
    minimumLightViewZ: MATERIAL_MINIMUM_LIGHT_VIEW_Z,
    maximumLightViewZ: MATERIAL_MAXIMUM_LIGHT_VIEW_Z,
    baseLightAzimuthDegrees: 180,
    defaultFrame: defaultMaterialFrame,
    backgroundSize: `${MATERIAL_FRAME_COLUMNS * MATERIAL_LOGICAL_SIZE}px ` +
      `${MATERIAL_FRAME_ROWS * MATERIAL_LOGICAL_SIZE}px`,
    backgroundPositions: materialFramePositions,
    atmosphereHeightKm: atmosphereSource.atmosphereHeightKm,
    sourceRadiusKm: atmosphereSource.planetRadiusKm,
    outerRadiusScale: materialModel.outerRadiusScale,
    presentationScale: 1.002,
    materialScale: 0.992,
    silhouetteCoverage: Object.freeze({
      model: "prepared-analytic-sphere-proportional-overscan",
      coverageScale: 1.002,
      materialScale: 0.992,
      rimFill: "prepared-radial-binary-clamp-to-material-limb",
      runtime: false,
    }),
    observationMaterial: Object.freeze({
      model: "prepared-surface-lighting-with-physical-exterior-atmosphere-limb",
      surfaceAtmosphereOpacity: 0,
      exteriorAtmosphereMaximumKm: atmosphereSource.atmosphereHeightKm,
      runtimeOpacity: false,
      runtimeRasterization: false,
    }),
    atmosphereColor: materialModel.color,
    atmosphereMaximumAlpha: materialModel.maximumAlpha,
    atmosphereLimbExponent: materialModel.limbExponent,
    atmosphereNightFloor: materialModel.nightFloor,
    sourceParameters: atmosphereSource,
    lightingModel: Object.freeze({
      directionalLight: Object.freeze({
        ...PLAN_OPTIONS.directionalLight,
        direction: SUN_INITIAL_VIEW_DIRECTION,
      }),
      ambientFromGroundReflectance: Math.sqrt(
        atmosphereSource.averageGroundReflectance,
      ),
      terminatorSmoothstep: Object.freeze([-0.18, 0.08]),
      surfaceResponse: Object.freeze({
        model: "prepared-directional-shadow-with-dedicated-flood-frame",
        colorOverlay: false,
        textureExposureShoulder: Object.freeze([1.4, 2.2, 0.9]),
        directionalShadowRelease: 0,
        shadowlessFloodShadowRelease: 0.3,
        shadowReleaseSmoothstep: Object.freeze([0.45, 0.92]),
      }),
      presentationPhaseRemap: Object.freeze({
        model: "continuous-crescent-rotation-plateau",
        lowerTransition: Object.freeze([-0.92, -0.85]),
        plateau: Object.freeze([-0.85, -0.65]),
        plateauViewZ: -0.79,
        upperTransition: Object.freeze([-0.65, -0.5]),
      }),
      interpolation: "nearest-prepared-phase-with-runtime-css-roll",
    }),
    runtimeLightingMath: false,
    runtimeRasterization: false,
  }),
  starfield: PREPARED_VENUS_STARFIELD,
  animation: Object.freeze({
    cloudsVisualSeconds: 36,
    surfaceVisualSeconds: 96,
    direction: "retrograde",
  }),
  counts: Object.freeze({
    polygonCount: leaves.length,
    textureLeafCount: leaves.length,
    polarLeafCount: leaves.filter(({ polarCap }) => polarCap).length,
    starfieldFaceCount: PREPARED_VENUS_STARFIELD.faces.length,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
  }),
});
await writeFile(
  new URL("../runtime/preparedScene.mjs", import.meta.url),
  "// Generated by tools/prepare-scene.mjs.\n" +
    `export const PREPARED_VENUS_SCENE = Object.freeze(${JSON.stringify(prepared)});\n`,
);

function createSpherePolygons(overlap) {
  const polygons = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      polygons.push(createPolarCap(latitudeIndex === 0 ? "south" : "north"));
      continue;
    }
    const v0 = latitudeIndex / LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const latitudeOverlap = Math.PI / LATITUDE_SEGMENTS * overlap;
      const longitudeOverlap = Math.PI * 2 / LONGITUDE_SEGMENTS * overlap;
      const surfaceLatitude0 = latitude0 - latitudeOverlap;
      const surfaceLatitude1 = latitude1 + latitudeOverlap;
      const surfaceLongitude0 = longitude0 - longitudeOverlap;
      const surfaceLongitude1 = overlap === 0 && longitudeIndex === LONGITUDE_SEGMENTS - 1
        ? 0
        : longitude1 + longitudeOverlap;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(surfaceLatitude0, surfaceLongitude0),
          spherePoint(surfaceLatitude0, surfaceLongitude1),
          spherePoint(surfaceLatitude1, surfaceLongitude1),
          spherePoint(surfaceLatitude1, surfaceLongitude0),
        ],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: SURFACE_URL,
        surfaceSourceRect: {
          x: longitudeIndex * SOURCE_CELL_WIDTH,
          y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * SOURCE_CELL_HEIGHT,
          width: SOURCE_CELL_WIDTH,
          height: SOURCE_CELL_HEIGHT,
        },
        textureImageSource: {
          url: SURFACE_URL,
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * SOURCE_CELL_WIDTH,
            y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * SOURCE_BAND_STRIDE +
              SOURCE_BAND_GUTTER,
            width: SOURCE_CELL_WIDTH,
            height: SOURCE_CELL_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#d6aa69",
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
    POLAR_RADIUS * Math.sin(latitude),
  ];
}

function createPolarCap(pole) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
  const radius = RADIUS * Math.cos(boundaryLatitude) * 1.035;
  const z = sign * (POLAR_RADIUS * Math.sin(boundaryLatitude) + 0.1);
  return {
    latitudeIndex: north ? LATITUDE_SEGMENTS - 1 : 0,
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z], [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z], [radius, -radius, z], [-radius, -radius, z]],
    uvs: north ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: POLAR_URL,
    textureImageSource: {
      url: POLAR_URL,
      width: POLAR_TILE * 2,
      height: POLAR_TILE,
      sourceRect: {
        x: north ? 0 : POLAR_TILE,
        y: 0,
        width: POLAR_TILE,
        height: POLAR_TILE,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: "#d6aa69",
    polarCap: pole,
  };
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function rotateX(vector, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    vector[0],
    vector[1] * cosine - vector[2] * sine,
    vector[1] * sine + vector[2] * cosine,
  ];
}

function rotateY(vector, degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    vector[0] * cosine + vector[2] * sine,
    vector[1],
    -vector[0] * sine + vector[2] * cosine,
  ];
}

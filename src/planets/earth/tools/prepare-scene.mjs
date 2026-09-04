#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPolyCameraSceneTransform,
  buildPolyMeshTransform,
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  createPolyCamera,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
  worldPositionToCss,
} from "@layoutit/polycss";
import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";
import {
  EARTH_MATERIAL_FRAMES_PER_SHARD,
  EARTH_MATERIAL_PRESENTATION_SIZE,
  EARTH_MATERIAL_TILE_SIZE,
  readEarthAtmosphereModel,
} from "./atmosphere-model.mjs";
import { validateEarthSourceGroup } from "./source-manifest.mjs";

const [EARTH_ATMOSPHERE_MODEL] = await Promise.all([
  readEarthAtmosphereModel(),
  validateEarthSourceGroup("scene"),
  validateEarthSourceGroup("interior"),
]);

const interiorSource = await readFile(
  resolve(import.meta.dirname, "../source/interior/earth-interior.json"),
  "utf8",
).then(JSON.parse);
if (interiorSource.schema !== "cssearth-earth-interior-source@1") {
  throw new Error("Earth interior source is incompatible.");
}

const BODY_LATITUDE_SEGMENTS = 16;
const BODY_LONGITUDE_SEGMENTS = 32;
const EQUATORIAL_RADIUS = 230;
const POLAR_RADIUS = EQUATORIAL_RADIUS * 6356.752 / 6378.137;
const TILE_SIZE = 50;
const SEAM_BLEED = 0.15;
const PLANET_SEAM_BLEED = 0;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 16.25;
const INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE = 4;
const SURFACE_OVERLAP = 0.008;
const POLAR_CAP_BAND_SPAN = 1;
const SURFACE_RASTER_OVERSCAN = 64 * SURFACE_OVERLAP;
const POLAR_SURFACE_OVERLAP = 1.035;
const POLAR_INNER_OVERLAP = 1.05;
const POLAR_INNER_INSET = 2.4;
const EARTH_OBLIQUITY_DEGREES = 23.4;
const EARTH_PRESENTATION_NODE_DEGREES = -60;
const MESH_ROTATION_Z = 128;
const CAMERA_ZOOM = 1.1;
const CAMERA_MAXIMUM_ZOOM = 8;
const CAMERA_SCENE_PITCH_DEGREES = 40;
const CAMERA_MINIMUM_CONTROL_PITCH_DEGREES = 0;
const CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES = 89;
const CAMERA_DEFAULT_CONTROL_PITCH_DEGREES = 34.230769230769226;
const CAMERA_MILLISECONDS_PER_CONTROL_DEGREE = 1_000;
const CAMERA_DURATION_MILLISECONDS =
  CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES *
  CAMERA_MILLISECONDS_PER_CONTROL_DEGREE;
const INTERIOR_REFERENCE_CONTROL_YAW_DEGREES = -105;
const INTERIOR_LATITUDE_SEGMENTS = 8;
const INTERIOR_LONGITUDE_SEGMENTS = 16;
const INTERIOR_CUTAWAY = Object.freeze({
  centerLongitudeDegrees: -56.25,
  widthDegrees: 112.5,
  qualification: interiorSource.qualification,
});
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked",
  seamBleed: SEAM_BLEED,
});

const bodyConfig = Object.freeze({
  id: "surface",
  latitudeSegments: BODY_LATITUDE_SEGMENTS,
  longitudeSegments: BODY_LONGITUDE_SEGMENTS,
  equatorialRadius: EQUATORIAL_RADIUS,
  polarRadius: POLAR_RADIUS,
  includePolarInner: false,
  polarCapBandSpan: POLAR_CAP_BAND_SPAN,
  texture: Object.freeze({
    url: "/scenes/earth/earth-surface.webp",
    width: 2880,
    height: 1440,
    presentationCellSize: 64,
    raster: Object.freeze({
      width: 2048,
      height: 1024,
      bandCount: BODY_LATITUDE_SEGMENTS,
      gutter: 16,
      overscan: SURFACE_RASTER_OVERSCAN,
    }),
  }),
  poles: Object.freeze({
    url: "/scenes/earth/earth-surface-poles.webp",
    width: 1024,
    height: 256,
  }),
  surfaceClassName: "earth-surface-leaf",
  polarClassName: "earth-polar-surface",
  polarInnerClassName: "earth-polar-inner",
});

const camera = createPolyCamera({
  target: [0, 0, 0],
  rotX: CAMERA_SCENE_PITCH_DEGREES,
  rotY: 0,
  zoom: CAMERA_ZOOM,
  distance: 0,
});
const meshTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, MESH_ROTATION_Z],
})}`;
const systemTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, EARTH_PRESENTATION_NODE_DEGREES],
})} ${buildPolyMeshTransform({
  rotation: [EARTH_OBLIQUITY_DEGREES, 0, 0],
})}`;
const bodyBands = prepareSphereBands(bodyConfig, 72);
const lightingMaterial = prepareMaterialBank({
  id: "lighting",
  className: "earth-lighting-material",
  physicalRadius: EQUATORIAL_RADIUS * 1.035,
  depthBias: 1.3,
  supportsShadowless: true,
});
const atmosphereMaterial = prepareMaterialBank({
  id: "atmosphere",
  className: "earth-atmosphere-material",
  physicalRadius:
    EQUATORIAL_RADIUS * EARTH_ATMOSPHERE_MODEL.outerRadiusRatio,
  depthBias: 1.5,
  source: EARTH_ATMOSPHERE_MODEL,
});
const interior = prepareInteriorPlan();
const surfaceLeafCount = countLeaves(bodyBands);

const scene = Object.freeze({
  schema: "cssearth-prepared-retained-scene@6",
  camera: Object.freeze({
    state: camera.state,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
    minimumPitchDegrees: CAMERA_MINIMUM_CONTROL_PITCH_DEGREES,
    defaultPitchDegrees: CAMERA_DEFAULT_CONTROL_PITCH_DEGREES,
    maximumPitchDegrees: CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES,
    defaultScenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
    minimumZoom: 0.42,
    defaultZoom: CAMERA_ZOOM,
    maximumZoom: CAMERA_MAXIMUM_ZOOM,
    sceneScale: 0.02,
    orbitPlayback: Object.freeze({
      schema: "cssearth-prepared-camera-orbit@1",
      minimumControlPitchDegrees: CAMERA_MINIMUM_CONTROL_PITCH_DEGREES,
      maximumControlPitchDegrees: CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES,
      durationMilliseconds: CAMERA_DURATION_MILLISECONDS,
      millisecondsPerControlDegree: CAMERA_MILLISECONDS_PER_CONTROL_DEGREE,
      keyframes: Object.freeze([
        Object.freeze({
          transform: buildPolyCameraSceneTransform({
            target: [0, 0, 0],
            rotX: 65,
            rotY: 0,
            zoom: CAMERA_ZOOM,
            distance: 0,
          }),
        }),
        Object.freeze({
          transform: buildPolyCameraSceneTransform({
            target: [0, 0, 0],
            rotX: 0,
            rotY: 0,
            zoom: CAMERA_ZOOM,
            distance: 0,
          }),
        }),
      ]),
      runtimeTransport: "paused-waapi-current-time-only",
      runtimeTransformConstruction: false,
    }),
  }),
  earth: Object.freeze({
    equatorialRadiusKm: 6378.137,
    polarRadiusKm: 6356.752,
    obliquityDegrees: EARTH_OBLIQUITY_DEGREES,
    surfaceRotationSeconds: 72,
    presentationNodeDegrees: EARTH_PRESENTATION_NODE_DEGREES,
    meshRotationDegrees: MESH_ROTATION_Z,
    systemTransform,
    meshTransform,
    faceRetention: "complete-source-longitudes-browser-backface-culling",
  }),
  body: Object.freeze({
    latitudeSegments: BODY_LATITUDE_SEGMENTS,
    longitudeSegments: BODY_LONGITUDE_SEGMENTS,
    polarCapBandSpan: POLAR_CAP_BAND_SPAN,
    assets: Object.freeze({
      surface: bodyConfig.texture,
      poles: bodyConfig.poles,
    }),
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap",
      seamBleed: PLANET_SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: bodyConfig.texture.raster.gutter,
      rasterOverscan: bodyConfig.texture.raster.overscan,
      runtimeEdgeDiscovery: false,
    }),
    bands: bodyBands,
  }),
  material: Object.freeze({
    transform: meshTransform,
    lighting: lightingMaterial,
    atmosphere: atmosphereMaterial,
  }),
  interior,
  assets: Object.freeze({
    starfield: "/scenes/earth/earth-starfield.webp",
  }),
  counts: Object.freeze({
    surfaceLeafCount,
    cloudLeafCount: 0,
    lightingLeafCount: 1,
    atmosphereLeafCount: 1,
    directionalSunLeafCount: 1,
    interiorLeafCount: interior.leafCount,
    retainedLeafCount: surfaceLeafCount + 3,
    maximumRetainedLeafCount: surfaceLeafCount + 3 + interior.leafCount,
    runtimeGeometryPreparation: false,
    runtimeRasterization: false,
  }),
});

await writeFile(
  resolve(import.meta.dirname, "../runtime/preparedScene.mjs"),
  "// Generated from checked Earth sources. Do not edit by hand.\n" +
    `export const PREPARED_EARTH_SCENE = ${JSON.stringify(scene)};\n`,
);

function prepareSphereBands(config, visualRotationSeconds) {
  const leaves = [
    ...prepareSphereLeaves(config),
    ...(config.includePolarInner === false
      ? []
      : preparePolarInnerLeaves(config)),
  ];
  return Object.freeze(Array.from(
    { length: config.latitudeSegments },
    (_, latitudeIndex) => Object.freeze({
      latitudeIndex,
      visualRotationSeconds,
      leaves: Object.freeze(leaves
        .filter((entry) => entry.latitudeIndex === latitudeIndex)
        .map((entry) => entry.leaf)),
    }),
  ));
}

function prepareSphereLeaves(config) {
  const polygons = createSpherePolygons(
    config,
    config.surfaceOverlap ?? SURFACE_OVERLAP,
  );
  const topology = createSpherePolygons(config, 0);
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
        ? `${config.polarClassName} ${config.polarClassName}-${polygon.polarCap}`
        : config.surfaceClassName,
      ...textureStyle(
        polygon,
        index,
        seamEdges.get(index),
        polygon.polarCap
          ? 0
          : config.textureSeamBleed ?? PLANET_SEAM_BLEED,
      ),
    }),
  })));
}

function preparePolarInnerLeaves(config) {
  return Object.freeze(["south", "north"].map((pole, index) => {
    const polygon = createPolarCapPolygon(config, pole, "inner");
    return Object.freeze({
      latitudeIndex: polygon.latitudeIndex,
      polarCap: pole,
      polarInner: true,
      leaf: Object.freeze({
        tag: "s",
        className: `${config.polarInnerClassName} ${config.polarInnerClassName}-${pole}`,
        ...textureStyle(polygon, index, null, 0),
      }),
    });
  }));
}

function createSpherePolygons(config, surfaceOverlap) {
  const polygons = [];
  const polarCapBandSpan = config.polarCapBandSpan ?? 1;
  for (let latitudeIndex = 0;
    latitudeIndex < config.latitudeSegments;
    latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === config.latitudeSegments - 1) {
      polygons.push(createPolarCapPolygon(
        config,
        latitudeIndex === 0 ? "south" : "north",
      ));
      continue;
    }
    if (latitudeIndex < polarCapBandSpan ||
        latitudeIndex >= config.latitudeSegments - polarCapBandSpan) {
      continue;
    }
    const v0 = latitudeIndex / config.latitudeSegments;
    const v1 = (latitudeIndex + 1) / config.latitudeSegments;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < config.longitudeSegments;
      longitudeIndex += 1) {
      const u0 = longitudeIndex / config.longitudeSegments;
      const u1 = (longitudeIndex + 1) / config.longitudeSegments;
      const latitudeOverlap = Math.PI / config.latitudeSegments * surfaceOverlap;
      const longitudeOverlap = Math.PI * 2 / config.longitudeSegments *
        surfaceOverlap;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = surfaceOverlap === 0 &&
          longitudeIndex === config.longitudeSegments - 1
        ? 0
        : u1 * Math.PI * 2;
      const sourceWidth = config.texture.width / config.longitudeSegments;
      const sourceHeight = config.texture.height / config.latitudeSegments;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(config, latitude0 - latitudeOverlap, longitude0 - longitudeOverlap),
          spherePoint(config, latitude0 - latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(config, latitude1 + latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(config, latitude1 + latitudeOverlap, longitude0 - longitudeOverlap),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: config.texture.url ?? config.texture.one,
        ...(config.texture.raster ? {
          surfaceRaster: config.texture.raster,
          surfaceSourceRect: {
            x: longitudeIndex * (
              config.texture.raster.width / config.longitudeSegments
            ),
            y: (config.latitudeSegments - 1 - latitudeIndex) * (
              config.texture.raster.height / config.latitudeSegments
            ),
            width: config.texture.raster.width / config.longitudeSegments,
            height: config.texture.raster.height / config.latitudeSegments,
          },
        } : {}),
        textureImageSource: {
          url: config.texture.url ?? config.texture.one,
          width: config.texture.width,
          height: config.texture.height,
          sourceRect: {
            x: longitudeIndex * sourceWidth,
            y: (config.latitudeSegments - 1 - latitudeIndex) * sourceHeight,
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
        presentationCellSize: config.texture.presentationCellSize,
      });
    }
  }
  return polygons;
}

function createPolarCapPolygon(config, pole, role = "surface") {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI /
    config.latitudeSegments * (config.polarCapBandSpan ?? 1);
  const inner = role === "inner";
  const radius = config.equatorialRadius * Math.cos(boundaryLatitude) *
    (inner
      ? POLAR_INNER_OVERLAP
      : config.polarSurfaceOverlap ?? POLAR_SURFACE_OVERLAP);
  const z = sign * (
    config.polarRadius * Math.sin(boundaryLatitude) + 0.1 -
      (inner ? POLAR_INNER_INSET : 0)
  );
  const tileSize = config.poles.height;
  return {
    latitudeIndex: north ? config.latitudeSegments - 1 : 0,
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: config.poles.url ?? config.poles.one,
    textureImageSource: {
      url: config.poles.url ?? config.poles.one,
      width: config.poles.width,
      height: config.poles.height,
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

function spherePoint(config, latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    config.equatorialRadius * latitudeRadius * Math.cos(longitude),
    config.equatorialRadius * latitudeRadius * Math.sin(longitude),
    config.polarRadius * Math.sin(latitude),
  ];
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function interiorLongitudeRemoved(longitudeDegrees) {
  return Math.abs(normalizeDegrees(
    longitudeDegrees - INTERIOR_CUTAWAY.centerLongitudeDegrees,
  )) <= INTERIOR_CUTAWAY.widthDegrees / 2;
}

function prepareInteriorPlan() {
  const outerEntries = prepareSphereLeaves({
    ...bodyConfig,
    polarCapBandSpan: 1,
    poles: Object.freeze({
      ...bodyConfig.poles,
      width: 512,
      height: 128,
    }),
  }).filter((entry) => {
    if (Number.isSafeInteger(entry.longitudeIndex)) {
      return !interiorLongitudeRemoved(
        (entry.longitudeIndex + 0.5) * 360 / BODY_LONGITUDE_SEGMENTS,
      );
    }
    return entry.polarCap;
  }).map((entry) => Object.freeze({
    ...entry,
    leaf: Object.freeze({
      ...entry.leaf,
      ...(entry.polarCap ? {
        className: `earth-interior-outer-polar earth-interior-outer-polar-${entry.polarCap}`,
        asset: Object.freeze({
          one: "/scenes/earth/earth-interior-outer-poles.webp",
          two: "/scenes/earth/earth-interior-outer-poles@2x.webp",
        }),
      } : {}),
    }),
  }));
  const outerBodyBands = groupPreparedEntries(
    outerEntries,
    BODY_LATITUDE_SEGMENTS,
    72,
  );
  const shellLayers = interiorSource.layers.slice(1);
  const shells = Object.freeze(shellLayers.map((layer, index) => {
    const radiusScale = layer.outerRadiusKm / interiorSource.earthRadiusKm;
    const cutaway = index < shellLayers.length - 1;
    const id = layer.id;
    const config = Object.freeze({
      latitudeSegments: INTERIOR_LATITUDE_SEGMENTS,
      longitudeSegments: INTERIOR_LONGITUDE_SEGMENTS,
      equatorialRadius: EQUATORIAL_RADIUS * radiusScale,
      polarRadius: POLAR_RADIUS * radiusScale,
      texture: Object.freeze({
        one: `/scenes/earth/earth-interior-${id}.webp`,
        two: `/scenes/earth/earth-interior-${id}@2x.webp`,
        width: 1024,
        height: 512,
        presentationCellSize: 32,
      }),
      poles: Object.freeze({
        one: `/scenes/earth/earth-interior-${id}-poles.webp`,
        two: `/scenes/earth/earth-interior-${id}-poles@2x.webp`,
        width: 512,
        height: 128,
      }),
      surfaceClassName: `earth-interior-${id}-leaf`,
      polarClassName: `earth-interior-${id}-polar`,
      polarInnerClassName: `earth-interior-${id}-polar-inner`,
      includePolarInner: false,
      surfaceOverlap: 0,
      textureSeamBleed: 0,
    });
    const leaves = prepareSphereLeaves(config).filter((entry) =>
      !cutaway || !Number.isSafeInteger(entry.longitudeIndex) ||
        !interiorLongitudeRemoved(
          (entry.longitudeIndex + 0.5) *
            360 / INTERIOR_LONGITUDE_SEGMENTS,
        )).map(({ leaf, polarCap }) => Object.freeze({
          ...leaf,
          asset: polarCap ? config.poles : config.texture,
        }));
    return Object.freeze({
      id,
      label: layer.label,
      radiusScale,
      cutaway,
      className: `earth-interior-shell-${id}`,
      leaves: Object.freeze(leaves),
    });
  }));
  const sectionLeaves = prepareInteriorSectionLeaves();
  const leafCount = countLeaves(outerBodyBands) +
    shells.reduce((count, shell) => count + shell.leaves.length, 0) +
    sectionLeaves.length;
  return Object.freeze({
    schema: "cssearth-prepared-cutaway@2",
    qualification: INTERIOR_CUTAWAY.qualification,
    source: Object.freeze({
      sourceUrl: interiorSource.sourceUrl,
      sourceId: interiorSource.sourceId,
      earthRadiusKm: interiorSource.earthRadiusKm,
      layers: Object.freeze(interiorSource.layers.map((layer) =>
        Object.freeze({ ...layer }))),
    }),
    cutaway: INTERIOR_CUTAWAY,
    outerBodyBands,
    outerAssets: Object.freeze({
      surface: Object.freeze({
        one: "/scenes/earth/earth-interior-outer.webp",
        two: "/scenes/earth/earth-interior-outer@2x.webp",
      }),
      poles: Object.freeze({
        one: "/scenes/earth/earth-interior-outer-poles.webp",
        two: "/scenes/earth/earth-interior-outer-poles@2x.webp",
      }),
    }),
    shells,
    sectionLeaves,
    leafCount,
    presentationLock: Object.freeze({
      schema: "cssearth-prepared-interior-presentation-lock@1",
      referenceControlPitchDegrees: CAMERA_DEFAULT_CONTROL_PITCH_DEGREES,
      referenceControlYawDegrees: INTERIOR_REFERENCE_CONTROL_YAW_DEGREES,
      transform:
        `transform:rotateY(${INTERIOR_REFERENCE_CONTROL_YAW_DEGREES}deg)`,
      model: "prepared-view-locked-cutaway-legibility-presentation",
      changesPhysicalAxialTiltClaim: false,
      runtimeTransformConstruction: false,
    }),
    runtimeGeometry: false,
    runtimeRasterization: false,
  });
}

function groupPreparedEntries(entries, latitudeSegments,
  visualRotationSeconds) {
  return Object.freeze(Array.from({ length: latitudeSegments },
    (_, latitudeIndex) => Object.freeze({
      latitudeIndex,
      visualRotationSeconds,
      leaves: Object.freeze(entries.filter((entry) =>
        entry.latitudeIndex === latitudeIndex).map(({ leaf }) => leaf)),
    })));
}

function prepareInteriorSectionLeaves() {
  const asset = Object.freeze({
    one: "/scenes/earth/earth-interior-section.webp",
    two: "/scenes/earth/earth-interior-section@2x.webp",
    width: 1024,
    height: 512,
  });
  return Object.freeze([
    INTERIOR_CUTAWAY.centerLongitudeDegrees -
      INTERIOR_CUTAWAY.widthDegrees / 2,
    INTERIOR_CUTAWAY.centerLongitudeDegrees +
      INTERIOR_CUTAWAY.widthDegrees / 2,
  ].map((longitudeDegrees, faceIndex) => {
    const longitude = longitudeDegrees * Math.PI / 180;
    const direction = [Math.cos(longitude), Math.sin(longitude)];
    const polygon = {
      vertices: [
        [0, 0, -POLAR_RADIUS],
        [direction[0] * EQUATORIAL_RADIUS,
          direction[1] * EQUATORIAL_RADIUS, -POLAR_RADIUS],
        [direction[0] * EQUATORIAL_RADIUS,
          direction[1] * EQUATORIAL_RADIUS, POLAR_RADIUS],
        [0, 0, POLAR_RADIUS],
      ],
      uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
      texture: asset.one,
      textureImageSource: {
        url: asset.one,
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
      presentationCellSize: 256,
    };
    return Object.freeze({
      tag: "s",
      className: "earth-interior-section-face",
      ...textureStyle(polygon, faceIndex, null, 0),
      asset,
      backfaceVisible: true,
    });
  }));
}

function textureStyle(polygon, index, seamEdges, seamBleed) {
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
  if (!geometry) throw new Error(`Earth texture leaf ${index} did not prepare.`);
  const sourceFitted = polygon.presentationCellSize
    ? fitTextureGeometry(
      geometry,
      polygon.presentationCellSize,
      polygon.presentationCellSize,
    )
    : geometry;
  const fitted = polygon.surfaceRaster
    ? fitProjectiveTextureGeometryToStableLayout(sourceFitted)
    : sourceFitted;
  const rasterPresentation = polygon.surfaceRaster
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: polygon.surfaceRaster.width,
      sourceHeight: polygon.surfaceRaster.height,
      sourceRect: polygon.surfaceSourceRect,
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fitted.backgroundPosition,
      backgroundSize: fitted.backgroundSize,
      leafWidth: fitted.leafWidth,
      leafHeight: fitted.leafHeight,
      bandCount: polygon.surfaceRaster.bandCount,
      gutter: polygon.surfaceRaster.gutter,
      overscan: polygon.surfaceRaster.overscan,
    })
    : fitted;
  const backgroundPosition = rasterPresentation.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value)).join(" ");
  const backgroundSize = rasterPresentation.backgroundSize
    .map(formatCssLength).join(" ");
  return {
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(fitted.leafWidth, fitted.leafHeight) +
      `;background-position:${backgroundPosition}` +
      `;background-size:${backgroundSize}`,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fitted.matrix,
      polygon.surfaceRaster
        ? PROJECTIVE_TEXTURE_RASTER_SCALE
        : INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
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
    throw new Error("Prepared Earth texture matrix is invalid.");
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

function prepareMaterialBank({
  id,
  className,
  physicalRadius,
  depthBias,
  source = null,
  supportsShadowless = false,
}) {
  const frameCount = 128;
  const columns = Math.sqrt(EARTH_MATERIAL_FRAMES_PER_SHARD);
  const rows = columns;
  const shardCount = frameCount / EARTH_MATERIAL_FRAMES_PER_SHARD;
  if (!Number.isInteger(columns) || !Number.isInteger(shardCount)) {
    throw new Error("Earth material shards require a square frame layout.");
  }
  const sourceTileSize = EARTH_MATERIAL_TILE_SIZE;
  const presentationTileSize = EARTH_MATERIAL_PRESENTATION_SIZE;
  const gutter = 2;
  const stride = sourceTileSize + gutter * 2;
  const shardWidth = stride * columns;
  const shardHeight = stride * rows;
  const presentationScale = presentationTileSize / sourceTileSize;
  const defaultFrame = Math.round((65 - CAMERA_SCENE_PITCH_DEGREES) /
    65 * (frameCount - 1));
  const frames = Object.freeze(Array.from({ length: frameCount },
    (_, frameIndex) => {
      const rowIndex = Math.floor(
        frameIndex / EARTH_MATERIAL_FRAMES_PER_SHARD,
      );
      const frameOffset = frameIndex % EARTH_MATERIAL_FRAMES_PER_SHARD;
      const columnIndex = frameOffset % columns;
      const tileRowIndex = Math.floor(frameOffset / columns);
      const scenePitchDegrees = 65 - frameIndex /
        (frameCount - 1) * 65;
      return Object.freeze({
        frameIndex,
        rowIndex,
        columnIndex,
        tileRowIndex,
        scenePitchDegrees,
        assets: materialAssetPair(
          id,
          `row-${String(rowIndex).padStart(2, "0")}`,
        ),
        backgroundPosition:
          `${-(columnIndex * stride + gutter) * presentationScale}px ` +
          `${-(tileRowIndex * stride + gutter) * presentationScale}px`,
        backgroundSize:
          `${shardWidth * presentationScale}px ` +
          `${shardHeight * presentationScale}px`,
        transform: prepareScreenMaterialPlane({
          scenePitchDegrees,
          outputSize: presentationTileSize,
          contentRadius: presentationTileSize * 0.468,
          physicalRadius,
          depthBias,
          className,
        }).transform,
      });
    }));
  const preparedRows = Object.freeze(Array.from({ length: shardCount },
    (_, rowIndex) => Object.freeze({
      rowIndex,
      assets: materialAssetPair(
        id,
        `row-${String(rowIndex).padStart(2, "0")}`,
      ),
      width: Object.freeze({ one: shardWidth, two: shardWidth * 2 }),
      height: Object.freeze({ one: shardHeight, two: shardHeight * 2 }),
      decodedRgbaBytes: Object.freeze({
        one: shardWidth * shardHeight * 4,
        two: shardWidth * shardHeight * 16,
      }),
      firstFrame: rowIndex * EARTH_MATERIAL_FRAMES_PER_SHARD,
      frameCount: EARTH_MATERIAL_FRAMES_PER_SHARD,
    })));
  const defaultRow = Math.floor(
    defaultFrame / EARTH_MATERIAL_FRAMES_PER_SHARD,
  );
  const initialFrame = frameCount - 1;
  const initialRow = Math.floor(
    initialFrame / EARTH_MATERIAL_FRAMES_PER_SHARD,
  );
  const initialWarmRows = Object.freeze([initialRow]);
  const transformKeyframes = frames.map(({ transform }, frameIndex) =>
    Object.freeze({
      transform,
      offset: frameIndex / (frameCount - 1),
    }));
  const defaultOffset = CAMERA_DEFAULT_CONTROL_PITCH_DEGREES /
    CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES;
  transformKeyframes.push(Object.freeze({
    transform: prepareScreenMaterialPlane({
      scenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
      outputSize: presentationTileSize,
      contentRadius: presentationTileSize * 0.468,
      physicalRadius,
      depthBias,
      className,
    }).transform,
    offset: defaultOffset,
  }));
  transformKeyframes.sort((left, right) => left.offset - right.offset);
  const defaultPlane = prepareScreenMaterialPlane({
    scenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
    outputSize: presentationTileSize,
    contentRadius: presentationTileSize * 0.468,
    physicalRadius,
    depthBias,
    className,
  });
  return Object.freeze({
    id,
    model: source
      ? "prepared-openspace-atmosphere-with-google-directional-response-bank"
      : "prepared-fixed-world-view-bank-bounded-square-shards",
    source,
    frameCount,
    columns,
    rows,
    framesPerShard: EARTH_MATERIAL_FRAMES_PER_SHARD,
    shardCount,
    preparedRows,
    planetRadius: EQUATORIAL_RADIUS,
    physicalRadius,
    sourceTileSize,
    presentationTileSize,
    gutter,
    stride,
    shardWidth,
    shardHeight,
    defaultFrame,
    defaultRow,
    defaultAssets: materialAssetPair(id, "default"),
    ...(supportsShadowless ? {
      shadowlessAssets: materialAssetPair(id, "shadowless"),
    } : {}),
    defaultScenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
    defaultPresentation: Object.freeze({
      transform: defaultPlane.transform,
      assets: materialAssetPair(id, "default"),
      backgroundPosition: "0px 0px",
      backgroundSize:
        `${presentationTileSize}px ${presentationTileSize}px`,
    }),
    ...(supportsShadowless ? {
      shadowlessPresentation: Object.freeze({
        assets: materialAssetPair(id, "shadowless"),
        backgroundPosition: "0px 0px",
        backgroundSize:
          `${presentationTileSize}px ${presentationTileSize}px`,
      }),
    } : {}),
    frames,
    transformPlayback: Object.freeze({
      schema: "cssearth-prepared-material-transform@1",
      durationMilliseconds: CAMERA_DURATION_MILLISECONDS,
      millisecondsPerControlDegree: CAMERA_MILLISECONDS_PER_CONTROL_DEGREE,
      keyframes: Object.freeze(transformKeyframes),
      runtimeTransport: "paused-waapi-current-time-only",
      runtimeTransformConstruction: false,
    }),
    leaf: Object.freeze({
      tag: "s",
      className,
      style: defaultPlane.style +
        `;background-image:url(/scenes/earth/earth-${id}-default.webp)` +
        `;background-size:${presentationTileSize}px ${presentationTileSize}px`,
    }),
    transport: Object.freeze({
      model: "row-shard-cache",
      defaultRow: initialRow,
      initialWarmRows,
      maximumRetainedRowCount: 3,
      framesPerShard: EARTH_MATERIAL_FRAMES_PER_SHARD,
      shardCount,
      retainLastReadyPresentation: true,
      addressWritesOnlyOnInput: true,
      idleCallbacks: 0,
      initialDecodedWorkingSetBytes: Object.freeze({
        one: preparedRows[defaultRow].decodedRgbaBytes.one *
          initialWarmRows.length,
        two: preparedRows[defaultRow].decodedRgbaBytes.two *
          initialWarmRows.length,
      }),
      maximumDecodedWorkingSetBytes: Object.freeze({
        one: preparedRows[defaultRow].decodedRgbaBytes.one * 3,
        two: preparedRows[defaultRow].decodedRgbaBytes.two * 3,
      }),
    }),
    runtimeLightingMath: false,
    runtimeRasterization: false,
  });
}

function materialAssetPair(id, suffix) {
  const prefix = `/scenes/earth/earth-${id}-${suffix}`;
  return Object.freeze({
    one: `${prefix}.webp`,
    two: `${prefix}@2x.webp`,
  });
}

function prepareScreenMaterialPlane({
  scenePitchDegrees,
  outputSize,
  contentRadius,
  physicalRadius,
  depthBias,
  className,
}) {
  const screenToObject = (vector) => {
    let result = rotateY(vector, scenePitchDegrees * Math.PI / 180);
    result = rotateZ(result, -EARTH_PRESENTATION_NODE_DEGREES * Math.PI / 180);
    result = rotateX(result, -EARTH_OBLIQUITY_DEGREES * Math.PI / 180);
    return rotateZ(result, -MESH_ROTATION_Z * Math.PI / 180);
  };
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const planeRadius = physicalRadius * outputSize / (contentRadius * 2);
  const projectedRadius = (direction) => Math.sqrt(
    EQUATORIAL_RADIUS ** 2 * (direction[0] ** 2 + direction[1] ** 2) +
      POLAR_RADIUS ** 2 * direction[2] ** 2,
  );
  const radiusX = planeRadius * projectedRadius(right) / EQUATORIAL_RADIUS;
  const radiusY = planeRadius * projectedRadius(down) / EQUATORIAL_RADIUS;
  const frontDepth = projectedRadius(view);
  const basisX = worldPositionToCss(scaleVector(right, radiusX * 2 / outputSize));
  const basisY = worldPositionToCss(scaleVector(down, radiusY * 2 / outputSize));
  const basisZ = worldPositionToCss(view);
  const origin = worldPositionToCss(addVectors(
    scaleVector(right, -radiusX),
    scaleVector(down, -radiusY),
    scaleVector(view, frontDepth + depthBias),
  ));
  const matrix = [...basisX, 0, ...basisY, 0, ...basisZ, 0, ...origin, 1];
  return Object.freeze({
    tag: "s",
    className,
    transform: `matrix3d(${matrix.join(",")})`,
    style: `transform:matrix3d(${matrix.join(",")})` +
      `;--polycss-atlas-width:${outputSize}px` +
      `;--polycss-atlas-height:${outputSize}px` +
      ";backface-visibility:visible",
  });
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

function normalizeVector(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function scaleVector(vector, scale) {
  return vector.map((value) => value * scale);
}

function addVectors(...vectors) {
  return [0, 1, 2].map((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
}

function countLeaves(bands) {
  return bands.reduce((count, band) => count + band.leaves.length, 0);
}

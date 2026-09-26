import type {Vec3} from '@layoutit/polycss';
import type {PagedSceneProfile, InteriorSource, SphereConfiguration, SpherePolygon, RasterPolygon} from './scene-contract.mts';
import type {createAtmospherePreparation, AtmosphereConfiguration} from './atmosphere.mts';
import type {createPagedSurfaceRaster} from './surface-raster.mts';
import {requireFiniteNumber} from '@cssearth/core';
import type {EllipsoidAttitude} from './attitude.mts';
import {preparedControlPitch} from '@cssearth/engine';
import {LIT_DEFAULT_VIEW} from '../../../src/platform/default-camera.mts';
type AtmospherePreparation = ReturnType<typeof createAtmospherePreparation>;
type AtmosphereModel = Awaited<ReturnType<AtmospherePreparation['readAtmosphereModel']>>;
interface MaterialBankOptions {id: 'lighting' | 'atmosphere'; className: string; physicalRadius: number; depthBias: number; source?: AtmosphereModel | null; supportsShadowless?: boolean; illumination?: AtmosphereConfiguration['material']['illumination'] | null;}
interface MaterialPlaneOptions {scenePitchDegrees: number; outputSize: number; contentRadius: number; physicalRadius: number; depthBias: number; className: string;}
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
  fitTextureGeometry,
  fitProjectiveTextureGeometryToStableLayout,
  prepareProjectiveTextureLayer,
} from "@cssearth/bake/scene";
import { prepareLeafSeamOutset, prepareSeamOutsetSteps, POLAR_CAP_STYLE, requireOutwardCap } from "@cssearth/bake/scene";
// Earth keeps full leaf boxes for now: its paged surface levels are being reworked on their own branch, and its leaves
// join the shared rule (packages/bake/src/presentation/leaf-box.ts) with that work.
const FULL_BOXES = { leafBox: false as const };


export function preparePagedEllipsoidScene({ config: profile, interiorSource, atmosphereModel, atmosphere, raster, attitude, cellSizes }: {cellSizes?: readonly number[]; attitude: EllipsoidAttitude; config: PagedSceneProfile; interiorSource: InteriorSource; atmosphereModel: AtmosphereModel; atmosphere: AtmospherePreparation; raster: ReturnType<typeof createPagedSurfaceRaster>}) {
const { BODY_LATITUDE_SEGMENTS, BODY_LONGITUDE_SEGMENTS, EQUATORIAL_RADIUS, TILE_SIZE, SEAM_BLEED, PLANET_SEAM_BLEED, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE, SURFACE_OVERLAP, POLAR_CAP_BAND_SPAN, POLAR_SURFACE_OVERLAP, POLAR_INNER_OVERLAP, POLAR_INNER_INSET, MESH_ROTATION_Z, CAMERA_ZOOM, CAMERA_MINIMUM_CONTROL_PITCH_DEGREES, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, CAMERA_MILLISECONDS_PER_CONTROL_DEGREE, INTERIOR_LATITUDE_SEGMENTS, INTERIOR_LONGITUDE_SEGMENTS } = profile.geometry;
// The default pose is derived (src/platform/default-camera.mts): the Sun to the left of an ecliptic-up frame at the lit pitch.
const CAMERA_SCENE_PITCH_DEGREES = LIT_DEFAULT_VIEW.initialScenePitchDegrees;
const CAMERA_DEFAULT_CONTROL_PITCH_DEGREES = preparedControlPitch(CAMERA_SCENE_PITCH_DEGREES, { maximumControlPitchDegrees: CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, maximumScenePitchDegrees: 65 });
const { MATERIAL_FRAMES_PER_SHARD, MATERIAL_PRESENTATION_SIZE, MATERIAL_TILE_SIZE, ATMOSPHERE_ILLUMINATION, ATMOSPHERE_DEFAULT_FRAME, atmosphereProfile } = atmosphere;
const { atlas: SURFACE_ATLAS, createSurfaceRasterPlan, surfacePageUrls } = raster;
const ATMOSPHERE_MODEL = atmosphereModel;
const POLAR_RADIUS = EQUATORIAL_RADIUS * profile.polarRadiusKm / profile.equatorialRadiusKm;
const SURFACE_RASTER_OVERSCAN = 64 * SURFACE_OVERLAP;
// Surface leaves overlap by a fixed angle, too little at some zooms for WebKit's antialiased leaf edges; the stepped outset
// holds the declared screen overlap at every silhouette size, as the geometry profile's does (bake/scene/seam-outset.ts).
const SEAM_OUTSET = profile.geometry.seamOutset ? prepareSeamOutsetSteps(profile.geometry.seamOutset) : null;
const BODY_DIAMETER = 2 * EQUATORIAL_RADIUS * TILE_SIZE;
const CAMERA_MAXIMUM_ZOOM = profile.camera.maximumZoom;
const CAMERA_DURATION_MILLISECONDS = CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES * CAMERA_MILLISECONDS_PER_CONTROL_DEGREE;
const INTERIOR_CUTAWAY = { ...profile.geometry.interiorCutaway, qualification: interiorSource.qualification };
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
    url: `${profile.publicBase}${profile.namespace}-surface.webp`,
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
    url: `${profile.publicBase}${profile.namespace}-surface-poles.webp`,
    width: 1024,
    height: 256,
  }),
  surfaceClassName: `${profile.namespace}-surface-leaf`,
  polarClassName: `${profile.namespace}-polar-surface`,
  polarInnerClassName: `${profile.namespace}-polar-inner`,
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
const systemTransform = `transform:${attitude.systemTransform}`;
const surfaceRasterPlan = createSurfaceRasterPlan(cellSizes);
const bodyBands = prepareSphereBands(bodyConfig, profile.geometry.rotationSeconds);
const lightingMaterial = prepareMaterialBank({
  id: "lighting",
  className: `${profile.namespace}-lighting-material`,
  physicalRadius: EQUATORIAL_RADIUS * 1.035,
  depthBias: 1.3,
  supportsShadowless: true,
});
const atmosphereMaterial = prepareMaterialBank({
  id: "atmosphere",
  className: `${profile.namespace}-atmosphere-material`,
  physicalRadius:
    EQUATORIAL_RADIUS * ATMOSPHERE_MODEL.outerRadiusRatio,
  depthBias: 1.5,
  source: ATMOSPHERE_MODEL,
  illumination: ATMOSPHERE_ILLUMINATION,
});
const interior = prepareInteriorPlan();
const surfaceLeafCount = countLeaves(bodyBands);

const scene = Object.freeze({
  schema: `cssearth-prepared-retained-scene@6`,
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
      schema: `cssearth-prepared-camera-orbit@1`,
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
  [profile.sceneBodyKey]: Object.freeze({
    equatorialRadiusKm: profile.equatorialRadiusKm,
    polarRadiusKm: profile.polarRadiusKm,
    surfaceRotationSeconds: profile.geometry.rotationSeconds,
    bodyMatrix: attitude.bodyMatrix,
    systemTransform,
    meshTransform,
    faceRetention: "complete-source-longitudes-browser-backface-culling",
  }),
  body: Object.freeze({
    latitudeSegments: BODY_LATITUDE_SEGMENTS,
    longitudeSegments: BODY_LONGITUDE_SEGMENTS,
    polarCapBandSpan: POLAR_CAP_BAND_SPAN,
    assets: Object.freeze({
      surface: { ...bodyConfig.texture, atlas: SURFACE_ATLAS,
        urls: surfacePageUrls(`${profile.namespace}-surface`, surfaceRasterPlan.pages.length),
        pages: surfaceRasterPlan.pages },
      poles: bodyConfig.poles,
    }),
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-matched-raster-and-compositor-overlap",
      seamBleed: PLANET_SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: bodyConfig.texture.raster.gutter,
      rasterOverscan: bodyConfig.texture.raster.overscan,
      runtimeEdgeDiscovery: false,
      ...(SEAM_OUTSET ? { outset: SEAM_OUTSET } : {}),
    }),
    bands: bodyBands,
  }),
  material: Object.freeze({
    transform: meshTransform,
    lighting: lightingMaterial,
    atmosphere: atmosphereMaterial,
  }),
  interior,
  counts: Object.freeze({
    surfaceLeafCount,
    cloudLeafCount: 0,
    lightingLeafCount: 1,
    atmosphereLeafCount: 1,
    interiorLeafCount: interior.leafCount,
    retainedLeafCount: surfaceLeafCount + 2,
    maximumRetainedLeafCount: surfaceLeafCount + 2 + interior.leafCount,
    runtimeGeometryPreparation: false,
    runtimeRasterization: false,
  }),
});

return { scene, surfaceRasterPlan: { atlas: SURFACE_ATLAS, cells: surfaceRasterPlan.cells, pages: surfaceRasterPlan.pages } };

function prepareSphereBands(config: SphereConfiguration, visualRotationSeconds: number) {
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

function prepareSphereLeaves(config: SphereConfiguration) {
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

function preparePolarInnerLeaves(config: SphereConfiguration) {
  return Object.freeze((["south", "north"] as const).map((pole, index) => {
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

function createSpherePolygons(config: SphereConfiguration, surfaceOverlap: number) {
  const polygons: SpherePolygon[] = [];
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

function createPolarCapPolygon(config: SphereConfiguration, pole: "north" | "south", role = "surface"): SpherePolygon {
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

function spherePoint(config: SphereConfiguration, latitude: number, longitude: number): Vec3 {
  const latitudeRadius = Math.cos(latitude);
  return [
    config.equatorialRadius * latitudeRadius * Math.cos(longitude),
    config.equatorialRadius * latitudeRadius * Math.sin(longitude),
    config.polarRadius * Math.sin(latitude),
  ];
}

function normalizeDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function interiorLongitudeRemoved(longitudeDegrees: number) {
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
    if (typeof entry.longitudeIndex === "number" && Number.isSafeInteger(entry.longitudeIndex)) {
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
        className: `${profile.namespace}-interior-outer-polar ${profile.namespace}-interior-outer-polar-${entry.polarCap}`,
        asset: Object.freeze({
          one: `${profile.publicBase}${profile.namespace}-interior-outer-poles.webp`,
          two: `${profile.publicBase}${profile.namespace}-interior-outer-poles@2x.webp`,
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
    const radiusScale = layer.outerRadiusKm / requireFiniteNumber(interiorSource[profile.interiorRadiusKey], "Interior radius");
    const cutaway = interiorSource.presentation?.cutThroughCenter || index < shellLayers.length - 1;
    const id = layer.id;
    const config = Object.freeze({
      latitudeSegments: INTERIOR_LATITUDE_SEGMENTS,
      longitudeSegments: INTERIOR_LONGITUDE_SEGMENTS,
      equatorialRadius: EQUATORIAL_RADIUS * radiusScale,
      polarRadius: POLAR_RADIUS * radiusScale,
      texture: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-${id}.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-${id}@2x.webp`,
        width: 1024,
        height: 512,
        presentationCellSize: 32,
      }),
      poles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-${id}-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-${id}-poles@2x.webp`,
        width: 512,
        height: 128,
      }),
      surfaceClassName: `${profile.namespace}-interior-${id}-leaf`,
      polarClassName: `${profile.namespace}-interior-${id}-polar`,
      polarInnerClassName: `${profile.namespace}-interior-${id}-polar-inner`,
      includePolarInner: false,
      surfaceOverlap: 0,
      textureSeamBleed: 0,
    });
    const leaves = prepareSphereLeaves(config).filter((entry) =>
      !cutaway || !(typeof entry.longitudeIndex === "number" && Number.isSafeInteger(entry.longitudeIndex)) ||
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
      className: `${profile.namespace}-interior-shell-${id}`,
      leaves: Object.freeze(leaves),
    });
  }));
  const sectionLeaves = prepareInteriorSectionLeaves();
  const leafCount = countLeaves(outerBodyBands) +
    shells.reduce((count, shell) => count + shell.leaves.length, 0) +
    sectionLeaves.length;
  return Object.freeze({
    schema: `cssearth-prepared-cutaway@2`,
    qualification: INTERIOR_CUTAWAY.qualification,
    source: Object.freeze({
      sourceUrl: interiorSource.sourceUrl,
      sourceId: interiorSource.sourceId,
      earthRadiusKm: interiorSource[profile.interiorRadiusKey],
      layers: Object.freeze(interiorSource.layers.map((layer) =>
        Object.freeze({ ...layer }))),
    }),
    cutaway: INTERIOR_CUTAWAY,
    outerBodyBands,
    outerAssets: Object.freeze({
      surface: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer@2x.webp`,
        oneUrls: surfacePageUrls(`${profile.namespace}-interior-outer`, surfaceRasterPlan.pages.length),
        twoUrls: surfacePageUrls(`${profile.namespace}-interior-outer`, surfaceRasterPlan.pages.length, "@2x"),
      }),
      poles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer-poles@2x.webp`,
      }),
      litSurface: Object.freeze({
        urls: surfacePageUrls(`${profile.namespace}-interior-outer-lit`, surfaceRasterPlan.pages.length, "@2x"),
      }),
      litPoles: Object.freeze({
        one: `${profile.publicBase}${profile.namespace}-interior-outer-lit-poles.webp`,
        two: `${profile.publicBase}${profile.namespace}-interior-outer-lit-poles@2x.webp`,
      }),
    }),
    shells,
    sectionLeaves,
    leafCount,
    runtimeGeometry: false,
    runtimeRasterization: false,
  });
}

function groupPreparedEntries<T>(entries: readonly {latitudeIndex: number; leaf: T}[], latitudeSegments: number,
  visualRotationSeconds: number) {
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
    one: `${profile.publicBase}${profile.namespace}-interior-section.webp`,
    two: `${profile.publicBase}${profile.namespace}-interior-section@2x.webp`,
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
    const polygon: RasterPolygon = {
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
      className: `${profile.namespace}-interior-section-face`,
      ...textureStyle(polygon, faceIndex, null, 0),
      asset,
      backfaceVisible: true,
    });
  }));
}

function textureStyle(polygon: RasterPolygon, index: number, seamEdges: Set<number> | null | undefined, seamBleed: number) {
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
  if (polygon.surfaceRaster) {
    if (!polygon.surfaceSourceRect || !polygon.textureImageSource || !polygon.textureImageSource.sourceRect ||
        typeof polygon.latitudeIndex !== 'number' || typeof polygon.longitudeIndex !== 'number') {
      throw new Error('Paged surface polygon requires its original source cell and indices.');
    }
    const rasterPresentation = createProjectiveSurfaceRasterPresentation({
      sourceWidth: polygon.surfaceRaster.width, sourceHeight: polygon.surfaceRaster.height, sourceRect: polygon.surfaceSourceRect,
      addressSourceWidth: polygon.textureImageSource.width, addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect, backgroundPosition: fitted.backgroundPosition,
      backgroundSize: fitted.backgroundSize, leafWidth: fitted.leafWidth, leafHeight: fitted.leafHeight,
      bandCount: polygon.surfaceRaster.bandCount, gutter: polygon.surfaceRaster.gutter, overscan: polygon.surfaceRaster.overscan,
    });
    const cell = surfaceRasterPlan.prepare(fitted, rasterPresentation,
      (polygon.latitudeIndex - 1) * BODY_LONGITUDE_SEGMENTS + polygon.longitudeIndex);
    const density = SURFACE_ATLAS.density;
    const size = cell.size / density, page = `--${profile.namespace}-surface-page-${cell.page}`;
    // At a small level the page is a tile of one sheet (texture-levels.mts); the body then publishes the tile's offset and
    // the sheet's scale beside the image, and the fallbacks are the page's own. They are unitless multipliers of inline
    // lengths, so preparation's raster and leaf-box scaling (projective-layout.mts) scales them with the address.
    return {
      style: `transform:matrix3d(${cell.layer.frameMatrix})` +
        preparedAtlasDimensions(size, size) +
        `;background-position:calc(-1px * var(${page}-x, 0) - ${cell.x / density}px) calc(-1px * var(${page}-y, 0) - ${cell.y / density}px)` +
        `;background-size:calc(${surfaceRasterPlan.pages[cell.page].width / density}px * var(${page}-scale, 1)) auto` +
        `;background-image:var(${page})`,
      projectiveTextureLayer: SEAM_OUTSET
        ? { ...cell.layer, ...FULL_BOXES, seamOutset: prepareLeafSeamOutset(cell.layer.frameMatrix, size, size, BODY_DIAMETER) }
        : { ...cell.layer, ...FULL_BOXES },
      geographicFrameMatrix: fitted.matrix,
      sourceRect: fitted.sourceRect,
      leafWidth: size,
      leafHeight: size,
      projection: fitted.projection,
      lighting: "source",
      lightingOverlay: false,
    };
  }
  const backgroundPosition = fitted.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value)).join(" ");
  const backgroundSize = fitted.backgroundSize
    .map((value) => formatCssLength(value)).join(" ");
  // Every lane's caps follow one rule (polar-cap.ts): a disc, facing out, culled when it turns away. This covers the globe's
  // caps, the cutaway's outer poles and every interior shell's caps.
  if (polygon.polarCap) requireOutwardCap(`${profile.namespace} ${polygon.texture}`, polygon.polarCap, fitted.matrix);
  return {
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(fitted.leafWidth, fitted.leafHeight) +
      `;background-position:${backgroundPosition}` +
      `;background-size:${backgroundSize}` +
      (polygon.polarCap ? POLAR_CAP_STYLE : ""),
    // A polar cap samples the 256-pixel poles image, so it is rastered at its own size. At the interior shells' scale
    // WebKit backed each cap with a 1024-pixel layer (36 MB on an iPhone) for no extra detail.
    projectiveTextureLayer: { ...prepareProjectiveTextureLayer(
      fitted.matrix,
      polygon.polarCap ? 1 : INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE,
    ), ...FULL_BOXES },
    sourceRect: fitted.sourceRect,
    leafWidth: fitted.leafWidth,
    leafHeight: fitted.leafHeight,
    projection: fitted.projection,
    lighting: "source",
    lightingOverlay: false,
  };
}

function preparedAtlasDimensions(width: number, height: number) {
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
  illumination = null,
}: MaterialBankOptions) {
  if (illumination && !source) throw new Error('Atmosphere material requires its source profile.');
  const frameCount = 128;
  const columns = Math.sqrt(MATERIAL_FRAMES_PER_SHARD);
  const rows = columns;
  const shardCount = frameCount / MATERIAL_FRAMES_PER_SHARD;
  if (!Number.isInteger(columns) || !Number.isInteger(shardCount)) {
    throw new Error("Earth material shards require a square frame layout.");
  }
  const sourceTileSize = MATERIAL_TILE_SIZE;
  const presentationTileSize = MATERIAL_PRESENTATION_SIZE;
  const gutter = 2;
  const stride = sourceTileSize + gutter * 2;
  const shardWidth = stride * columns;
  const shardHeight = stride * rows;
  const presentationScale = presentationTileSize / sourceTileSize;
  // Lighting frames step the Sun's view z across [-1, 1] (the runtime selects by it); the default is the Sun at the default pose.
  const defaultFrame = illumination ? ATMOSPHERE_DEFAULT_FRAME : Math.round((attitude.sunView(CAMERA_SCENE_PITCH_DEGREES)[2] + 1) / 2 * (frameCount - 1));
  const frames = Object.freeze(Array.from({ length: frameCount },
    (_, frameIndex) => {
      const rowIndex = Math.floor(
        frameIndex / MATERIAL_FRAMES_PER_SHARD,
      );
      const frameOffset = frameIndex % MATERIAL_FRAMES_PER_SHARD;
      const columnIndex = frameOffset % columns;
      const tileRowIndex = Math.floor(frameOffset / columns);
      const scenePitchDegrees = 65 - frameIndex /
        (frameCount - 1) * 65;
      // With shadows off an illuminated material shows only its last (flood) frame, so that frame is its own image:
      // the first view loads one frame, not the four-frame row around it.
      const flood = Boolean(illumination) && frameIndex === frameCount - 1;
      return Object.freeze({
        frameIndex,
        rowIndex,
        columnIndex,
        tileRowIndex,
        scenePitchDegrees,
        flood,
        assets: materialAssetPair(
          id,
          flood ? "flood" : `row-${String(rowIndex).padStart(2, "0")}`,
        ),
        backgroundPosition: flood ? `${-gutter * presentationScale}px ${-gutter * presentationScale}px` :
          `${-(columnIndex * stride + gutter) * presentationScale}px ` +
          `${-(tileRowIndex * stride + gutter) * presentationScale}px`,
        backgroundSize: flood ? `${stride * presentationScale}px ${stride * presentationScale}px` :
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
      firstFrame: rowIndex * MATERIAL_FRAMES_PER_SHARD,
      frameCount: MATERIAL_FRAMES_PER_SHARD,
    })));
  const defaultRow = Math.floor(
    defaultFrame / MATERIAL_FRAMES_PER_SHARD,
  );
  const initialFrame = frameCount - 1;
  const initialRow = Math.floor(
    initialFrame / MATERIAL_FRAMES_PER_SHARD,
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
      ? "published-disc-law-under-model-atmosphere-with-google-directional-response-bank"
      : "prepared-fixed-world-view-bank-bounded-square-shards",
    source,
    ...(illumination && source ? { illumination, atmosphereProfile: atmosphereProfile(source) } : {}),
    frameCount,
    columns,
    rows,
    framesPerShard: MATERIAL_FRAMES_PER_SHARD,
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
    ...(illumination ? { floodAssets: materialAssetPair(id, "flood") } : {}),
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
      schema: `cssearth-prepared-material-transform@1`,
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
        `;background-image:url(${profile.publicBase}${profile.namespace}-${id}-default.webp)` +
        `;background-size:${presentationTileSize}px ${presentationTileSize}px`,
    }),
    transport: Object.freeze({
      model: "row-shard-cache",
      defaultRow: initialRow,
      initialWarmRows,
      maximumRetainedRowCount: 3,
      framesPerShard: MATERIAL_FRAMES_PER_SHARD,
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

function materialAssetPair(id: string, suffix: string) {
  const prefix = `${profile.publicBase}${profile.namespace}-${id}-${suffix}`;
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
}: MaterialPlaneOptions) {
  const screenToObject = (vector: Vec3) => attitude.screenToObject(vector, scenePitchDegrees) as unknown as Vec3;
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const planeRadius = physicalRadius * outputSize / (contentRadius * 2);
  const projectedRadius = (direction: Vec3) => Math.sqrt(
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

function rotateX([x, y, z]: Vec3, radians: number): Vec3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z]: Vec3, radians: number): Vec3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z]: Vec3, radians: number): Vec3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function scaleVector(vector: Vec3, scale: number): Vec3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function addVectors(...vectors: Vec3[]): Vec3 {
  const sum = (axis: number) => vectors.reduce((sum, vector) => sum + vector[axis], 0);
  return [sum(0), sum(1), sum(2)];
}

function countLeaves(bands: readonly {leaves: readonly unknown[]}[]) {
  return bands.reduce((count, band) => count + band.leaves.length, 0);
}

}

import {
  buildPolyCameraSceneTransform,
  buildPolyMeshTransform,
  createPolyCamera,
} from "@layoutit/polycss";
import { createPagedSceneContext, type PagedSceneInput } from './scene-context.ts';
import { countLeaves, prepareSphereBands } from './scene-leaves.ts';
import { prepareInteriorPlan } from './scene-interior.ts';
import { prepareMaterialBank } from './scene-material.ts';

export function preparePagedEllipsoidScene(input: PagedSceneInput) {
const ctx = createPagedSceneContext(input);
const { profile, attitude, BODY_LATITUDE_SEGMENTS, BODY_LONGITUDE_SEGMENTS, EQUATORIAL_RADIUS, PLANET_SEAM_BLEED, SURFACE_OVERLAP, POLAR_CAP_BAND_SPAN, MESH_ROTATION_Z, CAMERA_ZOOM, CAMERA_MINIMUM_CONTROL_PITCH_DEGREES, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, CAMERA_MILLISECONDS_PER_CONTROL_DEGREE, CAMERA_SCENE_PITCH_DEGREES, CAMERA_DEFAULT_CONTROL_PITCH_DEGREES, ATMOSPHERE_ILLUMINATION, SURFACE_ATLAS, surfacePageUrls, ATMOSPHERE_MODEL, SEAM_OUTSET, CAMERA_MAXIMUM_ZOOM, CAMERA_DURATION_MILLISECONDS, bodyConfig, surfaceRasterPlan } = ctx;
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
const bodyBands = prepareSphereBands(ctx, bodyConfig, profile.geometry.rotationSeconds);
const atmosphereMaterial = prepareMaterialBank(ctx, {
  id: "atmosphere",
  className: `${profile.namespace}-atmosphere-material`,
  physicalRadius:
    EQUATORIAL_RADIUS * ATMOSPHERE_MODEL.outerRadiusRatio,
  depthBias: 1.5,
  source: ATMOSPHERE_MODEL,
  illumination: ATMOSPHERE_ILLUMINATION,
});
const interior = prepareInteriorPlan(ctx);
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
    atmosphere: atmosphereMaterial,
  }),
  interior,
  counts: Object.freeze({
    surfaceLeafCount,
    cloudLeafCount: 0,
    atmosphereLeafCount: 1,
    interiorLeafCount: interior.leafCount,
    retainedLeafCount: surfaceLeafCount + 1,
    maximumRetainedLeafCount: surfaceLeafCount + 1 + interior.leafCount,
    runtimeGeometryPreparation: false,
    runtimeRasterization: false,
  }),
});

return { scene, surfaceRasterPlan: { atlas: SURFACE_ATLAS, cells: surfaceRasterPlan.cells, pages: surfaceRasterPlan.pages } };
}

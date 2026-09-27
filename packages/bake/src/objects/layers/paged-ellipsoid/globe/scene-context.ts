/** The constants a paged ellipsoid's scene is prepared from: the geometry profile's, the atmosphere bank's, the surface raster
 * plan's and the derived ones every part of the scene shares (scene.ts, scene-leaves.ts, scene-interior.ts, scene-material.ts). */
import type { PagedSceneProfile, InteriorSource } from '../scene-contract.ts';
import type { createPagedSurfaceRaster } from '../surface-raster.ts';
import type { createAtmospherePreparation } from './atmosphere.ts';
import type { EllipsoidAttitude } from './attitude.ts';
import { preparedControlPitch } from '@cssearth/engine';
import { LIT_DEFAULT_VIEW } from '../../../scene/index.ts';
import { prepareSeamOutsetSteps } from '../../../../scene/index.ts';
type AtmospherePreparation = ReturnType<typeof createAtmospherePreparation>;
export type AtmosphereModel = Awaited<ReturnType<AtmospherePreparation['readAtmosphereModel']>>;
export interface PagedSceneInput {cellSizes?: readonly number[]; attitude: EllipsoidAttitude; config: PagedSceneProfile; interiorSource: InteriorSource; atmosphereModel: AtmosphereModel; atmosphere: AtmospherePreparation; raster: ReturnType<typeof createPagedSurfaceRaster>}

export function createPagedSceneContext({ config: profile, interiorSource, atmosphereModel, atmosphere, raster, attitude, cellSizes }: PagedSceneInput) {
const { BODY_LATITUDE_SEGMENTS, BODY_LONGITUDE_SEGMENTS, EQUATORIAL_RADIUS, TILE_SIZE, SEAM_BLEED, PLANET_SEAM_BLEED, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE, SURFACE_OVERLAP, POLAR_CAP_BAND_SPAN, POLAR_SURFACE_OVERLAP, MESH_ROTATION_Z, CAMERA_ZOOM, CAMERA_MINIMUM_CONTROL_PITCH_DEGREES, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, CAMERA_MILLISECONDS_PER_CONTROL_DEGREE, INTERIOR_LATITUDE_SEGMENTS, INTERIOR_LONGITUDE_SEGMENTS } = profile.geometry;
// The default pose is derived (`@cssearth/bake/objects/scene` default-camera): the Sun to the left of an ecliptic-up frame at the lit pitch.
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
    width: 512,
    height: 256,
  }),
  surfaceClassName: `${profile.namespace}-surface-leaf`,
  polarClassName: `${profile.namespace}-polar-surface`,
});
const surfaceRasterPlan = createSurfaceRasterPlan(cellSizes);
return Object.freeze({ profile, interiorSource, attitude, atmosphereModel, BODY_LATITUDE_SEGMENTS, BODY_LONGITUDE_SEGMENTS, EQUATORIAL_RADIUS, TILE_SIZE, SEAM_BLEED, PLANET_SEAM_BLEED, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE, SURFACE_OVERLAP, POLAR_CAP_BAND_SPAN, POLAR_SURFACE_OVERLAP, MESH_ROTATION_Z, CAMERA_ZOOM, CAMERA_MINIMUM_CONTROL_PITCH_DEGREES, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, CAMERA_MILLISECONDS_PER_CONTROL_DEGREE, INTERIOR_LATITUDE_SEGMENTS, INTERIOR_LONGITUDE_SEGMENTS, CAMERA_SCENE_PITCH_DEGREES, CAMERA_DEFAULT_CONTROL_PITCH_DEGREES, MATERIAL_FRAMES_PER_SHARD, MATERIAL_PRESENTATION_SIZE, MATERIAL_TILE_SIZE, ATMOSPHERE_ILLUMINATION, ATMOSPHERE_DEFAULT_FRAME, atmosphereProfile, SURFACE_ATLAS, createSurfaceRasterPlan, surfacePageUrls, ATMOSPHERE_MODEL, POLAR_RADIUS, SURFACE_RASTER_OVERSCAN, SEAM_OUTSET, BODY_DIAMETER, CAMERA_MAXIMUM_ZOOM, CAMERA_DURATION_MILLISECONDS, INTERIOR_CUTAWAY, PLAN_OPTIONS, bodyConfig, surfaceRasterPlan });
}
export type PagedSceneContext = ReturnType<typeof createPagedSceneContext>;

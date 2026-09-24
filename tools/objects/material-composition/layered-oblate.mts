import { applyLinearTint } from '../color-transfer.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { isArray } from '../../../src/platform/is-array.mts';
import type {RingMotionPoint} from './radial-motion.mts';
interface PixelImage {data:Uint8Array;info:{width:number;height:number;channels:number};}
interface RetainedLeaf {style:string;tag?:string;className?:string;projectiveTextureLayer?:ReturnType<typeof prepareProjectiveTextureLayer>;}
interface PointGroup {population:string;durationSeconds:number;expansionGroupIndex?:number;points:RingMotionPoint[];}
interface AtlasPresentation {assetUrl?:string;asset2xUrl?:string;frameIndex?:number;rowIndex?:number;backgroundPosition?:string;backgroundSize?:string;}
interface AtlasVariant {runtimeAtlas:AtlasPresentation;defaultPresentation?:AtlasPresentation;rows:readonly AtlasPresentation[];presentations:readonly AtlasPresentation[];}
interface AtlasPlanMetadata {model:string;defaultVariant?:string;defaultPreparedFrame:number;defaultPreparedRow:number;initialWarmRows:readonly number[];
  maximumRetainedAtlasCount:number;initialDecodedWorkingSetBytes:number;maximumDecodedWorkingSetBytes:number;fullAtlasDecodedRgbaBytes:number;}
type AtlasPlan=AtlasPlanMetadata & (AtlasVariant & {variants?:undefined}|{variants:Record<string,AtlasVariant>});
import type {Polygon,Vec3,Vec2,PolyTextureImageSource,ComputeTextureAtlasPlanOptions} from '@layoutit/polycss';
import type {SilhouetteOptions,Vector3} from './ellipsoid.mts';
type Pole='north'|'south';
interface LayeredPolygon extends Polygon {textureImageSource:PolyTextureImageSource;latitudeIndex?:number;longitudeIndex?:number;lightingFaceIndex?:number;polarCap?:Pole;polarRole?:string;}
interface SurfaceAsset {url:string;url2x:string;width:number;height:number;}
interface ShellOptions {radiusScale:number;surface:SurfaceAsset;poles:SurfaceAsset;cutaway:boolean;}
interface RingRaster {ringData:Uint8Array|null;foregroundRingData:Uint8Array|null;ringTextureWidth:number;maximumLightingFactor:number;}
interface FixedMaterialOptions extends RingRaster {objectLight:ReadonlyVector3;objectView:ReadonlyVector3;scenePitchDegrees:number;systemObliquityDegrees:number;
  textureUrl?:string;outputSize?:number;preparedMeshSilhouette?:boolean;materialMode?:string;}
const mapVector3=(fn:(axis:number)=>number):Vector3=>[fn(0),fn(1),fn(2)];
import {parse,object,number} from '@cssearth/core/schema';
import {layeredRecipe} from './layered-recipe.mts';
import {interiorSource} from '../cutaway/source-contract.mts';
import type {prepareRadialMotionAndShadow} from './radial-motion.mts';
import type {prepareSpectralMaterialVariants} from './spectral-variants.mts';
import type {prepareCutawayMaterials} from '../cutaway/materials.mts';
import type {ReadonlyVector3} from './ellipsoid.mts';
import {requireString,requireRecord} from '@cssearth/core';
type RadialPreparation = Awaited<ReturnType<typeof prepareRadialMotionAndShadow>>;
interface LayeredInputs extends Omit<RadialPreparation,'ringGroups'> {
  ringGroups:PointGroup[];
  lenses?:Awaited<ReturnType<typeof prepareSpectralMaterialVariants>>;
  views?:Awaited<ReturnType<typeof prepareCutawayMaterials>>;
}
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { buildPolyCameraSceneTransform, buildPolyMeshTransform, buildSeamBleedPolygonEdges, computeSolidTrianglePlan, computeTextureAtlasPlanPublic, createPolyCamera, formatCssLength, resolvePolyTextureLeafGeometry, textureTintFactors, worldPositionToCss } from '@layoutit/polycss';
import { createProjectiveSurfaceRasterPresentation, fitTextureGeometry,fitProjectiveTextureGeometryToStableLayout, packProjectiveSurfaceRaster, polarCapRasterScale, prepareProjectiveTextureLayer } from '../../../src/platform/projective-surface-raster.mts';
import { optimizePreparedQ75Webp, PREPARED_Q75_WEBP_ENCODING } from '../../prepared/prepared-webp.mts';
import { polarQuad } from './texture-geometry.mts';
import { verifyObservationSources } from '../observed-surfaces/index.mts';
import { extractRgbaBounds, visibleRgbaMatches } from './rgba.mts';
import { ellipsoidPoint, planetographicRowsToMeshLatitude, intersectViewRayWithEllipsoid, prepareProjectedEllipsoidSilhouetteCoverage, prepareObjectViewDirection as prepareViewDirection, prepareObjectSpaceDirection, normalizeVector, dotVector, subtractVector, rotateX, rotateY, rotateZ } from './ellipsoid.mts';
import { writeMaterialAtlasTile, sampleRgbaBilinear, sampleAlphaBilinear } from './raster.mts';
import { validateMaterialRecipe } from './recipe.mts';

/** Source-configured oblate surface, projected material banks and retained cutaway. */
export async function createLayeredOblatePreparation({ sourceDirectory, publicDirectory, stagingDirectory, config:input, preparedInputs }: {sourceDirectory:string;publicDirectory:string;stagingDirectory:string;config:unknown;preparedInputs:LayeredInputs}) {
  const config=parse(input,layeredRecipe,'layered oblate recipe');
  validateMaterialRecipe(config, 'cssearth-layered-oblate-preparation@1');
  // The recipe names its inputs by path (sources); git and the source cache hold their bytes, so nothing else is pinned.
  await verifyObservationSources(sourceDirectory, Object.values(config.sources).map(path => ({ path })));
  const readSourceJson = async (path:string): Promise<unknown> => JSON.parse(await readFile(resolve(sourceDirectory,path),'utf8'));
  const PREPARED_RING_SOURCE = preparedInputs.ringSource;
  const PREPARED_RING_GROUPS = preparedInputs.ringGroups;
  const PREPARED_MAIN_RING_PLATES = preparedInputs.ringPlates;
  await Promise.all([mkdir(publicDirectory,{recursive:true}),mkdir(stagingDirectory,{recursive:true})]);

const DEFAULT_LENS_ID = config.parameters.defaultLensId;
const PROJECTIVE_TEXTURE_RASTER_SCALE = config.parameters.projectiveTextureRasterScale;
const MATERIAL_MODES = config.parameters.materialModes;
const materialVariantId = (lensId:string, mode:string) =>
  mode === "full" ? lensId : `${lensId}-${mode}`;
const INTERIOR_SOURCE = parse(await readSourceJson(config.sources.interior),interiorSource,'interior source');
const INTERIOR_CUTAWAY = Object.freeze(INTERIOR_SOURCE.cutaway);

const requireLenses = () => {if(!preparedInputs.lenses)throw new Error('Layered composition requires prepared lenses.');return preparedInputs.lenses;};
const requireViews = () => {if(!preparedInputs.views)throw new Error('Layered composition requires prepared cutaway views.');return preparedInputs.views;};

const LATITUDE_SEGMENTS = config.parameters.latitudeSegments;
const LONGITUDE_SEGMENTS = config.parameters.longitudeSegments;
const INTERIOR_LATITUDE_SEGMENTS = config.parameters.interiorLatitudeSegments;
const INTERIOR_LONGITUDE_SEGMENTS = config.parameters.interiorLongitudeSegments;
const OBJECT_EQUATORIAL_RADIUS_KM = config.parameters.objectEquatorialRadiusKm;
const OBJECT_POLAR_RADIUS_KM = config.parameters.objectPolarRadiusKm;
const F_RING_OUTER_RADIUS_KM = config.parameters.fRingOuterRadiusKm;
const EQUATORIAL_RADIUS = config.parameters.equatorialRadius;
const POLAR_RADIUS = EQUATORIAL_RADIUS *
  OBJECT_POLAR_RADIUS_KM / OBJECT_EQUATORIAL_RADIUS_KM;
const RING_OUTER_RADIUS = EQUATORIAL_RADIUS *
  F_RING_OUTER_RADIUS_KM / OBJECT_EQUATORIAL_RADIUS_KM;
const PLANET_SURFACE_TEXTURE_URL = config.parameters.planetSurfaceTextureUrl;
const PLANET_BODY_SURFACE_TEXTURE_URL =
  config.parameters.planetBodySurfaceTextureUrl;
const PLANET_POLAR_TEXTURE_URL = config.parameters.planetPolarTextureUrl;
const PLANET_FIXED_MATERIAL_TEXTURE_URL =
  config.parameters.planetFixedMaterialTextureUrl;
const PLANET_ORBIT_MATERIAL_TEXTURE_URL =
  config.parameters.planetOrbitMaterialTextureUrl;
const PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL =
  config.parameters.planetOrbitMaterialDefaultTextureUrl;
const orbitMaterialVariantTextureUrl = (variantId:string) =>
  variantId === DEFAULT_LENS_ID
    ? PLANET_ORBIT_MATERIAL_TEXTURE_URL
    : `${config.publicPrefix}${config.namespace}-orbit-material-${variantId}.webp`;
const orbitMaterialVariantTexturePath = (variantId:string) =>
  publicTexturePath(orbitMaterialVariantTextureUrl(variantId));
const orbitMaterialPreparationPath = (variantId:string) => resolve(
  stagingDirectory,
  requireString(orbitMaterialVariantTextureUrl(variantId).split("/").at(-1)),
);
const INTERIOR_ATMOSPHERE_TEXTURE_URL =
  config.parameters.interiorAtmosphereTextureUrl;
const interiorMaterialVariantTextureUrl = (variantId:string) =>
  variantId === DEFAULT_LENS_ID
    ? INTERIOR_ATMOSPHERE_TEXTURE_URL
    : `${config.publicPrefix}${config.namespace}-interior-atmosphere-${variantId}.webp`;
const interiorMaterialPreparationPath = (variantId:string) => resolve(
  stagingDirectory,
  requireString(interiorMaterialVariantTextureUrl(variantId).split("/").at(-1)),
);
const RING_TEXTURE_URL = config.parameters.ringTextureUrl;
const RING_TEXTURE_2X_URL = config.parameters.ringTexture_2xUrl;
const RING_SHADOW_TEXTURE_URL = config.parameters.ringShadowTextureUrl;
const RING_SHADOW_DIRECT_TRANSMISSION =
  parse(PREPARED_RING_SOURCE.shadowModel[config.fields.bodyOnRings],object({directTransmission:number}),'body-on-rings transmission').directTransmission;
const RING_SHADOW_FOOTPRINT_BLUR_SIGMA = config.parameters.ringShadowFootprintBlurSigma;
const PLANET_SOURCE_TEXTURE_WIDTH = config.parameters.planetSourceTextureWidth;
const PLANET_SOURCE_TEXTURE_HEIGHT = config.parameters.planetSourceTextureHeight;
const POLAR_OBSERVATION_POLAR_SOURCE_WIDTH = config.parameters.polarObservationPolarSourceWidth;
const POLAR_OBSERVATION_POLAR_SOURCE_HEIGHT = config.parameters.polarObservationPolarSourceHeight;
const POLAR_OBSERVATION_POLAR_TILE_SIZE = config.parameters.polarObservationPolarTileSize;
const POLAR_OBSERVATION_2017_TILE_LEFT = config.parameters.polarObservation_2017TileLeft;
const POLAR_OBSERVATION_POLAR_CENTER = POLAR_OBSERVATION_POLAR_TILE_SIZE / 2;
const POLAR_OBSERVATION_POLAR_KM_PER_PIXEL = config.parameters.polarObservationPolarKmPerPixel;
const POLAR_OBSERVATION_POLAR_BLEND_START = config.parameters.polarObservationPolarBlendStart;
const PLANET_FRAME_WIDTH = config.parameters.planetFrameWidth;
const PLANET_FRAME_HEIGHT = config.parameters.planetFrameHeight;
const PLANET_ROTATION_SECONDS = config.parameters.planetRotationSeconds;
const PLANET_LIGHTING_FPS = config.parameters.planetLightingFps;
const PLANET_LIGHTING_FRAME_COUNT = PLANET_ROTATION_SECONDS * PLANET_LIGHTING_FPS;
const PLANET_SOURCE_CELL_WIDTH = PLANET_SOURCE_TEXTURE_WIDTH / LONGITUDE_SEGMENTS;
const PLANET_SOURCE_CELL_HEIGHT = PLANET_SOURCE_TEXTURE_HEIGHT / LATITUDE_SEGMENTS;
const PLANET_RASTER_CELL_SIZE = config.parameters.planetRasterCellSize;
const PLANET_RASTER_SOURCE_WIDTH =
  LONGITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE;
const PLANET_RASTER_SOURCE_HEIGHT =
  LATITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE;
const PLANET_RASTER_GUTTER = PLANET_RASTER_CELL_SIZE / 4;
const PLANET_RASTER_OVERSCAN = config.parameters.planetRasterOverscan;
const PLANET_POLAR_TEXTURE_SIZE = config.parameters.planetPolarTextureSize;
const PLANET_POLAR_TEXTURE_TILE_COUNT = config.parameters.planetPolarTextureTileCount;
const PLANET_POLAR_TEXTURE_WIDTH =
  PLANET_POLAR_TEXTURE_SIZE * PLANET_POLAR_TEXTURE_TILE_COUNT;
const PLANET_POLAR_TEXTURE_HEIGHT = PLANET_POLAR_TEXTURE_SIZE;
const PLANET_POLAR_SURFACE_TILE = config.parameters.planetPolarSurfaceTile;
const PLANET_POLAR_MATERIAL_TILE = config.parameters.planetPolarMaterialTile;
const PLANET_POLAR_INNER_SURFACE_TILE = config.parameters.planetPolarInnerSurfaceTile;
const PLANET_POLAR_INNER_MATERIAL_TILE = config.parameters.planetPolarInnerMaterialTile;
const PLANET_POLAR_BOUNDARY_LATITUDE = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS;
const PLANET_POLAR_RADIUS =
  EQUATORIAL_RADIUS * Math.cos(PLANET_POLAR_BOUNDARY_LATITUDE);
const PLANET_POLAR_BOUNDARY_Z =
  POLAR_RADIUS * Math.sin(PLANET_POLAR_BOUNDARY_LATITUDE);
const PLANET_POLAR_PLANE_Z = PLANET_POLAR_BOUNDARY_Z + 0.1;
const PLANET_POLAR_SURFACE_OVERLAP = config.parameters.planetPolarSurfaceOverlap;
const PLANET_POLAR_INNER_OVERLAP = config.parameters.planetPolarInnerOverlap;
const PLANET_POLAR_INNER_INSET = config.parameters.planetPolarInnerInset;
const PLANET_POLAR_MATERIAL_OVERLAP = PLANET_POLAR_SURFACE_OVERLAP;
const PLANET_POLAR_MATERIAL_OFFSET = config.parameters.planetPolarMaterialOffset;
const PLANET_POLAR_SUPERSAMPLING = config.parameters.planetPolarSupersampling;
const PLANET_LIGHTING_CELL_WIDTH = config.parameters.planetLightingCellWidth;
const PLANET_LIGHTING_CELL_HEIGHT = config.parameters.planetLightingCellHeight;
const SURFACE_OVERLAP = config.parameters.surfaceOverlap;
const PLANET_LIGHTING_FRAME_GUTTER = config.parameters.planetLightingFrameGutter;
const PLANET_TEXTURE_FACE_COUNT =
  (LATITUDE_SEGMENTS - 2) * LONGITUDE_SEGMENTS;
const PLANET_LIGHTING_FIELD_WIDTH =
  LONGITUDE_SEGMENTS * PLANET_LIGHTING_CELL_WIDTH;
const PLANET_LIGHTING_FIELD_HEIGHT =
  (LATITUDE_SEGMENTS - 2) * PLANET_LIGHTING_CELL_HEIGHT;
const PLANET_LIGHTING_FRAME_STRIDE_X =
  PLANET_LIGHTING_FIELD_WIDTH + PLANET_LIGHTING_FRAME_GUTTER * 2;
const PLANET_LIGHTING_FRAME_STRIDE_Y =
  PLANET_LIGHTING_FIELD_HEIGHT + PLANET_LIGHTING_FRAME_GUTTER * 2;
const PLANET_LIGHTING_FRAME_COLUMNS = config.parameters.planetLightingFrameColumns;
const PLANET_LIGHTING_FRAME_ROWS = Math.ceil(
  PLANET_LIGHTING_FRAME_COUNT / PLANET_LIGHTING_FRAME_COLUMNS,
);
const PLANET_LIGHTING_TEXTURE_WIDTH =
  PLANET_LIGHTING_FRAME_COLUMNS * PLANET_LIGHTING_FRAME_STRIDE_X;
const PLANET_LIGHTING_TEXTURE_HEIGHT =
  PLANET_LIGHTING_FRAME_ROWS * PLANET_LIGHTING_FRAME_STRIDE_Y;
const PLANET_LIGHTING_PRESENTATION_SCALE_X =
  PLANET_RASTER_CELL_SIZE /
    (PLANET_LIGHTING_CELL_WIDTH * (1 + SURFACE_OVERLAP * 2));
const PLANET_LIGHTING_PRESENTATION_SCALE_Y =
  PLANET_RASTER_CELL_SIZE /
    (PLANET_LIGHTING_CELL_HEIGHT * (1 + SURFACE_OVERLAP * 2));
const PLANET_LIGHTING_PRESENTATION_WIDTH =
  PLANET_LIGHTING_TEXTURE_WIDTH * PLANET_LIGHTING_PRESENTATION_SCALE_X;
const PLANET_LIGHTING_PRESENTATION_HEIGHT =
  PLANET_LIGHTING_TEXTURE_HEIGHT * PLANET_LIGHTING_PRESENTATION_SCALE_Y;
const PLANET_LIGHTING_REFERENCE_CHANNEL = config.parameters.planetLightingReferenceChannel;
const PLANET_FIXED_MATERIAL_SIZE = config.parameters.planetFixedMaterialSize;
const PLANET_ORBIT_MATERIAL_SIZE = config.parameters.planetOrbitMaterialSize;
const PLANET_ORBIT_MATERIAL_GUTTER = config.parameters.planetOrbitMaterialGutter;
const PLANET_ORBIT_MATERIAL_STRIDE =
  PLANET_ORBIT_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const PLANET_ORBIT_MATERIAL_FRAME_COUNT = config.parameters.planetOrbitMaterialFrameCount;
const PLANET_ORBIT_MATERIAL_COLUMNS = config.parameters.planetOrbitMaterialColumns;
const PLANET_ORBIT_MATERIAL_ROWS = config.parameters.planetOrbitMaterialRows;
const PLANET_ORBIT_MATERIAL_GRID_WIDTH =
  PLANET_ORBIT_MATERIAL_COLUMNS * PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_GRID_HEIGHT =
  PLANET_ORBIT_MATERIAL_ROWS * PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_DEFAULT_X =
  PLANET_ORBIT_MATERIAL_GRID_WIDTH + PLANET_ORBIT_MATERIAL_GUTTER;
const PLANET_ORBIT_MATERIAL_DEFAULT_Y = PLANET_ORBIT_MATERIAL_GUTTER;
const PLANET_ORBIT_MATERIAL_WIDTH = PLANET_ORBIT_MATERIAL_GRID_WIDTH +
  PLANET_FIXED_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const PLANET_ORBIT_MATERIAL_HEIGHT = PLANET_ORBIT_MATERIAL_GRID_HEIGHT;
const PLANET_ORBIT_MATERIAL_ROW_WIDTH = PLANET_ORBIT_MATERIAL_GRID_WIDTH;
const PLANET_ORBIT_MATERIAL_ROW_HEIGHT = PLANET_ORBIT_MATERIAL_STRIDE;
const PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE =
  PLANET_FIXED_MATERIAL_SIZE + PLANET_ORBIT_MATERIAL_GUTTER * 2;
const INTERIOR_ATMOSPHERE_SIZE = config.parameters.interiorAtmosphereSize;
const INTERIOR_ATMOSPHERE_GUTTER = config.parameters.interiorAtmosphereGutter;
const INTERIOR_ATMOSPHERE_STRIDE =
  INTERIOR_ATMOSPHERE_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const INTERIOR_ATMOSPHERE_FRAME_COUNT = config.parameters.interiorAtmosphereFrameCount;
const INTERIOR_ATMOSPHERE_COLUMNS = config.parameters.interiorAtmosphereColumns;
const INTERIOR_ATMOSPHERE_ROWS = config.parameters.interiorAtmosphereRows;
const INTERIOR_ATMOSPHERE_GRID_WIDTH =
  INTERIOR_ATMOSPHERE_COLUMNS * INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_DEFAULT_X =
  INTERIOR_ATMOSPHERE_GRID_WIDTH + INTERIOR_ATMOSPHERE_GUTTER;
const INTERIOR_ATMOSPHERE_DEFAULT_Y = INTERIOR_ATMOSPHERE_GUTTER;
const INTERIOR_ATMOSPHERE_WIDTH = INTERIOR_ATMOSPHERE_GRID_WIDTH +
  PLANET_FIXED_MATERIAL_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const INTERIOR_ATMOSPHERE_HEIGHT =
  INTERIOR_ATMOSPHERE_ROWS * INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_ROW_WIDTH = INTERIOR_ATMOSPHERE_GRID_WIDTH;
const INTERIOR_ATMOSPHERE_ROW_HEIGHT = INTERIOR_ATMOSPHERE_STRIDE;
const INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE =
  PLANET_FIXED_MATERIAL_SIZE + INTERIOR_ATMOSPHERE_GUTTER * 2;
const PLANET_FIXED_MATERIAL_CONTENT_SCALE = config.parameters.planetFixedMaterialContentScale;
const PLANET_FIXED_MATERIAL_COVERAGE_SCALE = config.parameters.planetFixedMaterialCoverageScale;
const PLANET_FIXED_MATERIAL_DEPTH_BIAS = config.parameters.planetFixedMaterialDepthBias;
const PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING = config.parameters.planetOrbitMaterialSilhouetteSupersampling;
const ATMOSPHERE_COLOR = config.parameters.atmosphereColor;
const ATMOSPHERE_MAXIMUM_ALPHA = config.parameters.atmosphereMaximumAlpha;
const ATMOSPHERE_LIMB_EXPONENT = config.parameters.atmosphereLimbExponent;
const ATMOSPHERE_NIGHT_FLOOR = config.parameters.atmosphereNightFloor;
const OBJECT_REFERENCE_ROTATION_SECONDS = config.parameters.objectReferenceRotationSeconds;
const OBJECT_EQUATOR_CLOUD_ROTATION_SECONDS = config.parameters.objectEquatorCloudRotationSeconds;
const OBJECT_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS = config.parameters.objectHighLatitudeCloudRotationSeconds;
const PRESENTATION_TIME_SCALE = OBJECT_REFERENCE_ROTATION_SECONDS /
  PLANET_ROTATION_SECONDS;
const OBJECT_OBLIQUITY_DEGREES = config.parameters.objectObliquityDegrees;
const OBJECT_PRESENTATION_NODE_DEGREES = config.parameters.objectPresentationNodeDegrees;
const CAMERA_ORBITAL_ELEVATION_DEGREES = config.parameters.cameraOrbitalElevationDegrees;
const CAMERA_ZOOM = config.parameters.cameraZoom;
const CAMERA_ROTATION_X_DEGREES = 90 - CAMERA_ORBITAL_ELEVATION_DEGREES;
const CAMERA_ORBIT_MINIMUM_CONTROL_PITCH_DEGREES = config.parameters.cameraOrbitMinimumControlPitchDegrees;
const CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES = config.parameters.cameraOrbitMaximumControlPitchDegrees;
const CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES = config.parameters.cameraOrbitMaximumScenePitchDegrees;
const MESH_ROTATION_Z = config.parameters.meshRotationZ;
const BODY_VISIBILITY_FRAME_COUNT = config.parameters.bodyVisibilityFrameCount;
const BODY_VISIBILITY_RANGE_BANK_COUNT = config.parameters.bodyVisibilityRangeBankCount;
const BODY_VISIBILITY_PITCH_SAMPLES_PER_RANGE = config.parameters.bodyVisibilityPitchSamplesPerRange;
const BODY_VISIBILITY_PHASE_SAMPLES_PER_STATE = config.parameters.bodyVisibilityPhaseSamplesPerState;
const BODY_VISIBILITY_PERSPECTIVE_PX = config.parameters.bodyVisibilityPerspectivePx;
const POINT_LOCAL_SCALE = 50 / CAMERA_ZOOM;
const RING_POINT_SOURCE_OPACITY_RANGE = config.parameters.ringPointSourceOpacityRange;
const RING_POINT_PRESENTATION_OPACITY_RANGE = config.parameters.ringPointPresentationOpacityRange;
const TILE_SIZE = config.parameters.tileSize;
const SEAM_BLEED = config.parameters.seamBleed;
const PLANET_SEAM_BLEED = config.parameters.planetSeamBleed;
const SOLAR_EFFECTIVE_TEMPERATURE_KELVIN = config.parameters.solarEffectiveTemperatureKelvin;
const OBJECT_SOLAR_ALBEDO_MULTIPLIER = config.parameters.objectSolarAlbedoMultiplier;
const GLOBE_AMBIENT_INTENSITY = config.parameters.globeAmbientIntensity;
const GLOBE_OREN_NAYAR_ROUGHNESS = config.parameters.globeOrenNayarRoughness;
const GLOBE_TERMINATOR_SMOOTHSTEP = config.parameters.globeTerminatorSmoothstep;
const LIGHTING = Object.freeze({
  directionalLight: Object.freeze({
    direction: PREPARED_RING_SOURCE.shadowModel.worldLightDirection,
    color: OBJECT_SOLAR_ALBEDO_MULTIPLIER,
    intensity: Math.PI,
  }),
  ambientLight: Object.freeze({
    color: OBJECT_SOLAR_ALBEDO_MULTIPLIER,
    intensity: GLOBE_AMBIENT_INTENSITY * Math.PI,
  }),
});
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "baked" as const,
  seamBleed: SEAM_BLEED,
  ...LIGHTING,
});

const PLANET_SOURCE_TEXTURE_PATH = resolve(sourceDirectory, config.sources.surface);
const POLAR_OBSERVATION_POLAR_SOURCE_PATH = resolve(sourceDirectory, config.sources.polarObservation);
const PLANET_SURFACE_TEXTURE_PATH = resolve(stagingDirectory, config.files.surface);
const PLANET_BODY_SURFACE_TEXTURE_PATH = resolve(publicDirectory, config.files.bodySurface);
const PLANET_POLAR_TEXTURE_PATH = resolve(publicDirectory, config.files.poles);
const PLANET_FIXED_MATERIAL_TEXTURE_PATH = resolve(stagingDirectory, config.files.fixedMaterial);
const PLANET_FIXED_MATERIAL_SOURCE_PATH = resolve(sourceDirectory, config.sources.approvedMaterial);
const PLANET_ORBIT_MATERIAL_TEXTURE_PATH = resolve(stagingDirectory, config.files.orbitMaterial);
const orbitMaterialRowTextureUrl = (rowIndex:number) =>
  `${config.publicPrefix}${config.namespace}-orbit-material-row-${String(rowIndex).padStart(2, "0")}.webp`;
const orbitMaterialVariantDefaultTextureUrl = (variantId:string) =>
  variantId === DEFAULT_LENS_ID
    ? PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL
    : `${config.publicPrefix}${config.namespace}-orbit-material-${variantId}-default.webp`;
const orbitMaterialVariantDefaultTexturePath = (variantId:string) =>
  publicTexturePath(orbitMaterialVariantDefaultTextureUrl(variantId));
const orbitMaterialVariantRowTextureUrl = (variantId:string, rowIndex:number) =>
  variantId === DEFAULT_LENS_ID
    ? orbitMaterialRowTextureUrl(rowIndex)
    : `${config.publicPrefix}${config.namespace}-orbit-material-${variantId}-row-${
      String(rowIndex).padStart(2, "0")}.webp`;
const orbitMaterialVariantRowTexturePath = (variantId:string, rowIndex:number) =>
  publicTexturePath(orbitMaterialVariantRowTextureUrl(variantId, rowIndex));
const PREPARED_Q75_ORBIT_ASSET_URLS = new Set([
  PLANET_ORBIT_MATERIAL_DEFAULT_TEXTURE_URL,
  ...[5, 6, 7].map(orbitMaterialRowTextureUrl),
]);
const INTERIOR_ATMOSPHERE_TEXTURE_PATH = resolve(stagingDirectory, config.files.interiorAtmosphere);
const interiorAtmosphereShardTextureUrl = (assetUrl:string, suffix:string) =>
  assetUrl.replace(/\.webp$/, `-${suffix}.webp`);
const interiorAtmosphereShardTexturePath = (assetUrl:string, suffix:string) =>
  publicTexturePath(interiorAtmosphereShardTextureUrl(assetUrl, suffix));
const RING_TEXTURE_PATH = resolve(publicDirectory, config.files.rings);

function spherePoint(latitude:number, longitude:number) { return ellipsoidPoint(latitude, longitude, { equatorialRadius: EQUATORIAL_RADIUS, polarRadius: POLAR_RADIUS }); }

function createPolarCapPolygon(pole:"north"|"south", role = "surface"): LayeredPolygon {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const isInner = role.startsWith("inner");
  const isMaterial = role.endsWith("material");
  const radius = PLANET_POLAR_RADIUS * (
    isInner
      ? PLANET_POLAR_INNER_OVERLAP
      : isMaterial
        ? PLANET_POLAR_MATERIAL_OVERLAP
        : PLANET_POLAR_SURFACE_OVERLAP
  );
  const planeOffset = (isInner ? -PLANET_POLAR_INNER_INSET : 0) +
    (isMaterial ? PLANET_POLAR_MATERIAL_OFFSET : 0);
  const z = sign * (PLANET_POLAR_PLANE_Z + planeOffset);
  const vertices:Vec3[] = north
    ? [[-radius, -radius, z], [radius, -radius, z],
      [radius, radius, z], [-radius, radius, z]]
    : [[-radius, radius, z], [radius, radius, z],
      [radius, -radius, z], [-radius, -radius, z]];
  const uvs:Vec2[] = north
    ? [[0, 0], [1, 0], [1, 1], [0, 1]]
    : [[0, 1], [1, 1], [1, 0], [0, 0]];
  const tile = isInner
    ? isMaterial
      ? PLANET_POLAR_INNER_MATERIAL_TILE[pole]
      : PLANET_POLAR_INNER_SURFACE_TILE[pole]
    : isMaterial
      ? PLANET_POLAR_MATERIAL_TILE[pole]
      : PLANET_POLAR_SURFACE_TILE[pole];
  return {
    latitudeIndex: north ? LATITUDE_SEGMENTS - 1 : 0,
    vertices,
    uvs,
    texture: PLANET_POLAR_TEXTURE_URL,
    textureImageSource: {
      url: PLANET_POLAR_TEXTURE_URL,
      width: PLANET_POLAR_TEXTURE_WIDTH,
      height: PLANET_POLAR_TEXTURE_HEIGHT,
      sourceRect: {
        x: tile * PLANET_POLAR_TEXTURE_SIZE,
        y: 0,
        width: PLANET_POLAR_TEXTURE_SIZE,
        height: PLANET_POLAR_TEXTURE_SIZE,
      },
    },
    texturePresentation: {
      backend: "image", lighting: "source", projection: "projective",
    },
    color: "#ffffff",
    polarCap: pole,
    polarRole: role,
  };
}

function createUvSpherePolygons(surfaceOverlap = SURFACE_OVERLAP) {
  const polygons:LayeredPolygon[] = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      polygons.push(createPolarCapPolygon(
        latitudeIndex === 0 ? "south" : "north",
      ));
      continue;
    }
    const v0 = latitudeIndex / LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const u0 = longitudeIndex / LONGITUDE_SEGMENTS;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const latitudeOverlap = Math.PI / LATITUDE_SEGMENTS * surfaceOverlap;
      const longitudeOverlap = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
      const surfaceLatitude0 = Math.max(-Math.PI / 2, latitude0 - latitudeOverlap);
      const surfaceLatitude1 = Math.min(Math.PI / 2, latitude1 + latitudeOverlap);
      const surfaceLongitude0 = longitude0 - longitudeOverlap;
      const surfaceLongitude1 = surfaceOverlap === 0 &&
          longitudeIndex === LONGITUDE_SEGMENTS - 1
        ? 0
        : longitude1 + longitudeOverlap;
      const southWest = spherePoint(surfaceLatitude0, surfaceLongitude0);
      const southEast = spherePoint(surfaceLatitude0, surfaceLongitude1);
      const northEast = spherePoint(surfaceLatitude1, surfaceLongitude1);
      const northWest = spherePoint(surfaceLatitude1, surfaceLongitude0);
      const textureFaceIndex =
        (latitudeIndex - 1) * LONGITUDE_SEGMENTS + longitudeIndex;
      const sourceRect = {
        x: longitudeIndex * PLANET_SOURCE_CELL_WIDTH,
        y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * PLANET_SOURCE_CELL_HEIGHT,
        width: PLANET_SOURCE_CELL_WIDTH,
        height: PLANET_SOURCE_CELL_HEIGHT,
      };
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [southWest, southEast, northEast, northWest],
        uvs: [[u0, v0], [u0 + 1 / LONGITUDE_SEGMENTS, v0],
          [u0 + 1 / LONGITUDE_SEGMENTS, v1], [u0, v1]],
        texture: PLANET_BODY_SURFACE_TEXTURE_URL,
        textureImageSource: {
          url: PLANET_BODY_SURFACE_TEXTURE_URL,
          width: PLANET_SOURCE_TEXTURE_WIDTH,
          height: PLANET_SOURCE_TEXTURE_HEIGHT,
          sourceRect,
        },
        texturePresentation: {
          backend: "image", lighting: "source", projection: "projective",
        },
        color: "#c3a36f",
        lightingFaceIndex: textureFaceIndex,
      });
    }
  }
  return polygons;
}

function prepareBodySeamEdges() {
  const topology = createUvSpherePolygons(0);
  const seamEdges = buildSeamBleedPolygonEdges(topology, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
  });
  for (let index = 0; index < topology.length; index += 1) {
    const polygon = topology[index];
    if (polygon.longitudeIndex === 0 && !seamEdges.get(index)?.has(3)) {
      throw new Error(
        `Ellipsoid latitude ${polygon.latitudeIndex} west wrap edge is not shared.`,
      );
    }
    if (polygon.longitudeIndex === LONGITUDE_SEGMENTS - 1 &&
        !seamEdges.get(index)?.has(1)) {
      throw new Error(
        `Ellipsoid latitude ${polygon.latitudeIndex} east wrap edge is not shared.`,
      );
    }
  }
  return seamEdges;
}

function createRingPlane(
  textureUrl = RING_TEXTURE_URL,
  elevation = 0,
  textureSize = PREPARED_RING_SOURCE.textureSize,
  radius = RING_OUTER_RADIUS,
): LayeredPolygon {
  return {
    vertices: [
      [-radius, -radius, elevation], [radius, -radius, elevation],
      [radius, radius, elevation], [-radius, radius, elevation],
    ],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    texture: textureUrl,
    textureImageSource: {
      url: textureUrl,
      width: textureSize,
      height: textureSize,
      sourceRect: {
        x: 0, y: 0,
        width: textureSize,
        height: textureSize,
      },
    },
    texturePresentation: {
      backend: "image", lighting: "source", projection: "projective",
    },
    color: "#c8b58d",
    doubleSided: true,
  };
}

function preparedAtlasDimensions(width:number, height:number) {
  return (width === 64 ? "" :
    `;--polycss-atlas-width:${formatCssLength(width)}`) +
    (height === 64 ? "" :
      `;--polycss-atlas-height:${formatCssLength(height)}`);
}

function textureStyle(polygon:LayeredPolygon, index:number, seamEdges?:ComputeTextureAtlasPlanOptions['seamEdges']|null, seamBleed = SEAM_BLEED) {
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
  if (!plan || !geometry) throw new Error(`Texture leaf ${index} did not prepare.`);
  const preparedLighting = polygon.lightingFaceIndex !== undefined && Number.isSafeInteger(polygon.lightingFaceIndex);
  const sourceFittedGeometry = preparedLighting
    ? fitTextureGeometry(geometry, PLANET_RASTER_CELL_SIZE, PLANET_RASTER_CELL_SIZE)
    : geometry;
  const fittedGeometry = preparedLighting
    ? fitProjectiveTextureGeometryToStableLayout(sourceFittedGeometry)
    : sourceFittedGeometry;
  const surfacePresentation = preparedLighting
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: PLANET_RASTER_SOURCE_WIDTH,
      sourceHeight: PLANET_RASTER_SOURCE_HEIGHT,
      sourceRect: {
        x: polygon.longitudeIndex! * PLANET_RASTER_CELL_SIZE,
        y: (LATITUDE_SEGMENTS - 1 - polygon.latitudeIndex!) *
          PLANET_RASTER_CELL_SIZE,
        width: PLANET_RASTER_CELL_SIZE,
        height: PLANET_RASTER_CELL_SIZE,
      },
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fittedGeometry.backgroundPosition,
      backgroundSize: fittedGeometry.backgroundSize,
      leafWidth: fittedGeometry.leafWidth,
      leafHeight: fittedGeometry.leafHeight,
      bandCount: LATITUDE_SEGMENTS,
      gutter: PLANET_RASTER_GUTTER,
      overscan: PLANET_RASTER_OVERSCAN,
    })
    : fittedGeometry;
  const backgroundPositionX = surfacePresentation.backgroundPosition[0] === 0
    ? "0px"
    : formatCssLength(surfacePresentation.backgroundPosition[0]);
  const backgroundPositionY = surfacePresentation.backgroundPosition[1] === 0
    ? "0px"
    : formatCssLength(surfacePresentation.backgroundPosition[1]);
  const backgroundPosition = `${backgroundPositionX} ${backgroundPositionY}`;
  const surfaceBackgroundSize =
    `${formatCssLength(surfacePresentation.backgroundSize[0])} ` +
    formatCssLength(surfacePresentation.backgroundSize[1]);
  const preparedBackgroundImages = preparedLighting
    ? "var(--polycss-projective-texture-image)"
    : `url(${fittedGeometry.url})`;
  const style = `transform:matrix3d(${fittedGeometry.matrix})` +
    preparedAtlasDimensions(
      fittedGeometry.leafWidth,
      fittedGeometry.leafHeight,
    ) +
    (preparedLighting
      ? `;--${config.namespace}-surface-position:${backgroundPosition}`
      : "") +
    `;background-image:${preparedBackgroundImages}` +
    `;background-position:${backgroundPosition}` +
    `;background-size:${surfaceBackgroundSize}`;
  return {
    style,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fittedGeometry.matrix,
      polygon.polarCap && polygon.textureImageSource.sourceRect
        ? polarCapRasterScale(PROJECTIVE_TEXTURE_RASTER_SCALE, polygon.textureImageSource.sourceRect.width, fittedGeometry.leafWidth)
        : PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    sourceRect: fittedGeometry.sourceRect,
    leafWidth: fittedGeometry.leafWidth,
    leafHeight: fittedGeometry.leafHeight,
    projection: fittedGeometry.projection,
    lighting: preparedLighting ? "baked" : "source",
    lightingOverlay: false,
  };
}

function canonicalRingTextureStyle() {
  const leaf = textureStyle(createRingPlane(), 0);
  const source = `background-image:url(${RING_TEXTURE_URL})`;
  const canonical = `background-image:url(\"${RING_TEXTURE_2X_URL}\")`;
  if (!leaf.style.includes(source)) {
    throw new Error("Prepared Ellipsoid ring texture style is incompatible.");
  }
  return {
    ...leaf,
    style: leaf.style.replace(source, canonical),
  };
}

function croppedRingShadowTextureStyle() {
  const sourceSize = PREPARED_RING_SOURCE.shadowTextureSourceSize;
  const bounds = PREPARED_RING_SOURCE.shadowTextureBounds;
  const leaf = textureStyle(createRingPlane(
    RING_SHADOW_TEXTURE_URL,
    0.04,
    sourceSize,
  ), 1);
  const fullPosition = "background-position:0px 0px";
  const fullSize = `background-size:${formatCssLength(sourceSize)} ` +
    formatCssLength(sourceSize);
  if (!leaf.style.includes(fullPosition) || !leaf.style.includes(fullSize)) {
    throw new Error("Prepared Ellipsoid ring-shadow crop is incompatible.");
  }
  return {
    ...leaf,
    style: leaf.style
      .replace(
        fullPosition,
        `background-position:${formatCssLength(bounds.x)} ` +
          formatCssLength(bounds.y),
      )
      .replace(
        fullSize,
        `background-size:${formatCssLength(bounds.width)} ` +
          formatCssLength(bounds.height),
      ),
    preparedCrop: {
      sourceSize,
      bounds,
      transparentGutter:
        PREPARED_RING_SOURCE.shadowTextureTransparentGutter,
      retainedLogicalPlaneSize: sourceSize,
      runtimeWork: false,
    },
  };
}

function cropRingMotionLeaf<T extends {style:string}>(leaf:T, plate:RadialPreparation['ringPlates'][number]) {
  const { x, y, width, height } = plate.textureCropBounds;
  const fullPosition = "background-position:0px 0px";
  const fullBackground =
    `background-size:${formatCssLength(plate.textureSize)} ` +
    formatCssLength(plate.textureSize);
  const croppedBackground =
    `background-size:${formatCssLength(width)} ${formatCssLength(height)}`;
  if (!leaf.style.includes(fullPosition) ||
      !leaf.style.includes(fullBackground)) {
    throw new Error(`Prepared Ellipsoid ${plate.population} crop is incompatible.`);
  }
  return {
    ...leaf,
    style: leaf.style
      .replace(
        fullPosition,
        `background-position:${formatCssLength(x)} ${formatCssLength(y)}`,
      )
      .replace(fullBackground, croppedBackground),
  };
}

function canonicalRingMotionPlateStyle(plate:RadialPreparation['ringPlates'][number], index:number) {
  const leaf = cropRingMotionLeaf(textureStyle(createRingPlane(
    plate.textureUrl,
    plate.elevation,
    plate.textureSize,
    plate.displayRadius,
  ), index + 2), plate);
  const source = `background-image:url(${plate.textureUrl})`;
  const canonical = `background-image:url(\"${plate.texture2xUrl}\")`;
  if (!leaf.style.includes(source)) {
    throw new Error(`Prepared Ellipsoid ${plate.population} plate is incompatible.`);
  }
  return {
    ...plate,
    preparedCrop: {
      sourceSize: plate.textureSize,
      bounds: plate.textureCropBounds,
      transparentGutter: plate.textureTransparentGutter,
      runtimeWork: false,
    },
    leaf: {
      ...leaf,
      style: leaf.style.replace(source, canonical),
    },
  };
}

function preparedCanonicalTextureStyle(
  polygon:LayeredPolygon,
  index:number,
  {
    url2x,
    presentationWidth,
    presentationHeight,
    backfaceVisible = false,
    sharedTexture = false,
  }: {url2x:string;presentationWidth:number;presentationHeight:number;backfaceVisible?:boolean;sharedTexture?:boolean},
) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed: 0,
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !geometry) {
    throw new Error(`Prepared Ellipsoid interior leaf ${index} did not prepare.`);
  }
  const fitted = fitTextureGeometry(
    geometry,
    presentationWidth,
    presentationHeight,
  );
  const backgroundPosition = fitted.backgroundPosition
    .map((value) => value === 0 ? "0px" : formatCssLength(value))
    .join(" ");
  const backgroundSize = fitted.backgroundSize
    .map((value) => formatCssLength(value))
    .join(" ");
  return Object.freeze({
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(fitted.leafWidth, fitted.leafHeight) +
      (sharedTexture
        ? ""
        : `;background-image:url(\"${url2x}\")`) +
      `;background-position:${backgroundPosition}` +
      (sharedTexture ? "" : `;background-size:${backgroundSize}`) +
      (backfaceVisible ? ";backface-visibility:visible" : ""),
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      fitted.matrix,
      polygon.polarCap && polygon.textureImageSource.sourceRect
        ? polarCapRasterScale(PROJECTIVE_TEXTURE_RASTER_SCALE, polygon.textureImageSource.sourceRect.width, fitted.leafWidth)
        : PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    sourceRect: fitted.sourceRect,
    leafWidth: fitted.leafWidth,
    leafHeight: fitted.leafHeight,
    projection: fitted.projection,
    lighting: "prepared-source",
    lightingOverlay: false,
  });
}

function normalizeDegrees(value:number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function interiorLongitudeRemoved(longitudeDegrees:number) {
  return Math.abs(normalizeDegrees(
    longitudeDegrees - INTERIOR_CUTAWAY.centerLongitudeDegrees,
  )) <= INTERIOR_CUTAWAY.widthDegrees / 2;
}

function scaledSpherePoint(latitude:number, longitude:number, radiusScale:number):Vec3 {
  const latitudeRadius = Math.cos(latitude);
  return [
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * radiusScale * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * radiusScale * Math.sin(latitude),
  ];
}

function createInteriorPolarCapPolygon(pole:Pole, radiusScale:number, asset:SurfaceAsset):LayeredPolygon {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI / INTERIOR_LATITUDE_SEGMENTS;
  const radius = EQUATORIAL_RADIUS * radiusScale *
    Math.cos(boundaryLatitude) * 1.025;
  const z = sign * (
    POLAR_RADIUS * radiusScale * Math.sin(boundaryLatitude) + 0.05
  );
  return {
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
      width: asset.width,
      height: asset.height,
      sourceRect: {
        x: north ? 0 : asset.height,
        y: 0,
        width: asset.height,
        height: asset.height,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    polarCap: pole,
  };
}

function createInteriorShellPolygons({ radiusScale, surface, poles, cutaway }:ShellOptions) {
  const polygons:LayeredPolygon[] = [];
  for (let latitudeIndex = 1;
    latitudeIndex < INTERIOR_LATITUDE_SEGMENTS - 1;
    latitudeIndex += 1) {
    const v0 = latitudeIndex / INTERIOR_LATITUDE_SEGMENTS;
    const v1 = (latitudeIndex + 1) / INTERIOR_LATITUDE_SEGMENTS;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < INTERIOR_LONGITUDE_SEGMENTS;
      longitudeIndex += 1) {
      const centerLongitudeDegrees = (longitudeIndex + 0.5) *
        360 / INTERIOR_LONGITUDE_SEGMENTS;
      if (cutaway && interiorLongitudeRemoved(centerLongitudeDegrees)) continue;
      const u0 = longitudeIndex / INTERIOR_LONGITUDE_SEGMENTS;
      const u1 = (longitudeIndex + 1) / INTERIOR_LONGITUDE_SEGMENTS;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = u1 * Math.PI * 2;
      polygons.push({
        vertices: [
          scaledSpherePoint(latitude0, longitude0, radiusScale),
          scaledSpherePoint(latitude0, longitude1, radiusScale),
          scaledSpherePoint(latitude1, longitude1, radiusScale),
          scaledSpherePoint(latitude1, longitude0, radiusScale),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: surface.url,
        textureImageSource: {
          url: surface.url,
          width: surface.width,
          height: surface.height,
          sourceRect: {
            x: longitudeIndex * surface.width / INTERIOR_LONGITUDE_SEGMENTS,
            y: (INTERIOR_LATITUDE_SEGMENTS - 1 - latitudeIndex) *
              surface.height / INTERIOR_LATITUDE_SEGMENTS,
            width: surface.width / INTERIOR_LONGITUDE_SEGMENTS,
            height: surface.height / INTERIOR_LATITUDE_SEGMENTS,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
      });
    }
  }
  polygons.push(
    createInteriorPolarCapPolygon("north", radiusScale, poles),
    createInteriorPolarCapPolygon("south", radiusScale, poles),
  );
  return polygons;
}

function prepareInteriorShell(options:ShellOptions) {
  return Object.freeze(createInteriorShellPolygons(options).map(
    (polygon, index) => Object.freeze({
      tag: "s",
      ...(polygon.polarCap
        ? { className: `${config.namespace}-interior-pole ${config.namespace}-interior-pole-${polygon.polarCap}` }
        : {}),
      ...preparedCanonicalTextureStyle(polygon, index, {
        url2x: polygon.polarCap ? options.poles.url2x : options.surface.url2x,
        presentationWidth: polygon.polarCap ? 256 : 64,
        presentationHeight: polygon.polarCap ? 256 : 64,
        sharedTexture: !polygon.polarCap,
      }),
    }),
  ));
}

function createInteriorSectionPolygon(longitudeDegrees:number, faceIndex:number):LayeredPolygon {
  const longitude = longitudeDegrees * Math.PI / 180;
  const direction = [Math.cos(longitude), Math.sin(longitude)];
  const asset = requireViews().assets.section;
  return {
    vertices: [
      [0, 0, -POLAR_RADIUS],
      [direction[0] * EQUATORIAL_RADIUS,
        direction[1] * EQUATORIAL_RADIUS, -POLAR_RADIUS],
      [direction[0] * EQUATORIAL_RADIUS,
        direction[1] * EQUATORIAL_RADIUS, POLAR_RADIUS],
      [0, 0, POLAR_RADIUS],
    ],
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
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
  };
}

function prepareInteriorSectionLeaves() {
  const { centerLongitudeDegrees, widthDegrees } =
    requireViews().cutaway;
  return Object.freeze([
    centerLongitudeDegrees - widthDegrees / 2,
    centerLongitudeDegrees + widthDegrees / 2,
  ].map((longitudeDegrees, index) => {
    const polygon = createInteriorSectionPolygon(longitudeDegrees, index);
    return Object.freeze({
      tag: "s",
      className: config.labels.label002,
      ...preparedCanonicalTextureStyle(polygon, index, {
        url2x: requireViews().assets.section.url2x,
        presentationWidth: 256,
        presentationHeight: 512,
        backfaceVisible: true,
      }),
    });
  }));
}

function createCutawayOuterPolarCapPolygon(pole:Pole, asset:SurfaceAsset) {
  const polygon = createPolarCapPolygon(pole);
  return {
    ...polygon,
    texture: asset.url,
    textureImageSource: {
      url: asset.url,
      width: asset.width,
      height: asset.height,
      sourceRect: {
        x: pole === "north" ? 0 : asset.height,
        y: 0,
        width: asset.height,
        height: asset.height,
      },
    },
  };
}

function prepareCutawayOuterPolarLeaves() {
  const asset = requireViews().assets.outerPoles.normal;
  return Object.freeze((["south", "north"] as const).map((pole, index) => ({
    latitudeIndex: pole === "north" ? LATITUDE_SEGMENTS - 1 : 0,
    leaf: Object.freeze({
      tag: "s",
      className: `${config.namespace}-cutaway-outer-pole ${config.namespace}-cutaway-outer-pole-${pole}`,
      ...preparedCanonicalTextureStyle(
        createCutawayOuterPolarCapPolygon(pole, asset),
        index,
        {
          url2x: asset.url2x,
          presentationWidth: 256,
          presentationHeight: 256,
        },
      ),
    }),
  })));
}

function prepareFixedMaterialPlane({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  objectLight,
  objectView,
  scenePitchDegrees,
  systemObliquityDegrees,
  textureUrl = PLANET_FIXED_MATERIAL_TEXTURE_URL,
  outputSize = PLANET_FIXED_MATERIAL_SIZE,
  preparedMeshSilhouette = false,
  materialMode = "full",
}:FixedMaterialOptions) {
  const screenToObject = (vector:ReadonlyVector3) => {
    let result = rotateY(
      vector,
      scenePitchDegrees * Math.PI / 180,
    );
    result = rotateZ(
      result,
      -OBJECT_PRESENTATION_NODE_DEGREES * Math.PI / 180,
    );
    result = rotateX(
      result,
      -systemObliquityDegrees * Math.PI / 180,
    );
    return rotateZ(result, -MESH_ROTATION_Z * Math.PI / 180);
  };
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  if (view.some((component, index) =>
    Math.abs(component - objectView[index]) > 1e-12)) {
    throw new Error("Ellipsoid fixed-material view projection drifted.");
  }
  const projectedRadius = (direction:ReadonlyVector3) => Math.sqrt(
    EQUATORIAL_RADIUS ** 2 *
      (direction[0] ** 2 + direction[1] ** 2) +
    POLAR_RADIUS ** 2 * direction[2] ** 2,
  );
  const radiusX = projectedRadius(right);
  const radiusY = projectedRadius(down);
  const frontDepth = projectedRadius(view);
  const scaledRadiusX = radiusX * PLANET_FIXED_MATERIAL_COVERAGE_SCALE;
  const scaledRadiusY = radiusY * PLANET_FIXED_MATERIAL_COVERAGE_SCALE;
  const silhouetteCoverage = preparedMeshSilhouette
    ? prepareProjectedMeshSilhouetteCoverage({
      right,
      down,
      scaledRadiusX,
      scaledRadiusY,
      outputSize,
      supersampling: PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING,
    })
    : null;
  const ringShadowSampleRadiusPixels = preparedMeshSilhouette
    ? ringTextureWidth / outputSize * 0.5
    : 0;
  const output = Buffer.alloc(
    outputSize * outputSize * 4,
  );
  let ringShadowedTexelCount = 0;
  let ringShadowOpacityTotal = 0;
  let maxSampledRingOpacity = 0;
  let visibleRingShadowWeightTotal = 0;
  let visibleRingShadowWeightedColumn = 0;
  let visibleRingShadowWeightedRow = 0;
  let visibleRingShadowMinimumColumn = outputSize;
  let visibleRingShadowMinimumRow = outputSize;
  let visibleRingShadowMaximumColumn = -1;
  let visibleRingShadowMaximumRow = -1;
  let foregroundRingCompositedTexelCount = 0;
  let foregroundRingOpacityTotal = 0;
  for (let row = 0; row < outputSize; row += 1) {
    const screenY = (
      (row + 0.5) / outputSize * 2 - 1
    ) * radiusY;
    for (let column = 0; column < outputSize; column += 1) {
      const screenX = (
        (column + 0.5) / outputSize * 2 - 1
      ) * radiusX;
      let sampledScreenX = screenX;
      let sampledScreenY = screenY;
      let coverageOrigin = mapVector3((axis) =>
        right[axis] * sampledScreenX + down[axis] * sampledScreenY);
      let coverageHit = intersectViewRayWithEllipsoidSurface(coverageOrigin, view);
      if (!coverageHit) continue;
      const materialSampleScale =
        PLANET_FIXED_MATERIAL_COVERAGE_SCALE /
          PLANET_FIXED_MATERIAL_CONTENT_SCALE;
      const materialOrigin = mapVector3((axis) =>
        right[axis] * sampledScreenX * materialSampleScale +
          down[axis] * sampledScreenY * materialSampleScale);
      let hit = intersectViewRayWithEllipsoidSurface(materialOrigin, view);
      if (!hit) {
        let lowerScale = 1;
        let upperScale = materialSampleScale;
        hit = coverageHit;
        for (let step = 0; step < 12; step += 1) {
          const sampleScale = (lowerScale + upperScale) / 2;
          const candidateOrigin = mapVector3((axis) =>
            right[axis] * sampledScreenX * sampleScale +
              down[axis] * sampledScreenY * sampleScale);
          const candidateHit = intersectViewRayWithEllipsoidSurface(candidateOrigin, view);
          if (candidateHit) {
            lowerScale = sampleScale;
            hit = candidateHit;
          } else {
            upperScale = sampleScale;
          }
        }
      }
      const lambert = Math.max(0, dotVector(hit.normal, objectLight));
      const ringOpacity = ringData
        ? sampleRingShadowOpacity(
          hit.position,
          objectLight,
          ringData,
          ringTextureWidth,
          ringShadowSampleRadiusPixels,
        )
        : 0;
      const directTransmission = mix(
        1,
        RING_SHADOW_DIRECT_TRANSMISSION,
        ringOpacity,
      );
      if (lambert > 0 && ringOpacity > 1 / 255) {
        ringShadowedTexelCount += 1;
        ringShadowOpacityTotal += ringOpacity;
        maxSampledRingOpacity = Math.max(maxSampledRingOpacity, ringOpacity);
        const visibleShadowWeight = ringOpacity * lambert;
        visibleRingShadowWeightTotal += visibleShadowWeight;
        visibleRingShadowWeightedColumn += column * visibleShadowWeight;
        visibleRingShadowWeightedRow += row * visibleShadowWeight;
        visibleRingShadowMinimumColumn = Math.min(
          visibleRingShadowMinimumColumn,
          column,
        );
        visibleRingShadowMinimumRow = Math.min(
          visibleRingShadowMinimumRow,
          row,
        );
        visibleRingShadowMaximumColumn = Math.max(
          visibleRingShadowMaximumColumn,
          column,
        );
        visibleRingShadowMaximumRow = Math.max(
          visibleRingShadowMaximumRow,
          row,
        );
      }
      const tint = textureTintFactors(
        LIGHTING.directionalLight.intensity *
          prepareGlobeDiffusePower(lambert) * directTransmission,
        LIGHTING.directionalLight.color,
        LIGHTING.ambientLight.color,
        LIGHTING.ambientLight.intensity,
      );
      const outputOffset = (row * outputSize + column) * 4;
      const atmosphereAlpha = preparedAtmosphereOpacity(
        hit.normal,
        objectLight,
        view,
      );
      let cutawayMaterialRemoved = false;
      if (materialMode === "cutaway-full") {
        const longitudeDegrees = Math.atan2(
          hit.position[1],
          hit.position[0],
        ) * 180 / Math.PI;
        cutawayMaterialRemoved = interiorLongitudeRemoved(longitudeDegrees);
      }
      if (!cutawayMaterialRemoved) {
        writePreparedMaterialOverlay(
          output,
          outputOffset,
          tint,
          maximumLightingFactor,
          atmosphereAlpha,
        );
      }
      const surfaceDistance = dotVector(
        subtractVector(coverageHit.position, coverageOrigin),
        view,
      );
      const foregroundRingSample = sampleForegroundRing(
        coverageOrigin,
        view,
        surfaceDistance,
        foregroundRingData,
        ringTextureWidth,
      );
      if (foregroundRingSample) {
        const ringAlpha = foregroundRingSample[3] / 255;
        if (cutawayMaterialRemoved) {
          const destinationAlpha = output[outputOffset + 3] / 255;
          const compositeAlpha = ringAlpha +
            destinationAlpha * (1 - ringAlpha);
          for (let channel = 0; channel < 3; channel += 1) {
            output[outputOffset + channel] = compositeAlpha > 0
              ? Math.round((
                foregroundRingSample[channel] * ringAlpha +
                output[outputOffset + channel] * destinationAlpha *
                  (1 - ringAlpha)
              ) / compositeAlpha)
              : 0;
          }
          output[outputOffset + 3] = Math.round(compositeAlpha * 255);
        } else {
          for (let channel = 0; channel < 3; channel += 1) {
            output[outputOffset + channel] = Math.round(mix(
              output[outputOffset + channel],
              foregroundRingSample[channel],
              ringAlpha,
            ));
          }
        }
        foregroundRingCompositedTexelCount += 1;
        foregroundRingOpacityTotal += ringAlpha;
      }
      if (silhouetteCoverage) {
        output[outputOffset + 3] = Math.round(
          output[outputOffset + 3] *
            silhouetteCoverage[row * outputSize + column] / 255,
        );
      }
    }
  }

  const scaleVector = (vector:ReadonlyVector3, scale:number) =>
    mapVector3((axis) => vector[axis] * scale);
  const addVectors = (...vectors:ReadonlyVector3[]) => mapVector3((axis) =>
    vectors.reduce((sum, vector) => sum + vector[axis], 0));
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
    scaleVector(view, frontDepth + PLANET_FIXED_MATERIAL_DEPTH_BIAS),
  ));
  const matrix = [
    ...basisX, 0,
    ...basisY, 0,
    ...basisZ, 0,
    ...origin, 1,
  ];
  return Object.freeze({
    output,
    matrix: Object.freeze(matrix),
    projection: Object.freeze({
      model: config.labels.label003,
      width: outputSize,
      height: outputSize,
      presentationScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
      radiusX,
      radiusY,
      frontDepth,
      depthBias: PLANET_FIXED_MATERIAL_DEPTH_BIAS,
      silhouetteCoverage: Object.freeze({
        model: config.labels.label004,
        coverageScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
        materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
        rimFill: "prepared-radial-binary-clamp-to-material-limb",
        sourcePixelBleed: 0,
        runtime: false,
      }),
      right,
      down,
      view,
      screenshotDerived: false,
    }),
    leaf: Object.freeze({
      tag: "s",
      style: `transform:matrix3d(${matrix.join(",")})` +
        `;--polycss-atlas-width:${outputSize}px` +
        `;--polycss-atlas-height:${outputSize}px` +
        `;background-image:url(${textureUrl})` +
        `;background-size:${outputSize}px ${outputSize}px` +
        ";backface-visibility:visible",
    }),
    ringShadowedTexelCount,
    meanSampledRingOpacity: Number((ringShadowOpacityTotal /
      Math.max(1, ringShadowedTexelCount)).toFixed(6)),
    maxSampledRingOpacity: Number(maxSampledRingOpacity.toFixed(6)),
    visibleRingShadowCentroid: visibleRingShadowWeightTotal > 0
      ? Object.freeze([
        Number((visibleRingShadowWeightedColumn /
          visibleRingShadowWeightTotal).toFixed(3)),
        Number((visibleRingShadowWeightedRow /
          visibleRingShadowWeightTotal).toFixed(3)),
      ])
      : null,
    visibleRingShadowBounds: visibleRingShadowMaximumColumn >= 0
      ? Object.freeze({
        minimumColumn: visibleRingShadowMinimumColumn,
        minimumRow: visibleRingShadowMinimumRow,
        maximumColumn: visibleRingShadowMaximumColumn,
        maximumRow: visibleRingShadowMaximumRow,
      })
      : null,
    foregroundRingCompositedTexelCount,
    meanForegroundRingOpacity: Number((foregroundRingOpacityTotal /
      Math.max(1, foregroundRingCompositedTexelCount)).toFixed(6)),
  });
}

function prepareOrbitMaterialAtlas({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  defaultFrame,
  approvedReferenceFrameChanged,
  shadowless = false,
}:RingRaster & {defaultFrame:Buffer;approvedReferenceFrameChanged:boolean|null;shadowless?:boolean}) {
  const output = Buffer.alloc(
    PLANET_ORBIT_MATERIAL_WIDTH * PLANET_ORBIT_MATERIAL_HEIGHT * 4,
  );
  const maximumScenePitch = 65;
  const ringShadowMeasurements = [];
  for (let frameIndex = 0;
    frameIndex < PLANET_ORBIT_MATERIAL_FRAME_COUNT;
    frameIndex += 1) {
    const amount = frameIndex / (PLANET_ORBIT_MATERIAL_FRAME_COUNT - 1);
    const scenePitchDegrees = maximumScenePitch * (1 - amount);
    const systemObliquityDegrees = OBJECT_OBLIQUITY_DEGREES *
      scenePitchDegrees / CAMERA_ROTATION_X_DEGREES;
    const objectView = prepareObjectViewDirection(
      scenePitchDegrees,
      systemObliquityDegrees,
    );
    const objectLight = shadowless
      ? objectView
      : prepareObjectLightDirection(systemObliquityDegrees);
    const frame = prepareFixedMaterialPlane({
      ringData,
      foregroundRingData,
      ringTextureWidth,
      maximumLightingFactor,
      objectLight,
      objectView,
      scenePitchDegrees,
      systemObliquityDegrees,
      textureUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
      outputSize: PLANET_ORBIT_MATERIAL_SIZE,
      preparedMeshSilhouette: true,
    });
    ringShadowMeasurements.push(Object.freeze({
      frameIndex,
      scenePitchDegrees: Number(scenePitchDegrees.toFixed(6)),
      shadowedTexelCount: frame.ringShadowedTexelCount,
      visibleCentroid: frame.visibleRingShadowCentroid,
      visibleBounds: frame.visibleRingShadowBounds,
    }));
    const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
    const frameRow = Math.floor(frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS);
    const frameX = frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
      PLANET_ORBIT_MATERIAL_GUTTER;
    const frameY = frameRow * PLANET_ORBIT_MATERIAL_STRIDE +
      PLANET_ORBIT_MATERIAL_GUTTER;
    writeMaterialAtlasTile({
      output,
      outputWidth: PLANET_ORBIT_MATERIAL_WIDTH,
      source: frame.output,
      sourceSize: PLANET_ORBIT_MATERIAL_SIZE,
      frameX,
      frameY,
      gutter: PLANET_ORBIT_MATERIAL_GUTTER,
    });
  }
  writeMaterialAtlasTile({
    output,
    outputWidth: PLANET_ORBIT_MATERIAL_WIDTH,
    source: defaultFrame,
    sourceSize: PLANET_FIXED_MATERIAL_SIZE,
    frameX: PLANET_ORBIT_MATERIAL_DEFAULT_X,
    frameY: PLANET_ORBIT_MATERIAL_DEFAULT_Y,
    gutter: PLANET_ORBIT_MATERIAL_GUTTER,
  });
  const visibleRingShadowMeasurements = ringShadowMeasurements.filter(
    (measurement): measurement is typeof measurement & {visibleCentroid:NonNullable<typeof measurement.visibleCentroid>} => measurement.visibleCentroid !== null,
  );
  if (ringData && visibleRingShadowMeasurements.length < 2) {
    throw new Error("Prepared orbit bank did not move the visible ring shadow.");
  }
  const ringShadowCentroidColumns = visibleRingShadowMeasurements.map(
    ({ visibleCentroid }) => visibleCentroid[0],
  );
  const ringShadowCentroidRows = visibleRingShadowMeasurements.map(
    ({ visibleCentroid }) => visibleCentroid[1],
  );
  return Object.freeze({
    output,
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees: maximumScenePitch,
    preparedMeshSilhouette: Object.freeze({
      model: "prepared-projected-lowpoly-hull-alpha-coverage",
      longitudeCount: LONGITUDE_SEGMENTS,
      latitudeCount: LATITUDE_SEGMENTS,
      supersampling:
        PLANET_ORBIT_MATERIAL_SILHOUETTE_SUPERSAMPLING,
      atlasAlphaOnly: true,
      runtimeWork: false,
    }),
    ringShadowFootprint: Object.freeze({
      model: "prepared-center-weighted-five-tap-orbit-texel-footprint",
      sourceBlurSigmaPixels: RING_SHADOW_FOOTPRINT_BLUR_SIGMA,
      orbitSampleRadiusPixels: Number((
        ringTextureWidth / PLANET_ORBIT_MATERIAL_SIZE * 0.5
      ).toFixed(3)),
      approvedReferenceFrameChanged,
      runtimeWork: false,
    }),
    ringShadowMotionEvidence: Object.freeze({
      model: "prepared-visible-ray-occlusion-centroid-span",
      frameCount: ringShadowMeasurements.length,
      visibleFrameCount: visibleRingShadowMeasurements.length,
      centroidColumnSpan: ringShadowCentroidColumns.length > 0
        ? Number((Math.max(...ringShadowCentroidColumns) -
          Math.min(...ringShadowCentroidColumns)).toFixed(3))
        : 0,
      centroidRowSpan: ringShadowCentroidRows.length > 0
        ? Number((Math.max(...ringShadowCentroidRows) -
          Math.min(...ringShadowCentroidRows)).toFixed(3))
        : 0,
      minimumShadowedTexelCount: Math.min(
        ...ringShadowMeasurements.map(({ shadowedTexelCount }) =>
          shadowedTexelCount),
      ),
      maximumShadowedTexelCount: Math.max(
        ...ringShadowMeasurements.map(({ shadowedTexelCount }) =>
          shadowedTexelCount),
      ),
    }),
  });
}

async function writeVerifiedPreparedShard({
  assetUrl,
  path,
  source,
  sourceBounds,
}: {assetUrl:string;path:string;source:Uint8Array;sourceBounds:{x:number;y:number;width:number;height:number}}) {
  await sharp(source, {
    raw: {
      width: sourceBounds.width,
      height: sourceBounds.height,
      channels: 4,
    },
  })
    .webp({ lossless: true, effort: 6 })
    .toFile(path);
  const q75 = PREPARED_Q75_ORBIT_ASSET_URLS.has(assetUrl)
    ? await optimizePreparedQ75Webp(path)
    : null;
  const asset = await readFile(path);
  const { data, info } = await sharp(asset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const visibleTexelsMatch = visibleRgbaMatches(data, source);
  const alphaMatchesSource = alphaMatches(data, source);
  if (info.width !== sourceBounds.width ||
      info.height !== sourceBounds.height ||
      info.channels !== 4 ||
      !alphaMatchesSource ||
      (!q75 && !visibleTexelsMatch)) {
    throw new Error(`Ellipsoid prepared shard changed texels: ${assetUrl}.`);
  }
  return Object.freeze({
    assetUrl,
    assetBytes: asset.byteLength,
    assetSha256: sha256(asset),
    width: sourceBounds.width,
    height: sourceBounds.height,
    decodedRgbaBytes: sourceBounds.width * sourceBounds.height * 4,
    sourceBounds: Object.freeze(sourceBounds),
    encoding: q75?.encoding === PREPARED_Q75_WEBP_ENCODING
      ? PREPARED_Q75_WEBP_ENCODING
      : "lossless-webp",
    alphaMatchesSource: true,
    visibleTexelsMatchSource: visibleTexelsMatch,
    transparentRgbCanonicalizedByWebp: !data.equals(source),
  });
}

async function writePreparedRuntimeAtlas({
  assetUrl,
  path,
  width,
  height,
  placements,
}: {assetUrl:string;path:string;width:number;height:number;placements:readonly {asset:{assetUrl:string;width:number;height:number};x:number;y:number}[]}) {
  const output = Buffer.alloc(width * height * 4);
  for (const { asset, x, y } of placements) {
    const { data, info } = await sharp(publicTexturePath(asset.assetUrl))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== asset.width || info.height !== asset.height ||
        info.channels !== 4 || x < 0 || y < 0 ||
        x + info.width > width || y + info.height > height) {
      throw new Error(`Ellipsoid runtime atlas placement is invalid: ${assetUrl}.`);
    }
    for (let row = 0; row < info.height; row += 1) {
      const sourceStart = row * info.width * 4;
      const targetStart = ((y + row) * width + x) * 4;
      data.copy(
        output,
        targetStart,
        sourceStart,
        sourceStart + info.width * 4,
      );
    }
  }
  await sharp(output, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(path);
  const bytes = await readFile(path);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 4 ||
      !alphaMatches(data, output) || !visibleRgbaMatches(data, output)) {
    throw new Error(`Ellipsoid runtime atlas changed visible texels: ${assetUrl}.`);
  }
  return Object.freeze({
    assetUrl,
    assetBytes: bytes.byteLength,
    assetSha256: sha256(bytes),
    width,
    height,
    decodedRgbaBytes: width * height * 4,
    encoding: "lossless-webp",
    alphaMatchesSource: true,
    visibleTexelsMatchSource: true,
  });
}

function alphaMatches(candidate:Uint8Array, source:Uint8Array) {
  for (let offset = 3; offset < source.length; offset += 4) {
    if (candidate[offset] !== source[offset]) return false;
  }
  return true;
}

async function prepareOrbitMaterialRuntimeShards({ variantId, path }: {variantId:string;path:string}) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== PLANET_ORBIT_MATERIAL_WIDTH ||
      info.height !== PLANET_ORBIT_MATERIAL_HEIGHT ||
      info.channels !== 4) {
    throw new Error(
      `Ellipsoid orbit material runtime shard source changed: ${variantId}.`,
    );
  }
  const defaultBounds = Object.freeze({
    x: PLANET_ORBIT_MATERIAL_GRID_WIDTH,
    y: 0,
    width: PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE,
    height: PLANET_ORBIT_MATERIAL_DEFAULT_SHARD_SIZE,
  });
  const defaultAsset = await writeVerifiedPreparedShard({
    assetUrl: orbitMaterialVariantDefaultTextureUrl(variantId),
    path: orbitMaterialVariantDefaultTexturePath(variantId),
    source: extractRgbaBounds({ rgba: data, width: info.width, bounds: defaultBounds }),
    sourceBounds: defaultBounds,
  });
  const rows = [];
  for (let rowIndex = 0;
    rowIndex < PLANET_ORBIT_MATERIAL_ROWS;
    rowIndex += 1) {
    const sourceBounds = Object.freeze({
      x: 0,
      y: rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
      width: PLANET_ORBIT_MATERIAL_ROW_WIDTH,
      height: PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
    });
    rows.push(await writeVerifiedPreparedShard({
      assetUrl: orbitMaterialVariantRowTextureUrl(variantId, rowIndex),
      path: orbitMaterialVariantRowTexturePath(variantId, rowIndex),
      source: extractRgbaBounds({ rgba: data, width: info.width, bounds: sourceBounds }),
      sourceBounds,
    }));
  }
  const runtimeAtlas = await writePreparedRuntimeAtlas({
    assetUrl: orbitMaterialVariantTextureUrl(variantId),
    path: orbitMaterialVariantTexturePath(variantId),
    width: PLANET_ORBIT_MATERIAL_WIDTH,
    height: PLANET_ORBIT_MATERIAL_HEIGHT,
    placements: Object.freeze([
      ...rows.map((asset, rowIndex) => Object.freeze({
        asset,
        x: 0,
        y: rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT,
      })),
      Object.freeze({
        asset: defaultAsset,
        x: PLANET_ORBIT_MATERIAL_GRID_WIDTH,
        y: 0,
      }),
    ]),
  });
  const assets = [defaultAsset, ...rows];
  const q75AssetUrls = Object.freeze(assets
    .filter(({ encoding }) => encoding === PREPARED_Q75_WEBP_ENCODING)
    .map(({ assetUrl }) => assetUrl));
  return Object.freeze({
    variantId,
    runtimeAtlas,
    defaultAsset,
    rows: Object.freeze(rows),
    sourceDecodedSha256: sha256(data),
    alphaExactDecodedCropVerification: true,
    selectiveVisibleRgbEncoding: q75AssetUrls.length > 0
      ? PREPARED_Q75_WEBP_ENCODING
      : "none",
    q75AssetUrls,
    exactVisibleDecodedCropVerification:
      assets.every(({ visibleTexelsMatchSource }) => visibleTexelsMatchSource),
  });
}

async function prepareInteriorAtmosphereRuntimeShards({ assetUrl, path }: {assetUrl:string;path:string}) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== INTERIOR_ATMOSPHERE_WIDTH ||
      info.height !== INTERIOR_ATMOSPHERE_HEIGHT ||
      info.channels !== 4) {
    throw new Error(`Ellipsoid interior atmosphere source changed: ${assetUrl}.`);
  }
  const defaultBounds = Object.freeze({
    x: INTERIOR_ATMOSPHERE_GRID_WIDTH,
    y: 0,
    width: INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE,
    height: INTERIOR_ATMOSPHERE_DEFAULT_SHARD_SIZE,
  });
  const defaultAssetUrl = interiorAtmosphereShardTextureUrl(
    assetUrl,
    "default",
  );
  const defaultAsset = await writeVerifiedPreparedShard({
    assetUrl: defaultAssetUrl,
    path: interiorAtmosphereShardTexturePath(assetUrl, "default"),
    source: extractRgbaBounds({
      rgba: data,
      width: info.width,
      bounds: defaultBounds,
    }),
    sourceBounds: defaultBounds,
  });
  const rows = [];
  for (let rowIndex = 0;
    rowIndex < INTERIOR_ATMOSPHERE_ROWS;
    rowIndex += 1) {
    const sourceBounds = Object.freeze({
      x: 0,
      y: rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT,
      width: INTERIOR_ATMOSPHERE_ROW_WIDTH,
      height: INTERIOR_ATMOSPHERE_ROW_HEIGHT,
    });
    const suffix = `row-${String(rowIndex).padStart(2, "0")}`;
    rows.push(await writeVerifiedPreparedShard({
      assetUrl: interiorAtmosphereShardTextureUrl(assetUrl, suffix),
      path: interiorAtmosphereShardTexturePath(assetUrl, suffix),
      source: extractRgbaBounds({
        rgba: data,
        width: info.width,
        bounds: sourceBounds,
      }),
      sourceBounds,
    }));
  }
  const runtimeAtlas = await writePreparedRuntimeAtlas({
    assetUrl,
    path: publicTexturePath(assetUrl),
    width: INTERIOR_ATMOSPHERE_WIDTH,
    height: INTERIOR_ATMOSPHERE_HEIGHT,
    placements: Object.freeze([
      ...rows.map((asset, rowIndex) => Object.freeze({
        asset,
        x: 0,
        y: rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT,
      })),
      Object.freeze({
        asset: defaultAsset,
        x: INTERIOR_ATMOSPHERE_GRID_WIDTH,
        y: 0,
      }),
    ]),
  });
  return Object.freeze({
    sourceAssetUrl: assetUrl,
    sourceDecodedSha256: sha256(data),
    exactVisibleDecodedCropVerification: true,
    runtimeAtlas,
    defaultAsset,
    rows: Object.freeze(rows),
  });
}

function prepareInteriorMaterialAtlas({
  ringData,
  foregroundRingData,
  ringTextureWidth,
  maximumLightingFactor,
  defaultFrame,
  shadowless = false,
}:RingRaster & {defaultFrame:Buffer;shadowless?:boolean}) {
  const output = Buffer.alloc(
    INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
  );
  const maximumScenePitchDegrees = CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES;
  for (let frameIndex = 0;
    frameIndex < INTERIOR_ATMOSPHERE_FRAME_COUNT;
    frameIndex += 1) {
    const amount = frameIndex / (INTERIOR_ATMOSPHERE_FRAME_COUNT - 1);
    const scenePitchDegrees = maximumScenePitchDegrees * (1 - amount);
    const systemObliquityDegrees = OBJECT_OBLIQUITY_DEGREES *
      scenePitchDegrees / CAMERA_ROTATION_X_DEGREES;
    const objectView = prepareObjectViewDirection(
      scenePitchDegrees,
      systemObliquityDegrees,
    );
    const frame = prepareFixedMaterialPlane({
      ringData,
      foregroundRingData,
      ringTextureWidth,
      maximumLightingFactor,
      objectLight: shadowless
        ? objectView
        : prepareObjectLightDirection(systemObliquityDegrees),
      objectView,
      scenePitchDegrees,
      systemObliquityDegrees,
      textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
      outputSize: INTERIOR_ATMOSPHERE_SIZE,
      preparedMeshSilhouette: true,
      materialMode: "cutaway-full",
    });
    const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
    const frameRow = Math.floor(frameIndex / INTERIOR_ATMOSPHERE_COLUMNS);
    writeMaterialAtlasTile({
      output,
      outputWidth: INTERIOR_ATMOSPHERE_WIDTH,
      source: frame.output,
      sourceSize: INTERIOR_ATMOSPHERE_SIZE,
      frameX: frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
        INTERIOR_ATMOSPHERE_GUTTER,
      frameY: frameRow * INTERIOR_ATMOSPHERE_STRIDE +
        INTERIOR_ATMOSPHERE_GUTTER,
      gutter: INTERIOR_ATMOSPHERE_GUTTER,
    });
  }
  writeMaterialAtlasTile({
    output,
    outputWidth: INTERIOR_ATMOSPHERE_WIDTH,
    source: defaultFrame,
    sourceSize: PLANET_FIXED_MATERIAL_SIZE,
    frameX: INTERIOR_ATMOSPHERE_DEFAULT_X,
    frameY: INTERIOR_ATMOSPHERE_DEFAULT_Y,
    gutter: INTERIOR_ATMOSPHERE_GUTTER,
  });
  return Object.freeze({
    output,
    minimumScenePitchDegrees: 0,
    maximumScenePitchDegrees,
  });
}

function publicTexturePath(textureUrl:string) {
  const prefix = config.publicPrefix;
  const filename = textureUrl.startsWith(prefix) ? textureUrl.slice(prefix.length) : '';
  if(!/^[a-z0-9@.-]+$/u.test(filename)) throw new TypeError('Invalid prepared texture URL: '+textureUrl);
  return resolve(publicDirectory, filename);
}

async function prepareNormalMaterialMasters() {
  const approvedFixedMaterialAsset = await readFile(
    PLANET_FIXED_MATERIAL_SOURCE_PATH,
  );
  const {
    data: approvedReferenceFixedMaterial,
    info: approvedReferenceFixedMaterialInfo,
  } = await sharp(approvedFixedMaterialAsset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (approvedReferenceFixedMaterialInfo.width !== PLANET_FIXED_MATERIAL_SIZE ||
      approvedReferenceFixedMaterialInfo.height !== PLANET_FIXED_MATERIAL_SIZE) {
    throw new Error("Ellipsoid approved reference material source changed.");
  }
  const maximumTint = textureTintFactors(
    LIGHTING.directionalLight.intensity,
    LIGHTING.directionalLight.color,
    LIGHTING.ambientLight.color,
    LIGHTING.ambientLight.intensity,
  );
  const maximumLightingFactor = Math.max(
    maximumTint.r,
    maximumTint.g,
    maximumTint.b,
  );
  const surfaceChannelFactors = prepareSurfaceChannelFactors(
    maximumTint,
    maximumLightingFactor,
  );
  await prepareSolarTintedSurface(surfaceChannelFactors);
  const [metadata, polarObservationMetadata, preparedSurface] =
    await Promise.all([
    sharp(PLANET_SOURCE_TEXTURE_PATH).metadata(),
    sharp(POLAR_OBSERVATION_POLAR_SOURCE_PATH).metadata(),
    sharp(PLANET_SURFACE_TEXTURE_PATH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  const [expectedSourceWidth, expectedSourceHeight] = config.surfaceSourceSize ?? [PLANET_SOURCE_TEXTURE_WIDTH, PLANET_SOURCE_TEXTURE_HEIGHT];
  if (
    metadata.width !== expectedSourceWidth
    || metadata.height !== expectedSourceHeight
  ) {
    throw new Error("Ellipsoid source texture dimensions changed.");
  }
  if (
    polarObservationMetadata.width !== POLAR_OBSERVATION_POLAR_SOURCE_WIDTH
    || polarObservationMetadata.height !== POLAR_OBSERVATION_POLAR_SOURCE_HEIGHT
  ) {
    throw new Error("Polar observation polar source dimensions changed.");
  }
  if (!Number.isInteger(PLANET_SOURCE_CELL_WIDTH)
    || !Number.isInteger(PLANET_SOURCE_CELL_HEIGHT)) {
    throw new Error("Ellipsoid source texture no longer divides into the UV grid.");
  }
  const rasterSource = await sharp(preparedSurface.data, {
    raw: preparedSurface.info,
  }).resize(
    PLANET_RASTER_SOURCE_WIDTH,
    PLANET_RASTER_SOURCE_HEIGHT,
    { kernel: sharp.kernel.lanczos3 },
  ).raw().toBuffer({ resolveWithObject: true });
  const packedSurface = packProjectiveSurfaceRaster(rasterSource.data, {
    width: rasterSource.info.width,
    height: rasterSource.info.height,
    channels: rasterSource.info.channels,
    bandCount: LATITUDE_SEGMENTS,
    gutter: PLANET_RASTER_GUTTER,
  });
  await sharp(packedSurface.data, { raw: {
    width: packedSurface.packedWidth,
    height: packedSurface.packedHeight,
    channels: rasterSource.info.channels,
  } })
    .removeAlpha()
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
    .toFile(PLANET_BODY_SURFACE_TEXTURE_PATH);
  const { data: ringData, info: ringInfo } = await sharp(RING_TEXTURE_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: filteredRingShadowData, info: filteredRingShadowInfo } =
    await sharp(RING_TEXTURE_PATH)
      .ensureAlpha()
      .blur(RING_SHADOW_FOOTPRINT_BLUR_SIGMA)
      .raw()
      .toBuffer({ resolveWithObject: true });
  if (
    ringInfo.width !== PREPARED_RING_SOURCE.textureSize
    || ringInfo.height !== PREPARED_RING_SOURCE.textureSize
    || ringInfo.channels !== 4
    || filteredRingShadowInfo.width !== ringInfo.width
    || filteredRingShadowInfo.height !== ringInfo.height
    || filteredRingShadowInfo.channels !== 4
  ) {
    throw new Error("Ellipsoid prepared ring texture dimensions changed.");
  }
  const initialObjectLight = PREPARED_RING_SOURCE.shadowModel.objectLightDirection;
  const initialObjectView = prepareInitialObjectViewDirection();
  const polarOutput = await preparePolarTextureAtlas({
    ringData: filteredRingShadowData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    surfaceChannelFactors,
  });
  const defaultFixedMaterial = prepareFixedMaterialPlane({
    ringData: filteredRingShadowData,
    foregroundRingData: ringData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
    systemObliquityDegrees: OBJECT_OBLIQUITY_DEGREES,
  });
  const defaultInteriorMaterial = prepareFixedMaterialPlane({
    ringData: filteredRingShadowData,
    foregroundRingData: ringData,
    ringTextureWidth: ringInfo.width,
    maximumLightingFactor,
    objectLight: initialObjectLight,
    objectView: initialObjectView,
    scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
    systemObliquityDegrees: OBJECT_OBLIQUITY_DEGREES,
    textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
    materialMode: "cutaway-full",
  });
  const preparedMaterialModes = Object.freeze(Object.fromEntries(
    MATERIAL_MODES.map((mode) => {
      const shadowless = mode === "no-shadows" ||
        mode === "ringless-no-shadows";
      const modeRingData = mode === "full" ? filteredRingShadowData : null;
      const modeForegroundRingData = mode.startsWith("ringless")
        ? null
        : ringData;
      const exteriorDefault = mode === "full"
        ? defaultFixedMaterial
        : prepareFixedMaterialPlane({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          objectLight: shadowless ? initialObjectView : initialObjectLight,
          objectView: initialObjectView,
          scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
          systemObliquityDegrees: OBJECT_OBLIQUITY_DEGREES,
        });
      const interiorDefault = mode === "full"
        ? defaultInteriorMaterial
        : prepareFixedMaterialPlane({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          objectLight: shadowless ? initialObjectView : initialObjectLight,
          objectView: initialObjectView,
          scenePitchDegrees: CAMERA_ROTATION_X_DEGREES,
          systemObliquityDegrees: OBJECT_OBLIQUITY_DEGREES,
          textureUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
          materialMode: "cutaway-full",
        });
      return [mode, Object.freeze({
        exteriorDefault,
        interiorDefault,
        orbitAtlas: prepareOrbitMaterialAtlas({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          defaultFrame: exteriorDefault.output,
          approvedReferenceFrameChanged: mode === "full"
            ? !exteriorDefault.output.equals(approvedReferenceFixedMaterial)
            : null,
          shadowless,
        }),
        interiorAtlas: prepareInteriorMaterialAtlas({
          ringData: modeRingData,
          foregroundRingData: modeForegroundRingData,
          ringTextureWidth: ringInfo.width,
          maximumLightingFactor,
          defaultFrame: interiorDefault.output,
          shadowless,
        }),
      })];
    }),
  ));
  const approvedReferenceMatchesDefault =
    Buffer.compare(defaultFixedMaterial.output, approvedReferenceFixedMaterial) === 0;
  const orbitMaterialAtlas = preparedMaterialModes.full.orbitAtlas;
  const interiorAtmosphereAtlas = preparedMaterialModes.full.interiorAtlas;
  await Promise.all([
    sharp(polarOutput, {
      raw: {
        width: PLANET_POLAR_TEXTURE_WIDTH,
        height: PLANET_POLAR_TEXTURE_HEIGHT,
        channels: 4,
      },
    })
      .webp({ lossless: true, effort: 6 })
      .toFile(PLANET_POLAR_TEXTURE_PATH),
    sharp(defaultFixedMaterial.output, {
      raw: {
        width: PLANET_FIXED_MATERIAL_SIZE,
        height: PLANET_FIXED_MATERIAL_SIZE,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(PLANET_FIXED_MATERIAL_TEXTURE_PATH),
    sharp(orbitMaterialAtlas.output, {
      raw: {
        width: PLANET_ORBIT_MATERIAL_WIDTH,
        height: PLANET_ORBIT_MATERIAL_HEIGHT,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(PLANET_ORBIT_MATERIAL_TEXTURE_PATH),
    sharp(interiorAtmosphereAtlas.output, {
      raw: {
        width: INTERIOR_ATMOSPHERE_WIDTH,
        height: INTERIOR_ATMOSPHERE_HEIGHT,
        channels: 4,
      },
    })
      .webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 })
      .toFile(INTERIOR_ATMOSPHERE_TEXTURE_PATH),
    ...MATERIAL_MODES.filter((mode) => mode !== "full").flatMap((mode) => {
      const variantId = materialVariantId(DEFAULT_LENS_ID, mode);
      const prepared = preparedMaterialModes[mode];
      return [
        sharp(prepared.orbitAtlas.output, {
          raw: {
            width: PLANET_ORBIT_MATERIAL_WIDTH,
            height: PLANET_ORBIT_MATERIAL_HEIGHT,
            channels: 4,
          },
        })
          .webp({
            quality: 95,
            alphaQuality: 100,
            smartSubsample: true,
            effort: 6,
          })
          .toFile(orbitMaterialPreparationPath(variantId)),
        sharp(prepared.interiorAtlas.output, {
        raw: {
          width: INTERIOR_ATMOSPHERE_WIDTH,
          height: INTERIOR_ATMOSPHERE_HEIGHT,
          channels: 4,
        },
      })
        .webp({ quality: 96, alphaQuality: 100, smartSubsample: true, effort: 6 })
          .toFile(interiorMaterialPreparationPath(variantId)),
      ];
    }),
  ]);
  await Promise.all([
    optimizePreparedQ75Webp(PLANET_POLAR_TEXTURE_PATH),
  ]);
  const phaseMetadata = {
    approvedReferenceAsset: {
      byteLength: approvedFixedMaterialAsset.byteLength,
      sha256: sha256(approvedFixedMaterialAsset),
    },
    initialObjectView,
    defaultFixedMaterial: materialMetadata(defaultFixedMaterial),
    defaultInteriorMaterial: materialMetadata(defaultInteriorMaterial),
    approvedReferenceMatchesDefault,
    orbitMaterialAtlas: materialMetadata(orbitMaterialAtlas),
  };
  return phaseMetadata;
}

// The numerical generator owns normal masters once; composition only transports
// their verified metadata and combines the already prepared lens rasters.

function materialMetadata<T extends {output:Uint8Array}>({ output, ...metadata }:T):Omit<T,'output'> {
  return metadata;
}

async function composePlanetTextures({
  approvedReferenceAsset,
  initialObjectView, defaultFixedMaterial,
  defaultInteriorMaterial,
  approvedReferenceMatchesDefault, orbitMaterialAtlas,
}:Awaited<ReturnType<typeof prepareNormalMaterialMasters>>) {
  const interiorLensMaterialAtlases = Object.freeze(Object.fromEntries(
    requireLenses().controls
      .filter((lens): lens is Extract<typeof lens,{falseColor:boolean}> => 'falseColor' in lens && lens.falseColor)
      .map(({ id, interiorMaterialPreparationFile }) => [id, Object.freeze({
        id,
        url: `${config.publicPrefix}${config.namespace}-interior-atmosphere-${id}.webp`,
        path: resolve(stagingDirectory, interiorMaterialPreparationFile),
      })]),
  ));
  const materialLensIds = Object.freeze([
    DEFAULT_LENS_ID,
    ...requireLenses().controls
      .filter((lens): lens is Extract<typeof lens,{falseColor:boolean}> => 'falseColor' in lens && lens.falseColor)
      .map(({ id }) => id),
  ]);
  const materialVariantIds = Object.freeze(materialLensIds.flatMap((lensId) =>
    MATERIAL_MODES.map((mode) => materialVariantId(lensId, mode))));
  const orbitMaterialRuntimeVariants = Object.freeze(Object.fromEntries(
    await Promise.all(materialVariantIds.map(async (variantId:string) => [
      variantId,
      await prepareOrbitMaterialRuntimeShards({
        variantId,
        path: orbitMaterialPreparationPath(variantId),
      }),
    ] as const)),
  ));
  const orbitMaterialRuntimeShards =
    orbitMaterialRuntimeVariants[DEFAULT_LENS_ID];
  const interiorAtmosphereRuntimeShards = Object.freeze(Object.fromEntries(
    await Promise.all(materialVariantIds.map(async (variantId:string) => [
      variantId,
      await prepareInteriorAtmosphereRuntimeShards({
        assetUrl: interiorMaterialVariantTextureUrl(variantId),
        path: interiorMaterialPreparationPath(variantId),
      }),
    ] as const)),
  ));
  const [
    surfaceAsset,
    bodySurfaceAsset,
    polarAsset,
    fixedMaterialAsset,
    orbitMaterialAsset,
    interiorAtmosphereAsset,
  ] =
    await Promise.all([
    readFile(PLANET_SURFACE_TEXTURE_PATH),
    readFile(PLANET_BODY_SURFACE_TEXTURE_PATH),
    readFile(PLANET_POLAR_TEXTURE_PATH),
    readFile(PLANET_FIXED_MATERIAL_TEXTURE_PATH),
    readFile(publicTexturePath(PLANET_ORBIT_MATERIAL_TEXTURE_URL)),
    readFile(publicTexturePath(INTERIOR_ATMOSPHERE_TEXTURE_URL)),
    ]);
  const interiorAtmosphereLensAssets = Object.freeze(Object.fromEntries(
    await Promise.all(Object.values(interiorLensMaterialAtlases).map(
      async (atlas) => {
        const bytes = await readFile(publicTexturePath(atlas.url));
        return [atlas.id, Object.freeze({
          url: atlas.url,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        })] as const;
      },
    )),
  ));
  const fixedMaterialLeaf = Object.freeze({
    ...defaultFixedMaterial.leaf,
    style: defaultFixedMaterial.leaf.style
      .replace(
        `background-image:url(${PLANET_FIXED_MATERIAL_TEXTURE_URL})`,
        `background-image:url(${PLANET_ORBIT_MATERIAL_TEXTURE_URL})`,
      )
      .replace(
        `background-size:${PLANET_FIXED_MATERIAL_SIZE}px ` +
          `${PLANET_FIXED_MATERIAL_SIZE}px`,
        `background-position:-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px` +
          `;background-size:${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
      ),
  });
  const orbitMaterialPresentationScale =
    PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE;
  const orbitMaterialDefaultPreparedFrame = Math.round(
    (CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES -
      CAMERA_ROTATION_X_DEGREES) /
      CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES *
      (PLANET_ORBIT_MATERIAL_FRAME_COUNT - 1),
  );
  const orbitMaterialDefaultPreparedRow = Math.floor(
    orbitMaterialDefaultPreparedFrame / PLANET_ORBIT_MATERIAL_COLUMNS,
  );
  const orbitMaterialInitialWarmRows = Object.freeze([
    orbitMaterialDefaultPreparedRow - 1,
    orbitMaterialDefaultPreparedRow,
    orbitMaterialDefaultPreparedRow + 1,
  ].filter((rowIndex:number) => rowIndex >= 0 &&
    rowIndex < PLANET_ORBIT_MATERIAL_ROWS));
  const orbitMaterialRuntimeVariantPlans = Object.freeze(Object.fromEntries(
    Object.entries(orbitMaterialRuntimeVariants).map(([id, shards]) => {
      const presentations = Object.freeze(Array.from(
        { length: PLANET_ORBIT_MATERIAL_FRAME_COUNT },
        (_, frameIndex) => {
          const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
          const rowIndex = Math.floor(
            frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS,
          );
          return Object.freeze({
            frameIndex,
            rowIndex,
            assetUrl: shards.runtimeAtlas.assetUrl,
            backgroundPosition:
              `${-(frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
                PLANET_ORBIT_MATERIAL_GUTTER) *
                orbitMaterialPresentationScale}px ` +
              `${-(rowIndex * PLANET_ORBIT_MATERIAL_ROW_HEIGHT +
                PLANET_ORBIT_MATERIAL_GUTTER) *
                orbitMaterialPresentationScale}px`,
            backgroundSize:
              `${PLANET_ORBIT_MATERIAL_WIDTH *
                orbitMaterialPresentationScale}px ` +
              `${PLANET_ORBIT_MATERIAL_HEIGHT *
                orbitMaterialPresentationScale}px`,
          });
        },
      ));
      return [id, Object.freeze({
        id,
        sourceDecodedSha256: shards.sourceDecodedSha256,
        exactVisibleDecodedCropVerification:
          shards.exactVisibleDecodedCropVerification,
        runtimeAtlas: shards.runtimeAtlas,
        initialWarmRows: orbitMaterialInitialWarmRows,
        defaultPresentation: Object.freeze({
          ...shards.runtimeAtlas,
          backgroundPosition:
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
          backgroundSize:
            `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
            `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        }),
        rows: shards.rows,
        presentations,
      })];
    }),
  ));
  const orbitMaterialRuntimePresentations =
    orbitMaterialRuntimeVariantPlans[DEFAULT_LENS_ID].presentations;
  const interiorAtmospherePresentationScale =
    PLANET_FIXED_MATERIAL_SIZE / INTERIOR_ATMOSPHERE_SIZE;
  const interiorAtmosphereDefaultFrame = Math.round(
    (CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES -
      CAMERA_ROTATION_X_DEGREES) /
      CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES *
      (INTERIOR_ATMOSPHERE_FRAME_COUNT - 1),
  );
  const interiorAtmosphereDefaultPreparedRow = Math.floor(
    interiorAtmosphereDefaultFrame / INTERIOR_ATMOSPHERE_COLUMNS,
  );
  const interiorAtmosphereInitialWarmRows = Object.freeze([
    interiorAtmosphereDefaultPreparedRow - 1,
    interiorAtmosphereDefaultPreparedRow,
    interiorAtmosphereDefaultPreparedRow + 1,
  ].filter((rowIndex:number) => rowIndex >= 0 &&
    rowIndex < INTERIOR_ATMOSPHERE_ROWS));
  const interiorAtmosphereRuntimeVariants = Object.freeze(Object.fromEntries(
    Object.entries(interiorAtmosphereRuntimeShards).map(([id, shards]) => {
      const presentations = Object.freeze(Array.from(
        { length: INTERIOR_ATMOSPHERE_FRAME_COUNT },
        (_, frameIndex) => {
          const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
          const rowIndex = Math.floor(
            frameIndex / INTERIOR_ATMOSPHERE_COLUMNS,
          );
          return Object.freeze({
            frameIndex,
            rowIndex,
            assetUrl: shards.runtimeAtlas.assetUrl,
            backgroundPosition:
              `${-(frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px ` +
              `${-(rowIndex * INTERIOR_ATMOSPHERE_ROW_HEIGHT +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px`,
            backgroundSize:
              `${INTERIOR_ATMOSPHERE_WIDTH *
                interiorAtmospherePresentationScale}px ` +
              `${INTERIOR_ATMOSPHERE_HEIGHT *
                interiorAtmospherePresentationScale}px`,
          });
        },
      ));
      return [id, Object.freeze({
        sourceAssetUrl: shards.sourceAssetUrl,
        sourceDecodedSha256: shards.sourceDecodedSha256,
        exactVisibleDecodedCropVerification:
          shards.exactVisibleDecodedCropVerification,
        runtimeAtlas: shards.runtimeAtlas,
        defaultPresentation: Object.freeze({
          ...shards.runtimeAtlas,
          backgroundPosition:
            `-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
            `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px`,
          backgroundSize:
            `${INTERIOR_ATMOSPHERE_WIDTH}px ` +
            `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
        }),
        rows: shards.rows,
        presentations,
      })];
    }),
  ));
  const interiorAtmosphereLeaf = Object.freeze({
    ...defaultInteriorMaterial.leaf,
    className: config.labels.label005,
    style: defaultInteriorMaterial.leaf.style
      .replace(
        `background-image:url(${INTERIOR_ATMOSPHERE_TEXTURE_URL})`,
        `background-image:url(${INTERIOR_ATMOSPHERE_TEXTURE_URL})`,
      )
      .replace(
        `background-size:${PLANET_FIXED_MATERIAL_SIZE}px ` +
          `${PLANET_FIXED_MATERIAL_SIZE}px`,
        `background-position:-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
          `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px` +
          `;background-size:${INTERIOR_ATMOSPHERE_WIDTH}px ` +
          `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
      ),
  });
  return Object.freeze({
    surface: Object.freeze({
      mode: "prepared-static-hd-equirectangular-surface",
      sourcePath: config.labels.label006,
      assetUrl: PLANET_BODY_SURFACE_TEXTURE_URL,
      assetBytes: bodySurfaceAsset.byteLength,
      assetSha256: createHash("sha256")
        .update(bodySurfaceAsset)
        .digest("hex"),
      sourceAssetUrl: PLANET_SURFACE_TEXTURE_URL,
      sourceAssetBytes: surfaceAsset.byteLength,
      sourceAssetSha256: createHash("sha256")
        .update(surfaceAsset)
        .digest("hex"),
      faceCount: PLANET_TEXTURE_FACE_COUNT,
      uvLayout: "equirectangular-2-to-1-direct-longitude-latitude",
      sourceCellWidth: PLANET_SOURCE_CELL_WIDTH,
      sourceCellHeight: PLANET_SOURCE_CELL_HEIGHT,
      rasterCellSize: PLANET_RASTER_CELL_SIZE,
      solarColor: OBJECT_SOLAR_ALBEDO_MULTIPLIER,
      solarColorModel:
        "Planck-5772K-CIE1931-linear-sRGB-D65-max-normalized",
      solarTintPreparation: "linear-light-static-albedo-multiplication",
      projectiveLeafOrientation:
        "prepared-latitude-strip-north-south-correction",
      polarCaps: Object.freeze({
        model: config.labels.label007,
        assetUrl: PLANET_POLAR_TEXTURE_URL,
        assetBytes: polarAsset.byteLength,
        assetSha256: sha256(polarAsset),
        encoding: PREPARED_Q75_WEBP_ENCODING,
        alphaEncoding: "lossless",
        tileSize: PLANET_POLAR_TEXTURE_SIZE,
        tileCount: PLANET_POLAR_TEXTURE_TILE_COUNT,
        atlasWidth: PLANET_POLAR_TEXTURE_WIDTH,
        atlasHeight: PLANET_POLAR_TEXTURE_HEIGHT,
        sourceLatitudeRowsPerPole: PLANET_SOURCE_CELL_HEIGHT,
        surfaceLeafCount: 2,
        innerSurfaceLeafCount: 2,
        materialLeafCount: 0,
        innerMaterialLeafCount: 0,
        innerOverlap: PLANET_POLAR_INNER_OVERLAP,
        innerInset: PLANET_POLAR_INNER_INSET,
        innerBoundarySampling: "outer-cap-boundary-clamped",
        fixedWorldMaterial: true,
        runtimeMath: false,
        northSource: Object.freeze({
          product: config.labels.label008,
          sourcePath: config.labels.label009,
          sourceTile: Object.freeze({
            x: POLAR_OBSERVATION_2017_TILE_LEFT,
            y: 0,
            width: POLAR_OBSERVATION_POLAR_TILE_SIZE,
            height: POLAR_OBSERVATION_POLAR_TILE_SIZE,
          }),
          projection: "north-polar-stereographic",
          sourceKmPerPixel: POLAR_OBSERVATION_POLAR_KM_PER_PIXEL,
          boundaryBlendStart: POLAR_OBSERVATION_POLAR_BLEND_START,
          boundaryAuthority: config.labels.label010,
          authority:
            config.labels.label011,
        }),
      }),
      atlasWidth: PLANET_SOURCE_TEXTURE_WIDTH,
      atlasHeight: PLANET_SOURCE_TEXTURE_HEIGHT,
      equivalentBodySampleWidth: LONGITUDE_SEGMENTS * PLANET_RASTER_CELL_SIZE,
      equivalentBodySampleHeight:
        (LATITUDE_SEGMENTS - 2) * PLANET_RASTER_CELL_SIZE,
      seamRepair: Object.freeze({
        model: "prepared-zero-seam-bleed-with-compositor-overlap",
        seamBleed: PLANET_SEAM_BLEED,
        topologyOverlap: 0,
        presentationOverlap: SURFACE_OVERLAP,
        rasterGutter: PLANET_RASTER_GUTTER,
        rasterOverscan: PLANET_RASTER_OVERSCAN,
        runtimeEdgeDiscovery: false,
      }),
    }),
    lighting: Object.freeze({
      mode: "prepared-view-bank-single-material-plane-orbit-projection",
      sourceUrl: PLANET_SURFACE_TEXTURE_URL,
      assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
      assetBytes: orbitMaterialAsset.byteLength,
      assetSha256: sha256(orbitMaterialAsset),
      frameCount: PLANET_ORBIT_MATERIAL_FRAME_COUNT,
      frameRate: 0,
      faceCount: 1,
      tileWidth: PLANET_FIXED_MATERIAL_SIZE,
      tileHeight: PLANET_FIXED_MATERIAL_SIZE,
      defaultViewDegrees: CAMERA_ROTATION_X_DEGREES,
      approvedReferenceMatchesDefault,
      defaultAsset: Object.freeze({
        preparationPath: config.labels.label012,
        assetBytes: fixedMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(fixedMaterialAsset)
          .digest("hex"),
        embeddedInOrbitAtlas: true,
        backgroundPosition:
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
        backgroundSize:
          `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        runtimePresentation: Object.freeze({
          assetUrl: orbitMaterialRuntimeShards.runtimeAtlas.assetUrl,
          assetBytes: orbitMaterialRuntimeShards.runtimeAtlas.assetBytes,
          assetSha256:
            orbitMaterialRuntimeShards.runtimeAtlas.assetSha256,
          backgroundPosition:
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
            `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
          backgroundSize:
            `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
            `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
          exactDecodedCrop: true,
        }),
      }),
      approvedReferenceAsset: Object.freeze({
        sourcePath: config.labels.label013,
        assetBytes: approvedReferenceAsset.byteLength,
        assetSha256: approvedReferenceAsset.sha256,
        embeddedInOrbitAtlas: false,
      }),
      presentationScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      materialScale: PLANET_FIXED_MATERIAL_CONTENT_SCALE,
      projection: defaultFixedMaterial.projection,
      leaf: fixedMaterialLeaf,
      interpolation:
        "dense-nearest-prepared-view-with-continuous-plane-projection",
      lightSpace: "prepared-fixed-world-light-per-orbit-view",
      addressPublication:
        "single-transform-and-prepared-background-address-on-input-frame",
      composition:
        "prepared-final-material-composite-over-retained-scene-with-foreground-ring-rgb-ordering",
      retainedOverlayBinding:
        "one-mount-time-retained-final-composite-texture-leaf",
      foregroundRingOrdering: Object.freeze({
        model: "prepared-ring-rgb-over-material-with-material-alpha-retained",
        sourceAssetUrl: RING_TEXTURE_URL,
        compositedTexelCount:
          defaultFixedMaterial.foregroundRingCompositedTexelCount,
        meanSampledOpacity: defaultFixedMaterial.meanForegroundRingOpacity,
        screenshotDerived: false,
        runtimeMath: false,
        extraDomLeaves: 0,
      }),
      animatedCustomProperties: 0,
      animatedPseudoElements: 0,
      runtimeBlendMode: false,
      runtimeFilter: false,
      runtimeLightingMath: false,
      runtimeRasterization: false,
      runtimeAddressWrites:
        "one-retained-leaf-prepared-address-on-published-input-frame",
      runtimeMatrixFormatting: false,
      extraDomLeaves: 1,
      materialModel:
        "globe-solar-rgb-lambert-terminator-attenuation-oblate-texels",
      atmosphere: Object.freeze({
        model: "prepared-view-light-limb-scattering-oblate-texels",
        compositedIntoMaterialAsset: true,
        assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
        assetBytes: orbitMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(orbitMaterialAsset)
          .digest("hex"),
        color: `#${ATMOSPHERE_COLOR.map((channel) =>
          channel.toString(16).padStart(2, "0")).join("")}`,
        maximumAlpha: ATMOSPHERE_MAXIMUM_ALPHA,
        limbExponent: ATMOSPHERE_LIMB_EXPONENT,
        nightFloor: ATMOSPHERE_NIGHT_FLOOR,
        initialObjectViewDirection: initialObjectView.map((component) =>
          Number(component.toFixed(6))),
        retainedOverlayBinding:
          "one-mount-time-retained-final-composite-texture-leaf",
        atlasLayer: "prepared-approved-material-plane",
        runtimeMath: false,
        extraDomLeaves: 1,
      }),
      interiorAtmosphere: Object.freeze({
        model: "prepared-cutaway-full-exterior-material-oblate-texels",
        assetUrl: INTERIOR_ATMOSPHERE_TEXTURE_URL,
        assetBytes: interiorAtmosphereAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(interiorAtmosphereAsset)
          .digest("hex"),
        lensAssets: Object.freeze({
          normal: Object.freeze({
            url: INTERIOR_ATMOSPHERE_TEXTURE_URL,
            bytes: interiorAtmosphereAsset.byteLength,
            sha256: createHash("sha256")
              .update(interiorAtmosphereAsset)
              .digest("hex"),
          }),
          ...interiorAtmosphereLensAssets,
        }),
        runtimeShards: Object.freeze({
          model: "prepared-variant-single-atlas",
          defaultVariant: DEFAULT_LENS_ID,
          defaultPreparedFrame: interiorAtmosphereDefaultFrame,
          defaultPreparedRow: interiorAtmosphereDefaultPreparedRow,
          initialWarmRows: interiorAtmosphereInitialWarmRows,
          maximumRetainedAtlasCount: 1,
          variants: interiorAtmosphereRuntimeVariants,
          initialDecodedWorkingSetBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          maximumDecodedWorkingSetBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          fullAtlasDecodedRgbaBytes:
            INTERIOR_ATMOSPHERE_WIDTH * INTERIOR_ATMOSPHERE_HEIGHT * 4,
          runtimeDecodePolicy:
            "one-active-variant-atlas-decoded-before-presentation",
        }),
        frameCount: INTERIOR_ATMOSPHERE_FRAME_COUNT,
        frameColumns: INTERIOR_ATMOSPHERE_COLUMNS,
        frameRows: INTERIOR_ATMOSPHERE_ROWS,
        tileSize: INTERIOR_ATMOSPHERE_SIZE,
        frameGutter: INTERIOR_ATMOSPHERE_GUTTER,
        frameStride: INTERIOR_ATMOSPHERE_STRIDE,
        atlasWidth: INTERIOR_ATMOSPHERE_WIDTH,
        atlasHeight: INTERIOR_ATMOSPHERE_HEIGHT,
        presentationTileSize: PLANET_FIXED_MATERIAL_SIZE,
        presentationAtlasWidth: INTERIOR_ATMOSPHERE_WIDTH *
          interiorAtmospherePresentationScale,
        presentationAtlasHeight: INTERIOR_ATMOSPHERE_HEIGHT *
          interiorAtmospherePresentationScale,
        minimumScenePitchDegrees: 0,
        maximumScenePitchDegrees:
          CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES,
        defaultFrame: interiorAtmosphereDefaultFrame,
        defaultBackgroundPosition:
          `-${INTERIOR_ATMOSPHERE_DEFAULT_X}px ` +
          `-${INTERIOR_ATMOSPHERE_DEFAULT_Y}px`,
        defaultBackgroundSize:
          `${INTERIOR_ATMOSPHERE_WIDTH}px ` +
          `${INTERIOR_ATMOSPHERE_HEIGHT}px`,
        backgroundPositions: Object.freeze(Array.from(
          { length: INTERIOR_ATMOSPHERE_FRAME_COUNT },
          (_, frameIndex) => {
            const frameColumn = frameIndex % INTERIOR_ATMOSPHERE_COLUMNS;
            const frameRow = Math.floor(
              frameIndex / INTERIOR_ATMOSPHERE_COLUMNS,
            );
            return `${-(frameColumn * INTERIOR_ATMOSPHERE_STRIDE +
              INTERIOR_ATMOSPHERE_GUTTER) *
              interiorAtmospherePresentationScale}px ` +
              `${-(frameRow * INTERIOR_ATMOSPHERE_STRIDE +
                INTERIOR_ATMOSPHERE_GUTTER) *
                interiorAtmospherePresentationScale}px`;
          },
        )),
        leaf: interiorAtmosphereLeaf,
        cutaway: requireViews().cutaway,
        composition:
          "same-exterior-light-terminator-ring-shadow-atmosphere-and-ring-ordering",
        defaultHighResolution: true,
        interpolation: "nearest-prepared-view",
        runtimeRasterization: false,
        runtimeLightingMath: false,
        extraDomLeaves: 1,
      }),
      orbitAtlas: Object.freeze({
        model: "prepared-fixed-world-light-and-ring-shadow-view-bank",
        assetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
        assetBytes: orbitMaterialAsset.byteLength,
        assetSha256: createHash("sha256")
          .update(orbitMaterialAsset)
          .digest("hex"),
        frameCount: PLANET_ORBIT_MATERIAL_FRAME_COUNT,
        frameColumns: PLANET_ORBIT_MATERIAL_COLUMNS,
        frameRows: PLANET_ORBIT_MATERIAL_ROWS,
        tileSize: PLANET_ORBIT_MATERIAL_SIZE,
        frameGutter: PLANET_ORBIT_MATERIAL_GUTTER,
        frameStride: PLANET_ORBIT_MATERIAL_STRIDE,
        atlasWidth: PLANET_ORBIT_MATERIAL_WIDTH,
        atlasHeight: PLANET_ORBIT_MATERIAL_HEIGHT,
        presentationTileSize: PLANET_FIXED_MATERIAL_SIZE,
        presentationAtlasWidth:
          PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE,
        presentationAtlasHeight:
          PLANET_ORBIT_MATERIAL_HEIGHT *
            PLANET_FIXED_MATERIAL_SIZE / PLANET_ORBIT_MATERIAL_SIZE,
        defaultBackgroundPosition:
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
          `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
        defaultBackgroundSize:
          `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
          `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
        minimumScenePitchDegrees:
          orbitMaterialAtlas.minimumScenePitchDegrees,
        maximumScenePitchDegrees:
          orbitMaterialAtlas.maximumScenePitchDegrees,
        preparedMeshSilhouette:
          orbitMaterialAtlas.preparedMeshSilhouette,
        ringShadowFootprint:
          orbitMaterialAtlas.ringShadowFootprint,
        backgroundPositions: Object.freeze(Array.from(
          { length: PLANET_ORBIT_MATERIAL_FRAME_COUNT },
          (_, frameIndex) => {
            const frameColumn = frameIndex % PLANET_ORBIT_MATERIAL_COLUMNS;
            const frameRow = Math.floor(
              frameIndex / PLANET_ORBIT_MATERIAL_COLUMNS,
            );
            const presentationScale = PLANET_FIXED_MATERIAL_SIZE /
              PLANET_ORBIT_MATERIAL_SIZE;
            return `${-(frameColumn * PLANET_ORBIT_MATERIAL_STRIDE +
              PLANET_ORBIT_MATERIAL_GUTTER) * presentationScale}px ` +
              `${-(frameRow * PLANET_ORBIT_MATERIAL_STRIDE +
                PLANET_ORBIT_MATERIAL_GUTTER) * presentationScale}px`;
          },
        )),
        runtimeShards: Object.freeze({
          model: "prepared-variant-single-atlas",
          defaultVariant: DEFAULT_LENS_ID,
          variants: orbitMaterialRuntimeVariantPlans,
          sourceAssetUrl: PLANET_ORBIT_MATERIAL_TEXTURE_URL,
          sourceDecodedSha256:
            orbitMaterialRuntimeShards.sourceDecodedSha256,
          alphaExactDecodedCropVerification:
            orbitMaterialRuntimeShards.alphaExactDecodedCropVerification,
          selectiveVisibleRgbEncoding:
            orbitMaterialRuntimeShards.selectiveVisibleRgbEncoding,
          q75AssetUrls: orbitMaterialRuntimeShards.q75AssetUrls,
          exactVisibleDecodedCropVerification:
            orbitMaterialRuntimeShards.exactVisibleDecodedCropVerification,
          defaultPreparedFrame: orbitMaterialDefaultPreparedFrame,
          defaultPreparedRow: orbitMaterialDefaultPreparedRow,
          initialWarmRows: orbitMaterialInitialWarmRows,
          maximumRetainedAtlasCount: 1,
          defaultPresentation: Object.freeze({
            ...orbitMaterialRuntimeShards.runtimeAtlas,
            backgroundPosition:
              `-${PLANET_ORBIT_MATERIAL_DEFAULT_X}px ` +
              `-${PLANET_ORBIT_MATERIAL_DEFAULT_Y}px`,
            backgroundSize:
              `${PLANET_ORBIT_MATERIAL_WIDTH}px ` +
              `${PLANET_ORBIT_MATERIAL_HEIGHT}px`,
          }),
          rows: orbitMaterialRuntimeShards.rows,
          presentations: orbitMaterialRuntimePresentations,
          initialDecodedWorkingSetBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          maximumDecodedWorkingSetBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          fullAtlasDecodedRgbaBytes:
            PLANET_ORBIT_MATERIAL_WIDTH *
            PLANET_ORBIT_MATERIAL_HEIGHT * 4,
          runtimeDecodePolicy:
            "one-active-variant-atlas-decoded-before-presentation",
        }),
        ringShadowMotionEvidence:
          orbitMaterialAtlas.ringShadowMotionEvidence,
        runtimeRasterization: false,
        runtimeAddressWrites:
          "single-background-position-on-published-input-frame",
      }),
      lightingModel:
        "lambert-with-ambient-and-smoothstep-terminator; parameter values adapted from the OpenSpace globe shader defaults (MIT), documented in the body README",
      illuminationDirectionAuthority: "declared scene Sun direction",
      solarEffectiveTemperatureKelvin: SOLAR_EFFECTIVE_TEMPERATURE_KELVIN,
      rendererAlbedoMultiplier: OBJECT_SOLAR_ALBEDO_MULTIPLIER,
      rendererAlbedoMultiplierModel:
        "Planck-5772K-CIE1931-linear-sRGB-D65-max-normalized",
      ambientIntensity: GLOBE_AMBIENT_INTENSITY,
      orenNayarRoughness: GLOBE_OREN_NAYAR_ROUGHNESS,
      terminatorSmoothstep: GLOBE_TERMINATOR_SMOOTHSTEP,
      directionalLight: LIGHTING.directionalLight,
      ambientLight: LIGHTING.ambientLight,
      mutualShadows: Object.freeze({
        model: PREPARED_RING_SOURCE.shadowModel.model,
        runtime: false,
        [config.fields.bodyOnRings]: PREPARED_RING_SOURCE.shadowModel[config.fields.bodyOnRings],
        [config.fields.ringsOnBody]: Object.freeze({
          ...requireRecord(PREPARED_RING_SOURCE.shadowModel[config.fields.ringsOnBody]),
          directTransmissionAtOpaqueRing: RING_SHADOW_DIRECT_TRANSMISSION,
          shadowedTexelCount: defaultFixedMaterial.ringShadowedTexelCount,
          meanSampledOpacity: defaultFixedMaterial.meanSampledRingOpacity,
          maxSampledOpacity: defaultFixedMaterial.maxSampledRingOpacity,
          footprintFilter: Object.freeze({
            model: "prepared-gaussian-ring-opacity-footprint",
            sigmaPixels: RING_SHADOW_FOOTPRINT_BLUR_SIGMA,
            runtime: false,
          }),
        }),
      }),
    }),
  });
}

function prepareSurfaceChannelFactors(maximumTint:ReturnType<typeof textureTintFactors>, maximumLightingFactor:number) {
  return [maximumTint.r, maximumTint.g, maximumTint.b]
    .map((factor) => factor / maximumLightingFactor);
}

/**
 * Rows the source map never observed, filled by linear interpolation in latitude between the nearest observed rows.
 * A range touching the top or bottom edge repeats its one observed neighbour. The recipe states the rows; nothing is
 * detected from pixel values, so a genuinely dark observed row is never treated as a gap.
 */
function fillUnobservedRows(data: Buffer, info: { width: number; height: number; channels: number }, ranges: readonly (readonly [number, number])[]) {
  const row = info.width * info.channels;
  for (const [first, last] of ranges) {
    if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 0 && last >= first && last < info.height))
      throw new Error(`Unobserved surface rows ${first}-${last} lie outside the ${info.height}-row source.`);
    const above = first - 1, below = last + 1;
    if (above < 0 && below >= info.height) throw new Error("Unobserved surface rows leave no observed row to fill from.");
    for (let y = first; y <= last; y += 1) {
      const t = above < 0 ? 1 : below >= info.height ? 0 : (y - above) / (below - above);
      for (let i = 0; i < row; i += 1) {
        const a = above < 0 ? data[below * row + i] : data[above * row + i];
        const b = below >= info.height ? data[above * row + i] : data[below * row + i];
        data[y * row + i] = Math.round(a + (b - a) * t);
      }
    }
  }
}

async function prepareSolarTintedSurface(channelFactors:readonly number[]) {
  const source = await sharp(PLANET_SOURCE_TEXTURE_PATH)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  fillUnobservedRows(source.data, source.info, config.surfaceUnobservedRows ?? []);
  // A source map smaller than the prepared grid is resampled once here, after its unobserved rows are filled.
  const resized = source.info.width === PLANET_SOURCE_TEXTURE_WIDTH && source.info.height === PLANET_SOURCE_TEXTURE_HEIGHT
    ? source
    : await sharp(source.data, { raw: source.info }).resize(PLANET_SOURCE_TEXTURE_WIDTH, PLANET_SOURCE_TEXTURE_HEIGHT, { kernel: sharp.kernel.lanczos3, fit: "fill" })
      .raw().toBuffer({ resolveWithObject: true });
  // The OPAL map's rows are planetographic latitude (its readme); the mesh's rows are the ellipsoid's own latitude.
  const { info } = resized, data = planetographicRowsToMeshLatitude(resized.data, info.width, info.height, info.channels, EQUATORIAL_RADIUS / POLAR_RADIUS);
  for (let offset = 0; offset < data.length; offset += info.channels) {
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = applyLinearTint(
        data[offset + channel],
        channelFactors[channel],
      );
    }
  }
  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4" })
    .toFile(PLANET_SURFACE_TEXTURE_PATH);
}

async function preparePolarTextureAtlas({
  ringData,
  ringTextureWidth,
  maximumLightingFactor,
  objectLight,
  objectView,
  surfaceChannelFactors,
}:Omit<RingRaster,'foregroundRingData'|'ringData'> & {ringData:Uint8Array;objectLight:ReadonlyVector3;objectView:ReadonlyVector3;surfaceChannelFactors:readonly number[]}) {
  const [surface, polarObservationNorthPolar] = await Promise.all([
    sharp(PLANET_SURFACE_TEXTURE_PATH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(POLAR_OBSERVATION_POLAR_SOURCE_PATH)
      .extract({
        left: POLAR_OBSERVATION_2017_TILE_LEFT,
        top: 0,
        width: POLAR_OBSERVATION_POLAR_TILE_SIZE,
        height: POLAR_OBSERVATION_POLAR_TILE_SIZE,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  const { data: surfaceData, info: surfaceInfo } = surface;
  const polarObservationBoundaryGains = preparePolarObservationBoundaryGains({
    surfaceData,
    surfaceInfo,
    polarObservationNorthPolar,
    surfaceChannelFactors,
  });
  const output = Buffer.alloc(
    PLANET_POLAR_TEXTURE_WIDTH * PLANET_POLAR_TEXTURE_HEIGHT * 4,
  );
  const sampleCount = PLANET_POLAR_SUPERSAMPLING ** 2;
  for (const pole of ["north", "south"] as const) {
    for (const layer of ["outer", "inner"]) {
      const inner = layer === "inner";
      const surfaceTile = inner
        ? PLANET_POLAR_INNER_SURFACE_TILE[pole]
        : PLANET_POLAR_SURFACE_TILE[pole];
      const materialTile = inner
        ? PLANET_POLAR_INNER_MATERIAL_TILE[pole]
        : PLANET_POLAR_MATERIAL_TILE[pole];
      const radialSampleScale = inner
        ? PLANET_POLAR_INNER_OVERLAP / PLANET_POLAR_SURFACE_OVERLAP
        : 1;
      for (let y = 0; y < PLANET_POLAR_TEXTURE_SIZE; y += 1) {
        for (let x = 0; x < PLANET_POLAR_TEXTURE_SIZE; x += 1) {
          const surfaceChannels = [0, 0, 0];
          const materialPremultiplied = [0, 0, 0];
          let surfaceCoverage = 0;
          let materialAlpha = 0;
          for (let sampleY = 0; sampleY < PLANET_POLAR_SUPERSAMPLING; sampleY += 1) {
            for (let sampleX = 0; sampleX < PLANET_POLAR_SUPERSAMPLING; sampleX += 1) {
              const unitX = (
                x + (sampleX + 0.5) / PLANET_POLAR_SUPERSAMPLING
              ) / PLANET_POLAR_TEXTURE_SIZE * 2 - 1;
              const unitY = (
                y + (sampleY + 0.5) / PLANET_POLAR_SUPERSAMPLING
              ) / PLANET_POLAR_TEXTURE_SIZE * 2 - 1;
              const radius = Math.hypot(unitX, unitY);
              if (radius > 1) continue;
              const projectedRadius = Math.min(1, radius * radialSampleScale);
              const projectedScale = radius > 0 ? projectedRadius / radius : 0;
              const sample = preparePolarSample(
                pole,
                unitX * projectedScale,
                unitY * projectedScale,
                projectedRadius,
              );
              const sourceSurface = samplePolarSurfaceRgba(
                surfaceData,
                surfaceInfo,
                sample,
                projectedRadius,
              );
              const surface = pole === "north"
                ? samplePolarObservationNorthPolarRgba({
                  sourceSurface,
                  polarObservationNorthPolar,
                  sample,
                  radius: projectedRadius,
                  surfaceChannelFactors,
                  boundaryGains: polarObservationBoundaryGains,
                })
                : sourceSurface;
              for (let channel = 0; channel < 3; channel += 1) {
                surfaceChannels[channel] += surface[channel];
              }
              surfaceCoverage += 1;
              const material = preparePolarMaterialSample({
                normal: sample.normal,
                position: sample.position,
                objectLight,
                objectView,
                ringData,
                ringTextureWidth,
                maximumLightingFactor,
              });
              materialAlpha += material.alpha;
              for (let channel = 0; channel < 3; channel += 1) {
                materialPremultiplied[channel] += material.color[channel] * material.alpha;
              }
            }
          }
          const surfaceOffset = polarTextureOffset(surfaceTile, x, y);
          if (surfaceCoverage > 0) {
            for (let channel = 0; channel < 3; channel += 1) {
              output[surfaceOffset + channel] = Math.round(
                surfaceChannels[channel] / surfaceCoverage,
              );
            }
            output[surfaceOffset + 3] = Math.round(surfaceCoverage / sampleCount * 255);
          }
          const materialOffset = polarTextureOffset(materialTile, x, y);
          const averagedMaterialAlpha = materialAlpha / sampleCount;
          if (averagedMaterialAlpha > 0) {
            for (let channel = 0; channel < 3; channel += 1) {
              output[materialOffset + channel] = Math.round(
                materialPremultiplied[channel] / materialAlpha,
              );
            }
            output[materialOffset + 3] = Math.round(averagedMaterialAlpha * 255);
          }
        }
      }
    }
  }
  return output;
}

function polarTextureOffset(tile:number, x:number, y:number) {
  return (
    y * PLANET_POLAR_TEXTURE_WIDTH + tile * PLANET_POLAR_TEXTURE_SIZE + x
  ) * 4;
}

function preparePolarSample(pole:"north"|"south", unitX:number, unitY:number, radius:number) {
  const latitudeMagnitude = Math.acos(
    Math.min(1, radius * Math.cos(PLANET_POLAR_BOUNDARY_LATITUDE)),
  );
  const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
  let longitude = Math.atan2(unitY, unitX);
  if (longitude < 0) longitude += Math.PI * 2;
  const position = spherePoint(latitude, longitude);
  const normal = normalizeVector([
    position[0] / (EQUATORIAL_RADIUS ** 2),
    position[1] / (EQUATORIAL_RADIUS ** 2),
    position[2] / (POLAR_RADIUS ** 2),
  ]);
  return {
    latitude,
    longitude,
    position,
    normal,
    sourceX: longitude / (Math.PI * 2) * PLANET_SOURCE_TEXTURE_WIDTH - 0.5,
    sourceY: (Math.PI / 2 - latitude) / Math.PI * PLANET_SOURCE_TEXTURE_HEIGHT - 0.5,
  };
}

function preparePolarObservationBoundaryGains({
  surfaceData,
  surfaceInfo,
  polarObservationNorthPolar,
  surfaceChannelFactors,
}: {surfaceData:Uint8Array;surfaceInfo:PixelImage['info'];polarObservationNorthPolar:PixelImage;surfaceChannelFactors:readonly number[]}) {
  const sourceTotals = [0, 0, 0];
  const polarObservationTotals = [0, 0, 0];
  const sampleCount = 720;
  const boundaryRadius = 0.965;
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = index / sampleCount * Math.PI * 2;
    const unitX = Math.cos(angle) * boundaryRadius;
    const unitY = Math.sin(angle) * boundaryRadius;
    const sample = preparePolarSample("north", unitX, unitY, boundaryRadius);
    const sourceSample = samplePolarSurfaceRgba(
      surfaceData,
      surfaceInfo,
      sample,
      boundaryRadius,
    );
    const polarObservation = samplePolarObservationSourceRgba(
      polarObservationNorthPolar,
      sample,
      surfaceChannelFactors,
    );
    for (let channel = 0; channel < 3; channel += 1) {
      sourceTotals[channel] += sourceSample[channel];
      polarObservationTotals[channel] += polarObservation[channel];
    }
  }
  return sourceTotals.map((total, channel) => Math.max(
    0.65,
    Math.min(1.45, total / polarObservationTotals[channel]),
  ));
}

function samplePolarObservationNorthPolarRgba({
  sourceSurface,
  polarObservationNorthPolar,
  sample,
  radius,
  surfaceChannelFactors,
  boundaryGains,
}: {sourceSurface:readonly number[];polarObservationNorthPolar:PixelImage;sample:ReturnType<typeof preparePolarSample>;radius:number;surfaceChannelFactors:readonly number[];boundaryGains:readonly number[]}) {
  const polarObservation = samplePolarObservationSourceRgba(
    polarObservationNorthPolar,
    sample,
    surfaceChannelFactors,
  );
  const boundaryAmount = smootherStep(
    POLAR_OBSERVATION_POLAR_BLEND_START,
    1,
    radius,
  );
  return [0, 1, 2].map((channel) => mix(
    Math.max(0, Math.min(255, polarObservation[channel] * boundaryGains[channel])),
    sourceSurface[channel],
    boundaryAmount,
  )).concat(sourceSurface[3]);
}

function samplePolarObservationSourceRgba(
  polarObservationNorthPolar:PixelImage,
  sample:ReturnType<typeof preparePolarSample>,
  surfaceChannelFactors:readonly number[],
) {
  const projectedRadiusKm = 2 * OBJECT_EQUATORIAL_RADIUS_KM * Math.tan(
    (Math.PI / 2 - sample.latitude) / 2,
  );
  const pixelRadius = projectedRadiusKm / POLAR_OBSERVATION_POLAR_KM_PER_PIXEL;
  const sourceX = POLAR_OBSERVATION_POLAR_CENTER + Math.cos(sample.longitude) * pixelRadius;
  const sourceY = POLAR_OBSERVATION_POLAR_CENTER - Math.sin(sample.longitude) * pixelRadius;
  const sampled = sampleClampedBilinearRgb(
    polarObservationNorthPolar.data,
    polarObservationNorthPolar.info,
    sourceX,
    sourceY,
  );
  return sampled.map((channel, index) => applyLinearTint(
    channel,
    surfaceChannelFactors[index],
  )).concat(255);
}

function sampleClampedBilinearRgb(data:Uint8Array, info:PixelImage['info'], sourceX:number, sourceY:number) {
  const x = Math.max(0, Math.min(info.width - 1, sourceX));
  const y = Math.max(0, Math.min(info.height - 1, sourceY));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(info.width - 1, x0 + 1);
  const y1 = Math.min(info.height - 1, y0 + 1);
  const xAmount = x - x0;
  const yAmount = y - y0;
  return [0, 1, 2].map((channel) => {
    const top = mix(
      data[(y0 * info.width + x0) * info.channels + channel],
      data[(y0 * info.width + x1) * info.channels + channel],
      xAmount,
    );
    const bottom = mix(
      data[(y1 * info.width + x0) * info.channels + channel],
      data[(y1 * info.width + x1) * info.channels + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

function smootherStep(edge0:number, edge1:number, value:number) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function samplePolarSurfaceRgba(data:Uint8Array, info:PixelImage['info'], sample:ReturnType<typeof preparePolarSample>, radius:number) {
  const poleBlendRadius = 2 / PLANET_POLAR_TEXTURE_SIZE;
  const direct = sampleWrappedBilinearRgba(
    data,
    info,
    sample.sourceX,
    sample.sourceY,
  );
  if (radius >= poleBlendRadius) return direct;
  const longitudinalAverage = [0, 0, 0, 0];
  for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
    const poleSample = sampleWrappedBilinearRgba(
      data,
      info,
      (longitudeIndex + 0.5) / LONGITUDE_SEGMENTS * info.width - 0.5,
      sample.sourceY,
    );
    for (let channel = 0; channel < 4; channel += 1) {
      longitudinalAverage[channel] += poleSample[channel];
    }
  }
  const directAmount = radius / poleBlendRadius;
  return longitudinalAverage.map((sum, channel) =>
    directAmount * direct[channel] +
    (1 - directAmount) * sum / LONGITUDE_SEGMENTS
  );
}

function sampleWrappedBilinearRgba(data:Uint8Array, info:PixelImage['info'], sourceX:number, sourceY:number) {
  const x0 = Math.floor(sourceX);
  const clampedY = Math.max(0, Math.min(info.height - 1, sourceY));
  const y0 = Math.floor(clampedY);
  const xAmount = sourceX - x0;
  const yAmount = clampedY - y0;
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(info.height - 1, y0 + 1));
  const wrappedX0 = ((x0 % info.width) + info.width) % info.width;
  const wrappedX1 = ((x1 % info.width) + info.width) % info.width;
  return Array.from({ length: 4 }, (_, channel) => {
    const top = mix(
      data[(y0 * info.width + wrappedX0) * info.channels + channel],
      data[(y0 * info.width + wrappedX1) * info.channels + channel],
      xAmount,
    );
    const bottom = mix(
      data[(y1 * info.width + wrappedX0) * info.channels + channel],
      data[(y1 * info.width + wrappedX1) * info.channels + channel],
      xAmount,
    );
    return mix(top, bottom, yAmount);
  });
}

function preparePolarMaterialSample({
  normal,
  position,
  objectLight,
  objectView,
  ringData,
  ringTextureWidth,
  maximumLightingFactor,
}:Omit<RingRaster,'foregroundRingData'|'ringData'> & {ringData:Uint8Array;normal:ReadonlyVector3;position:ReadonlyVector3;objectLight:ReadonlyVector3;objectView:ReadonlyVector3}) {
  const lambert = Math.max(0, dotVector(normal, objectLight));
  const diffusePower = prepareGlobeDiffusePower(lambert);
  const ringOpacity = sampleRingShadowOpacity(
    position,
    objectLight,
    ringData,
    ringTextureWidth,
  );
  const directTransmission = mix(
    1,
    RING_SHADOW_DIRECT_TRANSMISSION,
    ringOpacity,
  );
  const tint = textureTintFactors(
    LIGHTING.directionalLight.intensity * diffusePower * directTransmission,
    LIGHTING.directionalLight.color,
    LIGHTING.ambientLight.color,
    LIGHTING.ambientLight.intensity,
  );
  const lightingAlpha = preparedLightingAlpha(tint, maximumLightingFactor);
  const atmosphereAlpha = preparedAtmosphereOpacity(normal, objectLight, objectView);
  const alpha = 1 - (1 - lightingAlpha) * (1 - atmosphereAlpha);
  return {
    alpha,
    color: alpha > 0
      ? ATMOSPHERE_COLOR.map((channel) => channel * atmosphereAlpha / alpha)
      : [0, 0, 0],
  };
}

function writePreparedMaterialOverlay(
  output:Uint8Array,
  offset:number,
  tint:ReturnType<typeof textureTintFactors>,
  maximumLightingFactor:number,
  atmosphereAlpha:number,
) {
  const lightingAlpha = preparedLightingAlpha(tint, maximumLightingFactor);
  const alpha = 1 - (1 - atmosphereAlpha) * (1 - lightingAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    output[offset + channel] = alpha > 0
      ? Math.round(ATMOSPHERE_COLOR[channel] * atmosphereAlpha / alpha)
      : 0;
  }
  output[offset + 3] = Math.round(alpha * 255);
}

function preparedLightingAlpha(tint:ReturnType<typeof textureTintFactors>, maximumLightingFactor:number) {
  const lightingFactor = Math.max(tint.r, tint.g, tint.b) / maximumLightingFactor;
  const desiredChannel = applyLinearTint(
    PLANET_LIGHTING_REFERENCE_CHANNEL,
    lightingFactor,
  );
  return Math.max(0, Math.min(
    1,
    1 - desiredChannel / PLANET_LIGHTING_REFERENCE_CHANNEL,
  ));
}

function prepareGlobeDiffusePower(lambert:number) {
  const [edge0, edge1] = GLOBE_TERMINATOR_SMOOTHSTEP;
  const amount = Math.max(0, Math.min(1, (lambert - edge0) / (edge1 - edge0)));
  const terminator = amount * amount * (3 - 2 * amount);
  return lambert * terminator;
}

function preparedAtmosphereOpacity(normal:ReadonlyVector3, objectLight:ReadonlyVector3, objectView:ReadonlyVector3) {
  const viewAlignment = Math.max(0, dotVector(normal, objectView));
  const limb = Math.pow(1 - viewAlignment, ATMOSPHERE_LIMB_EXPONENT);
  const lightAlignment = Math.max(0, dotVector(normal, objectLight));
  const sunwardAmount = ATMOSPHERE_NIGHT_FLOOR +
    (1 - ATMOSPHERE_NIGHT_FLOOR) * Math.sqrt(lightAlignment);
  return Math.max(0, Math.min(
    ATMOSPHERE_MAXIMUM_ALPHA,
    limb * ATMOSPHERE_MAXIMUM_ALPHA * sunwardAmount,
  ));
}

function intersectViewRayWithEllipsoidSurface(origin:ReadonlyVector3, direction:ReadonlyVector3) { return intersectViewRayWithEllipsoid(origin, direction, { equatorialRadius: EQUATORIAL_RADIUS, polarRadius: POLAR_RADIUS }); }

function sampleRingShadowOpacity(
  position:ReadonlyVector3,
  [lightX, lightY, lightZ]:ReadonlyVector3,
  ringData:Uint8Array,
  textureSize:number,
  sampleRadiusPixels = 0,
) {
  const rayDistance = -position[2] / lightZ;
  if (rayDistance <= 0) return 0;
  const ringX = position[0] + rayDistance * lightX;
  const ringY = position[1] + rayDistance * lightY;
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return 0;
  const textureX = (ringX / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const textureY = (ringY / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const center = sampleAlphaBilinear(
    ringData,
    textureSize,
    textureX,
    textureY,
  );
  if (sampleRadiusPixels <= 0) return center;
  const samples = [
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX - sampleRadiusPixels,
      textureY,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX + sampleRadiusPixels,
      textureY,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX,
      textureY - sampleRadiusPixels,
    ),
    sampleAlphaBilinear(
      ringData,
      textureSize,
      textureX,
      textureY + sampleRadiusPixels,
    ),
  ];
  return (center * 4 + samples.reduce((sum, value) => sum + value, 0)) / 8;
}

function prepareProjectedMeshSilhouetteCoverage(options:Omit<SilhouetteOptions,'equatorialRadius'|'polarRadius'|'latitudeSegments'|'longitudeSegments'>) { return prepareProjectedEllipsoidSilhouetteCoverage({ ...options, equatorialRadius: EQUATORIAL_RADIUS, polarRadius: POLAR_RADIUS, latitudeSegments: LATITUDE_SEGMENTS, longitudeSegments: LONGITUDE_SEGMENTS }); }

function sampleForegroundRing(
  origin:ReadonlyVector3,
  view:ReadonlyVector3,
  surfaceDistance:number,
  ringData:Uint8Array|null,
  textureSize:number,
) {
  if (!ringData || Math.abs(view[2]) < 1e-9) return null;
  const ringDistance = -origin[2] / view[2];
  if (ringDistance <= surfaceDistance) return null;
  const ringX = origin[0] + ringDistance * view[0];
  const ringY = origin[1] + ringDistance * view[1];
  if (Math.hypot(ringX, ringY) > RING_OUTER_RADIUS) return null;
  const textureX = (ringX / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const textureY = (ringY / RING_OUTER_RADIUS + 1) * 0.5 * (textureSize - 1);
  const sample = sampleRgbaBilinear(
    ringData,
    textureSize,
    textureX,
    textureY,
  );
  return sample[3] > 0 ? sample : null;
}

function prepareObjectViewDirection(scenePitchDegrees:number, systemObliquityDegrees:number) { return prepareViewDirection(scenePitchDegrees, { systemObliquityDegrees, presentationNodeDegrees: OBJECT_PRESENTATION_NODE_DEGREES, meshRotationDegrees: MESH_ROTATION_Z }); }

function prepareObjectLightDirection(systemObliquityDegrees:number) { return prepareObjectSpaceDirection(normalizeVector(PREPARED_RING_SOURCE.shadowModel.worldLightDirection), { systemObliquityDegrees, presentationNodeDegrees: OBJECT_PRESENTATION_NODE_DEGREES, meshRotationDegrees: MESH_ROTATION_Z }); }

function prepareInitialObjectViewDirection() {
  return prepareObjectViewDirection(
    CAMERA_ROTATION_X_DEGREES,
    OBJECT_OBLIQUITY_DEGREES,
  );
}

function prepareBody() {
  const polygons = createUvSpherePolygons();
  // Detect shared edges from the unexpanded source topology. The tiny
  // presentation overlap intentionally moves neighboring vertices apart and
  // therefore cannot be the authority for seam ownership.
  const seamEdges = prepareBodySeamEdges();
  return polygons.map((polygon, index) => {
    const sharedEdges = seamEdges.get(index);
    if (polygon.texture) {
      return {
        latitudeIndex: polygon.latitudeIndex,
        ...(Number.isSafeInteger(polygon.longitudeIndex)
          ? { longitudeIndex: polygon.longitudeIndex }
          : {}),
        ...(Number.isSafeInteger(polygon.lightingFaceIndex)
          ? { lightingFaceIndex: polygon.lightingFaceIndex }
          : {}),
        leaf: {
          tag: "s",
          ...(polygon.polarCap
            ? { className: `${config.namespace}-polar-surface ${config.namespace}-polar-${polygon.polarCap}` }
            : {}),
          ...textureStyle(
            polygon,
            index,
            sharedEdges,
            polygon.polarCap ? 0 : PLANET_SEAM_BLEED,
          ),
        },
      };
    }
    const plan = computeSolidTrianglePlan(
      polygon,
      index,
      {
        ...PLAN_OPTIONS,
        seamBleed: PLANET_SEAM_BLEED,
        ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
      },
    );
    if (!plan) throw new Error(`Solid body leaf ${index} did not prepare.`);
    return {
      latitudeIndex: polygon.latitudeIndex,
      leaf: { tag: "u", style: plan.styleText },
    };
  });
}

function preparePolarInnerLeaves() {
  return (["south", "north"] as const).map((pole, index) => ({
    latitudeIndex: pole === "north" ? LATITUDE_SEGMENTS - 1 : 0,
    leaf: {
      tag: "s",
      className: `${config.namespace}-polar-inner ${config.namespace}-polar-inner-${pole}`,
      ...textureStyle(createPolarCapPolygon(pole, "inner"), index, null, 0),
    },
  }));
}

function prepareBodyBands<T extends RetainedLeaf>(preparedBodyLeaves:readonly {latitudeIndex?:number;leaf:T}[]) {
  return Array.from({ length: LATITUDE_SEGMENTS }, (_, latitudeIndex) => {
    const latitudeDegrees = -90 +
      (latitudeIndex + 0.5) * 180 / LATITUDE_SEGMENTS;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const highLatitudeAmount = Math.pow(Math.sin(latitudeRadians), 2);
    const realRotationSeconds = mix(
      OBJECT_EQUATOR_CLOUD_ROTATION_SECONDS,
      OBJECT_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS,
      highLatitudeAmount,
    );
    // Keep every latitude carrier on one shared geometric phase so adjacent
    // low-poly band boundaries remain aligned throughout the rotation.
    const visualRotationSeconds = PLANET_ROTATION_SECONDS;
    return {
      latitudeIndex,
      latitudeDegrees: Number(latitudeDegrees.toFixed(3)),
      realRotationSeconds: Number(realRotationSeconds.toFixed(3)),
      visualRotationSeconds: Number(visualRotationSeconds.toFixed(3)),
      leaves: preparedBodyLeaves
        .filter((preparedLeaf) => preparedLeaf.latitudeIndex === latitudeIndex)
        .map((preparedLeaf) => preparedLeaf.leaf),
    };
  });
}

function prepareRingPoint(point:RingMotionPoint, index:number, pointMode:string) {
  const [x, y, z, color, sourceOpacity, inverted = false] = point;
  const [cssX, cssY, cssZ] = worldPositionToCss([x, y, z]);
  const opacity = inverted ? 0.5 : prepareRingPointOpacity(sourceOpacity);
  const halfSize = 1.18;
  const polygon:Polygon = {
    vertices: [
      [x - halfSize, y - halfSize, z], [x + halfSize, y - halfSize, z],
      [x + halfSize, y + halfSize, z], [x - halfSize, y + halfSize, z],
    ],
    color,
  };
  const plan = computeTextureAtlasPlanPublic(polygon, index, PLAN_OPTIONS);
  if (!plan) throw new Error(`Ring point ${index} did not prepare.`);
  const transform = pointMode === "billboard"
    ? `${buildPolyMeshTransform({ rotation: [-OBJECT_OBLIQUITY_DEGREES, 0, 0] })} ` +
      `${buildPolyMeshTransform({ rotation: [0, 0, -OBJECT_PRESENTATION_NODE_DEGREES] })} ` +
      `rotateX(${-CAMERA_ROTATION_X_DEGREES}deg) scale(${POINT_LOCAL_SCALE}) ` +
      `translate(-50%, -50%)`
    : `scale(${POINT_LOCAL_SCALE}) translate(-50%, -50%)`;
  return {
    style: `translate:${formatCssLength(cssX)} ${formatCssLength(cssY)} ` +
      `${formatCssLength(cssZ)};transform:${transform}` +
      `;color:${plan.shadedColor};opacity:${opacity}`,
    opacity: String(opacity),
  };
}

function prepareRingPointExpansion(point:RingMotionPoint, index:number, groupIndex:number):RingMotionPoint {
  const [x, y, z, color, opacity, inverted = false] = point;
  const radius = Math.hypot(x, y);
  const sourceAngle = Math.atan2(x, y);
  const phaseTurns = (
    (index + 1) * 0.61803398875 +
    (groupIndex + 1) * 0.41421356237
  ) % 1;
  const angle = sourceAngle + phaseTurns * Math.PI * 2;
  return [
    Number((Math.sin(angle) * radius).toFixed(3)),
    Number((Math.cos(angle) * radius).toFixed(3)),
    Number((z * ((index + groupIndex) % 2 === 0 ? 1 : -1)).toFixed(3)),
    color,
    opacity,
    inverted,
  ];
}

function ringPointMode(population:string) {
  return population.startsWith("main-ring-") ||
      population === "g-ring-dust" ||
      population === "janus-epimetheus-ring-dust"
    ? "surface"
    : "billboard";
}

function ringPointCompositeMode(population:string) {
  return population === "g-ring-dust" || population.startsWith("e-ring-")
    ? "flat"
    : "preserve-3d";
}

function ringPointAnimated(population:string) {
  return !population.startsWith("e-ring-");
}

function prepareRingPointOpacity(sourceOpacity:number) {
  const [sourceMinimum, sourceMaximum] = RING_POINT_SOURCE_OPACITY_RANGE;
  const normalized = Math.max(0, Math.min(1,
    (sourceOpacity - sourceMinimum) / (sourceMaximum - sourceMinimum)));
  return Number(mix(
    RING_POINT_PRESENTATION_OPACITY_RANGE[0],
    RING_POINT_PRESENTATION_OPACITY_RANGE[1],
    normalized,
  ).toFixed(3));
}

function mix(start:number, end:number, amount:number) {
  return start + (end - start) * amount;
}

async function prepareCompleteScene(preparedMaterial:Awaited<ReturnType<typeof composePlanetTextures>>) {
const meshTransform = `transform:${buildPolyMeshTransform({ rotation: [0, 0, MESH_ROTATION_Z] })}`;
const systemTransform = `transform:${buildPolyMeshTransform({
  rotation: [0, 0, OBJECT_PRESENTATION_NODE_DEGREES],
})} ${buildPolyMeshTransform({ rotation: [OBJECT_OBLIQUITY_DEGREES, 0, 0] })}`;
const camera = createPolyCamera({
  zoom: CAMERA_ZOOM,
  rotX: CAMERA_ROTATION_X_DEGREES,
  rotY: 0,
  target: [0, 0, 0],
});
const {
  surface: preparedSurface,
  lighting: preparedLighting,
} = preparedMaterial;
const polarInnerLeaves = preparePolarInnerLeaves();
const preparedBodyLeaves = prepareBody();
const bodyLeaves = [...polarInnerLeaves, ...preparedBodyLeaves];
const bodyBands = prepareBodyBands(bodyLeaves);
const cutawayOuterBodyLeaves = [
  ...prepareCutawayOuterPolarLeaves(),
  ...preparedBodyLeaves.filter((preparedLeaf) =>
    'longitudeIndex' in preparedLeaf && preparedLeaf.longitudeIndex !== undefined && Number.isSafeInteger(preparedLeaf.longitudeIndex) &&
    !interiorLongitudeRemoved(
      (preparedLeaf.longitudeIndex + 0.5) * 360 / LONGITUDE_SEGMENTS,
    )),
];
const cutawayBodyBands = prepareBodyBands(cutawayOuterBodyLeaves);
const interiorMetallicLeaves = prepareInteriorShell({
  radiusScale: requireViews().cutaway.metallicShellRadius,
  surface: requireViews().assets.metallic,
  poles: requireViews().assets.metallicPoles,
  cutaway: true,
});
const interiorCoreLeaves = prepareInteriorShell({
  radiusScale: requireViews().cutaway.diffuseCoreVisualRadius,
  surface: requireViews().assets.core,
  poles: requireViews().assets.corePoles,
  cutaway: false,
});
const interiorSectionLeaves = prepareInteriorSectionLeaves();
const cutawayBodyLeafCount = cutawayBodyBands.reduce(
  (count, band) => count + band.leaves.length,
  0,
);
const interiorLeafCount = cutawayBodyLeafCount +
  interiorMetallicLeaves.length + interiorCoreLeaves.length +
  interiorSectionLeaves.length;
const bodyLeafCount = bodyBands.reduce((count, band) => count + band.leaves.length, 0);
const preparedRingPointGroups = PREPARED_RING_GROUPS.map((group, retainedIndex) => {
  const groupIndex = group.expansionGroupIndex ??
    (retainedIndex === 0 ? 0 : retainedIndex + 1);
  const pointMode = ringPointMode(group.population);
  const expansionPoints = group.points.map((point, index) =>
    prepareRingPointExpansion(point, index, groupIndex));
  return {
    population: group.population,
    pointMode,
    compositeMode: ringPointCompositeMode(group.population),
    animated: ringPointAnimated(group.population),
    pointCount: group.points.length,
    expansionPointCount: expansionPoints.length,
    durationSeconds: group.durationSeconds,
    leaves: group.points.map((point, index) =>
      prepareRingPoint(point, index, pointMode)),
    expansionLeaves: expansionPoints.map((point, index) => prepareRingPoint(
      point,
      group.points.length + index,
      pointMode,
    )),
  };
});
const baselineRingPointLeafCount = preparedRingPointGroups.reduce(
  (count, group) => count + group.leaves.length,
  0,
);
const expansionRingPointLeafCount = preparedRingPointGroups.reduce(
  (count, group) => count + group.expansionLeaves.length,
  0,
);
const preparedRingMotionPlates = PREPARED_MAIN_RING_PLATES.map(
  canonicalRingMotionPlateStyle,
);
const preparedRingMotionExpansionPlates:typeof preparedRingMotionPlates = [];
const orbitDefaultControlPitch =
  CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES *
  (1 - CAMERA_ROTATION_X_DEGREES /
    CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES);
const orbitStartRemaining =
  CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES /
  (CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES -
    orbitDefaultControlPitch);
const orbitTransform = (remaining:number) => {
  const scenePitch = CAMERA_ROTATION_X_DEGREES * remaining;
  const systemTilt = -OBJECT_OBLIQUITY_DEGREES * remaining;
  const cameraTransform = buildPolyCameraSceneTransform({
    ...camera.state,
    rotX: scenePitch,
  });
  const systemNode = -OBJECT_PRESENTATION_NODE_DEGREES;
  return `${cameraTransform} rotateZ(${systemNode}deg) ` +
    `rotateY(${systemTilt}deg) ` +
    `rotateY(${OBJECT_OBLIQUITY_DEGREES}deg) ` +
    `rotateZ(${-systemNode}deg)`;
};

const scene = {
  schema: config.labels.label017,
  camera: {
    state: camera.state,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
    orbitPlayback: {
      schema: config.labels.label018,
      minimumControlPitchDegrees:
        CAMERA_ORBIT_MINIMUM_CONTROL_PITCH_DEGREES,
      maximumControlPitchDegrees:
        CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES,
      defaultControlPitchDegrees: orbitDefaultControlPitch,
      maximumScenePitchDegrees: CAMERA_ORBIT_MAXIMUM_SCENE_PITCH_DEGREES,
      durationMilliseconds:
        CAMERA_ORBIT_MAXIMUM_CONTROL_PITCH_DEGREES * 1_000,
      millisecondsPerControlDegree: 1_000,
      keyframes: [
        { transform: orbitTransform(orbitStartRemaining) },
        { transform: orbitTransform(0) },
      ],
      interpolation: "linear-same-axis-transform-functions",
      runtimeTransport:
        "prepared-two-keyframe-compositor-scrub",
      runtimeMatrixConstructionForPitch: false,
      runtimeTransformStringFormattingForPitch: false,
    },
  },
  systemTransform,
  meshTransform,

  preparedSurface,
  preparedLighting,
  fixedMaterialPlane: {
    model:
      "approved-default-continuously-projected-dense-state-oblate-material-plane",
    transform: meshTransform,
    leaf: preparedLighting.leaf,
    runtimeWork: "single-transform-and-address-on-input-change",
    interactionProjection: {
      equatorialRadius: EQUATORIAL_RADIUS,
      polarRadius: POLAR_RADIUS,
      coverageScale: PLANET_FIXED_MATERIAL_COVERAGE_SCALE,
      textureSize: PLANET_FIXED_MATERIAL_SIZE,
      depthBias: PLANET_FIXED_MATERIAL_DEPTH_BIAS,
      presentationNodeDegrees: OBJECT_PRESENTATION_NODE_DEGREES,
      meshRotationDegrees: MESH_ROTATION_Z,
      tileSize: TILE_SIZE,
    },
  },
  preparedRingSource: PREPARED_RING_SOURCE,
  ringPlane: canonicalRingTextureStyle(),
  ringMotionPlates: preparedRingMotionPlates,
  ringMotionExpansionPlates: preparedRingMotionExpansionPlates,
  ringShadowPlane: croppedRingShadowTextureStyle(),
  ringPointGroups: preparedRingPointGroups,

  bodyBands,
  interior: {
    schema: config.labels.label019,
    qualification: requireViews().cutaway.qualification,
    cutaway: requireViews().cutaway,
    outerBodyBands: cutawayBodyBands,
    shells: [
      {
        id: "metallic-hydrogen",
        className: config.labels.label020,
        leaves: interiorMetallicLeaves,
      },
      {
        id: "diffuse-core",
        className: config.labels.label021,
        leaves: interiorCoreLeaves,
      },
    ],
    sectionLeaves: interiorSectionLeaves,
    atmosphere: preparedLighting.interiorAtmosphere,
    runtimeGeometry: false,
    runtimeRasterization: false,
    leafCount: interiorLeafCount,
  },
  preparedMotion: {
    model: "nasa-cloud-periods-shared-phase-rotation-under-fixed-world-material-plane",
    referenceRotationRealSeconds: OBJECT_REFERENCE_ROTATION_SECONDS,
    referenceRotationVisualSeconds: PLANET_ROTATION_SECONDS,
    presentationTimeScale: Number(PRESENTATION_TIME_SCALE.toFixed(6)),
    equatorCloudRotationRealSeconds: OBJECT_EQUATOR_CLOUD_ROTATION_SECONDS,
    highLatitudeCloudRotationRealSeconds:
      OBJECT_HIGH_LATITUDE_CLOUD_ROTATION_SECONDS,
    obliquityDegrees: OBJECT_OBLIQUITY_DEGREES,
    obliquityAxis: "source-x",
    obliquityOwner: config.labels.label022,
    presentationNodeDegrees: OBJECT_PRESENTATION_NODE_DEGREES,
    cameraOrbitalElevationDegrees: CAMERA_ORBITAL_ELEVATION_DEGREES,
    cameraRotationXDegrees: CAMERA_ROTATION_X_DEGREES,
    ringPointPresentation: {
      primitive: "prepared-mode-polycss-point-leaf",
      surfacePointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "surface")
        .reduce((count, group) => count + group.points.length, 0),
      preparedRasterPointCount:
        PREPARED_MAIN_RING_PLATES.reduce(
          (count, plate) => count + plate.pointCount,
          0,
        ),
      preparedRasterPlateCount: preparedRingMotionPlates.length,
      preparedRasterExpansionPointCount: 0,
      preparedRasterExpansionPlateCount: 0,
      billboardPointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "billboard")
        .reduce((count, group) => count + group.points.length, 0),
      animatedBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) =>
          ringPointMode(group.population) === "billboard" &&
          ringPointAnimated(group.population))
        .reduce((count, group) => count + group.points.length, 0),
      staticBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) =>
          ringPointMode(group.population) === "billboard" &&
          !ringPointAnimated(group.population))
        .reduce((count, group) => count + group.points.length, 0),
      maximumSurfacePointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "surface")
        .reduce((count, group) => count + group.points.length * 2, 0),
      maximumBillboardPointCount: PREPARED_RING_GROUPS
        .filter((group) => ringPointMode(group.population) === "billboard")
        .reduce((count, group) => count + group.points.length * 2, 0),
      densityRange: [1, 1],
      defaultDensity: 1,
      surfaceMode: "coplanar-ring-quad-no-counter-rotation",
      freeDustMode: "none",
      localScale: Number(POINT_LOCAL_SCALE.toFixed(6)),
      varianceModel: "prepared-continuous-opacity-with-fixed-point-size",
      sourceOpacityRange: RING_POINT_SOURCE_OPACITY_RANGE,
      presentationOpacityRange: RING_POINT_PRESENTATION_OPACITY_RANGE,
      runtimeJavaScriptWritesPerFrame: 0,
    },
    viewingGeometry: "fixed-camera-independent-orbital-frame-presentation",
  },
  counts: {
    polygonCount: 2 + preparedRingMotionPlates.length +
      preparedRingMotionExpansionPlates.length +
      baselineRingPointLeafCount + expansionRingPointLeafCount +
      bodyLeafCount + interiorLeafCount + 2,
    planetPolygonCount: bodyLeafCount + 1,
    interiorLeafCount,
    cutawayBodyLeafCount,
    interiorMetallicLeafCount: interiorMetallicLeaves.length,
    interiorCoreLeafCount: interiorCoreLeaves.length,
    interiorSectionLeafCount: interiorSectionLeaves.length,
    interiorAtmosphereLeafCount: 1,
    polarInnerLeafCount: polarInnerLeaves.length,
    polarSurfaceLeafCount: 2,
    polarMaterialLeafCount: 0,
    polarInnerMaterialLeafCount: 0,
    fixedMaterialPlaneLeafCount: 1,
    ringPlaneCount: 1,
    ringShadowPlaneCount: 1,
    ringPointCount: PREPARED_RING_SOURCE.pointCount,
    baselineRingPointLeafCount,
    ringPointExpansionLeafCount: expansionRingPointLeafCount,
    ringPointLeafCount:
      baselineRingPointLeafCount + expansionRingPointLeafCount,
    ringMotionPlateLeafCount: preparedRingMotionPlates.length,
    ringMotionExpansionPlateLeafCount:
      preparedRingMotionExpansionPlates.length,
    ringDustTextureLeafCount: 0,
    ringPointGroupCount: PREPARED_RING_GROUPS.length,
    bodyBandCount: bodyBands.length,
    textureLeafCount: 3 + preparedRingMotionPlates.length +
      preparedRingMotionExpansionPlates.length +
      bodyLeafCount + interiorLeafCount + 1,
  },
};

function runtimeLeaf(leaf:RetainedLeaf) {
  return {
    ...(leaf.tag ? { tag: leaf.tag } : {}),
    ...(leaf.className ? { className: leaf.className } : {}),
    style: leaf.style,
    ...(leaf.projectiveTextureLayer
      ? { projectiveTextureLayer: leaf.projectiveTextureLayer }
      : {}),
  };
}

function runtimeBodyBand(band:{visualRotationSeconds:number;leaves:readonly RetainedLeaf[]}) {
  return {
    visualRotationSeconds: band.visualRotationSeconds,
    leaves: band.leaves.map(runtimeLeaf),
  };
}

function runtimePreparedPresentation(presentation:AtlasPresentation) {
  return {
    ...(presentation.assetUrl ? { assetUrl: presentation.assetUrl } : {}),
    ...(presentation.asset2xUrl
      ? { asset2xUrl: presentation.asset2xUrl }
      : {}),
    ...(presentation.frameIndex === undefined
      ? {}
      : { frameIndex: presentation.frameIndex }),
    ...(presentation.rowIndex === undefined
      ? {}
      : { rowIndex: presentation.rowIndex }),
    ...(presentation.backgroundPosition
      ? { backgroundPosition: presentation.backgroundPosition }
      : {}),
    ...(presentation.backgroundSize
      ? { backgroundSize: presentation.backgroundSize }
      : {}),
  };
}

function runtimePreparedRowPlan(plan:AtlasPlan) {
  const runtimeVariant = (variant:AtlasVariant) => ({
    runtimeAtlas: runtimePreparedPresentation(variant.runtimeAtlas),
    ...(variant.defaultPresentation ? {
      defaultPresentation: runtimePreparedPresentation(
        variant.defaultPresentation,
      ),
    } : {}),
    rows: variant.rows.map(runtimePreparedPresentation),
    presentations: variant.presentations.map(runtimePreparedPresentation),
  });
  return {
    model: plan.model,
    ...(plan.defaultVariant ? { defaultVariant: plan.defaultVariant } : {}),
    defaultPreparedFrame: plan.defaultPreparedFrame,
    defaultPreparedRow: plan.defaultPreparedRow,
    initialWarmRows: plan.initialWarmRows,
    maximumRetainedAtlasCount: plan.maximumRetainedAtlasCount,
    ...(plan.variants ? {
      variants: Object.fromEntries(Object.entries(plan.variants).map(
        ([id, variant]) => [id, runtimeVariant(variant)],
      )),
    } : runtimeVariant(plan)),
    initialDecodedWorkingSetBytes: plan.initialDecodedWorkingSetBytes,
    maximumDecodedWorkingSetBytes: plan.maximumDecodedWorkingSetBytes,
    fullAtlasDecodedRgbaBytes: plan.fullAtlasDecodedRgbaBytes,
  };
}

function runtimeInteriorAtmosphere(atmosphere:{model:string;frameCount:number;minimumScenePitchDegrees:number;maximumScenePitchDegrees:number;leaf:RetainedLeaf;runtimeShards:AtlasPlan}) {
  return {
    model: atmosphere.model,
    frameCount: atmosphere.frameCount,
    minimumScenePitchDegrees: atmosphere.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atmosphere.maximumScenePitchDegrees,
    leaf: runtimeLeaf(atmosphere.leaf),
    runtimeShards: runtimePreparedRowPlan(atmosphere.runtimeShards),
  };
}

function runtimeMoonShadowAtlas(atlas:{frameCount:number;minimumScenePitchDegrees:number;maximumScenePitchDegrees:number;runtimeShards:AtlasPlan}) {
  return {
    frameCount: atlas.frameCount,
    minimumScenePitchDegrees: atlas.minimumScenePitchDegrees,
    maximumScenePitchDegrees: atlas.maximumScenePitchDegrees,
    runtimeShards: runtimePreparedRowPlan(atlas.runtimeShards),
  };
}

function createRuntimeScenePlan(source:typeof scene) {
  return {
    schema: config.labels.label023,
    camera: source.camera,
    systemTransform: source.systemTransform,
    meshTransform: source.meshTransform,
    preparedSurface: {
      mode: source.preparedSurface.mode,
      assetUrl: source.preparedSurface.assetUrl,
      assetBytes: source.preparedSurface.assetBytes,
      assetSha256: source.preparedSurface.assetSha256,
      faceCount: source.preparedSurface.faceCount,
      uvLayout: source.preparedSurface.uvLayout,
      equivalentBodySampleWidth:
        source.preparedSurface.equivalentBodySampleWidth,
      equivalentBodySampleHeight:
        source.preparedSurface.equivalentBodySampleHeight,
      seamRepair: source.preparedSurface.seamRepair,
    },
    transport: {
      sourceSchema: source.schema,
      sourceMetadataModule: "preparedScene.mjs",
      retainedLeafFields: [
        "tag",
        "className",
        "style",
        "projectiveTextureLayer",
      ],
      minorMoonFields: ["style"],
      runtimeSourceParsing: false,
    },
    preparedLighting: {
      mode: source.preparedLighting.mode,
      orbitAtlas: {
        frameCount: source.preparedLighting.orbitAtlas.frameCount,
        frameRows: source.preparedLighting.orbitAtlas.frameRows,
        minimumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.minimumScenePitchDegrees,
        maximumScenePitchDegrees:
          source.preparedLighting.orbitAtlas.maximumScenePitchDegrees,
        runtimeShards: runtimePreparedRowPlan(
          source.preparedLighting.orbitAtlas.runtimeShards,
        ),
      },
    },
    fixedMaterialPlane: {
      transform: source.fixedMaterialPlane.transform,
      leaf: runtimeLeaf(source.fixedMaterialPlane.leaf),
      interactionProjection: source.fixedMaterialPlane.interactionProjection,
    },

    preparedRingSource: {
      planeVisualOrbitSeconds: source.preparedRingSource.planeVisualOrbitSeconds,
      [config.fields.gravitationalParameter]: source.preparedRingSource[config.fields.gravitationalParameter],
      shadowModel: {
        systemTiltDegrees:
          source.preparedRingSource.shadowModel.systemTiltDegrees,
        systemNodeDegrees:
          source.preparedRingSource.shadowModel.systemNodeDegrees,
      },
    },
    ringPlane: runtimeLeaf(source.ringPlane),
    ringMotionPlates: source.ringMotionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: 'compositeMode' in plate ? requireString(plate.compositeMode) : undefined,
      durationSeconds: plate.durationSeconds,
      textureUrl: plate.textureUrl,
      texture2xUrl: plate.texture2xUrl,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringMotionExpansionPlates: source.ringMotionExpansionPlates.map((plate) => ({
      population: plate.population,
      compositeMode: 'compositeMode' in plate ? requireString(plate.compositeMode) : undefined,
      durationSeconds: plate.durationSeconds,
      leaf: runtimeLeaf(plate.leaf),
    })),
    ringShadowPlane: runtimeLeaf(source.ringShadowPlane),
    ringPointGroups: source.ringPointGroups.map((group) => ({
      pointMode: group.pointMode,
      animated: group.animated,
      compositeMode: group.compositeMode,
      durationSeconds: group.durationSeconds,
      leaves: group.leaves.map(runtimeLeaf),
      expansionLeaves: group.expansionLeaves.map(runtimeLeaf),
    })),

    bodyBands: source.bodyBands.map(runtimeBodyBand),
    interior: {
      schema: source.interior.schema,
      outerBodyBands: source.interior.outerBodyBands.map(runtimeBodyBand),
      shells: source.interior.shells.map((shell) => ({
        className: shell.className,
        leaves: shell.leaves.map(runtimeLeaf),
      })),
      sectionLeaves: source.interior.sectionLeaves.map(runtimeLeaf),
      atmosphere: runtimeInteriorAtmosphere(source.interior.atmosphere),
      leafCount: source.interior.leafCount,
    },
    preparedMotion: {
      referenceRotationVisualSeconds:
        source.preparedMotion.referenceRotationVisualSeconds,
      obliquityDegrees: source.preparedMotion.obliquityDegrees,
      cameraRotationXDegrees: source.preparedMotion.cameraRotationXDegrees,
    },
    counts: source.counts,
  };
}

const runtimeScene = createRuntimeScenePlan(scene);
return { scene, runtimeScene };
}

return { prepareBaseMaterialSurfaces: prepareNormalMaterialMasters, composeMaterialSurfaces: composePlanetTextures, prepareLayeredScene: prepareCompleteScene };
}

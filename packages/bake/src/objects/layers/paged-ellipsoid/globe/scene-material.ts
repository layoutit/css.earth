import { normalize3Unchecked } from '@cssearth/core';
import type {Vec3} from '@layoutit/polycss';
import { worldPositionToCss } from "@layoutit/polycss";
import type { AtmosphereConfiguration } from './atmosphere.ts';
import type { AtmosphereModel, PagedSceneContext } from './scene-context.ts';
interface MaterialBankOptions {id: 'atmosphere'; className: string; physicalRadius: number; depthBias: number; source: AtmosphereModel; illumination: AtmosphereConfiguration['material']['illumination'];}
interface MaterialPlaneOptions {scenePitchDegrees: number; outputSize: number; contentRadius: number; physicalRadius: number; depthBias: number; className: string;}

export function prepareMaterialBank(ctx: PagedSceneContext, {
  id,
  className,
  physicalRadius,
  depthBias,
  source,
  illumination,
}: MaterialBankOptions) {
  const { profile, EQUATORIAL_RADIUS, CAMERA_SCENE_PITCH_DEGREES, CAMERA_DEFAULT_CONTROL_PITCH_DEGREES, CAMERA_MAXIMUM_CONTROL_PITCH_DEGREES, CAMERA_MILLISECONDS_PER_CONTROL_DEGREE, MATERIAL_FRAMES_PER_SHARD, MATERIAL_PRESENTATION_SIZE, MATERIAL_TILE_SIZE, ATMOSPHERE_DEFAULT_FRAME, atmosphereProfile, CAMERA_DURATION_MILLISECONDS } = ctx;
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
  const defaultFrame = ATMOSPHERE_DEFAULT_FRAME;
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
      const flood = frameIndex === frameCount - 1;
      return Object.freeze({
        frameIndex,
        rowIndex,
        columnIndex,
        tileRowIndex,
        scenePitchDegrees,
        flood,
        assets: materialAssetPair(ctx,
          id,
          flood ? "flood" : `row-${String(rowIndex).padStart(2, "0")}`,
        ),
        backgroundPosition: flood ? `${-gutter * presentationScale}px ${-gutter * presentationScale}px` :
          `${-(columnIndex * stride + gutter) * presentationScale}px ` +
          `${-(tileRowIndex * stride + gutter) * presentationScale}px`,
        backgroundSize: flood ? `${stride * presentationScale}px ${stride * presentationScale}px` :
          `${shardWidth * presentationScale}px ` +
          `${shardHeight * presentationScale}px`,
        transform: prepareScreenMaterialPlane(ctx, {
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
      assets: materialAssetPair(ctx,
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
    transform: prepareScreenMaterialPlane(ctx, {
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
  const defaultPlane = prepareScreenMaterialPlane(ctx, {
    scenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
    outputSize: presentationTileSize,
    contentRadius: presentationTileSize * 0.468,
    physicalRadius,
    depthBias,
    className,
  });
  return Object.freeze({
    id,
    model: "published-disc-law-under-model-atmosphere-with-google-directional-response-bank",
    source,
    illumination, atmosphereProfile: atmosphereProfile(source),
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
    defaultAssets: materialAssetPair(ctx, id, "default"),
    floodAssets: materialAssetPair(ctx, id, "flood"),
    defaultScenePitchDegrees: CAMERA_SCENE_PITCH_DEGREES,
    defaultPresentation: Object.freeze({
      transform: defaultPlane.transform,
      assets: materialAssetPair(ctx, id, "default"),
      backgroundPosition: "0px 0px",
      backgroundSize:
        `${presentationTileSize}px ${presentationTileSize}px`,
    }),
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

export function materialAssetPair(ctx: PagedSceneContext, id: string, suffix: string) {
  const { profile } = ctx;
  const prefix = `${profile.publicBase}${profile.namespace}-${id}-${suffix}`;
  return Object.freeze({
    one: `${prefix}.webp`,
    two: `${prefix}@2x.webp`,
  });
}

export function prepareScreenMaterialPlane(ctx: PagedSceneContext, {
  scenePitchDegrees,
  outputSize,
  contentRadius,
  physicalRadius,
  depthBias,
  className,
}: MaterialPlaneOptions) {
  const { attitude, EQUATORIAL_RADIUS, POLAR_RADIUS } = ctx;
  const screenToObject = (vector: Vec3) => attitude.screenToObject(vector, scenePitchDegrees) as unknown as Vec3;
  const right = normalize3Unchecked(screenToObject([0, 1, 0]));
  const down = normalize3Unchecked(screenToObject([1, 0, 0]));
  const view = normalize3Unchecked(screenToObject([0, 0, 1]));
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

export function scaleVector(vector: Vec3, scale: number): Vec3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

export function addVectors(...vectors: Vec3[]): Vec3 {
  const sum = (axis: number) => vectors.reduce((sum, vector) => sum + vector[axis], 0);
  return [sum(0), sum(1), sum(2)];
}

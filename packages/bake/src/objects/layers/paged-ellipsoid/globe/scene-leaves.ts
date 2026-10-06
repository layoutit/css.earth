import type {Vec3} from '@layoutit/polycss';
import {
  buildSeamBleedPolygonEdges,
  computeTextureAtlasPlanPublic,
  formatCssLength,
  resolvePolyTextureLeafGeometry,
} from "@layoutit/polycss";
import { createProjectiveSurfaceRasterPresentation, fitTextureGeometry, fitProjectiveTextureGeometryToStableLayout, prepareProjectiveTextureLayer, prepareLeafSeamOutset, POLAR_CAP_STYLE, requireOutwardCap } from "../../../../scene/index.ts";
import type { SphereConfiguration, SpherePolygon, RasterPolygon } from '../scene-contract.ts';
import type { PagedSceneContext } from './scene-context.ts';
// Earth keeps full leaf boxes for now: its paged surface levels are being reworked on their own branch, and its leaves
// join the shared rule (packages/bake/src/presentation/layout/leaf-box.ts) with that work.
const FULL_BOXES = { leafBox: false as const };

export function prepareSphereBands(ctx: PagedSceneContext, config: SphereConfiguration, visualRotationSeconds: number) {
  const leaves = prepareSphereLeaves(ctx, config);
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

export function prepareSphereLeaves(ctx: PagedSceneContext, config: SphereConfiguration) {
  const { TILE_SIZE, PLANET_SEAM_BLEED, SURFACE_OVERLAP } = ctx;
  const polygons = createSpherePolygons(ctx,
    config,
    config.surfaceOverlap ?? SURFACE_OVERLAP,
  );
  const topology = createSpherePolygons(ctx, config, 0);
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
      ...textureStyle(ctx,
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

export function createSpherePolygons(ctx: PagedSceneContext, config: SphereConfiguration, surfaceOverlap: number) {
  const polygons: SpherePolygon[] = [];
  const polarCapBandSpan = config.polarCapBandSpan ?? 1;
  for (let latitudeIndex = 0;
    latitudeIndex < config.latitudeSegments;
    latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === config.latitudeSegments - 1) {
      polygons.push(createPolarCapPolygon(ctx,
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

export function createPolarCapPolygon(ctx: PagedSceneContext, config: SphereConfiguration, pole: "north" | "south"): SpherePolygon {
  const { POLAR_SURFACE_OVERLAP } = ctx;
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundaryLatitude = Math.PI / 2 - Math.PI /
    config.latitudeSegments * (config.polarCapBandSpan ?? 1);
  const radius = config.equatorialRadius * Math.cos(boundaryLatitude) *
    (config.polarSurfaceOverlap ?? POLAR_SURFACE_OVERLAP);
  const z = sign * (config.polarRadius * Math.sin(boundaryLatitude) + 0.1);
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
        x: north ? 0 : tileSize,
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

export function spherePoint(config: SphereConfiguration, latitude: number, longitude: number): Vec3 {
  const latitudeRadius = Math.cos(latitude);
  return [
    config.equatorialRadius * latitudeRadius * Math.cos(longitude),
    config.equatorialRadius * latitudeRadius * Math.sin(longitude),
    config.polarRadius * Math.sin(latitude),
  ];
}

export function groupPreparedEntries<T>(entries: readonly {latitudeIndex: number; leaf: T}[], latitudeSegments: number,
  visualRotationSeconds: number) {
  return Object.freeze(Array.from({ length: latitudeSegments },
    (_, latitudeIndex) => Object.freeze({
      latitudeIndex,
      visualRotationSeconds,
      leaves: Object.freeze(entries.filter((entry) =>
        entry.latitudeIndex === latitudeIndex).map(({ leaf }) => leaf)),
    })));
}

export function textureStyle(ctx: PagedSceneContext, polygon: RasterPolygon, index: number, seamEdges: Set<number> | null | undefined, seamBleed: number) {
  const { profile, BODY_LONGITUDE_SEGMENTS, INTERIOR_PROJECTIVE_TEXTURE_RASTER_SCALE, SURFACE_ATLAS, SEAM_OUTSET, BODY_DIAMETER, PLAN_OPTIONS, surfaceRasterPlan } = ctx;
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
    // lengths, so preparation's raster and leaf-box scaling (bake/presentation/layout/projective-layout.ts) scales them with the address.
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

export function preparedAtlasDimensions(width: number, height: number) {
  return (width === 64 ? "" :
    `;--polycss-atlas-width:${formatCssLength(width)}`) +
    (height === 64 ? "" :
      `;--polycss-atlas-height:${formatCssLength(height)}`);
}

export function countLeaves(bands: readonly {leaves: readonly unknown[]}[]) {
  return bands.reduce((count, band) => count + band.leaves.length, 0);
}

import { createHash } from "node:crypto";
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
} from "@layoutit/polycss";
import sharp from "sharp";
import {
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  packProjectiveSurfaceRaster,
  prepareProjectiveTextureLayer,
} from "../../../platform/projective-surface-raster.mjs";

import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import {
  JUPITER_BODY_LATITUDE_BOUNDS_DEGREES,
  jupiterBodyRasterBands,
} from "./body-raster.mjs";
import {
  preparePolarContinuationAtlas,
  preparePolarSurfaceTransition,
} from "./prepare-polar-continuation.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await validateJupiterSourceGroup("body");
await ensureJupiterPreparationDirectories();

const LONGITUDE_SEGMENTS = 32;
const BODY_LATITUDE_BOUNDS_DEGREES = JUPITER_BODY_LATITUDE_BOUNDS_DEGREES;
const BODY_BAND_COUNT = BODY_LATITUDE_BOUNDS_DEGREES.length - 1;
const LATITUDE_SEGMENTS = BODY_BAND_COUNT;
const EQUATORIAL_RADIUS_KM = 71_492;
const POLAR_RADIUS_KM = 66_854;
const EQUATORIAL_RADIUS = 230;
const POLAR_RADIUS = EQUATORIAL_RADIUS * POLAR_RADIUS_KM / EQUATORIAL_RADIUS_KM;
const CAMERA_ZOOM = 1.1;
const RESPONSIVE_REFERENCE_WIDTH = 1_280;
const RESPONSIVE_REFERENCE_HEIGHT = 720;
const RESPONSIVE_SIDE_PADDING = 16;
const TILE_SIZE = 50;
const SURFACE_OVERLAP = 0.008;
const SURFACE_SEAM_BLEED = 0;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 4;
const SURFACE_WIDTH = 2_048;
const SURFACE_HEIGHT = 1_024;
const SURFACE_RASTER_GUTTER = 16;
const SURFACE_RASTER_OVERSCAN = 0;
const SURFACE_RASTER_BANDS = jupiterBodyRasterBands(SURFACE_HEIGHT);
const SURFACE_RASTER_WIDTH = SURFACE_WIDTH + SURFACE_RASTER_GUTTER * 2;
const SURFACE_RASTER_HEIGHT = SURFACE_RASTER_BANDS.reduce(
  (total, band) => total + band.height + SURFACE_RASTER_GUTTER * 2,
  0,
);
const POLAR_TILE_SIZE = 256;
const POLAR_OVERLAP = 1.035;
const POLAR_INNER_OVERLAP = 1.05;
const POLAR_INNER_INSET = 2.4;
const SYSTEM_PRESENTATION_ROTATION = Object.freeze([0, -3.13, 0]);
const SYSTEM_PRESENTATION_CSS_ROTATION_X_DEGREES = 3.13;
const DEFAULT_TOTAL_PRESENTATION_PITCH_DEGREES = 68.87;
const BODY_INITIAL_ROTATION_Z_DEGREES = -145;
const POLAR_BOUNDARY_LATITUDE_DEGREES = 80;
const POLAR_BOUNDARY_LATITUDE = POLAR_BOUNDARY_LATITUDE_DEGREES * Math.PI / 180;
const POLAR_BOUNDARY_RADIUS = EQUATORIAL_RADIUS * Math.cos(POLAR_BOUNDARY_LATITUDE);
const POLAR_OVERLAY_EDGE_LATITUDE_DEGREES = 64;
const POLAR_OVERLAY_EDGE_LATITUDE =
  POLAR_OVERLAY_EDGE_LATITUDE_DEGREES * Math.PI / 180;
const POLAR_OVERLAY_RADIUS =
  EQUATORIAL_RADIUS * Math.cos(POLAR_OVERLAY_EDGE_LATITUDE);
const POLAR_CORE_RADIUS_RATIO = POLAR_BOUNDARY_RADIUS / POLAR_OVERLAY_RADIUS;
const POLAR_ALPHA_OPAQUE_RADIUS = 0.43;
const POLAR_ALPHA_TRANSPARENT_RADIUS = 0.93;
const POLAR_PLANE_Z = POLAR_RADIUS * Math.sin(POLAR_BOUNDARY_LATITUDE) + 0.1;
const SURFACE_URL = "/scenes/jupiter/jupiter-surface.webp";
const SURFACE_2X_URL = "/scenes/jupiter/jupiter-surface@2x.webp";
const POLES_URL = "/scenes/jupiter/jupiter-poles.webp";
const POLES_2X_URL = "/scenes/jupiter/jupiter-poles@2x.webp";
const SOURCE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "surface/hubble-jupiter-global-map-2019.png",
);
const NORTH_POLAR_STRUCTURE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "surface/juno-pia23808-north-polar-projection.jpg",
);
const NORTH_POLAR_PALETTE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "surface/juno-pia24239-north-pole-detail.tif",
);
const SOUTH_POLAR_STRUCTURE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "surface/juno-pia23556-south-polar-cyclones.jpg",
);
const SOUTH_POLAR_PALETTE_PATH = resolve(
  JUPITER_SOURCE_ROOT,
  "surface/juno-pia21382-south-pole-visible.jpg",
);
const OUTPUT_MODULE = new URL("../runtime/preparedScene.mjs", import.meta.url);
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "source",
  seamBleed: SURFACE_SEAM_BLEED,
});

const surfacePath = resolve(JUPITER_PUBLIC_ROOT, "jupiter-surface.webp");
const surface2xPath = resolve(JUPITER_PUBLIC_ROOT, "jupiter-surface@2x.webp");
const polesPath = resolve(JUPITER_PUBLIC_ROOT, "jupiter-poles.webp");
const poles2xPath = resolve(JUPITER_PUBLIC_ROOT, "jupiter-poles@2x.webp");

const sourceOriginal = await sharp(SOURCE_PATH)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const sourceCoverage = measurePolarCoverage(sourceOriginal);
const source2x = await sharp(sourceOriginal.data, { raw: sourceOriginal.info })
  .resize(SURFACE_WIDTH * 2, SURFACE_HEIGHT * 2, { fit: "fill" })
  .raw()
  .toBuffer({ resolveWithObject: true });
const source1x = await sharp(sourceOriginal.data, { raw: sourceOriginal.info })
  .resize(SURFACE_WIDTH, SURFACE_HEIGHT, { fit: "fill" })
  .raw()
  .toBuffer({ resolveWithObject: true });
const polarDetails = Object.freeze({
  north: Object.freeze({
    structure: await sharp(NORTH_POLAR_STRUCTURE_PATH)
      .removeAlpha()
      .resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE * 2, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    palette: await sharp(NORTH_POLAR_PALETTE_PATH)
      .removeAlpha()
      .resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE * 2, {
        fit: "cover",
        position: "attention",
      })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    contrast: 0.22,
    tint: 0.2,
    structureRadius: 0.9,
  }),
  south: Object.freeze({
    structure: await sharp(SOUTH_POLAR_STRUCTURE_PATH)
      .removeAlpha()
      .extract({ left: 875, top: 0, width: 2_249, height: 2_249 })
      .resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE * 2, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    palette: await sharp(SOUTH_POLAR_PALETTE_PATH)
      .removeAlpha()
      .extract({ left: 352, top: 0, width: 806, height: 806 })
      .resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE * 2, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    contrast: 0.2,
    tint: 0.14,
    structureRadius: 0.9,
  }),
});
const preparedSurface2x = preparePolarSurfaceTransition({
  source: source2x,
  polarDetails,
  transitionStartLatitudeDegrees: 64,
  transitionEndLatitudeDegrees: POLAR_BOUNDARY_LATITUDE_DEGREES,
  edgeStructureWeight: 0.3,
});
const preparedSurface1x = preparePolarSurfaceTransition({
  source: source1x,
  polarDetails,
  transitionStartLatitudeDegrees: 64,
  transitionEndLatitudeDegrees: POLAR_BOUNDARY_LATITUDE_DEGREES,
  edgeStructureWeight: 0.3,
});
await writeProjectiveSurface(preparedSurface2x, surface2xPath);
await writeProjectiveSurface(preparedSurface1x, surfacePath);
const polar2x = preparePolarContinuationAtlas({
  source: source2x,
  tileSize: POLAR_TILE_SIZE * 2,
  firstMeasuredRow: Math.round(
    (90 - POLAR_OVERLAY_EDGE_LATITUDE_DEGREES) / 180 *
      (sourceOriginal.info.height - 1),
  ),
  lastMeasuredRow: Math.round(
    (90 + POLAR_OVERLAY_EDGE_LATITUDE_DEGREES) / 180 *
      (sourceOriginal.info.height - 1),
  ),
  measuredHeight: sourceOriginal.info.height,
  overlap: POLAR_OVERLAP,
  polarDetails,
  detailBlendStartRadius: 0.08,
  detailBlendEndRadius: 0.96,
  alphaOpaqueRadius: POLAR_ALPHA_OPAQUE_RADIUS,
  alphaTransparentRadius: POLAR_ALPHA_TRANSPARENT_RADIUS,
});
await sharp(polar2x.data, {
  raw: {
    width: polar2x.width,
    height: polar2x.height,
    channels: 4,
  },
})
  .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
  .toFile(poles2xPath);
await sharp(polar2x.data, {
  raw: {
    width: polar2x.width,
    height: polar2x.height,
    channels: 4,
  },
})
  .resize(POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE)
  .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
  .toFile(polesPath);

const unexpandedBody = createBodyPolygons(0);
const seamEdges = buildSeamBleedPolygonEdges(unexpandedBody, {
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
});
assertWrappedLongitudeSeams(unexpandedBody, seamEdges);
const bodyLeaves = createBodyPolygons(SURFACE_OVERLAP).map((polygon, index) => ({
  latitudeIndex: polygon.latitudeIndex,
  longitudeIndex: polygon.longitudeIndex,
  tag: "s",
  ...textureStyle(polygon, index, seamEdges.get(index)),
}));
const polarLeaves = ["inner", "outer"].flatMap((layer) =>
  ["south", "north"].map((pole, index) => ({
    latitudeIndex: pole === "north" ? LATITUDE_SEGMENTS - 1 : 0,
    pole,
    tag: "s",
    className: `jupiter-pole jupiter-pole-${layer} jupiter-pole-${pole}`,
    ...textureStyle(createPolarPolygon(pole, layer), index),
  }))
);
const camera = createPolyCamera({
  zoom: CAMERA_ZOOM,
  rotX: DEFAULT_TOTAL_PRESENTATION_PITCH_DEGREES -
    SYSTEM_PRESENTATION_CSS_ROTATION_X_DEGREES,
  rotY: 0,
  target: [0, 0, 0],
});
const scene = Object.freeze({
  schema: "cssjupiter-prepared-retained-body@1",
  camera: Object.freeze({
    state: camera.state,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
  }),
  systemTransform: `transform:${buildPolyMeshTransform({
    rotation: SYSTEM_PRESENTATION_ROTATION,
  })}`,
  bodyTransform: `transform:${buildPolyMeshTransform({
    rotation: [0, 0, -BODY_INITIAL_ROTATION_Z_DEGREES],
  })}`,
  geometry: Object.freeze({
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    equatorialRadius: EQUATORIAL_RADIUS,
    polarRadius: Number(POLAR_RADIUS.toFixed(6)),
    equatorialRadiusKm: EQUATORIAL_RADIUS_KM,
    polarRadiusKm: POLAR_RADIUS_KM,
    axialTiltDegrees: 3.13,
  }),
  presentation: Object.freeze({
    responsiveRenderRoot: Object.freeze({
      model: "shared-container-scaled-reference-viewport",
      referenceWidth: RESPONSIVE_REFERENCE_WIDTH,
      referenceHeight: RESPONSIVE_REFERENCE_HEIGHT,
      sidePadding: RESPONSIVE_SIDE_PADDING,
      runtimeMeasurement: false,
    }),
  }),
  materialProjection: Object.freeze({
    model: "prepared-oblate-body-camera-projection-input",
    polarAxis: "object-z",
    systemRotation: SYSTEM_PRESENTATION_ROTATION,
    cssSystemRotationXDegrees:
      SYSTEM_PRESENTATION_CSS_ROTATION_X_DEGREES,
    bodyInitialRotationZDegrees: BODY_INITIAL_ROTATION_Z_DEGREES,
    meshSilhouette: Object.freeze({
      model: "prepared-expanded-retained-body-vertex-input",
      latitudeBoundsDegrees: BODY_LATITUDE_BOUNDS_DEGREES,
      longitudeSegments: LONGITUDE_SEGMENTS,
      surfaceOverlap: SURFACE_OVERLAP,
      polarBoundaryLatitudeDegrees: POLAR_BOUNDARY_LATITUDE_DEGREES,
      polarBoundaryRadius: Number(POLAR_BOUNDARY_RADIUS.toFixed(6)),
      polarOverlayEdgeLatitudeDegrees: POLAR_OVERLAY_EDGE_LATITUDE_DEGREES,
      polarOverlayRadius: Number(POLAR_OVERLAY_RADIUS.toFixed(6)),
      polarCoreRadiusRatio: Number(POLAR_CORE_RADIUS_RATIO.toFixed(6)),
      polarPlaneZ: Number(POLAR_PLANE_Z.toFixed(6)),
      polarOuterOverlap: POLAR_OVERLAP,
      polarInnerOverlap: POLAR_INNER_OVERLAP,
      polarInnerInset: POLAR_INNER_INSET,
      supersampling: 4,
    }),
    runtimeDerivation: false,
  }),
  surface: Object.freeze({
    source: "NASA/ESA Hubble WFC3 Jupiter global map, 27 June 2019, with prepared Juno north and south polar structure",
    url: SURFACE_URL,
    url2x: SURFACE_2X_URL,
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
    coveragePreparation: Object.freeze({
      model: "measured-hubble-latitude-coverage",
      sourceCoverageLatitudeDegrees: Object.freeze([-80, 80]),
      preparedBodyLatitudeDegrees: Object.freeze([
        -POLAR_BOUNDARY_LATITUDE_DEGREES,
        POLAR_BOUNDARY_LATITUDE_DEGREES,
      ]),
      firstMeasuredRow: sourceCoverage.firstMeasuredRow,
      lastMeasuredRow: sourceCoverage.lastMeasuredRow,
      runtimeCoverageRepair: false,
    }),
    seamRepair: Object.freeze({
      model: "prepared-zero-seam-bleed-with-compositor-overlap",
      seamBleed: SURFACE_SEAM_BLEED,
      presentationOverlap: SURFACE_OVERLAP,
      rasterGutter: SURFACE_RASTER_GUTTER,
      rasterOverscan: SURFACE_RASTER_OVERSCAN,
      runtimeEdgeDiscovery: false,
      wrappedLongitudeSeams: LONGITUDE_SEGMENTS * BODY_BAND_COUNT,
    }),
    polarCaps: Object.freeze({
      model: polar2x.model,
      url: POLES_URL,
      url2x: POLES_2X_URL,
      tileSize: POLAR_TILE_SIZE,
      overlap: POLAR_OVERLAP,
      innerOverlap: POLAR_INNER_OVERLAP,
      innerInset: POLAR_INNER_INSET,
      detailLookbackDegrees: polar2x.detailLookbackDegrees,
      centerDetailWeight: polar2x.centerDetailWeight,
      edgeDetailWeight: polar2x.edgeDetailWeight,
      harmonicOrder: polar2x.harmonicOrder,
      detailedPoles: polar2x.detailedPoles,
      detailBlendStartRadius: polar2x.detailBlendStartRadius,
      detailBlendEndRadius: polar2x.detailBlendEndRadius,
      alphaOpaqueRadius: polar2x.alphaOpaqueRadius,
      alphaTransparentRadius: polar2x.alphaTransparentRadius,
      overlayEdgeLatitudeDegrees: POLAR_OVERLAY_EDGE_LATITUDE_DEGREES,
      coreBoundaryLatitudeDegrees: POLAR_BOUNDARY_LATITUDE_DEGREES,
      northStructureSource: "NASA Juno PIA23808",
      northPaletteSource: "NASA Juno PIA24239",
      northDetailRole:
        "north polar projection structure with visible-light palette chroma",
      southStructureSource: "NASA Juno JIRAM PIA23556",
      southPaletteSource: "NASA JunoCam PIA21382",
      southDetailRole:
        "south polar cyclone structure with visible-light palette chroma",
      chromaBoundarySource: "measured Hubble 64-degree latitude edge",
      structuralColorModel:
        "bounded luminance injection with palette-only chroma transport",
      runtimeProjection: false,
      transparentPixelRatio: Number(polar2x.transparentPixelRatio.toFixed(6)),
    }),
  }),
  leaves: Object.freeze([...bodyLeaves, ...polarLeaves]),
  motion: Object.freeze({
    model: "single-retained-body-compositor-rotation",
    realRotationHours: 9.9,
    visualRotationSeconds: 36,
    runtimeJavaScriptPerFrame: false,
  }),
  retainedDom: Object.freeze({
    transformGroupCount: 4,
    bodyLeafCount: bodyLeaves.length,
    polarLeafCount: polarLeaves.length,
    totalLeafCount: bodyLeaves.length + polarLeaves.length,
    runtimeTopology: false,
  }),
  assets: Object.freeze({
    surface: await assetDescriptor(
      surfacePath,
      SURFACE_RASTER_WIDTH,
      SURFACE_RASTER_HEIGHT,
    ),
    surface2x: await assetDescriptor(
      surface2xPath,
      SURFACE_RASTER_WIDTH * 2,
      SURFACE_RASTER_HEIGHT * 2,
    ),
    poles: await assetDescriptor(polesPath, POLAR_TILE_SIZE * 2, POLAR_TILE_SIZE),
    poles2x: await assetDescriptor(
      poles2xPath,
      POLAR_TILE_SIZE * 4,
      POLAR_TILE_SIZE * 2,
    ),
  }),
});

await writeFile(
  OUTPUT_MODULE,
  "// Generated by tools/prepare-body.mjs. Do not edit by hand.\n" +
    `export const PREPARED_JUPITER_SCENE = ${JSON.stringify(scene)};\n`,
);

console.log(
  `Prepared Jupiter body: ${scene.retainedDom.totalLeafCount} leaves, ` +
    `${scene.assets.surface.bytes + scene.assets.surface2x.bytes +
      scene.assets.poles.bytes + scene.assets.poles2x.bytes} bytes.`,
);

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    EQUATORIAL_RADIUS * latitudeRadius * Math.cos(longitude),
    EQUATORIAL_RADIUS * latitudeRadius * Math.sin(longitude),
    POLAR_RADIUS * Math.sin(latitude),
  ];
}

function createBodyPolygons(overlap) {
  const polygons = [];
  for (let bandIndex = 0; bandIndex < BODY_BAND_COUNT; bandIndex += 1) {
    const latitudeIndex = bandIndex + 1;
    const latitude0 = BODY_LATITUDE_BOUNDS_DEGREES[bandIndex] * Math.PI / 180;
    const latitude1 = BODY_LATITUDE_BOUNDS_DEGREES[bandIndex + 1] * Math.PI / 180;
    const sourceV0 = (latitude0 + Math.PI / 2) / Math.PI;
    const sourceV1 = (latitude1 + Math.PI / 2) / Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < LONGITUDE_SEGMENTS;
      longitudeIndex += 1) {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const sourceU0 = longitudeIndex / LONGITUDE_SEGMENTS;
      const sourceU1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS;
      const polarPresentationOverlap = overlap > 0 &&
          Math.max(Math.abs(latitude0), Math.abs(latitude1)) >=
            64 * Math.PI / 180
        ? Math.max(overlap, 0.02)
        : overlap;
      const latitudeBleed = (latitude1 - latitude0) *
        polarPresentationOverlap;
      const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS *
        polarPresentationOverlap;
      const renderLatitude0 = latitude0 - latitudeBleed;
      const renderLatitude1 = latitude1 + latitudeBleed;
      const renderLongitude0 = longitude0 - longitudeBleed;
      const renderLongitude1 = polarPresentationOverlap === 0 &&
          longitudeIndex === LONGITUDE_SEGMENTS - 1
        ? 0
        : longitude1 + longitudeBleed;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(renderLatitude0, renderLongitude0),
          spherePoint(renderLatitude0, renderLongitude1),
          spherePoint(renderLatitude1, renderLongitude1),
          spherePoint(renderLatitude1, renderLongitude0),
        ],
        uvs: [
          [sourceU0, sourceV0],
          [sourceU1, sourceV0],
          [sourceU1, sourceV1],
          [sourceU0, sourceV1],
        ],
        texture: SURFACE_URL,
        textureImageSource: {
          url: SURFACE_URL,
          width: SURFACE_WIDTH,
          height: SURFACE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * SURFACE_WIDTH / LONGITUDE_SEGMENTS,
            y: (1 - sourceV1) * SURFACE_HEIGHT,
            width: SURFACE_WIDTH / LONGITUDE_SEGMENTS,
            height: (sourceV1 - sourceV0) * SURFACE_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: "#b45e3a",
      });
    }
  }
  return polygons;
}

function createPolarPolygon(pole, layer) {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const inner = layer === "inner";
  const radius = POLAR_OVERLAY_RADIUS * (
    inner ? POLAR_INNER_OVERLAP : POLAR_OVERLAP
  );
  const z = sign * (POLAR_PLANE_Z - (inner ? POLAR_INNER_INSET : 0));
  return {
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: POLES_URL,
    textureImageSource: {
      url: POLES_URL,
      width: POLAR_TILE_SIZE * 2,
      height: POLAR_TILE_SIZE,
      sourceRect: {
        x: (north ? 1 : 0) * POLAR_TILE_SIZE,
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
    color: "#b45e3a",
  };
}

function textureStyle(polygon, index, sharedEdges) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) throw new Error(`Jupiter texture leaf ${index} did not prepare.`);
  const fittedGeometry = polygon.texture === SURFACE_URL
    ? fitProjectiveTextureGeometryToStableLayout(geometry)
    : geometry;
  const rasterPresentation = polygon.texture === SURFACE_URL
    ? createProjectiveSurfaceRasterPresentation({
      sourceWidth: SURFACE_WIDTH,
      sourceHeight: SURFACE_HEIGHT,
      sourceRect: polygon.textureImageSource.sourceRect,
      addressSourceWidth: polygon.textureImageSource.width,
      addressSourceHeight: polygon.textureImageSource.height,
      addressSourceRect: polygon.textureImageSource.sourceRect,
      backgroundPosition: fittedGeometry.backgroundPosition,
      backgroundSize: fittedGeometry.backgroundSize,
      leafWidth: fittedGeometry.leafWidth,
      leafHeight: fittedGeometry.leafHeight,
      bands: SURFACE_RASTER_BANDS,
      gutter: SURFACE_RASTER_GUTTER,
      overscan: SURFACE_RASTER_OVERSCAN,
    })
    : geometry;
  const position = rasterPresentation.backgroundPosition
    .map(cssLength).join(" ");
  const size = rasterPresentation.backgroundSize.map(cssLength).join(" ");
  return {
    style: `transform:matrix3d(${fittedGeometry.matrix});` +
      `width:${cssLength(fittedGeometry.leafWidth)};` +
      `height:${cssLength(fittedGeometry.leafHeight)};` +
      `background-position:${position};background-size:${size}`,
    ...(polygon.texture === SURFACE_URL ? {
      projectiveTextureLayer: prepareProjectiveTextureLayer(
        fittedGeometry.matrix,
        PROJECTIVE_TEXTURE_RASTER_SCALE,
      ),
    } : {}),
  };
}

function cssLength(value) {
  return Object.is(value, -0) || value === 0 ? "0px" : formatCssLength(value);
}

function assertWrappedLongitudeSeams(polygons, edges) {
  let wrapped = 0;
  for (let index = 0; index < polygons.length; index += 1) {
    const polygon = polygons[index];
    if (polygon.longitudeIndex === 0) {
      if (!edges.get(index)?.has(3)) {
        throw new Error(`Jupiter latitude ${polygon.latitudeIndex} west seam is open.`);
      }
      wrapped += 1;
    }
    if (polygon.longitudeIndex === LONGITUDE_SEGMENTS - 1 &&
        !edges.get(index)?.has(1)) {
      throw new Error(`Jupiter latitude ${polygon.latitudeIndex} east seam is open.`);
    }
  }
  if (wrapped !== BODY_BAND_COUNT) {
    throw new Error("Jupiter wrapped longitude seam count drifted.");
  }
}

async function writeProjectiveSurface(source, outputPath) {
  const { data, info } = source;
  const packed = packProjectiveSurfaceRaster(data, {
    width: info.width,
    height: info.height,
    channels: info.channels,
    bands: jupiterBodyRasterBands(info.height),
    gutter: SURFACE_RASTER_GUTTER * info.height / SURFACE_HEIGHT,
  });
  await sharp(packed.data, { raw: {
    width: packed.packedWidth,
    height: packed.packedHeight,
    channels: info.channels,
  } })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(outputPath);
}

function measurePolarCoverage(source) {
  const { width, height, channels } = source.info;
  const rowMean = (row) => {
    let total = 0;
    let count = 0;
    for (let column = 0; column < width; column += 16) {
      const offset = (row * width + column) * channels;
      total += source.data[offset] + source.data[offset + 1] +
        source.data[offset + 2];
      count += 3;
    }
    return total / count;
  };
  let firstMeasuredRow = 0;
  while (firstMeasuredRow < height && rowMean(firstMeasuredRow) <= 3) {
    firstMeasuredRow += 1;
  }
  let lastMeasuredRow = height - 1;
  while (lastMeasuredRow >= 0 && rowMean(lastMeasuredRow) <= 3) {
    lastMeasuredRow -= 1;
  }
  if (firstMeasuredRow !== 101 || lastMeasuredRow !== 1_698) {
    throw new Error(
      `Hubble Jupiter polar coverage drifted: ${firstMeasuredRow}-${lastMeasuredRow}.`,
    );
  }
  return Object.freeze({
    firstMeasuredRow,
    lastMeasuredRow,
  });
}

async function assetDescriptor(path, width, height) {
  const bytes = await readFile(path);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`Prepared Jupiter asset dimensions drifted for ${path}.`);
  }
  return Object.freeze({
    width,
    height,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

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

import { PREPARED_MARS_STARFIELD } from "../runtime/preparedStarfield.mjs";

import {
  MARS_AXIAL_TILT_DEGREES,
  MARS_BODY_LATITUDE_BOUNDS_DEGREES,
  MARS_BODY_LATITUDE_SEGMENTS,
  MARS_BODY_LONGITUDE_SEGMENTS,
  MARS_BODY_ROTATION_DEGREES,
  MARS_EQUATORIAL_RADIUS,
  MARS_EQUATORIAL_RADIUS_KM,
  MARS_POLAR_RADIUS,
  MARS_POLAR_BOUNDARY_LATITUDE_DEGREES,
  MARS_POLAR_RADIUS_KM,
  marsBodyRasterBands,
  marsBodyPoint,
} from "./body-geometry.mjs";
import {
  MARS_POLAR_OVERLAP,
  prepareMarsPolarAtlas,
} from "./polar-projection.mjs";
import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
  MARS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

await validateMarsSourceGroup("body");
await ensureMarsPreparationDirectories();

const LATITUDE_SEGMENTS = MARS_BODY_LATITUDE_SEGMENTS;
const LONGITUDE_SEGMENTS = MARS_BODY_LONGITUDE_SEGMENTS;
const PROJECTIVE_TEXTURE_RASTER_SCALE = 4;
const BODY_LATITUDE_BOUNDS_DEGREES = MARS_BODY_LATITUDE_BOUNDS_DEGREES;
const BODY_BAND_COUNT = BODY_LATITUDE_BOUNDS_DEGREES.length - 1;
const EQUATORIAL_RADIUS_KM = MARS_EQUATORIAL_RADIUS_KM;
const POLAR_RADIUS_KM = MARS_POLAR_RADIUS_KM;
const EQUATORIAL_RADIUS = MARS_EQUATORIAL_RADIUS;
const POLAR_RADIUS = MARS_POLAR_RADIUS;
const TILE_SIZE = 50;
const SURFACE_OVERLAP = 0.005;
const SURFACE_SEAM_BLEED = 0;
const SURFACE_WIDTH = 2_048;
const SURFACE_HEIGHT = 1_024;
const SURFACE_RASTER_GUTTER = SURFACE_HEIGHT / 16 / 4;
const SURFACE_RASTER_OVERSCAN = 0;
const SURFACE_RASTER_BANDS = marsBodyRasterBands(SURFACE_HEIGHT);
const SURFACE_RASTER_WIDTH = SURFACE_WIDTH + SURFACE_RASTER_GUTTER * 2;
const SURFACE_RASTER_HEIGHT = SURFACE_RASTER_BANDS.reduce(
  (total, band) => total + band.height + SURFACE_RASTER_GUTTER * 2,
  0,
);
const POLAR_TILE_SIZE = 256;
const POLAR_OVERLAP = MARS_POLAR_OVERLAP;
const POLAR_INNER_OVERLAP = 1.05;
const POLAR_INNER_INSET = 0.15;
const POLAR_BOUNDARY_LATITUDE =
  MARS_POLAR_BOUNDARY_LATITUDE_DEGREES * Math.PI / 180;
const POLAR_BOUNDARY_RADIUS =
  EQUATORIAL_RADIUS * Math.cos(POLAR_BOUNDARY_LATITUDE);
const POLAR_PLANE_Z =
  POLAR_RADIUS * Math.sin(POLAR_BOUNDARY_LATITUDE) + 0.01;
const SURFACE_URL = "/scenes/mars/mars-surface.webp";
const SURFACE_2X_URL = "/scenes/mars/mars-surface@2x.webp";
const POLES_URL = "/scenes/mars/mars-poles.webp";
const POLES_2X_URL = "/scenes/mars/mars-poles@2x.webp";
const SOURCE_PATH = resolve(
  MARS_SOURCE_ROOT,
  "surface/mars-viking-mdim21-color-1km.jpg",
);
const OUTPUT_MODULE = new URL("../runtime/preparedScene.mjs", import.meta.url);
const PLAN_OPTIONS = Object.freeze({
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
  textureLighting: "source",
  seamBleed: SURFACE_SEAM_BLEED,
});

const surfacePath = resolve(MARS_PUBLIC_ROOT, "mars-surface.webp");
const surface2xPath = resolve(MARS_PUBLIC_ROOT, "mars-surface@2x.webp");
const polesPath = resolve(MARS_PUBLIC_ROOT, "mars-poles.webp");
const poles2xPath = resolve(MARS_PUBLIC_ROOT, "mars-poles@2x.webp");

const source2x = await sharp(SOURCE_PATH)
  .resize(SURFACE_WIDTH * 2, SURFACE_HEIGHT * 2, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const source1x = await sharp(SOURCE_PATH)
  .resize(SURFACE_WIDTH, SURFACE_HEIGHT, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
await writeProjectiveSurface(source2x, surface2xPath, 80);
await writeProjectiveSurface(source1x, surfacePath, 80);
const polar2x = prepareMarsPolarAtlas(source2x, POLAR_TILE_SIZE * 2, {
  boundaryLatitudeDegrees: MARS_POLAR_BOUNDARY_LATITUDE_DEGREES,
  overlap: POLAR_OVERLAP,
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
    className: `mars-pole mars-pole-${layer} mars-pole-${pole}`,
    ...textureStyle(createPolarPolygon(pole, layer), index),
  }))
);
const camera = createPolyCamera({
  zoom: 0.8,
  rotX: 18,
  rotY: 0,
  target: [0, 0, 0],
});
const scene = Object.freeze({
  schema: "cssmars-prepared-retained-body@1",
  camera: Object.freeze({
    state: camera.state,
    style: "perspective:1000000px",
    sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}`,
  }),
  systemTransform: `transform:${buildPolyMeshTransform({
    rotation: [MARS_AXIAL_TILT_DEGREES, 0, 0],
  })}`,
  bodyTransform: `transform:${buildPolyMeshTransform({
    rotation: [0, 0, MARS_BODY_ROTATION_DEGREES],
  })}`,
  geometry: Object.freeze({
    latitudeSegments: LATITUDE_SEGMENTS,
    longitudeSegments: LONGITUDE_SEGMENTS,
    equatorialRadius: EQUATORIAL_RADIUS,
    polarRadius: Number(POLAR_RADIUS.toFixed(6)),
    equatorialRadiusKm: EQUATORIAL_RADIUS_KM,
    polarRadiusKm: POLAR_RADIUS_KM,
    axialTiltDegrees: MARS_AXIAL_TILT_DEGREES,
  }),
  surface: Object.freeze({
    source: "USGS Astrogeology and NASA Viking MDIM 2.1 color mosaic",
    url: SURFACE_URL,
    url2x: SURFACE_2X_URL,
    encoding: "webp-q80",
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
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
      model: "prepared-small-planar-polar-caps-with-source-boundary-inpaint",
      url: POLES_URL,
      url2x: POLES_2X_URL,
      tileSize: POLAR_TILE_SIZE,
      overlap: POLAR_OVERLAP,
      innerOverlap: POLAR_INNER_OVERLAP,
      innerInset: POLAR_INNER_INSET,
      boundaryLatitudeDegrees: MARS_POLAR_BOUNDARY_LATITUDE_DEGREES,
      singularityStabilization: polar2x.stabilization,
      runtimeProjection: false,
      transparentPixelRatio: Number(polar2x.transparentPixelRatio.toFixed(6)),
    }),
  }),
  leaves: Object.freeze([...bodyLeaves, ...polarLeaves]),
  motion: Object.freeze({
    model: "single-retained-body-compositor-rotation",
    realRotationHours: 24.6,
    visualRotationSeconds: 48,
    runtimeJavaScriptPerFrame: false,
  }),
  starfield: Object.freeze({
    ...PREPARED_MARS_STARFIELD,
    cameraContract: "google-earth-pro-inverse-unbounded-matrix3d",
  }),
  retainedDom: Object.freeze({
    transformGroupCount: 4,
    bodyLeafCount: bodyLeaves.length,
    polarLeafCount: polarLeaves.length,
    totalLeafCount: bodyLeaves.length + polarLeaves.length,
    starfieldFaceCount: PREPARED_MARS_STARFIELD.faces.length,
    sunBillboardCount: 1,
    sunCubemapBakeCount: 0,
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
    `export const PREPARED_MARS_SCENE = ${JSON.stringify(scene)};\n`,
);

console.log(
  `Prepared Mars body: ${scene.retainedDom.totalLeafCount} leaves, ` +
    `${scene.assets.surface.bytes + scene.assets.surface2x.bytes +
      scene.assets.poles.bytes + scene.assets.poles2x.bytes} bytes.`,
);

function spherePoint(latitude, longitude) {
  return marsBodyPoint(latitude, longitude);
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
      const latitudeBleed = (latitude1 - latitude0) * overlap;
      const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS * overlap;
      const renderLatitude0 = latitude0 - latitudeBleed;
      const renderLatitude1 = latitude1 + latitudeBleed;
      const renderLongitude0 = longitude0 - longitudeBleed;
      const renderLongitude1 = overlap === 0 &&
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
  const radius = POLAR_BOUNDARY_RADIUS * (
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
  if (!geometry) throw new Error(`Mars texture leaf ${index} did not prepare.`);
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
        throw new Error(`Mars latitude ${polygon.latitudeIndex} west seam is open.`);
      }
      wrapped += 1;
    }
    if (polygon.longitudeIndex === LONGITUDE_SEGMENTS - 1 &&
        !edges.get(index)?.has(1)) {
      throw new Error(`Mars latitude ${polygon.latitudeIndex} east seam is open.`);
    }
  }
  if (wrapped !== BODY_BAND_COUNT) {
    throw new Error("Mars wrapped longitude seam count drifted.");
  }
}

async function writeProjectiveSurface(source, outputPath, quality) {
  const { width, height, channels } = source.info;
  const packed = packProjectiveSurfaceRaster(source.data, {
    width,
    height,
    channels,
    bands: marsBodyRasterBands(height),
    gutter: height / 16 / 4,
  });
  await sharp(packed.data, { raw: {
    width: packed.packedWidth,
    height: packed.packedHeight,
    channels,
  } })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(outputPath);
}

async function assetDescriptor(path, width, height) {
  const bytes = await readFile(path);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`Prepared Mars asset dimensions drifted for ${path}.`);
  }
  return Object.freeze({
    width,
    height,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

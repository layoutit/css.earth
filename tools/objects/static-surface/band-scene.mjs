import { buildPolyCameraSceneTransform, buildSeamBleedPolygonEdges, computeTextureAtlasPlanPublic, createPolyCamera, formatCssLength, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import { prepareProjectiveTextureLayer } from '../../../src/platform/projective-surface-raster.mjs';
import { prepareSurfaceRasterCell } from './inverse-homography.mjs';

export function prepareBandSurfaceScene(profile) {
  const { namespace, parameters, metadata, surface, poles, rasterAtlas } = profile;
  const { latitudeSegments: LATITUDE_SEGMENTS, longitudeSegments: LONGITUDE_SEGMENTS, displayRadius: DISPLAY_RADIUS, tileSize: TILE_SIZE, surfaceOverlap: SURFACE_OVERLAP, polarSurfaceOverlap: POLAR_SURFACE_OVERLAP, polarInnerOverlap: POLAR_INNER_OVERLAP, polarInnerInset: POLAR_INNER_INSET, cameraZoom: CAMERA_ZOOM, cameraPitch: CAMERA_PITCH, rotationSeconds: ROTATION_SECONDS, projectiveRasterScale: PROJECTIVE_TEXTURE_RASTER_SCALE } = parameters;
  const PLAN_OPTIONS = { tileSize: TILE_SIZE, layerElevation: TILE_SIZE, textureLighting: 'baked', seamBleed: 0.15 };
  const config = { latitudeSegments: LATITUDE_SEGMENTS, longitudeSegments: LONGITUDE_SEGMENTS, equatorialRadius: DISPLAY_RADIUS, polarRadius: DISPLAY_RADIUS, texture: surface, poles };
  const camera = createPolyCamera({ target: [0, 0, 0], rotX: CAMERA_PITCH, rotY: 0, zoom: CAMERA_ZOOM, distance: 0 });
  const surfaceRasterCells = [];
  const bands = prepareSphereBands(config);
  const scene = { ...metadata, camera: { ...metadata.camera, sceneStyle: 'transform:' + buildPolyCameraSceneTransform(camera.state) }, body: { ...metadata.body, bands }, counts: { ...metadata.counts, retainedLeafCount: bands.reduce((sum, band) => sum + band.leaves.length, 0) } };
  return { scene, surfaceRasterCells };

function prepareSphereBands(body) {
  const leaves = [
    ...prepareSphereLeaves(body),
    ...preparePolarInnerLeaves(body),
  ];
  return Object.freeze(Array.from(
    { length: body.latitudeSegments },
    (_, latitudeIndex) => Object.freeze({
      latitudeIndex,
      visualRotationSeconds: ROTATION_SECONDS,
      leaves: Object.freeze(leaves
        .filter((entry) => entry.latitudeIndex === latitudeIndex)
        .map((entry) => entry.leaf)),
    }),
  ));
}

function prepareSphereLeaves(body) {
  const polygons = createSpherePolygons(body, SURFACE_OVERLAP);
  const topology = createSpherePolygons(body, 0);
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
        ? `${namespace}-polar-surface ${namespace}-polar-surface-${polygon.polarCap}`
        : `${namespace}-surface-leaf`,
      ...textureStyle(polygon, index, seamEdges.get(index)),
    }),
  })));
}

function preparePolarInnerLeaves(body) {
  return Object.freeze(["south", "north"].map((pole, index) => {
    const polygon = createPolarCapPolygon(body, pole, "inner");
    return Object.freeze({
      latitudeIndex: polygon.latitudeIndex,
      leaf: Object.freeze({
        tag: "s",
        className: `${namespace}-polar-inner ${namespace}-polar-inner-${pole}`,
        ...textureStyle(polygon, index, null),
      }),
    });
  }));
}

function createSpherePolygons(body, overlap) {
  const polygons = [];
  for (let latitudeIndex = 0;
    latitudeIndex < body.latitudeSegments;
    latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === body.latitudeSegments - 1) {
      polygons.push(createPolarCapPolygon(
        body,
        latitudeIndex === 0 ? "south" : "north",
      ));
      continue;
    }
    const v0 = latitudeIndex / body.latitudeSegments;
    const v1 = (latitudeIndex + 1) / body.latitudeSegments;
    const latitude0 = -Math.PI / 2 + v0 * Math.PI;
    const latitude1 = -Math.PI / 2 + v1 * Math.PI;
    for (let longitudeIndex = 0;
      longitudeIndex < body.longitudeSegments;
      longitudeIndex += 1) {
      const u0 = longitudeIndex / body.longitudeSegments;
      const u1 = (longitudeIndex + 1) / body.longitudeSegments;
      const latitudeOverlap = Math.PI / body.latitudeSegments * overlap;
      const longitudeOverlap = Math.PI * 2 / body.longitudeSegments * overlap;
      const longitude0 = u0 * Math.PI * 2;
      const longitude1 = overlap === 0 &&
          longitudeIndex === body.longitudeSegments - 1
        ? 0
        : u1 * Math.PI * 2;
      const sourceWidth = body.texture.width / body.longitudeSegments;
      const sourceHeight = body.texture.height / body.latitudeSegments;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(body, latitude0 - latitudeOverlap, longitude0 - longitudeOverlap),
          spherePoint(body, latitude0 - latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(body, latitude1 + latitudeOverlap, longitude1 + longitudeOverlap),
          spherePoint(body, latitude1 + latitudeOverlap, longitude0 - longitudeOverlap),
        ],
        uvs: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        texture: body.texture.one,
        textureImageSource: {
          url: body.texture.one,
          width: body.texture.width,
          height: body.texture.height,
          sourceRect: {
            x: longitudeIndex * sourceWidth,
            y: (body.latitudeSegments - 1 - latitudeIndex) * sourceHeight,
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
        presentationCellSize: body.texture.presentationCellSize,
      });
    }
  }
  return polygons;
}

function createPolarCapPolygon(body, pole, role = "surface") {
  const north = pole === "north";
  const sign = north ? 1 : -1;
  const boundary = Math.PI / 2 - Math.PI / body.latitudeSegments;
  const inner = role === "inner";
  const radius = body.equatorialRadius * Math.cos(boundary) *
    (inner ? POLAR_INNER_OVERLAP : POLAR_SURFACE_OVERLAP);
  const z = sign * (body.polarRadius * Math.sin(boundary) + 0.1 -
    (inner ? POLAR_INNER_INSET : 0));
  const tileSize = body.poles.height;
  return {
    latitudeIndex: north ? body.latitudeSegments - 1 : 0,
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z],
        [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z],
        [radius, -radius, z], [-radius, -radius, z]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: body.poles.one,
    textureImageSource: {
      url: body.poles.one,
      width: body.poles.width,
      height: body.poles.height,
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

function spherePoint(body, latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    body.equatorialRadius * latitudeRadius * Math.cos(longitude),
    body.equatorialRadius * latitudeRadius * Math.sin(longitude),
    body.polarRadius * Math.sin(latitude),
  ];
}

function textureStyle(polygon, index, seamEdges) {
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    ...PLAN_OPTIONS,
    seamBleed: 0,
    ...(seamEdges ? { seamEdges } : {}),
  });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!geometry) throw new Error(`Prepared surface texture leaf ${index} did not prepare.`);
  const fitted = fitTextureGeometry(
    geometry,
    polygon.presentationCellSize ?? geometry.leafWidth,
    polygon.presentationCellSize ?? geometry.leafHeight,
  );
  const raster = !polygon.polarCap && rasterAtlas ? prepareSurfaceRasterCell(fitted, surfaceRasterCells.length, rasterAtlas) : null;
  if (raster) surfaceRasterCells.push(raster);
  const presentation = raster ? {
    ...fitted,
    leafWidth: raster.width,
    leafHeight: raster.height,
    backgroundPosition: [-raster.x, -raster.y],
    backgroundSize: [rasterAtlas.width, rasterAtlas.height],
  } : fitted;
  return {
    style: `transform:matrix3d(${fitted.matrix})` +
      preparedAtlasDimensions(presentation.leafWidth, presentation.leafHeight) +
      `;background-position:${presentation.backgroundPosition
        .map((value) => value === 0 ? "0px" : formatCssLength(value)).join(" ")}` +
      `;background-size:${presentation.backgroundSize.map(formatCssLength).join(" ")}`,
    ...(!polygon.polarCap ? { projectiveTextureLayer: raster?.layer ?? prepareProjectiveTextureLayer(fitted.matrix, PROJECTIVE_TEXTURE_RASTER_SCALE) } : {}),
    sourceRect: fitted.sourceRect,
    leafWidth: presentation.leafWidth,
    leafHeight: presentation.leafHeight,
    projection: fitted.projection,
    lighting: "source",
    lightingOverlay: false,
  };
}

function fitTextureGeometry(geometry, leafWidth, leafHeight) {
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Prepared Prepared surface texture matrix is invalid.");
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

}

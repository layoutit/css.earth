import { buildPolyCameraSceneTransform, createPolyCamera, buildSeamBleedPolygonEdges, computeTextureAtlasPlanPublic, formatCssLength, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import { fitProjectiveTextureGeometryToStableLayout, prepareProjectiveTextureLayer } from '../../../src/platform/projective-surface-raster.mjs';

export function prepareSegmentedSurfaceScene(profile, sky) {
  const { namespace, parameters, metadata, surface, poles } = profile;
  const { latitudeSegments: LATITUDE_SEGMENTS, longitudeSegments: LONGITUDE_SEGMENTS, displayRadius: RADIUS, tileSize: TILE_SIZE, surfaceOverlap: overlap, projectiveRasterScale: PROJECTIVE_TEXTURE_RASTER_SCALE, polarCellSize: POLAR_CELL } = parameters;
  const SOURCE_WIDTH = surface.width, SOURCE_HEIGHT = surface.height, CELL_WIDTH = SOURCE_WIDTH / LONGITUDE_SEGMENTS, CELL_HEIGHT = SOURCE_HEIGHT / LATITUDE_SEGMENTS;
  const POLAR_ATLAS_WIDTH = POLAR_CELL * LONGITUDE_SEGMENTS, POLAR_ATLAS_HEIGHT = POLAR_CELL * 3;
  const POLAR_BOUNDARY_LATITUDE = Math.PI / 2 - Math.PI / LATITUDE_SEGMENTS, POLAR_INNER_LATITUDE = parameters.polarInnerLatitudeDegrees * Math.PI / 180;
  const SURFACE_URL = surface.one, POLAR_URL = poles.one;
const topology = createSpherePolygons(0);
const seamEdges = buildSeamBleedPolygonEdges(topology, {
  tileSize: TILE_SIZE,
  layerElevation: TILE_SIZE,
});
const leaves = createSpherePolygons(overlap).map((polygon, index) => {
  const sharedEdges = polygon.polarCap ? null : seamEdges.get(index);
  const plan = computeTextureAtlasPlanPublic(polygon, index, {
    tileSize: TILE_SIZE,
    layerElevation: TILE_SIZE,
    textureLighting: "baked",
    seamBleed: polygon.polarCap ? 0 : 24,
    directionalLight: Object.freeze({
      direction: Object.freeze([0, 0, 1]),
      color: "#ffffff",
      intensity: 0,
    }),
    ambientLight: Object.freeze({ color: "#ffffff", intensity: Math.PI }),
    ...(sharedEdges ? { seamEdges: sharedEdges } : {}),
  });
  const sourceGeometry = plan && resolvePolyTextureLeafGeometry(plan, {
    backend: "image",
    lighting: "source",
    projection: "projective",
  });
  if (!plan || !sourceGeometry) {
    throw new Error(`Sun texture leaf ${index} did not prepare.`);
  }
  const geometry = fitProjectiveTextureGeometryToStableLayout(sourceGeometry);
  const position = geometry.backgroundPosition.map((value) =>
    value === 0 ? "0px" : formatCssLength(value)).join(" ");
  const size = geometry.backgroundSize.map(formatCssLength).join(" ");
  return Object.freeze({
    tag: "s",
    className: polygon.polarCap
      ? `${namespace}-polar ${namespace}-polar-${polygon.polarCap} ` +
        `${namespace}-polar-${polygon.polarPart}`
      : "",
    style: `transform:matrix3d(${geometry.matrix});` +
      `--polycss-atlas-width:${formatCssLength(geometry.leafWidth)};` +
      `--polycss-atlas-height:${formatCssLength(geometry.leafHeight)};` +
      `background-image:url(${geometry.url});` +
      `background-position:${position};background-size:${size}`,
    projectiveTextureLayer: prepareProjectiveTextureLayer(
      geometry.matrix,
      PROJECTIVE_TEXTURE_RASTER_SCALE,
    ),
    polarCap: polygon.polarCap ?? null,
    polarPart: polygon.polarPart ?? null,
    longitudeIndex: polygon.longitudeIndex ?? null,
    latitudeIndex: polygon.latitudeIndex,
    leafWidth: geometry.leafWidth,
    leafHeight: geometry.leafHeight,
    projection: geometry.projection,
  });
});


  const camera = createPolyCamera({ target: [0, 0, 0], rotX: parameters.cameraPitch, rotY: parameters.cameraYaw, zoom: parameters.cameraZoom, distance: 0 });
  return { ...metadata, camera: { ...metadata.camera, state: { ...camera.state }, sceneStyle: `transform:${buildPolyCameraSceneTransform(camera.state)}` }, body: { ...metadata.body, leaves }, starfield: sky, counts: { polygonCount: leaves.length, textureLeafCount: leaves.length, polarLeafCount: leaves.filter(leaf => leaf.polarCap).length } };
function createSpherePolygons(surfaceOverlap) {
  const polygons = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDE_SEGMENTS; latitudeIndex += 1) {
    if (latitudeIndex === 0 || latitudeIndex === LATITUDE_SEGMENTS - 1) {
      polygons.push(...createPolarLeaves(
        latitudeIndex === 0 ? "south" : "north",
        surfaceOverlap,
      ));
      continue;
    }
    const latitude0 = -Math.PI / 2 + latitudeIndex / LATITUDE_SEGMENTS * Math.PI;
    const latitude1 = -Math.PI / 2 + (latitudeIndex + 1) / LATITUDE_SEGMENTS * Math.PI;
    for (let longitudeIndex = 0; longitudeIndex < LONGITUDE_SEGMENTS; longitudeIndex += 1) {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 = (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      const latitudeBleed = Math.PI / LATITUDE_SEGMENTS * surfaceOverlap;
      const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
      polygons.push({
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(latitude0 - latitudeBleed, longitude0 - longitudeBleed),
          spherePoint(latitude0 - latitudeBleed, longitude1 + longitudeBleed),
          spherePoint(latitude1 + latitudeBleed, longitude1 + longitudeBleed),
          spherePoint(latitude1 + latitudeBleed, longitude0 - longitudeBleed),
        ],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: SURFACE_URL,
        textureImageSource: {
          url: SURFACE_URL,
          width: SOURCE_WIDTH,
          height: SOURCE_HEIGHT,
          sourceRect: {
            x: longitudeIndex * CELL_WIDTH,
            y: (LATITUDE_SEGMENTS - 1 - latitudeIndex) * CELL_HEIGHT,
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: parameters.color,
      });
    }
  }
  return polygons;
}

function spherePoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    RADIUS * latitudeRadius * Math.cos(longitude),
    RADIUS * latitudeRadius * Math.sin(longitude),
    RADIUS * Math.sin(latitude),
  ];
}

function createPolarLeaves(pole, surfaceOverlap) {
  const north = pole === "north";
  const latitudeIndex = north ? LATITUDE_SEGMENTS - 1 : 0;
  const latitude0 = north
    ? POLAR_BOUNDARY_LATITUDE
    : -POLAR_INNER_LATITUDE;
  const latitude1 = north
    ? POLAR_INNER_LATITUDE
    : -POLAR_BOUNDARY_LATITUDE;
  const longitudeBleed = Math.PI * 2 / LONGITUDE_SEGMENTS * surfaceOverlap;
  const leaves = Array.from(
    { length: LONGITUDE_SEGMENTS },
    (_, longitudeIndex) => {
      const longitude0 = longitudeIndex / LONGITUDE_SEGMENTS * Math.PI * 2;
      const longitude1 =
        (longitudeIndex + 1) / LONGITUDE_SEGMENTS * Math.PI * 2;
      return {
        latitudeIndex,
        longitudeIndex,
        vertices: [
          spherePoint(latitude0, longitude0 - longitudeBleed),
          spherePoint(latitude0, longitude1 + longitudeBleed),
          spherePoint(latitude1, longitude1 + longitudeBleed),
          spherePoint(latitude1, longitude0 - longitudeBleed),
        ],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        texture: POLAR_URL,
        textureImageSource: {
          url: POLAR_URL,
          width: POLAR_ATLAS_WIDTH,
          height: POLAR_ATLAS_HEIGHT,
          sourceRect: {
            x: longitudeIndex * POLAR_CELL,
            y: north ? 0 : POLAR_CELL,
            width: POLAR_CELL,
            height: POLAR_CELL,
          },
        },
        texturePresentation: {
          backend: "image",
          lighting: "source",
          projection: "projective",
        },
        color: parameters.color,
        polarCap: pole,
        polarPart: "band",
      };
    },
  );
  const sign = north ? 1 : -1;
  const centerRadius = RADIUS * Math.cos(POLAR_INNER_LATITUDE) * parameters.polarCenterOverlap;
  const centerZ = sign * RADIUS * Math.sin(POLAR_INNER_LATITUDE);
  leaves.push({
    latitudeIndex,
    longitudeIndex: null,
    vertices: north
      ? [[-centerRadius, -centerRadius, centerZ],
        [centerRadius, -centerRadius, centerZ],
        [centerRadius, centerRadius, centerZ],
        [-centerRadius, centerRadius, centerZ]]
      : [[-centerRadius, centerRadius, centerZ],
        [centerRadius, centerRadius, centerZ],
        [centerRadius, -centerRadius, centerZ],
        [-centerRadius, -centerRadius, centerZ]],
    uvs: north
      ? [[0, 0], [1, 0], [1, 1], [0, 1]]
      : [[0, 1], [1, 1], [1, 0], [0, 0]],
    texture: POLAR_URL,
    textureImageSource: {
      url: POLAR_URL,
      width: POLAR_ATLAS_WIDTH,
      height: POLAR_ATLAS_HEIGHT,
      sourceRect: {
        x: north ? 0 : POLAR_CELL,
        y: POLAR_CELL * 2,
        width: POLAR_CELL,
        height: POLAR_CELL,
      },
    },
    texturePresentation: {
      backend: "image",
      lighting: "source",
      projection: "projective",
    },
    color: parameters.color,
    polarCap: pole,
    polarPart: "center",
  });
  return leaves;
}

}

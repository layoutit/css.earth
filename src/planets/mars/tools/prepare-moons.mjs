import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildPolyMeshTransform,
} from "@layoutit/polycss";
import sharp from "sharp";

import { PREPARED_MARS_CAMERA } from "../runtime/preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "../runtime/preparedLighting.mjs";
import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";
import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
  MARS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

await validateMarsSourceGroup("moons");
await ensureMarsPreparationDirectories();

const OUTPUT_MODULE = new URL("../runtime/preparedMoons.mjs", import.meta.url);
const TILE_SIZE = 50;
const BILLBOARD_CONTENT_SIZE = 128;
const BILLBOARD_GUTTER = 2;
const BILLBOARD_STRIDE = BILLBOARD_CONTENT_SIZE + BILLBOARD_GUTTER * 2;
const BILLBOARD_COLUMNS = 2;
const BILLBOARD_ROWS = 1;
const BILLBOARD_ATLAS_WIDTH = BILLBOARD_COLUMNS * BILLBOARD_STRIDE;
const BILLBOARD_ATLAS_HEIGHT = BILLBOARD_ROWS * BILLBOARD_STRIDE;
const BILLBOARD_ATLAS_URL = "/scenes/mars/mars-moon-billboards.webp";
const BILLBOARD_ATLAS_2X_URL = "/scenes/mars/mars-moon-billboards@2x.webp";
const BILLBOARD_ATLAS_PATH = resolve(MARS_PUBLIC_ROOT, "mars-moon-billboards.webp");
const BILLBOARD_ATLAS_2X_PATH = resolve(
  MARS_PUBLIC_ROOT,
  "mars-moon-billboards@2x.webp",
);
const RADIUS_PRESENTATION_SCALE = 15;
const INNER_ORBIT_RADIUS = 280;
const OUTER_ORBIT_RADIUS = 430;
const MOBILE_INNER_ORBIT_RADIUS = 235;
const MOBILE_OUTER_ORBIT_RADIUS = 250;
const MARS_ROTATION_SECONDS = 48;
const MARS_ROTATION_HOURS = 24.6;
const PHYSICAL_TO_VISUAL_TIME_SCALE =
  MARS_ROTATION_HOURS * 3_600 / MARS_ROTATION_SECONDS;
const LABEL_CAMERA_REFERENCE = (() => {
  const pitchDegrees = PREPARED_MARS_CAMERA.initialScenePitchDegrees;
  const yawDegrees = PREPARED_MARS_CAMERA.defaultControlYawDegrees;
  const basis = prepareMoonPlaneBasis({
    scenePitchDegrees: pitchDegrees,
    systemObliquityDegrees: PREPARED_MARS_SCENE.geometry.axialTiltDegrees,
  });
  return Object.freeze({
    pitchDegrees: round(pitchDegrees),
    yawDegrees: round(yawDegrees),
    basis,
    planeTransform: `matrix3d(${prepareMoonCameraFacingMatrix({
      scenePitchDegrees: pitchDegrees,
      sceneYawDegrees: yawDegrees,
      systemObliquityDegrees: PREPARED_MARS_SCENE.geometry.axialTiltDegrees,
      tileSize: TILE_SIZE,
    }).join(",")})`,
  });
})();

const physicalHtml = await readFile(
  resolve(MARS_SOURCE_ROOT, "moons/jpl-physical-parameters.html"),
  "utf8",
);
const elementsHtml = await readFile(
  resolve(MARS_SOURCE_ROOT, "moons/jpl-mean-elements.html"),
  "utf8",
);
const definitions = ["Phobos", "Deimos"].map((name) => {
  const physical = tableRow(physicalHtml, name, 4);
  const orbit = tableRow(elementsHtml, name, 15);
  return Object.freeze({
    id: name.toLowerCase(),
    name,
    meanRadiusKm: numberAt(physical, 2),
    orbitKm: numberAt(orbit, 2),
    eccentricity: numberAt(orbit, 3),
    periapsisDeg: numberAt(orbit, 4),
    meanAnomalyDeg: numberAt(orbit, 5),
    inclinationDeg: numberAt(orbit, 6),
    nodeDeg: numberAt(orbit, 7),
    periodDays: numberAt(orbit, 8),
  });
});
assertSourceValues(definitions);

const sourceMeshes = await Promise.all(definitions.map(async (definition) =>
  Object.freeze({
    definition,
    ...await readGlbShape(resolve(
      MARS_SOURCE_ROOT,
      `moons/${definition.id}.glb`,
    )),
  })));

await Promise.all([
  writeMoonBillboardAtlas(sourceMeshes, 1, BILLBOARD_ATLAS_PATH),
  writeMoonBillboardAtlas(sourceMeshes, 2, BILLBOARD_ATLAS_2X_PATH),
]);
const [billboardAsset, billboardAsset2x] = await Promise.all([
  describeBillboardAsset(BILLBOARD_ATLAS_PATH, BILLBOARD_ATLAS_URL),
  describeBillboardAsset(BILLBOARD_ATLAS_2X_PATH, BILLBOARD_ATLAS_2X_URL),
]);

const moons = sourceMeshes.map((source, index) => prepareMoon(source, index));
const plan = Object.freeze({
  schema: "cssmars-prepared-low-poly-moons@3",
  sourceAuthority: Object.freeze({
    physicalParameters: "JPL Solar System Dynamics physical parameters",
    meanElements: "JPL MAR099 mean elements at 2000-01-01.5 TDB",
    shapeModels: "OpenSpace synchronized Phobos and Deimos GLB models",
    worldLightDirection: PREPARED_MARS_LIGHTING.worldLightDirection,
    initialViewLightDirection: PREPARED_MARS_LIGHTING.initialViewLightDirection,
  }),
  presentation: Object.freeze({
    model: "prepared-source-textured-irregular-billboards-on-mean-circular-orbits",
    radiusPresentationScale: RADIUS_PRESENTATION_SCALE,
    radiusScaleQualification: "readability scale shared by both moons",
    orbitMapping: "linear compression preserving source orbital order",
    sourceOrbitRangeKm: Object.freeze([
      definitions[0].orbitKm,
      definitions[1].orbitKm,
    ]),
    displayOrbitRange: Object.freeze([INNER_ORBIT_RADIUS, OUTER_ORBIT_RADIUS]),
    mobileDisplayOrbitRange: Object.freeze([
      MOBILE_INNER_ORBIT_RADIUS,
      MOBILE_OUTER_ORBIT_RADIUS,
    ]),
    responsiveOrbitMapping:
      "prepared mobile orbit compression keeps both retained labels inside the scene frame",
    sourceEccentricityPublishedButNotApplied: true,
    bodyOrientation: "world-fixed prepared orientation",
    lightingModel: "fixed-world source-normal textured billboard illumination",
    runtimeOrbitalCalculation: false,
    runtimeGeometryPreparation: false,
    runtimeLabelGeometry: false,
    runtimeRasterization: false,
    cameraContract:
      "fixed-reference-billboard-with-unbounded-camera-counter-rotation",
  }),
  billboardAtlas: Object.freeze({
    url: BILLBOARD_ATLAS_URL,
    url2x: BILLBOARD_ATLAS_2X_URL,
    width: BILLBOARD_ATLAS_WIDTH,
    height: BILLBOARD_ATLAS_HEIGHT,
    width2x: BILLBOARD_ATLAS_WIDTH * 2,
    height2x: BILLBOARD_ATLAS_HEIGHT * 2,
    tileCount: moons.length,
    tileSize: BILLBOARD_CONTENT_SIZE,
    tileGutter: BILLBOARD_GUTTER,
    encoding: "webp-q90-alpha-q100",
    sha256: billboardAsset.sha256,
    sha2562x: billboardAsset2x.sha256,
    bytes: billboardAsset.bytes,
    bytes2x: billboardAsset2x.bytes,
  }),
  moons: Object.freeze(moons),
  labelPlaneTransform: LABEL_CAMERA_REFERENCE.planeTransform,
  labelReferencePitchDegrees: LABEL_CAMERA_REFERENCE.pitchDegrees,
  labelReferenceYawDegrees: LABEL_CAMERA_REFERENCE.yawDegrees,
  retainedDom: Object.freeze({
    moonCount: moons.length,
    surfaceLeafCount: moons.reduce((count, moon) => count + moon.leafCount, 0),
    solidLeafCount: 0,
    labelCount: moons.length,
    transformGroupCount: moons.length * 6,
    cssAnimationCount: moons.length * 2,
    runtimeTopology: false,
  }),
});

await writeFile(
  OUTPUT_MODULE,
  "// Generated by tools/prepare-moons.mjs. Do not edit by hand.\n" +
    `export const PREPARED_MARS_MOONS = ${JSON.stringify(plan)};\n`,
);

console.log(
  `Prepared Mars moons: ${plan.retainedDom.surfaceLeafCount} source billboards, ` +
    `${plan.retainedDom.cssAnimationCount} CSS animations.`,
);

function prepareMoon(source, index) {
  const { definition } = source;
  const displayOrbitRadius = index === 0 ? INNER_ORBIT_RADIUS : OUTER_ORBIT_RADIUS;
  const mobileDisplayOrbitRadius = index === 0
    ? MOBILE_INNER_ORBIT_RADIUS
    : MOBILE_OUTER_ORBIT_RADIUS;
  const visualPeriodSeconds =
    definition.periodDays * 86_400 / PHYSICAL_TO_VISUAL_TIME_SCALE;
  const phaseDegrees = normalizeDegrees(
    definition.periapsisDeg + definition.meanAnomalyDeg,
  );
  const displayRadii = prepareSourceDisplayRadii(source);
  const billboardRadius = prepareBillboardRadius(source);
  const localScale = round(2 * billboardRadius / BILLBOARD_CONTENT_SIZE, 12);
  const column = index % BILLBOARD_COLUMNS;
  const row = Math.floor(index / BILLBOARD_COLUMNS);
  const leaves = Object.freeze([Object.freeze({
    tag: "s",
    style: `width:${BILLBOARD_CONTENT_SIZE}px;height:${BILLBOARD_CONTENT_SIZE}px;` +
      `transform:matrix3d(${[
        localScale, 0, 0, 0,
        0, localScale, 0, 0,
        0, 0, 1, 0,
        -billboardRadius, -billboardRadius, displayRadii[2] + 0.01, 1,
      ].map((value) => round(value, 12)).join(",")});` +
      `background-image:url("${BILLBOARD_ATLAS_2X_URL}");` +
      `background-position:${-(column * BILLBOARD_STRIDE + BILLBOARD_GUTTER)}px ` +
        `${-(row * BILLBOARD_STRIDE + BILLBOARD_GUTTER)}px;` +
      `background-size:${BILLBOARD_ATLAS_WIDTH}px ${BILLBOARD_ATLAS_HEIGHT}px`,
  })]);
  const duration = round(visualPeriodSeconds, 6);
  const delay = round(-visualPeriodSeconds * phaseDegrees / 360, 6);
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    sourceModel: "OpenSpace GLB source-textured prepared camera-facing alpha plane",
    surfaceTopology: "prepared-camera-facing-alpha-plane",
    sourceSha256: source.sha256,
    meanRadiusKm: definition.meanRadiusKm,
    sourceBoundsKm: source.bounds,
    displayRadii,
    radiusPresentationScale: RADIUS_PRESENTATION_SCALE,
    orbitKm: definition.orbitKm,
    displayOrbitRadius,
    mobileDisplayOrbitRadius,
    eccentricity: definition.eccentricity,
    periapsisDeg: definition.periapsisDeg,
    meanAnomalyDeg: definition.meanAnomalyDeg,
    inclinationDeg: definition.inclinationDeg,
    nodeDeg: definition.nodeDeg,
    periodDays: definition.periodDays,
    visualPeriodSeconds: duration,
    phaseDegrees: round(phaseDegrees, 6),
    orbitTransform: `transform:${buildPolyMeshTransform({
      rotation: [definition.inclinationDeg, 0, definition.nodeDeg],
    })};animation-duration:${duration}s;animation-delay:${delay}s`,
    positionTransform:
      `--mars-moon-position:${buildPolyMeshTransform({
        position: [displayOrbitRadius, 0, 0],
      })};` +
      `--mars-moon-position-mobile:${buildPolyMeshTransform({
        position: [mobileDisplayOrbitRadius, 0, 0],
      })}`,
    counterTransform:
      `--mars-moon-inclination:${round(definition.inclinationDeg, 6)}deg;` +
      `--mars-moon-node:${round(definition.nodeDeg, 6)}deg;` +
      `animation-duration:${duration}s;animation-delay:${delay}s`,
    leafCount: leaves.length,
    leaves,
    billboard: Object.freeze({
      radius: billboardRadius,
      textureSize: BILLBOARD_CONTENT_SIZE,
      sourceTriangleCount: source.indices.length / 3,
      sourceVertexCount: source.vertices.length,
    }),
    label: Object.freeze({
      text: definition.name,
      radii: displayRadii,
      widthPx: 80,
      gapPx: 8,
      tileSize: TILE_SIZE,
      anchorTranslation: (() => {
        const radii = prepareMoonProjectedRadii(
          LABEL_CAMERA_REFERENCE.basis,
          displayRadii,
        );
        return `0px ${round(radii[1], 12)}px ` +
          `${round(radii[2] + 0.01, 12)}px`;
      })(),
      localStyle:
        "--mars-moon-label-transform:translate3d(-40px, 8px, 0px);" +
        `--mars-moon-label-transform-mobile:translate3d(-36px, ` +
        `${index === 0 ? 8 : -18}px, 0px)`,
    }),
  });
}

function prepareMoonPlaneBasis({
  scenePitchDegrees,
  systemObliquityDegrees,
}) {
  const radians = Math.PI / 180;
  const screenToObject = (vector) => rotateVectorX(
    rotateVectorY(vector, scenePitchDegrees * radians),
    -systemObliquityDegrees * radians,
  );
  return Object.freeze({
    right: normalizeVector(screenToObject([0, 1, 0])),
    down: normalizeVector(screenToObject([1, 0, 0])),
    view: normalizeVector(screenToObject([0, 0, 1])),
  });
}

function prepareMoonCameraFacingMatrix({
  scenePitchDegrees,
  sceneYawDegrees,
  systemObliquityDegrees,
  tileSize,
}) {
  const referenceComposite = [
    cssRotateXMatrix(scenePitchDegrees),
    cssRotateYMatrix(sceneYawDegrees),
    cssRotateYMatrix(-systemObliquityDegrees),
  ].reduce(multiplyMatrix4);
  return multiplyMatrix4(
    invertRotationMatrix4(referenceComposite),
    [
      tileSize, 0, 0, 0,
      0, tileSize, 0, 0,
      0, 0, tileSize, 0,
      0, 0, 0, 1,
    ],
  ).map((value) => round(value, 12));
}

function multiplyMatrix4(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        result[column * 4 + row] +=
          left[inner * 4 + row] * right[column * 4 + inner];
      }
    }
  }
  return result;
}

function invertRotationMatrix4(matrix) {
  return [
    matrix[0], matrix[4], matrix[8], 0,
    matrix[1], matrix[5], matrix[9], 0,
    matrix[2], matrix[6], matrix[10], 0,
    0, 0, 0, 1,
  ];
}

function cssRotateXMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ];
}

function cssRotateYMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ];
}

function prepareMoonProjectedRadii(basis, radii) {
  const projectedRadius = (direction) => Math.sqrt(
    radii[0] ** 2 * direction[0] ** 2 +
    radii[1] ** 2 * direction[1] ** 2 +
    radii[2] ** 2 * direction[2] ** 2
  );
  return [
    projectedRadius(basis.right),
    projectedRadius(basis.down),
    projectedRadius(basis.view),
  ];
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function rotateVectorX([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateVectorY([x, y, z], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function prepareSourceDisplayRadii(source) {
  const scale = moonDisplayScale();
  return Object.freeze([0, 1, 2].map((axis) => round(
    Math.max(...source.vertices.map(({ position }) => Math.abs(position[axis]))) *
      scale,
  )));
}

function prepareBillboardRadius(source) {
  const basis = LABEL_CAMERA_REFERENCE.basis;
  const maximumProjection = Math.max(...source.vertices.flatMap(({ position }) => [
    Math.abs(dotVector(position, basis.right)),
    Math.abs(dotVector(position, basis.down)),
  ]));
  return round(maximumProjection * moonDisplayScale(), 12);
}

function moonDisplayScale() {
  return PREPARED_MARS_SCENE.geometry.equatorialRadius /
    PREPARED_MARS_SCENE.geometry.equatorialRadiusKm *
    RADIUS_PRESENTATION_SCALE;
}

async function writeMoonBillboardAtlas(sources, density, path) {
  const tileSize = BILLBOARD_CONTENT_SIZE * density;
  const composites = await Promise.all(sources.map(async (source, index) => ({
    input: await renderMoonBillboard(source, density),
    raw: { width: tileSize, height: tileSize, channels: 4 },
    left: (index * BILLBOARD_STRIDE + BILLBOARD_GUTTER) * density,
    top: BILLBOARD_GUTTER * density,
  })));
  await sharp({
    create: {
      width: BILLBOARD_ATLAS_WIDTH * density,
      height: BILLBOARD_ATLAS_HEIGHT * density,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(path);
}

async function describeBillboardAsset(path, url) {
  const bytes = await readFile(path);
  const metadata = await sharp(bytes).metadata();
  return Object.freeze({
    url,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

async function renderMoonBillboard(source, density) {
  const outputSize = BILLBOARD_CONTENT_SIZE * density;
  const renderSize = outputSize * 2;
  const center = renderSize / 2;
  const basis = LABEL_CAMERA_REFERENCE.basis;
  const maximumProjection = Math.max(...source.vertices.flatMap(({ position }) => [
    Math.abs(dotVector(position, basis.right)),
    Math.abs(dotVector(position, basis.down)),
  ]));
  const pixelsPerKilometer = renderSize * 0.46 / maximumProjection;
  const light = normalizeVector([0, 1, 2].map((axis) =>
    basis.right[axis] * PREPARED_MARS_LIGHTING.initialViewLightDirection[0] +
    basis.down[axis] * PREPARED_MARS_LIGHTING.initialViewLightDirection[1] +
    basis.view[axis] * PREPARED_MARS_LIGHTING.initialViewLightDirection[2]));
  const projected = source.vertices.map(({ position, normal, uv }) => ({
    x: center + dotVector(position, basis.right) * pixelsPerKilometer,
    y: center + dotVector(position, basis.down) * pixelsPerKilometer,
    depth: dotVector(position, basis.view),
    normal,
    uv,
  }));
  const rgba = Buffer.alloc(renderSize * renderSize * 4);
  const depthBuffer = new Float64Array(renderSize * renderSize);
  depthBuffer.fill(-Infinity);
  for (let index = 0; index < source.indices.length; index += 3) {
    rasterizeSourceTriangle({
      vertices: [
        projected[source.indices[index]],
        projected[source.indices[index + 1]],
        projected[source.indices[index + 2]],
      ],
      source,
      light,
      rgba,
      depthBuffer,
      size: renderSize,
    });
  }
  return sharp(rgba, {
    raw: { width: renderSize, height: renderSize, channels: 4 },
  })
    .resize(outputSize, outputSize, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
}

function rasterizeSourceTriangle({
  vertices: [a, b, c],
  source,
  light,
  rgba,
  depthBuffer,
  size,
}) {
  const area = edge(a, b, c.x, c.y);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-9) return;
  const triangleUvs = unwrapTriangleUvs([a.uv, b.uv, c.uv]);
  const minimumX = clamp(Math.floor(Math.min(a.x, b.x, c.x)), 0, size - 1);
  const maximumX = clamp(Math.ceil(Math.max(a.x, b.x, c.x)), 0, size - 1);
  const minimumY = clamp(Math.floor(Math.min(a.y, b.y, c.y)), 0, size - 1);
  const maximumY = clamp(Math.ceil(Math.max(a.y, b.y, c.y)), 0, size - 1);
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      const weightA = edge(b, c, sampleX, sampleY) / area;
      const weightB = edge(c, a, sampleX, sampleY) / area;
      const weightC = 1 - weightA - weightB;
      if (weightA < -1e-7 || weightB < -1e-7 || weightC < -1e-7) continue;
      const depth = weightA * a.depth + weightB * b.depth + weightC * c.depth;
      const pixel = y * size + x;
      if (depth <= depthBuffer[pixel]) continue;
      depthBuffer[pixel] = depth;
      const normal = normalizeVector([0, 1, 2].map((axis) =>
        weightA * a.normal[axis] +
        weightB * b.normal[axis] +
        weightC * c.normal[axis]));
      const incidence = Math.max(0, dotVector(normal, light));
      const uv = [
        weightA * triangleUvs[0][0] +
          weightB * triangleUvs[1][0] +
          weightC * triangleUvs[2][0],
        weightA * triangleUvs[0][1] +
          weightB * triangleUvs[1][1] +
          weightC * triangleUvs[2][1],
      ];
      const color = sampleTexture(source.texture, uv);
      const offset = pixel * 4;
      const directionalTint = [1, 0.949, 0.91];
      const ambientTint = [0.788, 0.706, 0.651];
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = clamp(Math.round(color[channel] * (
          0.22 * ambientTint[channel] +
          0.78 * incidence * directionalTint[channel]
        )), 0, 255);
      }
      rgba[offset + 3] = 255;
    }
  }
}

function unwrapTriangleUvs(uvs) {
  const uValues = uvs.map(([u]) => u);
  if (Math.max(...uValues) - Math.min(...uValues) <= 0.5) return uvs;
  return uvs.map(([u, v]) => [u < 0.5 ? u + 1 : u, v]);
}

function edge(a, b, x, y) {
  return (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
}

function dotVector(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

async function readGlbShape(path) {
  const bytes = await readFile(path);
  if (bytes.toString("utf8", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`Unsupported Mars moon GLB: ${path}.`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/u, ""),
  );
  const binaryHeader = 20 + jsonLength;
  if (bytes.toString("utf8", binaryHeader + 4, binaryHeader + 8) !== "BIN\0") {
    throw new Error(`Mars moon GLB has no binary chunk: ${path}.`);
  }
  const binaryOffset = binaryHeader + 8;
  const primitive = json.meshes?.[0]?.primitives?.[0];
  const positions = readAccessor(bytes, json, primitive?.attributes?.POSITION,
    binaryOffset);
  const normals = readAccessor(bytes, json, primitive?.attributes?.NORMAL,
    binaryOffset);
  const uvs = readAccessor(bytes, json, primitive?.attributes?.TEXCOORD_0,
    binaryOffset);
  const indices = readIndexAccessor(bytes, json, primitive?.indices, binaryOffset);
  if (positions.length !== normals.length || positions.length !== uvs.length ||
      positions.length < 1_000 || indices.length < 3 || indices.length % 3 !== 0) {
    throw new Error(`Mars moon GLB accessor drifted: ${path}.`);
  }
  const bounds = Object.freeze([0, 1, 2].map((axis) => Object.freeze([
    Math.min(...positions.map((position) => position[axis])),
    Math.max(...positions.map((position) => position[axis])),
  ])));
  const center = bounds.map(([minimum, maximum]) => (minimum + maximum) / 2);
  const vertices = positions.map((position, index) => {
    const centered = position.map((value, axis) => value - center[axis]);
    const length = Math.hypot(...centered) || 1;
    return Object.freeze({
      position: centered,
      direction: centered.map((value) => value / length),
      normal: normalizeVector(normals[index]),
      uv: uvs[index],
    });
  });
  const imageView = json.bufferViews?.[json.images?.[0]?.bufferView];
  if (!imageView) throw new Error(`Mars moon GLB texture drifted: ${path}.`);
  const imageBytes = bytes.subarray(
    binaryOffset + (imageView.byteOffset ?? 0),
    binaryOffset + (imageView.byteOffset ?? 0) + imageView.byteLength,
  );
  const decoded = await sharp(imageBytes)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Object.freeze({
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bounds,
    indices,
    vertices: Object.freeze(vertices),
    texture: Object.freeze({
      data: decoded.data,
      width: decoded.info.width,
      height: decoded.info.height,
      channels: decoded.info.channels,
    }),
  });
}

function readIndexAccessor(bytes, json, accessorIndex, binaryOffset) {
  const accessor = json.accessors?.[accessorIndex];
  const view = json.bufferViews?.[accessor?.bufferView];
  if (!accessor || !view || accessor.type !== "SCALAR" ||
      ![5123, 5125].includes(accessor.componentType)) {
    throw new Error("Mars moon GLB index accessor schema drifted.");
  }
  const componentBytes = accessor.componentType === 5123 ? 2 : 4;
  const stride = view.byteStride ?? componentBytes;
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const read = accessor.componentType === 5123
    ? (offset) => bytes.readUInt16LE(offset)
    : (offset) => bytes.readUInt32LE(offset);
  return Object.freeze(Array.from(
    { length: accessor.count },
    (_, index) => read(start + index * stride),
  ));
}

function readAccessor(bytes, json, accessorIndex, binaryOffset) {
  const accessor = json.accessors?.[accessorIndex];
  const view = json.bufferViews?.[accessor?.bufferView];
  const componentCount = accessor?.type === "VEC3" ? 3 :
    accessor?.type === "VEC2" ? 2 : 0;
  if (!accessor || !view || accessor.componentType !== 5126 || !componentCount) {
    throw new Error("Mars moon GLB accessor schema drifted.");
  }
  const stride = view.byteStride ?? componentCount * 4;
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Object.freeze(Array.from({ length: accessor.count }, (_, index) =>
    Object.freeze(Array.from({ length: componentCount }, (_, component) =>
      bytes.readFloatLE(start + index * stride + component * 4)))));
}

function sampleTexture(texture, [u, v]) {
  const x = clamp(Math.floor((u - Math.floor(u)) * texture.width),
    0, texture.width - 1);
  const y = clamp(Math.floor(v * texture.height), 0, texture.height - 1);
  const offset = (y * texture.width + x) * texture.channels;
  return [texture.data[offset], texture.data[offset + 1], texture.data[offset + 2]];
}

function tableRow(html, name, minimumCells) {
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((match) => stripMarkup(match[1]));
    if (cells[0] === name && cells.length >= minimumCells) return cells;
  }
  throw new Error(`JPL Mars moon row drifted for ${name}.`);
}

function stripMarkup(value) {
  return value.replace(/<[^>]+>/gu, " ")
    .replaceAll("&pm;", "±")
    .replaceAll("&nbsp;", " ")
    .replace(/&[^;]+;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function numberAt(row, index) {
  const value = Number.parseFloat(row[index]);
  if (!Number.isFinite(value)) throw new Error(`JPL numeric cell drifted: ${row[index]}.`);
  return value;
}

function assertSourceValues([phobos, deimos]) {
  const expected = [
    [phobos, 11.08, 9_375, 0.3187],
    [deimos, 6.2, 23_457, 1.2625],
  ];
  for (const [moon, radius, orbit, period] of expected) {
    if (moon.meanRadiusKm !== radius || moon.orbitKm !== orbit ||
        moon.periodDays !== period) {
      throw new Error(`JPL ${moon.name} values drifted.`);
    }
  }
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { chromium } from "playwright";

import { PREPARED_NEPTUNE_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_NEPTUNE_SCENE } from "../runtime/preparedScene.mjs";

const camera = PREPARED_NEPTUNE_SCENE.camera;
const playback = camera.orbitPlayback;
if (PREPARED_NEPTUNE_SCENE.schema !==
    "cssneptune-prepared-runtime-scene@1" ||
    playback?.schema !== "cssneptune-prepared-camera-orbit@1" ||
    camera.stateStepDegrees !== 0.01 ||
    camera.stateCount !== 8_901 ||
    playback.stateCount !== camera.stateCount) {
  throw new Error("Neptune prepared orbit source is incompatible.");
}

const initialScenePitch = playback.initialScenePitchDegrees;
const initialSystemTilt = playback.initialSystemTiltDegrees;
const systemNode = playback.systemNodeDegrees;
const initialMaterialTransform = PREPARED_NEPTUNE_SCENE.fixedMaterialPlane
  .leaf.style.match(/(?:^|;)transform:([^;]+)/u)?.[1];
const materialProjection =
  PREPARED_NEPTUNE_SCENE.fixedMaterialPlane.interactionProjection;
const materialOrbit = PREPARED_NEPTUNE_LENSES.controls.find(({ id }) =>
  id === PREPARED_NEPTUNE_LENSES.defaultLens)?.orbitMaterial;
const SCENE_VARIABLE_MATRIX_INDEXES = Object.freeze([
  0, 1, 2,
  4, 5, 6,
  8, 9, 10,
]);
const MATERIAL_VARIABLE_MATRIX_INDEXES = Object.freeze([
  0, 1, 2,
  4, 5, 6,
  8, 9, 10,
  12, 13, 14,
]);
if (!initialMaterialTransform?.startsWith("matrix3d(") ||
    !materialProjection || materialOrbit?.frameCount !== 256 ||
    materialOrbit.minimumScenePitchDegrees !== 0 ||
    materialOrbit.maximumScenePitchDegrees !== 65) {
  throw new Error("Neptune prepared material projection is incompatible.");
}
const defaultStateIndex = Math.round(
  camera.defaultControlPitchDegrees / camera.stateStepDegrees,
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
let preparedMatrices;
try {
  const page = await browser.newPage();
  preparedMatrices = await page.evaluate((source) => {
    const initialSystemInverse = new DOMMatrix(source.initialSystemTransform)
      .inverse();
    const sceneMatrices = new Array(source.stateCount);
    const materialMatrices = new Array(source.materialStateCount);
    const scaleVector = (vector, scale) =>
      vector.map((value) => value * scale);
    const addVectors = (...vectors) => [0, 1, 2].map((axis) =>
      vectors.reduce((sum, vector) => sum + vector[axis], 0));
    const normalizeVector = (vector) => {
      const length = Math.hypot(...vector) || 1;
      return vector.map((value) => value / length);
    };
    const rotateVectorX = ([x, y, z], angle) => {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return [x, y * cosine - z * sine, y * sine + z * cosine];
    };
    const rotateVectorY = ([x, y, z], angle) => {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return [x * cosine + z * sine, y, -x * sine + z * cosine];
    };
    const rotateVectorZ = ([x, y, z], angle) => {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return [x * cosine - y * sine, x * sine + y * cosine, z];
    };
    const preparedMaterialPlaneMatrix = ({
      scenePitchDegrees,
      systemObliquityDegrees,
      projection,
    }) => {
      const radians = Math.PI / 180;
      const screenToObject = (vector) => rotateVectorZ(
        rotateVectorX(
          rotateVectorZ(
            rotateVectorY(vector, scenePitchDegrees * radians),
            -projection.presentationNodeDegrees * radians,
          ),
          -systemObliquityDegrees * radians,
        ),
        -projection.meshRotationDegrees * radians,
      );
      const right = normalizeVector(screenToObject([0, 1, 0]));
      const down = normalizeVector(screenToObject([1, 0, 0]));
      const view = normalizeVector(screenToObject([0, 0, 1]));
      const projectedRadius = (direction) => Math.sqrt(
        projection.equatorialRadius ** 2 *
          (direction[0] ** 2 + direction[1] ** 2) +
        projection.polarRadius ** 2 * direction[2] ** 2,
      );
      const radiusX = projectedRadius(right) * projection.coverageScale;
      const radiusY = projectedRadius(down) * projection.coverageScale;
      const frontDepth = projectedRadius(view) + projection.depthBias;
      const worldToCss = ([x, y, z]) => [
        y * projection.tileSize,
        x * projection.tileSize,
        z * projection.tileSize,
      ];
      const basisX = worldToCss(scaleVector(
        right,
        radiusX * 2 / projection.textureSize,
      ));
      const basisY = worldToCss(scaleVector(
        down,
        radiusY * 2 / projection.textureSize,
      ));
      const basisZ = worldToCss(view);
      const origin = worldToCss(addVectors(
        scaleVector(right, -radiusX),
        scaleVector(down, -radiusY),
        scaleVector(view, frontDepth),
      ));
      return [...basisX, 0, ...basisY, 0, ...basisZ, 0, ...origin, 1]
        .map((value) => Number(value.toFixed(12)));
    };
    for (let index = 0; index < source.stateCount; index += 1) {
      const controlPitch = source.minimumControlPitchDegrees +
        index * source.stateStepDegrees;
      const progress = (controlPitch - source.defaultControlPitchDegrees) /
        (source.maximumControlPitchDegrees -
          source.defaultControlPitchDegrees);
      const remaining = 1 - progress;
      const scenePitch = source.initialScenePitch * remaining;
      const systemTilt = source.initialSystemTilt * remaining;
      const cameraTransform =
        `scale(${0.02 * source.initialZoom}) rotateX(${scenePitch}deg) ` +
        "rotate(0deg) translate3d(0px, 0px, 0px)";
      sceneMatrices[index] = Array.from(new DOMMatrix(cameraTransform)
        .multiply(new DOMMatrix()
          .rotate(0, 0, source.systemNode)
          .rotate(0, systemTilt, 0))
        .multiply(initialSystemInverse)
        .toFloat64Array());
    }
    for (let index = 0; index < source.materialStateCount; index += 1) {
      const progress = index / (source.materialStateCount - 1);
      const scenePitch = source.maximumMaterialScenePitchDegrees - progress *
        (source.maximumMaterialScenePitchDegrees -
          source.minimumMaterialScenePitchDegrees);
      const systemTilt = source.initialSystemTilt *
        scenePitch / source.initialScenePitch;
      materialMatrices[index] = preparedMaterialPlaneMatrix({
        scenePitchDegrees: scenePitch,
        systemObliquityDegrees: -systemTilt,
        projection: source.materialProjection,
      });
    }
    return { sceneMatrices, materialMatrices };
  }, {
    defaultControlPitchDegrees: camera.defaultControlPitchDegrees,
    initialScenePitch,
    initialSystemTilt,
    initialSystemTransform: PREPARED_NEPTUNE_SCENE.systemTransform
      .replace(/^transform:/u, ""),
    initialZoom: camera.initialZoom,
    maximumControlPitchDegrees: camera.maximumControlPitchDegrees,
    maximumMaterialScenePitchDegrees:
      materialOrbit.maximumScenePitchDegrees,
    materialProjection,
    materialStateCount: materialOrbit.frameCount,
    minimumMaterialScenePitchDegrees:
      materialOrbit.minimumScenePitchDegrees,
    minimumControlPitchDegrees: camera.minimumControlPitchDegrees,
    stateCount: camera.stateCount,
    stateStepDegrees: camera.stateStepDegrees,
    systemNode,
  });
} finally {
  await browser.close();
}

const { sceneMatrices, materialMatrices } = preparedMatrices ?? {};
assertPreparedMatrixBank(sceneMatrices, camera.stateCount, "scene");
assertPreparedMatrixBank(
  materialMatrices,
  materialOrbit.frameCount,
  "material",
);
const sceneConstants = constantMatrixCoefficients(sceneMatrices);
const materialConstants = constantMatrixCoefficients(materialMatrices);
assertVariableMatrixIndexes(
  sceneConstants,
  SCENE_VARIABLE_MATRIX_INDEXES,
  "scene",
);
assertVariableMatrixIndexes(
  materialConstants,
  MATERIAL_VARIABLE_MATRIX_INDEXES,
  "material",
);
const values = [
  ...columnMajorCoefficients(sceneMatrices, SCENE_VARIABLE_MATRIX_INDEXES),
  ...columnMajorCoefficients(
    materialMatrices,
    MATERIAL_VARIABLE_MATRIX_INDEXES,
  ),
];
const decoded = Buffer.allocUnsafe(
  values.length * Float64Array.BYTES_PER_ELEMENT,
);
for (let index = 0; index < values.length; index += 1) {
  decoded.writeDoubleLE(values[index], index * Float64Array.BYTES_PER_ELEMENT);
}
const encoded = gzipSync(decoded, { level: 9 });
const descriptor = Object.freeze({
  schema: "cssneptune-prepared-orbit-bank@3",
  encoding:
    "gzip-float64-le-column-major-variable-matrix-coefficients",
  asset: Object.freeze({
    url: "/scenes/neptune/neptune-orbit-bank.f64z",
    byteLength: encoded.byteLength,
    sha256: createHash("sha256").update(encoded).digest("hex"),
  }),
  decodedByteLength: decoded.byteLength,
  valueCount: values.length,
  stateCount: sceneMatrices.length,
  stateStepDegrees: camera.stateStepDegrees,
  minimumControlPitchDegrees: camera.minimumControlPitchDegrees,
  maximumControlPitchDegrees: camera.maximumControlPitchDegrees,
  defaultStateIndex,
  sceneVariableMatrixIndexes: SCENE_VARIABLE_MATRIX_INDEXES,
  sceneConstantMatrix: sceneConstants,
  materialStateCount: materialMatrices.length,
  materialMinimumScenePitchDegrees:
    materialOrbit.minimumScenePitchDegrees,
  materialMaximumScenePitchDegrees:
    materialOrbit.maximumScenePitchDegrees,
  materialVariableMatrixIndexes: MATERIAL_VARIABLE_MATRIX_INDEXES,
  materialConstantMatrix: materialConstants,
  runtimeInterpolation: false,
  runtimeMatrixConstructionForPitch: false,
  runtimeMatrixConstructionForZoom: true,
  runtimeMaterialMatrixConstructionForPitch: false,
});
await writeFile(
  new URL(
    "../../../../public/scenes/neptune/neptune-orbit-bank.f64z",
    import.meta.url,
  ),
  encoded,
);
await writeFile(
  new URL("../runtime/preparedOrbitBank.mjs", import.meta.url),
  "// Generated by tools/prepare-orbit.mjs; runtime decodes transport only.\n" +
    `export const PREPARED_NEPTUNE_ORBIT_BANK = Object.freeze(${JSON.stringify(descriptor)});\n`,
);
console.log(JSON.stringify({
  stateCount: sceneMatrices.length,
  encodedByteLength: encoded.byteLength,
  decodedByteLength: decoded.byteLength,
  valueCount: values.length,
  defaultStateIndex,
}, null, 2));

function assertPreparedMatrixBank(matrices, expectedCount, label) {
  if (!Array.isArray(matrices) || matrices.length !== expectedCount ||
      matrices.some((matrix) =>
        !Array.isArray(matrix) || matrix.length !== 16 ||
        matrix.some((value) => !Number.isFinite(value)))) {
    throw new Error(`Neptune prepared ${label} matrix bank is invalid.`);
  }
}

function constantMatrixCoefficients(matrices) {
  return Object.freeze(matrices[0].map((value, matrixIndex) =>
    matrices.every((matrix) => Object.is(matrix[matrixIndex], value))
      ? value
      : null));
}

function assertVariableMatrixIndexes(constants, expected, label) {
  const actual = constants.flatMap((value, index) =>
    value === null ? [index] : []);
  if (actual.join(",") !== expected.join(",")) {
    throw new Error(
      `Neptune prepared ${label} variable coefficients drifted.`,
    );
  }
}

function columnMajorCoefficients(matrices, matrixIndexes) {
  return matrixIndexes.flatMap((matrixIndex) =>
    matrices.map((matrix) => matrix[matrixIndex]));
}

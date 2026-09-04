import { worldPositionToCss } from "@layoutit/polycss";

import {
  MARS_AXIAL_TILT_DEGREES,
  MARS_BODY_ROTATION_DEGREES,
  MARS_EQUATORIAL_RADIUS,
  MARS_POLAR_RADIUS,
} from "./body-geometry.mjs";

export const MARS_MATERIAL_DEPTH_BIAS = 1.3;

export function prepareMarsMaterialPlaneTransform({
  pitchDegrees,
  yawDegrees,
  outputSize,
  contentRadius,
  physicalRadius = MARS_EQUATORIAL_RADIUS,
  depthBias = MARS_MATERIAL_DEPTH_BIAS,
}) {
  const numericFields = [
    pitchDegrees,
    yawDegrees,
    outputSize,
    contentRadius,
    physicalRadius,
    depthBias,
  ];
  if (numericFields.some((value) => !Number.isFinite(value)) ||
      outputSize <= 0 || contentRadius <= 0 || physicalRadius <= 0) {
    throw new TypeError("Prepared Mars material plane inputs are invalid.");
  }
  const referenceComposite = [
    cssRotateXMatrix(pitchDegrees),
    cssRotateYMatrix(yawDegrees),
    cssRotateYMatrix(-MARS_AXIAL_TILT_DEGREES),
    cssRotateZMatrix(-MARS_BODY_ROTATION_DEGREES),
  ].reduce(multiplyMatrix4);
  const cssUnitsPerBodyUnit = Math.hypot(...worldPositionToCss([1, 0, 0]));
  const equatorialRadius = physicalRadius * cssUnitsPerBodyUnit;
  const polarRadius = MARS_POLAR_RADIUS *
    physicalRadius / MARS_EQUATORIAL_RADIUS * cssUnitsPerBodyUnit;
  const radiusX = ellipsoidSupportRadius(
    referenceComposite,
    [0, 4, 8],
    equatorialRadius,
    polarRadius,
  );
  const radiusY = ellipsoidSupportRadius(
    referenceComposite,
    [1, 5, 9],
    equatorialRadius,
    polarRadius,
  );
  const frontDepth = ellipsoidSupportRadius(
    referenceComposite,
    [2, 6, 10],
    equatorialRadius,
    polarRadius,
  );
  const scaleX = radiusX / contentRadius;
  const scaleY = radiusY / contentRadius;
  const screenPlane = [
    scaleX, 0, 0, 0,
    0, scaleY, 0, 0,
    0, 0, 1, 0,
    -outputSize / 2 * scaleX,
    -outputSize / 2 * scaleY,
    frontDepth + depthBias * cssUnitsPerBodyUnit,
    1,
  ];
  const localPlane = multiplyMatrix4(
    invertRotationMatrix4(referenceComposite),
    screenPlane,
  );
  return `matrix3d(${localPlane.map(round).join(",")})`;
}

function ellipsoidSupportRadius(
  matrix,
  [equatorialX, equatorialY, polar],
  equatorialRadius,
  polarRadius,
) {
  return Math.sqrt(
    equatorialRadius ** 2 *
      (matrix[equatorialX] ** 2 + matrix[equatorialY] ** 2) +
    polarRadius ** 2 * matrix[polar] ** 2,
  );
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

function cssRotateZMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function round(value) {
  return Number(value.toFixed(12));
}

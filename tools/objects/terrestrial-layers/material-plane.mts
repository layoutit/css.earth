export interface MaterialPlaneOptions {pitchDegrees:number; yawDegrees:number; outputSize:number; contentRadius:number; physicalRadius:number; equatorialRadius:number; polarRadius:number; axialTiltDegrees:number; bodyRotationDegrees:number; depthBias:number;}
import { worldPositionToCss } from "@layoutit/polycss";





export function prepareEllipsoidMaterialPlaneTransform({
  pitchDegrees,
  yawDegrees,
  outputSize,
  contentRadius,
  physicalRadius,
  equatorialRadius: authoredEquatorialRadius,
  polarRadius: authoredPolarRadius,
  axialTiltDegrees,
  bodyRotationDegrees,
  depthBias,
}: MaterialPlaneOptions) {
  const numericFields = [
    pitchDegrees,
    yawDegrees,
    outputSize,
    contentRadius,
    physicalRadius,
    depthBias, authoredEquatorialRadius, authoredPolarRadius, axialTiltDegrees, bodyRotationDegrees,
  ];
  if (numericFields.some((value) => !Number.isFinite(value)) ||
      outputSize <= 0 || contentRadius <= 0 || physicalRadius <= 0) {
    throw new TypeError("Prepared ellipsoid material plane inputs are invalid.");
  }
  const referenceComposite = [
    cssRotateXMatrix(pitchDegrees),
    cssRotateYMatrix(yawDegrees),
    cssRotateYMatrix(-axialTiltDegrees),
    cssRotateZMatrix(-bodyRotationDegrees),
  ].reduce(multiplyMatrix4);
  const cssUnitsPerBodyUnit = Math.hypot(...worldPositionToCss([1, 0, 0]));
  const equatorialRadius = physicalRadius * cssUnitsPerBodyUnit;
  const polarRadius = authoredPolarRadius *
    physicalRadius / authoredEquatorialRadius * cssUnitsPerBodyUnit;
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
  matrix: readonly number[],
  [equatorialX, equatorialY, polar]: readonly [number,number,number],
  equatorialRadius: number,
  polarRadius: number,
) {
  return Math.sqrt(
    equatorialRadius ** 2 *
      (matrix[equatorialX] ** 2 + matrix[equatorialY] ** 2) +
    polarRadius ** 2 * matrix[polar] ** 2,
  );
}

function multiplyMatrix4(left: readonly number[], right: readonly number[]) {
  const result = new Array<number>(16).fill(0);
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

function invertRotationMatrix4(matrix: readonly number[]) {
  return [
    matrix[0], matrix[4], matrix[8], 0,
    matrix[1], matrix[5], matrix[9], 0,
    matrix[2], matrix[6], matrix[10], 0,
    0, 0, 0, 1,
  ];
}

function cssRotateXMatrix(degrees: number) {
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

function cssRotateYMatrix(degrees: number) {
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

function cssRotateZMatrix(degrees: number) {
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

function round(value: number) {
  return Number(value.toFixed(12));
}


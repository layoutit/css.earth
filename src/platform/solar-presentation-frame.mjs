// Builds the ecliptic presentation frame of a body: the fixed rotation that
// takes the body-fixed frame (+Z north pole, +X prime meridian) into the CSS
// scene frame the retained camera orbits (+x right, +y down, +z toward the
// viewer). Prepared once per body from the checked-in solar geometry; the
// runtime only transports the resulting matrix.
//
// The frame is defined by two observed directions:
//   - screen up (-y) is J2000 ecliptic north, so the scene yaw axis is the
//     ecliptic pole and the body's own pole shows its real tilt;
//   - screen left (-x) is the Sun's projection onto the ecliptic plane, so at
//     zero yaw the Sun lies exactly to the left and the terminator stands
//     vertical, up to the Sun's ecliptic latitude as seen from the body.
// The third axis follows from right-handedness, which keeps CSS +z toward the
// viewer.

import {
  requireBodyFixedEclipticNorth,
  requireBodyFixedSunDirection,
} from "./solar-geometry.mjs";

export function prepareEclipticPresentationFrame(bodyId) {
  const sun = requireBodyFixedSunDirection(bodyId);
  const north = requireBodyFixedEclipticNorth(bodyId);
  const sunInPlane = normalize(subtract(sun, scale(north, dot(sun, north))));
  // Presentation axes expressed in the body-fixed frame.
  const xAxis = scale(sunInPlane, -1);
  const yAxis = scale(north, -1);
  const zAxis = cross(xAxis, yAxis);
  const basis = Object.freeze([xAxis, yAxis, zAxis]);
  const toPresentation = (direction) => Object.freeze([
    dot(xAxis, direction),
    dot(yAxis, direction),
    dot(zAxis, direction),
  ]);
  const sunDirection = normalize(toPresentation(sun));
  const poleDirection = normalize(toPresentation([0, 0, 1]));
  return Object.freeze({
    bodyId,
    model: "ecliptic-north-up-sun-left-presentation-frame",
    // Rows are the presentation axes in body-fixed coordinates; applying the
    // frame to a body-fixed direction is a dot product with each row.
    basis,
    // CSS matrix3d is column-major: the first four values are the first
    // column, which is the image of body-fixed +x.
    cssTransform: `matrix3d(${[
      xAxis[0], yAxis[0], zAxis[0], 0,
      xAxis[1], yAxis[1], zAxis[1], 0,
      xAxis[2], yAxis[2], zAxis[2], 0,
      0, 0, 0, 1,
    ].map(formatComponent).join(",")})`,
    sunDirection,
    poleDirection,
    sunEclipticLatitudeDegrees: Math.asin(dot(sun, north)) * 180 / Math.PI,
    poleTiltDegrees: Math.acos(north[2]) * 180 / Math.PI,
    toPresentation,
  });
}

function formatComponent(value) {
  return Math.abs(value) < 1e-15 ? "0" : String(value);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, factor) {
  return vector.map((component) => component * factor);
}

function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze(vector.map((component) => component / magnitude));
}

// A body's heliocentric neighbourhood as real geometry around the body: the
// Sun at its observed distance and the body's orbit as a true ellipse, both in
// the body-centred presentation frame the retained scene is prepared in, plus
// the camera-relative projection that puts them on screen.
//
// Preparation (`prepareHeliocentricView`) runs in the object's prepare tools
// and only transports orbital facts from the checked-in solar geometry into
// the scene frame; the vertex ring is static geometry and is prepared here.
// Projection (`projectHeliocentricView`) runs per camera publication: it
// resolves every position relative to the camera in float64, clips the orbit
// against the near plane and a padded frustum, hides the parts of the orbit
// behind the body, and returns small numbers only. The scene's perspective
// camera (a CSS `perspective` on the camera root, eye on the root's axis) is
// the same camera this module projects with, so the body, the Sun and the
// orbit share one projection by construction.
//
// Frames and units. "World" is the CSS scene frame of the object: +x right,
// +y down, +z toward the viewer at identity rotation, body centre at the
// origin, one unit = one CSS pixel of the unscaled scene (the body radius is
// the prepared leaf radius). The camera rotation is the retained scene matrix
// (`Rx(pitch) Ry(yaw)`); the camera looks down -z from `(0, 0, distance)`
// world units in front of the body's centre after that rotation.

import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  requireBodyFixedOrbitNormal,
  requireBodyFixedSunDirection,
  requireHeliocentricOrbit,
} from "./solar-geometry.mjs";

export const PREPARED_HELIOCENTRIC_VIEW_SCHEMA =
  "cssearth-prepared-heliocentric-view@1";

// IAU 2015 resolution B3 nominal solar radius.
export const NOMINAL_SOLAR_RADIUS_KILOMETERS = 695700;

const UNIFORM_ORBIT_SEGMENTS = 360;
// Chords right at the body are refined by halving so the polyline stays
// straight through the body as the camera closes in on it.
const LOCAL_REFINEMENT_HALVINGS = 8;

export function prepareHeliocentricView({
  bodyId,
  presentationFrame,
  bodyRadiusUnits,
  bodyRadiusKilometers,
  sunSprite,
}) {
  if (!/^[a-z][a-z0-9-]*$/u.test(bodyId ?? "") ||
      typeof presentationFrame?.toPresentation !== "function" ||
      !Array.isArray(presentationFrame.basis) ||
      !positive(bodyRadiusUnits) || !positive(bodyRadiusKilometers) ||
      !positive(sunSprite?.opaqueCoreDiameterShare) ||
      !Number.isSafeInteger(sunSprite.imagePixels) ||
      sunSprite.imagePixels <= 0) {
    throw new TypeError("Heliocentric view preparation arguments are invalid.");
  }
  const basisDeterminant = determinant(presentationFrame.basis);
  if (Math.abs(basisDeterminant - 1) > 1e-9) {
    throw new RangeError(
      "The presentation frame must be a proper rotation for orbital cross " +
        "products to survive the change of frame.",
    );
  }
  const orbit = requireHeliocentricOrbit(bodyId);
  const kilometersPerUnit = bodyRadiusKilometers / bodyRadiusUnits;
  const unitsPerAu = ASTRONOMICAL_UNIT_KILOMETERS / kilometersPerUnit;
  const sunDirection = normalize(presentationFrame.toPresentation(
    requireBodyFixedSunDirection(bodyId),
  ));
  const orbitNormal = normalize(presentationFrame.toPresentation(
    requireBodyFixedOrbitNormal(bodyId),
  ));
  const perihelionDirection = normalize(presentationFrame.toPresentation(
    orbit.perihelionDirection,
  ));
  if (Math.abs(dot(orbitNormal, perihelionDirection)) > 1e-9) {
    throw new RangeError("Perihelion direction is not in the orbital plane.");
  }
  // Direction of motion at perihelion; true anomaly grows along it.
  const perihelionMotion = normalize(cross(orbitNormal, perihelionDirection));
  const semiMajorAxisUnits = orbit.semiMajorAxisAu * unitsPerAu;
  const eccentricity = orbit.eccentricity;
  const semiMinorAxisUnits = semiMajorAxisUnits *
    Math.sqrt(1 - eccentricity * eccentricity);
  const sunDistanceUnits = orbit.heliocentricDistanceAu * unitsPerAu;
  const sunPosition = scale(sunDirection, sunDistanceUnits);
  // The Sun sits at a focus; the centre is a·e from it, away from perihelion.
  const center = add(
    sunPosition,
    scale(perihelionDirection, -semiMajorAxisUnits * eccentricity),
  );
  const majorAxis = scale(perihelionDirection, semiMajorAxisUnits);
  const minorAxis = scale(perihelionMotion, semiMinorAxisUnits);
  const pointAt = (eccentricAnomaly) => add(
    center,
    add(
      scale(majorAxis, Math.cos(eccentricAnomaly)),
      scale(minorAxis, Math.sin(eccentricAnomaly)),
    ),
  );
  const trueAnomaly = orbit.trueAnomalyDegrees * Math.PI / 180;
  const bodyEccentricAnomaly = 2 * Math.atan2(
    Math.sqrt(1 - eccentricity) * Math.sin(trueAnomaly / 2),
    Math.sqrt(1 + eccentricity) * Math.cos(trueAnomaly / 2),
  );
  const bodyResidual = magnitude(pointAt(bodyEccentricAnomaly));
  if (bodyResidual > 1e-6 * semiMajorAxisUnits) {
    throw new RangeError(
      `The body is ${bodyResidual} units off its own orbit; the orbital ` +
        "facts disagree with the Sun direction.",
    );
  }
  const step = 2 * Math.PI / UNIFORM_ORBIT_SEGMENTS;
  const offsets = new Set();
  for (let index = 0; index < UNIFORM_ORBIT_SEGMENTS; index += 1) {
    offsets.add(index * step);
  }
  for (let halving = 1; halving <= LOCAL_REFINEMENT_HALVINGS; halving += 1) {
    const local = step / 2 ** halving;
    offsets.add(local);
    offsets.add(2 * Math.PI - local);
  }
  const vertices = [...offsets].sort((a, b) => a - b).map((offset, index) =>
    index === 0
      ? Object.freeze([0, 0, 0])
      : Object.freeze(pointAt(bodyEccentricAnomaly + offset).map(round)));
  const maximumExtentUnits = vertices.reduce(
    (extent, vertex) => Math.max(extent, magnitude(vertex)),
    0,
  );
  const sunRadiusUnits = NOMINAL_SOLAR_RADIUS_KILOMETERS / kilometersPerUnit;
  return Object.freeze({
    schema: PREPARED_HELIOCENTRIC_VIEW_SCHEMA,
    model: "body-centred-true-ellipse-and-sun-at-observed-distance",
    bodyId,
    presentationFrame: presentationFrame.model,
    units: Object.freeze({
      kilometersPerUnit,
      unitsPerAu,
      bodyRadiusUnits,
      bodyRadiusKilometers,
    }),
    sun: Object.freeze({
      direction: sunDirection,
      distanceUnits: sunDistanceUnits,
      distanceAu: orbit.heliocentricDistanceAu,
      position: Object.freeze(sunPosition.map(round)),
      radiusUnits: sunRadiusUnits,
      radiusKilometers: NOMINAL_SOLAR_RADIUS_KILOMETERS,
      // The clean-room sprite's opaque core is the photosphere; the glow
      // around it is the rest of the raster, so the billboard is wider.
      sprite: Object.freeze({
        imagePixels: sunSprite.imagePixels,
        opaqueCoreDiameterShare: sunSprite.opaqueCoreDiameterShare,
        worldDiameterUnits: 2 * sunRadiusUnits /
          sunSprite.opaqueCoreDiameterShare,
      }),
    }),
    orbit: Object.freeze({
      semiMajorAxisAu: orbit.semiMajorAxisAu,
      semiMajorAxisUnits,
      semiMinorAxisUnits,
      eccentricity,
      inclinationDegrees: orbit.inclinationDegrees,
      perihelionAu: orbit.perihelionAu,
      aphelionAu: orbit.aphelionAu,
      trueAnomalyDegrees: orbit.trueAnomalyDegrees,
      bodyEccentricAnomalyDegrees: bodyEccentricAnomaly * 180 / Math.PI,
      normal: orbitNormal,
      perihelionDirection,
      center: Object.freeze(center.map(round)),
      majorAxis: Object.freeze(majorAxis.map(round)),
      minorAxis: Object.freeze(minorAxis.map(round)),
      // Closed ring, in the direction of motion, vertex 0 exactly at the body.
      vertices: Object.freeze(vertices),
      vertexCount: vertices.length,
      uniformSegments: UNIFORM_ORBIT_SEGMENTS,
      localRefinementHalvings: LOCAL_REFINEMENT_HALVINGS,
      maximumExtentUnits,
    }),
    runtimeGeometryDerivation: false,
  });
}

export function validatePreparedHeliocentricView(plan) {
  if (plan?.schema !== PREPARED_HELIOCENTRIC_VIEW_SCHEMA ||
      !positive(plan.units?.kilometersPerUnit) ||
      !positive(plan.units?.bodyRadiusUnits) ||
      !unit(plan.sun?.direction) || !positive(plan.sun?.distanceUnits) ||
      !positive(plan.sun?.radiusUnits) ||
      !positive(plan.sun?.sprite?.worldDiameterUnits) ||
      !Number.isSafeInteger(plan.sun?.sprite?.imagePixels) ||
      !vector(plan.sun?.position) ||
      !unit(plan.orbit?.normal) || !unit(plan.orbit?.perihelionDirection) ||
      !positive(plan.orbit?.semiMajorAxisUnits) ||
      !positive(plan.orbit?.maximumExtentUnits) ||
      !Array.isArray(plan.orbit?.vertices) || plan.orbit.vertices.length < 8 ||
      plan.orbit.vertexCount !== plan.orbit.vertices.length ||
      !plan.orbit.vertices.every(vector) ||
      plan.orbit.vertices[0].some((component) => component !== 0) ||
      plan.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared heliocentric view is incompatible.");
  }
  return plan;
}

// The camera: a CSS perspective camera whose eye sits `focal` pixels in front
// of the principal point and looks down -z. The principal point (the CSS
// perspective-origin, the vanishing point of the view axis) may be offset
// from the camera root's centre by `principalOffset`: the shell lays the body
// out beside its chrome while the sky keeps its vanishing point at the stage
// centre, so one eye serves both by looking at the body slightly off-axis.
// The body's centre is always placed so it projects to the root's centre,
// `distance` from the eye. A world point P is at eye-space
// `rotation * P + C` where C is the body centre in eye space; its depth is the
// negated eye-space z and it lands on screen at
// `principalOffset + focal * xy / depth`, offset from the root's centre in
// CSS pixels (+y down).
export function projectHeliocentricView(plan, {
  rotation,
  distance,
  focal,
  viewportWidth,
  viewportHeight,
  principalOffset = [0, 0],
  frustumPadding = 1.25,
  nearShare = 0.01,
}) {
  if (!Array.isArray(rotation) || rotation.length !== 9 ||
      rotation.some((value) => !Number.isFinite(value)) ||
      !positive(distance) || !positive(focal) ||
      !positive(viewportWidth) || !positive(viewportHeight) ||
      !Array.isArray(principalOffset) || principalOffset.length !== 2 ||
      principalOffset.some((value) => !Number.isFinite(value))) {
    throw new TypeError("Heliocentric projection arguments are invalid.");
  }
  const bodyRadius = plan.units.bodyRadiusUnits;
  if (distance <= bodyRadius) {
    throw new RangeError("The camera is inside the body.");
  }
  const near = Math.max(1e-6, distance * nearShare);
  const halfWidth = viewportWidth / 2;
  const halfHeight = viewportHeight / 2;
  const clipX = halfWidth * frustumPadding;
  const clipY = halfHeight * frustumPadding;
  const [ox, oy] = principalOffset;
  const axis = offAxisFrame(focal, principalOffset);
  // The body's centre in eye space: `distance` along the off-axis direction
  // that projects to the root's centre.
  const bodyCenter = [
    distance * axis.sinTheta * axis.radial[0],
    distance * axis.sinTheta * axis.radial[1],
    -distance * axis.cosTheta,
  ];
  const toEye = (point) => [
    rotation[0] * point[0] + rotation[1] * point[1] + rotation[2] * point[2] +
      bodyCenter[0],
    rotation[3] * point[0] + rotation[4] * point[1] + rotation[5] * point[2] +
      bodyCenter[1],
    rotation[6] * point[0] + rotation[7] * point[1] + rotation[8] * point[2] +
      bodyCenter[2],
  ];
  const depthOf = (eye) => -eye[2];
  const project = (eye) => {
    const depth = depthOf(eye);
    return [ox + focal * eye[0] / depth, oy + focal * eye[1] / depth, depth];
  };

  // The body: its silhouette is the tangent cone cut by the image plane, an
  // ellipse a little wider than the orthographic disc and, off-axis, pushed
  // outward from where the centre projects. The material overlay and the drag
  // trackball follow it.
  const silhouette = silhouetteEllipse(bodyRadius, focal, distance, axis);
  const body = Object.freeze({
    distance,
    depth: distance * axis.cosTheta,
    offAxisDegrees: Math.asin(axis.sinTheta) * 180 / Math.PI,
    silhouetteRadius: silhouette.tangentialSemiAxis,
    silhouetteDiameter: 2 * silhouette.tangentialSemiAxis,
    silhouette,
    orthographicRadius: focal * bodyRadius / distance,
    // Camera-root coordinates of the body's centre: the eye sits at the
    // principal point, +focal.
    translate: Object.freeze([
      ox + bodyCenter[0],
      oy + bodyCenter[1],
      focal + bodyCenter[2],
    ]),
  });

  // The Sun: a billboard at its true position, sized from its true radius.
  const sunEye = toEye(plan.sun.position);
  const sunDepth = depthOf(sunEye);
  let sun;
  if (sunDepth <= near) {
    sun = Object.freeze({
      visible: false,
      classification: "behind-camera",
      depth: sunDepth,
      centerNdc: null,
    });
  } else {
    const [x, y] = project(sunEye);
    const spriteDiameter = plan.sun.sprite.worldDiameterUnits * focal /
      sunDepth;
    const centerNdc = Object.freeze([x / halfWidth, -y / halfHeight]);
    const halfWidthNdc = spriteDiameter / 2 / halfWidth;
    const halfHeightNdc = spriteDiameter / 2 / halfHeight;
    const intersects = centerNdc[0] + halfWidthNdc >= -1 &&
      centerNdc[0] - halfWidthNdc <= 1 &&
      centerNdc[1] + halfHeightNdc >= -1 &&
      centerNdc[1] - halfHeightNdc <= 1;
    const fullyVisible = centerNdc[0] - halfWidthNdc >= -1 &&
      centerNdc[0] + halfWidthNdc <= 1 &&
      centerNdc[1] - halfHeightNdc >= -1 &&
      centerNdc[1] + halfHeightNdc <= 1;
    // The body hides the Sun when the Sun's centre is behind the disc.
    const occluded = rayHitsSphereBefore(sunEye, bodyCenter, bodyRadius);
    sun = Object.freeze({
      visible: intersects && !occluded,
      classification: !intersects
        ? "outside-viewport"
        : occluded
          ? "behind-body"
          : fullyVisible ? "fully-visible" : "partially-visible",
      depth: sunDepth,
      eye: Object.freeze(sunEye),
      screen: Object.freeze([x, y]),
      centerNdc,
      spriteDiameter,
      discDiameter: 2 * plan.sun.radiusUnits * focal / sunDepth,
      // Billboard scale from the sprite raster to world units.
      spriteScale: plan.sun.sprite.worldDiameterUnits /
        plan.sun.sprite.imagePixels,
    });
  }

  // The orbit: each chord of the prepared ring, near-clipped, frustum-clipped
  // and cut where the body hides it, as screen-space segments.
  const vertices = plan.orbit.vertices;
  const eyes = vertices.map(toEye);
  const segments = [];
  const hidden = (eye) => rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
  for (let index = 0; index < eyes.length; index += 1) {
    let start = eyes[index];
    let end = eyes[(index + 1) % eyes.length];
    let startDepth = depthOf(start);
    let endDepth = depthOf(end);
    if (startDepth <= near && endDepth <= near) continue;
    if (startDepth <= near) {
      start = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
      startDepth = near;
    } else if (endDepth <= near) {
      end = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
      endDepth = near;
    }
    const startScreen = project(start);
    const endScreen = project(end);
    const window = clipSegmentToRectangle(
      startScreen,
      endScreen,
      clipX,
      clipY,
    );
    if (window === null) continue;
    // Screen fractions back to eye-space fractions (perspective-correct).
    const t0 = eyeFraction(window[0], startDepth, endDepth);
    const t1 = eyeFraction(window[1], startDepth, endDepth);
    const visibleStart = lerp(start, end, t0);
    const visibleEnd = lerp(start, end, t1);
    for (const [pieceStart, pieceEnd] of splitVisible(
      visibleStart,
      visibleEnd,
      hidden,
    )) {
      const [x0, y0] = project(pieceStart);
      const [x1, y1] = project(pieceEnd);
      if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
          !Number.isFinite(x1) || !Number.isFinite(y1)) continue;
      if (Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
      segments.push(Object.freeze([x0, y0, x1, y1]));
    }
  }

  return Object.freeze({
    focal,
    distance,
    near,
    viewportWidth,
    viewportHeight,
    principalOffset: Object.freeze([ox, oy]),
    body,
    sun,
    orbitSegments: Object.freeze(segments),
  });
}

// Distance at which the body's silhouette has the given on-screen radius
// across the off-axis direction (the tangential semi-axis).
export function distanceForSilhouetteRadius(
  bodyRadius,
  focal,
  screenRadius,
  principalOffset = [0, 0],
) {
  if (!positive(bodyRadius) || !positive(focal) || !positive(screenRadius)) {
    throw new TypeError("Silhouette framing arguments are invalid.");
  }
  const { cosTheta } = offAxisFrame(focal, principalOffset);
  const k = screenRadius / focal;
  const sinAlpha = k * cosTheta / Math.sqrt(1 + k * k);
  return bodyRadius / sinAlpha;
}

export function silhouetteRadiusAtDistance(
  bodyRadius,
  focal,
  distance,
  principalOffset = [0, 0],
) {
  return silhouetteEllipse(
    bodyRadius,
    focal,
    distance,
    offAxisFrame(focal, principalOffset),
  ).tangentialSemiAxis;
}

// The direction from the eye to the root's centre, `theta` off the view axis,
// and the unit screen direction from the principal point toward it.
function offAxisFrame(focal, [ox, oy]) {
  const offset = Math.hypot(ox, oy);
  const hypotenuse = Math.hypot(offset, focal);
  return Object.freeze({
    radial: offset > 1e-9 ? [-ox / offset, -oy / offset] : [0, 0],
    sinTheta: offset / hypotenuse,
    cosTheta: focal / hypotenuse,
    tanTheta: offset / focal,
  });
}

// The silhouette of a sphere `distance` from the eye, `theta` off the view
// axis, on the image plane `focal` away: semi-axes along and across the
// radial direction and the centre's outward shift from where the sphere's
// centre projects, all in CSS pixels.
function silhouetteEllipse(bodyRadius, focal, distance, axis) {
  const sinAlpha = bodyRadius / distance;
  const sin2Alpha = 2 * sinAlpha * Math.sqrt(1 - sinAlpha * sinAlpha);
  const sin2Theta = 2 * axis.sinTheta * axis.cosTheta;
  const denominator = axis.cosTheta * axis.cosTheta - sinAlpha * sinAlpha;
  if (!(denominator > 0)) {
    throw new RangeError("The body's silhouette leaves the image plane.");
  }
  const radialSemiAxis = focal * sin2Alpha / (2 * denominator);
  const tangentialSemiAxis = focal * sinAlpha / Math.sqrt(denominator);
  const centreShift = focal * sin2Theta / (2 * denominator) -
    focal * axis.tanTheta;
  return Object.freeze({
    radialSemiAxis,
    tangentialSemiAxis,
    // Unit screen direction of the radial axis (from the principal point).
    radial: Object.freeze([...axis.radial]),
    // Ellipse centre relative to the root's centre.
    centre: Object.freeze([
      centreShift * axis.radial[0],
      centreShift * axis.radial[1],
    ]),
  });
}

// Row-major 3x3 rotation from a CSS matrix3d (column-major m11.. m33): the
// linear part that maps a scene-frame direction into camera-root CSS space.
export function rotationFromMatrix3d(matrix) {
  return Object.freeze([
    matrix.m11, matrix.m21, matrix.m31,
    matrix.m12, matrix.m22, matrix.m32,
    matrix.m13, matrix.m23, matrix.m33,
  ]);
}

// True when the ray from the eye to `eye` (eye-space point) enters the sphere
// at `center` before reaching the point.
function rayHitsSphereBefore(eye, center, radius) {
  const a = dot(eye, eye);
  if (!(a > 0)) return false;
  const b = dot(eye, center);
  const c = dot(center, center) - radius * radius;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return false;
  const t = (b - Math.sqrt(discriminant)) / a;
  return t > 0 && t < 1;
}

// Cuts a segment into the pieces the sphere does not hide, by sampling and
// bisecting each visibility change.
function splitVisible(start, end, hidden) {
  const samples = 16;
  const flags = [];
  for (let index = 0; index <= samples; index += 1) {
    flags.push(hidden(lerp(start, end, index / samples)));
  }
  if (flags.every((flag) => !flag)) return [[start, end]];
  if (flags.every(Boolean)) return [];
  const pieces = [];
  let openAt = flags[0] ? null : 0;
  for (let index = 0; index < samples; index += 1) {
    if (flags[index] === flags[index + 1]) continue;
    let low = index / samples;
    let high = (index + 1) / samples;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (hidden(lerp(start, end, middle)) === flags[index]) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const boundary = (low + high) / 2;
    if (flags[index]) {
      openAt = boundary;
    } else {
      pieces.push([lerp(start, end, openAt), lerp(start, end, boundary)]);
      openAt = null;
    }
  }
  if (openAt !== null) pieces.push([lerp(start, end, openAt), end]);
  return pieces;
}

// Liang-Barsky against |x| <= clipX, |y| <= clipY; returns the screen-space
// parameter window or null.
function clipSegmentToRectangle(start, end, clipX, clipY) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, start[0] + clipX],
    [dx, clipX - start[0]],
    [-dy, start[1] + clipY],
    [dy, clipY - start[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

// A fraction along the projected segment corresponds to this fraction along
// the eye-space segment.
function eyeFraction(screenFraction, startDepth, endDepth) {
  if (screenFraction <= 0) return 0;
  if (screenFraction >= 1) return 1;
  return screenFraction * startDepth /
    (endDepth + screenFraction * (startDepth - endDepth));
}

function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function determinant(basis) {
  const [a, b, c] = basis;
  return dot(a, cross(b, c));
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

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function magnitude(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const length = magnitude(vector);
  if (!(length > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze([vector[0] / length, vector[1] / length, vector[2] / length]);
}

function round(value) {
  return Number(value.toFixed(6));
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function vector(value) {
  return Array.isArray(value) && value.length === 3 &&
    value.every(Number.isFinite);
}

function unit(value) {
  return vector(value) && Math.abs(Math.hypot(...value) - 1) < 1e-9;
}

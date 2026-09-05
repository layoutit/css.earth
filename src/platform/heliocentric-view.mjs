// A body's heliocentric neighbourhood as real geometry around the body: the
// Sun at its observed distance and the body's orbit as a true ellipse, both in
// the body-centred presentation frame the retained scene is prepared in, plus
// the camera-relative projection that puts them on screen. A plan may carry
// the rest of the planetary system (`plan.system`, prepared by
// prepare-planetary-system.mjs): the other planets' orbits as the same kind
// of vertex ring and their epoch positions as billboard markers, projected
// through the same camera on request.
//
// Preparation (`prepareHeliocentricView`, prepare-heliocentric-view.mjs) runs
// in the object's prepare tools and only transports orbital facts from the
// checked-in solar geometry into the scene frame; the vertex ring is static
// geometry prepared there. This module is runtime-only: it carries no solar
// geometry, so the shared runtime closure stays free of per-body catalogues.
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

export const PREPARED_HELIOCENTRIC_VIEW_SCHEMA =
  "cssearth-prepared-heliocentric-view@1";

// IAU 2015 resolution B3 nominal solar radius.
export const NOMINAL_SOLAR_RADIUS_KILOMETERS = 695700;

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
      !validTrail(plan.orbit.trail, plan.orbit.vertexCount) ||
      plan.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared heliocentric view is incompatible.");
  }
  if (plan.system !== undefined) validatePreparedPlanetarySystem(plan.system, plan);
  return plan;
}

export const PREPARED_PLANETARY_SYSTEM_SCHEMA =
  "cssearth-prepared-planetary-system@1";

export function validatePreparedPlanetarySystem(system, plan) {
  if (system?.schema !== PREPARED_PLANETARY_SYSTEM_SCHEMA ||
      system.observer !== plan.bodyId ||
      !vector(system.sun?.position) ||
      system.sun.position.some((component, index) =>
        Math.abs(component - plan.sun.position[index]) > 1e-3) ||
      !positive(system.maximumExtentUnits) ||
      !(system.maximumExtentUnits >= plan.orbit.maximumExtentUnits) ||
      !Array.isArray(system.bodies) || system.bodies.length === 0 ||
      system.bodies.some((body) =>
        !/^[a-z][a-z0-9-]*$/u.test(body?.id ?? "") || body.id === plan.bodyId ||
        !vector(body.position) || !positive(body.semiMajorAxisUnits) ||
        !unit(body.orbit?.normal) || !unit(body.orbit?.perihelionDirection) ||
        !Array.isArray(body.orbit.vertices) || body.orbit.vertices.length < 8 ||
        body.orbit.vertexCount !== body.orbit.vertices.length ||
        !body.orbit.vertices.every(vector) ||
        !validTrail(body.orbit.trail, body.orbit.vertexCount) ||
        !validIllumination(body.illumination) ||
        body.orbit.vertices[0].some((component, index) => component !== body.position[index])) ||
      new Set(system.bodies.map((body) => body.id)).size !== system.bodies.length ||
      system.runtimeGeometryDerivation !== false) {
    throw new TypeError("Prepared planetary system is incompatible.");
  }
  return system;
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
  system = false,
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
  const hidden = (eye) => rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
  // Only the trailing chords (weight above zero) are projected; each segment
  // carries its chord's trail weight as its opacity, so the line fades
  // backwards from the body and the leading half of the orbit is never drawn.
  const projectRing = (vertices, trail) => {
    const eyes = vertices.map(toEye);
    const segments = [];
    for (let index = 0; index < eyes.length; index += 1) {
      const weight = trail[index];
      if (!(weight > 0)) continue;
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
        segments.push(Object.freeze([x0, y0, x1, y1, weight]));
      }
    }
    return Object.freeze(segments);
  };
  const segments = projectRing(plan.orbit.vertices, plan.orbit.trail);

  // A point in the scene as a screen-space billboard: where it lands, and
  // whether it is in front of the camera, inside the viewport and not behind
  // the body.
  const projectPoint = (point) => {
    const eye = toEye(point);
    const depth = depthOf(eye);
    if (depth <= near) {
      return Object.freeze({ visible: false, classification: "behind-camera", depth, screen: null });
    }
    const [x, y] = project(eye);
    const inside = Math.abs(x) <= halfWidth && Math.abs(y) <= halfHeight;
    const occluded = rayHitsSphereBefore(eye, bodyCenter, bodyRadius);
    return Object.freeze({
      visible: inside && !occluded,
      classification: !inside ? "outside-viewport" : occluded ? "behind-body" : "visible",
      depth,
      screen: Object.freeze([x, y]),
    });
  };

  // The rest of the planetary system, only when asked for: below the fade-in
  // distance nothing is projected, so a near view costs what it did.
  let systemProjection = null;
  if (system && plan.system) {
    systemProjection = Object.freeze({
      sun: projectPoint(plan.system.sun.position),
      bodies: Object.freeze(plan.system.bodies.map((body) => Object.freeze({
        id: body.id,
        marker: projectPoint(body.position),
        orbitSegments: projectRing(body.orbit.vertices, body.orbit.trail),
      }))),
    });
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
    orbitSegments: segments,
    system: systemProjection,
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

export function determinant(basis) {
  const [a, b, c] = basis;
  return dot(a, cross(b, c));
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

export function magnitude(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector) {
  const length = magnitude(vector);
  if (!(length > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze([vector[0] / length, vector[1] / length, vector[2] / length]);
}

export function round(value) {
  return Number(value.toFixed(6));
}

export function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function vector(value) {
  return Array.isArray(value) && value.length === 3 &&
    value.every(Number.isFinite);
}

// Prepared illumination from the observer's vantage: a phase, the light's
// view depth for the lighting atlas, and the marker's brightness as opacity.
function validIllumination(illumination) {
  return Number.isFinite(illumination?.phaseAngleDegrees) &&
    illumination.phaseAngleDegrees >= 0 && illumination.phaseAngleDegrees <= 180 &&
    Number.isFinite(illumination.illuminatedFraction) &&
    illumination.illuminatedFraction >= 0 && illumination.illuminatedFraction <= 1 &&
    Number.isFinite(illumination.lightViewZ) && Math.abs(illumination.lightViewZ) <= 1 &&
    positive(illumination.markerOpacity) && illumination.markerOpacity <= 1;
}

// One weight per chord, each in [0, 1], the last chord (the one returning
// to the body) at full strength and at least one chord weightless: a trail,
// never a closed loop.
function validTrail(trail, vertexCount) {
  return Array.isArray(trail) && trail.length === vertexCount &&
    trail.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1) &&
    trail[trail.length - 1] > 0.9 && trail.some((weight) => weight === 0);
}

function unit(value) {
  return vector(value) && Math.abs(Math.hypot(...value) - 1) < 1e-9;
}

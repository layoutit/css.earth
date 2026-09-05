// Preparation of a body's heliocentric view (see heliocentric-view.mjs for
// the frames, units and the runtime projection). This runs in the object's
// prepare tools only: it transports the checked-in solar geometry (Sun
// direction, orbital elements) into the body-centred presentation frame and
// prepares the orbit's static vertex ring.

import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  requireBodyFixedOrbitNormal,
  requireBodyFixedSunDirection,
  requireHeliocentricOrbit,
} from "./solar-geometry.mjs";
import {
  NOMINAL_SOLAR_RADIUS_KILOMETERS,
  PREPARED_HELIOCENTRIC_VIEW_SCHEMA,
  validatePreparedPlanetarySystem,
  add,
  cross,
  determinant,
  dot,
  magnitude,
  normalize,
  positive,
  round,
  scale,
} from "./heliocentric-view.mjs";

const UNIFORM_ORBIT_SEGMENTS = 360;
// Chords right at the body are refined by halving so the polyline stays
// straight through the body as the camera closes in on it.
const LOCAL_REFINEMENT_HALVINGS = 8;

// The orbit is drawn as the path just travelled, not a closed loop: solid
// for `solidTurns` of an orbit behind the body, fading linearly to nothing
// across the following `fadeTurns`, and never drawn beyond that. With
// vertices in the direction of motion at eccentric-anomaly offsets
// `offsets` ahead of the body (offset 0 is the body, the last chord returns
// to it), a chord whose mid-offset is `delta` lies `2pi - delta` behind the
// body. The spans are prepared data (the look is tuned by eye), carried in
// the plan as `orbit.trailSpans`.
export const ORBIT_TRAIL_MODEL = "trailing-orbit-solid-then-linear-fade";
export const ORBIT_TRAIL_SPANS = Object.freeze({
  // Turns of the orbit behind the body drawn at full strength.
  solidTurns: 0.5,
  // Turns over which the line then fades to nothing.
  fadeTurns: 0.25,
});

export function orbitTrailWeights(offsets, spans = ORBIT_TRAIL_SPANS) {
  if (!Array.isArray(offsets) || offsets.length < 2 || offsets[0] !== 0 ||
      offsets.some((offset, index) => index > 0 && !(offset > offsets[index - 1])) ||
      !(offsets[offsets.length - 1] < 2 * Math.PI)) {
    throw new TypeError("Orbit trail offsets must ascend from zero within one turn.");
  }
  if (!(spans?.solidTurns >= 0) || !(spans.fadeTurns > 0) ||
      !(spans.solidTurns + spans.fadeTurns < 1)) {
    throw new TypeError("Orbit trail spans must leave part of the orbit undrawn.");
  }
  const solid = spans.solidTurns * 2 * Math.PI;
  const fade = spans.fadeTurns * 2 * Math.PI;
  return Object.freeze(offsets.map((offset, index) => {
    const next = index + 1 < offsets.length ? offsets[index + 1] : 2 * Math.PI;
    const behind = 2 * Math.PI - (offset + next) / 2;
    const weight = behind <= solid ? 1 : Math.max(0, 1 - (behind - solid) / fade);
    return Number(weight.toFixed(6));
  }));
}

export function prepareHeliocentricView({
  bodyId,
  presentationFrame,
  bodyRadiusUnits,
  bodyRadiusKilometers,
  sunSprite,
  // Optional: the rest of the planetary system around this body, prepared by
  // prepare-planetary-system.mjs in the same frame and units.
  system,
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
  const sortedOffsets = [...offsets].sort((a, b) => a - b);
  const vertices = sortedOffsets.map((offset, index) =>
    index === 0
      ? Object.freeze([0, 0, 0])
      : Object.freeze(pointAt(bodyEccentricAnomaly + offset).map(round)));
  const trail = orbitTrailWeights(sortedOffsets);
  const maximumExtentUnits = vertices.reduce(
    (extent, vertex) => Math.max(extent, magnitude(vertex)),
    0,
  );
  const sunRadiusUnits = NOMINAL_SOLAR_RADIUS_KILOMETERS / kilometersPerUnit;
  const plan = Object.freeze({
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
      // The trail: one weight per chord (chord k joins vertex k to k + 1).
      trail,
      trailModel: ORBIT_TRAIL_MODEL,
      trailSpans: ORBIT_TRAIL_SPANS,
      uniformSegments: UNIFORM_ORBIT_SEGMENTS,
      localRefinementHalvings: LOCAL_REFINEMENT_HALVINGS,
      maximumExtentUnits,
    }),
    ...(system === undefined ? {} : { system }),
    runtimeGeometryDerivation: false,
  });
  if (system !== undefined) {
    // The system was resolved through the frame tree from the same geometry;
    // its Sun and units must agree with this plan's or the two describe
    // different scenes.
    if (Math.abs(system.units?.kilometersPerUnit - kilometersPerUnit) > 1e-9 * kilometersPerUnit) {
      throw new RangeError("The planetary system was prepared in other units than the heliocentric view.");
    }
    validatePreparedPlanetarySystem(system, plan);
  }
  return plan;
}

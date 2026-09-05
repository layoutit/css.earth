// Preparation of the planetary system around an observer body: every other
// planet's position at the pinned epoch and its heliocentric orbit as a true
// ellipse, in the observer's body-centred presentation frame and scene units,
// ready for the same camera-relative projection the observer's own orbit and
// Sun go through (heliocentric-view.mjs).
//
// Position model. Positions are resolved through the astronomy package's
// `FrameTree`: a root Sun frame in astronomical units with one child frame per
// planet in kilometres, each fixed at the planet's heliocentric ICRF position
// at the epoch (the frames share ICRF axes and are translation-only). Every
// planet is then resolved *relative to the observer's frame*, so no absolute
// coordinate is ever formed; float64 alone would carry the solar system, but
// keeping the tree and the unit ladder (`M_PER_AU`, `M_PER_KM`) means a
// later interstellar layer is one more frame above the Sun rather than a
// rewrite of this module. The orbital facts themselves come from the
// checked-in solar geometry (VSOP87A state vectors at the epoch), expressed
// per body in that body's own frame; the checked-in body-fixed-to-ICRF
// rotations bring them into one frame. This runs in the object's prepare
// tools only, through the package's build (astronomy-package.mjs); the
// runtime only transports the result.

import { loadAstronomyPackage } from "./astronomy-package.mjs";
import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  BODY_FIXED_ORBIT_NORMAL_DIRECTIONS,
  BODY_FIXED_SUN_DIRECTIONS,
  BODY_FIXED_TO_ICRF_MATRICES,
  HELIOCENTRIC_ORBITS,
  SOLAR_GEOMETRY_EPOCH_JD_TT,
  SOLAR_GEOMETRY_EPOCH_LABEL,
} from "./solar-geometry.mjs";
import { ORBIT_TRAIL_MODEL, ORBIT_TRAIL_SPANS, orbitTrailWeights } from "./prepare-heliocentric-view.mjs";
import {
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

export const PREPARED_PLANETARY_SYSTEM_SCHEMA =
  "cssearth-prepared-planetary-system@1";

// The eight planets, innermost first: the order the rings must nest in.
export const PLANETARY_SYSTEM_BODIES = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);

// Uniform chords per ring. The other planets' orbits are seen from far away
// (they fade in only once the observer's whole orbit fits the view), so a
// third of the observer's own ring resolution keeps every chord's sagitta
// below a fifth of a pixel at the largest on-screen radius while the retained
// pool stays under a thousand pieces.
export const SYSTEM_ORBIT_SEGMENTS = 120;

// Geometric albedos, NASA planetary fact sheet (dwarf planets: JPL SBDB /
// occultation literature). With the mean radii from the astronomy package's
// body table these are the only non-geometric inputs of the brightness
// model; everything else is the epoch's geometry.
export const GEOMETRIC_ALBEDO = Object.freeze({
  mercury: 0.142, venus: 0.689, earth: 0.434, mars: 0.170,
  jupiter: 0.538, saturn: 0.499, uranus: 0.488, neptune: 0.442,
  pluto: 0.52, ceres: 0.09, eris: 0.96, haumea: 0.80, makemake: 0.81,
});

// Illumination and brightness are as seen from the observer body, not from
// the dolly's eye: the scene is the observer's sky and the far dolly is a
// presentational vantage. (From the eye at the pole-on far bound every
// planet would sit at quadrature, half-lit, which reads as wrong and is
// not what the object's neighbourhood shows.) The phase angle is
// Sun-body-observer; the illuminated fraction is (1 + cos alpha) / 2; the
// flux is p R^2 Phi(alpha) / (r^2 d^2) with a Lambert-sphere phase function,
// relative to the brightest body. The marker's opacity is that flux on a
// magnitude scale: opaque for the brightest, falling linearly in magnitudes
// to a floor at `magnitudeRange` below it, so a faint body stays findable
// but never as visible as a bright one.
export const MARKER_BRIGHTNESS = Object.freeze({
  model: "observer-vantage-lambert-flux-magnitude-opacity",
  floor: 0.3,
  magnitudeRange: 12.5,
});

export function lambertPhaseFunction(alphaRadians) {
  return ((Math.PI - alphaRadians) * Math.cos(alphaRadians) + Math.sin(alphaRadians)) / Math.PI;
}

export function markerOpacityForMagnitudes(magnitudesBelowBrightest) {
  const share = Math.max(0, Math.min(1, 1 - magnitudesBelowBrightest / MARKER_BRIGHTNESS.magnitudeRange));
  return Number((MARKER_BRIGHTNESS.floor + (1 - MARKER_BRIGHTNESS.floor) * share).toFixed(4));
}

export async function preparePlanetarySystem({
  bodyId,
  presentationFrame,
  kilometersPerUnit,
  bodies = PLANETARY_SYSTEM_BODIES,
  astronomy = null,
}) {
  if (!/^[a-z][a-z0-9-]*$/u.test(bodyId ?? "") ||
      typeof presentationFrame?.toPresentation !== "function" ||
      !Array.isArray(presentationFrame.basis) ||
      !positive(kilometersPerUnit) ||
      !Array.isArray(bodies) || !bodies.includes(bodyId) ||
      bodies.some((id) => !HELIOCENTRIC_ORBITS[id] || !(GEOMETRIC_ALBEDO[id] > 0))) {
    throw new TypeError("Planetary system preparation arguments are invalid.");
  }
  if (Math.abs(determinant(presentationFrame.basis) - 1) > 1e-9) {
    throw new RangeError(
      "The presentation frame must be a proper rotation for orbital cross " +
        "products to survive the change of frame.",
    );
  }
  const {
    FrameTree,
    fixedFrame,
    ZERO,
    M_PER_AU,
    M_PER_KM,
    BODIES,
  } = astronomy ?? await loadAstronomyPackage();
  if (Math.abs(M_PER_AU / M_PER_KM - ASTRONOMICAL_UNIT_KILOMETERS) > 1e-6) {
    throw new RangeError("The astronomy unit ladder disagrees with the IAU 2012 au.");
  }

  // Heliocentric ICRF positions from the checked-in geometry: each body's
  // Sun direction is in its own frame, its rotation takes it to ICRF.
  const heliocentricIcrfAu = (id) => {
    const toSun = applyMatrix(BODY_FIXED_TO_ICRF_MATRICES[id], BODY_FIXED_SUN_DIRECTIONS[id]);
    return scale(toSun, -HELIOCENTRIC_ORBITS[id].heliocentricDistanceAu);
  };

  // The frame tree: the Sun in au, every planet in km inside it. The tree's
  // own invariants (a child's exit ball inside its parent's, a body's capture
  // ball inside its own exit ball) are checked on `add`.
  const tree = new FrameTree();
  tree.add(fixedFrame("sun", null, M_PER_AU, ZERO, BODIES.sun.meanRadiusKm * M_PER_KM));
  for (const id of bodies) {
    tree.add(fixedFrame(
      id,
      "sun",
      M_PER_KM,
      heliocentricIcrfAu(id),
      BODIES[id].meanRadiusKm * M_PER_KM,
    ));
  }
  const epoch = SOLAR_GEOMETRY_EPOCH_JD_TT;
  // ICRF offset from the observer in km, resolved through the tree: the two
  // chains meet at the Sun frame and are differenced there.
  const resolveKilometers = (id) =>
    tree.resolve(bodyId, { frame: id, offset: ZERO }, epoch);

  // ICRF (km, observer-relative) into the observer's presentation frame in
  // scene units. Both steps are rotations, so lengths carry over.
  const observerToBodyFixed = transposeMatrix(BODY_FIXED_TO_ICRF_MATRICES[bodyId]);
  const toScene = (icrfKilometers) => scale(
    presentationFrame.toPresentation(applyMatrix(observerToBodyFixed, icrfKilometers)),
    1 / kilometersPerUnit,
  );
  const directionToScene = (id, bodyFixedDirection) => normalize(
    presentationFrame.toPresentation(applyMatrix(
      observerToBodyFixed,
      applyMatrix(BODY_FIXED_TO_ICRF_MATRICES[id], bodyFixedDirection),
    )),
  );
  const unitsPerAu = ASTRONOMICAL_UNIT_KILOMETERS / kilometersPerUnit;

  const sunPosition = toScene(resolveKilometers("sun"));
  // The observer's own Sun direction, straight from the geometry, must be
  // what the tree resolves; otherwise the tree and the direction disagree
  // about which epoch or frame they describe.
  const sunFromGeometry = scale(
    normalize(presentationFrame.toPresentation(BODY_FIXED_SUN_DIRECTIONS[bodyId])),
    HELIOCENTRIC_ORBITS[bodyId].heliocentricDistanceAu * unitsPerAu,
  );
  const sunResidual = magnitude(subtract(sunPosition, sunFromGeometry));
  if (sunResidual > 1e-6 * magnitude(sunFromGeometry)) {
    throw new RangeError(
      `${bodyId}: the frame tree places the Sun ${sunResidual} units from the ` +
        "prepared Sun direction.",
    );
  }

  const others = bodies.filter((id) => id !== bodyId).map((id) => {
    const orbit = HELIOCENTRIC_ORBITS[id];
    const position = toScene(resolveKilometers(id));
    const normal = directionToScene(id, BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[id]);
    const perihelionDirection = directionToScene(id, orbit.perihelionDirection);
    if (Math.abs(dot(normal, perihelionDirection)) > 1e-9) {
      throw new RangeError(`${id}: perihelion direction is not in the orbital plane.`);
    }
    const perihelionMotion = normalize(cross(normal, perihelionDirection));
    const semiMajorAxisUnits = orbit.semiMajorAxisAu * unitsPerAu;
    const eccentricity = orbit.eccentricity;
    const semiMinorAxisUnits = semiMajorAxisUnits * Math.sqrt(1 - eccentricity * eccentricity);
    const center = add(sunPosition, scale(perihelionDirection, -semiMajorAxisUnits * eccentricity));
    const majorAxis = scale(perihelionDirection, semiMajorAxisUnits);
    const minorAxis = scale(perihelionMotion, semiMinorAxisUnits);
    const pointAt = (eccentricAnomaly) => add(
      center,
      add(scale(majorAxis, Math.cos(eccentricAnomaly)), scale(minorAxis, Math.sin(eccentricAnomaly))),
    );
    const trueAnomaly = orbit.trueAnomalyDegrees * Math.PI / 180;
    const bodyEccentricAnomaly = 2 * Math.atan2(
      Math.sqrt(1 - eccentricity) * Math.sin(trueAnomaly / 2),
      Math.sqrt(1 + eccentricity) * Math.cos(trueAnomaly / 2),
    );
    // The ellipse from the elements must pass through the position the tree
    // resolved from the Sun direction: two derivations of one state vector.
    const ringResidual = magnitude(subtract(pointAt(bodyEccentricAnomaly), position));
    if (ringResidual > 1e-6 * semiMajorAxisUnits) {
      throw new RangeError(
        `${id}: the body is ${ringResidual} units off its own orbit around ` +
          `${bodyId}; the orbital facts disagree with the Sun direction.`,
      );
    }
    const step = 2 * Math.PI / SYSTEM_ORBIT_SEGMENTS;
    // Closed ring in the direction of motion, vertex 0 exactly at the body.
    // Whole units: one unit is a few kilometres against tens of au, so the
    // rounding is below 1e-7 relative and the prepared module stays small.
    const vertices = Object.freeze(Array.from({ length: SYSTEM_ORBIT_SEGMENTS }, (_, index) =>
      Object.freeze((index === 0 ? position : pointAt(bodyEccentricAnomaly + index * step)).map(Math.round))));
    const trail = orbitTrailWeights(Array.from({ length: SYSTEM_ORBIT_SEGMENTS }, (_, index) => index * step));
    // Illumination from the observer (at the origin): Sun-body-observer.
    const toSun = subtract(sunPosition, position);
    const toObserver = scale(position, -1);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1,
      dot(toSun, toObserver) / (magnitude(toSun) * magnitude(toObserver)))));
    const fluxKm = GEOMETRIC_ALBEDO[id] * BODIES[id].meanRadiusKm ** 2 * lambertPhaseFunction(phaseAngle) /
      ((magnitude(toSun) * kilometersPerUnit) ** 2 * (magnitude(toObserver) * kilometersPerUnit) ** 2);
    return Object.freeze({
      id,
      radiusKilometers: BODIES[id].meanRadiusKm,
      illumination: {
        model: MARKER_BRIGHTNESS.model,
        phaseAngleDegrees: phaseAngle * 180 / Math.PI,
        illuminatedFraction: (1 + Math.cos(phaseAngle)) / 2,
        // The light's view-space depth for the lighting atlas: +1 fully lit.
        lightViewZ: Math.cos(phaseAngle),
        geometricAlbedo: GEOMETRIC_ALBEDO[id],
        flux: fluxKm,
      },
      position: Object.freeze(position.map(Math.round)),
      distanceUnits: magnitude(position),
      heliocentricDistanceAu: orbit.heliocentricDistanceAu,
      semiMajorAxisAu: orbit.semiMajorAxisAu,
      semiMajorAxisUnits,
      semiMinorAxisUnits,
      eccentricity,
      inclinationDegrees: orbit.inclinationDegrees,
      perihelionAu: orbit.perihelionAu,
      aphelionAu: orbit.aphelionAu,
      trueAnomalyDegrees: orbit.trueAnomalyDegrees,
      orbit: Object.freeze({
        normal,
        perihelionDirection,
        center: Object.freeze(center.map(Math.round)),
        vertices,
        vertexCount: vertices.length,
        trail,
        trailModel: ORBIT_TRAIL_MODEL,
        trailSpans: ORBIT_TRAIL_SPANS,
        uniformSegments: SYSTEM_ORBIT_SEGMENTS,
      }),
    });
  });
  // Brightness relative to the brightest body, as marker opacity.
  const brightestFlux = others.reduce((peak, body) => Math.max(peak, body.illumination.flux), 0);
  const bodiesWithBrightness = others.map((body) => {
    const magnitudesBelowBrightest = -2.5 * Math.log10(body.illumination.flux / brightestFlux);
    return Object.freeze({
      ...body,
      illumination: Object.freeze({
        ...body.illumination,
        fluxShareOfBrightest: body.illumination.flux / brightestFlux,
        magnitudesBelowBrightest,
        markerOpacity: markerOpacityForMagnitudes(magnitudesBelowBrightest),
      }),
    });
  });
  // Nesting: consecutive orbits, innermost first, never cross when every
  // point of the outer one is farther from the Sun than every point of the
  // inner one (perihelion beyond aphelion). True of the eight planets; a
  // wrong element would break it here rather than on screen.
  const ordered = bodies.map((id) => HELIOCENTRIC_ORBITS[id]);
  for (let index = 1; index < ordered.length; index += 1) {
    if (!(ordered[index].perihelionAu > ordered[index - 1].aphelionAu)) {
      throw new RangeError(
        `${bodies[index]} (perihelion ${ordered[index].perihelionAu} au) does ` +
          `not lie outside ${bodies[index - 1]} (aphelion ${ordered[index - 1].aphelionAu} au).`,
      );
    }
  }
  const maximumExtentUnits = bodiesWithBrightness.reduce(
    (extent, body) => body.orbit.vertices.reduce(
      (inner, vertex) => Math.max(inner, magnitude(vertex)),
      Math.max(extent, body.distanceUnits),
    ),
    magnitude(sunPosition),
  );
  return Object.freeze({
    schema: PREPARED_PLANETARY_SYSTEM_SCHEMA,
    model: "frame-tree-resolved-epoch-positions-and-true-ellipses",
    positionModel: Object.freeze({
      frameTree: "@cssearth/astronomy FrameTree",
      rootFrame: "sun",
      rootUnit: "au",
      bodyUnit: "km",
      observerFrame: bodyId,
      axes: "icrf-translation-only",
    }),
    observer: bodyId,
    epochJdTt: epoch,
    epochLabel: SOLAR_GEOMETRY_EPOCH_LABEL,
    units: Object.freeze({ kilometersPerUnit, unitsPerAu }),
    sun: Object.freeze({ position: Object.freeze(sunPosition.map(round)) }),
    bodies: Object.freeze(bodiesWithBrightness),
    markerBrightness: MARKER_BRIGHTNESS,
    maximumExtentUnits,
    runtimeGeometryDerivation: false,
  });
}

function applyMatrix(matrix, [x, y, z]) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

function transposeMatrix(matrix) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

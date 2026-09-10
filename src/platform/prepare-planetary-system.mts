import sn263Photometry from "../planets/asteroid-2001-sn263/source/preparation/photometry.json" with { type: "json" };
import type { Vector3, Matrix3 } from "../renderers/css/solar-system/types.ts";
import type { BodyId, PlanetId, DwarfPlanetId, SmallBodyId, CometId, KeplerianElements } from "@cssearth/astronomy";
import type { HeliocentricPreparationOptions } from "./prepare-heliocentric-view.mts";
export interface PlanetarySystemPreparationOptions {
  bodyId: BodyId; presentationFrame: HeliocentricPreparationOptions["presentationFrame"];
  kilometersPerUnit: number; bodies?: readonly PlanetId[]; dwarfPlanets?: readonly DwarfPlanetId[];
  asteroids?: readonly SmallBodyId[]; astronomy?: typeof import("@cssearth/astronomy") | null;
}
const isArray = (value: unknown): boolean => Array.isArray(value);
const isIncluded = <T extends string>(ids: readonly T[], id: string | null | undefined): id is T => ids.some(candidate => candidate === id);
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

import dinkineshPhotometry from "../planets/dinkinesh/source/preparation/photometry.json" with { type: "json" };
import idaPhotometry from "../planets/ida/source/preparation/photometry.json" with { type: "json" };
import { loadAstronomyPackage } from "./astronomy-package.mts";
import { preparePlanetPoint } from "./prepare-planet-points.mts";
import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  BODY_FIXED_ORBIT_NORMAL_DIRECTIONS,
  BODY_FIXED_SUN_DIRECTIONS,
  BODY_FIXED_TO_ICRF_MATRICES,
  BODY_ORBITS,
  BODY_HELIOCENTRIC_STATES,
  SOLAR_GEOMETRY_EPOCH_JD_TT,
  SOLAR_GEOMETRY_EPOCH_LABEL,
} from "./solar-geometry.mts";
import { ORBIT_TRAIL_MODEL, ORBIT_TRAIL_SPANS, chordBehindTurns } from "./prepare-heliocentric-view.mts";
import {
  trailWeightsForSpans,
  add,
  cross,
  determinant,
  dot,
  magnitude,
  normalize,
  positive,
  round,
  scale,
} from "./heliocentric-view.mts";

export const PREPARED_PLANETARY_SYSTEM_SCHEMA =
  "cssearth-prepared-planetary-system@1";

// The eight planets, innermost first: the order the rings must nest in.
export const PLANETARY_SYSTEM_BODIES: readonly PlanetId[] = Object.freeze([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]);
// The five dwarf planets, by semi-major axis. Their orbits come from the
// astronomy package's JPL Horizons osculating elements (ICRF, heliocentric,
// one epoch) rather than the VSOP87 state vectors, and they are not held to
// nest: Pluto's crosses Neptune's, which is real and shown.
export const DWARF_PLANET_BODIES: readonly DwarfPlanetId[] = Object.freeze(["ceres", "pluto", "haumea", "makemake", "eris"]);

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
export const GEOMETRIC_ALBEDO: Readonly<Record<string, number>> = Object.freeze({
  mercury: 0.142, venus: 0.689, earth: 0.434, mars: 0.170,
  jupiter: 0.538, saturn: 0.499, uranus: 0.488, neptune: 0.442,
  // Didymos system visible geometric albedo 0.15 ± 0.02: Daly et al. (2023),
  // https://www.nature.com/articles/s41586-023-05810-5; approximate point photometry.
  didymos: 0.15,
  // Object-owned system-average estimate, used only for parent point photometry.
  "asteroid-2001-sn263": sn263Photometry.geometricAlbedo,
  dinkinesh: dinkineshPhotometry.geometricAlbedo,
  ida: idaPhotometry.geometricAlbedo,
  // Parent context only: common-system geometric albedos, not mapped surface colors.
  // Scheirich et al.2021 Table4; JPL SBDB Grav2012/Mainzer2014, pinned in https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b1-preparation/parent-inputs.json.
  moshup: 0.162, sylvia: 0.046, patroclus: 0.047,
  // Assumed geometric albedo, not a measurement: Mashchenko (2019), section 4,
  // https://doi.org/10.1093/mnras/stz2378. Used only for approximate marker photometry.
  oumuamua: 0.1,
  pluto: 0.52, ceres: 0.09, eris: 0.96, haumea: 0.80, makemake: 0.81, vesta: 0.4228,
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

export function lambertPhaseFunction(alphaRadians: number) {
  return ((Math.PI - alphaRadians) * Math.cos(alphaRadians) + Math.sin(alphaRadians)) / Math.PI;
}

export function markerOpacityForMagnitudes(magnitudesBelowBrightest: number) {
  const share = Math.max(0, Math.min(1, 1 - magnitudesBelowBrightest / MARKER_BRIGHTNESS.magnitudeRange));
  return Number((MARKER_BRIGHTNESS.floor + (1 - MARKER_BRIGHTNESS.floor) * share).toFixed(4));
}

export async function preparePlanetarySystem({
  bodyId,
  presentationFrame,
  kilometersPerUnit,
  bodies = PLANETARY_SYSTEM_BODIES,
  dwarfPlanets = DWARF_PLANET_BODIES,
  asteroids = [],
  astronomy = null,
}: PlanetarySystemPreparationOptions) {
  if (!/^[a-z][a-z0-9-]*$/u.test(bodyId ?? "") ||
      typeof presentationFrame?.toPresentation !== "function" ||
      !Array.isArray(presentationFrame.basis) ||
      !positive(kilometersPerUnit) ||
      !isArray(bodies) || !BODY_ORBITS[bodyId] ||
      !BODY_FIXED_TO_ICRF_MATRICES[bodyId] ||
      bodies.some((id) => !BODY_ORBITS[id] || !(GEOMETRIC_ALBEDO[id] > 0)) ||
      !isArray(dwarfPlanets) || dwarfPlanets.some((id) => !(GEOMETRIC_ALBEDO[id] > 0)) ||
      dwarfPlanets.some((id) => isIncluded(bodies, id))) {
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
    FRAME_EXIT_BALL_UNITS,
    BODIES,
    DWARF_PLANET_IDS,
    dwarfPlanetElements,
    dwarfPlanetPositionKm,
    SMALL_BODY_IDS,
    TRANS_NEPTUNIAN_IDS = [],
    INTERSTELLAR_IDS = [],
    asteroidElements,
    asteroidPositionKm,
    COMET_IDS = [],
    cometElements,
    cometPositionKm,
  } = astronomy ?? await loadAstronomyPackage();
  if (!isArray(asteroids) || asteroids.some(id => !isIncluded(SMALL_BODY_IDS, id)) ||
      new Set([...bodies, ...dwarfPlanets, ...asteroids]).size !== bodies.length + dwarfPlanets.length + asteroids.length) {
    throw new TypeError('Unknown or duplicate asteroid in planetary system.');
  }
  // A selected heliocentric small body participates in the same system even
  // when it is not one of the context objects requested by a different scene.
  const smallBodies: (SmallBodyId | CometId)[] = [...asteroids];
  if (isIncluded([...SMALL_BODY_IDS, ...COMET_IDS], bodyId) && !isIncluded(smallBodies, bodyId)) smallBodies.push(bodyId);
  const smallBodyPosition = (id: SmallBodyId | CometId, epoch: number) => isIncluded(COMET_IDS, id) ? cometPositionKm(id, epoch) : asteroidPositionKm(id, epoch);
  const smallBodyElements = (id: SmallBodyId | CometId) => isIncluded(COMET_IDS, id) ? cometElements(id) : asteroidElements(id);
  if (dwarfPlanets.some((id) => !isIncluded(DWARF_PLANET_IDS, id))) {
    throw new TypeError("An unknown dwarf planet was requested.");
  }
  if (Math.abs(M_PER_AU / M_PER_KM - ASTRONOMICAL_UNIT_KILOMETERS) > 1e-6) {
    throw new RangeError("The astronomy unit ladder disagrees with the IAU 2012 au.");
  }

  // Heliocentric ICRF positions from the checked-in geometry: each body's
  // Sun direction is in its own frame, its rotation takes it to ICRF.
  const heliocentricIcrfAu = (id: BodyId) => {
    const toSun = applyMatrix(BODY_FIXED_TO_ICRF_MATRICES[id], BODY_FIXED_SUN_DIRECTIONS[id]);
    return scale(toSun, -BODY_ORBITS[id].heliocentricDistanceAu);
  };

  // A satellite's heliocentric asteroid parent is required even when the
  // caller did not request additional context asteroids.
  const centerBodyId = BODY_ORBITS[bodyId].centerBodyId;
  if (isIncluded(SMALL_BODY_IDS, centerBodyId) && !isIncluded(smallBodies, centerBodyId)) smallBodies.push(centerBodyId);
  const satelliteObserver = !([...bodies, ...dwarfPlanets, ...smallBodies] as readonly string[]).includes(bodyId);
  const observerUnitMeters = satelliteObserver ? M_PER_KM / 10 : M_PER_KM;
  const parent = satelliteObserver ? BODY_ORBITS[bodyId].centerBodyId : null;
  if (satelliteObserver && !isIncluded([...bodies, ...dwarfPlanets, ...smallBodies], parent)) throw new TypeError("Observer parent is absent from the planetary system.");
  const observerPositionKm = satelliteObserver ? scale(
    applyMatrix(BODY_FIXED_TO_ICRF_MATRICES[bodyId], BODY_ORBITS[bodyId].centerPositionAu!),
    -ASTRONOMICAL_UNIT_KILOMETERS) : null;
  // Enclose the moon's fixed position AND its exit ball. Keep kilometre units
  // where they fit; wider satellite orbits require a coarser parent frame.
  // Rounding up to whole kilometres avoids a floating-point boundary equality.
  const parentUnitMeters = satelliteObserver ? M_PER_KM * Math.max(1, Math.ceil(
    (magnitude(observerPositionKm!) + FRAME_EXIT_BALL_UNITS * observerUnitMeters / M_PER_KM) / FRAME_EXIT_BALL_UNITS)) : M_PER_KM;

  // The frame tree: the Sun in au, planets in their prepared local units. The tree's
  // own invariants (a child's exit ball inside its parent's, a body's capture
  // ball inside its own exit ball) are checked on `add`.
  const tree = new FrameTree();
  tree.add(fixedFrame("sun", null, M_PER_AU, ZERO, BODIES.sun.meanRadiusKm * M_PER_KM));
  for (const id of bodies) {
    tree.add(fixedFrame(
      id,
      "sun",
      id === parent ? parentUnitMeters : M_PER_KM,
      BODY_HELIOCENTRIC_STATES[id]
        ? scale(BODY_HELIOCENTRIC_STATES[id].positionKm, 1 / ASTRONOMICAL_UNIT_KILOMETERS)
        : heliocentricIcrfAu(id),
      BODIES[id].meanRadiusKm * M_PER_KM,
    ));
  }
  // Dwarf planets: the package's own Keplerian position at the epoch (km,
  // ICRF, heliocentric), as one more km frame each under the Sun.
  for (const id of [...dwarfPlanets, ...smallBodies]) {
    tree.add(fixedFrame(
      id,
      "sun",
      id === parent ? parentUnitMeters : M_PER_KM,
      scale(BODY_HELIOCENTRIC_STATES[id]
        ? BODY_HELIOCENTRIC_STATES[id].positionKm
        : (isIncluded(smallBodies, id) ? smallBodyPosition(id, SOLAR_GEOMETRY_EPOCH_JD_TT) : dwarfPlanetPositionKm(id, SOLAR_GEOMETRY_EPOCH_JD_TT)), 1 / ASTRONOMICAL_UNIT_KILOMETERS),
      BODIES[id].meanRadiusKm * M_PER_KM,
    ));
  }
  if (satelliteObserver) {
    // A moon uses 100 m units under its parent's prepared frame, with
    // enough capture radius for a resolved satellite.
    tree.add(fixedFrame(bodyId, parent ?? null, observerUnitMeters,
      scale(observerPositionKm!, M_PER_KM / parentUnitMeters), BODIES[bodyId].meanRadiusKm * M_PER_KM));
  }
  const epoch = SOLAR_GEOMETRY_EPOCH_JD_TT;
  // ICRF offset from the observer in km, resolved through the tree: the two
  // chains meet at the Sun frame and are differenced there.
  const resolveKilometers = (id: BodyId) => scale(
    tree.resolve(bodyId, { frame: id, offset: ZERO }, epoch), observerUnitMeters / M_PER_KM);

  // ICRF (km, observer-relative) into the observer's presentation frame in
  // scene units. Both steps are rotations, so lengths carry over.
  const observerToBodyFixed = transposeMatrix(BODY_FIXED_TO_ICRF_MATRICES[bodyId]);
  const toScene = (icrfKilometers: Vector3) => scale(
    presentationFrame.toPresentation(applyMatrix(observerToBodyFixed, icrfKilometers)),
    1 / kilometersPerUnit,
  );
  const directionToScene = (id: BodyId, bodyFixedDirection: Vector3) => normalize(
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
    BODY_ORBITS[bodyId].heliocentricDistanceAu * unitsPerAu,
  );
  const sunResidual = magnitude(subtract(sunPosition, sunFromGeometry));
  if (sunResidual > 1e-6 * magnitude(sunFromGeometry)) {
    throw new RangeError(
      `${bodyId}: the frame tree places the Sun ${sunResidual} units from the ` +
        "prepared Sun direction.",
    );
  }

  // ICRF directions (already in the common frame) into the presentation
  // frame, for the dwarf planets' elements.
  const icrfDirectionToScene = (direction: Vector3) => normalize(
    presentationFrame.toPresentation(applyMatrix(observerToBodyFixed, direction)),
  );
  // Orbit orientation from Keplerian angles: the ascending node about ICRF
  // +z, the inclination about the node line, the argument of periapsis in
  // the orbital plane. The normal is the angular momentum direction (the
  // motion is prograde by construction), the perihelion direction the
  // eccentricity vector's.
  const keplerOrientation = ({ inclinationRad, ascendingNodeRad, argumentOfPeriapsisRad }: KeplerianElements) => {
    const cosO = Math.cos(ascendingNodeRad), sinO = Math.sin(ascendingNodeRad);
    const cosI = Math.cos(inclinationRad), sinI = Math.sin(inclinationRad);
    const cosW = Math.cos(argumentOfPeriapsisRad), sinW = Math.sin(argumentOfPeriapsisRad);
    return {
      normalIcrf: [sinO * sinI, -cosO * sinI, cosI],
      perihelionIcrf: [
        cosO * cosW - sinO * sinW * cosI,
        sinO * cosW + cosO * sinW * cosI,
        sinW * sinI,
      ],
    };
  };
  const orbitFacts = (id: BodyId) => {
    if (BODY_HELIOCENTRIC_STATES[id]) {
      // A primary-specific ephemeris can differ from the package's older
      // barycentric conic. Derive this one osculating ellipse from the SAME
      // position and velocity used by the frame tree, at the prepared epoch.
      // All observers share this canonical state and its osculating conic.
      const { semiMajorAxisKm, eccentricity, normalIcrf, perihelionIcrf } =
        heliocentricOrbitFromState(BODY_HELIOCENTRIC_STATES[id], BODIES.sun.gravitationalParameterKm3PerS2);
      return {
        kind: isIncluded(INTERSTELLAR_IDS, id) ? 'interstellar' : isIncluded(COMET_IDS, id) ? 'comet' : isIncluded(TRANS_NEPTUNIAN_IDS, id) ? 'trans-neptunian' : isIncluded(smallBodies, id) ? 'asteroid' : isIncluded(dwarfPlanets, id) ? 'dwarf-planet' : 'planet',
        semiMajorAxisAu: semiMajorAxisKm / ASTRONOMICAL_UNIT_KILOMETERS,
        eccentricity,
        inclinationDegrees: Math.acos(Math.max(-1, Math.min(1, normalIcrf[2]))) * 180 / Math.PI,
        inclinationReference: "icrf-equator",
        normal: icrfDirectionToScene(normalIcrf),
        perihelionDirection: icrfDirectionToScene(perihelionIcrf),
        trueAnomalyDegrees: null,
        source: "source-primary-state-vector-via-solar-geometry",
      };
    }
    if (isIncluded(dwarfPlanets, id) || isIncluded(smallBodies, id)) {
      const elements = (isIncluded(dwarfPlanets, id) ? dwarfPlanetElements(id) : smallBodyElements(id as SmallBodyId | CometId));
      const { normalIcrf, perihelionIcrf } = keplerOrientation(elements);
      return {
        kind: isIncluded(INTERSTELLAR_IDS, id) ? 'interstellar' : isIncluded(COMET_IDS, id) ? 'comet' : isIncluded(TRANS_NEPTUNIAN_IDS, id) ? 'trans-neptunian' : isIncluded(smallBodies, id) ? 'asteroid' : 'dwarf-planet',
        semiMajorAxisAu: elements.semiMajorAxisKm / ASTRONOMICAL_UNIT_KILOMETERS,
        eccentricity: elements.eccentricity,
        inclinationDegrees: elements.inclinationRad * 180 / Math.PI,
        inclinationReference: "icrf-equator",
        normal: icrfDirectionToScene(normalIcrf),
        perihelionDirection: icrfDirectionToScene(perihelionIcrf),
        // The true anomaly follows from the position below.
        trueAnomalyDegrees: null,
        source: "jpl-horizons-osculating-elements-via-astronomy-package",
      };
    }
    const orbit = BODY_ORBITS[id];
    return {
      kind: "planet",
      semiMajorAxisAu: orbit.semiMajorAxisAu,
      eccentricity: orbit.eccentricity,
      inclinationDegrees: orbit.inclinationDegrees,
      inclinationReference: "j2000-ecliptic",
      normal: directionToScene(id, BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[id]),
      perihelionDirection: directionToScene(id, orbit.perihelionDirection),
      trueAnomalyDegrees: orbit.trueAnomalyDegrees,
      source: "vsop87a-state-vector-via-solar-geometry",
    };
  };
  const others = [...bodies, ...dwarfPlanets, ...smallBodies].filter((id) => id !== bodyId).map((id) => {
    const orbit = orbitFacts(id);
    const position = toScene(resolveKilometers(id));
    const { normal, perihelionDirection } = orbit;
    if (Math.abs(dot(normal, perihelionDirection)) > 1e-9) {
      throw new RangeError(`${id}: perihelion direction is not in the orbital plane.`);
    }
    const perihelionMotion = normalize(cross(normal, perihelionDirection));
    const semiMajorAxisUnits = orbit.semiMajorAxisAu * unitsPerAu;
    const eccentricity = orbit.eccentricity;
    const closed = eccentricity < 1;
    const semiMinorAxisUnits = closed ? semiMajorAxisUnits * Math.sqrt(1 - eccentricity * eccentricity) : null;
    const center = add(sunPosition, scale(perihelionDirection, -semiMajorAxisUnits * eccentricity));
    const majorAxis = scale(perihelionDirection, semiMajorAxisUnits);
    const minorAxis = semiMinorAxisUnits === null ? null : scale(perihelionMotion, semiMinorAxisUnits);
    const pointAt = (eccentricAnomaly: number) => {
      if (minorAxis === null) throw new TypeError("Elliptic path requires its minor axis.");
      return add(
      center,
      add(scale(majorAxis, Math.cos(eccentricAnomaly)), scale(minorAxis, Math.sin(eccentricAnomaly))),
    );
    };
    // The body's eccentric anomaly: from the planet's prepared true anomaly,
    // or (dwarf planets) from its position projected onto the ellipse axes.
    const bodyEccentricAnomaly = !closed ? null : orbit.trueAnomalyDegrees === null
      ? Math.atan2(
        dot(subtract(position, center), perihelionMotion) / semiMinorAxisUnits!,
        dot(subtract(position, center), perihelionDirection) / semiMajorAxisUnits,
      )
      : 2 * Math.atan2(
        Math.sqrt(1 - eccentricity) * Math.sin(orbit.trueAnomalyDegrees * Math.PI / 360),
        Math.sqrt(1 + eccentricity) * Math.cos(orbit.trueAnomalyDegrees * Math.PI / 360),
      );
    const trueAnomalyDegrees = !closed ? Math.atan2(
      dot(subtract(position, sunPosition), perihelionMotion),
      dot(subtract(position, sunPosition), perihelionDirection)) * 180 / Math.PI : orbit.trueAnomalyDegrees ?? (2 * Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(bodyEccentricAnomaly! / 2),
      Math.sqrt(1 - eccentricity) * Math.cos(bodyEccentricAnomaly! / 2),
    ) * 180 / Math.PI + 360) % 360;
    // The ellipse from the elements must pass through the position the tree
    // resolved from the Sun direction: two derivations of one state vector.
    const ringResidual = closed ? magnitude(subtract(pointAt(bodyEccentricAnomaly!), position)) : 0;
    if (ringResidual > 1e-6 * Math.abs(semiMajorAxisUnits)) {
      throw new RangeError(
        `${id}: the body is ${ringResidual} units off its own orbit around ` +
          `${bodyId}; the orbital facts disagree with the Sun direction.`,
      );
    }
    const step = 2 * Math.PI / SYSTEM_ORBIT_SEGMENTS;
    // Closed ring in the direction of motion, vertex 0 exactly at the body.
    // Whole units: one unit is a few kilometres against tens of au, so the
    // rounding is below 1e-7 relative and the prepared module stays small.
    const vertices = Object.freeze(closed ? Array.from({ length: SYSTEM_ORBIT_SEGMENTS }, (_, index) =>
      Object.freeze((index === 0 ? position : pointAt(bodyEccentricAnomaly! + index * step)).map(Math.round))) : []);
    const behindTurns = closed ? chordBehindTurns(Array.from({ length: SYSTEM_ORBIT_SEGMENTS }, (_, index) => index * step)) : [];
    const trail = trailWeightsForSpans(behindTurns, ORBIT_TRAIL_SPANS);
    // Illumination from the observer (at the origin): Sun-body-observer.
    const toSun = subtract(sunPosition, position);
    const toObserver = scale(position, -1);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1,
      dot(toSun, toObserver) / (magnitude(toSun) * magnitude(toObserver)))));
    const fluxKm = GEOMETRIC_ALBEDO[id] * BODIES[id].meanRadiusKm ** 2 * lambertPhaseFunction(phaseAngle) /
      ((magnitude(toSun) * kilometersPerUnit) ** 2 * (magnitude(toObserver) * kilometersPerUnit) ** 2);
    return Object.freeze({
      id,
      kind: orbit.kind,
      orbitSource: orbit.source,
      radiusKilometers: BODIES[id].meanRadiusKm,
      radiusUnits: BODIES[id].meanRadiusKm / kilometersPerUnit,
      pointPresentation: preparePlanetPoint({
        radiusKilometers: BODIES[id].meanRadiusKm,
        geometricAlbedo: GEOMETRIC_ALBEDO[id],
        heliocentricDistanceAu: magnitude(toSun) / unitsPerAu,
        kilometersPerUnit,
      }),
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
      heliocentricDistanceAu: magnitude(toSun) / unitsPerAu,
      semiMajorAxisAu: orbit.semiMajorAxisAu,
      semiMajorAxisUnits,
      semiMinorAxisUnits,
      eccentricity,
      inclinationDegrees: orbit.inclinationDegrees,
      inclinationReference: orbit.inclinationReference,
      perihelionAu: orbit.semiMajorAxisAu * (1 - eccentricity),
      aphelionAu: closed ? orbit.semiMajorAxisAu * (1 + eccentricity) : null,
      trueAnomalyDegrees,
      orbit: !closed ? null : Object.freeze({
        labelPresentation: Object.freeze({
          radiusUnits: Math.max(...vertices.map((vertex) => magnitude(subtract(vertex, sunPosition)))),
          angularFadeInRadians: Math.PI / 180,
          angularFullRadians: 4 * Math.PI / 180,
          nearDistanceUnits: Math.max(20 * BODIES[id].meanRadiusKm, 50) / kilometersPerUnit,
          farDistanceUnits: Math.max(200 * BODIES[id].meanRadiusKm, 500) / kilometersPerUnit,
          minimumEligibility: 0.12,
        }),
        normal,
        perihelionDirection,
        center: Object.freeze(center.map(Math.round)),
        vertices,
        vertexCount: vertices.length,
        trail,
        chordBehindTurns: behindTurns,
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
  const ordered = bodies.map((id) => BODY_ORBITS[id]);
  for (let index = 1; index < ordered.length; index += 1) {
    const previousAphelion = ordered[index - 1].aphelionAu;
    if (previousAphelion === null || !(ordered[index].perihelionAu > previousAphelion)) {
      throw new RangeError(
        `${bodies[index]} (perihelion ${ordered[index].perihelionAu} au) does ` +
          `not lie outside ${bodies[index - 1]} (aphelion ${ordered[index - 1].aphelionAu} au).`,
      );
    }
  }
  const maximumExtentUnits = bodiesWithBrightness.reduce(
    (extent, body) => (body.orbit?.vertices ?? []).reduce(
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
    planetIds: Object.freeze(bodies.filter((id) => id !== bodyId)),
    dwarfPlanetIds: Object.freeze(dwarfPlanets.filter((id) => id !== bodyId)),
    markerBrightness: MARKER_BRIGHTNESS,
    maximumExtentUnits,
    runtimeGeometryDerivation: false,
  });
}

function heliocentricOrbitFromState({ positionKm, velocityKmPerDay }: { positionKm: Vector3; velocityKmPerDay: Vector3 }, muKm3PerS2: number) {
  if (![positionKm, velocityKmPerDay].every(vector =>
    Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) || !positive(muKm3PerS2)) {
    throw new TypeError("A parent heliocentric state requires finite ICRF km and km/day vectors and solar GM.");
  }
  const velocityKmPerSecond = scale(velocityKmPerDay, 1 / 86400);
  const radius = magnitude(positionKm);
  const speedSquared = dot(velocityKmPerSecond, velocityKmPerSecond);
  const angularMomentum = cross(positionKm, velocityKmPerSecond);
  const semiMajorAxisKm = 1 / (2 / radius - speedSquared / muKm3PerS2);
  const eccentricityVector = subtract(
    scale(cross(velocityKmPerSecond, angularMomentum), 1 / muKm3PerS2),
    scale(positionKm, 1 / radius),
  );
  const eccentricity = magnitude(eccentricityVector);
  if (!positive(radius) || !positive(magnitude(angularMomentum)) ||
      !Number.isFinite(semiMajorAxisKm) || !Number.isFinite(eccentricity) || eccentricity === 1 ||
      !(eccentricity < 1 ? semiMajorAxisKm > 0 : semiMajorAxisKm < 0)) {
    throw new RangeError("The parent heliocentric state must define a non-degenerate elliptic or hyperbolic conic.");
  }
  return {
    semiMajorAxisKm,
    eccentricity,
    normalIcrf: normalize(angularMomentum),
    // At exact circularity perihelion is undefined; the epoch radius is a
    // harmless ellipse-axis convention, without changing the orbit or phase.
    perihelionIcrf: normalize(eccentricity > 1e-12 ? eccentricityVector : positionKm),
  };
}

function applyMatrix(matrix: Matrix3, [x, y, z]: Vector3): [number, number, number] {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

function transposeMatrix(matrix: Matrix3) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

function subtract(a: Vector3, b: Vector3) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

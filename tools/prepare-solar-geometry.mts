#!/usr/bin/env node

// Computes, for each body, the direction to the Sun, the J2000 ecliptic
// north pole, the body's orbit normal and its orbital velocity direction, all
// expressed in that body's own body-fixed frame (+Z north pole, +X prime
// meridian at longitude 0), at a single pinned epoch. The result is written
// to src/platform/solar-geometry.mts and consumed at preparation time only;
// the runtime never derives it.
//
// Planets, Pluto and selected moons use retained Horizons geometric states
// at the fixed scene epoch. Other dwarf planets and satellites retain their
// existing compact models. No general-time evaluator is changed.
// Satellite state vectors are relative
// to their parent; solar directions include the parent's heliocentric position.
// and orientations from the IAU/WGCCRE rotation
// elements, both provided by the vendored astronomy package
// (packages/astronomy, consumed through its own build; see
// src/platform/astronomy-package.mts). The orbit normal
// is the specific angular momentum direction of the state vector,
// normalize(r x v), and its angle to the
// ecliptic pole reproduces the tabulated inclinations (Earth's, which defines
// the ecliptic, comes out at 0.003 degrees). Regenerating requires that
// package's build (`pnpm prepare:solar-geometry` builds it first).
// cssEarth builds this combined module locally; it is not committed.

import type { BodyId, SceneSatelliteRecord, RotationElements } from "@cssearth/astronomy";
import { requireArray, requireRecord, requireString, readJsonSource } from "./source-values.mts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SCENE_OBJECTS } from "../site/objects.mts";
import { loadAstronomyPackage } from "../src/platform/astronomy-package.mts";
import { loadSceneEpochEphemeris } from "../packages/astronomy/tools/scene-ephemeris.mts";

// 2026-09-03T00:00:00 TT.
const EPOCH_JD_TT = 2461286.5;
const EPOCH_LABEL = "2026-09-03T00:00:00 TT";
const sourceKey = (id: string) => /^[a-z][a-z0-9]*$/.test(id) ? id : JSON.stringify(id);

function isIncluded<T extends string>(values: readonly T[], value: string): value is T { return (values as readonly string[]).includes(value); }



const {
  DWARF_PLANET_IDS, dwarfPlanetElements, keplerStateKm,
  SMALL_BODY_IDS, asteroidElements,
  COMET_IDS, cometElements,
  STAR_IDS, starAstrometry, starStateKm,
  HOSTED_PLANET_IDS, hostedPlanetStateRelativeKm,
  SATELLITE_IDS, satelliteStateKm, moonPositionRelativeToPlanetKm,
  SCENE_SATELLITE_IDS, sceneSatelliteStateKm,
  bodyRotationAt, ROTATING_BODY_IDS,
  bodyFixedToIcrf,
  OBLIQUITY_J2000_RAD,
  BODIES: ASTRONOMY_BODY_DATA,
} = await loadAstronomyPackage();

// A star other than the Sun is placed by its catalogue astrometry; the Sun itself is the origin and has no entry.
const isPlacedStar = (id: string) => isIncluded(STAR_IDS, id);
// A planet of another star orbits a placed star on its transit-fitted orbit; its host is its light source.
const isHostedPlanet = (id: string) => isIncluded(HOSTED_PLANET_IDS, id);
const BODIES = SCENE_OBJECTS.filter(body =>
  ["planet", "dwarf-planet", "satellite", "asteroid", "trans-neptunian", "comet", "interstellar", "exoplanet"].includes(body.classification) ||
  (body.classification === "star" && isPlacedStar(body.id))).map(body => {
  if (!Object.hasOwn(ASTRONOMY_BODY_DATA, body.id)) throw new TypeError(`Unknown astronomy body: ${body.id}.`);
  return body.id as BodyId;
});

// The J2000 ecliptic north pole in ICRF: the ICRF +z axis tilted by the
// obliquity about +x.
const ECLIPTIC_NORTH_ICRF = Object.freeze([
  0,
  -Math.sin(OBLIQUITY_J2000_RAD),
  Math.cos(OBLIQUITY_J2000_RAD),
]);

// IAU 2012 exact definition (Resolution B2).
const ASTRONOMICAL_UNIT_KILOMETERS = 149597870.7;

// Gaussian gravitational constant k, historically used to define the
// astronomical system of units: GM_sun = k^2 in AU^3/day^2 by construction
// (Gauss, 1809; still the IAU-adopted value). The astronomy build exports the
// Sun's GM in km^3/s^2 instead (BODIES.sun.gravitationalParameterKm3PerS2 =
// 132712440041.93938, JPL Horizons), which is not already in AU^3/day^2; but
// converting it with the IAU 2012 AU (149597870.7 km) reproduces k^2 to
// better than 1e-15 relative, so there is no "better" value to switch to and
// k^2 is used directly below.
const GAUSSIAN_GRAVITATIONAL_CONSTANT = 0.01720209895;
const GM_SUN_AU3_PER_DAY2 = GAUSSIAN_GRAVITATIONAL_CONSTANT ** 2;

// Confirms the claim above instead of merely asserting it in prose: convert
// the build's own Sun GM into AU^3/day^2 and check it against k^2.
{
  const SECONDS_PER_DAY_LOCAL = 86400;
  const gmSunFromBuild = ASTRONOMY_BODY_DATA.sun.gravitationalParameterKm3PerS2 *
    SECONDS_PER_DAY_LOCAL ** 2 / ASTRONOMICAL_UNIT_KILOMETERS ** 3;
  const relativeDifference =
    Math.abs(gmSunFromBuild - GM_SUN_AU3_PER_DAY2) / GM_SUN_AU3_PER_DAY2;
  if (relativeDifference > 1e-12) {
    throw new Error(
      `Gaussian k^2 (${GM_SUN_AU3_PER_DAY2}) disagrees with the astronomy ` +
        `build's Sun GM converted to AU^3/day^2 (${gmSunFromBuild}) by ` +
        `${relativeDifference}; re-derive GM_SUN_AU3_PER_DAY2 from the build.`,
    );
  }
}

// Object-owned orientation sources distinguish observed poles from display axes.
const authoredRotations = new Map(await Promise.all(BODIES.map(async (id): Promise<readonly [BodyId, RotationElements | null]> => {
  const descriptor = requireRecord(await readJsonSource(resolve("src/objects", id, "object.json")));
  const recipe = requireRecord(requireRecord(descriptor.properties).recipe);
  const ref = requireArray(recipe.sources).map(source => requireRecord(source)).find(source => source.id === "rotation");
  if (!ref) return [id, null];
  const { readAuthoredRotation } = await import('./objects/authored-rotation.mts');
  return [id, await readAuthoredRotation(resolve('src/objects', id), { path: requireString(ref.path) }, EPOCH_JD_TT)];
})));
const rotationAtEpoch = (id: BodyId): RotationElements => {
  const authored = authoredRotations.get(id);
  if (authored) return authored;
  if (!isIncluded(ROTATING_BODY_IDS, id)) throw new Error(`no IAU rotation model for body: ${id}`);
  return bodyRotationAt(id, EPOCH_JD_TT);
};

type EpochState = { positionKm: readonly number[]; velocityKmPerDay: readonly number[]; centerBodyId: string; provenance: unknown; parentHeliocentricState?: SceneSatelliteRecord["parentHeliocentricState"]; gravitationalParametersKm3PerS2?: SceneSatelliteRecord["gravitationalParametersKm3PerS2"] };
const epochStates = new Map<string, EpochState>(await loadSceneEpochEphemeris(EPOCH_JD_TT));
for (const id of SCENE_SATELLITE_IDS) epochStates.set(id, sceneSatelliteStateKm(id, EPOCH_JD_TT));
// A primary-specific satellite solution owns ONE heliocentric primary state
// at this epoch. Every observer and the global context must use that same
// origin; mixing it with an older parent conic breaks the physical hierarchy.
const primaryStates = new Map<string, Pick<EpochState, "positionKm" | "velocityKmPerDay"> & { provenance?: unknown }>(
  [...epochStates].filter(([, state]) => state.centerBodyId === "sun"));
for (const state of epochStates.values()) {
  if (!state.parentHeliocentricState) continue;
  const primary = state.parentHeliocentricState;
  const previous = primaryStates.get(state.centerBodyId);
  if (previous && (['positionKm', 'velocityKmPerDay'] as const).some(key =>
    primary[key].some((value, axis) => value !== previous[key][axis]))) {
    throw new TypeError(`Incompatible primary states for ${state.centerBodyId}.`);
  }
  primaryStates.set(state.centerBodyId, primary);
}
const planetState = (id: string) => {
  const state = primaryStates.get(id);
  if (!state) throw new TypeError(`No retained heliocentric state for ${id}.`);
  return state;
};
const planetPosition = (id: string) => planetState(id).positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS);
const planetVelocity = (id: string) => planetState(id).velocityKmPerDay.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS);

const entries = BODIES.map((body) => {
  const parent = ASTRONOMY_BODY_DATA[body].parent, star = isPlacedStar(body), hosted = isHostedPlanet(body);
  const hostedState = hosted ? hostedPlanetStateRelativeKm(body as Parameters<typeof hostedPlanetStateRelativeKm>[0], EPOCH_JD_TT) : null;
  if (parent === null && !star) throw new TypeError(`Solar geometry requires an orbital parent for ${body}.`);
  const isSatellite = parent !== null && parent !== "sun";
  const epochState = isSatellite ? epochStates.get(body) : null;
  if (epochState && epochState.centerBodyId !== parent) throw new TypeError(`Ephemeris parent differs for ${body}.`);
  const moonPosition = hostedState ? hostedState.positionKm : isSatellite ? epochState?.positionKm ?? moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT) : null;
  // ELP supplies the Earth's Moon position; take its centred derivative.
  // Other satellite records already expose their analytic Kepler velocity.
  const dt = 0.001;
  const moonVelocity = !isSatellite ? null : hostedState ? hostedState.velocityKmPerDay : epochState ? epochState.velocityKmPerDay : isIncluded(SATELLITE_IDS, body)
    ? satelliteStateKm(body, EPOCH_JD_TT).velocityKmPerDay
    : moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT + dt).map((value, index) =>
      (value - moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT - dt)[index]) / (2 * dt));
  const parentPosition = !isSatellite ? null : isSatellite
    ? hostedState ? starStateKm(parent as Parameters<typeof starStateKm>[0], EPOCH_JD_TT).positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
      : primaryStates.has(parent)
      ? primaryStates.get(parent)!.positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
      : isIncluded(DWARF_PLANET_IDS, parent)
      ? keplerStateKm(dwarfPlanetElements(parent), EPOCH_JD_TT).positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
      : isIncluded(SMALL_BODY_IDS, parent)
      ? keplerStateKm(asteroidElements(parent), EPOCH_JD_TT).positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
      : planetPosition(parent) : null;
  const mu = isSatellite
    ? (epochState?.gravitationalParametersKm3PerS2?.combined ?? (ASTRONOMY_BODY_DATA[parent].gravitationalParameterKm3PerS2 +
       ASTRONOMY_BODY_DATA[body].gravitationalParameterKm3PerS2)) * 86400 ** 2 / ASTRONOMICAL_UNIT_KILOMETERS ** 3
    : GM_SUN_AU3_PER_DAY2;
  const kepler = isIncluded(DWARF_PLANET_IDS, body)
    ? keplerStateKm(dwarfPlanetElements(body), EPOCH_JD_TT)
    : isIncluded(SMALL_BODY_IDS, body) ? keplerStateKm(asteroidElements(body), EPOCH_JD_TT)
    : isIncluded(COMET_IDS, body) ? keplerStateKm(cometElements(body), EPOCH_JD_TT) : null;
  // A placed star: its catalogue position carried by its space velocity, in the same heliocentric ICRF frame.
  const starState = star ? starStateKm(body as Parameters<typeof starStateKm>[0], EPOCH_JD_TT) : null;
  const heliocentricAu = starState ? starState.positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : isSatellite
    ? parentPosition!.map((value, index) => value + moonPosition![index] / ASTRONOMICAL_UNIT_KILOMETERS) : kepler
    ? (primaryStates.get(body) ?? kepler).positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
    : planetPosition(body);
  const velocityAuPerDay = starState ? starState.velocityKmPerDay.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : isSatellite
    ? moonVelocity!.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : kepler
    ? (primaryStates.get(body) ?? kepler).velocityKmPerDay.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
    : planetVelocity(body);
  const orbitPositionAu = isSatellite ? moonPosition!.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : heliocentricAu;
  // Every body keeps its true Sun direction: the world context rebuilds heliocentric positions from it. A hosted planet's own
  // light source is its host star, which its synchronous rotation record faces at longitude 0; its map is emissive.
  const toSunIcrf = normalize(heliocentricAu.map((component) => -component));
  const orbitNormalIcrf = normalize(cross(orbitPositionAu, velocityAuPerDay));
  const velocityIcrf = normalize(velocityAuPerDay);
  // Columns of bodyFixedToIcrf are the body axes in ICRF, so its transpose
  // takes an ICRF direction into the body-fixed frame.
  const matrix = bodyFixedToIcrf(rotationAtEpoch(body));
  const toBodyFixed = (icrf: readonly number[]) => normalize([
    matrix[0] * icrf[0] + matrix[3] * icrf[1] + matrix[6] * icrf[2],
    matrix[1] * icrf[0] + matrix[4] * icrf[1] + matrix[7] * icrf[2],
    matrix[2] * icrf[0] + matrix[5] * icrf[1] + matrix[8] * icrf[2],
  ]);
  const bodyFixed = toBodyFixed(toSunIcrf);
  // A placed star may put its own display axis up instead of the ecliptic pole: the camera orbit then lies in the star's
  // equator, where its sub-Earth point is, instead of a plane the Earth may sit far outside of.
  // A hosted planet's orbit plane has nothing to do with the Solar System's ecliptic; its own pole (the orbit normal) is up.
  const eclipticNorth = hosted || star && starAstrometry(body as Parameters<typeof starAstrometry>[0]).presentationUp === 'display-axis' ? [0, 0, 1] : toBodyFixed(ECLIPTIC_NORTH_ICRF);
  const orbitNormal = toBodyFixed(orbitNormalIcrf);
  const orbitalVelocity = toBodyFixed(velocityIcrf);
  const elements = rotationAtEpoch(body);
  const orbitInclinationDegrees = Math.acos(dot(orbitNormalIcrf, ECLIPTIC_NORTH_ICRF)) *
    180 / Math.PI;

  // Heliocentric orbit from the vis-viva relation and the eccentricity
  // vector, both derived from the state vector alone (no orbital elements
  // used as input): a = 1 / (2/r - v^2/mu), e_vec = ((v^2 - mu/r) r -
  // (r.v) v) / mu. See https://en.wikipedia.org/wiki/Orbital_eccentricity
  // and https://en.wikipedia.org/wiki/Vis-viva_equation.
  const heliocentricDistanceAu = Math.hypot(...heliocentricAu);
  const orbitDistanceAu = Math.hypot(...orbitPositionAu);
  const speedSquared = dot(velocityAuPerDay, velocityAuPerDay);
  const semiMajorAxisAu = 1 /
    (2 / orbitDistanceAu - speedSquared / mu);
  const radialSpeed = dot(orbitPositionAu, velocityAuPerDay);
  const eccentricityVectorIcrf = orbitPositionAu.map((component, index) =>
    ((speedSquared - mu / orbitDistanceAu) *
      component - radialSpeed * velocityAuPerDay[index]) / mu
  );
  const eccentricity = Math.hypot(...eccentricityVectorIcrf);
  const perihelionDirectionIcrf = normalize(eccentricityVectorIcrf);
  const perihelionDirection = toBodyFixed(perihelionDirectionIcrf);
  // True anomaly: angle from perihelion to the body, signed by the direction
  // of motion (r.v > 0 while receding from perihelion, i.e. 0 < nu < 180).
  // atan2 of the in-plane sine and cosine, signed by the orbit normal (r x v): acos alone loses about 1e-8 rad near 0 and
  // 180 degrees, which is where a near-circular orbit's noise-defined perihelion can fall.
  const radialDirectionIcrf = normalize(orbitPositionAu);
  const sinTrueAnomaly = dot(cross(perihelionDirectionIcrf, radialDirectionIcrf), orbitNormalIcrf);
  let trueAnomalyDegrees = Math.atan2(sinTrueAnomaly, dot(perihelionDirectionIcrf, radialDirectionIcrf)) * 180 / Math.PI;
  if (trueAnomalyDegrees < 0) trueAnomalyDegrees += 360;

  // Self-verification: the eccentricity vector must lie in the orbital
  // plane (perpendicular to the orbit normal), and re-placing the body from
  // its perihelion direction, orbit normal and true anomaly must reproduce
  // the same body-fixed position already computed from the Sun direction.
  const perihelionOrthogonality = dot(perihelionDirection, orbitNormal);
  if (Math.abs(perihelionOrthogonality) > 1e-9) {
    throw new Error(
      `${body}: perihelion direction is not perpendicular to the orbit ` +
        `normal (dot = ${perihelionOrthogonality}).`,
    );
  }
  const trueAnomalyRad = trueAnomalyDegrees * Math.PI / 180;
  const orbitTangent = cross(orbitNormal, perihelionDirection);
  const reconstructedPositionBodyFixed = perihelionDirection.map(
    (component, index) =>
      orbitDistanceAu *
      (Math.cos(trueAnomalyRad) * component +
        Math.sin(trueAnomalyRad) * orbitTangent[index]),
  );
  const centerDirection = toBodyFixed(orbitPositionAu.map(value => -value));
  const centerPositionAu = centerDirection.map(value => value * orbitDistanceAu);
  const actualPositionBodyFixed = centerPositionAu.map(value => -value);
  const positionReconstructionError = Math.hypot(
    ...reconstructedPositionBodyFixed.map((component, index) =>
      component - actualPositionBodyFixed[index]
    ),
  );
  // The tolerance is absolute for Solar-System distances and relative beyond them: a placed star sits at ten million
  // astronomical units, where double precision itself carries a few nanometres of an AU.
  if (positionReconstructionError > 1e-9 * Math.max(1, orbitDistanceAu)) {
    throw new Error(
      `${body}: heliocentric orbit reconstruction from perihelion ` +
        `direction, orbit normal and true anomaly disagrees with the ` +
        `Sun-direction-derived position by ${positionReconstructionError} AU.`,
    );
  }

  // A hosted planet is lit by its own star, not by the Sun: the body-fixed direction to the host, which its synchronous
  // rotation record puts at longitude 0. Prepared separately so the Sun direction every other consumer reads stays the Sun's.
  const starDirection = hostedState
    ? toBodyFixed(normalize(hostedState.positionKm.map(value => -value)))
    : null;
  return Object.freeze({
    body,
    parent,
    centerPositionAu,
    direction: bodyFixed,
    starDirection,
    eclipticNorth,
    orbitNormal,
    orbitalVelocity,
    matrix: Object.freeze([...matrix]),
    poleRightAscensionDegrees: elements.poleRightAscensionRad * 180 / Math.PI,
    poleDeclinationDegrees: elements.poleDeclinationRad * 180 / Math.PI,
    primeMeridianDegrees: elements.primeMeridianRad * 180 / Math.PI,
    subsolarLatitudeDegrees: Math.asin(bodyFixed[2]) * 180 / Math.PI,
    subsolarLongitudeDegrees:
      Math.atan2(bodyFixed[1], bodyFixed[0]) * 180 / Math.PI,
    // Angle between the body's north pole and ecliptic north. This is the
    // pole's tilt against the ecliptic, not the obliquity to the body's own
    // orbit (they differ by the orbital inclination).
    poleTiltDegrees: Math.acos(eclipticNorth[2]) * 180 / Math.PI,
    // Ecliptic latitude of the Sun as seen from the body.
    sunEclipticLatitudeDegrees: Math.asin(
      bodyFixed[0] * eclipticNorth[0] + bodyFixed[1] * eclipticNorth[1] +
        bodyFixed[2] * eclipticNorth[2],
    ) * 180 / Math.PI,
    // Inclination of the orbit to the J2000 ecliptic, and the obliquity of
    // the body's spin axis to its own orbit.
    orbitInclinationDegrees,
    obliquityToOrbitDegrees: Math.acos(orbitNormal[2]) * 180 / Math.PI,
    // Flight-path angle: elevation of the velocity above the local horizontal
    // (perpendicular to the orbit's radial direction); positive moving outward.
    flightPathAngleDegrees: Math.asin(dot(velocityIcrf, radialDirectionIcrf)) * 180 /
      Math.PI,
    semiMajorAxisAu,
    eccentricity,
    heliocentricDistanceAu,
    perihelionDirection,
    trueAnomalyDegrees,
    perihelionAu: semiMajorAxisAu * (1 - eccentricity),
    aphelionAu: eccentricity < 1 ? semiMajorAxisAu * (1 + eccentricity) : null,
  });
});

const module = `// Generated by tools/prepare-solar-geometry.mts. Do not edit by hand.
//
// Unit direction from each body to the Sun, the J2000 ecliptic north pole,
// the body's orbit normal (normalize(r x v) relative to its orbit centre)
// and its orbital velocity direction, all in that body's own body-fixed frame
// (+Z north pole, +X prime meridian) at ${EPOCH_LABEL}, plus the body-fixed
// to ICRF rotation itself.
//
// Positions: retained Horizons body centres for planets, Pluto and selected moons
// at this exact prepared epoch. Other satellites/dwarf planets retain their
// existing compact JPL Kepler fits.
// Satellite orbit elements are relative to their parent, not to the Sun.
// All vectors use ICRF. Orientation: IAU/WGCCRE elements, object-owned observed
// poles, or explicitly arbitrary display orientations.
// A state at one epoch does not make an osculating orbit a predicted trajectory.
//
// BODY_ORBITS derives each body's osculating orbit from that same
// state vector (vis-viva and the eccentricity vector), using GM_sun = k^2
// with the Gaussian
// gravitational constant k = ${GAUSSIAN_GRAVITATIONAL_CONSTANT} (Gauss, 1809;
// still the IAU-adopted value, GM_sun = ${GM_SUN_AU3_PER_DAY2} AU^3/day^2).
// Satellites instead use GM_parent + GM_satellite from the astronomy package.
// Legacy perihelion/aphelion field names mean periapsis/apoapsis for satellites.

export const SOLAR_GEOMETRY_EPOCH_JD_TT = ${EPOCH_JD_TT};
export const SOLAR_GEOMETRY_EPOCH_LABEL = ${JSON.stringify(EPOCH_LABEL)};
export const ASTRONOMICAL_UNIT_KILOMETERS = ${ASTRONOMICAL_UNIT_KILOMETERS};

// Preparation provenance; these snapshots cannot be extrapolated to other dates.
export const BODY_POSITION_PROVENANCE = Object.freeze(${JSON.stringify(Object.fromEntries([...epochStates, ...primaryStates].map(([id, state]) => [id, { ...requireRecord(state.provenance, "State provenance") }])), null, 2)});

// Canonical ICRF heliocentric primary states at this exact scene epoch. A
// coordinate origin here need not have a visible surface or navigation marker.
export const BODY_HELIOCENTRIC_STATES: Readonly<Record<string, { positionKm: readonly number[]; velocityKmPerDay: readonly number[]; provenance: { model: string; epochJdTt: number; referenceFrame: string; target: number; center: number; source: string; sourcePath: string; sha256: string; solution?: string; limitations?: readonly string[]; timeQualification?: string; qualification?: readonly string[]; targetKind?: string } }>> = Object.freeze(${JSON.stringify(Object.fromEntries(primaryStates), null, 2)});

// A planet of another star is lit by that star. Its direction in the planet's own frame, which synchronous rotation holds
// at longitude 0: what the lighting bake and the scene's light presentation read instead of the Sun's direction.
export const BODY_FIXED_STAR_DIRECTIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.filter(entry => entry.starDirection).map(({ body, starDirection }) =>
    `  ${sourceKey(body)}: Object.freeze([\n` +
    starDirection!.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

export const BODY_FIXED_SUN_DIRECTIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.map(({ body, direction, subsolarLatitudeDegrees, subsolarLongitudeDegrees }) =>
    `  // subsolar latitude ${subsolarLatitudeDegrees.toFixed(3)}°, ` +
    `longitude ${subsolarLongitudeDegrees.toFixed(3)}°\n` +
    `  ${sourceKey(body)}: Object.freeze([\n` +
    direction.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

export const BODY_FIXED_ECLIPTIC_NORTH_DIRECTIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.map(({ body, eclipticNorth, poleTiltDegrees, sunEclipticLatitudeDegrees }) =>
    `  // pole tilt to the ecliptic ${poleTiltDegrees.toFixed(3)}°, ` +
    `Sun ecliptic latitude ${sunEclipticLatitudeDegrees.toFixed(3)}°\n` +
    `  ${sourceKey(body)}: Object.freeze([\n` +
    eclipticNorth.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// The orbit lies in the plane perpendicular to this direction; every
// direction from the body to another point of its orbit does too.
export const BODY_FIXED_ORBIT_NORMAL_DIRECTIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.map(({ body, orbitNormal, orbitInclinationDegrees, obliquityToOrbitDegrees }) =>
    `  // orbital inclination to the ecliptic ${orbitInclinationDegrees.toFixed(3)}°, ` +
    `obliquity to the orbit ${obliquityToOrbitDegrees.toFixed(3)}°\n` +
    `  ${sourceKey(body)}: Object.freeze([\n` +
    orbitNormal.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// Direction of the body's heliocentric velocity: the tangent of its orbit at
// the epoch, perpendicular to the orbit normal but not to the Sun direction
// (the flight-path angle is the orbit's eccentricity showing).
export const BODY_FIXED_ORBITAL_VELOCITY_DIRECTIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.map(({ body, orbitalVelocity, flightPathAngleDegrees }) =>
    `  // flight-path angle ${flightPathAngleDegrees.toFixed(3)}°\n` +
    `  ${sourceKey(body)}: Object.freeze([\n` +
    orbitalVelocity.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// Body-fixed to ICRF rotation, row-major: the columns are the body's +X
// (prime meridian), +Y and +Z (north pole) axes in ICRF, so an ICRF direction
// is the matrix times a body-fixed direction and the transpose goes back.
export const BODY_FIXED_TO_ICRF_MATRICES: Readonly<Record<string, readonly number[]>> = Object.freeze({
${
  entries.map(({ body, matrix, poleRightAscensionDegrees, poleDeclinationDegrees, primeMeridianDegrees }) =>
    `  // pole RA ${poleRightAscensionDegrees.toFixed(3)}°, ` +
    `Dec ${poleDeclinationDegrees.toFixed(3)}°, ` +
    `prime meridian W ${primeMeridianDegrees.toFixed(3)}°\n` +
    `  ${sourceKey(body)}: Object.freeze([\n` +
    [0, 3, 6].map((row) =>
      `    ${matrix.slice(row, row + 3).join(", ")},\n`).join("") +
    `  ]),`).join("\n")
}
});

// Osculating orbit around the central body at the epoch, derived from the state vector
// alone (vis-viva and the eccentricity vector - see the module header).
// perihelionDirection is the unit eccentricity vector in the body-fixed
// frame; inclinationDegrees is the same value as
// BODY_FIXED_ORBIT_NORMAL_DIRECTIONS' orbital inclination comment above.
export const BODY_ORBITS: Readonly<Record<string, BodyOrbit>> = Object.freeze({
${
  entries.map((
    {
      body,
      parent,
      centerPositionAu,
      semiMajorAxisAu,
      eccentricity,
      heliocentricDistanceAu,
      perihelionDirection,
      trueAnomalyDegrees,
      orbitInclinationDegrees,
      perihelionAu,
      aphelionAu,
    },
  ) =>
    `  // a ${semiMajorAxisAu.toPrecision(5)} AU, e ${eccentricity.toPrecision(5)}, ` +
    `perihelion ${perihelionAu.toPrecision(5)} AU, aphelion ${aphelionAu === null ? 'none (unbound)' : aphelionAu.toPrecision(5) + ' AU'}\n` +
    `  ${sourceKey(body)}: Object.freeze({\n` +
    (parent === "sun" || parent === null ? "" : `    centerBodyId: ${JSON.stringify(parent)},\n    centerPositionAu: Object.freeze(${JSON.stringify(centerPositionAu)}),\n${epochStates.get(body)?.parentHeliocentricState ? `    parentHeliocentricState: ${JSON.stringify(epochStates.get(body)!.parentHeliocentricState)},\n` : ""}`) +
    `    semiMajorAxisAu: ${semiMajorAxisAu},\n` +
    `    eccentricity: ${eccentricity},\n` +
    `    heliocentricDistanceAu: ${heliocentricDistanceAu},\n` +
    `    perihelionDirection: Object.freeze([\n` +
    perihelionDirection.map((component) => `      ${component},\n`).join("") +
    `    ]),\n` +
    `    trueAnomalyDegrees: ${trueAnomalyDegrees},\n` +
    `    inclinationDegrees: ${orbitInclinationDegrees},\n` +
    `    perihelionAu: ${perihelionAu},\n` +
    `    aphelionAu: ${aphelionAu},\n` +
    `  }),`).join("\n")
}
});

/** The direction to a hosted planet's own star in its body-fixed frame; null for every body the Sun lights. */
export function bodyFixedStarDirection(bodyId: string) {
  return BODY_FIXED_STAR_DIRECTIONS[bodyId as keyof typeof BODY_FIXED_STAR_DIRECTIONS] ?? null;
}

export function requireBodyFixedSunDirection(bodyId: string) {
  const direction = BODY_FIXED_SUN_DIRECTIONS[bodyId as keyof typeof BODY_FIXED_SUN_DIRECTIONS];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedToIcrf(bodyId: string) {
  const matrix = BODY_FIXED_TO_ICRF_MATRICES[bodyId as keyof typeof BODY_FIXED_TO_ICRF_MATRICES];
  if (matrix === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return matrix;
}

export function requireBodyFixedEclipticNorth(bodyId: string) {
  const direction = BODY_FIXED_ECLIPTIC_NORTH_DIRECTIONS[bodyId as keyof typeof BODY_FIXED_ECLIPTIC_NORTH_DIRECTIONS];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedOrbitNormal(bodyId: string) {
  const direction = BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[bodyId as keyof typeof BODY_FIXED_ORBIT_NORMAL_DIRECTIONS];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedOrbitalVelocity(bodyId: string) {
  const direction = BODY_FIXED_ORBITAL_VELOCITY_DIRECTIONS[bodyId as keyof typeof BODY_FIXED_ORBITAL_VELOCITY_DIRECTIONS];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export interface BodyOrbit {
  semiMajorAxisAu: number; eccentricity: number; heliocentricDistanceAu: number;
  perihelionDirection: readonly number[]; trueAnomalyDegrees: number; inclinationDegrees: number;
  perihelionAu: number; aphelionAu: number | null; centerBodyId?: string; centerPositionAu?: readonly number[];
}

export function requireBodyOrbit(bodyId: string): BodyOrbit {
  const orbit = BODY_ORBITS[bodyId as keyof typeof BODY_ORBITS];
  if (orbit === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return orbit;
}
`;

const target = resolve(
  import.meta.dirname,
  "../src/platform/solar-geometry.mts",
);
await writeFile(target, module);
for (const entry of entries) {
  console.log(
    `${entry.body.padEnd(8)} subsolar lat ` +
      `${entry.subsolarLatitudeDegrees.toFixed(3).padStart(8)}°  lon ` +
      `${entry.subsolarLongitudeDegrees.toFixed(3).padStart(9)}°  ` +
      `pole tilt ${entry.poleTiltDegrees.toFixed(2).padStart(6)}°  ` +
      `Sun ecl. lat ${entry.sunEclipticLatitudeDegrees.toFixed(2).padStart(6)}°  ` +
      `orbit incl. ${entry.orbitInclinationDegrees.toFixed(3).padStart(6)}°`,
  );
}
console.log(`Prepared solar geometry -> ${target}`);

function normalize(vector: readonly number[]) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze(vector.map((component) => component / magnitude));
}

function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

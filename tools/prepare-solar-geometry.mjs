#!/usr/bin/env node

// Computes, for each body, the direction to the Sun, the J2000 ecliptic
// north pole, the body's orbit normal and its orbital velocity direction, all
// expressed in that body's own body-fixed frame (+Z north pole, +X prime
// meridian at longitude 0), at a single pinned epoch. The result is written
// to src/platform/solar-geometry.mjs and consumed at preparation time only;
// the runtime never derives it.
//
// Positions and velocities come from VSOP87A (heliocentric rectangular, J2000
// ecliptic, rotated to ICRF) for planets, JPL Kepler elements for dwarf planets
// and satellites, and ELP for Earth's Moon. Satellite state vectors are relative
// to their parent; solar directions include the parent's heliocentric position.
// and orientations from the IAU/WGCCRE rotation
// elements, both provided by the vendored astronomy package
// (packages/astronomy, consumed through its own build; see
// src/platform/astronomy-package.mjs). The orbit normal
// is the specific angular momentum direction of the state vector,
// normalize(r x v), and its angle to the
// ecliptic pole reproduces the tabulated inclinations (Earth's, which defines
// the ecliptic, comes out at 0.003 degrees). Regenerating requires that
// package's build (`pnpm prepare:solar-geometry` builds it first); building
// cssEarth does not, because the computed vectors are checked in.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OBJECTS } from "../site/objects.mjs";
import { loadAstronomyPackage } from "../src/platform/astronomy-package.mjs";

// 2026-09-04T00:00:00 TT.
const EPOCH_JD_TT = 2461286.5;
const EPOCH_LABEL = "2026-09-04T00:00:00 TT";

// VSOP87A has no Earth series; the Earth-Moon barycentre stands in for Earth.
// The offset is under 4700 km against 1 au, which moves the direction by less
// than 0.002 degrees.
const VSOP87A_KEY = Object.freeze({ earth: "emb" });

const BODIES = OBJECTS.filter(body =>
  ["planet", "dwarf-planet", "satellite"].includes(body.classification)).map(body => body.id);

const {
  DWARF_PLANET_IDS, dwarfPlanetElements, keplerStateKm,
  SATELLITE_IDS, satelliteStateKm, moonPositionRelativeToPlanetKm,
  systemBarycentreHeliocentricAu,
  systemBarycentreVelocityAuPerDay,
  bodyRotationAt,
  bodyFixedToIcrf,
  OBLIQUITY_J2000_RAD,
  BODIES: ASTRONOMY_BODY_DATA,
} = await loadAstronomyPackage();

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

// Observational pole solutions stay with each object; display phase is explicit.
const authoredRotations = new Map(await Promise.all(BODIES.map(async id => {
  const descriptor = JSON.parse(await readFile(resolve('src/planets', id, 'object.json'), 'utf8'));
  const ref = descriptor.properties.recipe.sources.find(source => source.id === 'rotation');
  if (!ref) return [id, null];
  const { readAuthoredRotation } = await import('./objects/authored-rotation.mjs');
  return [id, await readAuthoredRotation(resolve('src/planets', id), ref, EPOCH_JD_TT)];
})));
const rotationAtEpoch = id => authoredRotations.get(id) ?? bodyRotationAt(id, EPOCH_JD_TT);

const entries = BODIES.map((body) => {
  const parent = ASTRONOMY_BODY_DATA[body].parent;
  const isSatellite = parent !== "sun";
  const moonPosition = isSatellite ? moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT) : null;
  // ELP supplies the Earth's Moon position; take its centred derivative.
  // Other satellite records already expose their analytic Kepler velocity.
  const dt = 0.001;
  const moonVelocity = !isSatellite ? null : SATELLITE_IDS.includes(body)
    ? satelliteStateKm(body, EPOCH_JD_TT).velocityKmPerDay
    : moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT + dt).map((value, index) =>
      (value - moonPositionRelativeToPlanetKm(body, EPOCH_JD_TT - dt)[index]) / (2 * dt));
  const parentPosition = isSatellite
    ? systemBarycentreHeliocentricAu(VSOP87A_KEY[parent] ?? parent, EPOCH_JD_TT) : null;
  const mu = isSatellite
    ? (ASTRONOMY_BODY_DATA[parent].gravitationalParameterKm3PerS2 +
       ASTRONOMY_BODY_DATA[body].gravitationalParameterKm3PerS2) * 86400 ** 2 / ASTRONOMICAL_UNIT_KILOMETERS ** 3
    : GM_SUN_AU3_PER_DAY2;
  const kepler = DWARF_PLANET_IDS.includes(body)
    ? keplerStateKm(dwarfPlanetElements(body), EPOCH_JD_TT) : null;
  const heliocentricAu = isSatellite
    ? parentPosition.map((value, index) => value + moonPosition[index] / ASTRONOMICAL_UNIT_KILOMETERS) : kepler
    ? kepler.positionKm.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
    : systemBarycentreHeliocentricAu(VSOP87A_KEY[body] ?? body, EPOCH_JD_TT);
  const velocityAuPerDay = isSatellite
    ? moonVelocity.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : kepler
    ? kepler.velocityKmPerDay.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS)
    : systemBarycentreVelocityAuPerDay(VSOP87A_KEY[body] ?? body, EPOCH_JD_TT);
  const orbitPositionAu = isSatellite ? moonPosition.map(value => value / ASTRONOMICAL_UNIT_KILOMETERS) : heliocentricAu;
  const toSunIcrf = normalize(heliocentricAu.map((component) => -component));
  const orbitNormalIcrf = normalize(cross(orbitPositionAu, velocityAuPerDay));
  const velocityIcrf = normalize(velocityAuPerDay);
  // Columns of bodyFixedToIcrf are the body axes in ICRF, so its transpose
  // takes an ICRF direction into the body-fixed frame.
  const matrix = bodyFixedToIcrf(rotationAtEpoch(body));
  const toBodyFixed = (icrf) => normalize([
    matrix[0] * icrf[0] + matrix[3] * icrf[1] + matrix[6] * icrf[2],
    matrix[1] * icrf[0] + matrix[4] * icrf[1] + matrix[7] * icrf[2],
    matrix[2] * icrf[0] + matrix[5] * icrf[1] + matrix[8] * icrf[2],
  ]);
  const bodyFixed = toBodyFixed(toSunIcrf);
  const eclipticNorth = toBodyFixed(ECLIPTIC_NORTH_ICRF);
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
  const radialDirectionIcrf = normalize(orbitPositionAu);
  const cosTrueAnomaly = Math.max(
    -1,
    Math.min(1, dot(perihelionDirectionIcrf, radialDirectionIcrf)),
  );
  let trueAnomalyDegrees = Math.acos(cosTrueAnomaly) * 180 / Math.PI;
  if (radialSpeed < 0) trueAnomalyDegrees = 360 - trueAnomalyDegrees;

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
  if (positionReconstructionError > 1e-9) {
    throw new Error(
      `${body}: heliocentric orbit reconstruction from perihelion ` +
        `direction, orbit normal and true anomaly disagrees with the ` +
        `Sun-direction-derived position by ${positionReconstructionError} AU.`,
    );
  }

  return Object.freeze({
    body,
    parent,
    centerPositionAu,
    direction: bodyFixed,
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
    aphelionAu: semiMajorAxisAu * (1 + eccentricity),
  });
});

const module = `// Generated by tools/prepare-solar-geometry.mjs. Do not edit by hand.
//
// Unit direction from each body to the Sun, the J2000 ecliptic north pole,
// the body's orbit normal (normalize(r x v) relative to its orbit centre)
// and its orbital velocity direction, all in that body's own body-fixed frame
// (+Z north pole, +X prime meridian) at ${EPOCH_LABEL}, plus the body-fixed
// to ICRF rotation itself.
//
// Positions: VSOP87A parent-system barycentres plus moon-relative offsets;
// JPL Kepler elements for dwarf planets and satellites, ELP for the Moon.
// Satellite orbit elements are relative to their parent, not to the Sun.
// Parent-system barycentres approximate planet centres in this solar view.
// Existing planets retain their original preparation values.
// All vectors use ICRF. Orientation: IAU/WGCCRE elements, or the object-owned
// observed pole with explicitly arbitrary display meridian where supplied. Earth uses the
// Earth-Moon barycentre series.
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

export const BODY_FIXED_SUN_DIRECTIONS = Object.freeze({
${
  entries.map(({ body, direction, subsolarLatitudeDegrees, subsolarLongitudeDegrees }) =>
    `  // subsolar latitude ${subsolarLatitudeDegrees.toFixed(3)}°, ` +
    `longitude ${subsolarLongitudeDegrees.toFixed(3)}°\n` +
    `  ${body}: Object.freeze([\n` +
    direction.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

export const BODY_FIXED_ECLIPTIC_NORTH_DIRECTIONS = Object.freeze({
${
  entries.map(({ body, eclipticNorth, poleTiltDegrees, sunEclipticLatitudeDegrees }) =>
    `  // pole tilt to the ecliptic ${poleTiltDegrees.toFixed(3)}°, ` +
    `Sun ecliptic latitude ${sunEclipticLatitudeDegrees.toFixed(3)}°\n` +
    `  ${body}: Object.freeze([\n` +
    eclipticNorth.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// The orbit lies in the plane perpendicular to this direction; every
// direction from the body to another point of its orbit does too.
export const BODY_FIXED_ORBIT_NORMAL_DIRECTIONS = Object.freeze({
${
  entries.map(({ body, orbitNormal, orbitInclinationDegrees, obliquityToOrbitDegrees }) =>
    `  // orbital inclination to the ecliptic ${orbitInclinationDegrees.toFixed(3)}°, ` +
    `obliquity to the orbit ${obliquityToOrbitDegrees.toFixed(3)}°\n` +
    `  ${body}: Object.freeze([\n` +
    orbitNormal.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// Direction of the body's heliocentric velocity: the tangent of its orbit at
// the epoch, perpendicular to the orbit normal but not to the Sun direction
// (the flight-path angle is the orbit's eccentricity showing).
export const BODY_FIXED_ORBITAL_VELOCITY_DIRECTIONS = Object.freeze({
${
  entries.map(({ body, orbitalVelocity, flightPathAngleDegrees }) =>
    `  // flight-path angle ${flightPathAngleDegrees.toFixed(3)}°\n` +
    `  ${body}: Object.freeze([\n` +
    orbitalVelocity.map((component) => `    ${component},\n`).join("") +
    `  ]),`).join("\n")
}
});

// Body-fixed to ICRF rotation, row-major: the columns are the body's +X
// (prime meridian), +Y and +Z (north pole) axes in ICRF, so an ICRF direction
// is the matrix times a body-fixed direction and the transpose goes back.
export const BODY_FIXED_TO_ICRF_MATRICES = Object.freeze({
${
  entries.map(({ body, matrix, poleRightAscensionDegrees, poleDeclinationDegrees, primeMeridianDegrees }) =>
    `  // pole RA ${poleRightAscensionDegrees.toFixed(3)}°, ` +
    `Dec ${poleDeclinationDegrees.toFixed(3)}°, ` +
    `prime meridian W ${primeMeridianDegrees.toFixed(3)}°\n` +
    `  ${body}: Object.freeze([\n` +
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
export const BODY_ORBITS = Object.freeze({
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
    `perihelion ${perihelionAu.toPrecision(5)} AU, aphelion ${aphelionAu.toPrecision(5)} AU\n` +
    `  ${body}: Object.freeze({\n` +
    (parent === "sun" ? "" : `    centerBodyId: ${JSON.stringify(parent)},\n    centerPositionAu: Object.freeze(${JSON.stringify(centerPositionAu)}),\n`) +
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

export function requireBodyFixedSunDirection(bodyId) {
  const direction = BODY_FIXED_SUN_DIRECTIONS[bodyId];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedToIcrf(bodyId) {
  const matrix = BODY_FIXED_TO_ICRF_MATRICES[bodyId];
  if (matrix === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return matrix;
}

export function requireBodyFixedEclipticNorth(bodyId) {
  const direction = BODY_FIXED_ECLIPTIC_NORTH_DIRECTIONS[bodyId];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedOrbitNormal(bodyId) {
  const direction = BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[bodyId];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyFixedOrbitalVelocity(bodyId) {
  const direction = BODY_FIXED_ORBITAL_VELOCITY_DIRECTIONS[bodyId];
  if (direction === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return direction;
}

export function requireBodyOrbit(bodyId) {
  const orbit = BODY_ORBITS[bodyId];
  if (orbit === undefined) {
    throw new TypeError(\`No prepared solar geometry for body: \${bodyId}.\`);
  }
  return orbit;
}
`;

const target = resolve(
  import.meta.dirname,
  "../src/platform/solar-geometry.mjs",
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

function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze(vector.map((component) => component / magnitude));
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

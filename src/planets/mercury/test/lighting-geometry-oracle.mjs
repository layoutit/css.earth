// Independent oracle for the Mercury lighting and sky geometry browser suite.
//
// Everything here is derived from raw astronomy and its own vector maths. It
// deliberately imports nothing from src/platform or src/planets: the published
// solar geometry, presentation frame, view-direction and sky-registration
// helpers are the code under test, and an expectation computed with them would
// agree with any wrong render they produce.
//
// Inputs:
//   - Mercury's heliocentric position at the pinned epoch, ICRF axes, from the
//     vendored astronomy package's build (VSOP87A; `pnpm build:astronomy`)
//     when it is available, otherwise from a checked-in JPL Horizons vector
//     (see FALLBACK_EPHEMERIS).
//   - Mercury's pole from the IAU/WGCCRE rotation elements (the package when
//     available, otherwise the 2015 WGCCRE report formulas evaluated here).
//   - The J2000 obliquity (IAU 1976: 84381.448 arcsec).
//   - The J2000 galactic frame constants (Hipparcos vol. 1 §1.5.3).
//
// Scene contract the oracle encodes (a design decision of the Mercury scene,
// not an implementation detail): at scene pitch 0 and yaw 0, screen up is J2000
// ecliptic north and screen left is the Sun's projection onto the ecliptic
// plane. The camera pose is whatever rotation is painted on `.mercury-scene`;
// the suite reads it from the DOM and hands it to the oracle. CSS coordinates:
// +x right, +y down, +z toward the viewer.

export const EPOCH_JD_TT = 2461286.5;

// The workspace package, through its own build (packages/astronomy/dist).
const DEFAULT_ASTRONOMY_URL = "@cssearth/astronomy";

// IAU 1976 obliquity of the ecliptic at J2000 (84381.448 arcsec).
export const OBLIQUITY_J2000_DEGREES = 84381.448 / 3600;

// Provenance: JPL Horizons, target 199 (Mercury), center 500@10 (Sun),
// vectors, reference frame ICRF, TT, TLIST 2461286.5 (2026-Sep-03 00:00 TT).
// Query: https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='199'
//   &EPHEM_TYPE='VECTORS'&CENTER='500@10'&TLIST='2461286.5'&TIME_TYPE='TT'
//   &REF_PLANE='FRAME'&REF_SYSTEM='ICRF'&VEC_TABLE='1'&OUT_UNITS='AU-D'
// Pole: WGCCRE 2015 report (Archinal et al. 2018), Mercury
//   alpha0 = 281.0103 - 0.0328 T, delta0 = 61.4155 - 0.0049 T,
//   T in Julian centuries from J2000 TT.
export const FALLBACK_EPHEMERIS = Object.freeze({
  source: "JPL Horizons vectors (ICRF, 500@10) + WGCCRE 2015 pole formulas",
  heliocentricIcrfAu: Object.freeze([
    -3.882430086973875e-1,
    -2.361235376768871e-2,
    2.762267660427689e-2,
  ]),
  pole: (() => {
    const T = (EPOCH_JD_TT - 2451545.0) / 36525;
    return Object.freeze({
      rightAscensionDegrees: 281.0103 - 0.0328 * T,
      declinationDegrees: 61.4155 - 0.0049 * T,
    });
  })(),
});

export async function loadMercuryEphemeris({
  astronomyUrl = process.env.CSSEARTH_ASTRONOMY_URL ?? DEFAULT_ASTRONOMY_URL,
} = {}) {
  let astronomy = null;
  try {
    astronomy = await import(astronomyUrl);
  } catch {
    astronomy = null;
  }
  if (astronomy === null) {
    return Object.freeze({
      ...FALLBACK_EPHEMERIS,
      fallback: true,
    });
  }
  const heliocentricIcrfAu = astronomy.systemBarycentreHeliocentricAu(
    "mercury",
    EPOCH_JD_TT,
  );
  const elements = astronomy.bodyRotationAt("mercury", EPOCH_JD_TT);
  const ephemeris = Object.freeze({
    source: `astronomy package (VSOP87A + IAU/WGCCRE) at ${astronomyUrl}`,
    fallback: false,
    heliocentricIcrfAu: Object.freeze([...heliocentricIcrfAu]),
    pole: Object.freeze({
      rightAscensionDegrees: elements.poleRightAscensionRad * 180 / Math.PI,
      declinationDegrees: elements.poleDeclinationRad * 180 / Math.PI,
    }),
  });
  // The live build must agree with the independently sourced table; a
  // disagreement means one of the two is not describing this epoch.
  const separation = angleBetweenDegrees(
    ephemeris.heliocentricIcrfAu,
    FALLBACK_EPHEMERIS.heliocentricIcrfAu,
  );
  if (separation > 0.01) {
    throw new Error(
      `Astronomy package Mercury position disagrees with the Horizons vector by ` +
        `${separation.toFixed(4)} degrees.`,
    );
  }
  return ephemeris;
}

// J2000 galactic frame: north galactic pole and the galactic centre direction
// in ICRS (Hipparcos vol. 1 §1.5.3; the centre RA/Dec is the same frame's
// l = 0, b = 0 as tabulated by astropy's Galactic frame definition).
export const GALACTIC_FRAME = Object.freeze({
  northPole: Object.freeze({ raDegrees: 192.85948, decDegrees: 27.12825 }),
  centre: Object.freeze({ raDegrees: 266.404996, decDegrees: -28.936172 }),
});

// Catalogue galactic coordinates (NED / SIMBAD, J2000) of compact objects the
// ESO panorama shows as bright blobs.
export const SKY_ANCHORS = Object.freeze([
  Object.freeze({ name: "LMC", l: 280.47, b: -32.89, extentDegrees: 5 }),
  Object.freeze({ name: "SMC", l: 302.8, b: -44.3, extentDegrees: 3 }),
  Object.freeze({ name: "M42", l: 209.01, b: -19.38, extentDegrees: 1 }),
  Object.freeze({ name: "M31", l: 121.17, b: -21.57, extentDegrees: 2 }),
  Object.freeze({ name: "M45", l: 166.57, b: -23.52, extentDegrees: 1.5 }),
]);

export function buildOracle(ephemeris) {
  const sunIcrf = normalize(scale(ephemeris.heliocentricIcrfAu, -1));
  const obliquity = OBLIQUITY_J2000_DEGREES * Math.PI / 180;
  // ICRF +z tilted about +x by the obliquity is the ecliptic north pole.
  const eclipticNorthIcrf = [0, -Math.sin(obliquity), Math.cos(obliquity)];
  const sunInPlane = normalize(subtract(
    sunIcrf,
    scale(eclipticNorthIcrf, dot(sunIcrf, eclipticNorthIcrf)),
  ));
  // Presentation axes in ICRF: screen left is the Sun's ecliptic projection,
  // screen up is ecliptic north (CSS +y is down), +z completes a right-handed
  // frame and points toward the viewer at zero yaw.
  const xAxis = scale(sunInPlane, -1);
  const yAxis = scale(eclipticNorthIcrf, -1);
  const zAxis = cross(xAxis, yAxis);
  const icrfToPresentation = (direction) => [
    dot(xAxis, direction),
    dot(yAxis, direction),
    dot(zAxis, direction),
  ];
  const sunEclipticLatitudeDegrees =
    Math.asin(dot(sunIcrf, eclipticNorthIcrf)) * 180 / Math.PI;
  const sunPresentation = icrfToPresentation(sunIcrf);
  const poleIcrf = directionFromRaDec(
    ephemeris.pole.rightAscensionDegrees,
    ephemeris.pole.declinationDegrees,
  );
  const polePresentation = icrfToPresentation(poleIcrf);
  const galactic = galacticBasis();
  const galacticToIcrf = ([l, b]) => {
    const [gx, gy, gz] = directionFromDegrees(l, b);
    return normalize([
      galactic.x[0] * gx + galactic.y[0] * gy + galactic.z[0] * gz,
      galactic.x[1] * gx + galactic.y[1] * gy + galactic.z[1] * gz,
      galactic.x[2] * gx + galactic.y[2] * gy + galactic.z[2] * gz,
    ]);
  };
  const northGalacticPolePresentation = icrfToPresentation(galactic.z);
  return Object.freeze({
    epochJdTt: EPOCH_JD_TT,
    ephemerisSource: ephemeris.source,
    sunIcrf,
    eclipticNorthIcrf,
    sunEclipticLatitudeDegrees,
    // The physical subsolar latitude, frame-free.
    subsolarLatitudeDegrees: Math.asin(dot(sunIcrf, poleIcrf)) * 180 / Math.PI,
    sunPresentation,
    polePresentation,
    poleTiltDegrees:
      Math.acos(dot(poleIcrf, eclipticNorthIcrf)) * 180 / Math.PI,
    // Inclination of the galactic plane to the ecliptic.
    galacticPlaneInclinationDegrees:
      Math.acos(Math.abs(dot(galactic.z, eclipticNorthIcrf))) * 180 / Math.PI,
    icrfToPresentation,
    galacticToIcrf,
    galacticToPresentation: (lb) => icrfToPresentation(galacticToIcrf(lb)),
    northGalacticPolePresentation,
    // A camera pose is the painted scene rotation, row-major 3x3 in CSS
    // coordinates; a presentation direction becomes a CSS view direction.
    view(pose, presentationDirection) {
      return normalize(applyMatrix(pose, presentationDirection));
    },
  });
}

// Screen readings of a CSS view direction (x right, y down, z toward viewer).
export function litDirectionDegrees([x, y]) {
  return Math.atan2(-y, x) * 180 / Math.PI;
}

export function illuminatedFraction([, , z]) {
  return (1 + z) / 2;
}

// Perspective projection of a far direction onto the screen, in CSS pixels
// from the view centre (y down), for a focal length in pixels. Null when the
// direction is not in front of the camera.
export function projectDirection(direction, focalPixels) {
  const [x, y, z] = direction;
  if (!(z < 0)) return null;
  return [focalPixels * x / -z, focalPixels * y / -z];
}

// Principal axis of weighted screen samples, degrees from horizontal with y
// up, in [0, 180).
export function principalAxisDegrees(samples) {
  let weight = 0;
  let meanX = 0;
  let meanY = 0;
  for (const [x, y, k] of samples) {
    weight += k;
    meanX += k * x;
    meanY += k * y;
  }
  meanX /= weight;
  meanY /= weight;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [x, y, k] of samples) {
    const dx = x - meanX;
    const dy = -(y - meanY);
    xx += k * dx * dx;
    yy += k * dy * dy;
    xy += k * dx * dy;
  }
  return (0.5 * Math.atan2(2 * xy, xx - yy) * 180 / Math.PI + 180) % 180;
}

// The painted CSS transform of the scene, as a row-major 3x3 rotation. The
// scene transform is `scale(s) matrix3d(...)`; matrix3d lists columns first,
// so element (row i, column j) is value[j * 4 + i].
export function parseSceneRotation(cssTransform) {
  const match = /matrix3d\(([^)]+)\)/u.exec(cssTransform);
  if (!match) throw new Error(`No matrix3d in transform: ${cssTransform}`);
  const values = match[1].split(",").map(Number);
  if (values.length !== 16 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Unreadable matrix3d: ${cssTransform}`);
  }
  const matrix = [
    values[0], values[4], values[8],
    values[1], values[5], values[9],
    values[2], values[6], values[10],
  ];
  // Must be a pure rotation (the scene scale is stripped separately).
  const columns = [0, 1, 2].map((column) =>
    [matrix[column], matrix[3 + column], matrix[6 + column]]);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const expected = i === j ? 1 : 0;
      // The browser serialises the painted matrix to six decimals.
      if (Math.abs(dot(columns[i], columns[j]) - expected) > 1e-4) {
        throw new Error(`Scene transform is not a rotation: ${cssTransform}`);
      }
    }
  }
  if (dot(cross(columns[0], columns[1]), columns[2]) < 0) {
    throw new Error(`Scene transform is a reflection: ${cssTransform}`);
  }
  return matrix;
}

// Decomposes a pose into the Rx(pitch) * Ry(yaw) angles it was built from
// (for reporting; the oracle itself only ever uses the matrix).
export function scenePitchYawDegrees(matrix) {
  // Rx(p) Ry(y): row 2 = [ -sin? ...]. Compute from the image of +z and +x.
  const zImage = applyMatrix(matrix, [0, 0, 1]);
  const xImage = applyMatrix(matrix, [1, 0, 0]);
  // Ry(y) maps +x to (cos y, 0, -sin y) and +z to (sin y, 0, cos y); Rx(p)
  // then leaves x alone and takes (0, 0, c) to (0, -c sin p, c cos p).
  const yaw = Math.atan2(-xImage[2], xImage[0]) * 180 / Math.PI;
  const pitch = Math.atan2(-zImage[1], zImage[2]) * 180 / Math.PI;
  return { pitchDegrees: pitch, yawDegrees: yaw };
}

export function rotationX(degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [1, 0, 0, 0, cos, -sin, 0, sin, cos];
}

export function rotationY(degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, 0, sin, 0, 1, 0, -sin, 0, cos];
}

export function multiplyMatrices(a, b) {
  const result = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    }
  }
  return result;
}

export function applyMatrix(matrix, [x, y, z]) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

export function directionFromRaDec(raDegrees, decDegrees) {
  return directionFromDegrees(raDegrees, decDegrees);
}

export function directionFromDegrees(longitudeDegrees, latitudeDegrees) {
  const longitude = longitudeDegrees * Math.PI / 180;
  const latitude = latitudeDegrees * Math.PI / 180;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ];
}

export function angleBetweenDegrees(a, b) {
  const cosine = dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function wrapDegrees(degrees) {
  return ((degrees % 360) + 540) % 360 - 180;
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

export function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(vector, factor) {
  return vector.map((component) => component * factor);
}

export function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return vector.map((component) => component / magnitude);
}

function galacticBasis() {
  const z = directionFromRaDec(
    GALACTIC_FRAME.northPole.raDegrees,
    GALACTIC_FRAME.northPole.decDegrees,
  );
  const centre = directionFromRaDec(
    GALACTIC_FRAME.centre.raDegrees,
    GALACTIC_FRAME.centre.decDegrees,
  );
  const x = normalize(subtract(centre, scale(z, dot(centre, z))));
  const y = cross(z, x);
  return { x, y, z };
}

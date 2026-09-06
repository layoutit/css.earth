// Independent oracle for the Mercury planetary-system browser suite.
//
// Like lighting-geometry-oracle.mjs, this imports nothing from src/platform
// or src/planets: the prepared system (positions, rings, extents) and the
// runtime projection are the code under test. Everything here comes from raw
// astronomy and its own vector maths:
//   - every planet's heliocentric state vector (position and velocity, ICRF
//     axes, au and au/day) at the pinned epoch from the vendored astronomy
//     package's build (VSOP87A) when it is available, otherwise from the
//     checked-in table below;
//   - the Gaussian gravitational constant for the vis-viva semi-major axis;
//   - the presentation frame from the lighting oracle (screen up is ecliptic
//     north, screen left is the Sun's ecliptic projection at pitch 0, yaw 0);
//   - a pinhole camera read off the page: the sky's vanishing point and focal
//     length, the camera root's centre, the painted scene rotation and the
//     camera's reported distance from Mercury in kilometres.
// From those it predicts where every orbit and every planet should be
// painted, and it back-projects painted pixels into each orbit's plane so a
// semi-major axis can be recovered from pixels alone.

import {
  EPOCH_JD_TT,
  buildOracle,
  cross,
  dot,
  normalize,
  scale,
  subtract,
} from "./lighting-geometry-oracle.mjs";

export const PLANETS = Object.freeze([
  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
]);
// The five dwarf planets: their state vectors come from the astronomy
// package's Keplerian propagation of JPL Horizons osculating elements
// (ICRF, heliocentric, epoch 2026-Jan-01); there is no checked-in fallback,
// so their checks need the package build.
export const DWARF_PLANETS = Object.freeze(["ceres", "pluto", "haumea", "makemake", "eris"]);

// Textbook mean semi-major axes (NASA planetary fact sheet, au): the
// end-to-end reference the painted orbit ratios are checked against. They
// differ from the osculating values at the epoch by up to 0.4 % (Uranus).
export const TEXTBOOK_SEMI_MAJOR_AXES_AU = Object.freeze({
  mercury: 0.387, venus: 0.723, earth: 1.000, mars: 1.524,
  jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07,
  // JPL SBDB / NASA dwarf planet fact sheets (mean values).
  ceres: 2.77, pluto: 39.48, haumea: 43.1, makemake: 45.4, eris: 67.9,
});

// IAU 2012 astronomical unit and the Gaussian gravitational constant
// (GM_sun = k^2 au^3/day^2).
export const AU_KILOMETERS = 149597870.7;
export const GM_SUN_AU3_PER_DAY2 = 0.01720209895 ** 2;

// Provenance: VSOP87A heliocentric state vectors, ICRF axes, at
// 2461286.5 TT, evaluated once with the vendored astronomy build
// (packages/astronomy, `pnpm build:astronomy`) on 2026-09-05. Earth is the
// Earth-Moon barycentre series. The lighting oracle cross-checks Mercury's
// vector against an independent JPL Horizons query to 0.01 degrees.
export const FALLBACK_STATE_VECTORS = Object.freeze({
  mercury: Object.freeze({
    heliocentricIcrfAu: Object.freeze([-0.3882429792218556, -0.023612415137900043, 0.027622453364987018]),
    velocityAuPerDay: Object.freeze([-0.005080144797379011, -0.024005363547536362, -0.012297354179239986]),
  }),
  venus: Object.freeze({
    heliocentricIcrfAu: Object.freeze([0.45894961006345486, -0.5041785399870903, -0.2559018690466544]),
    velocityAuPerDay: Object.freeze([0.015558427362917206, 0.011929612039044295, 0.004383688561666686]),
  }),
  earth: Object.freeze({
    heliocentricIcrfAu: Object.freeze([0.9489610914480363, -0.31414761618664755, -0.1361832251634286]),
    velocityAuPerDay: Object.freeze([0.005560120478602589, 0.014789070268656838, 0.006410751102310317]),
  }),
  mars: Object.freeze({
    heliocentricIcrfAu: Object.freeze([0.4949941546043008, 1.313760807009756, 0.5892412526517539]),
    velocityAuPerDay: Object.freeze([-0.012702666327005155, 0.005094284442094262, 0.00267923100670301]),
  }),
  jupiter: Object.freeze({
    heliocentricIcrfAu: Object.freeze([-3.326033915590773, 3.760153740457147, 1.6926646054140468]),
    velocityAuPerDay: Object.freeze([-0.00596607527826602, -0.0040876822006184485, -0.001606861030588273]),
  }),
  saturn: Object.freeze({
    heliocentricIcrfAu: Object.freeze([9.295814707268446, 1.6386579164717234, 0.27650940404668733]),
    velocityAuPerDay: Object.freeze([-0.0012636846108351947, 0.00504825942592247, 0.002139429500913363]),
  }),
  uranus: Object.freeze({
    heliocentricIcrfAu: Object.freeze([9.029531427921114, 15.82277414602926, 6.802117963444454]),
    velocityAuPerDay: Object.freeze([-0.003518440638629481, 0.001484846857764837, 0.0007001423708363391]),
  }),
  neptune: Object.freeze({
    heliocentricIcrfAu: Object.freeze([29.84215649682048, 1.469606909356075, -0.14138079522491598]),
    velocityAuPerDay: Object.freeze([-0.00016211305251245795, 0.0029166629826775183, 0.0011977855914872169]),
  }),
});

// Geometric albedos (NASA planetary fact sheet) and mean radii (IAU/WGCCRE,
// km): the only non-geometric inputs of the brightness model below.
export const GEOMETRIC_ALBEDO = Object.freeze({
  mercury: 0.142, venus: 0.689, earth: 0.434, mars: 0.170,
  jupiter: 0.538, saturn: 0.499, uranus: 0.488, neptune: 0.442,
  pluto: 0.52, ceres: 0.09, eris: 0.96, haumea: 0.80, makemake: 0.81,
});
export const MEAN_RADIUS_KILOMETERS = Object.freeze({
  mercury: 2439.4, venus: 6051.8, earth: 6371.0, mars: 3389.5,
  jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622,
  pluto: 1188.3, ceres: 469.7, eris: 1163, haumea: 797.6, makemake: 738.8,
});
// Seconds per day and the au, for the dwarf planets' km/day state vectors.
const SECONDS_PER_DAY = 86400;

// Lambert sphere phase function: the share of the geometric-albedo flux a
// diffusely reflecting sphere sends toward an observer at phase angle alpha.
export function lambertPhaseFunction(alphaRadians) {
  return ((Math.PI - alphaRadians) * Math.cos(alphaRadians) + Math.sin(alphaRadians)) / Math.PI;
}

const DEFAULT_ASTRONOMY_URL = "@cssearth/astronomy";

export async function loadPlanetStateVectors({
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
      source: "checked-in VSOP87A table (FALLBACK_STATE_VECTORS)",
      fallback: true,
      vectors: FALLBACK_STATE_VECTORS,
    });
  }
  const vectors = {};
  for (const id of PLANETS) {
    const key = id === "earth" ? "emb" : id;
    vectors[id] = Object.freeze({
      heliocentricIcrfAu: Object.freeze([...astronomy.systemBarycentreHeliocentricAu(key, EPOCH_JD_TT)]),
      velocityAuPerDay: Object.freeze([...astronomy.systemBarycentreVelocityAuPerDay(key, EPOCH_JD_TT)]),
    });
    // The live build and the checked-in table must describe the same epoch.
    const separation = angleDegrees(vectors[id].heliocentricIcrfAu, FALLBACK_STATE_VECTORS[id].heliocentricIcrfAu);
    if (separation > 0.01) {
      throw new Error(`${id}: the astronomy build disagrees with the checked-in vector by ${separation.toFixed(4)} degrees.`);
    }
  }
  // Dwarf planets: Keplerian state at the epoch, km and km/day, into au.
  const dwarfVectors = {};
  for (const id of DWARF_PLANETS) {
    const state = astronomy.keplerStateKm(astronomy.dwarfPlanetElements(id), EPOCH_JD_TT);
    dwarfVectors[id] = Object.freeze({
      heliocentricIcrfAu: Object.freeze(state.positionKm.map((value) => value / AU_KILOMETERS)),
      velocityAuPerDay: Object.freeze(state.velocityKmPerDay.map((value) => value / AU_KILOMETERS)),
    });
  }
  return Object.freeze({
    source: `astronomy package (VSOP87A, Keplerian dwarf planets) at ${astronomyUrl}`,
    fallback: false,
    vectors: Object.freeze(vectors),
    dwarfVectors: Object.freeze(dwarfVectors),
  });
}

// The system as seen from Mercury, in kilometres in the presentation frame:
// the Sun, and for every other planet its position, orbital plane and the
// true ellipse from its own state vector (vis-viva and the eccentricity
// vector, no orbital elements as input).
export function buildSystemOracle(state) {
  const mercury = state.vectors.mercury;
  const lighting = buildOracle({
    source: state.source,
    heliocentricIcrfAu: mercury.heliocentricIcrfAu,
    // The pole plays no part here; the lighting oracle wants one.
    pole: { rightAscensionDegrees: 281.01, declinationDegrees: 61.42 },
  });
  const toPresentationKm = (vectorAu) =>
    scale(lighting.icrfToPresentation(vectorAu), AU_KILOMETERS);
  const sun = toPresentationKm(scale(mercury.heliocentricIcrfAu, -1));
  const bodies = {};
  const allVectors = { ...state.vectors, ...(state.dwarfVectors ?? {}) };
  for (const id of Object.keys(allVectors)) {
    const { heliocentricIcrfAu: r, velocityAuPerDay: v } = allVectors[id];
    const distance = Math.hypot(...r);
    const speedSquared = dot(v, v);
    const semiMajorAxisAu = 1 / (2 / distance - speedSquared / GM_SUN_AU3_PER_DAY2);
    const radialSpeed = dot(r, v);
    const eccentricityVector = r.map((component, index) =>
      ((speedSquared - GM_SUN_AU3_PER_DAY2 / distance) * component - radialSpeed * v[index]) /
        GM_SUN_AU3_PER_DAY2);
    const eccentricity = Math.hypot(...eccentricityVector);
    const perihelionIcrf = normalize(eccentricityVector);
    const normalIcrf = normalize(cross(r, v));
    // Presentation-frame, Mercury-centred, kilometres.
    const position = add(sun, toPresentationKm(r));
    const velocity = toPresentationKm(v);
    const normal = lighting.icrfToPresentation(normalIcrf);
    const perihelion = lighting.icrfToPresentation(perihelionIcrf);
    const motion = normalize(cross(normal, perihelion));
    const a = semiMajorAxisAu * AU_KILOMETERS;
    const b = a * Math.sqrt(1 - eccentricity * eccentricity);
    const centre = add(sun, scale(perihelion, -a * eccentricity));
    const pointAt = (eccentricAnomaly) => add(
      centre,
      add(scale(perihelion, a * Math.cos(eccentricAnomaly)), scale(motion, b * Math.sin(eccentricAnomaly))),
    );
    // The body's own eccentric anomaly on that ellipse, from its position.
    const fromCentre = subtract(position, centre);
    const eccentricAnomaly = Math.atan2(dot(fromCentre, motion) / b, dot(fromCentre, perihelion) / a);
    bodies[id] = Object.freeze({
      id,
      eccentricAnomaly,
      semiMajorAxisAu,
      eccentricity,
      perihelionAu: semiMajorAxisAu * (1 - eccentricity),
      aphelionAu: semiMajorAxisAu * (1 + eccentricity),
      heliocentricDistanceAu: distance,
      position,
      // Kilometres per day, presentation frame: the direction of motion.
      velocity,
      normal,
      pointAt,
    });
  }
  // Illumination as seen from Mercury (the observer at the origin): the
  // phase angle Sun-body-observer, the illuminated fraction, and the flux
  // p R^2 Phi(alpha) / (r^2 d^2) relative to the brightest body.
  const illumination = {};
  let brightest = 0;
  for (const id of Object.keys(allVectors)) {
    if (id === "mercury") continue;
    const body = bodies[id];
    const toSun = subtract(sun, body.position);
    const toObserver = scale(body.position, -1);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1,
      dot(toSun, toObserver) / (Math.hypot(...toSun) * Math.hypot(...toObserver)))));
    const flux = GEOMETRIC_ALBEDO[id] * MEAN_RADIUS_KILOMETERS[id] ** 2 * lambertPhaseFunction(phaseAngle) /
      (Math.hypot(...toSun) ** 2 * Math.hypot(...toObserver) ** 2);
    illumination[id] = { phaseAngleDegrees: phaseAngle * 180 / Math.PI,
      illuminatedFraction: (1 + Math.cos(phaseAngle)) / 2, flux };
    brightest = Math.max(brightest, flux);
  }
  for (const id of Object.keys(illumination)) {
    illumination[id].fluxShareOfBrightest = illumination[id].flux / brightest;
    illumination[id].magnitudesBelowBrightest = -2.5 * Math.log10(illumination[id].fluxShareOfBrightest);
    illumination[id] = Object.freeze(illumination[id]);
  }
  return Object.freeze({ epochJdTt: EPOCH_JD_TT, source: state.source, sun, bodies, lighting,
    illumination: Object.freeze(illumination), dwarfPlanets: Object.keys(state.dwarfVectors ?? {}) });
}

// A pinhole camera read off the page (page pixel coordinates, y down):
//   principal   the sky's vanishing point (the eye is `focal` in front of it);
//   rootCentre  where Mercury's centre is painted;
//   rotation    the painted scene rotation, row-major, scene -> eye axes;
//   distance    the eye's distance from Mercury's centre, kilometres.
// Eye space is the CSS camera-root space: x right, y down, z toward the
// viewer, the eye at the origin looking down -z.
export function createCamera({ principal, rootCentre, focal, rotation, distanceKm }) {
  const toBody = normalize([rootCentre[0] - principal[0], rootCentre[1] - principal[1], -focal]);
  const bodyEye = scale(toBody, distanceKm);
  const transpose = [
    rotation[0], rotation[3], rotation[6],
    rotation[1], rotation[4], rotation[7],
    rotation[2], rotation[5], rotation[8],
  ];
  const apply = (matrix, [x, y, z]) => [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
  const eyeScene = scale(apply(transpose, bodyEye), -1);
  return Object.freeze({
    focal,
    principal,
    eyeScene,
    // Scene (km, Mercury-centred) to page pixels; null behind the eye.
    project(pointScene) {
      const eye = add(apply(rotation, pointScene), bodyEye);
      const depth = -eye[2];
      if (!(depth > 0)) return null;
      return [principal[0] + focal * eye[0] / depth, principal[1] + focal * eye[1] / depth];
    },
    // The ray through a page pixel, intersected with a plane (point, normal)
    // in scene km; null when the plane is behind the eye or edge-on.
    backProject(pixel, planePoint, planeNormal) {
      const direction = apply(transpose, [pixel[0] - principal[0], pixel[1] - principal[1], -focal]);
      const denominator = dot(planeNormal, direction);
      if (Math.abs(denominator) < 1e-12) return null;
      const t = dot(planeNormal, subtract(planePoint, eyeScene)) / denominator;
      if (!(t > 0)) return null;
      return add(eyeScene, scale(direction, t));
    },
  });
}

// The oracle's prediction of an orbit on the page: the ellipse sampled and
// projected, as polar (angle, radius) about the projected Sun, sorted by
// angle, for interpolation by the radial scan.
export function predictOrbitPolar(camera, body, sunPixel, samples = 1440) {
  const polar = [];
  for (let index = 0; index < samples; index += 1) {
    const pixel = camera.project(body.pointAt(index / samples * 2 * Math.PI));
    if (pixel === null) continue;
    const dx = pixel[0] - sunPixel[0];
    const dy = pixel[1] - sunPixel[1];
    polar.push([Math.atan2(dy, dx), Math.hypot(dx, dy)]);
  }
  polar.sort((p, q) => p[0] - q[0]);
  return Object.freeze(polar);
}

// Radius of a polar polyline at an angle, by linear interpolation between
// the neighbouring samples (angles wrap).
export function polarRadiusAt(polar, angle) {
  if (polar.length < 2) return null;
  let low = 0;
  let high = polar.length - 1;
  if (angle < polar[0][0] || angle > polar[high][0]) {
    const [a0, r0] = polar[high];
    const [a1, r1] = polar[0];
    const span = a1 + 2 * Math.PI - a0;
    const offset = angle < polar[0][0] ? angle + 2 * Math.PI - a0 : angle - a0;
    return r0 + (r1 - r0) * offset / span;
  }
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (polar[middle][0] <= angle) low = middle;
    else high = middle;
  }
  const [a0, r0] = polar[low];
  const [a1, r1] = polar[high];
  return a1 === a0 ? r0 : r0 + (r1 - r0) * (angle - a0) / (a1 - a0);
}

// Least-squares fit of a conic with one focus at the origin to polar
// samples: 1 / r = A + B cos t + C sin t, so p = 1 / A, e = |(B, C)| / A and
// the semi-major axis a = p / (1 - e^2). Works on any arc, which is what a
// trail leaves; needs samples spanning a fair share of the ellipse.
export function fitFocalConic(samples) {
  let s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0, t1 = 0, t2 = 0, t3 = 0;
  for (const [angle, radius] of samples) {
    const c = Math.cos(angle), n = Math.sin(angle), y = 1 / radius;
    s11 += 1; s12 += c; s13 += n; s22 += c * c; s23 += c * n; s33 += n * n;
    t1 += y; t2 += y * c; t3 += y * n;
  }
  const solved = solve3([[s11, s12, s13], [s12, s22, s23], [s13, s23, s33]], [t1, t2, t3]);
  if (solved === null) return null;
  const [A, B, C] = solved;
  if (!(A > 0)) return null;
  const p = 1 / A;
  const e = Math.hypot(B, C) / A;
  if (!(e < 1)) return null;
  return { p, e, a: p / (1 - e * e), perihelionAngle: Math.atan2(C, B), samples: samples.length };
}

function solve3(m, v) {
  const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-30) return null;
  return [0, 1, 2].map((column) => det(m.map((row, i) => row.map((value, j) => j === column ? v[i] : value))) / d);
}

export function angleDegrees(a, b) {
  const cosine = dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

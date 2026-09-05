import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANETARY_SYSTEM_BODIES,
  SYSTEM_ORBIT_SEGMENTS,
  preparePlanetarySystem,
  MARKER_BRIGHTNESS,
  markerOpacityForMagnitudes,
  lambertPhaseFunction,
} from "./prepare-planetary-system.mjs";
import { prepareEclipticPresentationFrame } from "./solar-presentation-frame.mjs";
import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  BODY_FIXED_SUN_DIRECTIONS,
  BODY_FIXED_TO_ICRF_MATRICES,
  HELIOCENTRIC_ORBITS,
  SOLAR_GEOMETRY_EPOCH_JD_TT,
} from "./solar-geometry.mjs";
import { loadAstronomyPackage } from "./astronomy-package.mjs";

const MERCURY_RADIUS_UNITS = 230;
const MERCURY_RADIUS_KILOMETERS = 2439.7;
const KILOMETERS_PER_UNIT = MERCURY_RADIUS_KILOMETERS / MERCURY_RADIUS_UNITS;
const UNITS_PER_AU = ASTRONOMICAL_UNIT_KILOMETERS / KILOMETERS_PER_UNIT;

const presentationFrame = prepareEclipticPresentationFrame("mercury");

// The canonical order the module must nest its rings in, excluding the
// observer itself.
const OTHER_BODIES = PLANETARY_SYSTEM_BODIES.filter((id) => id !== "mercury");
// Planets first, innermost out; then the dwarf planets by semi-major axis.
const DWARFS = ["ceres", "pluto", "haumea", "makemake", "eris"];
const ALL_OTHER_BODIES = [...OTHER_BODIES, ...DWARFS];
const planetsOf = (system) => system.bodies.filter((body) => body.kind === "planet");
const dwarfsOf = (system) => system.bodies.filter((body) => body.kind === "dwarf-planet");

// Textbook semi-major axes (au), used only as a sanity bound independent of
// the checked-in VSOP87A-derived elements.
const TEXTBOOK_SEMI_MAJOR_AXIS_AU = {
  venus: 0.723,
  earth: 1.000,
  mars: 1.524,
  jupiter: 5.203,
  saturn: 9.537,
  uranus: 19.19,
  neptune: 30.07,
  ceres: 2.77, pluto: 39.48, haumea: 43.1, makemake: 45.4, eris: 67.9,
};

async function prepareMercurySystem(overrides = {}) {
  return preparePlanetarySystem({
    bodyId: "mercury",
    presentationFrame,
    kilometersPerUnit: KILOMETERS_PER_UNIT,
    ...overrides,
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

function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function magnitude(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

// Independent derivation of a body's position in the mercury-centred
// presentation frame, entirely from the checked-in solar geometry: the
// heliocentric ICRF position of each body (from its own body-fixed Sun
// direction and body-fixed-to-ICRF rotation), differenced at the Sun,
// rotated into Mercury's body-fixed frame with the transpose of Mercury's
// own rotation, then carried through the presentation frame and unit ladder.
// This does not call any of prepare-planetary-system.mjs's internals: it is
// a second, independent path to the same number.
function directPositionUnits(id) {
  const heliocentricIcrfKm = (bodyId) => scale(
    applyMatrix(BODY_FIXED_TO_ICRF_MATRICES[bodyId], BODY_FIXED_SUN_DIRECTIONS[bodyId]),
    -HELIOCENTRIC_ORBITS[bodyId].heliocentricDistanceAu * ASTRONOMICAL_UNIT_KILOMETERS,
  );
  const diffIcrfKm = subtract(heliocentricIcrfKm(id), heliocentricIcrfKm("mercury"));
  const mercuryToBodyFixed = transposeMatrix(BODY_FIXED_TO_ICRF_MATRICES.mercury);
  const bodyFixedKm = applyMatrix(mercuryToBodyFixed, diffIcrfKm);
  return scale(presentationFrame.toPresentation(bodyFixedKm), 1 / KILOMETERS_PER_UNIT);
}

test("prepares the other seven planets innermost first, then the five dwarf planets, each vertex 0 at the body", async () => {
  const system = await prepareMercurySystem();
  assert.deepEqual(system.bodies.map((body) => body.id), ALL_OTHER_BODIES);
  assert.deepEqual(system.planetIds, OTHER_BODIES);
  assert.deepEqual(system.dwarfPlanetIds, DWARFS);
  assert.deepEqual(planetsOf(system).map((body) => body.orbitSource), OTHER_BODIES.map(() => "vsop87a-state-vector-via-solar-geometry"));
  assert.deepEqual(dwarfsOf(system).map((body) => body.orbitSource), DWARFS.map(() => "jpl-horizons-osculating-elements-via-astronomy-package"));
  for (const body of system.bodies) {
    assert.deepEqual(body.orbit.vertices[0], body.position);
    assert.equal(body.orbit.vertexCount, SYSTEM_ORBIT_SEGMENTS);
    assert.equal(SYSTEM_ORBIT_SEGMENTS, 120);
  }
});

test("agrees with an independent frame-tree-free derivation of every body's position", async () => {
  const system = await prepareMercurySystem();
  // Dwarf planets: the package's own Keplerian position, differenced with
  // Mercury's VSOP87 position directly.
  const astronomy = await loadAstronomyPackage();
  const mercuryMatrix = BODY_FIXED_TO_ICRF_MATRICES.mercury;
  const transposed = [mercuryMatrix[0], mercuryMatrix[3], mercuryMatrix[6], mercuryMatrix[1], mercuryMatrix[4],
    mercuryMatrix[7], mercuryMatrix[2], mercuryMatrix[5], mercuryMatrix[8]];
  const mercuryKm = scale(applyMatrix(mercuryMatrix, BODY_FIXED_SUN_DIRECTIONS.mercury),
    -HELIOCENTRIC_ORBITS.mercury.heliocentricDistanceAu * ASTRONOMICAL_UNIT_KILOMETERS);
  for (const body of dwarfsOf(system)) {
    const heliocentricKm = astronomy.dwarfPlanetPositionKm(body.id, SOLAR_GEOMETRY_EPOCH_JD_TT);
    const bodyFixedKm = applyMatrix(transposed, subtract(heliocentricKm, mercuryKm));
    const direct = scale(presentationFrame.toPresentation(bodyFixedKm), 1 / KILOMETERS_PER_UNIT);
    const diff = magnitude(subtract(body.position, direct));
    assert.ok(diff <= Math.max(1, 1e-6 * magnitude(direct)), `${body.id}: ${diff}`);
  }
  for (const body of planetsOf(system)) {
    const direct = directPositionUnits(body.id);
    const diff = magnitude(subtract(body.position, direct));
    const tolerance = Math.max(1, 1e-6 * magnitude(direct));
    assert.ok(
      diff <= tolerance,
      `${body.id}: prepared position differs from the direct derivation by ${diff} (tolerance ${tolerance})`,
    );
  }
});

test("every ring vertex lies on the body's true ellipse between perihelion and aphelion", async () => {
  const system = await prepareMercurySystem();
  for (const body of system.bodies) {
    const perihelionUnits = body.perihelionAu * UNITS_PER_AU;
    const aphelionUnits = body.aphelionAu * UNITS_PER_AU;
    for (const vertex of body.orbit.vertices) {
      const r = magnitude(subtract(vertex, system.sun.position));
      assert.ok(r >= perihelionUnits * (1 - 1e-6),
        `${body.id}: vertex ${r} is inside perihelion ${perihelionUnits}`);
      assert.ok(r <= aphelionUnits * (1 + 1e-6),
        `${body.id}: vertex ${r} is outside aphelion ${aphelionUnits}`);
    }
  }
});

test("nests every orbit strictly outside the one before it, mercury included", async () => {
  const system = await prepareMercurySystem();
  // Mercury itself carries no ring in the output (it is the observer), so
  // the innermost pair is checked on the raw orbital facts alone.
  assert.ok(
    HELIOCENTRIC_ORBITS.venus.perihelionAu > HELIOCENTRIC_ORBITS.mercury.aphelionAu,
    "venus's perihelion must lie outside mercury's aphelion",
  );
  const planets = planetsOf(system);
  for (let index = 1; index < planets.length; index += 1) {
    const inner = planets[index - 1];
    const outer = planets[index];
    assert.ok(outer.perihelionAu > inner.aphelionAu,
      `${outer.id} perihelion does not clear ${inner.id} aphelion`);
    const innerMax = Math.max(...inner.orbit.vertices.map((vertex) =>
      magnitude(subtract(vertex, system.sun.position))));
    const outerMin = Math.min(...outer.orbit.vertices.map((vertex) =>
      magnitude(subtract(vertex, system.sun.position))));
    assert.ok(outerMin > innerMax,
      `${outer.id}'s closest vertex (${outerMin}) is not farther than ${inner.id}'s farthest (${innerMax})`);
  }
});

test("keeps each body's semi-major axis within half a percent of the textbook value", async () => {
  const system = await prepareMercurySystem();
  for (const body of system.bodies) {
    const textbook = TEXTBOOK_SEMI_MAJOR_AXIS_AU[body.id];
    const relativeError = Math.abs(body.semiMajorAxisAu - textbook) / textbook;
    assert.ok(relativeError < 0.005,
      `${body.id}: semiMajorAxisAu ${body.semiMajorAxisAu} is more than 0.5% off ${textbook}`);
  }
});

test("maximumExtentUnits bounds and equals every vertex and body position magnitude", async () => {
  const system = await prepareMercurySystem();
  let observedMaximum = magnitude(system.sun.position);
  for (const body of system.bodies) {
    observedMaximum = Math.max(observedMaximum, magnitude(body.position));
    for (const vertex of body.orbit.vertices) {
      const r = magnitude(vertex);
      assert.ok(r <= system.maximumExtentUnits,
        `${body.id}: a vertex at ${r} exceeds maximumExtentUnits ${system.maximumExtentUnits}`);
      observedMaximum = Math.max(observedMaximum, r);
    }
    assert.ok(magnitude(body.position) <= system.maximumExtentUnits);
  }
  assert.ok(Math.abs(observedMaximum - system.maximumExtentUnits) <=
    1e-6 * system.maximumExtentUnits);
});

test("places the Sun at Mercury's own observed heliocentric distance", async () => {
  const system = await prepareMercurySystem();
  const expected = HELIOCENTRIC_ORBITS.mercury.heliocentricDistanceAu * UNITS_PER_AU;
  const actual = magnitude(system.sun.position);
  assert.ok(Math.abs(actual - expected) <= 1e-9 * expected,
    `Sun distance ${actual} disagrees with ${expected}`);
});

test("rejects an unlisted body, a non-positive unit scale and a reflected presentation frame", async () => {
  await assert.rejects(
    prepareMercurySystem({ bodyId: "pluto" }),
    /Planetary system preparation arguments are invalid/u,
  );
  await assert.rejects(
    prepareMercurySystem({ kilometersPerUnit: 0 }),
    /Planetary system preparation arguments are invalid/u,
  );
  await assert.rejects(
    prepareMercurySystem({ kilometersPerUnit: -1 }),
    /Planetary system preparation arguments are invalid/u,
  );
  const reflectedBasis = [
    presentationFrame.basis[0],
    presentationFrame.basis[1],
    scale(presentationFrame.basis[2], -1),
  ];
  await assert.rejects(
    prepareMercurySystem({
      presentationFrame: { ...presentationFrame, basis: reflectedBasis },
    }),
    /must be a proper rotation/u,
  );
});

test("mutation check: an absurd planet radius trips the frame tree's own invariants", async () => {
  const astronomy = await loadAstronomyPackage();
  const brokenAstronomy = {
    ...astronomy,
    BODIES: {
      ...astronomy.BODIES,
      venus: { ...astronomy.BODIES.venus, meanRadiusKm: 1e12 },
    },
  };
  await assert.rejects(
    prepareMercurySystem({ astronomy: brokenAstronomy }),
    /exceeds its own eviction ball|frame venus/u,
  );
});

test("mutation check: the output's semi-major axes stay strictly increasing outward", async () => {
  // HELIOCENTRIC_ORBITS is frozen and cannot be mutated in place to simulate
  // a swap, so this instead pins down the property such a swap would break:
  // the prepared ring order is by increasing semi-major axis.
  const system = await prepareMercurySystem();
  const axes = planetsOf(system).map((body) => body.semiMajorAxisAu);
  const dwarfAxes = dwarfsOf(system).map((body) => body.semiMajorAxisAu);
  for (let index = 1; index < dwarfAxes.length; index += 1) {
    assert.ok(dwarfAxes[index] > dwarfAxes[index - 1], `dwarf planets are ordered by semi-major axis: ${dwarfAxes}`);
  }
  for (let index = 1; index < axes.length; index += 1) {
    assert.ok(axes[index] > axes[index - 1],
      `semiMajorAxisAu is not strictly increasing at index ${index}: ${axes}`);
  }
});

// Illumination and brightness, prepared from Mercury's vantage.
test("lights every body from Mercury's vantage: phase from Sun-body-observer, only Venus can ever be a crescent", async () => {
  const system = await preparePlanetarySystem({ bodyId: "mercury", presentationFrame: prepareEclipticPresentationFrame("mercury"), kilometersPerUnit: 2439.7 / 230 });
  const sun = system.sun.position;
  for (const body of system.bodies) {
    // Recomputed here from the body's own position: the angle at the body
    // between the Sun and the observer at the origin.
    const toSun = sun.map((c, i) => c - body.position[i]);
    const toObserver = body.position.map((c) => -c);
    const cosine = (toSun[0] * toObserver[0] + toSun[1] * toObserver[1] + toSun[2] * toObserver[2]) /
      (Math.hypot(...toSun) * Math.hypot(...toObserver));
    const phase = Math.acos(cosine) * 180 / Math.PI;
    // Positions are rounded to whole units after the phase was computed:
    // a few 1e-8 relative, well under a millidegree.
    assert.ok(Math.abs(body.illumination.phaseAngleDegrees - phase) < 1e-3, body.id);
    assert.ok(Math.abs(body.illumination.illuminatedFraction - (1 + cosine) / 2) < 1e-6, body.id);
    assert.ok(Math.abs(body.illumination.lightViewZ - cosine) < 1e-6, body.id);
    // Geometry: a body outside the observer's orbit can never be seen at a
    // phase angle beyond asin(observer aphelion / body perihelion).
    if (body.id !== "venus") {
      const bound = Math.asin(HELIOCENTRIC_ORBITS.mercury.aphelionAu / body.perihelionAu) * 180 / Math.PI;
      assert.ok(body.illumination.phaseAngleDegrees <= bound + 1e-9, `${body.id} phase ${body.illumination.phaseAngleDegrees} > ${bound}`);
      assert.ok(body.illumination.illuminatedFraction >= 0.9, body.id);
    }
  }
  const jupiterOut = system.bodies.filter(({ id }) => ["jupiter", "saturn", "uranus", "neptune"].includes(id));
  assert.ok(jupiterOut.every((body) => body.illumination.illuminatedFraction >= 0.99));
});

test("marker brightness falls with magnitudes below the brightest and floors, Venus opaque, Neptune on the floor", async () => {
  const system = await preparePlanetarySystem({ bodyId: "mercury", presentationFrame: prepareEclipticPresentationFrame("mercury"), kilometersPerUnit: 2439.7 / 230 });
  const byFlux = [...system.bodies].sort((a, b) => b.illumination.flux - a.illumination.flux);
  assert.equal(byFlux[0].id, "venus");
  // Every dwarf planet sits on the floor; Neptune is the faintest planet.
  assert.equal(byFlux.at(-1).kind, "dwarf-planet");
  assert.equal(planetsOf(system).sort((a, b) => a.illumination.flux - b.illumination.flux)[0].id, "neptune");
  assert.equal(byFlux[0].illumination.markerOpacity, 1);
  assert.equal(byFlux.at(-1).illumination.markerOpacity, MARKER_BRIGHTNESS.floor);
  for (let index = 1; index < byFlux.length; index += 1) {
    assert.ok(byFlux[index].illumination.markerOpacity <= byFlux[index - 1].illumination.markerOpacity);
    assert.ok(byFlux[index].illumination.magnitudesBelowBrightest >= byFlux[index - 1].illumination.magnitudesBelowBrightest);
  }
  // At least three distinct opacities: never stickers of one intensity.
  assert.ok(new Set(system.bodies.map((body) => body.illumination.markerOpacity)).size >= 5);
  assert.equal(markerOpacityForMagnitudes(0), 1);
  assert.equal(markerOpacityForMagnitudes(MARKER_BRIGHTNESS.magnitudeRange / 2), Number((MARKER_BRIGHTNESS.floor + (1 - MARKER_BRIGHTNESS.floor) / 2).toFixed(4)));
  assert.equal(markerOpacityForMagnitudes(99), MARKER_BRIGHTNESS.floor);
  // Lambert: full at zero phase, a quarter at quadrature... (1/pi), nothing at new.
  assert.ok(Math.abs(lambertPhaseFunction(0) - 1) < 1e-12);
  assert.ok(Math.abs(lambertPhaseFunction(Math.PI / 2) - 1 / Math.PI) < 1e-12);
  assert.ok(Math.abs(lambertPhaseFunction(Math.PI)) < 1e-12);
});


test("the dwarf planets ride the same frame tree, Pluto's orbit really crosses Neptune's, and Eris sets the extent", async () => {
  const system = await prepareMercurySystem();
  const byId = Object.fromEntries(system.bodies.map((body) => [body.id, body]));
  assert.ok(byId.pluto.perihelionAu < byId.neptune.aphelionAu, "Pluto's perihelion lies inside Neptune's aphelion");
  assert.ok(byId.pluto.inclinationDegrees > 15, "Pluto's orbit is steeply inclined");
  for (const body of dwarfsOf(system)) {
    assert.equal(body.inclinationReference, "icrf-equator");
    assert.ok(body.illumination.illuminatedFraction >= 0.99, body.id);
    assert.equal(body.illumination.markerOpacity, MARKER_BRIGHTNESS.floor, body.id);
    assert.equal(body.orbit.vertexCount, SYSTEM_ORBIT_SEGMENTS);
    // The position lies on the ellipse from the elements (the ring's own
    // self-check), between perihelion and aphelion.
    const r = magnitude(subtract(body.position, system.sun.position)) / system.units.unitsPerAu;
    assert.ok(r >= body.perihelionAu * (1 - 1e-6) && r <= body.aphelionAu * (1 + 1e-6), `${body.id} r ${r}`);
  }
  const extentAu = system.maximumExtentUnits / system.units.unitsPerAu;
  assert.ok(extentAu > 97 && extentAu < 99, `extent ${extentAu} au is Eris's aphelion`);
  assert.ok(Math.abs(extentAu - byId.eris.aphelionAu) < 0.6);
});

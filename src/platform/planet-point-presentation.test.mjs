import assert from "node:assert/strict";
import test from "node:test";
import { preparePlanetPoint } from "./prepare-planet-points.mjs";
import { planetPointPresentation, planetOrbitLabelPriority, validPreparedPlanetPoint } from "./planet-point-presentation.mjs";
import { preparePlanetarySystem } from "./prepare-planetary-system.mjs";
import { prepareEclipticPresentationFrame } from "./solar-presentation-frame.mjs";
import { projectHeliocentricView } from "./heliocentric-view.mjs";
import PREPARED_MERCURY_SCENE from "../../objects/preparation/mercury/scene.json" with {type: "json"};

const AU_KILOMETERS = 149597870.7;
const PHYSICAL_INPUTS = [
  { radiusKilometers: 6051.8, geometricAlbedo: 0.689, heliocentricDistanceAu: 0.723 },
  { radiusKilometers: 69911, geometricAlbedo: 0.538, heliocentricDistanceAu: 5.203 },
  { radiusKilometers: 24622, geometricAlbedo: 0.442, heliocentricDistanceAu: 30.07 },
];
const tables = PHYSICAL_INPUTS.map((body) => preparePlanetPoint({ ...body, kilometersPerUnit: 10 }));

// Captured by executing ../galaxio's actual bodies/photometry.ts and
// pointPhotometry.ts (not this implementation), fov=60, adaptation=.052.
// Columns: distance au, phase radians, screen factor, then [radius, alpha]
// for Venus, Jupiter and Neptune physical inputs above. These cover the
// bright ceiling approach, phase dimming, the pin/fade interval and floor.
const ORACLE = [
  [0.01, 0, 0.7, [16.610925042429194, 1], [17.029828790050274, 1], [13.245507246452341, 1]],
  [0.012296331448747623, 0.8774523122245805, 1.3663341645885287, [31.511715630270768, 1], [32.34822349107661, 1], [24.750685872761277, 1]],
  [0.4274867844518066, 2.3268155065241114, 1.3384039900249376, [16.65457104704755, 1], [17.974895483827403, 1], [4.869691187267115, 1]],
  [4850.489135536439, 0.07050956080376095, 0.7678304239401496, [0.6, 0.25], [0.6, 0.25], [0.6, 0.25]],
  [5.862458757960992, 2.969235949402822, 0.7119700748129676, [0.6, 0.2597173329001491], [0.6, 0.4102703708057361], [0.6, 0.25]],
  [80.39645654278252, 0.4700637386917396, 0.8855361596009974, [0.8978921495797867, 0.9658895977812413], [1.301767718644239, 1], [0.6, 0.25]],
];

test("prepared lookup follows Galaxio's executed photometry oracle across distance, phase and viewport", () => {
  for (const [distanceAu, phase, factor, ...expected] of ORACLE) {
    tables.forEach((table, index) => {
      const actual = planetPointPresentation(table, distanceAu * AU_KILOMETERS / 10, phase, factor);
      assert.ok(Number.isFinite(actual.magnitude));
      assert.ok(Math.abs(actual.radiusPx - expected[index][0]) < 0.2, `radius for input ${index} at ${distanceAu} au`);
      assert.ok(Math.abs(actual.alpha - expected[index][1]) < 0.03, `alpha for input ${index} at ${distanceAu} au`);
    });
  }
});

test("distant selectable planets keep the reference 1.2px core and 0.25 alpha, independent of viewport", () => {
  for (const table of tables) {
    assert.equal(validPreparedPlanetPoint(table), true);
    for (const factor of [0.7, 1, 1.5]) {
      const actual = planetPointPresentation(table, 10000 * AU_KILOMETERS / 10, Math.PI, factor);
      assert.equal(actual.diameterPx, 1.2);
      assert.equal(actual.alpha, 0.25);
      const close = planetPointPresentation(table, 1e-6, 0, factor);
      assert.ok(close.radiusPx <= 50);
    }
  }
  assert.equal(validPreparedPlanetPoint({ ...tables[0], samples: [1] }), false);
});

test("label ranking transports absolute apparent magnitude, including bright negative values", () => {
  // Also captured by executing Galaxio's bodies/photometry.ts at opposition.
  const jupiter = planetPointPresentation(tables[1], 4.203 * AU_KILOMETERS / 10, 0);
  const neptune = planetPointPresentation(tables[2], 29.07 * AU_KILOMETERS / 10, 0);
  assert.ok(Math.abs(jupiter.magnitude - (-2.7159901208230535)) < 1e-5);
  assert.ok(Math.abs(neptune.magnitude - 7.772347051339931) < 1e-5);
});

test("orbit label priority follows Galaxio's angular, near-body and eligibility rules", () => {
  const policy = { radiusUnits: 1, angularFadeInRadians: Math.PI / 180, angularFullRadians: 4 * Math.PI / 180,
    nearDistanceUnits: 20, farDistanceUnits: 200, minimumEligibility: 0.12 };
  const priorityAt = (angleDegrees, bodyDistance = 1000) => planetOrbitLabelPriority(policy, 2 / (angleDegrees * Math.PI / 180), bodyDistance, 8);
  assert.equal(priorityAt(0.5), -8);
  assert.ok(Math.abs(priorityAt(2.5) - 2) < 1e-12);
  assert.equal(priorityAt(5), 12);
  assert.equal(priorityAt(5, 20), -8);
  assert.equal(priorityAt(5, 110), 2);
  assert.equal(priorityAt(1 + 3 * 0.119), -8);
  assert.ok(Math.abs(priorityAt(1 + 3 * 0.121) - (-8 + 20 * 0.121)) < 1e-12);
});

test("projection carries physical discs and small camera-relative cores for every far system body", async () => {
  const prepared = PREPARED_MERCURY_SCENE.heliocentricView;
  const kilometersPerUnit = prepared.units.kilometersPerUnit;
  // Build these through the real preparer so this test also works while the
  // checked-in scene awaits regeneration after a source change.
  const plan = { ...prepared, system: await preparePlanetarySystem({ bodyId: "mercury",
    presentationFrame: prepareEclipticPresentationFrame("mercury"), kilometersPerUnit }) };
  const projection = projectHeliocentricView(plan, {
    rotation: [1, 0, 0, 0, 0, -1, 0, 1, 0], distance: plan.system.maximumExtentUnits * 3,
    focal: 1247, viewportWidth: 1440, viewportHeight: 900, system: true,
  });
  assert.equal(projection.system.bodies.length, 12);
  for (const { id, marker } of projection.system.bodies) {
    assert.ok(marker.visible, id);
    assert.ok(marker.diameterPx >= 1.2 && marker.diameterPx < 3, `${id} core ${marker.diameterPx}px`);
    assert.ok(marker.physicalDiameterPx > 0 && marker.physicalDiameterPx < 0.01, `${id} physical disc`);
    assert.equal(marker.diameterPx, Math.max(1.2, marker.physicalDiameterPx), `${id} physical size with visibility floor`);
    assert.ok(marker.alpha >= 0.25 && marker.alpha <= 1, `${id} alpha`);
    assert.ok(Number.isFinite(marker.magnitude) && Number.isFinite(marker.labelPriority), `${id} label ranking`);
  }
  const closer = projectHeliocentricView(plan, {
    rotation: [1, 0, 0, 0, 0, -1, 0, 1, 0], distance: 20 * AU_KILOMETERS / kilometersPerUnit,
    focal: 1247, viewportWidth: 1440, viewportHeight: 900, system: true,
  });
  const venus = closer.system.bodies.find(({ id }) => id === "venus").marker;
  assert.ok(venus.photometricRadiusPx > 1.2, "probe enters the former photometric enlargement regime");
  assert.equal(venus.diameterPx, 1.2, "bright Venus retains its true subpixel disc and common floor");

  const nearOptions = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], distance: 5 * plan.units.bodyRadiusUnits,
    focal: 1247, viewportWidth: 1440, viewportHeight: 900, system: true, systemOrbits: false };
  const near = projectHeliocentricView(plan, nearOptions);
  assert.equal(near.system.bodies.length, 12, "near sky retains every celestial point candidate");
  assert.ok(near.system.bodies.every(({ orbitSegments }) => orbitSegments.length === 0), "hidden system rings are not projected");
  const behindBody = { ...plan, system: { ...plan.system, bodies: [{ ...plan.system.bodies[0], position: [0, 0, -10000] }] } };
  const hidden = projectHeliocentricView(behindBody, nearOptions).system.bodies[0].marker;
  assert.equal(hidden.visible, false);
  assert.equal(hidden.classification, "behind-body", "celestial points cannot paint through the focused globe");
});

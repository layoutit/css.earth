import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANETARY_SCALE_LABEL,
  positionPlanetsByDistance,
} from "../planetary-scale.mjs";
import { PLANET_NAVIGATION_OBJECTS } from "../planet-search-objects.mjs";

test("derives the accessible logarithmic scale from catalog distances", () => {
  const orbitingPlanets = PLANET_NAVIGATION_OBJECTS;
  assert.deepEqual(orbitingPlanets.map(({ id }) => id), [
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ]);
  const stops = positionPlanetsByDistance(orbitingPlanets);
  assert.equal(PLANETARY_SCALE_LABEL,
    "Planets by mean distance from the Sun, logarithmic scale");
  assert.equal(stops[0].scalePositionPercent, 6);
  assert.equal(stops.at(-1).scalePositionPercent, 100);
  assert.deepEqual(stops.map(({ id }) => id), orbitingPlanets.map(({ id }) => id));
  assert.ok(stops.slice(1).every((stop, index) =>
    stop.scalePositionPercent > stops[index].scalePositionPercent));
  assert.deepEqual(
    stops.map(({ scalePositionPercent }) => scalePositionPercent),
    [6, 19.2656, 26.3733, 35.4328, 62.0448, 75.2653, 90.3078, 100],
  );
});

test("rejects unusable scale bounds and distances", () => {
  assert.throws(() => positionPlanetsByDistance([]), /at least two planets/);
  assert.throws(() => positionPlanetsByDistance([
    { id: "a", distanceAu: 1 },
    { id: "b", distanceAu: 1 },
  ]), /bounds are invalid/);
  assert.throws(() => positionPlanetsByDistance([
    { id: "a", distanceAu: 1 },
    { id: "b", distanceAu: 0 },
    { id: "c", distanceAu: 2 },
  ]), /distance is invalid: b/);
});

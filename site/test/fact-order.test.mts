import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { orderFacts } from "../fact-order.mts";

test("orders comparable facts before stable planet-specific facts", () => {
  const facts = [
    { id: "distance-from-sun", label: "Distance from Sun", value: "58 million km" },
    { id: "diameter", label: "Diameter", value: "4,880 km" },
    { id: "orbital-period", label: "Orbital period", value: "88 Earth days" },
    { id: "rotation-period", label: "Rotation period", value: "59 Earth days" },
  ];
  const moreFacts = [
    { id: "axial-tilt", label: "Axial tilt", value: "2°" },
    { id: "moon-count", label: "Moons", value: "None" },
    { id: "ring-system", label: "Rings", value: "None" },
    { id: "surface-temperature", label: "Surface temperature", value: "−180–430°C" },
  ];

  assert.deepEqual(
    orderFacts(facts, moreFacts).map(({ label }) => label),
    [
      "Distance from Sun",
      "Diameter",
      "Orbital period",
      "Rotation period",
      "Axial tilt",
      "Moons",
      "Rings",
      "Surface temperature",
    ],
  );
});

test("keeps unknown facts in their authored order", () => {
  const facts = [
    { id: "future-one", label: "Future one", value: "A" },
    { id: "future-two", label: "Future two", value: "B" },
  ];

  assert.deepEqual(orderFacts(facts), facts);
});

test("prioritizes a satellite's own orbit over its parent's solar orbit", () => {
  const facts = ["radius", "distance-from-sun", "orbital-period", "rotation-period", "distance-from-parent", "dimensions", "discovery"]
    .map(id => ({ id, label: id, value: "source-backed value" }));
  assert.deepEqual(orderFacts(facts).slice(0, 4).map(fact => fact.id),
    ["distance-from-parent", "radius", "orbital-period", "rotation-period"]);
  assert.equal(orderFacts(facts).length, facts.length);
});

test("rejects facts without unique semantic ids", () => {
  assert.throws(
    () => Reflect.apply(orderFacts, undefined, [[{ label: "Distance", value: "58 million km" }]]),
    /needs a semantic id/u,
  );
  assert.throws(
    () => orderFacts([
      { id: "diameter", label: "Diameter", value: "4,880 km" },
      { id: "diameter", label: "Width", value: "4,880 km" },
    ]),
    /is duplicated/u,
  );
});

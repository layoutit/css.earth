import assert from "node:assert/strict";
import test from "node:test";

import {
  orderScientificCharts,
  SCIENTIFIC_CHART_ORDER,
} from "../scientific-chart-order.mjs";

test("publishes the canonical scientific chart order", () => {
  assert.deepEqual(SCIENTIFIC_CHART_ORDER, [
    "reflectance",
    "temperature-pressure",
    "photometric-phase",
  ]);
});

test("orders any applicable subset without inventing missing charts", () => {
  const charts = [
    { id: "photometric-phase" },
    { id: "temperature-pressure" },
    { id: "reflectance" },
  ];
  assert.deepEqual(
    orderScientificCharts(charts).map(({ id }) => id),
    ["reflectance", "temperature-pressure", "photometric-phase"],
  );
  assert.equal(charts[0].id, "photometric-phase");
  assert.deepEqual(orderScientificCharts([]), []);
});

test("keeps unknown future chart types after known charts in source order", () => {
  assert.deepEqual(
    orderScientificCharts([
      { id: "future-b" },
      { id: "photometric-phase" },
      { id: "future-a" },
    ]).map(({ id }) => id),
    ["photometric-phase", "future-b", "future-a"],
  );
  assert.throws(
    () => orderScientificCharts(null),
    /Scientific charts must be an array/u,
  );
});

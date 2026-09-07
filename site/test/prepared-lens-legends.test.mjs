import assert from "node:assert/strict";
import { loadObjectContent } from "./load-object-content.mjs";
import { prepareObjectContent } from "../../tools/objects/dist/content/prepare.js";
import test from "node:test";
import { OBJECTS } from "../objects.mjs";

import {
  prepareLensCategoryLegend,
  prepareLensScaleLegend,
} from "../prepared-lens-legends.mjs";

test("prepares a frozen, smoothly sampled scale legend", () => {
  const legend = prepareLensScaleLegend({
    title: "Relative elevation",
    palette: [[0, 0, 0], [255, 255, 255]],
    labels: ["Lower", "Higher"],
    meta: "km",
    sourceUrl: "https://example.com/source",
  });

  assert.equal(legend.kind, "scale");
  assert.equal(legend.colors.length, 64);
  assert.equal(legend.colors[0], "rgb(0 0 0)");
  assert.equal(legend.colors.at(-1), "rgb(255 255 255)");
  assert.ok(Object.isFrozen(legend));
  assert.ok(Object.isFrozen(legend.colors));
});

test("prepares source-backed category legends from hex and RGB colors", () => {
  const legend = prepareLensCategoryLegend({
    title: "Structure",
    items: [
      { label: "Outer", description: "Outer layer", color: "#112233" },
      { label: "Inner", description: "Inner layer", color: [68, 85, 102] },
    ],
  });

  assert.deepEqual(
    legend.items.map(({ color }) => color),
    ["rgb(17 34 51)", "rgb(68 85 102)"],
  );
  assert.ok(Object.isFrozen(legend.items[0]));
});

test("rejects invalid scale palettes", () => {
  assert.throws(
    () => prepareLensScaleLegend({ title: "Bad", palette: [[0, 0, 0]] }),
    /at least two colors/u,
  );
  assert.throws(
    () => prepareLensScaleLegend({
      title: "Bad",
      palette: [[0, 0, 0], [256, 0, 0]],
    }),
    /palette color 1 is invalid/u,
  );
});

test("every object forwards its object-owned legend through the shared shell", async () => {
  await Promise.all(OBJECTS.map(async ({ id }) => {
    const loaded = await loadObjectContent(id);
    const source = await loaded.source("content");
    const controls = source.schema === "cssearth-static-surface-content@1"
      ? source.controls : prepareObjectContent(source);
    const legends = lenses => lenses.controls.map(({ id, legend }) => ({ id, legend }));
    assert.deepEqual(
      JSON.parse(JSON.stringify(legends(loaded.object.data.controls.lenses))),
      JSON.parse(JSON.stringify(legends(controls.lenses))),
      id + " must forward every source-derived legend, including colors and ranges",
    );
  }));
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  const objectIds = [
    "earth",
    "jupiter",
    "mars",
    "mercury",
    "moon",
    "neptune",
    "saturn",
    "sun",
    "uranus",
    "venus",
  ];
  const controls = await Promise.all(objectIds.map((objectId) => readFile(
    new URL(
      `../../src/planets/${objectId}/site/control-content.mjs`,
      import.meta.url,
    ),
    "utf8",
  )));

  controls.forEach((controlContent, index) => {
    assert.match(
      controlContent,
      /legend:\s*(?:lens\.legend(?:\s*\?\?\s*lensLegends\[lens\.id\])?|lensLegends\[lens\.id\])/u,
      `${objectIds[index]} must forward its prepared legend`,
    );
  });
});

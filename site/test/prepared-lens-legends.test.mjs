import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    if (id === "mercury" || id === "venus") {
      const source = JSON.parse(await readFile(
        new URL(`../../src/planets/${id}/source/content/object.json`, import.meta.url),
        "utf8",
      ));
      const prepared = (await import(`../../objects/prepared/${id}.json`, {
        with: { type: "json" },
      })).default;
      const preparedLegends = prepared.data.controls.lenses.controls
        .filter(({ legend }) => legend)
        .map(({ id: lensId, legend }) => ({ id: lensId, legend }));
      const sourceLegends = source.lenses.controls
        .filter(({ legend }) => legend)
        .map(({ id: lensId, legend }) => ({ id: lensId, legend }));
      assert.equal(preparedLegends.length, sourceLegends.length, `${id} legend count`);
      for (const { id: lensId, legend } of sourceLegends) {
        const actual = preparedLegends.find(({ id: actualId }) => actualId === lensId)?.legend;
        assert.ok(actual, `${id}:${lensId} prepared legend`);
        assert.equal(actual.kind, legend.kind);
        assert.equal(actual.title, legend.title);
        assert.deepEqual(actual.labels, legend.labels ?? legend.recipe?.labels);
      }
      return;
    }
    const [{ objectControls: controls }, { objectControls: source }] = await Promise.all([
      import(`../../src/planets/${id}/site/control-content.mjs`),
      import(`../../src/planets/${id}/site/control-content.source.mjs`),
    ]);
    assert.deepEqual(
      controls.lenses.controls.map(({ id, legend }) => ({ id, legend })),
      source.lenses.controls.map(({ id, legend }) => ({ id, legend })),
      `${id} must forward every object-owned prepared legend`,
    );
  }));
});

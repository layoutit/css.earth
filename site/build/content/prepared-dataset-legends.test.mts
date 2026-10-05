import assert from "node:assert/strict";
import { loadObjectContent } from "./load-object-content.test-support.mts";
import { prepareObjectContent } from "./prepare.ts";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import {
  prepareDatasetCategoryLegend,
  prepareDatasetScaleLegend,
} from '@cssearth/bake/objects/content';

test("prepares a frozen, smoothly sampled scale legend", () => {
  const legend = prepareDatasetScaleLegend({
    title: "Relative elevation",
    palette: [[0, 0, 0], [255, 255, 255]],
    labels: ["Lower", "Higher"],
    meta: "km",
    sourceUrl: "https://example.com/source",
  });

  assert.equal(legend.kind, "scale");
  assert.ok(legend.colors);
  assert.equal(legend.colors.length, 64);
  assert.equal(legend.colors[0], "rgb(0 0 0)");
  assert.equal(legend.colors.at(-1), "rgb(255 255 255)");
  assert.ok(Object.isFrozen(legend));
  assert.ok(Object.isFrozen(legend.colors));
});

test("prepares source-backed category legends from hex and RGB colors", () => {
  const legend = prepareDatasetCategoryLegend({
    title: "Structure",
    items: [
      { label: "Outer", description: "Outer layer", color: "#112233" },
      { label: "Inner", description: "Inner layer", color: [68, 85, 102] },
    ],
  });

  assert.ok(legend.items);
  assert.deepEqual(
    legend.items.map(({ color }) => color),
    ["rgb(17 34 51)", "rgb(68 85 102)"],
  );
  assert.ok(Object.isFrozen(legend.items[0]));
});

test("rejects invalid scale palettes", () => {
  assert.throws(
    () => prepareDatasetScaleLegend({ title: "Bad", palette: [[0, 0, 0]] }),
    /at least two colors/u,
  );
  assert.throws(
    () => prepareDatasetScaleLegend({
      title: "Bad",
      palette: [[0, 0, 0], [256, 0, 0]],
    }),
    /palette color 1 is invalid/u,
  );
});

test('named categories can omit a redundant description while supplied descriptions stay validated', () => {
  const input={title:'Regions',items:[{label:'Ash',color:'#aabbcc'},{label:'Hapi',color:'#112233'}]};
  const legend=prepareDatasetCategoryLegend(input);
  assert.ok(legend.items);
  assert.deepEqual(legend.items.map(({label})=>label),['Ash','Hapi']);
  assert.ok(legend.items.every(item=>!Object.hasOwn(item,'description')));
  assert.throws(()=>prepareDatasetCategoryLegend({...input,items:input.items.map(item=>({...item,description:''}))}),/description must be/);
});

import {requireRecord, requireArray} from '../../tools/sources/source-values.mts';
import {parseObjectContentFixture} from './object-content-fixture.mts';
import assert from "node:assert/strict";
import { loadObjectContent } from "./load-object-content.mts";
import { prepareObjectContent } from "#preparation/content/prepare";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { OBJECTS } from "../objects.mts";

import {
  prepareLensCategoryLegend,
  prepareLensScaleLegend,
} from "../prepared-lens-legends.mts";

test("prepares a frozen, smoothly sampled scale legend", () => {
  const legend = prepareLensScaleLegend({
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
  const legend = prepareLensCategoryLegend({
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

test('named categories can omit a redundant description while supplied descriptions stay validated', () => {
  const input={title:'Regions',items:[{label:'Ash',color:'#aabbcc'},{label:'Hapi',color:'#112233'}]};
  const legend=prepareLensCategoryLegend(input);
  assert.ok(legend.items);
  assert.deepEqual(legend.items.map(({label})=>label),['Ash','Hapi']);
  assert.ok(legend.items.every(item=>!Object.hasOwn(item,'description')));
  assert.throws(()=>prepareLensCategoryLegend({...input,items:input.items.map(item=>({...item,description:''}))}),/description must be/);
});

test("every object forwards its object-owned legend through the shared shell", async () => {
  await Promise.all(OBJECTS.map(async ({ id }) => {
    const loaded = await loadObjectContent(id);
    const source = await loaded.source("content");
    const controls = prepareObjectContent(parseObjectContentFixture(source));
    const legends = (lenses: unknown) => lenses == null ? [] : requireArray(requireRecord(lenses).controls).map(value => {
      const { id, legend } = requireRecord(value);
      return { id, legend };
    });
    const objectControls = requireRecord(requireRecord(loaded.object.data).controls);
    assert.deepEqual(
      JSON.parse(JSON.stringify(legends(objectControls.lenses))),
      JSON.parse(JSON.stringify(legends(controls.lenses))),
      id + " must forward every source-derived legend, including colors and ranges",
    );
  }));
});

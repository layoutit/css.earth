import {loadObjectTestDefinition} from '@cssearth/objects/node/contract';
import assert from "node:assert/strict";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from "node:fs/promises";

import { requireObjectControls } from '@cssearth/renderer/runtime/shell-contract.ts';
import { SCENE_OBJECTS } from "../objects.mts";

import { parse, object, array, string, optional, boolean } from '@cssearth/core/schema';
const preparedControls = (value: unknown) => parse(value, object({ controls: object({ settings: object({
  controls: array(object({ name: string, kind: string, label: string, checked: optional(boolean), state: optional(string) })),
}) }) }), 'prepared settings').controls;

test("asteroid, trans-Neptunian and comet Shadows default off in authored content and prepared runtime", async () => {
  for (const { id } of SCENE_OBJECTS.filter(object => ["asteroid", "trans-neptunian", "comet", "interstellar"].includes(object.classification))) {
    const source = preparedControls({ controls: JSON.parse(await readFile(new URL(`../../src/objects/${id}/source/content/object.json`, import.meta.url), "utf8")) });
    const prepared = preparedControls(await loadObjectTestDefinition(id));
    for (const [stage, settings] of [["authored", source.settings], ["prepared", prepared.settings]] as const) {
      assert.deepEqual(settings.controls.filter(control => control.name === "shadows"),
        [{ kind: "toggle", name: "shadows", label: "Shadows", checked: false }],
        `${id}: ${stage} Shadows must be opt-in`);
    }
  }
});

test("publishes one off-by-default Shadows control for every planet", async () => {
  const planets = [
    "mercury", "venus", "earth", "mars",
    "jupiter", "saturn", "uranus", "neptune",
  ];
  for (const id of planets) {
    const objectControls = preparedControls(await loadObjectTestDefinition(id));
    const controls = objectControls.settings.controls.filter(({ name }) => name === "shadows");
    assert.deepEqual(controls, [{ kind: "toggle", name: "shadows", label: "Shadows", checked: false }],
      `${id} shadow control drifted`);
  }
});

test("control content permits empty capabilities but rejects malformed or conflicting declarations", () => {
  for (const content of [{ datasets: null, settings: null }, { datasets: undefined, settings: undefined },
    { datasets: { controls: [] }, settings: { controls: [] } }]) {
    assert.equal(requireObjectControls(content, "future"), content);
  }
  for (const content of [{}, { datasets: null }, { datasets: { controls: [{ id: "a" }, { id: "a" }] }, settings: null },
    { datasets: { default: "missing", controls: [{ id: "a" }] }, settings: null },
    { datasets: null, settings: { controls: [{ name: "motion", kind: "toggle", label: "Motion", checked: false }] } },
    { datasets: null, settings: { controls: [{ name: "rings", kind: "invented", label: "Rings" }] } },
    { datasets: { controls: [null] }, settings: null },
    { datasets: null, settings: { controls: [null] } },
    { datasets: 1, settings: null },
    { datasets: null, settings: { controls: [{ name: "rings", kind: "toggle", label: "Rings", checked: "false" }] } }]) {
    assert.throws(() => requireObjectControls(content, "future"));
  }
});

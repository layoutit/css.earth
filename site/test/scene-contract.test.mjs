import {loadObjectTestDefinition} from '../../tools/object-test-data.mjs';
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { requireObjectControls } from "../scene-contract.mjs";
import { OBJECTS } from "../objects.mjs";

test("asteroid and comet Shadows default off in authored content and prepared runtime", async () => {
  for (const { id } of OBJECTS.filter(object => ["asteroid", "comet"].includes(object.classification))) {
    const source = JSON.parse(await readFile(new URL(`../../src/planets/${id}/source/content/object.json`, import.meta.url), "utf8"));
    const prepared = (await loadObjectTestDefinition(id)).controls;
    for (const [stage, settings] of [["authored", source.settings], ["prepared", prepared.settings]]) {
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
    const objectControls = (await loadObjectTestDefinition(id)).controls;
    const controls = objectControls.settings.controls.filter(({ name }) => name === "shadows");
    assert.deepEqual(controls, [{ kind: "toggle", name: "shadows", label: "Shadows", checked: false }],
      `${id} shadow control drifted`);
  }
});

test("control content permits empty capabilities but rejects malformed or conflicting declarations", () => {
  for (const content of [{ lenses: null, settings: null }, { lenses: undefined, settings: undefined },
    { lenses: { controls: [] }, settings: { controls: [] } }]) {
    assert.equal(requireObjectControls(content, "future"), content);
  }
  for (const content of [{}, { lenses: null }, { lenses: { controls: [{ id: "a" }, { id: "a" }] }, settings: null },
    { lenses: { default: "missing", controls: [{ id: "a" }] }, settings: null },
    { lenses: null, settings: { controls: [{ name: "motion", kind: "toggle", label: "Motion", checked: false }] } },
    { lenses: null, settings: { controls: [{ name: "rings", kind: "invented", label: "Rings" }] } }]) {
    assert.throws(() => requireObjectControls(content, "future"));
  }
});

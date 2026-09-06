import assert from "node:assert/strict";
import test from "node:test";

import { requireObjectControls } from "../scene-contract.mjs";

test("publishes one off-by-default Shadows control for every planet", async () => {
  const planets = [
    "mercury", "venus", "earth", "mars",
    "jupiter", "saturn", "uranus", "neptune",
  ];
  for (const id of planets) {
    const { objectControls } = await import(new URL(
      `../../src/planets/${id}/site/control-content.mjs`,
      import.meta.url,
    ));
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

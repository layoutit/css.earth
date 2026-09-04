import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { OBJECT_BEHAVIOR } from "../scene-contract.mjs";

test("registers every body-dependent layer as a synchronized presentation", () => {
  assert.equal(
    OBJECT_BEHAVIOR.rendering.bodyDependentLayerRegistration,
    "camera-synchronized-retained-presentation",
  );
  assert.equal(OBJECT_BEHAVIOR.rendering.retainedLightingOverlay, true);
});

test("keeps the retained lighting overlay while shadows default to off", () => {
  assert.deepEqual(OBJECT_BEHAVIOR.lighting.states, ["off", "on"]);
  assert.equal(OBJECT_BEHAVIOR.lighting.default, "off");
  assert.equal(
    OBJECT_BEHAVIOR.lighting.shadowsOffPresentation,
    "prepared-shadowless-overlay",
  );
  assert.equal(OBJECT_BEHAVIOR.lighting.overlayRetainedAcrossStates, true);
});

test("publishes one off-by-default Shadows control for every planet", async () => {
  const planets = [
    "mercury", "venus", "earth", "mars",
    "jupiter", "saturn", "uranus", "neptune",
  ];
  for (const id of planets) {
    const name = id[0].toUpperCase() + id.slice(1);
    const panel = await readFile(new URL(
      `../../src/planets/${id}/site/${name}Panel.astro`,
      import.meta.url,
    ), "utf8");
    const controls = panel.match(
      /\{ kind: "toggle", name: "shadows", label: "Shadows", checked: false \}/gu,
    ) ?? [];
    assert.equal(controls.length, 1, `${id} shadow control drifted`);
  }
});

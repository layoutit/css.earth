import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Uranus runtime free of acquisition and forbidden renderers", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/preparedPresentation.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|WebSocket/iu);
  assert.doesNotMatch(client, /createElement\(["'](?:canvas|svg)["']/iu);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?\s*:|filter\s*:|linear-gradient|radial-gradient|mix-blend-mode/iu);
  const { runtimeDefinition } = await import("../runtime/definition.mjs");
  assert.equal(runtimeDefinition.id, "uranus");
  assert.ok(runtimeDefinition.tree.nodes.some(node => node.className?.includes("uranus-body")));
  assert.doesNotMatch(client, /uranus-material-composite planet-render-root/u);
  assert.ok(runtimeDefinition.viewBindings.some(binding => binding.kind === "counter-rotation" && runtimeDefinition.tree.nodes[binding.target].className.includes("uranus-fixed-material-counter")));
  assert.equal(runtimeDefinition.sky.faces.length, 6);
  assert.deepEqual(runtimeDefinition.controls.settings.controls.map(control => control.name), ["speed", "shadows", "rings"]);
  assert.doesNotMatch(client, /uranus-moon|moonAtlas|OrbitGuide/u);
  assert.doesNotMatch(client, /mounted\.system\.style\.setProperty/u);
  assert.doesNotMatch(styles, /--uranus-label-counter-scale/u);
  assert.doesNotMatch(styles, /uranus-(?:moon|orbit-guide)/u);
  assert.doesNotMatch(client, /safeCamera\.update\(\{ zoom: 1\.6 \}\)/u);
  assert.doesNotMatch(client, /className, assets\.body|uranus-body-normal/u);
  assert.doesNotMatch(styles, /box-shadow\s*:/u);
});

test("uses the shared unbounded camera for the standalone Uranus scene", async () => {
  const { runtimeDefinition } = await import("../runtime/definition.mjs");
  assert.equal(runtimeDefinition.camera.cameraModel, "accumulated-matrix3d");
  assert.equal(runtimeDefinition.camera.pitchBounded, false);
  assert.equal(runtimeDefinition.camera.yawBounded, false);
});

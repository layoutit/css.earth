import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { initialObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { PREPARED_MARS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MARS_MOONS } from "../runtime/preparedMoons.mjs";

test("keeps the Mars scene as one fixed retained PolyCSS tree", async () => {
  const [client, css, layout] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../site/layouts/PlanetLayout.astro", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_MARS_SCENE.leaves.length, 516);
  assert.equal(PREPARED_MARS_MOONS.moons.length, 2);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.surfaceLeafCount, 2);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.solidLeafCount, 0);
  assert.equal(PREPARED_MARS_MOONS.retainedDom.runtimeTopology, false);
  assert.ok(PREPARED_MARS_SCENE.leaves.every(({ tag, style }) =>
    ["b", "s", "u"].includes(tag) && typeof style === "string"));
  assert.ok(PREPARED_MARS_MOONS.moons.every(({ leaves }) =>
    leaves.length === 1 && leaves.every(({ tag, style }) =>
      ["b", "s", "u"].includes(tag) && typeof style === "string")));

  const { runtimeDefinition } = await import("../runtime/definition.mjs");
  const { retainedPresentationFixture } = await import("../../../platform/test/object-runtime-package.mjs");
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const nodes = f.stage.querySelectorAll("*");
    const material = nodes.find(node => node.classList.contains("mars-material-plane"));
    const { PREPARED_MARS_CAMERA } = await import("../runtime/preparedCamera.mjs");
    assert.equal(material.style.transform, PREPARED_MARS_CAMERA.materialDepthContract.planeTransform);
    assert.equal(material.children.length, 1);
    assert.equal(material.children[0].tagName, "S");
    assert.equal(nodes.filter(node => ["B", "S", "U"].includes(node.tagName)).length, 517);
    for (const lens of runtimeDefinition.controls.lenses.controls) {
      presentation.commitSelection({ selection: { ...initialObjectSelection(runtimeDefinition.controls), lensId: lens.id } });
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    presentation.observe();
    f.lifetime.destroy(); assert.equal(f.stage.children.length, 0);
  } finally { f.restore(); }
  assert.doesNotMatch(client, /canvas|getContext|requestIdleCallback|setInterval|setTimeout|PREPARED_MARS_MOONS|mars-moon/u);
  assert.doesNotMatch(css, /mars-moon/u);
  assert.doesNotMatch(client, /Math\.(?:cos|sin)/u);
  assert.doesNotMatch(client,
    /matchMedia[^;]*addEventListener|devicePixelRatio.*addEventListener/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/u);
  assert.doesNotMatch(css, /text-shadow\s*:/u);
  assert.match(layout, /class="planet-input-surface"/u);
  assert.doesNotMatch(css, /mars-input-surface/u);
});

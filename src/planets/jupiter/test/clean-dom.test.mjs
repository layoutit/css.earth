import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { initialObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { PREPARED_JUPITER_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_JUPITER_MOONS } from "../runtime/preparedMoons.mjs";
import { PREPARED_JUPITER_RINGS } from "../runtime/preparedRings.mjs";

test("keeps the Jupiter scene as one fixed retained PolyCSS tree", async () => {
  const [client, css, layout] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../site/layouts/PlanetLayout.astro", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_JUPITER_SCENE.leaves.length, 772);
  assert.equal(PREPARED_JUPITER_MOONS.moons.length, 4);
  assert.equal(PREPARED_JUPITER_MOONS.minorMoonDots.length, 111);
  assert.equal(PREPARED_JUPITER_MOONS.counts.moonSurfaceLeafCount, 115);
  assert.equal(PREPARED_JUPITER_RINGS.retainedDom.leafCount, 16);
  assert.equal(PREPARED_JUPITER_MOONS.presentation.runtimeGeometryPreparation,
    false);
  assert.ok(PREPARED_JUPITER_SCENE.leaves.every(({ tag, style }) =>
    ["b", "s", "u"].includes(tag) && typeof style === "string"));
  assert.ok(PREPARED_JUPITER_MOONS.moons.every(({ leaves }) =>
    leaves.length === 1 && leaves.every(({ tag, style }) =>
      ["b", "s", "u"].includes(tag) && typeof style === "string")));

  const { runtimeDefinition } = await import("../runtime/definition.mjs");
  const { retainedPresentationFixture } = await import("../../../platform/test/object-runtime-package.mjs");
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const nodes = f.stage.querySelectorAll("*");
    const material = nodes.find(node => node.classList.contains("jupiter-material"));
    const rings = nodes.find(node => node.classList.contains("jupiter-rings"));
    const { PREPARED_JUPITER_CAMERA } = await import("../runtime/preparedCamera.mjs");
    assert.equal(material.style.transform, PREPARED_JUPITER_CAMERA.materialDepthPresentation.materialMeshTransform.replace(/^transform:/, ""));
    assert.equal(material.children.length, 1);
    assert.equal(material.children[0].tagName, "S");
    assert.equal(rings.children.length, PREPARED_JUPITER_RINGS.retainedDom.leafCount);
    assert.equal(nodes.filter(node => ["B", "S", "U"].includes(node.tagName)).length, 789);
    for (const lens of runtimeDefinition.controls.lenses.controls) {
      presentation.commitSelection({ selection: { ...initialObjectSelection(runtimeDefinition.controls), lensId: lens.id } });
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    presentation.observe();
    f.lifetime.destroy(); assert.equal(f.stage.children.length, 0);
  } finally { f.restore(); }
  assert.doesNotMatch(client, /PREPARED_JUPITER_MOONS|jupiter-moon/u);
  assert.doesNotMatch(css, /jupiter-moon/u);
  assert.doesNotMatch(client,
    /DOMMatrix|Math\.(?:cos|sin)|materialTransform\s*\(|preparedMoonLocalLabelMatrix/u);
  assert.doesNotMatch(client, /canvas|getContext\(|requestIdleCallback/u);
  assert.doesNotMatch(client, /setInterval|setTimeout/u);
  assert.doesNotMatch(client,
    /matchMedia[^;]*addEventListener|devicePixelRatio.*addEventListener/u);
  assert.doesNotMatch(css,
    /filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(|text-shadow\s*:|box-shadow\s*:/u);
  assert.match(layout, /class="planet-input-surface"/u);
  assert.doesNotMatch(css, /jupiter-input-surface/u);
});

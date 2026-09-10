import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import { initialObjectSelection } from "../../../../src/platform/object-runtime-contract.mts";
import { PREPARED_MARS_SCENE } from "../../unit/mars/prepared-fixture.mts";

test("keeps the Mars scene as one fixed retained PolyCSS tree", async () => {
  const [client, css] = await Promise.all([
    readFile(new URL("../../../../src/renderers/css/runtime/object-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/mars-surfaces.css", import.meta.url), "utf8"),
  ]);

  assert.equal(PREPARED_MARS_SCENE.leaves.length, 516);
  assert.ok(PREPARED_MARS_SCENE.leaves.every(({ tag, style }) =>
    ["b", "s", "u"].includes(tag) && typeof style === "string"));

  const { runtimeDefinition } = await import("../../unit/mars/prepared-fixture.mts");
  const { retainedPresentationFixture } = await import("../../../../src/platform/test/object-runtime-package.mts");
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const nodes = f.stage.querySelectorAll("*");
    const material = nodes.find(node => node.classList.contains("mars-material-plane"));
    const { PREPARED_MARS_CAMERA } = await import("../../unit/mars/prepared-fixture.mts");
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
  assert.doesNotMatch(css, /mars-input-surface/u);
});

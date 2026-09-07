import { readPreparedFixture } from '../../fixtures.mjs';
const runtimeDefinition = await readPreparedFixture('moon', 'runtime');
import assert from "node:assert/strict";
import test from "node:test";
import { initialObjectSelection } from "../../../../src/renderers/css/dist/index.js";
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";

import { objectRuntimePackageTests, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mjs";

objectRuntimePackageTests(runtimeDefinition);

test("Moon keeps finite retained bands across every sourced lens", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const nodes = f.stage.querySelectorAll("*");
    for (const lens of runtimeDefinition.controls.lenses.controls) {
      const selection = { ...initialObjectSelection(runtimeDefinition.controls), lensId: lens.id };
      presentation.commitSelection({ selection, resources: f.resources });
      assert.equal(f.stage.dataset.lens, lens.id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.children.length, 0);
    assert.equal(Object.hasOwn(f.stage.dataset, "lens"), false);
  } finally { f.restore(); }
});
test("Moon partial retained construction leaves an existing presentation untouched", () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement: 6 });
  try {
    f.stage.dataset.lens = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /native element failure/);
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, "previous");
    assert.equal(f.stage.children.length, 0);
  } finally { f.restore(); }
});
test("Moon presentation disposal preserves a replacement and continues through native metadata failure", () => {
  for (const replacement of [false, true]) {
    const f = retainedPresentationFixture(runtimeDefinition);
    try {
      mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
      if (replacement) {
        f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement";
      } else f.stage.dataset = new Proxy(f.stage.dataset, { deleteProperty() { throw new Error("metadata failed"); } });
      const errors = f.lifetime.destroy();
      assert.equal(errors.length, replacement ? 0 : 1);
      assert.equal(f.stage.children.length, replacement ? 1 : 0);
      if (replacement) assert.equal(f.stage.dataset.lens, "replacement");
    } finally { f.restore(); }
  }
});

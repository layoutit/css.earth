import { readPreparedFixture } from '../../fixtures.mjs';
const runtimeDefinition = await readPreparedFixture('sun', 'runtime');
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";

import { objectRuntimePackageTests } from "../../../../src/platform/test/object-runtime-package.mjs";

objectRuntimePackageTests(runtimeDefinition);

// Preserve the actual retained-root retirement cases formerly extracted from
// the removed private mount function in Mars's cross-package test.
import assert from "node:assert/strict";
import test from "node:test";
import { retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mjs";
for (const replacement of [false, true]) test(`Sun retires owned lens metadata and preserves replacements (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
    f.stage.dataset.lens = "newer"; f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "newer");
  } finally { f.restore(); }
});

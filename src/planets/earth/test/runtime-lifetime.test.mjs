import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { mountEarthClient } from "../runtime/client.mjs";
import { retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";

test("Earth rejects a missing fatal owner before native allocation", () => {
  assert.throws(() => mountEarthClient({ nodeType: 1, style: {}, dataset: { objectId: "earth" }, ownerDocument: {} }), /error owner/);
});
for (const failAtElement of [1, 2, 3]) test(`Earth partial native construction preserves an earlier owner (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous"; f.stage.dataset.view = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "previous"); assert.equal(f.stage.dataset.view, "previous");
  } finally { f.restore(); }
});

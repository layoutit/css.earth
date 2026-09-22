import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('earth');
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mts";
import { mountEarthClient } from "../../unit/earth/prepared-fixture.mts";
import { retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";

test("Earth rejects a missing fatal owner before native allocation", () => {
  assert.throws(() => Reflect.apply(mountEarthClient,undefined,[{ nodeType: 1, style: {}, dataset: { objectId: "earth" }, ownerDocument: {} }]), /error owner/);
});
for (const failAtElement of [1, 2, 3]) test(`Earth partial native construction preserves an earlier owner (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous"; f.stage.dataset.view = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "previous"); assert.equal(f.stage.dataset.view, "previous");
  } finally { f.restore(); }
});

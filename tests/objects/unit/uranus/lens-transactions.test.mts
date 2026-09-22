import {required} from '../../../../tools/contract/test-values.mts';
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('uranus');
import { runtimeDefinition } from "./prepared-fixture.mts";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";

for (const failAtElement of [1, 2, 3]) test(`Uranus partial native construction preserves the previous owner (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous-owner";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    assert.deepEqual(f.lifetime.destroy(), []); assert.equal(f.stage.dataset.lens, "previous-owner");
  } finally { f.restore(); }
});
for (const replacement of [false, true]) test(`Uranus retained-root cleanup preserves its owner (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
  } finally { f.restore(); }
});

test("Uranus stale surface decode cannot publish over the latest material selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const first = f.selection.dispatch({ kind: "lens", id: "near-infrared" }); await f.flush(); const oldJobs = [...f.jobs];
    const second = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    for (const job of f.jobs.filter(job => !oldJobs.includes(job))) { job.done = true; job.resolve(); }
    assert.equal(await second, true); assert.equal(await first, false);
    for (const job of oldJobs.filter(job => !job.done)) { job.done = true; job.resolve(); } await f.flush();
    assert.equal(required(f.selection.state().committed).lensId, "methane");
    assert.equal(f.stage.dataset.lens, "methane"); assert.deepEqual(f.errors, []);
    const next = f.selection.dispatch({ kind: "lens", id: "near-infrared" }); await f.flush();
    f.lifetime.destroy(); assert.equal(await next, false);
    f.stage.dataset.lens = "replacement";
    for (const job of f.jobs.filter(job => !job.done)) job.reject(new Error("late")); await f.flush();
    assert.equal(f.stage.dataset.lens, "replacement"); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

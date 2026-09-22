import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('neptune');
import { runtimeDefinition } from "./prepared-fixture.mts";
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";

async function directional(f:Awaited<ReturnType<typeof preparedSelectionFixture>>) {
  const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true });
  await f.settle(); await enable;
  const view = { ...f.view, controlPitch: 63, sunViewDirection: [0, 0, 1], revision: 2 };
  f.selection.setView(view); await f.settle(); return view;
}

for (const failAtElement of [1, 2, 3]) test(`Neptune partial construction preserves the previous owner (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    assert.deepEqual(f.lifetime.destroy(), []); assert.equal(f.stage.dataset.lens, "previous");
  } finally { f.restore(); }
});
for (const replacement of [false, true]) test(`Neptune cleanup respects retained root identity (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
  } finally { f.restore(); }
});

test("Neptune disposal settles never-ending rows and prevents late camera requests", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await directional(f);
    const request = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    f.lifetime.destroy(); assert.equal(await request, false); const count = f.jobs.length;
    f.stage.dataset.lens = "replacement";
    for (const job of f.jobs.filter(job => !job.done)) { job.done = true; job.reject(new Error("late")); }
    await f.flush(); assert.equal(f.jobs.length, count); assert.equal(f.stage.dataset.lens, "replacement");
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

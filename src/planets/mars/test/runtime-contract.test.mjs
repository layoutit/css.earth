import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { materialFrameFor } from "../runtime/material.mjs";
import { objectRuntimePackageTests, preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";
import { OBJECTS } from "../../../../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mjs";

objectRuntimePackageTests(runtimeDefinition);
test("Mars's actual import closure has no private runtime owner", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "mars") });
  assert.equal(audit.complete, true);
  for (const source of ["object-selection-runtime", "prepared-residency", "prepared-playback", "object-control-binding", "cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/platform/${source}.mjs`));
  }
});

test("Mars retains a visible fallback through a row miss, recoverable decode failure and retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    assert.equal(f.residency.stats().pools.find(pool => pool.id === "lighting").nativeSlots, 3);
    assert.equal(f.presentation.observe().material.appliedFrame,
      materialFrameFor(runtimeDefinition.initialSelection, f.view));
    const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await request, true);
    const previous = f.presentation.observe().material.appliedFrame;
    const view = { ...f.view, skySunViewDirection: [0, 0, 1], revision: 2 };
    f.selection.setView(view); await f.flush();
    assert.equal(f.selection.state().loadingMaterial, true);
    assert.equal(f.presentation.observe().material.appliedFrame, previous);
    const failed = f.jobs.at(-1); failed.done = true; failed.reject(new Error("row decode failed")); await f.flush();
    assert.equal(f.lifetime.disposed, false); assert.equal(f.materialErrors.length, 1);
    assert.equal(f.presentation.observe().material.appliedFrame, previous);
    f.selection.setView({ ...view, revision: 3 }); await f.settle();
    assert.equal(f.presentation.observe().material.appliedFrame, 0);
    const pool = f.residency.stats().pools.find(pool => pool.id === "lighting");
    assert.ok(pool.resident <= 3); assert.equal(pool.nativeSlots, 3);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mars's new lens groups use shared warm receipts without retaining native images", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const id of ["elevation", "thermal", "normal", "thermal"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(f.selection.state().committed.lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
      assert.equal(f.residency.stats().pools.find(pool => pool.id === "warm").resident, 0);
    }
    const surfaceJobs = f.jobs.filter(job => /mars-(?:elevation|thermal|surface|poles)/.test(job.url));
    assert.equal(new Set(surfaceJobs.map(job => job.url)).size, surfaceJobs.length);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

for (const replacement of [false, true]) test(`Mars retained-root retirement preserves ownership (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    runtimeDefinition.createPresentation(f.stage, f.context); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
  } finally { f.restore(); }
});

import assert from "node:assert/strict";
import test from "node:test";
import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { objectRuntimePackageTests, preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";
import { OBJECTS } from "../../../../site/objects.mjs";
import { auditObjectRuntimeOwnership } from "../../../../tools/check-object-runtime-ownership.mjs";

objectRuntimePackageTests(runtimeDefinition);
test("Jupiter's actual import closure has no private runtime owner", async () => {
  const audit = await auditObjectRuntimeOwnership({ objects: OBJECTS.filter(object => object.id === "jupiter") });
  assert.equal(audit.complete, true);
  for (const source of ["object-selection-runtime", "prepared-residency", "prepared-playback", "object-control-binding", "cubic-sky-runtime"]) {
    assert.ok(audit.sharedClosure.includes(`src/platform/${source}.mjs`));
  }
});

test("Jupiter retains a visible fallback through a row miss, recoverable decode failure and retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    assert.equal(f.residency.stats().pools.find(pool => pool.id === "lighting").nativeSlots, 3);
    assert.equal(f.presentation.observe().material.appliedFrame, null);
    const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await request, true);
    const previous = f.presentation.observe().material.appliedFrame;
    const view = { ...f.view, controlPitch: 0, revision: 2 };
    f.selection.setView(view); await f.flush();
    assert.equal(f.selection.state().loadingMaterial, true);
    assert.ok(Number.isInteger(f.presentation.observe().material.appliedFrame));
    const failed = f.jobs.at(-1); failed.done = true; failed.reject(new Error("row decode failed")); await f.flush();
    assert.equal(f.lifetime.disposed, false); assert.equal(f.materialErrors.length, 1);
    assert.ok(Number.isInteger(f.presentation.observe().material.appliedFrame));
    f.selection.setView({ ...view, revision: 3 }); await f.settle();
    assert.equal(f.presentation.observe().material.appliedFrame, 136);
    const pool = f.residency.stats().pools.find(pool => pool.id === "lighting");
    assert.ok(pool.resident <= 3); assert.equal(pool.nativeSlots, 3);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Jupiter's new lens groups use shared warm receipts without retaining native images", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    for (const id of ["ultraviolet", "methane", "normal", "methane"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.equal(f.selection.state().committed.lensId, id);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
      assert.equal(f.residency.stats().pools.find(pool => pool.id === "warm").resident, 0);
    }
    const surfaceJobs = f.jobs.filter(job => /jupiter-(?:lens|surface|poles)/.test(job.url));
    assert.equal(new Set(surfaceJobs.map(job => job.url)).size, surfaceJobs.length);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

for (const replacement of [false, true]) test(`Jupiter retained-root retirement preserves ownership (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    mountPreparedPresentation(f.stage, f.context, runtimeDefinition); f.stage.dataset.lens = "selected";
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.lens = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.lens, replacement ? "replacement" : undefined);
    assert.equal(f.stage.children.length, replacement ? 1 : 0);
  } finally { f.restore(); }
});

test("Jupiter's directional neighborhood is data passed to the common bounded owner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enabled = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enabled;
    for (const [pitch, expected] of [[0, ["lighting:35", "lighting:36"]], [89, ["lighting:0"]]]) {
      f.selection.setView({ ...f.view, controlPitch: pitch }); await f.settle();
      assert.deepEqual(f.selection.state().plan.prewarm, expected);
      assert.ok(f.residency.stats().pools.find(pool => pool.id === "lighting").nativeSlots <= 3);
    }
  } finally { f.restore(); }
});

test("Jupiter native publication failure reaches the common fatal owner once", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const previous = f.selection.state().committed;
    const material = f.stage.querySelectorAll("*").find(node => node.classList.contains("jupiter-material")).children[0];
    Object.defineProperty(material.style, "backgroundImage", { set() { throw new Error("material publication failed"); } });
    const request = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true });
    const outcome = request.catch(error => error); await f.settle(); await outcome;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /material publication failed/);
    assert.deepEqual(f.selection.state().committed, previous);
    assert.equal(f.listenerCount(), 0); assert.equal(f.residency.stats().images.entries.length, 0);
    for (const job of f.jobs) job.reject(new Error("late")); await f.flush();
    assert.equal(f.errors.length, 1);
  } finally { f.restore(); }
});

test("Jupiter latest lens wins; decode failure retains the committed material and retries", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const original = f.selection.state().committed;
    const first = f.selection.dispatch({ kind: "lens", id: "ultraviolet" }); await f.flush();
    const abandoned = [...f.jobs];
    const second = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    for (const job of f.jobs.filter(job => !abandoned.includes(job))) { job.done = true; job.resolve(); }
    assert.equal(await second, true); assert.equal(await first, false);
    for (const job of abandoned) job.reject(new Error("late")); await f.flush();
    assert.equal(f.selection.state().committed.lensId, "methane");
    const failed = f.selection.dispatch({ kind: "lens", id: "ultraviolet" }); const rejection = assert.rejects(failed, /decode/);
    await f.flush(); f.jobs.at(-1).done = true; f.jobs.at(-1).reject(new Error("decode failure")); await rejection;
    assert.equal(f.selection.state().committed.lensId, "methane");
    const retry = f.selection.dispatch({ kind: "lens", id: "ultraviolet" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.selection.state().committed.lensId, "ultraviolet"); assert.deepEqual(f.errors, []);
    const pending = f.selection.dispatch({ kind: "lens", id: original.lensId }); f.lifetime.destroy(); assert.equal(await pending, false);
  } finally { f.restore(); }
});

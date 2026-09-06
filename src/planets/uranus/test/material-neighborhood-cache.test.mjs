import { resolvePreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { preparedSelectionFixture } from "../../../platform/test/object-runtime-package.mjs";
const rowPool = f => f.residency.stats().pools.find(pool => pool.id === "rows");

test("Uranus pending lens preserves the published row and a failed row remains retryable", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enabled = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await enabled, true);
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, 0], revision: 2 }); await f.settle();
    const active = rowPool(f).keys;
    const published = f.selection.state().plan.required.find(key => key.startsWith("row:"));
    const frame = f.presentation.observe().materials.lighting.appliedFrame;
    assert.equal(active.length, 6);
    const request = f.selection.dispatch({ kind: "lens", id: "methane" });
    const rejection = assert.rejects(request, /decode/); await f.flush();
    assert.ok(rowPool(f).resident <= 6); assert.ok(rowPool(f).pending > 0);
    assert.ok(rowPool(f).keys.includes(published));
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, frame);
    const requestedRow = runtimeDefinition.assets.entries.find(entry => entry.key === published.replace("normal", "methane"));
    const job = f.jobs.find(job => !job.done && job.url === requestedRow.url); assert.ok(job); job.done = true; job.reject(new Error("material decode failed"));
    await rejection; await f.flush();
    assert.equal(f.selection.state().committed.lensId, "normal");
    assert.ok(rowPool(f).keys.includes(published));
    assert.equal(f.presentation.observe().materials.lighting.appliedFrame, frame);
    assert.equal(f.lifetime.disposed, false);
    const retry = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.settle(); assert.equal(await retry, true);
    assert.ok(rowPool(f).keys.every(key => key.startsWith("row:methane:")));
    assert.equal(rowPool(f).resident, 6); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Uranus A/B/A replacement cannot release the winning active neighborhood", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enabled = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await enabled, true);
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, 0], revision: 2 }); await f.settle();
    const active = rowPool(f).keys;
    const a = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    const b = f.selection.dispatch({ kind: "lens", id: "near-infrared" }); await f.flush();
    const winner = f.selection.dispatch({ kind: "lens", id: "normal" }); await f.flush();
    assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    for (const job of f.jobs.filter(job => !job.done && !job.url.includes("normal"))) { job.done = true; job.reject(new Error("late retired row")); }
    await f.settle(); assert.deepEqual(rowPool(f).keys, active);
    assert.equal(f.stage.dataset.lens, "normal"); assert.deepEqual(f.errors, []);
    assert.equal(rowPool(f).resident, 6);
  } finally { f.restore(); }
});

test("Uranus camera changes during pending selection revalidate the current neighborhood", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    const pending = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    const view = { ...f.view, controlPitch: 89, sunViewDirection: [0, 0, -1], revision: 2 };
    f.selection.setView(view); await f.settle(); assert.equal(await pending, true);
    const expected = resolvePreparedPresentation(runtimeDefinition, { selection: f.selection.state().committed, view, previousPlan: f.selection.state().plan });
    assert.deepEqual(rowPool(f).keys.toSorted(), [...expected.required, ...expected.prewarm].filter(key => key.startsWith("row:")).toSorted());
    assert.ok(rowPool(f).resident <= 6); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Uranus hidden lighting keeps its committed neighborhood and publisher row through camera movement", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const off = f.selection.dispatch({ kind: "toggle", name: "shadows", value: false }); await f.settle(); await off;
    const active = rowPool(f).keys, row = f.presentation.observe().materials.lighting.row;
    const jobs = f.jobs.length, writes = f.presentation.observe().materials.lighting.addressWrites;
    for (const z of [-1, 1, -.5]) {
      f.selection.setView({ ...f.view, controlPitch: 89, sunViewDirection: [0, 0, z], revision: f.view.revision + 1 });
      await f.settle();
      assert.deepEqual(rowPool(f).keys, active); assert.equal(f.jobs.length, jobs);
      assert.equal(f.presentation.observe().materials.lighting.row, row);
      assert.equal(f.presentation.observe().materials.lighting.addressWrites, writes);
    }
  } finally { f.restore(); }
});


test("Uranus native row release failure is fatal and still releases sibling ownership", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enabled = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); assert.equal(await enabled, true);
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, 0], revision: 2 }); await f.settle();
    const key = rowPool(f).keys[0], url = runtimeDefinition.assets.entries.find(entry => entry.key === key).url;
    const native = f.jobs.find(job => job.url === url).image;
    native.removeAttribute = () => { throw new Error("native release failed"); };
    const previous = f.selection.state().committed;
    const pending = f.selection.dispatch({ kind: "lens", id: "methane" });
    const outcome = pending.catch(error => error); await f.settle(); await outcome;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.deepEqual(f.selection.state().committed, previous);
    assert.equal(f.residency.stats().images.entries.length, 0);
    assert.equal(f.listenerCount(), 0);
    for (const job of f.jobs) job.reject(new Error("late")); await f.flush();
    assert.equal(f.errors.length, 1);
  } finally { f.restore(); }
});

import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "./prepared-fixture.mjs";
import { mountPreparedPresentation, resolvePreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mjs";

const pool = (f, id) => f.residency.stats().pools.find(pool => pool.id === id);
async function directional(f) {
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

test("Neptune waits for the current camera row before committing a delayed lens", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await directional(f);
    const request = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    assert.equal(f.stage.dataset.lens, "normal");
    const firstJobs = f.jobs.filter(job => !job.done);
    const view = { ...f.view, controlPitch: 9, sunViewDirection: [0, 0, -1], revision: 3 };
    f.selection.setView(view);
    for (const job of firstJobs) { job.done = true; job.resolve(); } await f.flush();
    assert.equal(f.stage.dataset.lens, "normal");
    await f.settle(); assert.equal(await request, true);
    const facts = resolvePreparedPresentation(runtimeDefinition, { selection: f.selection.state().committed, view }).materials.lighting;
    assert.equal(f.presentation.observe().materials.lighting.appliedRow, facts.row);
    assert.ok(f.residency.resources.has(`lighting:methane:${facts.row}`));
    assert.ok(pool(f, "lighting").nativeSlots <= 3);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Neptune A/B/A supersession retains active and latest pending assets only", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await directional(f);
    const a = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    const b = f.selection.dispatch({ kind: "lens", id: "near-infrared" }); await f.flush();
    const winner = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.flush();
    assert.equal(pool(f, "variant").resident, 8);
    assert.ok(pool(f, "variant").keys.every(key => key.endsWith(":normal") || key.endsWith(":methane")));
    await f.settle(); assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    assert.equal(pool(f, "variant").resident, 4); assert.equal(f.stage.dataset.lens, "methane");
    assert.ok(pool(f, "lighting").nativeSlots <= 3); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Neptune failed material request keeps the visible bank and remains retryable", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await directional(f);
    const active = pool(f, "variant").keys;
    const request = f.selection.dispatch({ kind: "lens", id: "methane" });
    const rejected = assert.rejects(request, /decode/); await f.flush();
    const row = f.jobs.find(job => !job.done && job.url.includes("orbit-material-methane"));
    assert.ok(row); row.done = true; row.reject(new Error("prepared row failed")); await rejected;
    assert.deepEqual(pool(f, "variant").keys, active); assert.equal(f.stage.dataset.lens, "normal");
    const retry = f.selection.dispatch({ kind: "lens", id: "methane" }); await f.settle(); assert.equal(await retry, true);
    assert.deepEqual(f.errors, []); assert.equal(f.lifetime.disposed, false);
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

test("Neptune fatal native publication cannot promote a partially applied selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const previous = f.selection.state().committed;
    f.stage.style.setProperty = () => { throw new Error("native publication failed"); };
    const result = f.selection.dispatch({ kind: "lens", id: "methane" }).catch(error => error);
    await f.settle(); await result;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.deepEqual(f.selection.state().committed, previous); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Neptune one native image cleanup failure cannot retain sibling owners", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const entry = runtimeDefinition.assets.entries.find(entry => entry.key === pool(f, "variant").keys[0]);
    f.jobs.find(job => job.url === entry.url).image.removeAttribute = () => { throw new Error("native release failed"); };
    const errors = f.lifetime.destroy(); assert.equal(errors.length, 1);
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

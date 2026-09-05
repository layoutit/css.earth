import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { variantFor, materialState } from "../runtime/material.mjs";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";
const pool = (f, id) => f.residency.stats().pools.find(pool => pool.id === id);
const lens = id => ({ kind: "lens", id });
const toggle = (name, value) => ({ kind: "toggle", name, value });
async function select(f, action) { const result = f.selection.dispatch(action); await f.settle(); assert.equal(await result, true); }

for (const failAtElement of [1, 2, 3]) test(`Saturn partial construction preserves the prior root (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous"; f.stage.dataset.view = "previous";
    assert.throws(() => runtimeDefinition.createPresentation(f.stage, f.context), /injected native/);
    assert.deepEqual(f.lifetime.destroy(), []); assert.equal(f.stage.dataset.view, "previous");
  } finally { f.restore(); }
});
for (const replacement of [false, true]) test(`Saturn cleanup respects root identity (${replacement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  try {
    runtimeDefinition.createPresentation(f.stage, f.context);
    if (replacement) { f.stage.replaceChildren(f.document.createElement("div")); f.stage.dataset.view = "replacement"; }
    assert.deepEqual(f.lifetime.destroy(), []);
    assert.equal(f.stage.dataset.view, replacement ? "replacement" : undefined);
  } finally { f.restore(); }
});

test("Saturn commits one coherent latest lens, rings, shadows and independent interior selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const root = f.stage.children[0], nodes = root.querySelectorAll("*");
    const requests = [];
    for (const action of [lens("methane"), lens("cross-section"), toggle("rings", false), toggle("shadows", true)]) {
      requests.push(f.selection.dispatch(action)); await f.flush();
    }
    assert.equal(f.stage.dataset.lens, undefined); assert.equal(f.stage.dataset.view, undefined);
    await f.settle(); assert.deepEqual(await Promise.all(requests), [false, false, false, true]);
    const selection = f.selection.state().committed;
    assert.equal(selection.lensId, "methane"); assert.equal(selection.interior, true);
    assert.equal(selection.rings, false); assert.equal(selection.shadows, true);
    assert.equal(f.stage.dataset.lens, "methane"); assert.equal(f.stage.dataset.view, "interior");
    assert.ok(f.stage.classList.contains("saturn-hide-rings")); assert.ok(!f.stage.classList.contains("saturn-hide-shadows"));
    assert.deepEqual(f.buttons.filter(button => button["aria-pressed"] === "true").map(button => button.value), ["methane", "cross-section"]);
    assert.ok(f.residency.resources.has(`exterior:${variantFor(selection)}`));
    assert.ok(f.residency.resources.has(`interior-material:${variantFor(selection)}`));
    assert.deepEqual(root.querySelectorAll("*"), nodes); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn repeated interior toggles use desired pending state and release abandoned interior leases", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const a = f.selection.dispatch(lens("cross-section")); await f.flush();
    const b = f.selection.dispatch(lens("cross-section")); await f.settle();
    assert.deepEqual(await Promise.all([a, b]), [false, true]);
    assert.equal(f.selection.state().committed.interior, false); assert.equal(pool(f, "interior").resident, 0);
    assert.equal(pool(f, "interior-material").resident, 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn lens A/B/A retires obsolete groups and late decode rejection cannot replace the winner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const a = f.selection.dispatch(lens("methane")); await f.flush();
    const b = f.selection.dispatch(lens("thermal")); await f.flush();
    const abandoned = f.jobs.filter(job => !job.done && job.url.includes("thermal"));
    const winner = f.selection.dispatch(lens("methane")); await f.flush();
    assert.ok(pool(f, "lenses").nativeSlots <= 8); assert.ok(pool(f, "exterior-material").nativeSlots <= 2);
    for (const job of abandoned) { job.done = true; job.reject(new Error("late abandoned decode")); }
    await f.settle(); assert.deepEqual(await Promise.all([a, b, winner]), [false, false, true]);
    assert.equal(f.stage.dataset.lens, "methane"); assert.equal(pool(f, "lenses").resident, 4);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn partial group failure retains committed presentation, resets desire and allows retry", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const before = f.selection.state().committed;
    const pending = f.selection.dispatch(lens("methane")); const failed = assert.rejects(pending, /decode/); await f.flush();
    const jobs = f.jobs.filter(job => !job.done); assert.ok(jobs.length > 1);
    jobs[0].done = true; jobs[0].resolve(); jobs[1].done = true; jobs[1].reject(new Error("partial decode failed")); await failed;
    assert.deepEqual(f.selection.state().committed, before); assert.deepEqual(f.selection.state().desired, before);
    await select(f, toggle("rings", false)); assert.equal(f.selection.state().committed.lensId, "normal");
    await select(f, lens("methane")); assert.equal(f.stage.dataset.lens, "methane"); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn delayed compound preparation uses the current camera frame at publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch(lens("cross-section")); await f.flush();
    const view = { ...f.view, controlPitch: 72, controlYaw: 31, sunViewDirection: [0, 0, -1], revision: 2 };
    f.selection.setView(view); await f.settle(); assert.equal(await pending, true);
    assert.equal(f.presentation.observe().material.materialFrame, materialState(f.selection.state().committed, view).materialFrame);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn disposal settles never-ending groups and prevents late publication", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch(lens("cross-section")); await f.flush(); f.lifetime.destroy();
    assert.equal(await pending, false); const count = f.jobs.length; f.stage.dataset.view = "replacement";
    for (const job of f.jobs.filter(job => !job.done)) { job.done = true; job.reject(new Error("late")); }
    await f.flush(); assert.equal(f.jobs.length, count); assert.equal(f.stage.dataset.view, "replacement");
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Saturn native material publication failure cannot promote partially applied selection", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const before = f.selection.state().committed;
    const leaf = f.stage.querySelectorAll("*").find(node => node.classList.contains("saturn-interior-material"));
    Object.defineProperty(leaf.style, "backgroundImage", { configurable: true, set() { throw new Error("native publication failed"); } });
    const pending = f.selection.dispatch(lens("cross-section")).catch(error => error); await f.settle(); await pending;
    assert.equal(f.lifetime.disposed, true); assert.equal(f.errors.length, 1);
    assert.deepEqual(f.selection.state().committed, before); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

test("Saturn native cleanup failure cannot retain sibling resource or control owners", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    await select(f, lens("methane"));
    const entry = runtimeDefinition.assets.entries.find(entry => entry.key === pool(f, "lenses").keys[0]);
    f.jobs.find(job => job.url === entry.url && job.image.src).image.removeAttribute = () => { throw new Error("native release failed"); };
    assert.equal(f.lifetime.destroy().length, 1); assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

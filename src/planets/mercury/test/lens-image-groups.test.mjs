import { mountPreparedPresentation } from "../../../platform/prepared-presentation.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../runtime/definition.mjs";
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";
const pool = f => f.residency.stats().pools.find(pool => pool.id === "lenses");

test("Mercury partial interior failure retires all siblings and retries independently", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "interior" });
    const rejection = assert.rejects(pending, /decode/); await f.flush();
    const original = f.jobs.filter(job => !job.done); assert.equal(original.length, 5);
    original[0].done = true; original[0].resolve(); original[1].done = true; original[1].reject(new Error("core failed"));
    await rejection; assert.ok(original.every(job => job.image.src === ""));
    assert.equal(pool(f).resident, 0); assert.equal(f.stage.dataset.view, undefined);
    const retry = f.selection.dispatch({ kind: "lens", id: "interior" }); await f.settle(); assert.equal(await retry, true);
    assert.equal(f.stage.dataset.view, "interior"); assert.equal(pool(f).resident, 5); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mercury supersession and disposal settle without native completion", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const old = f.selection.dispatch({ kind: "lens", id: "interior" }); await f.flush(); const retired = f.jobs.filter(job => !job.done);
    const winner = f.selection.dispatch({ kind: "lens", id: "enhanced" }); await f.flush();
    assert.equal(await old, false); assert.ok(retired.every(job => job.image.src === ""));
    await f.settle(); assert.equal(await winner, true); assert.equal(f.stage.dataset.lens, "enhanced");
    const pending = f.selection.dispatch({ kind: "lens", id: "interior" }); await f.flush();
    f.lifetime.destroy(); assert.equal(await pending, false); assert.equal(pool(f).resident, 0);
    for (const job of f.jobs.filter(job => !job.done)) job.reject(new Error("late")); await f.flush();
    assert.equal(f.residency.stats().images.entries.length, 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mercury retains one prepared interior and its shared pose animation across lens changes", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes = f.stage.querySelectorAll("*");
    assert.equal(f.animations.length, 1);
    f.playback.setAllowed(true);
    for (const id of ["interior", "enhanced", "interior", "normal", "interior"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes); assert.equal(f.animations.length, 1);
    }
    const change = f.selection.dispatch({ kind: "cycle", name: "speed", value: 2 }); await f.settle(); await change;
    f.selection.setView({ ...f.view, controlPitch: 89, revision: 2 }); await f.settle();
    const pose = f.playback.stats().animations[0];
    assert.equal(pose.mode, "pose"); assert.equal(pose.running, false); assert.equal(pose.rate, 1);
    assert.equal(pose.currentTime, 89000);
    f.lifetime.destroy(); assert.equal(f.animations[0].playState, "idle");
  } finally { f.restore(); }
});

test("Mercury native cleanup failure releases every other lens owner", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "interior" }); await f.flush();
    const jobs = f.jobs.filter(job => !job.done);
    jobs[0].image.removeAttribute = () => { throw new Error("native release failed"); };
    assert.equal(f.lifetime.destroy().length, 1); assert.equal(await pending, false);
    assert.ok(jobs.slice(1).every(job => job.image.src === ""));
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

for (const failAtElement of [1, 2, 3]) test(`Mercury partial construction leaves the previous presentation intact (${failAtElement})`, () => {
  const f = retainedPresentationFixture(runtimeDefinition, { failAtElement });
  try {
    f.stage.dataset.lens = "previous";
    assert.throws(() => mountPreparedPresentation(f.stage, f.context, runtimeDefinition), /injected native/);
    f.lifetime.destroy(); assert.equal(f.stage.dataset.lens, "previous");
  } finally { f.restore(); }
});

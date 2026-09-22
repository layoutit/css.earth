import {parsePreparedObjectRuntime} from '../../../../src/renderers/css/dist/index.js';
const runtimeDefinition=parsePreparedObjectRuntime(runtimeSource);
import {required} from '../../../../tools/contract/test-values.mts';
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import assert from "node:assert/strict";
import test from "node:test";
import runtimeSource from "../../../../src/objects/mercury/prepared/runtime.json" with {type: "json"};
import { preparedSelectionFixture, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";
const pool = (f:Awaited<ReturnType<typeof preparedSelectionFixture>>) => required(f.residency.stats().pools.find((pool: { id: string; }) => pool.id === "lenses"));

test("Mercury Shadows swaps both cutaway exterior textures while retaining the interior", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const request = f.selection.dispatch({ kind: "lens", id: "interior" });
    await f.settle(); await request;
    const nodes = f.stage.querySelectorAll("*");
    const body = required(nodes.find(node => node.classList.contains("mercury-cutaway-body")));
    const read = () => ["--mercury-interior-outer-image", "--mercury-interior-outer-poles-image"]
      .map(name => body.style.getPropertyValue(name));
    const states: string[][] = [];
    for (const value of [false, true, false]) {
      const change = f.selection.dispatch({ kind: "toggle", name: "shadows", value });
      await f.settle(); await change;
      states.push(read());
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes);
    }
    assert.ok(states[0].every((url, index) => url.includes("-unlit") && url !== states[1][index]));
    assert.deepEqual(states[0], states[2]);
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mercury partial interior failure retires all siblings and retries independently", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const pending = f.selection.dispatch({ kind: "lens", id: "interior" });
    const rejection = assert.rejects(pending, /decode/); await f.flush();
    // Every interior image the lens requests (outer surface and poles, their unlit variants, core, core poles, section).
    const interiorImages = runtimeDefinition.assets.entries.filter(entry => entry.key.startsWith("interior:")).length;
    const original = f.jobs.filter(job => !job.done); assert.ok(original.length >= 5 && original.length <= interiorImages, `${original.length} pending of ${interiorImages}`);
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
    assert.equal(f.animations.length, 2);
    f.playback.setAllowed(true);
    for (const id of ["interior", "enhanced", "interior", "normal", "interior"]) {
      const request = f.selection.dispatch({ kind: "lens", id }); await f.settle(); assert.equal(await request, true);
      assert.deepEqual(f.stage.querySelectorAll("*"), nodes); assert.equal(f.animations.length, 2);
    }
    const change = f.selection.dispatch({ kind: "cycle", name: "speed", value: 2 }); await f.settle(); await change;
    f.selection.setView({ ...f.view, controlPitch: 89, revision: 2 }); await f.settle();
    const pose = required(f.playback.stats().animations.find(animation=>animation.mode === "pose"));
    assert.equal(pose.mode, "pose"); assert.equal(pose.running, false); assert.equal(pose.rate, 1);
    assert.equal(pose.currentTime, 89000);
    f.lifetime.destroy(); assert.ok(f.animations.every(animation=>animation.playState === "idle"));
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

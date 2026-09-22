import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import runtimeDefinition from "../../../../src/objects/mercury/prepared/runtime.json" with {type: "json"};
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
const rows = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>) => f.residency.stats().pools.find((pool: { id: string; }) => pool.id === "lighting");

test("Mercury keeps its visible row while shared residency replaces pending demand within three slots", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    const initial = f.presentation.observe().materials.lighting.appliedRow;
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, -1], revision: 2 }); await f.flush();
    const first = f.jobs.filter(job => !job.done);
    assert.equal(f.presentation.observe().materials.lighting.appliedRow, initial);
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, 0], revision: 3 }); await f.flush();
    for (const job of first) { job.done = true; job.resolve(); }
    await f.settle(); assert.equal(f.presentation.observe().materials.lighting.appliedRow, 16);
    assert.ok(required(rows(f)).nativeSlots <= 3); assert.equal(required(rows(f)).pending, 0);
    f.selection.setView({ ...f.view, sunViewDirection: [1, 0, -1], revision: 4 }); await f.flush();
    f.lifetime.destroy();
    for (const job of f.jobs.filter(job => !job.done)) job.reject(new Error("late row")); await f.flush();
    assert.equal(f.residency.stats().images.entries.length, 0); assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Mercury shared row disposal attempts every native slot after a release failure", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    const url = required(runtimeDefinition.assets.entries.find(entry => entry.key === required(rows(f)).keys[0])).url;
    required(f.jobs.findLast(job => job.url === url)).image.removeAttribute = () => { throw new Error("row release failed"); };
    assert.equal(f.lifetime.destroy().length, 1);
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.playback.stats().registeredCount, 0);
  } finally { f.restore(); }
});

import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mts";
import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";
const pool = (f: Awaited<ReturnType<typeof preparedSelectionFixture>>, id: string) => required(f.residency.stats().pools.find(pool => pool.id === id));

test("Earth shared row demand coalesces transient camera views and keeps both material pools bounded", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    const count = f.jobs.length;
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, -1], skySunViewDirection: [0, 0, 1], revision: 2 })); await f.flush();
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0], revision: 3 })); await f.flush();
    const started = f.jobs.slice(count);
    assert.ok(started.length > 0, "atmosphere rows start while the camera is moving");
    assert.ok(started.every(job => job.url.includes("earth-atmosphere-")),
      "ground-lighting rows still wait for the common stability timer");
    for (const id of ["lighting", "atmosphere"]) assert.ok(pool(f, id).nativeSlots <= 3);
    await f.settle();
    assert.equal(f.presentation.observe().materials.lighting.frame, 64);
    assert.equal(f.presentation.observe().materials.atmosphere.frame, 64);
    for (const id of ["lighting", "atmosphere"]) { assert.ok(pool(f, id).nativeSlots <= 3); assert.equal(pool(f, id).pending, 0); }
    assert.deepEqual(f.errors, []);
  } finally { f.restore(); }
});

test("Earth superseded material decode cannot suppress a newer camera target", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, -1], skySunViewDirection: [0, 0, 1], revision: 2 })); await f.flush(); f.advanceTimers(); await f.flush();
    const old = f.jobs.filter(job => !job.done);
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0], revision: 3 })); await f.flush();
    for (const job of old) { job.done = true; job.reject(new Error("stale row")); }
    await f.settle();
    assert.equal(f.presentation.observe().materials.lighting.frame, 64); assert.equal(f.presentation.observe().materials.atmosphere.frame, 64);
    assert.deepEqual(f.errors, []); assert.deepEqual(f.materialErrors, []);
  } finally { f.restore(); }
});

test("Earth interior, night lights, and atmosphere visibility stop demand for hidden material rows", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0], revision: 2 })); await f.settle();
    const night = f.selection.dispatch({ kind: "lens", id: "night-lights" }); await f.settle(); await night;
    assert.ok(!required(f.selection.state().plan).required.some(key => key.startsWith("lighting:")));
    assert.ok(pool(f, "lighting").resident <= 3); assert.ok(pool(f, "atmosphere").resident > 0);
    const hide = f.selection.dispatch({ kind: "toggle", name: "atmosphere", value: false }); await f.settle(); await hide;
    assert.ok(!required(f.selection.state().plan).required.some(key => key.startsWith("atmosphere:")));
    const interior = f.selection.dispatch({ kind: "lens", id: "cross-section" }); await f.settle(); await interior;
    const before = f.jobs.length;
    f.selection.setView(Object.assign({}, { ...f.view, sunViewDirection: [1, 0, -1], skySunViewDirection: [0, 0, 1], revision: 3 })); await f.settle();
    assert.equal(f.jobs.length, before);
    assert.ok(pool(f, "lighting").resident <= 3); assert.ok(pool(f, "atmosphere").resident <= 3);
  } finally { f.restore(); }
});

test("Earth one native material release failure still retires both pools and every pending slot", async () => {
  const f = await preparedSelectionFixture(runtimeDefinition);
  try {
    const enable = f.selection.dispatch({ kind: "toggle", name: "shadows", value: true }); await f.settle(); await enable;
    const key = pool(f, "atmosphere").keys[0];
    const url = required(runtimeDefinition.assets.entries.find(entry => entry.key === key)).url;
    required(f.jobs.findLast(job => job.url === url)).image.removeAttribute = () => { throw new Error("native release failed"); };
    assert.equal(f.lifetime.destroy().length, 1);
    assert.equal(f.residency.stats().images.entries.length, 0); assert.equal(f.listenerCount(), 0);
  } finally { f.restore(); }
});

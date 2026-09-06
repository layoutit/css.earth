import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedResidency } from "./prepared-residency.mjs";
import PREPARED_MERCURY_ASSETS from "../../objects/preparation/mercury/assets.json" with {type: "json"};
import { PREPARED_MARS_LIGHTING } from "../planets/mars/runtime/preparedLighting.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../planets/jupiter/runtime/preparedLighting.mjs";
import { PREPARED_EARTH_SCENE } from "../planets/earth/runtime/preparedScene.mjs";
import { PREPARED_EARTH_LENSES } from "../planets/earth/runtime/preparedLenses.mjs";
import { PREPARED_URANUS_LENSES } from "../planets/uranus/runtime/preparedLenses.mjs";
import { PREPARED_SATURN_LENSES } from "../planets/saturn/runtime/preparedLenses.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE } from "../planets/saturn/runtime/preparedSceneRuntime.mjs";

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function harness(assets, options = {}) {
  const jobs = [], images = [], notifications = [], errors = [];
  const manager = createPreparedResidency({ assets, onReady: key => notifications.push(key), onWarmError: error => errors.push(error),
    createImage() {
      const image = { naturalWidth: 1, naturalHeight: 1, decode() {
        return new Promise((resolve, reject) => jobs.push({ image, url: image.src, resolve, reject }));
      } };
      images.push(image); return image;
    }, ...options,
  });
  async function complete() {
    for (let wave = 0; wave < 30; wave++) {
      for (const job of jobs) if (!job.done) { job.done = true; job.resolve(); }
      await flush();
      if (jobs.every(job => job.done)) return;
    }
    throw new Error("Decode queue did not drain.");
  }
  async function commit(required, prewarm = []) {
    const ticket = manager.request({ required, prewarm });
    await complete();
    assert.equal(await ticket.ready, ticket);
    manager.commit(ticket);
    return ticket;
  }
  return { manager, jobs, images, notifications, errors, complete, commit };
}
function catalog(urls, { capacity = urls.length, concurrency = capacity, retention = "selection", eviction = "unused", reuse = true, startup = [] } = {}) {
  return { pools: [{ id: "material", capacity, concurrency, retention, eviction, reuse }],
    entries: urls.map((url, index) => ({ key: String(index), url, pool: "material" })), startup: startup.map(String) };
}
const rowPlans = {
  mercury: PREPARED_MERCURY_ASSETS.lighting.banks[2], mars: PREPARED_MARS_LIGHTING.banks[2],
  jupiter: PREPARED_JUPITER_LIGHTING,
  earthLighting: PREPARED_EARTH_SCENE.material.lighting, earthAtmosphere: PREPARED_EARTH_SCENE.material.atmosphere,
};
for (const [name, plan] of Object.entries(rowPlans)) test(`${name} prepared row policy preserves its bound and protected published row`, async () => {
  const { maximumRetainedRowCount: capacity, initialWarmRows } = plan.transport;
  const rowUrls = (plan.preparedRows ?? plan.rows).map(row => row.assets?.two ?? row.url ?? row.assetUrl);
  const { manager, images, complete, commit } = harness(catalog(rowUrls, { capacity, eviction: "capacity", startup: initialWarmRows }));
  const startup = manager.prepareStartup(); await complete(); assert.equal(await startup, true); manager.finishStartup();
  const initial = String(plan.transport.defaultRow);
  await commit([initial], initialWarmRows.map(String));
  manager.beginFrame(); assert.ok(manager.resources.url(initial)); manager.endFrame();
  const target = "0", ticket = manager.request({ required: [target], prewarm: ["1", "2"] });
  assert.equal(manager.resources.has(initial), true);
  assert.ok(manager.stats().pools[0].resident <= capacity);
  await complete(); await ticket.ready;
  manager.beginFrame(); manager.resources.url(target); manager.endFrame(); manager.commit(ticket);
  assert.ok(manager.stats().pools[0].resident <= capacity);
  assert.ok(images.length <= capacity);
  assert.equal(manager.resources.has(target), true);
  manager.destroy();
});

test("Uranus retains only active plus latest pending prepared neighborhoods", async () => {
  const rows = PREPARED_URANUS_LENSES.controls.slice(0, 3).flatMap(lens => lens.materialViewBank[2].rows.map(row => row.url));
  const { manager, jobs, commit, complete } = harness(catalog(rows, { capacity: 6 }));
  await commit(["3", "4", "5"]);
  const abandoned = manager.request({ required: ["19", "20", "21"] });
  const next = manager.request({ required: ["35", "36", "37"] });
  assert.equal(await abandoned.ready, null);
  assert.deepEqual(manager.stats().pools[0].keys, ["3", "4", "5", "35", "36", "37"]);
  assert.ok(jobs.length >= 9); // Replacement starts before abandoned native jobs settle.
  await complete(); await next.ready; manager.commit(next);
  assert.deepEqual(manager.stats().pools[0].keys, ["35", "36", "37"]);
  assert.throws(() => manager.commit(abandoned), /stale/);
  manager.discard(abandoned);
  assert.equal(manager.resources.has("36"), true);
  manager.destroy();
});

test("Earth complete page groups retain the committed bank with only two pending decodes", async () => {
  const banks = PREPARED_EARTH_LENSES.controls.filter(lens => lens.surfaceUrls && !lens.surfaceBankId);
  const urls = banks.flatMap(lens => lens.surfaceUrls);
  // Page arrays are the prepared lens data; fail if their schema changes.
  assert.ok(urls.length >= 6, "Use the actual prepared surface page banks");
  const width = banks[0].surfaceUrls.length;
  assert.ok(banks.every(lens => lens.surfaceUrls.length === width));
  const { manager, jobs, complete, commit } = harness(catalog(urls, { capacity: width * 2, concurrency: 2, reuse: false }));
  const bank = offset => Array.from({ length: width }, (_, i) => String(offset + i));
  await commit(bank(0));
  const old = manager.request({ required: bank(width) });
  assert.equal(manager.stats().images.pools[0].active, 2);
  manager.discard(old); assert.equal(await old.ready, null);
  const next = manager.request({ required: bank(width * 2) });
  assert.equal(manager.stats().images.pools[0].active, 2);
  assert.deepEqual(manager.stats().committed, bank(0));
  assert.throws(() => manager.commit(next), /unprepared/);
  await complete(); await next.ready; manager.commit(next);
  assert.deepEqual(manager.stats().committed, bank(width * 2));
  assert.equal(manager.stats().pools[0].resident, width);
  assert.ok(jobs.length > width * 2);
  manager.destroy();
});

test("Saturn surface, ring and material groups transfer together and failed requests preserve the active group", async () => {
  const lenses = PREPARED_SATURN_LENSES.controls.slice(0, 3);
  const assets = { entries: [], pools: [], startup: [] };
  for (const field of ["surfaceUrl", "ringUrl"]) {
    assets.pools.push({ id: field, capacity: 2, concurrency: 2, retention: "selection", reuse: false });
    for (const lens of lenses) assets.entries.push({ key: `${lens.id}/${field}`, url: lens[field], pool: field });
  }
  for (const [category, plan] of Object.entries({ exterior: PREPARED_SATURN_RUNTIME_SCENE.preparedLighting.orbitAtlas.runtimeShards,
    interior: PREPARED_SATURN_RUNTIME_SCENE.interior.atmosphere.runtimeShards })) {
    assets.pools.push({ id: category, capacity: 2, concurrency: 2, retention: "selection", reuse: false });
    for (const lens of lenses) {
      const atlas = plan.variants[lens.id].runtimeAtlas;
      assets.entries.push({ key: `${lens.id}/${category}`, url: atlas.asset2xUrl ?? atlas.assetUrl, pool: category });
    }
  }
  const keys = lens => assets.entries.filter(entry => entry.key.startsWith(lens.id + "/")).map(entry => entry.key);
  const { manager, commit, jobs, complete } = harness(assets);
  await commit(keys(lenses[0]));
  const failed = manager.request({ required: keys(lenses[1]) });
  const failJob = jobs.at(-1); failJob.done = true; failJob.reject(new Error("rings unavailable"));
  await assert.rejects(failed.ready, /decode/); await flush();
  assert.deepEqual(manager.stats().committed, keys(lenses[0]));
  const replacement = manager.request({ required: keys(lenses[2]) });
  await complete(); await replacement.ready; manager.commit(replacement);
  assert.deepEqual(manager.stats().committed, keys(lenses[2]));
  assert.ok(manager.stats().pools.every(pool => pool.resident === 1));
  manager.destroy();
});

test("frame-used fallback stays protected until a later publication reads its replacement", async () => {
  const { manager, commit, complete } = harness(catalog([0, 1, 2, 3].map(i => `/scenes/mars/row-${i}.webp`), { capacity: 3, eviction: "capacity" }));
  await commit(["0"], ["1", "2"]);
  manager.beginFrame(); manager.resources.url("1"); manager.endFrame();
  const ticket = manager.request({ required: ["3"] });
  assert.equal(manager.resources.has("1"), true);
  await complete(); await ticket.ready; manager.commit(ticket);
  assert.equal(manager.resources.has("1"), true);
  manager.beginFrame(); manager.resources.url("3"); manager.endFrame();
  assert.deepEqual(manager.stats().used, ["3"]);
  manager.destroy();
});

test("over-capacity required demand rejects promptly without retiring the active selection", async () => {
  const { manager, commit } = harness(catalog([0, 1, 2].map(i => `/scenes/mars/row-${i}.webp`), { capacity: 2 }));
  await commit(["0"]);
  assert.throws(() => manager.request({ required: ["1", "2"] }), /capacity/);
  assert.equal(manager.resources.has("0"), true);
  manager.destroy();
});

test("stability delay is shared policy; cancelled work never starts and warm-only handles release after startup", async () => {
  const assets = catalog([0, 1].map(i => `/scenes/earth/material-${i}.webp`), { capacity: 2, startup: [0], retention: "warm" });
  assets.pools[0].stabilityMilliseconds = 120;
  const timers = new Map(); let clockId = 0;
  const { manager, complete, jobs } = harness(assets, {
    schedule(callback, delay) { assert.equal(delay, 120); const id = ++clockId; timers.set(id, callback); return id; },
    unschedule(id) { timers.delete(id); },
  });
  const initial = manager.prepareStartup(); await complete(); await initial; manager.finishStartup();
  assert.equal(manager.stats().pools[0].resident, 0);
  assert.equal(manager.resources.has("0"), true);
  const delayed = manager.request({ required: ["1"] }, { stabilize: true });
  assert.equal(timers.size, 1); assert.equal(jobs.length, 1);
  manager.discard(delayed); assert.equal(await delayed.ready, null);
  assert.equal(timers.size, 0); assert.equal(jobs.length, 1);
  manager.destroy();
});

test("committed warm assets release native leases and do not consume later capacity", async () => {
  const h = harness(catalog([0, 1, 2].map(i => `/scenes/mars/warm-${i}.webp`), { capacity: 1, retention: "warm" }));
  for (const key of ["0", "1", "2", "0"]) {
    await h.commit([key]);
    assert.equal(h.manager.resources.has(key), true);
    assert.equal(h.manager.resources.read(key), null);
    assert.equal(h.manager.stats().pools[0].resident, 0);
  }
  assert.equal(h.jobs.length, 3); assert.equal(h.images.length, 3);
  assert.equal(h.manager.stats().images.pools[0].slots, 0);
  assert.deepEqual(h.manager.stats().warmed, ["0", "1", "2"]); h.manager.destroy();
});
test("cancelled and failed warm demands never acquire a durable readiness receipt", async () => {
  const h = harness(catalog([0, 1].map(i => `/scenes/mars/warm-failure-${i}.webp`), { capacity: 1, retention: "warm" }));
  const abandoned = h.manager.request({ required: ["0"] });
  h.manager.discard(abandoned); assert.equal(await abandoned.ready, null);
  h.jobs[0].reject(new Error("late")); await flush(); assert.deepEqual(h.manager.stats().warmed, []);
  const failed = h.manager.request({ required: ["1"] });
  h.jobs.at(-1).reject(new Error("current")); await assert.rejects(failed.ready, /decode/);
  assert.equal(h.manager.resources.has("1"), false); assert.deepEqual(h.manager.stats().warmed, []);
  const retry = h.manager.request({ required: ["1"] }); await h.complete(); await retry.ready; h.manager.commit(retry);
  assert.equal(h.manager.resources.has("1"), true); h.manager.destroy();
});
test("retiring a warm URL alias preserves a selection owner's native resource", async () => {
  const url = "/scenes/mercury/alias.webp";
  const h = harness({ entries: [{ key: "warm", url, pool: "warm" }, { key: "row", url, pool: "row" }], startup: [],
    pools: [{ id: "warm", capacity: 1, concurrency: 1, retention: "warm", reuse: false },
      { id: "row", capacity: 1, concurrency: 1, retention: "selection", reuse: false }] });
  await h.commit(["warm", "row"]);
  assert.equal(h.jobs.length, 1); assert.equal(h.manager.resources.has("warm"), true);
  assert.equal(h.manager.resources.has("row"), true); assert.ok(h.manager.resources.read("row"));
  assert.equal(h.manager.stats().images.entries.length, 1); h.manager.destroy();
});

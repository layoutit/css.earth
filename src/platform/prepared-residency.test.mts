import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parsePreparedObjectRuntime, type ObjectRuntimeDefinition } from '@cssearth/renderer';
import type { PreparedResidencyOptions, PreparedResourcePool, PreparedResourceEntry, PreparedAssets } from '@cssearth/renderer/platform/prepared-residency';
import type { PreparedImage } from '@cssearth/renderer/platform/prepared-image-store';
import { createPreparedResidency } from '@cssearth/renderer/testing';
import { requireRecord, requireArray } from '@cssearth/core';
import {loadObjectTestDefinition} from '../../tools/contract/object-test-data.mts';
const definitions=Object.fromEntries(await Promise.all(['mercury','mars','jupiter','earth','uranus','saturn'].map(async id=>[id,parsePreparedObjectRuntime(await loadObjectTestDefinition(id))] as const)));
const assetUrl=(definition: ObjectRuntimeDefinition,key: string | null)=>{assert.ok(key); const asset=definition.assets.entries.find(entry=>entry.key===key);assert.ok(asset,`Actual prepared resource ${key} is missing`);return asset.url;};

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
type DecodeJob = { image: PreparedImage; url: string; done?: boolean; resolve(): void; reject(error: Error): void };
type MutableAssets = { entries: PreparedResourceEntry[]; pools: PreparedResourcePool[]; startup: string[] };
function harness(assets: PreparedAssets, options: Partial<PreparedResidencyOptions> = {}) {
  const jobs: DecodeJob[] = [], images: PreparedImage[] = [], notifications: string[] = [], errors: unknown[] = [];
  const manager = createPreparedResidency({ assets, onReady: key => notifications.push(key), onWarmError: error => errors.push(error),
    createImage() {
      const image: PreparedImage = { src: "", decoding: "async", naturalWidth: 1, naturalHeight: 1, decode() {
        return new Promise<void>((resolve, reject) => jobs.push({ image, url: image.src, resolve, reject }));
      } };
      images.push(image); return image;
    }, ...options,
  });
  async function complete() {
    // Every wave settles at least one decode, so a queue that drains at all drains within one wave per prepared entry.
    for (let wave = 0; wave < assets.entries.length + 30; wave++) {
      for (const job of jobs) if (!job.done) { job.done = true; job.resolve(); }
      await flush();
      if (jobs.every(job => job.done)) return;
    }
    throw new Error("Decode queue did not drain.");
  }
  async function commit(required: string[], prewarm: string[] = []) {
    const ticket = manager.request({ required, prewarm });
    await complete();
    assert.equal(await ticket.ready, ticket);
    manager.commit(ticket);
    return ticket;
  }
  return { manager, jobs, images, notifications, errors, complete, commit };
}
type CatalogOptions = Partial<Omit<PreparedResourcePool, "id">> & { startup?: readonly (string | number)[] };
function catalog(urls: readonly string[], { capacity = urls.length, concurrency = capacity, retention = "selection", eviction = "unused", reuse = true, startup = [] }: CatalogOptions = {}): MutableAssets {
  return { pools: [{ id: "material", capacity, concurrency, retention, eviction, reuse }],
    entries: urls.map((url, index) => ({ key: String(index), url, pool: "material" })), startup: startup.map(String) };
}
function preparedRows(value: unknown) {
  const record = requireRecord(value, 'prepared material bank');
  return requireArray(record.rows, 'prepared material rows').map(value => {
    const row = requireRecord(value, 'prepared row');
    assert.equal(typeof row.resource, 'string');
    assert.equal(typeof row.row, 'number');
    assert.ok(typeof row.resource === 'string' && typeof row.row === 'number');
    return {resource: row.resource, row: row.row};
  });
}
function rowPlan(definition: ObjectRuntimeDefinition, trackId='lighting') {
  const track=definition.materials.find(track=>track.id===trackId);
  assert.ok(track);
  const bank=track.banks[0], frame=bank.frames[track.defaultFrame];
  const resource=definition.assets.entries.find(entry=>entry.key===frame.resource);
  assert.ok(resource);
  const pool=definition.assets.pools.find(pool=>pool.id===resource.pool);
  assert.ok(pool);
  const rows=preparedRows(bank);
  assert.ok(rows.length>2, 'Use actual frame-row consumers');
  const selected=[frame.resource,...(frame.prewarm ?? [])];
  return { rows: rows.map(row=>({url:assetUrl(definition,row.resource)})), transport: {
    maximumRetainedRowCount:pool.capacity, defaultRow:frame.row,
    initialWarmRows:selected.map(key=>{const row=rows.find(row=>row.resource===key); assert.ok(row); return row.row;})
  }};
}

test('capacity caches reuse completed datasets but cancel abandoned decodes immediately', async () => {
  const { manager, jobs, commit, complete } = harness(catalog(['/a.webp', '/b.webp', '/c.webp'],
    { capacity: 3, concurrency: 1, eviction: 'capacity' }));
  await commit(['0']);
  const abandoned = manager.request({ required: ['1'] });
  assert.equal(jobs.length, 2);
  const next = manager.request({ required: ['2'] });
  assert.equal(await abandoned.ready, null);
  assert.equal(jobs.length, 3, 'Latest selection starts without waiting for abandoned native work');
  assert.notEqual(jobs[1].image.src, '/b.webp');
  await complete(); await next.ready; manager.commit(next);
  const count = jobs.length;
  await commit(['0']);
  assert.equal(jobs.length, count, 'Completed dataset is reused without decoding');
  manager.destroy();
});
test('decoded byte budget evicts completed pages before admitting an atomic replacement', async () => {
  const assets = catalog(['/coarse.webp', '/fine.webp', '/other.webp'], { capacity: 8, eviction: 'capacity' });
  assets.pools[0].maximumDecodedBytes = 8;
  assets.entries.forEach(entry => { entry.decodedBytes = 4; });
  const { manager, commit, jobs } = harness(assets);
  await commit(['0']); await commit(['1']);
  assert.equal(manager.stats().pools[0].decodedBytes, 8);
  const count = jobs.length;
  await commit(['0']);
  assert.equal(jobs.length, count, 'A visited level stays cached');
  await commit(['2']);
  assert.equal(manager.resources.has('1'), false, 'Evict unused fine page, even with free count slots');
  assert.equal(manager.resources.has('0'), true, 'Previous visible page survives replacement');
  assert.equal(manager.stats().pools[0].decodedBytes, 8);
  assert.throws(() => manager.request({ required: ['0', '1', '2'] }), /capacity/);
  manager.destroy();
});
// Mars's lighting track is the atmospheric single-sheet bank (authored atmosphere, predating the
// #294/#297 frame refactors): it carries no rows, so it gets its own residency case below instead.
const rowPlans={mercury:rowPlan(definitions.mercury),jupiter:rowPlan(definitions.jupiter),earthLighting:rowPlan(definitions.earth),earthAtmosphere:rowPlan(definitions.earth,'atmosphere')};
for (const [name, plan] of Object.entries(rowPlans)) test(`${name} prepared row policy preserves its bound and protected published row`, async () => {
  const { maximumRetainedRowCount: capacity, initialWarmRows } = plan.transport;
  const rowUrls = plan.rows.map(row => row.url);
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

test('mars atmospheric lighting bank is a single warm-pool sheet, not a row bank', async () => {
  const track = definitions.mars.materials.find(track => track.id === 'lighting');
  assert.ok(track);
  const bank = track.banks[0];
  assert.ok(bank.frames.every(frame => frame.resource === null && frame.row === null),
    'An atmospheric material has no per-row resource or retained row: the sheet is fixed.');
  const key = 'lighting', url = assetUrl(definitions.mars, key);
  const pool = definitions.mars.assets.pools.find(pool => pool.id === 'warm');
  assert.ok(pool);
  const { manager, commit } = harness(catalog([url], { capacity: pool.capacity, concurrency: pool.concurrency, retention: pool.retention, reuse: pool.reuse }));
  await commit(['0']);
  assert.equal(manager.resources.has('0'), true, 'The atmospheric sheet is resident once requested.');
  manager.destroy();
});

test("Uranus retains only active plus latest pending prepared neighborhoods", async () => {
  const rows=definitions.uranus.materials[0].banks.flatMap(bank=>preparedRows(bank).map(row=>assetUrl(definitions.uranus,row.resource)));
  // Neighborhoods are read from Uranus's actual prepared banks, so the lane it is baked on
  // (its own, or the shared giant sphere lane) changes how many there are, never the test.
  assert.ok(rows.length >= 9, "Use the actual prepared Uranus neighborhoods");
  const band = (start: number) => [String(start), String(start + 1), String(start + 2)];
  const first = band(0), abandonedBand = band(Math.floor((rows.length - 3) / 2)), lastBand = band(rows.length - 3);
  assert.equal(new Set([...first, ...abandonedBand, ...lastBand]).size, 9, "Use three disjoint neighborhoods");
  const { manager, jobs, commit, complete } = harness(catalog(rows, { capacity: 6 }));
  await commit(first);
  const abandoned = manager.request({ required: abandonedBand });
  const next = manager.request({ required: lastBand });
  assert.equal(await abandoned.ready, null);
  assert.deepEqual(manager.stats().pools[0].keys, [...first, ...lastBand]);
  assert.ok(jobs.length >= 9); // Replacement starts before abandoned native jobs settle.
  await complete(); await next.ready; manager.commit(next);
  assert.deepEqual(manager.stats().pools[0].keys, lastBand);
  assert.throws(() => manager.commit(abandoned), /stale/);
  manager.discard(abandoned);
  assert.equal(manager.resources.has(lastBand[1]!), true);
  manager.destroy();
});

test("Earth complete page groups retain the committed bank with only two pending decodes", async () => {
  // A complete bank is one dataset's full pages; its small levels are page levels or one shared sheet.
  const pageEntries=definitions.earth.assets.entries.filter(entry=>entry.pool==='pages'&&entry.key.startsWith('page:')&&!entry.key.includes(':level:')),groups=new Map<string, string[]>();
  for(const entry of pageEntries){const id=entry.key.split(':')[1];if(!groups.has(id))groups.set(id,[]);groups.get(id)?.push(entry.url);}
  const banks=[...groups.values()].map(surfaceUrls=>({surfaceUrls}));
  const urls = banks.flatMap(lens => lens.surfaceUrls);
  // Page arrays are the prepared lens data; fail if their schema changes.
  assert.ok(urls.length >= 6, "Use the actual prepared surface page banks");
  const width = banks[0].surfaceUrls.length;
  assert.ok(banks.every(lens => lens.surfaceUrls.length === width));
  const { manager, jobs, complete, commit } = harness(catalog(urls, { capacity: width * 2, concurrency: 2, reuse: false }));
  const bank = (offset: number) => Array.from({ length: width }, (_, i) => String(offset + i));
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
  const definition=definitions.saturn; assert.ok(definition.controls.lenses);
  const lenses=definition.controls.lenses.controls.slice(0,3);
  const assets: MutableAssets = { entries: [], pools: [], startup: [] };
  for (const field of ["surface", "rings"]) {
    assets.pools.push({ id: field, capacity: 2, concurrency: 2, retention: "selection", reuse: false });
    for (const lens of lenses) assets.entries.push({ key: `${lens.id}/${field}`, url: assetUrl(definition,`${field}:${lens.id}`), pool: field });
  }
  for (const category of ['exterior']) {
    assets.pools.push({ id: category, capacity: 2, concurrency: 2, retention: "selection", reuse: false });
    for (const lens of lenses) {
      const track=definition.materials.find(track=>track.id===category); assert.ok(track);
      const bank=track.banks.find(bank=>bank.id===lens.id);assert.ok(bank);
      assets.entries.push({ key: `${lens.id}/${category}`, url: assetUrl(definition,bank.frames[0].resource), pool: category });
    }
  }
  const keys = (lens: {id: string}) => assets.entries.filter(entry => entry.key.startsWith(lens.id + "/")).map(entry => entry.key);
  const { manager, commit, jobs, complete } = harness(assets);
  await commit(keys(lenses[0]));
  const failed = manager.request({ required: keys(lenses[1]) });
  const failJob = jobs.at(-1); assert.ok(failJob); failJob.done = true; failJob.reject(new Error("rings unavailable"));
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

test('Saturn actual interior atmosphere banks keep the published variant through rejection and retry',async()=>{
  const definition=definitions.saturn,track=definition.materials.find(track=>track.id==='interior'); assert.ok(track);
  // A shadowless bank ships one fixed frame and no rows; its resource is that frame's.
  const urls=track.banks.map(bank=>assetUrl(definition,(bank.frames[0]??bank.fixed).resource));
  assert.ok(urls.length>=3,'Use the actual retained cutaway material variants');
  const {manager,commit,jobs,complete}=harness(catalog(urls,{capacity:2,reuse:false}));
  await commit(['0']);
  const failed=manager.request({required:['1']});const job=jobs.at(-1);assert.ok(job);job.done=true;job.reject(new Error('interior material unavailable'));
  await assert.rejects(failed.ready,/decode/);await flush();assert.deepEqual(manager.stats().committed,['0']);
  const replacement=manager.request({required:['2']});await complete();await replacement.ready;manager.commit(replacement);
  assert.deepEqual(manager.stats().committed,['2']);assert.equal(manager.stats().pools[0].resident,1);manager.destroy();
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
  const timers = new Map<number, () => void>(); let clockId = 0;
  const { manager, complete, jobs } = harness(assets, {
    // Controlled timer handles are numeric; the residency owner only passes them back to unschedule.
    schedule: ((callback: () => void, delay: number) => { assert.equal(delay, 120); const id = ++clockId; timers.set(id, callback); return id; }) as unknown as typeof setTimeout,
    unschedule: ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout,
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
  const current = h.jobs.at(-1); assert.ok(current); current.reject(new Error("current")); await assert.rejects(failed.ready, /decode/);
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

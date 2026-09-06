import test from "node:test";
import assert from "node:assert/strict";
import { prepareDestinationPacks } from "../../tools/prepare-destination-packs.mjs";
import { createPreparedDestinations } from "./prepared-destinations.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";

function fixture(options = {}) {
  const prepared = prepareDestinationPacks({ rootId: "root", places: [{ id: "a", name: "A", names: ["a"], context: "Test", searchContext: "test", camera: { zoom: 8 }, resources: [], lenses: [], parentId: "root" }] }, "/scenes/example/");
  const bytes = prepared.outputs.get(prepared.reference.url);
  const lifetime = createSceneLifetime(), calls = [];
  const plan = { catalog: prepared.reference, defaultLens: "normal", statuses: { detail: "Detail", overview: "Overview" } };
  const destinations = createPreparedDestinations({ plan, lifetime, ready: Promise.resolve(),
    selectLens: async id => { calls.push(id); return true; },
    navigate: camera => { calls.push(camera); return Promise.resolve({ completed: true }); }, reset() {}, ...options });
  return { bytes, lifetime, calls, destinations, prepared };
}

test("destination catalogue verifies exact prepared bytes before selection", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async url => new Response(f.prepared.outputs.get(url)));
  assert.equal((await f.destinations.resolve("a")).entity.id, "a");
  const camera = { controlPitch: 12, controlYaw: 24, zoom: 8 };
  const selected = await f.destinations.select({ camera, coverage: "detail" });
  assert.deepEqual(f.calls, ["normal", camera]);
  assert.equal(selected.status, "Detail"); assert.equal((await selected.arrival).completed, true);
  f.lifetime.destroy();
  await assert.rejects(f.destinations.select({ camera }), /unmounted/);
  assert.equal(f.calls.length, 2);
});

test("catalogue rejects same-size corruption and lifetime aborts pending transport", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => new Response(Buffer.from(f.bytes).fill(0, 0, 1)));
  await assert.rejects(f.destinations.resolve("a"), /identity drifted/);
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  };
  const pending = f.destinations.resolve("a");
  f.lifetime.destroy();
  await assert.rejects(pending, /aborted/); assert.equal(signal.aborted, true);
});

test("a superseded selection cannot start a stale destination flight", async () => {
  const f = fixture({ selectLens: async () => false });
  await assert.rejects(f.destinations.select({ camera: {} }), /superseded/);
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

test("saved-view restoration selects the entity and base lens without replacing its camera", async () => {
  let resets = 0;
  const f = fixture({ reset: () => { resets++; } });
  const city = { id: "city", camera: { zoom: 8 }, coverage: "detail" };
  assert.equal((await f.destinations.select(city, { navigate: false })).arrival, null);
  assert.equal(f.destinations.state(), city);
  assert.equal((await f.destinations.reset({ navigate: false })).arrival, null);
  assert.equal(f.destinations.state(), null);
  assert.deepEqual(f.calls, ["normal", "normal"]); assert.equal(resets, 0);
  f.lifetime.destroy();
});


test("changing entity or returning to its scene clears the previous lens before publishing a new card", async () => {
  const changes = [], f = fixture({ onChange: entity => changes.push(entity?.id ?? null) });
  const city = { id: "city", lensIds: ["normal", "noise"], camera: {}, coverage: "detail" };
  await f.destinations.select(city);
  assert.equal(f.destinations.state(), city);
  await f.destinations.reset();
  assert.equal(f.destinations.state(), null);
  assert.deepEqual(f.calls.filter(value => typeof value === "string"), ["normal", "normal"]);
  assert.deepEqual(changes, ["city", null]);
  f.lifetime.destroy();
});

test("late entity preparation cannot publish a card or flight after a newer parent navigation", async () => {
  const pending = [], changes = [];
  const f = fixture({ selectLens: () => new Promise(resolve => pending.push(resolve)), onChange: entity => changes.push(entity) });
  const stale = f.destinations.select({id:"old",camera:{}});
  const rejection = assert.rejects(stale, /superseded/);
  await Promise.resolve();
  const latest = f.destinations.reset(); await Promise.resolve();
  pending[1](true); await latest;
  pending[0](true); await rejection;
  assert.equal(f.destinations.state(), null); assert.deepEqual(changes, [null]);
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

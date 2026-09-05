import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPreparedDestinations } from "./prepared-destinations.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";

function fixture(options = {}) {
  const bytes = JSON.stringify({ schema: "cssearth-prepared-destinations@1", places: [{ id: "a" }] });
  const lifetime = createSceneLifetime(), calls = [];
  const plan = { catalog: { url: "/scenes/example/places.json", bytes: Buffer.byteLength(bytes), count: 1,
    sha256: createHash("sha256").update(bytes).digest("hex") }, defaultLens: "normal",
    statuses: { detail: "Detail", overview: "Overview" } };
  const destinations = createPreparedDestinations({ plan, lifetime, ready: Promise.resolve(),
    selectLens: async id => { calls.push(id); return true; },
    navigate: camera => { calls.push(camera); return Promise.resolve({ completed: true }); }, reset() {}, ...options });
  return { bytes, lifetime, calls, destinations };
}

test("destination catalogue verifies exact prepared bytes before selection", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => new Response(f.bytes));
  assert.equal((await f.destinations.load()).places[0].id, "a");
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
  t.mock.method(globalThis, "fetch", async () => new Response(f.bytes.replace('"a"', '"b"')));
  await assert.rejects(f.destinations.load(), /identity drifted/);
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  };
  const pending = f.destinations.load();
  f.lifetime.destroy();
  await assert.rejects(pending, /aborted/); assert.equal(signal.aborted, true);
});

test("a superseded selection cannot start a stale destination flight", async () => {
  const f = fixture({ selectLens: async () => false });
  await assert.rejects(f.destinations.select({ camera: {} }), /superseded/);
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

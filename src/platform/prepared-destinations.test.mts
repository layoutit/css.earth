import { requireRecord, requireArray } from "../../tools/sources/source-values.mts";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { preparedObjectCapabilities } from '../renderers/css/dist/index.js';
const createPreparedDestinations = preparedObjectCapabilities.createDestinations!;
type PreparedDestinationOptions = Parameters<typeof createPreparedDestinations>[0];
type DestinationCamera = Parameters<PreparedDestinationOptions['navigate']>[0];
import { createSceneLifetime } from "@cssearth/engine";

function fixture(options: Partial<PreparedDestinationOptions> = {}, catalog: unknown = { schema: "cssearth-prepared-destinations@1", places: [{ id: "a" }] }) {
  const bytes = JSON.stringify(catalog);
  const lifetime = createSceneLifetime();
  const calls: (string | DestinationCamera)[] = [];
  const plan = { catalog: { url: "/scenes/example/places.json", bytes: Buffer.byteLength(bytes), count: 1,
    sha256: createHash("sha256").update(bytes).digest("hex") }, defaultLens: "normal",
    statuses: { detail: "Detail", overview: "Overview" } };
  const destinations = createPreparedDestinations({ plan, lifetime, ready: Promise.resolve(),
    selectLens: async id => { calls.push(id); return true; },
    navigate: camera => { calls.push(camera); return Promise.resolve({ completed: true }); }, reset: () => undefined, ...options });
  return { bytes, lifetime, calls, destinations };
}

test("destination catalogue verifies exact prepared bytes before selection", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => new Response(f.bytes));
  const loaded = requireRecord(await f.destinations.load());
  assert.equal(requireRecord(requireArray(loaded.places)[0]).id, "a");
  const camera = { controlPitch: 12, controlYaw: 24, zoom: 8 };
  const selected = requireRecord(await f.destinations.select({ camera, coverage: "detail" }));
  assert.deepEqual(f.calls, ["normal", camera]);
  assert.equal(selected.status, "Detail"); assert.equal(requireRecord(await selected.arrival).completed, true);
  f.lifetime.destroy();
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera }]), /unmounted/);
  assert.equal(f.calls.length, 2);
});

test("catalogue rejects same-size corruption and lifetime aborts pending transport", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => new Response(f.bytes.replace('"a"', '"b"')));
  await assert.rejects(f.destinations.load(), /identity drifted/);
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (_url, options) => {
    const pendingSignal = options?.signal;
    assert.ok(pendingSignal);
    signal = pendingSignal;
    return new Promise<Response>((_resolve, reject) => pendingSignal.addEventListener("abort", () => reject(new Error("aborted"))));
  };
  const pending = f.destinations.load();
  f.lifetime.destroy();
  await assert.rejects(pending, /aborted/);
  assert.ok(signal);
  assert.equal(signal.aborted, true);
});

test("a superseded selection cannot start a stale destination flight", async () => {
  const f = fixture({ selectLens: async () => false });
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera: {} }]), /superseded/);
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

test("matching catalogue pins cannot make a non-array places payload compatible", async t => {
  for (const catalog of [null, { schema: "cssearth-prepared-destinations@1", places: { length: 1 } }]) {
    const f = fixture({}, catalog);
    t.mock.method(globalThis, "fetch", async () => new Response(f.bytes));
    await assert.rejects(f.destinations.load(), /incompatible|Invalid prepared destination catalog/);
    f.lifetime.destroy();
    t.mock.restoreAll();
  }
});

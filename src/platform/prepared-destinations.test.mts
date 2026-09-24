import { requireRecord } from "@cssearth/core";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
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
    navigate: camera => { calls.push(camera); return Promise.resolve({ completed: true }); }, reset: () => Promise.resolve({ completed: true }), ...options });
  return { bytes, lifetime, calls, destinations };
}

test("a selected place declares its required lens and flies to its prepared camera; the catalogue never loads in the page", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("The page must not fetch the places catalogue."); });
  assert.equal("load" in f.destinations, false);
  const camera = { controlPitch: 12, controlYaw: 24, zoom: 8 };
  const selected = requireRecord(await f.destinations.select({ camera, coverage: "detail" }));
  assert.equal(f.destinations.lensId, "normal");
  assert.deepEqual(f.calls, [camera]);
  assert.equal(selected.status, "Detail"); assert.equal(requireRecord(await selected.arrival).completed, true);
  f.lifetime.destroy();
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera }]), /unmounted/);
  assert.equal(f.calls.length, 1);
});

test("a superseded selection cannot start a stale destination flight", async () => {
  const f = fixture(), request = new AbortController();
  request.abort();
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera: {} }, { signal: request.signal }]), { name: 'AbortError' });
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

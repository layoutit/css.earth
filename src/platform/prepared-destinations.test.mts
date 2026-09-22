import { requireRecord } from "../../tools/sources/source-values.mts";
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
    selectLens: async id => { calls.push(id); return true; },
    navigate: camera => { calls.push(camera); return Promise.resolve({ completed: true }); }, reset: () => undefined, ...options });
  return { bytes, lifetime, calls, destinations };
}

test("a selected place flies to its prepared camera in the default lens; the catalogue never loads in the page", async t => {
  const f = fixture();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("The page must not fetch the places catalogue."); });
  assert.equal("load" in f.destinations, false);
  const camera = { controlPitch: 12, controlYaw: 24, zoom: 8 };
  const selected = requireRecord(await f.destinations.select({ camera, coverage: "detail" }));
  assert.deepEqual(f.calls, ["normal", camera]);
  assert.equal(selected.status, "Detail"); assert.equal(requireRecord(await selected.arrival).completed, true);
  f.lifetime.destroy();
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera }]), /unmounted/);
  assert.equal(f.calls.length, 2);
});

test("a superseded selection cannot start a stale destination flight", async () => {
  const f = fixture({ selectLens: async () => false });
  await assert.rejects(Reflect.apply(f.destinations.select, undefined, [{ camera: {} }]), /superseded/);
  assert.deepEqual(f.calls, []); f.lifetime.destroy();
});

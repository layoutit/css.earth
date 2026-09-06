import test from "node:test";
import assert from "node:assert/strict";
import { prepareDestinationPacks } from "../../tools/prepare-destination-packs.mjs";
import { createDestinationStore } from "./prepared-destination-store.mjs";
import { DESTINATION_LIMITS, validateDestinationDirectory, validateDestinationSearch } from "./prepared-destination-contract.mjs";

function fixture(count = 260, mutate = () => {}) {
  const places = Array.from({ length: count }, (_, i) => ({ id: String(i).padStart(5, "0"), name: `Place ${i}`, names: [`place ${i}`],
    context: "Context", searchContext: "context", camera: { zoom: 8 }, resources: [], lenses: [], parentId: "root" }));
  mutate(places);
  return prepareDestinationPacks({ rootId: "root", places }, "/scenes/test/");
}

test("direct entity lookup needs only its directory and shard, never the search payload", async () => {
  const prepared = fixture(), calls = [];
  const store = createDestinationStore({ catalog: prepared.reference, fetcher: async url => { calls.push(url); return new Response(prepared.outputs.get(url)); } });
  assert.equal((await store.resolve("00140")).entity.name, "Place 140");
  assert.equal(calls.length, 2); assert.ok(!calls.includes(prepared.directory.search.url));
  await store.resolve("00141"); assert.equal(calls.length, 2);
  store.dispose(); await assert.rejects(store.resolve("00141"), /disposed/);
  assert.equal(store.stats().detailDecodedBytes, 0);
});

test("one canceled reader does not abort a shared directory; the last canceled reader does", async () => {
  const prepared = fixture(); let release, requestSignal;
  const store = createDestinationStore({ catalog: prepared.reference, fetcher: async (url, { signal }) => {
    if (url === prepared.reference.url) {
      requestSignal = signal;
      await new Promise((resolve, reject) => { release = resolve; signal.addEventListener("abort", () => reject(signal.reason)); });
    }
    return new Response(prepared.outputs.get(url));
  } });
  const first = new AbortController(), second = new AbortController();
  const a = store.resolve("00140", first.signal), b = store.resolve("00141", second.signal);
  const rejected = assert.rejects(a, { name: "AbortError" });
  first.abort(); await rejected; assert.equal(requestSignal.aborted, false);
  release(); assert.equal((await b).entity.id, "00141"); store.dispose();

  const next = createDestinationStore({ catalog: prepared.reference, fetcher: async (_url, { signal }) => {
    requestSignal = signal; return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  } });
  const cancel = new AbortController(), pending = next.resolve("00140", cancel.signal);
  const canceled = assert.rejects(pending, { name: "AbortError" });
  cancel.abort(); await canceled; assert.equal(requestSignal.aborted, true); next.dispose();
});

test("a failed or corrupt pack can retry without retaining unverified details", async () => {
  const prepared = fixture(); let fail = true;
  const store = createDestinationStore({ catalog: prepared.reference, fetcher: async url => {
    const bytes = Buffer.from(prepared.outputs.get(url));
    if (fail && url !== prepared.reference.url) bytes[0] ^= 1;
    return new Response(bytes);
  } });
  await assert.rejects(store.resolve("00140"), /identity drifted/);
  assert.equal(store.stats().detailPacks, 0); fail = false;
  assert.equal((await store.resolve("00140")).entity.id, "00140"); store.dispose();
});

test("prepared address cycles and missing parents reject without an unbounded traversal", async () => {
  for (const parent of ["00000", "missing"]) {
    const prepared = fixture(1, places => { places[0].parentId = parent; });
    const store = createDestinationStore({ catalog: prepared.reference, fetcher: async url => new Response(prepared.outputs.get(url)) });
    await assert.rejects(store.resolve("00000"), /parent/); store.dispose();
  }
});

test("index admission rejects oversized metadata, malformed postings and duplicate addresses", () => {
  const { directory, search } = fixture();
  const bad = structuredClone(directory); bad.search.decodedBytes = DESTINATION_LIMITS.searchBytes + 1;
  assert.throws(() => validateDestinationDirectory(bad, 260), /capacity/);
  const duplicate = structuredClone(directory); duplicate.entries[1][0] = duplicate.entries[0][0];
  assert.throws(() => validateDestinationDirectory(duplicate, 260), /addressing/);
  const wrong = structuredClone(search); wrong.aliases[0][1] = [260];
  assert.throws(() => validateDestinationSearch(wrong, 260), /postings/);
});

test("fifty distinct shard visits plateau at the fixed cache capacity", async () => {
  const prepared = fixture(50 * DESTINATION_LIMITS.recordsPerPack);
  const store = createDestinationStore({ catalog: prepared.reference, fetcher: async url => new Response(prepared.outputs.get(url)) });
  for (let i = 0; i < 50; i++) await store.resolve(String(i * DESTINATION_LIMITS.recordsPerPack).padStart(5, "0"));
  assert.equal(store.stats().detailPacks, 16); assert.equal(store.stats().evictions, 34);
  assert.ok(store.stats().peakDetailBytes <= DESTINATION_LIMITS.detailCacheBytes);
  assert.equal(store.stats().activeLoads, 0); store.dispose();
});

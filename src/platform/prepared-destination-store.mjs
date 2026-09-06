import { readPreparedJson } from "./prepared-json-transport.mjs";
import { DESTINATION_LIMITS as limits, validateDestinationDirectory, validateDestinationReference, validateDestinationSearch } from "./prepared-destination-contract.mjs";
import { lowerBound, searchDestinationIndex } from "./prepared-destination-index.mjs";

// One store per mounted object. The cache counts verified decoded payload bytes;
// JS heap overhead is measured separately in the browser lifetime journey.
export function createDestinationStore({ catalog, signal, fetcher = (...args) => fetch(...args) }) {
  validateDestinationReference(catalog, limits.directoryBytes);
  let directory = null, searchIndex = null, disposed = false, cacheBytes = 0;
  const cache = new Map(), pending = new Map();
  const counters = { requests: 0, cacheHits: 0, evictions: 0, peakDetailBytes: 0, peakDetailPacks: 0, peakLoads: 0 };
  const assertLive = caller => {
    if (disposed) throw new Error("Destination store was disposed.");
    signal?.throwIfAborted(); caller?.throwIfAborted();
  };
  function dispose() {
    disposed = true;
    for (const entry of pending.values()) entry.controller.abort();
    cache.clear(); cacheBytes = 0; directory = searchIndex = null;
  }
  signal?.addEventListener("abort", dispose, { once: true });
  function retain(ref, value) {
    if (cache.has(ref.url)) return;
    while (cache.size >= limits.detailCachePacks || cacheBytes + ref.decodedBytes > limits.detailCacheBytes) {
      const key = cache.keys().next().value;
      cacheBytes -= cache.get(key).bytes; cache.delete(key); counters.evictions++;
    }
    cache.set(ref.url, { value, bytes: ref.decodedBytes }); cacheBytes += ref.decodedBytes;
    counters.peakDetailBytes = Math.max(counters.peakDetailBytes, cacheBytes);
    counters.peakDetailPacks = Math.max(counters.peakDetailPacks, cache.size);
  }
  async function read(ref, caller, validate, details = false) {
    assertLive(caller);
    if (details && cache.has(ref.url)) {
      const item = cache.get(ref.url); cache.delete(ref.url); cache.set(ref.url, item); counters.cacheHits++;
      return item.value;
    }
    let entry = pending.get(ref.url);
    if (entry?.controller.signal.aborted) { pending.delete(ref.url); entry = null; }
    if (!entry) {
      if (pending.size >= 3) throw new Error("Destination request capacity is occupied.");
      entry = { controller: new AbortController(), users: 0 };
      pending.set(ref.url, entry); counters.requests++;
      counters.peakLoads = Math.max(counters.peakLoads, pending.size);
      const owned = entry;
      owned.promise = (async () => {
        const response = await fetcher(ref.url, { signal: owned.controller.signal });
        if (!response.ok) throw new Error("Destination pack request failed.");
        const value = validate(await readPreparedJson(response, ref));
        assertLive(); owned.controller.signal.throwIfAborted();
        if (details) retain(ref, value);
        return value;
      })().finally(() => { if (pending.get(ref.url) === owned) pending.delete(ref.url); });
    }
    entry.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (fn, value) => {
        if (finished) return; finished = true;
        caller?.removeEventListener("abort", abort); entry.users--;
        if (!entry.users && pending.get(ref.url) === entry) entry.controller.abort();
        fn(value);
      };
      const abort = () => finish(reject, caller.reason ?? new DOMException("Aborted", "AbortError"));
      caller?.addEventListener("abort", abort, { once: true });
      entry.promise.then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
  async function loadDirectory(caller) {
    assertLive(caller);
    directory ??= await read(catalog, caller, value => validateDestinationDirectory(value, catalog.count));
    return directory;
  }
  function validateDetails(value) {
    if (value?.schema !== "cssearth-destination-details@1" || !Array.isArray(value.records) ||
        !value.records.length || value.records.length > limits.recordsPerPack) throw new Error("Destination detail pack is incompatible.");
    for (const record of value.records) {
      if (typeof record.id !== "string" || typeof record.name !== "string" || !record.camera ||
          !Object.values(record.camera).every(Number.isFinite)) throw new Error("Invalid prepared destination record.");
      for (const [key, dictionary] of [["resourceRefs", directory.resources], ["lensRefs", directory.lenses]]) {
        if (!Array.isArray(record[key]) || record[key].some(id => !Number.isInteger(id) || id < 0 || id >= dictionary.length)) throw new Error("Invalid destination dictionary reference.");
      }
    }
    return value;
  }
  async function record(id, caller) {
    const dir = await loadDirectory(caller), row = dir.entries[lowerBound(dir.entries, id)];
    if (!row || row[0] !== id) return null;
    const pack = await read(dir.packs[row[1]], caller, validateDetails, true);
    const value = pack.records.find(entity => entity.id === id);
    if (!value) throw new Error("Destination detail address is missing.");
    const { resourceRefs, lensRefs, ...entity } = value;
    return { ...entity, resources: resourceRefs.map(i => dir.resources[i]), lenses: lensRefs.map(i => dir.lenses[i]) };
  }
  return Object.freeze({
    async resolve(id, caller) {
      const entity = await record(id, caller);
      if (!entity) return null;
      const ancestors = [], seen = new Set([id]);
      let parentId = entity.parentId;
      while (parentId && parentId !== directory.rootId) {
        if (seen.has(parentId) || ancestors.length >= limits.parentDepth) throw new Error("Destination parent chain is invalid.");
        seen.add(parentId);
        const parent = await record(parentId, caller);
        if (!parent) throw new Error("Destination parent is missing.");
        ancestors.push(parent); parentId = parent.parentId;
      }
      return { entity, ancestors };
    },
    async search(query, limit = 8, caller) {
      const dir = await loadDirectory(caller);
      searchIndex ??= await read(dir.search, caller, value => validateDestinationSearch(value, catalog.count));
      assertLive(caller);
      return searchDestinationIndex(searchIndex, query, limit);
    },
    stats: () => ({ ...counters, activeLoads: pending.size, detailPacks: cache.size, detailDecodedBytes: cacheBytes,
      directoryDecodedBytes: directory ? catalog.decodedBytes : 0, searchDecodedBytes: searchIndex ? directory.search.decodedBytes : 0,
      disposed, limits }),
    dispose() { signal?.removeEventListener("abort", dispose); dispose(); },
  });
}

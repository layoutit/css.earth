import type { DestinationCatalog, DestinationReference, DestinationDirectory, DestinationSearch, DestinationDetails, DestinationEntity } from './destination-types.js';
interface PendingRead { controller: AbortController; users: number; promise: Promise<unknown> }
import { readPreparedJson } from "./prepared-json-transport.js";
import { DESTINATION_LIMITS as limits, validateDestinationDirectory, validateDestinationReference, validateDestinationSearch } from "./prepared-destination-contract.js";
import { lowerBound, searchDestinationIndex } from "./prepared-destination-index.js";

// One store per mounted object. The cache counts verified decoded payload bytes;
// JS heap overhead is measured separately in the browser lifetime journey.
export function createDestinationStore({ catalog, signal, fetcher = (input, init) => fetch(input, init) }: { catalog: DestinationCatalog; signal?: AbortSignal; fetcher?: typeof fetch }) {
  validateDestinationReference(catalog, limits.directoryBytes);
  let directory: DestinationDirectory | null = null, searchIndex: DestinationSearch | null = null;
  let searchPreparation: Promise<DestinationSearch> | null = null;
  let disposed = false, cacheBytes = 0;
  const cache = new Map<string, { value: unknown; bytes: number }>(), pending = new Map<string, PendingRead>();
  const counters = { requests: 0, cacheHits: 0, evictions: 0, peakDetailBytes: 0, peakDetailPacks: 0, peakLoads: 0 };
  const assertLive = (caller?: AbortSignal) => {
    if (disposed) throw new Error("Destination store was disposed.");
    signal?.throwIfAborted(); caller?.throwIfAborted();
  };
  function dispose() {
    disposed = true;
    for (const entry of pending.values()) entry.controller.abort();
    cache.clear(); cacheBytes = 0; directory = searchIndex = null; searchPreparation = null;
  }
  signal?.addEventListener("abort", dispose, { once: true });
  function retain(ref: DestinationReference, value: unknown) {
    if (cache.has(ref.url)) return;
    while (cache.size >= limits.detailCachePacks || cacheBytes + ref.decodedBytes > limits.detailCacheBytes) {
      const key = cache.keys().next().value;
      if (key === undefined) throw new Error("Destination cache admission exceeded capacity.");
      cacheBytes -= cache.get(key)!.bytes; cache.delete(key); counters.evictions++;
    }
    cache.set(ref.url, { value, bytes: ref.decodedBytes }); cacheBytes += ref.decodedBytes;
    counters.peakDetailBytes = Math.max(counters.peakDetailBytes, cacheBytes);
    counters.peakDetailPacks = Math.max(counters.peakDetailPacks, cache.size);
  }
  async function read<T>(ref: DestinationReference, caller: AbortSignal | undefined, validate: (input: unknown) => T, details = false): Promise<T> {
    assertLive(caller);
    if (details && cache.has(ref.url)) {
      const item = cache.get(ref.url)!; cache.delete(ref.url); cache.set(ref.url, item); counters.cacheHits++;
      return item.value as T;
    }
    let entry = pending.get(ref.url);
    if (entry?.controller.signal.aborted) { pending.delete(ref.url); entry = undefined; }
    if (!entry) {
      if (pending.size >= 3) throw new Error("Destination request capacity is occupied.");
      entry = { controller: new AbortController(), users: 0, promise: Promise.resolve(undefined) };
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
    const acquired = entry;
    acquired.users++;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = (fn: (value: unknown) => void, value: unknown) => {
        if (finished) return; finished = true;
        caller?.removeEventListener("abort", abort); acquired.users--;
        if (!acquired.users && pending.get(ref.url) === acquired) { pending.delete(ref.url); acquired.controller.abort(); }
        fn(value);
      };
      const abort = () => finish(reject, caller?.reason ?? new DOMException("Aborted", "AbortError"));
      caller?.addEventListener("abort", abort, { once: true });
      acquired.promise.then(value => finish(value => resolve(value as T), value), error => finish(reject, error));
    });
  }
  async function loadDirectory(caller?: AbortSignal) {
    assertLive(caller);
    directory ??= await read(catalog, caller, value => validateDestinationDirectory(value, catalog.count));
    return directory;
  }
  function prepareSearch() {
    // Every query uses the same bounded index. Its acquisition belongs to the
    // mounted store, so typing cannot repeatedly discard a partial download.
    // Individual queries still stop immediately; disposal aborts the transfer.
    if (!searchPreparation) {
      const preparation = (async () => {
        const dir = await loadDirectory();
        const index = await read(dir.search, undefined, value => validateDestinationSearch(value, catalog.count));
        assertLive();
        return searchIndex = index;
      })();
      searchPreparation = preparation;
      void preparation.catch(() => { if (searchPreparation === preparation) searchPreparation = null; });
    }
    return searchPreparation;
  }
  function waitForSearch(preparation: Promise<DestinationSearch>, caller?: AbortSignal) {
    if (!caller) return preparation;
    return new Promise<DestinationSearch>((resolve, reject) => {
      const abort = () => { caller.removeEventListener("abort", abort); reject(caller.reason); };
      caller.addEventListener("abort", abort, { once: true });
      if (caller.aborted) abort();
      preparation.then(value => {
        caller.removeEventListener("abort", abort); resolve(value);
      }, error => { caller.removeEventListener("abort", abort); reject(error); });
    });
  }
  function validateDetails(input: unknown): DestinationDetails {
    const value = input as DestinationDetails;
    if (value?.schema !== "cssearth-destination-details@1" || !Array.isArray(value.records) ||
        !value.records.length || value.records.length > limits.recordsPerPack) throw new Error("Destination detail pack is incompatible.");
    for (const record of value.records) {
      if (typeof record.id !== "string" || typeof record.name !== "string" || !record.camera ||
          !Object.values(record.camera).every(Number.isFinite)) throw new Error("Invalid prepared destination record.");
      for (const [key, dictionary] of [["resourceRefs", directory!.resources], ["lensRefs", directory!.lenses]] as const) {
        if (!Array.isArray(record[key]) || record[key].some(id => !Number.isInteger(id) || id < 0 || id >= dictionary.length)) throw new Error("Invalid destination dictionary reference.");
      }
    }
    return value;
  }
  async function record(id: string, caller?: AbortSignal): Promise<DestinationEntity | null> {
    const dir = await loadDirectory(caller), row = dir.entries[lowerBound(dir.entries, id)];
    if (!row || row[0] !== id) return null;
    const pack = await read(dir.packs[row[1]], caller, validateDetails, true);
    const value = pack.records.find(entity => entity.id === id);
    if (!value) throw new Error("Destination detail address is missing.");
    const { resourceRefs, lensRefs, ...entity } = value;
    return { ...entity, resources: resourceRefs.map(i => dir.resources[i]), lenses: lensRefs.map(i => dir.lenses[i]) };
  }
  return Object.freeze({
    async resolve(id: string, caller?: AbortSignal) {
      const entity = await record(id, caller);
      if (!entity) return null;
      const ancestors: DestinationEntity[] = [], seen = new Set([id]);
      let parentId = entity.parentId;
      while (parentId && parentId !== directory!.rootId) {
        if (seen.has(parentId) || ancestors.length >= limits.parentDepth) throw new Error("Destination parent chain is invalid.");
        seen.add(parentId);
        const parent = await record(parentId, caller);
        if (!parent) throw new Error("Destination parent is missing.");
        ancestors.push(parent); parentId = parent.parentId;
      }
      return { entity, ancestors };
    },
    async search(query: string, limit = 8, caller?: AbortSignal) {
      assertLive(caller);
      const index = await waitForSearch(prepareSearch(), caller);
      assertLive(caller);
      return searchDestinationIndex(index, query, limit);
    },
    stats: () => ({ ...counters, activeLoads: pending.size, detailPacks: cache.size, detailDecodedBytes: cacheBytes,
      directoryDecodedBytes: directory ? catalog.decodedBytes : 0, searchDecodedBytes: searchIndex ? directory!.search.decodedBytes : 0,
      disposed, limits }),
    dispose() { signal?.removeEventListener("abort", dispose); dispose(); },
  });
}

import type { PreparedImage, PreparedImageLease, PreparedImagePool } from "./prepared-image-store.js";
import type { PreparedAssetOrigin } from "./prepared-asset-origin.js";
export interface PreparedResourceEntry { key: string; url: string; pool: string; decodedBytes?: number; }
export interface PreparedResourcePool extends PreparedImagePool { id: string; retention: "mount" | "warm" | "selection"; stabilityMilliseconds?: number; eviction?: "capacity" | "unused"; maximumDecodedBytes?: number; }
export interface PreparedAssets { entries: readonly PreparedResourceEntry[]; pools: readonly PreparedResourcePool[]; startup: readonly string[]; }
export interface PreparedResourceDemand { required: readonly string[]; prewarm?: readonly string[]; }
export interface PreparedResources { has(key: string): boolean; read(key: string): PreparedImage | null; url(key: string): string | null; readyKeys(): readonly string[]; }
export interface PreparedResidencyTicket { readonly required: readonly string[]; readonly ready: Promise<PreparedResidencyTicket | null>; }
export interface PreparedResidencyOptions {
  assets: PreparedAssets; createImage?: () => PreparedImage; onReady?: (key: string) => void; onWarmError?: (error: unknown) => void; onCleanupError?: (error: unknown) => void;
  schedule?: typeof setTimeout; unschedule?: typeof clearTimeout; assetOrigin?: PreparedAssetOrigin;
}
interface CacheEntry { key: string; lease: PreparedImageLease; ready: boolean; retired: boolean; timer: ReturnType<typeof setTimeout> | null; order: number;
  promise: Promise<PreparedImage | null>; resolve(value: PreparedImage | null): void; reject(reason: unknown): void; }
interface TicketState { required: Set<string>; prewarm: string[]; ready: boolean; retired: boolean; resolve(value: PreparedResidencyTicket | null): void; }

import { createPreparedImageStore } from "./prepared-image-store.js";
import { resolvePreparedAssetUrl } from "./prepared-asset-origin.js";

// Demands are prepared keys in priority order. This owner knows capacities and
// leases, not planets, texture rows, lens semantics, or presentation elements.
export function createPreparedResidency({
  assets, createImage, onReady = () => {}, onWarmError = () => {}, onCleanupError = onWarmError,
  schedule = setTimeout, unschedule = clearTimeout, assetOrigin,
}: PreparedResidencyOptions) {
  // The single chokepoint every image load and material `url()` reads through
  // (`resources.read`/`resources.url` below): entries keep their prepared `/scenes/`
  // address unless the build published this object's assets to `assetOrigin`.
  const catalog = new Map(assets.entries.map(entry => [entry.key,
    assetOrigin ? { ...entry, url: resolvePreparedAssetUrl(entry.url, assetOrigin) } : entry]));
  const policies = new Map(assets.pools.map(pool => [pool.id, pool]));
  const images = createPreparedImageStore({ pools: assets.pools, ...(createImage ? { createImage } : {}) });
  const cache = new Map<string, CacheEntry>(), mount = new Set<string>(), warmed = new Set<string>(), tickets = new WeakMap<PreparedResidencyTicket, TicketState>();
  let committed = new Set<string>(), used = new Set<string>(), startup = new Set<string>(), warm: string[] = [];
  let pending: TicketState | null = null, destroyed = false, frameReads: Set<string> | null = null, sequence = 0, decodes = 0;

  function assetFor(key: string): PreparedResourceEntry {
    const entry = catalog.get(key);
    if (!entry) throw new RangeError(`Undeclared prepared resource: ${key}.`);
    return entry;
  }
  function policyFor(id: string): PreparedResourcePool {
    const pool = policies.get(id);
    if (!pool) throw new RangeError(`Unknown prepared resource pool: ${id}.`);
    return pool;
  }
  function requireKeys(values: readonly string[]) {
    if (!Array.isArray(values) || new Set(values).size !== values.length || values.some(key => !catalog.has(key))) {
      throw new TypeError("Residency demand requires unique declared resource keys.");
    }
    return new Set(values);
  }
  function protectedKeys(required: Iterable<string> = pending?.required ?? []) {
    return new Set([...mount, ...committed, ...used, ...startup, ...required]);
  }
  function urls(keys: Iterable<string>, poolId: string) {
    return new Set([...keys].filter(key => !warmed.has(key) && assetFor(key).pool === poolId).map(key => assetFor(key).url));
  }
  function requireCapacity(keys: Iterable<string>) {
    for (const pool of policies.values()) if (!fits(keys, pool)) {
      throw new RangeError(`Protected prepared resources exceed ${pool.id} capacity ${pool.capacity}.`);
    }
  }
  function decodedBytes(keys: Iterable<string>, poolId: string) {
    const sizes = new Map<string, number>();
    for (const key of keys) {
      const asset = assetFor(key);
      if (asset.pool === poolId && !warmed.has(key)) sizes.set(asset.url, asset.decodedBytes ?? 0);
    }
    return [...sizes.values()].reduce((sum, size) => sum + size, 0);
  }
  function fits(keys: Iterable<string>, pool: PreparedResourcePool) {
    const list = [...keys];
    return urls(list, pool.id).size <= pool.capacity &&
      (pool.maximumDecodedBytes === undefined || decodedBytes(list, pool.id) <= pool.maximumDecodedBytes);
  }
  function release(key: string, handoff = false) {
    const entry = cache.get(key);
    if (!entry) return;
    cache.delete(key);
    entry.retired = true;
    if (entry.timer !== null) unschedule(entry.timer);
    entry.resolve(null);
    if (handoff) entry.lease.handoff(assetFor(key).url);
    entry.lease.destroy();
  }
  function releaseWarmed(keys: Iterable<string>) {
    const errors = [];
    for (const key of keys) if (policyFor(assetFor(key).pool).retention === "warm" && ready(key)) {
      warmed.add(key);
      try { release(key, true); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Prepared warm resource release failed.");
  }
  function start(key: string, stabilize: boolean) {
    if (cache.has(key) || warmed.has(key)) return;
    const asset = assetFor(key), policy = policyFor(asset.pool);
    let resolveEntry!: CacheEntry["resolve"], rejectEntry!: CacheEntry["reject"];
    const promise = new Promise<PreparedImage | null>((resolve, reject) => { resolveEntry = resolve; rejectEntry = reject; });
    const entry: CacheEntry = { key, lease: images.createLease("residency"), ready: false, retired: false,
      timer: null, order: sequence++, promise, resolve: resolveEntry, reject: rejectEntry };
    entry.promise.catch(() => {});
    cache.set(key, entry);
    const load = () => {
      entry.timer = null;
      if (entry.retired || destroyed) return;
      entry.lease.load(asset.url, { pool: asset.pool }).then(image => {
        if (entry.retired || destroyed) return;
        if (!image) throw new Error(`Prepared resource retired before readiness: ${key}.`);
        if (asset.decodedBytes !== undefined && image.naturalWidth * image.naturalHeight * 4 !== asset.decodedBytes)
          throw new Error(`Prepared image dimensions differ from the byte budget: ${key}.`);
        entry.ready = true;
        decodes++;
        if (policy.retention === "mount") mount.add(key);
        entry.resolve(image);
        onReady(key);
      }).catch(error => {
        if (entry.retired || destroyed) return;
        // Reject before retiring: cancellation resolves null, a real decode
        // failure must reach the current selection's recoverable error path.
        entry.reject(error);
        try { release(key); } catch (cleanupError) { onCleanupError(cleanupError); }
        if (!pending?.required.has(key) && !startup.has(key)) onWarmError(error);
      });
    };
    const delay = stabilize ? policy.stabilityMilliseconds ?? 0 : 0;
    if (delay) entry.timer = schedule(load, delay); else load();
  }
  function reconcile({ stabilize = false }: { stabilize?: boolean } = {}) {
    if (destroyed) return;
    return images.batch(() => reconcileDemand(stabilize));
  }
  function reconcileDemand(stabilize: boolean) {
    const protectedSet = protectedKeys();
    requireCapacity(protectedSet);
    const desired = new Set([...protectedSet, ...warm]);
    const errors = [];
    for (const [key, entry] of cache) {
      // Cache completed datasets, not abandoned native decode jobs. A newer
      // selection must be able to use the freed concurrency immediately.
      if (!desired.has(key) && (!entry.ready || policyFor(assetFor(key).pool).eviction !== "capacity")) {
        try { release(key); } catch (error) { errors.push(error); }
      }
    }
    for (const key of desired) {
      if (cache.has(key) || warmed.has(key)) continue;
      const asset = assetFor(key), policy = policyFor(asset.pool);
      const admits = () => fits([...cache.keys(), key], policy);
      if (!admits()) {
        // Retain the published and requested materials. Optional prewarm is
        // lower priority than required demand, including pending native work.
        const victims = [...cache.values()].filter(entry => assetFor(entry.key).pool === asset.pool &&
          !protectedSet.has(entry.key) && (!warm.includes(entry.key) || protectedSet.has(key)))
          .sort((a, b) => a.order - b.order);
        for (const victim of victims) {
          try { release(victim.key); } catch (error) { errors.push(error); }
          if (admits()) break;
        }
      }
      if (admits()) start(key, stabilize);
      else if (protectedSet.has(key)) throw new Error(`Prepared resource capacity could not admit ${key}.`);
    }
    if (errors.length) throw new AggregateError(errors, "Prepared residency release failed.");
  }
  const ready = (key: string) => warmed.has(key) || cache.get(key)?.ready === true;
  const awaitKeys = (keys: Iterable<string>) => Promise.all([...keys].map(key => warmed.has(key)
    ? Promise.resolve(true) : cache.get(key)?.promise ?? Promise.reject(new Error(`Unacquired resource: ${key}.`))));
  function retirePending() {
    if (!pending) return;
    const previous = pending;
    pending = null;
    previous.retired = true;
    previous.resolve(null);
  }

  const resources: PreparedResources = Object.freeze({
    has: ready,
    read(key: string) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return images.read(assetFor(key).url);
    },
    url(key: string) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return assetFor(key).url;
    },
    readyKeys: () => Object.freeze([...new Set([...warmed, ...cache.keys()])].filter(ready)),
  });

  return Object.freeze({
    resources,
    async prepareStartup() {
      if (destroyed) return null;
      startup = requireKeys(assets.startup);
      requireCapacity(protectedKeys());
      reconcile();
      const result = await awaitKeys(startup);
      return destroyed || result.some(value => value === null) ? null : true;
    },
    finishStartup() {
      warm = [...startup].filter(key => policyFor(assetFor(key).pool).retention !== "warm");
      try { releaseWarmed(startup); } finally { startup.clear(); }
    },
    request(plan: PreparedResourceDemand, { stabilize = false }: { stabilize?: boolean } = {}) {
      if (destroyed) throw new Error("Prepared residency is destroyed.");
      const required = requireKeys(plan.required), prewarm = [...requireKeys(plan.prewarm ?? [])];
      requireCapacity(protectedKeys(required));
      retirePending();
      let resolveState!: TicketState["resolve"];
      const promise = new Promise<PreparedResidencyTicket | null>(resolve => { resolveState = resolve; });
      const state: TicketState = { required, prewarm, ready: false, retired: false, resolve: resolveState };
      // The ticket promise preserves decode errors while cancellation is prompt.
      let rejectTicket!: (reason: unknown) => void;
      const failure = new Promise<never>((_, reject) => { rejectTicket = reject; });
      const ticket = Object.freeze({ required: Object.freeze([...required]), ready: Promise.race([promise, failure]) });
      ticket.ready.catch(() => {});
      tickets.set(ticket, state);
      pending = state;
      // Required demand loads first: this request's optional prewarm starts once its required keys are resident, so on
      // a slow connection warm-up never shares the bandwidth readiness waits for. The previous warm set stays meanwhile.
      try { reconcile({ stabilize }); }
      catch (error) { retirePending(); rejectTicket(error); throw error; }
      awaitKeys(required).then(values => {
        if (state.retired || pending !== state || destroyed) return;
        if (values.some(value => value === null)) throw new Error("Current prepared demand was retired.");
        state.ready = true;
        state.resolve(ticket);
        warm = state.prewarm;
        try { reconcile(); } catch (error) { onCleanupError(error); }
      }).catch(error => {
        if (state.retired || pending !== state || destroyed) return;
        state.retired = true;
        pending = null;
        rejectTicket(error);
        try { reconcile(); } catch (cleanupError) { onCleanupError(cleanupError); }
      });
      return ticket;
    },
    commit(ticket: PreparedResidencyTicket) {
      const state = tickets.get(ticket);
      if (destroyed || pending !== state || !state?.ready || state.retired) {
        throw new Error("Prepared residency commit is stale or unprepared.");
      }
      committed = new Set(state.required);
      pending = null;
      warm = state.prewarm;
      releaseWarmed(committed);
      reconcile();
    },
    discard(ticket: PreparedResidencyTicket) {
      if (pending !== tickets.get(ticket)) return;
      retirePending();
      warm = [];
      reconcile();
    },
    beginFrame() {
      if (frameReads) throw new Error("Prepared resource frame reads are already open.");
      frameReads = new Set();
    },
    endFrame() {
      if (!frameReads) throw new Error("Prepared resource frame reads are not open.");
      used = frameReads;
      frameReads = null;
    },
    stats() {
      return Object.freeze({ decodes, committed: Object.freeze([...committed]),
        pending: Object.freeze([...(pending?.required ?? [])]), used: Object.freeze([...used]),
        warmed: Object.freeze([...warmed]),
        pools: Object.freeze([...policies.values()].map(policy => Object.freeze({
          ...policy, keys: Object.freeze([...cache.keys()].filter(key => assetFor(key).pool === policy.id)),
          resident: urls(cache.keys(), policy.id).size,
          ...(policy.maximumDecodedBytes === undefined ? {} : { decodedBytes: decodedBytes(cache.keys(), policy.id) }),
          ready: urls([...cache.keys()].filter(ready), policy.id).size,
          pending: urls([...cache.keys()].filter(key => !ready(key)), policy.id).size,
          nativeSlots: images.ownershipStats().pools.find(pool => pool.id === policy.id)?.slots ?? 0,
        }))), images: images.ownershipStats() });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      retirePending();
      const errors = [];
      images.batch(() => {
        for (const key of cache.keys()) {
          try { release(key); } catch (error) { errors.push(error); }
        }
      });
      try { images.destroy(); } catch (error) { errors.push(error); }
      startup.clear(); committed.clear(); used.clear(); mount.clear(); warmed.clear();
      if (errors.length) throw new AggregateError(errors, "Prepared residency cleanup failed.");
    },
  });
}

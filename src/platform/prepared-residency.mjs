import { createPreparedImageStore } from "./prepared-image-store.mjs";
import { requirePreparedResourceCatalog } from "./object-runtime-contract.mjs";

// Demands are prepared keys in priority order. This owner knows capacities and
// leases, not planets, texture rows, lens semantics, or presentation elements.
export function createPreparedResidency({
  assets, createImage, onReady = () => {}, onWarmError = () => {}, onCleanupError = onWarmError,
  schedule = setTimeout, unschedule = clearTimeout,
} = {}) {
  requirePreparedResourceCatalog(assets);
  const catalog = new Map(assets.entries.map(entry => [entry.key, entry]));
  const policies = new Map(assets.pools.map(pool => [pool.id, pool]));
  const images = createPreparedImageStore({ pools: assets.pools, ...(createImage ? { createImage } : {}) });
  const cache = new Map(), mount = new Set(), warmed = new Set(), tickets = new WeakMap();
  let committed = new Set(), used = new Set(), startup = new Set(), warm = [];
  let pending = null, destroyed = false, frameReads = null, sequence = 0, decodes = 0;

  function requireKeys(values) {
    if (!Array.isArray(values) || new Set(values).size !== values.length || values.some(key => !catalog.has(key))) {
      throw new TypeError("Residency demand requires unique declared resource keys.");
    }
    return new Set(values);
  }
  function protectedKeys(required = pending?.required ?? []) {
    return new Set([...mount, ...committed, ...used, ...startup, ...required]);
  }
  function urls(keys, poolId) {
    return new Set([...keys].filter(key => !warmed.has(key) && catalog.get(key).pool === poolId).map(key => catalog.get(key).url));
  }
  function requireCapacity(keys) {
    for (const pool of policies.values()) if (urls(keys, pool.id).size > pool.capacity) {
      throw new RangeError(`Protected prepared resources exceed ${pool.id} capacity ${pool.capacity}.`);
    }
  }
  function release(key, handoff = false) {
    const entry = cache.get(key);
    if (!entry) return;
    cache.delete(key);
    entry.retired = true;
    if (entry.timer !== null) unschedule(entry.timer);
    entry.resolve(null);
    if (handoff) entry.lease.handoff(catalog.get(key).url);
    entry.lease.destroy();
  }
  function releaseWarmed(keys) {
    const errors = [];
    for (const key of keys) if (policies.get(catalog.get(key).pool).retention === "warm" && ready(key)) {
      warmed.add(key);
      try { release(key, true); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Prepared warm resource release failed.");
  }
  function start(key, stabilize) {
    if (cache.has(key) || warmed.has(key)) return;
    const asset = catalog.get(key), policy = policies.get(asset.pool);
    const entry = { key, lease: images.createLease("residency"), ready: false, retired: false,
      timer: null, order: sequence++, promise: null };
    entry.promise = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
    entry.promise.catch(() => {});
    cache.set(key, entry);
    const load = () => {
      entry.timer = null;
      if (entry.retired || destroyed) return;
      entry.lease.load(asset.url, { pool: asset.pool }).then(image => {
        if (entry.retired || destroyed) return;
        if (!image) throw new Error(`Prepared resource retired before readiness: ${key}.`);
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
  function reconcile({ stabilize = false } = {}) {
    if (destroyed) return;
    return images.batch(() => reconcileDemand(stabilize));
  }
  function reconcileDemand(stabilize) {
    const protectedSet = protectedKeys();
    requireCapacity(protectedSet);
    const desired = new Set([...protectedSet, ...warm]);
    const errors = [];
    for (const key of cache.keys()) {
      if (!desired.has(key) && policies.get(catalog.get(key).pool).eviction !== "capacity") {
        try { release(key); } catch (error) { errors.push(error); }
      }
    }
    for (const key of desired) {
      if (cache.has(key) || warmed.has(key)) continue;
      const asset = catalog.get(key), policy = policies.get(asset.pool);
      let occupied = urls(cache.keys(), asset.pool);
      if (!occupied.has(asset.url) && occupied.size >= policy.capacity) {
        // Retain the published and requested materials. Optional prewarm is
        // lower priority than required demand, including pending native work.
        const victims = [...cache.values()].filter(entry => catalog.get(entry.key).pool === asset.pool &&
          !protectedSet.has(entry.key) && (!warm.includes(entry.key) || protectedSet.has(key)))
          .sort((a, b) => a.order - b.order);
        for (const victim of victims) {
          try { release(victim.key); } catch (error) { errors.push(error); }
          occupied = urls(cache.keys(), asset.pool);
          if (occupied.size < policy.capacity) break;
        }
      }
      occupied = urls(cache.keys(), asset.pool);
      if (occupied.has(asset.url) || occupied.size < policy.capacity) start(key, stabilize);
      else if (protectedSet.has(key)) throw new Error(`Prepared resource capacity could not admit ${key}.`);
    }
    if (errors.length) throw new AggregateError(errors, "Prepared residency release failed.");
  }
  const ready = key => warmed.has(key) || cache.get(key)?.ready === true;
  const awaitKeys = keys => Promise.all([...keys].map(key => warmed.has(key)
    ? Promise.resolve(true) : cache.get(key)?.promise ?? Promise.reject(new Error(`Unacquired resource: ${key}.`))));
  function retirePending() {
    if (!pending) return;
    const previous = pending;
    pending = null;
    previous.retired = true;
    previous.resolve(null);
  }

  const resources = Object.freeze({
    has: ready,
    read(key) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return images.read(catalog.get(key).url);
    },
    url(key) {
      if (!catalog.has(key)) throw new RangeError(`Undeclared prepared resource: ${key}.`);
      if (!ready(key)) return null;
      frameReads?.add(key);
      return catalog.get(key).url;
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
      warm = [...startup].filter(key => policies.get(catalog.get(key).pool).retention !== "warm");
      try { releaseWarmed(startup); } finally { startup.clear(); }
    },
    request(plan, { stabilize = false } = {}) {
      if (destroyed) throw new Error("Prepared residency is destroyed.");
      const required = requireKeys(plan.required), prewarm = [...requireKeys(plan.prewarm ?? [])];
      requireCapacity(protectedKeys(required));
      retirePending();
      const state = { required, prewarm, ready: false, retired: false };
      const promise = new Promise(resolve => { state.resolve = resolve; });
      // The ticket promise preserves decode errors while cancellation is prompt.
      let rejectTicket;
      const failure = new Promise((_, reject) => { rejectTicket = reject; });
      const ticket = Object.freeze({ required: Object.freeze([...required]), ready: Promise.race([promise, failure]) });
      ticket.ready.catch(() => {});
      tickets.set(ticket, state);
      pending = state;
      warm = prewarm;
      try { reconcile({ stabilize }); }
      catch (error) { retirePending(); rejectTicket(error); throw error; }
      awaitKeys(required).then(values => {
        if (state.retired || pending !== state || destroyed) return;
        if (values.some(value => value === null)) throw new Error("Current prepared demand was retired.");
        state.ready = true;
        state.resolve(ticket);
      }).catch(error => {
        if (state.retired || pending !== state || destroyed) return;
        state.retired = true;
        pending = null;
        rejectTicket(error);
        try { reconcile(); } catch (cleanupError) { onCleanupError(cleanupError); }
      });
      return ticket;
    },
    commit(ticket) {
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
    discard(ticket) {
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
          ...policy, keys: Object.freeze([...cache.keys()].filter(key => catalog.get(key).pool === policy.id)),
          resident: urls(cache.keys(), policy.id).size,
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

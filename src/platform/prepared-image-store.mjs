export async function decodePreparedImage(image, selectedUrl) {
  if (typeof selectedUrl !== "string" || !selectedUrl || typeof image?.decode !== "function") {
    throw new TypeError("Prepared image decoding requires an image and selected URL.");
  }
  try {
    image.src = selectedUrl;
    await image.decode();
    if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
      throw new Error("Decoded image has no pixels.");
    }
    return image;
  } catch (cause) {
    // The owner may have reused this image slot. Never clear it here.
    throw new Error(`Prepared image did not decode: ${selectedUrl}.`, { cause });
  }
}

export function releasePreparedImage(image) {
  // Test doubles and old image-like owners may not expose removeAttribute.
  if (typeof image.removeAttribute !== "function") { image.src = ""; return; }
  const errors = [];
  for (const attribute of ["srcset", "src"]) {
    try { image.removeAttribute(attribute); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, "Prepared image release failed.");
}

// One store belongs to one mounted object. Leases own URLs independently; an
// abandoned consumer cannot release another consumer's committed material.
export function createPreparedImageStore({
  createImage = () => new Image(), decoding = "async", pools = [],
} = {}) {
  const entries = new Map(), leases = new Set(), poolStates = new Map();
  let destroyed = false, pumping = false, retiringOwners = 0, allocations = 0, releases = 0;
  for (const policy of [{ id: null, capacity: Infinity, concurrency: Infinity, reuse: false }, ...pools]) {
    if (poolStates.has(policy.id) || !(policy.capacity >= 1) || !(policy.concurrency >= 1) ||
        (policy.decoding !== undefined && !["auto", "sync", "async"].includes(policy.decoding))) {
      throw new TypeError("Prepared image pool policy is invalid.");
    }
    poolStates.set(policy.id, { ...policy, active: 0, slots: [] });
  }

  function settle(entry, error, value) {
    for (const receipt of entry.owners.values()) {
      if (error) receipt.reject(error); else receipt.resolve(value);
    }
  }

  function retire(entry) {
    if (entries.get(entry.url) !== entry) return;
    // Retire every logical owner/slot before touching native cleanup. Native
    // decode may never settle, and cleanup itself may throw.
    entries.delete(entry.url);
    entry.retired = true;
    if (entry.started && !entry.ready) entry.pool.active--;
    const slot = entry.slot;
    if (!slot) return;
    slot.entry = null;
    releases++;
    // A successful warm handoff drops our native handle without invalidating
    // the decoded URL just published to retained CSS. It never stays reusable.
    if (entry.handedOff) {
      entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      return;
    }
    try { releasePreparedImage(slot.image); }
    catch (error) {
      entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      throw error;
    } finally {
      if (!entry.pool.reuse && entry.pool.slots.includes(slot)) {
        entry.pool.slots.splice(entry.pool.slots.indexOf(slot), 1);
      }
    }
  }

  function fail(entry, error) {
    if (entry.retired) return;
    try { retire(entry); } catch (cleanupError) {
      error = new AggregateError([error, cleanupError], error.message, { cause: error });
    }
    settle(entry, error);
  }

  function pump() {
    if (pumping || destroyed || retiringOwners) return;
    pumping = true;
    try {
      // A prepared URL can have two catalog roles in different pools. Once
      // the original role releases it, move the same native handle to a
      // remaining owner's pool so that it cannot strand the original slot.
      for (const entry of entries.values()) {
        if (!entry.slot || [...entry.owners.values()].some(owner => owner.pool === entry.pool)) continue;
        const destination = [...entry.owners.values()].map(owner => owner.pool).find(pool =>
          pool.slots.filter(slot => slot.entry !== null).length < pool.capacity &&
          (entry.ready || pool.active < pool.concurrency));
        if (!destination) continue;
        const previous = entry.pool;
        previous.slots.splice(previous.slots.indexOf(entry.slot), 1);
        if (destination.slots.length >= destination.capacity) {
          destination.slots.splice(destination.slots.findIndex(slot => slot.entry === null), 1);
        }
        destination.slots.push(entry.slot);
        if (entry.started && !entry.ready) { previous.active--; destination.active++; }
        entry.pool = destination;
      }
      for (const entry of entries.values()) {
        const pool = entry.pool;
        if (entry.started || pool.active >= pool.concurrency) continue;
        let slot = pool.slots.find((candidate) => candidate.entry === null);
        if (!slot && pool.slots.length >= pool.capacity) continue;
        try {
          if (!slot) {
            const image = createImage();
            slot = { image, entry: null };
            pool.slots.push(slot);
            allocations++;
          }
          slot.entry = entry;
          entry.slot = slot;
          slot.image.decoding = pool.decoding ?? decoding;
          entry.started = true;
          pool.active++;
          decodePreparedImage(slot.image, entry.url).then((image) => {
            if (entry.retired || slot.entry !== entry) return;
            entry.pool.active--;
            entry.ready = true;
            settle(entry, null, image);
            pump();
          }, (error) => {
            if (entry.retired || slot.entry !== entry) return;
            fail(entry, error);
            pump();
          });
        } catch (error) { fail(entry, error); }
      }
    } finally { pumping = false; }
  }

  function createLease(role = "request") {
    if (typeof role !== "string" || !role) throw new TypeError("Prepared resource owner requires a role.");
    const owned = new Map();
    let disposed = destroyed;
    const lease = Object.freeze({
      role,
      load(url, { pool: poolId = null } = {}) {
        if (disposed || destroyed) return Promise.resolve(null);
        if (typeof url !== "string" || !url) return Promise.reject(new TypeError("Prepared image URL is missing."));
        const pool = poolStates.get(poolId);
        if (!pool) return Promise.reject(new RangeError(`Unknown prepared image pool: ${poolId}.`));
        let entry = entries.get(url);
        const previous = owned.get(url);
        if (entry && previous?.entry === entry) return previous.promise;
        if (!entry) {
          entry = { url, pool, owners: new Map(), started: false, ready: false, retired: false, slot: null };
          entries.set(url, entry);
        }
        const receipt = { entry, pool };
        receipt.promise = new Promise((resolve, reject) => Object.assign(receipt, { resolve, reject }));
        // Callers may abandon a request before observing it. Preserve the
        // original rejection for callers while always observing native work.
        receipt.promise.catch(() => {});
        owned.set(url, receipt);
        entry.owners.set(lease, receipt);
        if (entry.ready) receipt.resolve(entry.slot.image);
        pump();
        return receipt.promise;
      },
      handoff(url) {
        const receipt = owned.get(url);
        if (!receipt || !receipt.entry.ready || receipt.entry.retired) {
          throw new Error("Only an owned decoded resource can be handed to retained CSS.");
        }
        receipt.entry.handedOff = true;
        return lease.release(url);
      },
      release(url) {
        const receipt = owned.get(url);
        if (!receipt) return false;
        owned.delete(url);
        const entry = receipt.entry;
        entry.owners.delete(lease);
        receipt.resolve(null);
        try { if (!entry.owners.size) retire(entry); }
        finally { pump(); }
        return true;
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        leases.delete(lease);
        const errors = [];
        retiringOwners++;
        try {
          for (const url of owned.keys()) {
            try { lease.release(url); } catch (error) { errors.push(error); }
          }
        } finally { retiringOwners--; pump(); }
        if (errors.length) throw new AggregateError(errors, "Prepared resource owner cleanup failed.");
      },
      keys: () => Object.freeze([...owned.keys()]),
    });
    if (!destroyed) leases.add(lease);
    return lease;
  }

  return Object.freeze({
    createLease,
    // Retire a complete demand set before opening native decode slots again.
    // Individual releases must not start queued work that the same replacement
    // is about to cancel (for example, the remaining pages of a hidden bank).
    batch(callback) {
      if (typeof callback !== "function" || /Async|Generator/.test(callback.constructor?.name)) {
        throw new TypeError("Prepared image batch requires synchronous ownership changes.");
      }
      retiringOwners++;
      try {
        const result = callback();
        if (result && typeof result.then === "function") {
          Promise.resolve(result).catch(() => {});
          throw new TypeError("Prepared image batch cannot return asynchronous work.");
        }
        return result;
      } finally { retiringOwners--; pump(); }
    },
    has: (url) => entries.get(url)?.ready === true,
    read: (url) => entries.get(url)?.ready ? entries.get(url).slot.image : null,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors = [];
      for (const lease of leases) {
        try { lease.destroy(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "Prepared image cleanup failed.");
    },
    stats() {
      let retainedCount = 0;
      for (const entry of entries.values()) if (entry.ready) retainedCount++;
      return Object.freeze({ retainedCount, pendingCount: entries.size - retainedCount });
    },
    ownershipStats() {
      return Object.freeze({
        allocations, releases,
        entries: Object.freeze([...entries.values()].map((entry) => Object.freeze({
          url: entry.url, ready: entry.ready, started: entry.started,
          owners: Object.freeze([...entry.owners.keys()].map(({ role }) => role)),
        }))),
        pools: Object.freeze([...poolStates.values()].filter(({ id }) => id !== null).map((pool) => Object.freeze({
          id: pool.id, active: pool.active, slots: pool.slots.length,
          occupied: pool.slots.filter(({ entry }) => entry !== null).length,
        }))),
      });
    },
  });
}

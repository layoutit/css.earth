export interface PreparedImage {
  src: string; decoding: "async" | "sync" | "auto"; naturalWidth: number; naturalHeight: number;
  decode(): Promise<void>; removeAttribute?(name: string): void;
}
export interface PreparedImagePool { id: string | null; capacity: number; concurrency: number; reuse: boolean; decoding?: PreparedImage["decoding"];
  /** A pool that budgets decoded bytes holds images large enough to overflow the browser's own decode budget. */
  maximumDecodedBytes?: number; }
export interface PreparedImageStoreOptions { createImage?: () => PreparedImage; decoding?: PreparedImage["decoding"]; pools?: readonly PreparedImagePool[]; }
export interface PreparedImageLease {
  readonly role: string; load(url: string, options?: { pool?: string | null }): Promise<PreparedImage | null>;
  handoff(url: string): boolean; release(url: string): boolean; destroy(): void; keys(): readonly string[];
}
interface PoolState extends PreparedImagePool { active: number; slots: ImageSlot[]; }
interface ImageSlot { image: PreparedImage; entry: ImageEntry | null; }
interface ImageReceipt { entry: ImageEntry; pool: PoolState; promise: Promise<PreparedImage | null>; resolve(value: PreparedImage | null): void; reject(reason: unknown): void; }
interface ImageEntry { url: string; pool: PoolState; owners: Map<PreparedImageLease, ImageReceipt>; started: boolean; ready: boolean; retired: boolean; slot: ImageSlot | null; handedOff?: boolean; }

/** `retry`: whether a failed decode is still wanted, and so tried once more. */
export async function decodePreparedImage(image: PreparedImage, selectedUrl: string, retry: () => boolean = () => false) {
  if (typeof selectedUrl !== "string" || !selectedUrl || typeof image?.decode !== "function") {
    throw new TypeError("Prepared image decoding requires an image and selected URL.");
  }
  try {
    image.src = selectedUrl;
    // Chromium rejects a decode that would overflow its decoded-image budget (about 256 MB per page) before evicting
    // older images, then accepts the same image: measured 2026-09-24, every fifth 16 MP page failed once. Only large
    // images (a pool with a decoded-byte budget) are retried; any other failure is final at once.
    await image.decode().catch((error: unknown) => { if (!retry()) throw error; return image.decode(); });
    if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
      throw new Error("Decoded image has no pixels.");
    }
    return image;
  } catch (cause) {
    // The owner may have reused this image slot. Never clear it here.
    throw new Error(`Prepared image did not decode: ${selectedUrl}.`, { cause });
  }
}

export function releasePreparedImage(image: PreparedImage) {
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
}: PreparedImageStoreOptions = {}) {
  const entries = new Map<string, ImageEntry>(), leases = new Set<PreparedImageLease>(), poolStates = new Map<string | null, PoolState>();
  let destroyed = false, pumping = false, retiringOwners = 0, allocations = 0, releases = 0;
  for (const policy of [{ id: null, capacity: Infinity, concurrency: Infinity, reuse: false }, ...pools]) {
    if (poolStates.has(policy.id) || !(policy.capacity >= 1) || !(policy.concurrency >= 1) ||
        (policy.decoding !== undefined && !["auto", "sync", "async"].includes(policy.decoding))) {
      throw new TypeError("Prepared image pool policy is invalid.");
    }
    poolStates.set(policy.id, { ...policy, active: 0, slots: [] });
  }

  function settle(entry: ImageEntry, error: unknown, value: PreparedImage | null = null) {
    for (const receipt of entry.owners.values()) {
      if (error) receipt.reject(error); else receipt.resolve(value);
    }
  }

  function retire(entry: ImageEntry) {
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

  function fail(entry: ImageEntry, error: unknown) {
    if (entry.retired) return;
    try { retire(entry); } catch (cleanupError) {
      error = new AggregateError([error, cleanupError], error instanceof Error ? error.message : String(error), { cause: error });
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
          const activeSlot = slot;
          decodePreparedImage(activeSlot.image, entry.url, () => entry.pool.maximumDecodedBytes !== undefined && !entry.retired && activeSlot.entry === entry).then((image) => {
            if (entry.retired || activeSlot.entry !== entry) return;
            entry.pool.active--;
            entry.ready = true;
            settle(entry, null, image);
            pump();
          }, (error) => {
            if (entry.retired || activeSlot.entry !== entry) return;
            fail(entry, error);
            pump();
          });
        } catch (error) { fail(entry, error); }
      }
    } finally { pumping = false; }
  }

  function createLease(role = "request") {
    if (typeof role !== "string" || !role) throw new TypeError("Prepared resource owner requires a role.");
    const owned = new Map<string, ImageReceipt>();
    let disposed = destroyed;
    const lease: PreparedImageLease = Object.freeze({
      role,
      load(url: string, { pool: poolId = null }: { pool?: string | null } = {}) {
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
        let resolveReceipt!: ImageReceipt["resolve"], rejectReceipt!: ImageReceipt["reject"];
        const promise = new Promise<PreparedImage | null>((resolve, reject) => { resolveReceipt = resolve; rejectReceipt = reject; });
        const receipt: ImageReceipt = { entry, pool, promise, resolve: resolveReceipt, reject: rejectReceipt };
        // Callers may abandon a request before observing it. Preserve the
        // original rejection for callers while always observing native work.
        receipt.promise.catch(() => {});
        owned.set(url, receipt);
        entry.owners.set(lease, receipt);
        if (entry.ready && entry.slot) receipt.resolve(entry.slot.image);
        pump();
        return receipt.promise;
      },
      handoff(url: string) {
        const receipt = owned.get(url);
        if (!receipt || !receipt.entry.ready || receipt.entry.retired) {
          throw new Error("Only an owned decoded resource can be handed to retained CSS.");
        }
        receipt.entry.handedOff = true;
        return lease.release(url);
      },
      release(url: string) {
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
    batch<T>(callback: () => T) {
      if (typeof callback !== "function" || /Async|Generator/.test(callback.constructor?.name)) {
        throw new TypeError("Prepared image batch requires synchronous ownership changes.");
      }
      retiringOwners++;
      try {
        const result = callback();
        if (result && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
          Promise.resolve(result).catch(() => {});
          throw new TypeError("Prepared image batch cannot return asynchronous work.");
        }
        return result;
      } finally { retiringOwners--; pump(); }
    },
    has: (url: string) => entries.get(url)?.ready === true,
    read: (url: string) => { const entry = entries.get(url); return entry?.ready ? entry.slot?.image ?? null : null; },
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

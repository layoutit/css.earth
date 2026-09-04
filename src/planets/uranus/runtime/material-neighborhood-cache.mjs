import { createPreparedImageStore } from "../../../platform/prepared-image-store.mjs";

// Residency is object-owned: one camera neighborhood plus one pending lens
// neighborhood, never the complete material bank. Native transport is shared.
export function createUranusMaterialNeighborhoodCache(options = {}) {
  const images = createPreparedImageStore(options);
  const tracked = new Set();
  let active = new Set();
  let pending = null;
  let destroyed = false;

  function neighborhood(rows, rowIndex) {
    if (!Array.isArray(rows) || rows.length !== 16 || !Number.isSafeInteger(rowIndex) ||
        rowIndex < 0 || rowIndex >= rows.length) {
      throw new TypeError("Uranus prepared material neighborhood is invalid.");
    }
    return new Set([rowIndex - 1, rowIndex, rowIndex + 1].map((index) =>
      rows[Math.max(0, Math.min(rows.length - 1, index))]));
  }
  function prune() {
    const errors = [];
    for (const url of tracked) {
      if (active.has(url) || pending?.urls.has(url)) continue;
      tracked.delete(url);
      try { images.release(url); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Uranus material neighborhood cleanup failed.");
  }
  function load(urls) {
    return Promise.all([...urls].map((url) => {
      tracked.add(url);
      return images.load(url);
    }));
  }
  return Object.freeze({
    warm(rows, rowIndex) {
      if (destroyed) return Promise.resolve(false);
      const urls = neighborhood(rows, rowIndex);
      active = urls;
      // Ownership/plan failures stay synchronous for the camera's fatal
      // publication boundary. Only native decoding uses the recoverable promise.
      prune();
      return load(urls).then((decoded) =>
        !destroyed && active === urls && decoded.every(Boolean));
    },
    async prepare(rows, rowIndex) {
      if (destroyed) return null;
      const ticket = { urls: neighborhood(rows, rowIndex) };
      pending = ticket;
      prune();
      try {
        const decoded = await load(ticket.urls);
        if (destroyed || pending !== ticket || !decoded.every(Boolean)) return null;
      } catch (error) {
        if (destroyed || pending !== ticket) return null;
        pending = null;
        try { prune(); } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], error.message, { cause: error });
        }
        throw error;
      }
      return Object.freeze({
        commit() {
          if (destroyed || pending !== ticket) throw new Error("Uranus material preparation expired.");
          active = ticket.urls;
          pending = null;
          prune();
        },
        discard() {
          if (pending !== ticket) return;
          pending = null;
          prune();
        },
      });
    },
    stats() {
      return Object.freeze({ ...images.stats(), maximumNeighborhoodSize: 3,
        activeCount: active.size, pendingNeighborhoodCount: pending?.urls.size ?? 0 });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active.clear();
      pending = null;
      tracked.clear();
      images.destroy();
    },
  });
}

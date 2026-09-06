// The UI receives at most eight result labels or one entity and its ancestors.
// All verified pack decoding, search and detail residency belong to the worker.
export function createDestinationClient({ catalog, signal,
  workerFactory = () => new Worker(new URL("./prepared-destination-worker.mjs", import.meta.url), { type: "module", name: "prepared-destinations" }),
}) {
  let worker = null, disposed = false, serial = 0, starts = 0, snapshot = null;
  const pending = new Map();
  function stop(error) {
    worker?.terminate(); worker = null; snapshot = null;
    for (const job of pending.values()) job.finish(error);
  }
  function dispose() { disposed = true; stop(new Error("Destination worker was disposed.")); }
  signal?.addEventListener("abort", dispose, { once: true });
  function start() {
    if (worker) return;
    const owned = workerFactory(); worker = owned; starts++;
    owned.addEventListener("message", ({ data }) => {
      if (worker !== owned) return;
      snapshot = data.stats ?? snapshot;
      pending.get(data.id)?.finish(data.error ? new Error(data.error) : null, data.value);
    });
    const fail = () => { if (worker === owned) stop(new Error("Place search worker could not load. Retry the search.")); };
    owned.addEventListener("error", fail); owned.addEventListener("messageerror", fail);
    owned.postMessage({ type: "init", catalog });
  }
  async function request(type, payload, caller) {
    if (disposed) throw new Error("Destination worker was disposed.");
    signal?.throwIfAborted(); caller?.throwIfAborted();
    if (pending.size >= 8) throw new Error("Destination request capacity is occupied.");
    start();
    const id = ++serial;
    return new Promise((resolve, reject) => {
      const abort = () => {
        worker?.postMessage({ type: "cancel", id });
        finish(caller.reason ?? new DOMException("Aborted", "AbortError"));
      };
      const finish = (error, value) => {
        if (!pending.has(id)) return;
        clearTimeout(timer); caller?.removeEventListener("abort", abort); pending.delete(id);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => {
        worker?.postMessage({ type: "cancel", id }); finish(new Error("Destination request timed out. Retry the search."));
      }, 30000);
      pending.set(id, { finish });
      caller?.addEventListener("abort", abort, { once: true });
      try { worker.postMessage({ type, id, ...payload }); } catch (error) { finish(error); }
    });
  }
  return Object.freeze({
    search: (query, limit = 8, caller) => request("search", { query, limit }, caller),
    resolve: (entityId, caller) => request("resolve", { entityId }, caller),
    stats: () => ({ worker: Boolean(worker), starts, pending: pending.size, disposed, store: snapshot }),
    dispose() { signal?.removeEventListener("abort", dispose); dispose(); },
  });
}

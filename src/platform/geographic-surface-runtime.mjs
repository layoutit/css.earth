import { readPreparedBytes } from "./prepared-json-transport.mjs";
import { GEOGRAPHIC_OVERVIEW_LIMITS } from "./geographic-lens-contract.mjs";

// A bounded immutable bank on the already-mounted surface. No new scene nodes,
// geometry generation, canvas or runtime source sampling enter this transport.
export function createGeographicSurfaceRuntime({ surface, fetcher = fetch, createImage = () => new Image() }) {
  let revision = 0, controller = null, current = [], destroyed = false, pending = Promise.resolve();
  let activeLoads = 0, requests = 0, receivedBytes = 0, published = false;
  function clear() {
    revision++; controller?.abort(); controller = null; published = false;
    surface?.clear();
    for (const item of current) { item.image.src = ""; if (item.url) URL.revokeObjectURL(item.url); }
    current = [];
  }
  return Object.freeze({
    clear,
    async prepare(overview, signal) {
      clear();
      const version = revision;
      await pending.catch(() => {});
      if (destroyed || version !== revision || signal.aborted) return false;
      if (!overview) return true;
      if (!surface || overview.images.length !== surface.slots.length || overview.images.some(item => !surface.slots.includes(item.slot))) {
        throw new Error("The observation overview does not match the prepared surface.");
      }
      controller = new AbortController();
      const loadSignal = AbortSignal.any([controller.signal, signal, AbortSignal.timeout(30000)]);
      let cursor = 0;
      const run = async () => {
        while (cursor < overview.images.length) {
          loadSignal.throwIfAborted();
          const entry = overview.images[cursor++], item = { ...entry, expected: entry.image, image: createImage(), url: null, ready: false };
          current.push(item); activeLoads++; requests++;
          try {
            const response = await fetcher(entry.image.url, { signal: loadSignal, credentials: "same-origin" });
            if (!response.ok) throw new Error(`Observation overview: HTTP ${response.status}`);
            const bytes = await readPreparedBytes(response, entry.image);
            loadSignal.throwIfAborted(); receivedBytes += bytes.byteLength;
            item.url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
            item.image.src = item.url; await item.image.decode(); loadSignal.throwIfAborted();
            if (item.image.naturalWidth !== entry.image.width || item.image.naturalHeight !== entry.image.height) throw new Error("Observation overview dimensions drifted.");
            item.ready = true;
          } finally { activeLoads--; }
        }
      };
      const jobs = Array.from({length: Math.min(GEOGRAPHIC_OVERVIEW_LIMITS.concurrentLoads, overview.images.length)}, () => run().catch(error => {
        controller?.abort(); throw error;
      }));
      pending = Promise.allSettled(jobs);
      const results = await pending;
      if (destroyed || version !== revision || signal.aborted) return false;
      const failure = results.find(result => result.status === "rejected");
      if (failure) { clear(); throw failure.reason; }
      return true;
    },
    publish() {
      if (destroyed || !current.length) return;
      if (current.some(item => !item.ready)) throw new Error("Observation overview is not completely prepared.");
      surface.set(new Map(current.map(item => [item.slot, item.url]))); published = true;
    },
    stats: () => ({ activeLoads, requests, receivedBytes, retainedImages: current.length, published,
      reservedDecodedBytes: current.reduce((sum, item) => sum + item.expected.width * item.expected.height * 4, 0) }),
    destroy() { if (destroyed) return; destroyed = true; clear(); },
  });
}

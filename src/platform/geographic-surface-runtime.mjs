import { createApiImageTransport } from "./prepared-map/api-image-transport.mjs";
import { GEOGRAPHIC_OVERVIEW_LIMITS } from "./geographic-lens-contract.mjs";

// A bounded immutable bank on the already-mounted surface. No new scene nodes,
// geometry generation, canvas or runtime source sampling enter this transport.
export function createGeographicSurfaceRuntime({ surface, fetcher = fetch, images = null, createImage = () => new Image() }) {
  const transport = images ? null : createApiImageTransport({ fetchImage: fetcher, createImage });
  images ??= transport.createScope({ maximumEntries: GEOGRAPHIC_OVERVIEW_LIMITS.images, maximumDecodedBytes: GEOGRAPHIC_OVERVIEW_LIMITS.decodedBytes });
  let revision = 0, controller = null, current = [], destroyed = false, pending = Promise.resolve();
  let activeLoads = 0, acquisitions = 0, published = false;
  function clear() {
    revision++; controller?.abort(); controller = null; published = false;
    surface?.clear();
    for (const item of current) item.handle?.release();
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
          const entry = overview.images[cursor++], item = { ...entry, expected: entry.image, url: null, handle: null, ready: false };
          current.push(item); activeLoads++; acquisitions++;
          try {
            item.handle = images.acquire({ ...entry.image, rasterSource: "prepared-raster@1" }, { signal: loadSignal });
            item.url = await item.handle.ready;
            loadSignal.throwIfAborted();
            item.ready = true;
          } catch (error) {
            if (!loadSignal.aborted) item.handle?.invalidate();
            throw error;
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
    stats: () => ({ activeLoads, acquisitions, imageResources: images.stats(), retainedImages: current.length, published,
      reservedDecodedBytes: current.reduce((sum, item) => sum + item.expected.width * item.expected.height * 4, 0) }),
    destroy() { if (destroyed) return; destroyed = true; clear(); transport?.destroy(); },
  });
}

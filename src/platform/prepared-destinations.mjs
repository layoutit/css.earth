// The runtime owns catalogue transport and lifetime; packages provide pinned data.
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset }) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error("Object was unmounted."); };
  return Object.freeze({
    async load(signal) {
      assertLive();
      const response = await fetch(plan.catalog.url, { signal: signal
        ? AbortSignal.any([signal, controller.signal]) : controller.signal });
      if (!response.ok) throw new Error("City catalogue request failed.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== plan.catalog.bytes) throw new Error("City catalogue size drifted.");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map(value => value.toString(16).padStart(2, "0")).join("");
      assertLive();
      if (digest !== plan.catalog.sha256) throw new Error("City catalogue identity drifted.");
      const catalog = JSON.parse(new TextDecoder().decode(bytes));
      if (catalog.schema !== "cssearth-prepared-destinations@1" || catalog.places?.length !== plan.catalog.count) {
        throw new Error("City catalogue is incompatible.");
      }
      return catalog;
    },
    async select(place) {
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens)) throw new Error("Destination selection was superseded.");
      assertLive();
      return { status: place.coverage === "detail" ? plan.statuses.detail : plan.statuses.overview,
        arrival: navigate(place.camera) };
    },
    reset() { if (!lifetime.disposed) return reset(); },
  });
}

import { readPreparedJson } from "./prepared-json-transport.mjs";
// The runtime owns catalogue transport and lifetime; packages provide pinned data.
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset, onChange = () => {} }) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error("Object was unmounted."); };
  let selected = null, revision = 0;
  return Object.freeze({
    state: () => selected,
    async load(signal) {
      assertLive();
      const response = await fetch(plan.catalog.url, { signal: signal
        ? AbortSignal.any([signal, controller.signal]) : controller.signal });
      if (!response.ok) throw new Error("Place catalogue request failed.");
      const catalog = await readPreparedJson(response, plan.catalog);
      assertLive();
      if (catalog.schema !== "cssearth-prepared-destinations@1" || catalog.places?.length !== plan.catalog.count) {
        throw new Error("Place catalogue is incompatible.");
      }
      return catalog;
    },
    async select(place) {
      const request = ++revision;
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens)) throw new Error("Destination selection was superseded.");
      assertLive();
      if (request !== revision) throw new Error("Destination selection was superseded.");
      selected = place; onChange(place);
      return { status: place.status ?? (place.coverage === "detail" ? plan.statuses.detail : plan.statuses.overview),
        arrival: navigate(place.camera) };
    },
    async reset() {
      const request = ++revision;
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens) || request !== revision) return false;
      assertLive(); selected = null; onChange(null);
      return { arrival: reset() };
    },
  });
}

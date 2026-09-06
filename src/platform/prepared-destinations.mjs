import { createDestinationStore } from "./prepared-destination-store.mjs";
// The runtime owns catalogue transport and lifetime; packages provide pinned data.
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset, onChange = () => {} }) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error("Object was unmounted."); };
  const store = createDestinationStore({ catalog: plan.catalog, signal: controller.signal });
  let selected = null, revision = 0;
  return Object.freeze({
    state: () => selected,
    resolve: store.resolve,
    search: store.search,
    stats: store.stats,
    async select(place, { navigate: fly = true } = {}) {
      const request = ++revision;
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens)) throw new Error("Destination selection was superseded.");
      assertLive();
      if (request !== revision) throw new Error("Destination selection was superseded.");
      selected = place; onChange(place);
      return { status: place.status ?? (place.coverage === "detail" ? plan.statuses.detail : plan.statuses.overview),
        arrival: fly ? navigate(place.camera) : null };
    },
    async reset({ navigate: fly = true } = {}) {
      const request = ++revision;
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens) || request !== revision) return false;
      assertLive(); selected = null; onChange(null);
      return { arrival: fly ? reset() : null };
    },
  });
}

import { createDestinationClient } from "./prepared-destination-client.mjs";
// The runtime owns catalogue transport and lifetime; packages provide pinned data.
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset, retainLens = () => false, onChange = () => {}, createStore = createDestinationClient }) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error("Object was unmounted."); };
  const store = createStore({ catalog: plan.catalog, signal: controller.signal });
  let selected = null, revision = 0;
  const assertCurrent = (request, signal) => {
    assertLive(); signal?.throwIfAborted();
    if (request !== revision) throw new Error("Destination selection was superseded.");
  };
  return Object.freeze({
    state: () => selected,
    resolve: store.resolve,
    search: store.search,
    stats: store.stats,
    async select(place, { navigate: fly = true, signal } = {}) {
      const request = ++revision;
      await ready; assertCurrent(request, signal);
      if (!retainLens(place) && !await selectLens(plan.defaultLens)) throw new Error("Destination selection was superseded.");
      assertCurrent(request, signal);
      selected = place; onChange(place);
      return { status: place.status ?? (place.coverage === "detail" ? plan.statuses.detail : plan.statuses.overview),
        arrival: fly ? navigate(place.camera) : null };
    },
    async reset({ navigate: fly = true, signal } = {}) {
      const request = ++revision;
      await ready; assertCurrent(request, signal);
      if (!retainLens(plan.rootEntity) && !await selectLens(plan.defaultLens) || request !== revision) return false;
      assertCurrent(request, signal); selected = null; onChange(null);
      return { arrival: fly ? reset() : null };
    },
  });
}

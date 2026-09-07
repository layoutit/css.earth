import { createDestinationClient } from './prepared-destination-client.js';
import type { SceneLifetime } from '@cssearth/engine';
import type { DestinationCatalog, DestinationEntity } from './destination-types.js';
import type { GeographicEntity } from './geographic-types.js';
export interface PreparedDestinationPlan {
  catalog: DestinationCatalog; defaultLens: string; rootEntity: GeographicEntity;
  statuses: { detail: string; overview: string };
}
export interface PreparedDestinationOptions {
  plan: PreparedDestinationPlan; ready: Promise<void>; lifetime: SceneLifetime;
  selectLens(id: string): Promise<boolean>;
  navigate(camera: DestinationEntity['camera']): Promise<{ completed: boolean }>;
  reset(): Promise<{ completed: boolean }> | undefined;
  retainLens?(entity: GeographicEntity): boolean;
  onChange?(entity: DestinationEntity | null): void;
  createStore?: typeof createDestinationClient;
}
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset,
  retainLens = () => false, onChange = () => {}, createStore = createDestinationClient }: PreparedDestinationOptions) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error('Object was unmounted.'); };
  const store = createStore({ catalog: plan.catalog, signal: controller.signal });
  let selected: DestinationEntity | null = null, revision = 0;
  return Object.freeze({
    state: () => selected, resolve: store.resolve, search: store.search, stats: store.stats,
    async select(place: DestinationEntity, { navigate: fly = true } = {}) {
      const request = ++revision;
      await ready; assertLive();
      if (!retainLens(place) && !await selectLens(plan.defaultLens)) throw new Error('Destination selection was superseded.');
      assertLive();
      if (request !== revision) throw new Error('Destination selection was superseded.');
      selected = place; onChange(place);
      return { status: place.status ?? (place.coverage === 'detail' ? plan.statuses.detail : plan.statuses.overview),
        arrival: fly ? navigate(place.camera) : null };
    },
    async reset({ navigate: fly = true } = {}) {
      const request = ++revision;
      await ready; assertLive();
      if (!retainLens(plan.rootEntity) && !await selectLens(plan.defaultLens) || request !== revision) return false;
      assertLive(); selected = null; onChange(null);
      return { arrival: fly ? reset() : null };
    },
  });
}

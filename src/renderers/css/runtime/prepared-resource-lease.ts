import { createPreparedResidency } from '../rendering/prepared-residency.js';
import type { PreparedAssets, PreparedResourceDemand, PreparedResidencyOptions, PreparedResidencyTicket } from '../rendering/prepared-residency.js';

type Residency = ReturnType<typeof createPreparedResidency>;
type Callbacks = Pick<PreparedResidencyOptions, 'onReady' | 'onWarmError' | 'onCleanupError'>;

/** Decode the next object's fixed asset bank without mounting a second scene. */
export interface PreparedResourceLease {
  readonly ready: Promise<void>;
  prepareDemand(resolve: () => PreparedResourceDemand): Promise<void>;
  claim(assets: PreparedAssets, callbacks: Callbacks): Residency;
  destroy(): void;
}

export function prepareObjectResources(assets: PreparedAssets, {
  signal, createResources = createPreparedResidency,
}: { signal?: AbortSignal; createResources?: typeof createPreparedResidency } = {}): PreparedResourceLease {
  let claimed = false, destroyed = false, preparing = false, startupComplete = false;
  let preparedTicket: PreparedResidencyTicket | null = null;
  let callbacks: Callbacks = {};
  const resources = createResources({ assets,
    onReady(key) { callbacks.onReady?.(key); },
    onWarmError(error) { callbacks.onWarmError?.(error); },
    onCleanupError(error) { callbacks.onCleanupError?.(error); },
  });
  const abort = () => destroy();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) destroy();
  const ready = (async () => {
    if (destroyed || !await resources.prepareStartup() || destroyed) {
      throw new DOMException('Object preparation was cancelled.', 'AbortError');
    }
    // Startup describes the default view, not the eventual incoming camera.
    // Retire its temporary protection before admitting a different view.
    resources.finishStartup();
    startupComplete = true;
  })();
  ready.catch(() => {});
  return Object.freeze({ ready,
    async prepareDemand(resolve: () => PreparedResourceDemand) {
      if (destroyed || claimed) throw new DOMException('Object preparation is unavailable.', 'AbortError');
      if (preparing) throw new Error('Object view preparation is already in progress.');
      preparing = true;
      preparedTicket = null;
      try {
        await ready;
        let demand = resolve();
        while (!destroyed && !claimed) {
          const ticket = resources.request(demand);
          const loaded = await ticket.ready;
          if (!loaded || destroyed || claimed) throw new DOMException('Object preparation was cancelled.', 'AbortError');
          const latest = resolve();
          if (!sameDemand(demand, latest)) { demand = latest; continue; }
          // This bank has no visible scene yet. Keep a replaceable ready ticket;
          // only the eventual mounted owner can commit and protect this view.
          preparedTicket = ticket;
          return;
        }
        throw new DOMException('Object preparation was cancelled.', 'AbortError');
      } finally { preparing = false; }
    },
    claim(expected: PreparedAssets, listeners: Callbacks) {
      if (destroyed || claimed || preparing || !startupComplete || expected !== assets) throw new TypeError('Prepared resource lease is unavailable or belongs to another definition.');
      if (preparedTicket) resources.commit(preparedTicket);
      claimed = true;
      callbacks = listeners;
      signal?.removeEventListener('abort', abort);
      return resources;
    },
    destroy,
  });
  function destroy() {
    if (destroyed || claimed) return;
    destroyed = true;
    signal?.removeEventListener('abort', abort);
    resources.destroy();
  }
}

function sameDemand(a: PreparedResourceDemand, b: PreparedResourceDemand) {
  return a.required.length === b.required.length && a.required.every((key, i) => key === b.required[i]) &&
    (a.prewarm?.length ?? 0) === (b.prewarm?.length ?? 0) && (a.prewarm ?? []).every((key, i) => key === b.prewarm?.[i]);
}

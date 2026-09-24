import { createPreparedResidency } from '../rendering/prepared-residency.js';
import type { PreparedAssets, PreparedResourceDemand, PreparedResidencyOptions, PreparedResidencyTicket } from '../rendering/prepared-residency.js';
import type { PreparedAssetOrigin } from '../rendering/prepared-asset-origin.js';

type Residency = ReturnType<typeof createPreparedResidency>;
type Callbacks = Pick<PreparedResidencyOptions, 'onReady' | 'onWarmError' | 'onCleanupError'>;
type LeaseState =
  | { kind: 'starting' | 'preparing' | 'failed' | 'destroyed' }
  | { kind: 'ready'; ticket: PreparedResidencyTicket | null }
  | { kind: 'claimed'; callbacks: Callbacks };

/** Decode the next object's fixed asset bank without mounting a second scene. */
export interface PreparedResourceLease {
  readonly ready: Promise<void>;
  prepareDemand(resolve: () => PreparedResourceDemand): Promise<void>;
  claim(assets: PreparedAssets, callbacks: Callbacks): Residency;
  destroy(): void;
}

export function prepareObjectResources(assets: PreparedAssets, {
  signal, createResources = createPreparedResidency, assetOrigin,
}: { signal?: AbortSignal; createResources?: typeof createPreparedResidency; assetOrigin?: PreparedAssetOrigin } = {}): PreparedResourceLease {
  let state: LeaseState = { kind: 'starting' };
  const callbacks = () => state.kind === 'claimed' ? state.callbacks : null;
  const resources = createResources({ assets,
    onReady(key) { callbacks()?.onReady?.(key); },
    onWarmError(error) { callbacks()?.onWarmError?.(error); },
    onCleanupError(error) { callbacks()?.onCleanupError?.(error); },
    ...(assetOrigin ? { assetOrigin } : {}),
  });
  signal?.addEventListener('abort', destroy, { once: true });
  if (signal?.aborted) destroy();
  const unavailable = () => state.kind === 'destroyed' || state.kind === 'claimed';
  const ready = (async () => {
    try {
      if (unavailable() || !await resources.prepareStartup() || unavailable()) {
        throw new DOMException('Object preparation was cancelled.', 'AbortError');
      }
      // Startup describes the default view, not the eventual incoming camera.
      // Retire its temporary protection before admitting a different view.
      resources.finishStartup();
      if (state.kind === 'starting') state = { kind: 'ready', ticket: null };
    } catch (error) {
      if (!unavailable()) state = { kind: 'failed' };
      throw error;
    }
  })();
  ready.catch(() => {});
  return Object.freeze({ ready,
    async prepareDemand(resolve: () => PreparedResourceDemand) {
      if (unavailable()) throw new DOMException('Object preparation is unavailable.', 'AbortError');
      if (state.kind === 'failed') return ready;
      if (state.kind === 'preparing') throw new Error('Object view preparation is already in progress.');
      // Identity prevents a late decode from restoring a destroyed or claimed lease.
      const preparing: LeaseState = { kind: 'preparing' };
      state = preparing;
      try {
        await ready;
        let demand = resolve();
        while (state === preparing) {
          const ticket = resources.request(demand);
          const loaded = await ticket.ready;
          if (!loaded || state !== preparing) throw new DOMException('Object preparation was cancelled.', 'AbortError');
          const latest = resolve();
          if (state !== preparing) throw new DOMException('Object preparation was cancelled.', 'AbortError');
          if (!sameDemand(demand, latest)) { demand = latest; continue; }
          // Only the eventual mounted owner can commit and protect this view.
          state = { kind: 'ready', ticket };
          return;
        }
        throw new DOMException('Object preparation was cancelled.', 'AbortError');
      } finally {
        if (state === preparing) state = { kind: 'ready', ticket: null };
      }
    },
    claim(expected: PreparedAssets, listeners: Callbacks) {
      if (state.kind !== 'ready' || expected !== assets) throw new TypeError('Prepared resource lease is unavailable or belongs to another definition.');
      if (state.ticket) resources.commit(state.ticket);
      state = { kind: 'claimed', callbacks: listeners };
      signal?.removeEventListener('abort', destroy);
      return resources;
    },
    destroy,
  });
  function destroy() {
    if (state.kind === 'destroyed' || state.kind === 'claimed') return;
    state = { kind: 'destroyed' };
    signal?.removeEventListener('abort', destroy);
    resources.destroy();
  }
}

function sameDemand(a: PreparedResourceDemand, b: PreparedResourceDemand) {
  return a.required.length === b.required.length && a.required.every((key, i) => key === b.required[i]) &&
    (a.prewarm?.length ?? 0) === (b.prewarm?.length ?? 0) && (a.prewarm ?? []).every((key, i) => key === b.prewarm?.[i]);
}

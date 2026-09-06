import { createPreparedResidency } from '../rendering/prepared-residency.js';
import type { PreparedAssets, PreparedResidencyOptions } from '../rendering/prepared-residency.js';

type Residency = ReturnType<typeof createPreparedResidency>;
type Callbacks = Pick<PreparedResidencyOptions, 'onReady' | 'onWarmError' | 'onCleanupError'>;

/** Decode the next object's fixed asset bank without mounting a second scene. */
export interface PreparedResourceLease {
  readonly ready: Promise<void>;
  claim(assets: PreparedAssets, callbacks: Callbacks): Residency;
  destroy(): void;
}

export function prepareObjectResources(assets: PreparedAssets, {
  signal, createResources = createPreparedResidency,
}: { signal?: AbortSignal; createResources?: typeof createPreparedResidency } = {}): PreparedResourceLease {
  let claimed = false, destroyed = false;
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
  })();
  ready.catch(() => {});
  return Object.freeze({ ready,
    claim(expected: PreparedAssets, listeners: Callbacks) {
      if (destroyed || claimed || expected !== assets) throw new TypeError('Prepared resource lease is unavailable or belongs to another definition.');
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

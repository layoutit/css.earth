import type { PreparedFocusBank } from '@cssearth/renderer/universe/prepared-focus-bank.ts';
import { resolvePreparedFocus, resolvePreparedFocusDataset } from './prepared-focus.mts';
import type { FocusObject, PreparedFocusPolicy } from './prepared-focus.mts';

export interface PreparedFocusSource {
  focusBank(id: string): PreparedFocusBank | null;
}

/** One acquired target owns the object's identity, framing, datasets and its residency pin. */
export function acquirePreparedFocusTarget(object: FocusObject, { layer, policy, unavailableObjectIds, onChange, onError }: {
  layer: PreparedFocusSource; policy: PreparedFocusPolicy;
  unavailableObjectIds: readonly string[]; onChange(): void; onError(error: unknown): void;
}) {
  const id = object.id, unavailable = unavailableObjectIds.includes(id);
  const bank = unavailable ? null : layer.focusBank(id);
  let released = false;
  const unsubscribe = bank?.subscribe(() => { if (!released) onChange(); });
  return {
    id, object,
    get datasets() { return bank?.state() ?? null; },
    get focus() { return resolvePreparedFocus(object, policy); },
    prepare({ preload = false }: { preload?: boolean } = {}): Promise<void> | undefined {
      if (released || !bank || bank.state() && !preload) return;
      const loading = bank.load();
      // Explicit selections preload before flight. Restored image views can frame immediately
      // from their descriptor and let visibility admit their layers, as other retained banks do.
      if (bank.state()) {
        void loading.catch(error => { if (!released) onError(error); });
        return;
      }
      return loading.then(() => {
        if (!released && !bank.state()) throw new TypeError(`Prepared focus bank did not become ready: ${bank.objectId}`);
      });
    },
    resolveDataset(requested: string | null) {
      if (!released) return resolvePreparedFocusDataset(requested, bank?.state() ?? null, unavailable);
    },
    selectDataset(dataset: string) { if (!released) bank?.selectDataset(dataset); },
    release() { if (!released) { released = true; unsubscribe?.(); } },
  };
}

export type PreparedFocusTarget = ReturnType<typeof acquirePreparedFocusTarget>;

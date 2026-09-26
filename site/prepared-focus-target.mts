import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { PreparedFocusBank } from '@cssearth/renderer/universe/prepared-focus-bank.ts';
import { preparedFocusObjectId, resolvePreparedFocus, preparedFocusCitations, resolvePreparedFocusLens } from './prepared-focus.mts';
import type { PreparedFocusPolicy } from './prepared-focus.mts';

export interface PreparedFocusSource {
  resolveGalaxy(id: string): PreparedCatalogObject | null;
  focusBank(id: string): PreparedFocusBank | null;
}

/** One acquired target owns catalogue identity, framing, datasets and its residency pin. */
export function acquirePreparedFocusTarget(id: string, { layer, policy, sources, unavailableObjectIds, onChange, onError }: {
  layer: PreparedFocusSource; policy: PreparedFocusPolicy; sources(): readonly SpatialCatalogSource[];
  unavailableObjectIds: readonly string[]; onChange(): void; onError(error: unknown): void;
}) {
  const record = layer.resolveGalaxy(id);
  if (!record) throw new TypeError(`Unknown prepared galaxy focus: ${id}`);
  const objectId = preparedFocusObjectId(record);
  const unavailable = objectId !== undefined && unavailableObjectIds.includes(objectId);
  const bank = objectId && !unavailable ? layer.focusBank(objectId) : null;
  let released = false, citations: readonly SpatialCitation[] | undefined;
  const unsubscribe = bank?.subscribe(() => { if (!released) onChange(); });
  return {
    id, record,
    get datasets() { return bank?.state() ?? null; },
    get focus() { return resolvePreparedFocus(record, bank?.framingRadiusM(), policy); },
    get citations() { return citations ??= preparedFocusCitations(record, sources()); },
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
    resolveLens(requested: string | null) {
      if (!released) return resolvePreparedFocusLens(requested, bank?.state() ?? null, unavailable);
    },
    selectLens(lens: string) { if (!released) bank?.selectLens(lens); },
    release() { if (!released) { released = true; unsubscribe?.(); } },
  };
}

export type PreparedFocusTarget = ReturnType<typeof acquirePreparedFocusTarget>;

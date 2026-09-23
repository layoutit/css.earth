import { isPreparedCluster, isPreparedNebula, resolveSpatialCitation } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCatalogSource, SpatialCitation } from '@cssearth/catalog';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import type { PreparedFocusBank } from '../src/renderers/css/universe/prepared-focus-bank.js';

export interface PreparedFocusPolicy {
  metersPerParsec: number; defaultFocusRadiusM: number; minimumDistanceRadii: number; maximumDistanceM: number;
}
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
  const objectId = !isPreparedCluster(record) ? record.detailedObjectId : undefined;
  const bank = objectId && !unavailableObjectIds.includes(objectId) ? layer.focusBank(objectId) : null;
  let released = false, citations: readonly SpatialCitation[] | undefined;
  const unsubscribe = bank?.subscribe(() => { if (!released) onChange(); });
  return {
    id, record,
    get datasets() { return bank?.state() ?? null; },
    get focus(): PreparedNavigationFocus {
      const radius = record.presentation?.focusRadiusM ?? bank?.framingRadiusM() ??
        (!isPreparedCluster(record) && !isPreparedNebula(record) && record.halfLightRadius
          ? record.halfLightRadius.valuePc * policy.metersPerParsec * 3 : policy.defaultFocusRadiusM);
      return { id, positionM: record.positionM, framingRadiusM: radius,
        limits: { minimumDistanceM: radius * policy.minimumDistanceRadii, maximumDistanceM: policy.maximumDistanceM } };
    },
    get citations() {
      if (!citations) {
        const references = [record.skyPosition.sourceRef, record.distance.sourceRef,
          (isPreparedCluster(record) || isPreparedNebula(record) ? record.classification.sourceRef : record.membership.sourceRef)]
          .filter((reference): reference is string => Boolean(reference));
        citations = [...new Map(references.map(reference => {
          const citation = resolveSpatialCitation(reference, sources());
          if (!citation) throw new TypeError(`Unresolved prepared focus reference: ${reference}`);
          return [citation.id, citation] as const;
        })).values()];
      }
      return citations;
    },
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
      if (released || !bank) return;
      const state = bank.state(), lens = requested ?? state?.defaultLens;
      if (lens === undefined) return;
      if (state && !state.lenses.some(candidate => candidate.id === lens)) throw new TypeError(`Unknown prepared focus lens: ${lens}`);
      return lens;
    },
    selectLens(lens: string) { if (!released) bank?.selectLens(lens); },
    release() { if (!released) { released = true; unsubscribe?.(); } },
  };
}

export type PreparedFocusTarget = ReturnType<typeof acquirePreparedFocusTarget>;

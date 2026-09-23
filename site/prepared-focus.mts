import { isPreparedCluster, isPreparedNebula, resolveSpatialCitation } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCatalogSource } from '@cssearth/catalog';
import type { PreparedNavigationFocus } from '../src/renderers/css/navigation/prepared-focus.js';
import type { PreparedFocusDatasets } from '../src/renderers/css/universe/prepared-focus-bank.js';

export interface PreparedFocusPolicy {
  metersPerParsec: number; defaultFocusRadiusM: number; minimumDistanceRadii: number; maximumDistanceM: number;
}
export type PreparedFocusPresentation = PreparedFocusDatasets & { selectLens(lensId: string): void };

/** The catalogue names the detailed package, independently of whether its bank is resident. */
export function preparedFocusObjectId(record: PreparedCatalogObject): string | undefined {
  return isPreparedCluster(record) ? undefined : record.detailedObjectId;
}

export function resolvePreparedFocus(record: PreparedCatalogObject, bankRadiusM: number | undefined, policy: PreparedFocusPolicy): PreparedNavigationFocus {
  const radius = record.presentation?.focusRadiusM ?? bankRadiusM ??
    (!isPreparedCluster(record) && !isPreparedNebula(record) && record.halfLightRadius
      ? record.halfLightRadius.valuePc * policy.metersPerParsec * 3 : policy.defaultFocusRadiusM);
  return { id: record.id, positionM: record.positionM, framingRadiusM: radius,
    limits: { minimumDistanceM: radius * policy.minimumDistanceRadii, maximumDistanceM: policy.maximumDistanceM } };
}

export function preparedFocusCitations(record: PreparedCatalogObject, sources: readonly SpatialCatalogSource[]) {
  const references = [record.skyPosition.sourceRef, record.distance.sourceRef,
    (isPreparedCluster(record) || isPreparedNebula(record) ? record.classification.sourceRef : record.membership.sourceRef)]
    .filter((reference): reference is string => Boolean(reference));
  return [...new Map(references.map(reference => {
    const citation = resolveSpatialCitation(reference, sources);
    if (!citation) throw new TypeError(`Unresolved prepared focus reference: ${reference}`);
    return [citation.id, citation] as const;
  })).values()];
}

/** An unavailable package still opens its catalogue facts, including from an older dataset link. */
export function resolvePreparedFocusLens(requested: string | null,
  datasets: Pick<PreparedFocusDatasets, 'defaultLens' | 'lenses'> | null, unavailable = false): string | undefined {
  if (unavailable) return;
  if (!datasets) {
    if (requested !== null) throw new RangeError('Prepared focus datasets are unavailable.');
    return;
  }
  const lens = requested ?? datasets.defaultLens;
  if (!datasets.lenses.some(candidate => candidate.id === lens)) throw new RangeError(`Unknown prepared focus lens: ${lens}`);
  return lens;
}

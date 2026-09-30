import { isPreparedCluster, isPreparedNebula, resolveSpatialCitation } from '@cssearth/catalog';
import type { PreparedCatalogObject, SpatialCatalogSource } from '@cssearth/catalog';
import type { PreparedNavigationFocus } from '@cssearth/renderer/navigation/prepared-focus.ts';
import type { PreparedFocusDatasets } from '@cssearth/renderer/universe/prepared-focus-bank.ts';

export interface PreparedFocusPolicy {
  metersPerParsec: number; defaultFocusRadiusM: number; minimumDistanceRadii: number; maximumDistanceM: number;
}
export type PreparedFocusPresentation = PreparedFocusDatasets & { selectDataset(datasetId: string): void };

/** The catalogue names the detailed package, independently of whether its bank is resident. */
export function preparedFocusObjectId(record: PreparedCatalogObject): string | undefined {
  return record.detailedObjectId;
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
export function resolvePreparedFocusDataset(requested: string | null,
  datasets: Pick<PreparedFocusDatasets, 'defaultDataset' | 'datasets'> | null, unavailable = false): string | undefined {
  if (unavailable) return;
  if (!datasets) {
    if (requested !== null) throw new RangeError('Prepared focus datasets are unavailable.');
    return;
  }
  const dataset = requested ?? datasets.defaultDataset;
  if (!datasets.datasets.some(candidate => candidate.id === dataset)) throw new RangeError(`Unknown prepared focus dataset: ${dataset}`);
  return dataset;
}

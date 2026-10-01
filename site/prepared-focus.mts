import type { PreparedFocusObject } from '@cssearth/objects';
import type { PreparedNavigationFocus } from '@cssearth/renderer/navigation/prepared-focus.ts';
import type { PreparedFocusDatasets } from '@cssearth/renderer/universe/prepared-focus-bank.ts';

export interface PreparedFocusPolicy {
  metersPerParsec: number; defaultFocusRadiusM: number; minimumDistanceRadii: number; maximumDistanceM: number;
}
export type PreparedFocusPresentation = PreparedFocusDatasets & { selectDataset(datasetId: string): void };
/** An object the world's host draws, as the registry holds it: what a focus is framed on and its card presents. */
export type FocusObject = Pick<PreparedFocusObject, 'id' | 'name' | 'description' | 'aliases' | 'classification' | 'classificationLabel' | 'worldFrame'>;

/** The camera's focus on an object the host draws: at its world frame's origin, framed at the radius its package authors there. */
export function resolvePreparedFocus(object: FocusObject, policy: PreparedFocusPolicy): PreparedNavigationFocus {
  const radius = object.worldFrame.bodyRadiusM;
  return { id: object.id, positionM: object.worldFrame.originM, framingRadiusM: radius,
    limits: { minimumDistanceM: radius * policy.minimumDistanceRadii, maximumDistanceM: policy.maximumDistanceM } };
}

/** An unavailable package still opens its facts, including from an older dataset link. */
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

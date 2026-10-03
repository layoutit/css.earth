import { isRecord, requireArray, requireRecord } from '@cssearth/core';
import type { SurfaceFeatureCatalogDescriptor, SurfaceFeatureSelectionPlan } from './runtime-presentation-types.js';
import type { PreparedSurfaceFeatureCatalog } from './surface-feature-types.js';

export const PREPARED_FEATURES_SCHEMA = 'cssearth-prepared-features@1';
export interface PreparedFeaturesDescriptor extends SurfaceFeatureCatalogDescriptor,
  Pick<PreparedSurfaceFeatureCatalog, 'objectId' | 'source' | 'sourcePage' | 'license' | 'snapshotDate' | 'excluded' | 'skipped' | 'assumed' | 'duplicates' | 'traces'> {
  readonly schema: typeof PREPARED_FEATURES_SCHEMA;
  readonly selection?: SurfaceFeatureSelectionPlan;
  readonly totalCount?: number;
  readonly mapLeftEdgeLongitudeDeg: number;
}

/** The index reader and typecheck-input inventory reader historically admit different partial records.
 * Preserve both complete policies, including diagnostics; transport and inventory checks belong to callers. */
export function readPreparedFeaturePins(input: unknown, id: string, policy: 'index' | 'inventory' = 'index'): {
  readonly descriptor: Record<string, unknown>; readonly pins: readonly Record<string, unknown>[];
} {
  if (policy === 'inventory') {
    const descriptor = requireRecord(input);
    if (descriptor.schema !== PREPARED_FEATURES_SCHEMA) throw new TypeError(`Invalid feature-index input: ${id}`);
    const pins = [descriptor, ...descriptor.selection === undefined ? [] : requireArray(requireRecord(descriptor.selection).banks).map(value => requireRecord(value))];
    return { descriptor, pins };
  }
  if (!isRecord(input) || input.schema !== PREPARED_FEATURES_SCHEMA) throw new TypeError(`${id}: prepared features descriptor is invalid.`);
  const pins: Record<string, unknown>[] = [input];
  if (input.selection !== undefined) {
    const selection = input.selection;
    if (!isRecord(selection) || !Array.isArray(selection.banks) || !Number.isSafeInteger(selection.count) || Number(selection.count) < 1) throw new TypeError(`${id}: feature selection descriptor is invalid.`);
    for (const bank of selection.banks) {
      if (!isRecord(bank)) throw new TypeError(`${id}: feature selection bank is invalid.`);
      pins.push(bank);
    }
  }
  return { descriptor: input, pins };
}

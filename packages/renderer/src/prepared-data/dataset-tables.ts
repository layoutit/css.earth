import { mergePreparedDatasetTables, type ObjectRuntimeDefinition } from '@cssearth/objects';

import type { ObjectSelection } from '../runtime/object-contract.js';

/** The selection's dataset is declared but its tables have not arrived. */
export function preparedDatasetPending(definition: Pick<ObjectRuntimeDefinition, 'deferredDatasets'>, selection: Pick<ObjectSelection, 'datasetId'>) {
  return selection.datasetId !== null && definition.deferredDatasets?.includes(selection.datasetId) === true;
}

/** Publish validated data in place; resident resource leases retain the asset table's identity. */
export function adoptPreparedDatasetTables(definition: ObjectRuntimeDefinition, value: unknown, datasetId: string) {
  const merged = mergePreparedDatasetTables(definition, value, datasetId);
  Object.assign(definition.assets, { entries: merged.assets.entries });
  Object.assign(definition, { variants: merged.variants, deferredDatasets: merged.deferredDatasets,
    ...(merged.textureLevels ? { textureLevels: merged.textureLevels } : {}) });
}

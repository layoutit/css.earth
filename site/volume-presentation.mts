import { parseDatasetControl } from './prepared-panel-content.mts';
import { sourceArray, sourceId, sourceObject, sourceUnique } from '@cssearth/objects/sources';
import type { PreparedVolumeDatasetBank } from '@cssearth/objects';
import type { LineageSource } from '@cssearth/objects/provenance';

/** The shell consumes the same dataset shape for surfaces and prepared volumes. */
export function parsePreparedVolumePresentation(input: unknown,
  bank: Pick<PreparedVolumeDatasetBank, 'id' | 'defaultDataset'> & { datasets: readonly { id: string }[] },
  sources: readonly Pick<LineageSource, 'datasetId'>[]) {
  const value = sourceObject(input, ['schema', 'objectId', 'controls', 'defaultDataset']);
  if (value.schema !== 'cssearth-volume-presentation@2' || value.objectId !== bank.id)
    throw new TypeError('Prepared volume presentation has a different owner.');
  const controls = sourceArray(value.controls, parseDatasetControl);
  const defaultDataset = sourceId(value.defaultDataset);
  sourceUnique(controls.map(dataset => dataset.id), 'volume presentation dataset');
  if (defaultDataset !== bank.defaultDataset || controls.length !== bank.datasets.length
    || controls.some(dataset => !bank.datasets.some(prepared => prepared.id === dataset.id)))
    throw new TypeError('Prepared volume presentation does not match its rendered datasets.');
  for (const dataset of controls) {
    if (!sources.some(source => source.datasetId === dataset.id))
      throw new TypeError(`Missing dataset sources: ${bank.id}/${dataset.id}.`);
    if (!dataset.thumbnailUrl || !dataset.texture || dataset.texture.width <= 0 || dataset.texture.height <= 0)
      throw new TypeError(`Missing dataset preview: ${bank.id}/${dataset.id}.`);
  }
  return { objectId: bank.id, controls: [...controls], defaultDataset };
}

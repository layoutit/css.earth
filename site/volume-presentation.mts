import { parseDatasetLens } from './prepared-panel-content.mts';
import { sourceArray, sourceId, sourceObject, sourceUnique } from '../src/platform/source-catalog.mts';
import type { PreparedVolumeLensBank } from '@cssearth/renderer/volume/prepared-volume-lenses.ts';
import type { ProvenanceDocument } from '../src/platform/object-provenance.mts';

/** The shell consumes the same lens shape for surfaces and prepared volumes. */
export function parsePreparedVolumePresentation(input: unknown,
  bank: Pick<PreparedVolumeLensBank, 'id' | 'defaultLens'> & { lenses: readonly { id: string }[] },
  provenance: Pick<ProvenanceDocument, 'objectId' | 'sources' | 'products'>) {
  const value = sourceObject(input, ['schema', 'objectId', 'controls', 'defaultLens']);
  if (value.schema !== 'cssearth-volume-presentation@1' || value.objectId !== bank.id || provenance.objectId !== bank.id)
    throw new TypeError('Prepared volume presentation has a different owner.');
  const controls = sourceArray(value.controls, parseDatasetLens);
  const defaultLens = sourceId(value.defaultLens);
  sourceUnique(controls.map(lens => lens.id), 'volume presentation lens');
  if (defaultLens !== bank.defaultLens || controls.length !== bank.lenses.length
    || controls.some(lens => !bank.lenses.some(prepared => prepared.id === lens.id)))
    throw new TypeError('Prepared volume presentation does not match its rendered lenses.');
  for (const lens of controls) {
    if (!provenance.products.some(product => product.lensIds?.includes(lens.id))
      || !provenance.sources.some(source => source.lensId === lens.id))
      throw new TypeError(`Missing dataset provenance: ${bank.id}/${lens.id}.`);
    if (!lens.thumbnailUrl || !lens.texture || lens.texture.width <= 0 || lens.texture.height <= 0)
      throw new TypeError(`Missing dataset preview: ${bank.id}/${lens.id}.`);
  }
  return { objectId: bank.id, controls: [...controls], defaultLens };
}

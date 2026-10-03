import { sourceArray, sourceObject, sourceText } from '../sources/catalog.js';

export const VOLUME_SOURCE_MANIFEST_SCHEMA = 'cssearth-volume-source-manifest@2';

export type VolumeManifestReader = 'restoration' | 'context' | 'presentation';
/** The historic envelope admission policies; record collections are read separately by their consumers. */
export function parseVolumeSourceManifest(raw: unknown, options: { reader: VolumeManifestReader; objectId: string }): Record<string, unknown> | null {
  const value = sourceObject(raw);
  if (options.reader === 'restoration' && value.schema !== VOLUME_SOURCE_MANIFEST_SCHEMA) return null;
  if (value.schema !== VOLUME_SOURCE_MANIFEST_SCHEMA || value.pathBase !== 'repository') {
    const message = options.reader === 'context' ? `Invalid context manifest: ${options.objectId}`
      : options.reader === 'presentation' ? `Invalid volume source manifest: ${options.objectId}.`
        : `Invalid repository volume source manifest: ${options.objectId}.`;
    throw new TypeError(message);
  }
  return value;
}

export interface VolumeContextProduct {
  id: string; label: string; inputs: string[]; parents: never[]; datasetIds: never[];
  observationAttribution: 'none'; limitations: string[]; interpretation: { kind?: string; sourceKind?: string };
}
/** Context-product data admission, independent of lineage interpretation and filesystem reads. */
export function parseVolumeContextProducts(raw: unknown): readonly VolumeContextProduct[] {
  return sourceArray(raw, raw => {
    const value = sourceObject(raw), interpretation = sourceObject(value.interpretation);
    return { id: sourceText(value.id), label: sourceText(value.label), inputs: [...sourceArray(value.inputs, sourceText)], parents: [], datasetIds: [],
      observationAttribution: 'none' as const, limitations: [...sourceArray(value.limitations, sourceText)],
      interpretation: { ...(typeof interpretation.kind === 'string' ? { kind: interpretation.kind } : {}),
        ...(typeof interpretation.sourceKind === 'string' ? { sourceKind: interpretation.sourceKind } : {}) } };
  });
}

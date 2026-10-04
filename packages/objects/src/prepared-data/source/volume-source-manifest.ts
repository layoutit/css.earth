import { requireArray, requireRecord } from '@cssearth/core';
import { sourceArray, sourceObject, sourceText } from '../../sources/catalog.js';

export const VOLUME_SOURCE_MANIFEST_SCHEMA = 'cssearth-volume-source-manifest@2';

export type VolumeManifestReader = 'restoration' | 'context' | 'presentation';
type VolumeManifestOptions = { reader: VolumeManifestReader; objectId: string; policy?: 'presentation-source' };
export function parseVolumeSourceManifest(raw: unknown, options: VolumeManifestOptions & { reader: 'context' | 'presentation' }): Record<string, unknown>;
export function parseVolumeSourceManifest(raw: unknown, options: VolumeManifestOptions): Record<string, unknown> | null;
/** The historic envelope admission policies; record collections are read separately by their consumers. */
export function parseVolumeSourceManifest(raw: unknown, options: VolumeManifestOptions): Record<string, unknown> | null {
  const value = sourceObject(raw);
  if (options.reader === 'restoration' && value.schema !== VOLUME_SOURCE_MANIFEST_SCHEMA) return null;
  if (value.schema !== VOLUME_SOURCE_MANIFEST_SCHEMA || value.pathBase !== 'repository') {
    const message = options.reader === 'context' ? `Invalid context manifest: ${options.objectId}`
      : options.reader === 'presentation' ? `Invalid volume source manifest: ${options.objectId}.`
        : `Invalid repository volume source manifest: ${options.objectId}.`;
    throw new TypeError(message);
  }
  if (options.policy === 'presentation-source') {
    for (const key of Object.keys(value)) if (!['schema', 'pathBase', 'inputs', 'documents', 'generatedIntermediates'].includes(key))
      throw new TypeError(`Unexpected volume source manifest field: ${key}.`);
    requireArray(value.inputs).forEach(value => requireRecord(value));
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

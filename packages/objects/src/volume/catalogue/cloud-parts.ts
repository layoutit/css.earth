export const CLOUD_PARTS_SCHEMA = 'cssearth-cloud-parts@1';

export type CloudPartKind = 'extended' | 'diffuse' | 'compact';

export interface CloudPart {
  id: string;
  label: string;
  kind: CloudPartKind;
  signalFraction: number;
  defaultEnabled: boolean;
}

export interface CloudCatalogue {
  schema: typeof CLOUD_PARTS_SCHEMA;
  id: string;
  parts: (CloudPart & { leafIds: string[] })[];
  referenceLeafIds: string[];
}
export function parseCloudCatalogue(value: unknown, subjectId: string, leafIds: readonly string[]): CloudCatalogue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid cloud parts catalogue.');
  const data = value as CloudCatalogue;
  if (data.schema !== CLOUD_PARTS_SCHEMA || data.id !== subjectId || !Array.isArray(data.parts) || !data.parts.length ||
      !Array.isArray(data.referenceLeafIds) || !data.referenceLeafIds.length) throw new TypeError('Invalid cloud parts identity.');
  const leaves = new Set(leafIds), owned = new Set<string>(), parts = new Set<string>();
  if (leaves.size !== leafIds.length) throw new TypeError('Prepared cloud leaf IDs must be unique.');
  const claim = (ids: unknown) => {
    if (!Array.isArray(ids) || !ids.length) throw new TypeError('Cloud contribution has no prepared leaves.');
    for (const id of ids) {
      if (typeof id !== 'string' || !leaves.has(id) || owned.has(id)) throw new TypeError('Cloud contribution has invalid leaf ownership.');
      owned.add(id);
    }
  };
  claim(data.referenceLeafIds);
  let signal = 0;
  for (const part of data.parts) {
    if (!part || typeof part.id !== 'string' || !part.id || part.id === 'reference' || parts.has(part.id) ||
        typeof part.label !== 'string' || !part.label || !['extended', 'diffuse', 'compact'].includes(part.kind) ||
        typeof part.defaultEnabled !== 'boolean' || !Number.isFinite(part.signalFraction) || part.signalFraction < 0 ||
        part.signalFraction > 1) throw new TypeError('Invalid prepared cloud contribution.');
    parts.add(part.id); signal += part.signalFraction; claim(part.leafIds);
  }
  if (signal > 1.00001 || owned.size !== leaves.size) throw new TypeError('Cloud contribution coverage is incomplete or signal is duplicated.');
  return data;
}

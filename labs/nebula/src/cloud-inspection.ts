/** Retained prepared contribution selection and whole-composite display attenuation. */
import type { CloudBrightness, CloudPart } from './cloud-controls';

export interface CloudCatalogue {
  schema: 'cssearth-cloud-parts@1';
  id: string;
  parts: (CloudPart & { leafIds: string[] })[];
  referenceLeafIds: string[];
}
export const nativeCloudBrightness = (): CloudBrightness => ({ overall: 1, x: 1, y: 1, z: 1 });
export function validateCloudBrightness(value: CloudBrightness): CloudBrightness {
  if (!value || !['overall', 'x', 'y', 'z'].every(key => {
    const number = value[key as keyof CloudBrightness];
    return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1;
  })) throw new TypeError('Cloud brightness must contain finite overall/X/Y/Z attenuation between zero and one.');
  return { overall: value.overall, x: value.x, y: value.y, z: value.z };
}

/** Axis roots are painted X,Y,Z with cumulative source-over opacity, not raw weights. */
export function cloudCompositeOpacity(banks: readonly {
  axis: 'x' | 'y' | 'z'; opacity: number; visible: boolean;
}[], brightness: CloudBrightness): number {
  let transmission = 1, gain = 0;
  for (let i = banks.length - 1; i >= 0; i--) {
    const bank = banks[i]!;
    const alpha = bank.visible ? Math.max(0, Math.min(1, bank.opacity)) : 0;
    gain += alpha * transmission * brightness[bank.axis];
    transmission *= 1 - alpha;
  }
  return brightness.overall * gain;
}

export function parseCloudCatalogue(value: unknown, subjectId: string, leafIds: readonly string[]): CloudCatalogue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid cloud parts catalogue.');
  const data = value as CloudCatalogue;
  if (data.schema !== 'cssearth-cloud-parts@1' || data.id !== subjectId || !Array.isArray(data.parts) || !data.parts.length ||
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

export function createCloudInspection(catalogue: CloudCatalogue) {
  const allowed = new Set(catalogue.parts.map(part => part.id));
  const defaults = catalogue.parts.filter(part => part.defaultEnabled).map(part => part.id);
  const ownership = new Map(catalogue.referenceLeafIds.map(id => [id, 'reference']));
  for (const part of catalogue.parts) for (const id of part.leafIds) ownership.set(id, part.id);
  let enabled = new Set(defaults), reference = true;
  const selection = () => catalogue.parts.filter(part => enabled.has(part.id)).map(part => part.id);
  return {
    catalogue, selection,
    partForLeaf: (id: string) => ownership.get(id)!,
    includes(id: string) { const part = ownership.get(id); return reference ? part === 'reference' : part !== 'reference' && enabled.has(part!); },
    setSelection(ids: readonly string[]) {
      if (!Array.isArray(ids) || ids.some(id => !allowed.has(id)) || new Set(ids).size !== ids.length)
        throw new TypeError('Unknown or duplicate cloud selection.');
      enabled = new Set(ids);
      reference = defaults.length === enabled.size && defaults.every(id => enabled.has(id));
      return selection();
    },
    get isReference() { return reference; },
  };
}

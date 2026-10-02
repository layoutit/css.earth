import { type CloudCatalogue } from '@cssearth/objects';
/** Retained prepared contribution selection and whole-composite display attenuation. */
import type { CloudBrightness } from './cloud-types.ts';

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

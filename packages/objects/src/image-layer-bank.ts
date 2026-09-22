import { parseObjectDescriptor } from './parse.js';
import type { ObjectDescriptor } from './descriptor.js';
import { parseDensityVolumeFrame } from './density-volume.js';
import type { DensityVolumeFrame, DensityVolumePreparationReference } from './density-volume.js';

/** A spatial image model; the contract neither claims measured density nor selects a renderer. */
export interface ImageLayerBankDescriptor extends ObjectDescriptor {
  readonly type: 'image-layer-bank';
  readonly frame: DensityVolumeFrame;
  readonly preparation: DensityVolumePreparationReference;
}

export function parseImageLayerBankDescriptor(input: unknown): ImageLayerBankDescriptor {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'image-layer-bank') throw new TypeError('Object is not an image-layer bank.');
  const properties = descriptor.properties;
  if (Object.keys(properties).some(key => key !== 'frame' && key !== 'preparation')) throw new TypeError('Unknown image-layer property.');
  const frame = parseDensityVolumeFrame(properties.frame);
  const preparation = properties.preparation;
  if (!preparation || typeof preparation !== 'object' || Array.isArray(preparation)) throw new TypeError('Image layers need a preparation reference.');
  const reference = preparation as Record<string, unknown>;
  if (Object.keys(reference).some(key => key !== 'source') ||
      typeof reference.source !== 'string' || !reference.source || reference.source.startsWith('/') ||
      reference.source.split('/').includes('..') || /[\\\u0000-\u0020]/u.test(reference.source)) {
    throw new TypeError('Image-layer preparation must be a contained source.');
  }
  return Object.freeze({ ...descriptor, type: 'image-layer-bank', frame,
    preparation: Object.freeze({ source: reference.source }) });
}

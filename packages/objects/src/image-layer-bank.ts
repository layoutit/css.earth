import { parseObjectDescriptor } from './parse.js';
import type { ObjectDescriptor } from './descriptor.js';
import { parseDensityVolumeFrame } from './density-volume.js';
import type { DensityVolumeFrame, DensityVolumePreparationReference } from './density-volume.js';

/** A spatial image model; the contract neither claims measured density nor selects a renderer. */
export interface ImageLayerBankDescriptor extends ObjectDescriptor {
  readonly type: 'image-layer-bank';
  readonly frame: DensityVolumeFrame;
  readonly preparation: DensityVolumePreparationReference;
  /** The published catalogues drawn over the layers, placed on the galaxy's disc plane: each a bank at `prepared/<id>.bin`. */
  readonly cataloguePoints: readonly string[];
}

export function parseImageLayerBankDescriptor(input: unknown): ImageLayerBankDescriptor {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'image-layer-bank') throw new TypeError('Object is not an image-layer bank.');
  const properties = descriptor.properties;
  const unknown = Object.keys(properties).filter(key => !['frame', 'preparation', 'cataloguePoints', 'host'].includes(key));
  if (unknown.length) throw new TypeError(`Unknown image-layer property: ${unknown.join(', ')}.`);
  const cataloguePoints = properties.cataloguePoints ?? [];
  if (!Array.isArray(cataloguePoints) || !cataloguePoints.every(bank => typeof bank === 'string' && /^[a-z][a-z0-9-]*$/u.test(bank)) || new Set(cataloguePoints).size !== cataloguePoints.length) {
    throw new TypeError(`${descriptor.id}: image-layer cataloguePoints must be distinct bank ids, not ${JSON.stringify(cataloguePoints)}.`);
  }
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
    preparation: Object.freeze({ source: reference.source }), cataloguePoints: Object.freeze([...cataloguePoints as string[]]) });
}

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
  /** Its datasets and what each draws over its layers (`properties.overlays`, the first the default): by dataset id, the
   * banks at `prepared/<id>.bin` (cloud-points.ts, cloud-segments.ts) drawn while that dataset is selected. A bank without
   * it has one dataset, `optical`, with nothing over its layers. */
  readonly overlays: Readonly<Record<string, readonly string[]>>;
  /** The bank's light lies on walls or a surface around its middle (a nebula on its shell), not on one sheet seen from outside
   * (a galaxy's photograph): the world draws it around a body that stands inside it (`properties.surrounds`, the bake's). */
  readonly surrounds: boolean;
  /** The object the bank draws for (`properties.host`): a body inside that object stands inside a bank that surrounds. */
  readonly host: string | undefined;
}

/** The published catalogues a bank draws with itself (`properties.cataloguePoints`): each a bank at `prepared/<id>.bin`. */
export function bankCataloguePoints(descriptor: ObjectDescriptor): readonly string[] {
  const cataloguePoints = descriptor.properties.cataloguePoints ?? [];
  if (!Array.isArray(cataloguePoints) || !cataloguePoints.every(bank => typeof bank === 'string' && /^[a-z][a-z0-9-]*$/u.test(bank)) || new Set(cataloguePoints).size !== cataloguePoints.length) {
    throw new TypeError(`src/objects/${descriptor.id}/object.json properties.cataloguePoints must be distinct bank ids, not ${JSON.stringify(cataloguePoints)}.`);
  }
  return Object.freeze([...cataloguePoints as string[]]);
}

/** Dataset-selected cloud overlay banks, shared by image and volume banks. Each id resolves to `prepared/<id>.bin`.
 * Absence means no overlays; a declared map is nonempty and retains its dataset order. */
export function bankOverlays(descriptor: ObjectDescriptor): Readonly<Record<string, readonly string[]>> {
  const overlays = descriptor.properties.overlays;
  if (overlays === undefined) return Object.freeze({});
  const id = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]*$/u.test(value);
  if (!overlays || typeof overlays !== 'object' || Array.isArray(overlays) || !Object.keys(overlays).length ||
    !Object.entries(overlays).every(([dataset, banks]) => id(dataset) && Array.isArray(banks) && banks.every(id) && new Set(banks).size === banks.length))
    throw new TypeError(`src/objects/${descriptor.id}/object.json properties.overlays maps dataset ids to distinct bank ids, not ${JSON.stringify(overlays)}.`);
  return Object.freeze(Object.fromEntries(Object.entries(overlays as Record<string, string[]>).map(([dataset, banks]) => [dataset, Object.freeze([...banks])])));
}

export function parseImageLayerBankDescriptor(input: unknown): ImageLayerBankDescriptor {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'image-layer-bank') throw new TypeError('Object is not an image-layer bank.');
  const properties = descriptor.properties;
  const unknown = Object.keys(properties).filter(key => !['frame', 'preparation', 'cataloguePoints', 'overlays', 'host', 'surrounds'].includes(key));
  if (unknown.length) throw new TypeError(`Unknown image-layer property: ${unknown.join(', ')}.`);
  const cataloguePoints = bankCataloguePoints(descriptor), overlays = properties.overlays === undefined ? Object.freeze({ optical: Object.freeze([]) }) : bankOverlays(descriptor);
  if (properties.surrounds !== undefined && properties.surrounds !== true) throw new TypeError(`src/objects/${descriptor.id}/object.json properties.surrounds is true or absent, not ${JSON.stringify(properties.surrounds)}.`);
  if (properties.host !== undefined && (typeof properties.host !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(properties.host))) throw new TypeError(`src/objects/${descriptor.id}/object.json properties.host is an object id or absent, not ${JSON.stringify(properties.host)}.`);
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
    preparation: Object.freeze({ source: reference.source }), cataloguePoints, overlays, surrounds: properties.surrounds === true,
    host: typeof properties.host === 'string' ? properties.host : undefined });
}

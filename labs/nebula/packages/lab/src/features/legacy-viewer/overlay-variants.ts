/** Prepared 2D inspection layers share their original image's sky geometry and controls. */
export const overlayVariantsPath = 'labs/nebula/models/lmc/star-separation/variants.json';
export type ImageLayer = 'original' | 'diffuse' | 'stars';
export interface OverlayVariant {
  id: Exclude<ImageLayer, 'original'>; label: string; texturePath: string;
  widthPx: number; heightPx: number;
}
export interface OverlayVariants {
  imageId: string; receiptPath: string;
  layers: OverlayVariant[];
}
const path = (value: unknown): value is string => typeof value === 'string' && value.length > 0 &&
  !/^(?:[a-z]+:|\/)/i.test(value) && !value.split('/').includes('..') && !/[\\\u0000-\u0020?#]/.test(value);
export function parseOverlayVariants(input: unknown): OverlayVariants[] {
  const value = input as { schema?: string; variants?: OverlayVariants[] } | null;
  if (value?.schema !== 'cssearth-nebula-overlay-variants@1' || !Array.isArray(value.variants)) throw new TypeError('Invalid image layer catalogue.');
  const ids = new Set<string>();
  for (const row of value.variants) {
    if (!row || typeof row.imageId !== 'string' || !/^[a-z0-9-]+$/.test(row.imageId) || ids.has(row.imageId) ||
      !path(row.receiptPath) || !Array.isArray(row.layers) || !row.layers.length)
      throw new TypeError('Invalid prepared image layers.');
    ids.add(row.imageId);
    const layers = new Set<string>();
    for (const layer of row.layers) {
      if (!layer || !['diffuse', 'stars'].includes(layer.id) || layers.has(layer.id) || !layer.label ||
        !path(layer.texturePath) || !Number.isInteger(layer.widthPx) || layer.widthPx < 1 ||
        !Number.isInteger(layer.heightPx) || layer.heightPx < 1) throw new TypeError('Invalid prepared image layer.');
      layers.add(layer.id);
    }
  }
  return value.variants;
}
export function variantsForImage(rows: OverlayVariants[], image: { id: string; widthPx: number; heightPx: number }) {
  const row = rows.find(value => value.imageId === image.id);
  if (!row) return [];
  if (row.layers.some(layer =>
    Math.abs(layer.widthPx / layer.heightPx / (image.widthPx / image.heightPx) - 1) > .001))
    throw new TypeError(`Image layer source or pixel grid differs: ${image.id}`);
  return row.layers;
}

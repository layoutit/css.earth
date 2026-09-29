import type { AppliedStarLayers, StarRemovalResult } from './star-removal-types.ts';
import type { ImageLayer } from '@cssearth/nebula-lab/viewer/overlay-variants';

export interface SavedAppliedImage {
  imageId: string; resultId: string; nativeDimensions: [number, number]; layer: ImageLayer;
}
export interface RestoredAppliedImage extends Omit<SavedAppliedImage, 'resultId' | 'layer'> { applied: AppliedStarLayers; }
const storageKey = (imageId: string) => `cssearth-applied-star-image-nox-v2:${imageId}`;
export function readAppliedImage(imageId: string, storage: Pick<Storage, 'getItem'> = localStorage): SavedAppliedImage | null {
  try {
    const value = JSON.parse(storage.getItem(storageKey(imageId)) ?? 'null') as SavedAppliedImage | null;
    return value && value.imageId === imageId && typeof value.resultId === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value.resultId) && value.resultId.length <= 160 &&
      Array.isArray(value.nativeDimensions) && value.nativeDimensions.length === 2 && value.nativeDimensions.every(size => Number.isInteger(size) && size > 0) &&
      ['original', 'diffuse', 'stars'].includes(value.layer) ? value : null;
  } catch { return null; }
}
export function writeAppliedImage(result: Pick<StarRemovalResult, 'imageId' | 'nativeDimensions' | 'applied'>,
  layer: ImageLayer, storage: Pick<Storage, 'setItem'> = localStorage) {
  if (!result.applied) return;
  const value: SavedAppliedImage = { imageId: result.imageId, resultId: result.applied.resultId, nativeDimensions: result.nativeDimensions, layer };
  try { storage.setItem(storageKey(value.imageId), JSON.stringify(value)); } catch { /* Current prepared image remains available in this session. */ }
}
export function rememberAppliedLayer(imageId: string, layer: ImageLayer) {
  const saved = readAppliedImage(imageId); if (!saved) return;
  try { localStorage.setItem(storageKey(imageId), JSON.stringify({ ...saved, layer })); } catch { /* Session selection still works. */ }
}
export function verifyRestoredImage(saved: SavedAppliedImage, result: RestoredAppliedImage) {
  if (result.imageId !== saved.imageId || result.nativeDimensions.join() !== saved.nativeDimensions.join() || result.applied?.resultId !== saved.resultId)
    throw new TypeError('Saved removal belongs to a different source image.');
}

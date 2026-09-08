import type { AppliedSamplingLayers, SamplingResult } from './star-sampling-types';
import type { ImageLayer } from './overlay-variants';

export interface SavedAppliedImage {
  imageId: string; resultId: string; sourceSha256: string; sourcePreviewSha256: string;
  nativeDimensions: [number, number]; layer: ImageLayer;
}
export interface RestoredAppliedImage extends Omit<SavedAppliedImage, 'resultId' | 'layer'> { applied: AppliedSamplingLayers; }
const storageKey = (imageId: string) => `cssearth-applied-star-image-v1:${imageId}`;
export function readAppliedImage(imageId: string, previewSha: string, storage: Pick<Storage, 'getItem'> = localStorage): SavedAppliedImage | null {
  try {
    const value = JSON.parse(storage.getItem(storageKey(imageId)) ?? 'null') as SavedAppliedImage | null;
    return value && value.imageId === imageId && value.sourcePreviewSha256 === previewSha &&
      /^[a-f0-9]{64}$/.test(value.sourceSha256) && typeof value.resultId === 'string' && value.resultId.length > 0 && value.resultId.length <= 160 &&
      Array.isArray(value.nativeDimensions) && value.nativeDimensions.length === 2 && value.nativeDimensions.every(size => Number.isInteger(size) && size > 0) &&
      ['original', 'diffuse', 'stars'].includes(value.layer) ? value : null;
  } catch { return null; }
}
export function writeAppliedImage(result: Pick<SamplingResult, 'imageId' | 'sourceSha256' | 'sourcePreviewSha256' | 'nativeDimensions' | 'applied'>,
  layer: ImageLayer, storage: Pick<Storage, 'setItem'> = localStorage) {
  if (!result.applied || !result.sourcePreviewSha256) return;
  const value: SavedAppliedImage = { imageId: result.imageId, resultId: result.applied.resultId, sourceSha256: result.sourceSha256,
    sourcePreviewSha256: result.sourcePreviewSha256, nativeDimensions: result.nativeDimensions, layer };
  try { storage.setItem(storageKey(value.imageId), JSON.stringify(value)); } catch { /* Current prepared image remains available in this session. */ }
}
export function rememberAppliedLayer(imageId: string, previewSha: string, layer: ImageLayer) {
  const saved = readAppliedImage(imageId, previewSha); if (!saved) return;
  try { localStorage.setItem(storageKey(imageId), JSON.stringify({ ...saved, layer })); } catch { /* Session selection still works. */ }
}
export function verifyRestoredImage(saved: SavedAppliedImage, result: RestoredAppliedImage) {
  if (result.imageId !== saved.imageId || result.sourceSha256 !== saved.sourceSha256 || result.sourcePreviewSha256 !== saved.sourcePreviewSha256 ||
    result.nativeDimensions.join() !== saved.nativeDimensions.join() || result.applied?.resultId !== saved.resultId)
    throw new TypeError('Saved removal belongs to a different source image.');
}

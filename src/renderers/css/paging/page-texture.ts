import { composePreparedProjectiveTransform } from '../rendering/prepared-projective-texture-leaf.js';
import type { PreparedPage } from './types.js';

/** Publish final prepared sampling addresses into an existing page slot. */
export function publishPreparedPageTexture(leaf: HTMLElement, clippedImage: HTMLElement | null,
  page: PreparedPage, url: string, rasterScale: number, paintLayer = 0): void {
  if (page.imageMatrix && !clippedImage) throw new Error('The prepared page requires a clipping template.');
  // Prepared layer order takes precedence over resolution within that layer.
  // Reserve a 16-bit level range per layer inside CSS's signed 32-bit z-index;
  // an independently numbered observation pyramid must stay above its imagery.
  if (!Number.isInteger(paintLayer) || paintLayer < 0 || paintLayer > 32767 ||
      !Number.isInteger(page.level) || page.level < 0 || page.level > 65535) {
    throw new Error('Prepared page paint order exceeds its integer range.');
  }
  leaf.style.zIndex = String(paintLayer * 65536 + page.level);
  leaf.style.transform = composePreparedProjectiveTransform(page.frameMatrix, page.textureMatrix);
  // The optional image samples through its authored image matrix and is clipped
  // in the original prepared page rectangle before that rectangle is projected.
  leaf.style.overflow = page.imageMatrix ? 'hidden' : 'visible';
  leaf.style.transformStyle = page.imageMatrix ? 'flat' : 'preserve-3d';
  leaf.style.backgroundImage = page.imageMatrix ? 'none' : `url("${url}")`;
  const image = page.imageMatrix ? clippedImage! : leaf;
  image.style.backgroundSize = page.textureBackgroundSize ?? `${32 * rasterScale}px ${32 * rasterScale}px`;
  image.style.backgroundPosition = page.textureBackgroundPosition ?? '0px 0px';
  if (page.imageMatrix) {
    clippedImage!.style.transform = `matrix3d(${page.imageMatrix})`;
    clippedImage!.style.backgroundImage = `url("${url}")`;
  } else if (clippedImage) {
    clippedImage.style.visibility = 'hidden';
    clippedImage.style.backgroundImage = 'none';
  }
}

import { applyPreparedProjectiveLayout, scalePreparedBackgroundAddresses, scalePreparedPixelLengths, composePreparedProjectiveTransform } from '../prepared-data/projective-layout.js';
import type { PreparedProjectiveTextureLeaf, PreparedProjectiveLayout } from '../prepared-data/projective-layout.js';
const PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA = 'polycss-prepared-projective-texture-layer@1';

export function createPreparedProjectiveTextureLeaf(prepared: PreparedProjectiveTextureLeaf, layout: PreparedProjectiveLayout | null = null) {
  const leaf = document.createElement(prepared.tag ?? "s");
  if (prepared.className) leaf.className = prepared.className;
  leaf.style.cssText = prepared.style;
  const layer = prepared.projectiveTextureLayer;
  if (!layer) return leaf;
  if (layer.schema !== PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA) {
    throw new TypeError("Prepared projective texture layer is incompatible.");
  }
  const rasterScale = layer.rasterScale ?? 1;
  applyPreparedProjectiveLayout(leaf.style, layout, rasterScale);

  // Transport the prepared homography on the raster itself. A transformed
  // descendant can escape its CSS paint bounds under a physical perspective.
  leaf.style.transform = composePreparedProjectiveTransform(layer.frameMatrix, layer.textureMatrix);
  leaf.style.transformStyle = "preserve-3d";
  leaf.style.transformOrigin = "0 0";
  scalePreparedBackgroundAddresses(leaf.style, rasterScale);
  leaf.style.backgroundRepeat = "no-repeat";
  leaf.style.backgroundOrigin = "border-box";
  leaf.style.backgroundClip = "border-box";
  for (const property of [
    "--polycss-atlas-width",
    "--polycss-atlas-height",
  ]) {
    const value = leaf.style.getPropertyValue(property);
    if (value) {
      leaf.style.setProperty(
        property,
        scalePreparedPixelLengths(value, rasterScale),
      );
    }
  }
  if (leaf.style.width) {
    leaf.style.width = scalePreparedPixelLengths(leaf.style.width, rasterScale);
  }
  if (leaf.style.height) {
    leaf.style.height = scalePreparedPixelLengths(leaf.style.height, rasterScale);
  }
  return leaf;
}

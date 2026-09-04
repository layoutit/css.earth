const PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA =
  "polycss-prepared-projective-texture-layer@1";

export function scalePreparedPixelLengths(value, scale) {
  if (!Number.isFinite(scale) || scale < 1) {
    throw new RangeError("Prepared pixel scale must be at least one.");
  }
  return String(value).replace(
    /(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px\b/gi,
    (_match, number) => `${Number(number) * scale}px`,
  );
}

export function scalePreparedBackgroundAddresses(style, scale) {
  const references = new Set();
  for (const value of [style.backgroundPosition, style.backgroundSize]) {
    for (const match of String(value).matchAll(/var\(\s*(--[\w-]+)/g)) {
      references.add(match[1]);
    }
  }
  for (const property of references) {
    const value = style.getPropertyValue(property);
    if (value) {
      style.setProperty(property, scalePreparedPixelLengths(value, scale));
    }
  }
  style.backgroundPosition = scalePreparedPixelLengths(
    style.backgroundPosition,
    scale,
  );
  style.backgroundSize = scalePreparedPixelLengths(style.backgroundSize, scale);
}

export function createPreparedProjectiveTextureLeaf(prepared) {
  const leaf = document.createElement(prepared.tag ?? "s");
  if (prepared.className) leaf.className = prepared.className;
  leaf.style.cssText = prepared.style;
  const layer = prepared.projectiveTextureLayer;
  if (!layer) return leaf;
  if (layer.schema !== PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA) {
    throw new TypeError("Prepared projective texture layer is incompatible.");
  }
  const rasterScale = layer.rasterScale ?? 1;
  if (!Number.isFinite(rasterScale) || rasterScale < 1) {
    throw new TypeError("Prepared projective texture raster scale is invalid.");
  }

  const texture = document.createElement("span");
  texture.className = "polycss-projective-texture";
  texture.style.cssText = prepared.style;
  texture.style.position = "absolute";
  texture.style.inset = "0 auto auto 0";
  texture.style.display = "block";
  texture.style.width = "100%";
  texture.style.height = "100%";
  texture.style.margin = "0";
  texture.style.padding = "0";
  texture.style.border = "0";
  texture.style.lineHeight = "0";
  texture.style.textDecoration = "none";
  texture.style.transform = `matrix3d(${layer.textureMatrix})`;
  texture.style.transformOrigin = "0 0";
  texture.style.transformStyle = "flat";
  texture.style.backfaceVisibility = "visible";
  texture.style.backgroundImage = "inherit";
  scalePreparedBackgroundAddresses(texture.style, rasterScale);
  texture.style.backgroundRepeat = "no-repeat";
  texture.style.backgroundOrigin = "border-box";
  texture.style.backgroundClip = "border-box";
  texture.style.pointerEvents = "none";

  leaf.style.transform = `matrix3d(${layer.frameMatrix})`;
  leaf.style.transformStyle = "flat";
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
  leaf.style.backgroundPosition = "0px 0px";
  leaf.style.backgroundSize = "0px 0px";
  leaf.style.backgroundRepeat = "no-repeat";
  leaf.appendChild(texture);
  return leaf;
}

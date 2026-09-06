export interface PreparedProjectiveLayout { width?: string; height?: string; backgroundSize?: string; }
export interface PreparedProjectiveTextureLeaf {
  tag?: string; className?: string; style: string;
  projectiveTextureLayer?: { schema: string; rasterScale?: number; textureMatrix: string | readonly number[]; frameMatrix: string | readonly number[] };
}

const PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA =
  "polycss-prepared-projective-texture-layer@1";

export function scalePreparedPixelLengths(value: string | number, scale: number) {
  if (!Number.isFinite(scale) || scale < 1) {
    throw new RangeError("Prepared pixel scale must be at least one.");
  }
  return String(value).replace(
    /(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px\b/gi,
    (_match, number) => `${Number(number) * scale}px`,
  );
}

export function scalePreparedBackgroundAddresses(style: CSSStyleDeclaration, scale: number) {
  const references = new Set<string>();
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

export function applyPreparedProjectiveLayout(style: CSSStyleDeclaration, layout: PreparedProjectiveLayout | null, rasterScale: number) {
  if (!Number.isFinite(rasterScale) || rasterScale < 1) {
    throw new TypeError("Prepared projective texture raster scale is invalid.");
  }
  for (const property of ["width", "height", "backgroundSize"] as const) {
    const variable = property === "backgroundSize" ? "" : style.getPropertyValue?.(`--polycss-atlas-${property}`);
    if (!style[property] && !variable && layout?.[property]) style[property] = layout[property];
    const preparedValue = style[property] || variable;
    if (rasterScale > 1 && (!preparedValue || preparedValue === "auto")) {
      throw new TypeError(`Scaled projective leaf requires explicit prepared ${property}.`);
    }
  }
}

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

/** Matrix transport only: multiply the two authored factors without resampling. */
export function composePreparedProjectiveTransform(frame: string | readonly number[], texture: string | readonly number[]): string {
  const parse = (value: string | readonly number[]) => {
    const matrix = typeof value === 'string' ? value.split(',').map(Number) : Array.from(value);
    if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value))) throw new TypeError('Invalid prepared projective matrix.');
    return matrix;
  };
  const a = parse(frame), b = parse(texture);
  const product = Array.from({ length: 16 }, (_, index) => {
    const row = index % 4, column = Math.floor(index / 4);
    return a[row] * b[column * 4] + a[row + 4] * b[column * 4 + 1] +
      a[row + 8] * b[column * 4 + 2] + a[row + 12] * b[column * 4 + 3];
  });
  if (product.some(value => !Number.isFinite(value))) throw new TypeError('Prepared projective matrix overflowed.');
  return `matrix3d(${product.join(',')})`;
}

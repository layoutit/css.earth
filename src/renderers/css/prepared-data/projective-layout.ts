export interface PreparedProjectiveStyle {
  width: string; height: string; backgroundPosition: string; backgroundSize: string;
  getPropertyValue(property: string): string;
  setProperty(property: string, value: string): void;
}
export interface PreparedProjectiveLayout { width?: string; height?: string; backgroundSize?: string; }
export interface PreparedProjectiveTextureLeaf {
  tag?: string; className?: string; style: string;
  projectiveTextureLayer?: { schema: string; rasterScale?: number; textureMatrix: string | readonly number[]; frameMatrix: string | readonly number[];
    /** Preparation composes this stepped outset into the leaf transform; runtime transports the result. */
    seamOutset?: { property: string; scale: readonly number[] } };
}

export function scalePreparedPixelLengths(value: string | number, scale: number) {
  if (!Number.isFinite(scale) || scale < 1) {
    throw new RangeError("Prepared pixel scale must be at least one.");
  }
  return String(value).replace(
    /(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px\b/gi,
    (_match, number) => `${Number(number) * scale}px`,
  );
}

export function scalePreparedBackgroundAddresses(style: Pick<PreparedProjectiveStyle, "backgroundPosition" | "backgroundSize" | "getPropertyValue" | "setProperty">, scale: number) {
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

export function applyPreparedProjectiveLayout(style: Pick<PreparedProjectiveStyle, "width" | "height" | "backgroundSize"> & Partial<Pick<PreparedProjectiveStyle, "getPropertyValue">>, layout: PreparedProjectiveLayout | null, rasterScale: number) {
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

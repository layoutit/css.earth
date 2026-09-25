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
  // Below one too: a leaf showing a 1x image shrinks its box to two texels per CSS pixel (leafRasterScale).
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError(`Prepared pixel scale must be positive, not ${scale}.`);
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
  if (!Number.isFinite(rasterScale) || rasterScale <= 0) {
    throw new TypeError(`Prepared projective texture raster scale must be positive, not ${rasterScale}.`);
  }
  for (const property of ["width", "height", "backgroundSize"] as const) {
    const variable = property === "backgroundSize" ? "" : style.getPropertyValue?.(`--polycss-atlas-${property}`);
    if (!style[property] && !variable && layout?.[property]) style[property] = layout[property];
    const preparedValue = style[property] || variable;
    if (rasterScale !== 1 && (!preparedValue || preparedValue === "auto")) {
      throw new TypeError(`Scaled projective leaf requires explicit prepared ${property}.`);
    }
  }
}

export interface RgbaBounds { x: number; y: number; width: number; height: number }
function nonTransparentRgbaBounds({ rgba, width, height }: {rgba: Uint8Array; width: number; height: number}) {
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }
  if (maximumX < minimumX || maximumY < minimumY) {
    throw new Error("Prepared RGBA image contains no visible texels.");
  }
  return Object.freeze({
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  });
}

function expandBounds({ bounds, width, height, gutter }: {bounds: RgbaBounds; width: number; height: number; gutter: number}) {
  const x = Math.max(0, bounds.x - gutter);
  const y = Math.max(0, bounds.y - gutter);
  const right = Math.min(width, bounds.x + bounds.width + gutter);
  const bottom = Math.min(height, bounds.y + bounds.height + gutter);
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

export function extractRgbaBounds({ rgba, width, bounds }: {rgba: Buffer; width: number; bounds: RgbaBounds}) {
  const output = Buffer.alloc(bounds.width * bounds.height * 4);
  const sourceRowBytes = bounds.width * 4;
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceOffset = ((bounds.y + row) * width + bounds.x) * 4;
    rgba.copy(
      output,
      row * sourceRowBytes,
      sourceOffset,
      sourceOffset + sourceRowBytes,
    );
  }
  return output;
}

export function visibleRgbaMatches(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  for (let offset = 0; offset < left.length; offset += 4) {
    if (left[offset + 3] !== right[offset + 3]) return false;
    if (left[offset + 3] === 0) continue;
    if (left[offset] !== right[offset] ||
        left[offset + 1] !== right[offset + 1] ||
        left[offset + 2] !== right[offset + 2]) return false;
  }
  return true;
}

export function cropTransparentRgba({ rgba, width, height, gutter }: {rgba: Buffer; width: number; height: number; gutter: number}) {
  const bounds = expandBounds({
    bounds: nonTransparentRgbaBounds({ rgba, width, height }),
    width,
    height,
    gutter,
  });
  return Object.freeze({
    rgba: extractRgbaBounds({ rgba, width, bounds }),
    bounds,
  });
}

/** Crop a prepared plate (two texels per layout pixel) to the visible bounds of its layout-size and
 * prepared renderings, expanded by the transparent gutter; the leaf keeps that layout crop. */
export function preparedTransparentCrop({
  layout,
  prepared,
  textureSize,
  gutter,
}: {layout: Buffer; prepared: Buffer; textureSize: number; gutter: number}) {
  const visible = nonTransparentRgbaBounds({
    rgba: layout,
    width: textureSize,
    height: textureSize,
  });
  const visible2x = nonTransparentRgbaBounds({
    rgba: prepared,
    width: textureSize * 2,
    height: textureSize * 2,
  });
  const minimumX = Math.min(visible.x, Math.floor(visible2x.x / 2));
  const minimumY = Math.min(visible.y, Math.floor(visible2x.y / 2));
  const maximumX = Math.max(
    visible.x + visible.width,
    Math.ceil((visible2x.x + visible2x.width) / 2),
  );
  const maximumY = Math.max(
    visible.y + visible.height,
    Math.ceil((visible2x.y + visible2x.height) / 2),
  );
  const bounds = expandBounds({
    bounds: {
      x: minimumX,
      y: minimumY,
      width: maximumX - minimumX,
      height: maximumY - minimumY,
    },
    width: textureSize,
    height: textureSize,
    gutter,
  });
  const preparedBounds = Object.freeze({
    x: bounds.x * 2,
    y: bounds.y * 2,
    width: bounds.width * 2,
    height: bounds.height * 2,
  });
  return Object.freeze({
    bounds,
    preparedBounds,
    rgba: extractRgbaBounds({
      rgba: prepared,
      width: textureSize * 2,
      bounds: preparedBounds,
    }),
  });
}

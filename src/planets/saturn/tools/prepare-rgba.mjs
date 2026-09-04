function nonTransparentRgbaBounds({ rgba, width, height }) {
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
    throw new Error("Prepared Saturn RGBA image contains no visible texels.");
  }
  return Object.freeze({
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  });
}

function expandBounds({ bounds, width, height, gutter }) {
  const x = Math.max(0, bounds.x - gutter);
  const y = Math.max(0, bounds.y - gutter);
  const right = Math.min(width, bounds.x + bounds.width + gutter);
  const bottom = Math.min(height, bounds.y + bounds.height + gutter);
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

export function extractRgbaBounds({ rgba, width, bounds }) {
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

export function visibleRgbaMatches(left, right) {
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

export function cropTransparentRgba({ rgba, width, height, gutter }) {
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

export function responsiveTransparentCrop({
  rgba,
  rgba2x,
  textureSize,
  gutter,
}) {
  const visible = nonTransparentRgbaBounds({
    rgba,
    width: textureSize,
    height: textureSize,
  });
  const visible2x = nonTransparentRgbaBounds({
    rgba: rgba2x,
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
  const bounds2x = Object.freeze({
    x: bounds.x * 2,
    y: bounds.y * 2,
    width: bounds.width * 2,
    height: bounds.height * 2,
  });
  return Object.freeze({
    bounds,
    bounds2x,
    rgba: extractRgbaBounds({ rgba, width: textureSize, bounds }),
    rgba2x: extractRgbaBounds({
      rgba: rgba2x,
      width: textureSize * 2,
      bounds: bounds2x,
    }),
  });
}

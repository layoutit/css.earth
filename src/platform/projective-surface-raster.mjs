function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

export const MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE = 32;

export const PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA =
  "polycss-prepared-projective-texture-layer@1";

export function prepareProjectiveTextureLayer(matrixValue, rasterScale = 1) {
  const matrix = String(matrixValue).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value)) ||
      matrix[15] === 0) {
    throw new TypeError("Projective texture matrix is invalid.");
  }
  if (!Number.isFinite(rasterScale) || rasterScale < 1) {
    throw new RangeError("Projective texture raster scale must be at least one.");
  }
  const perspectiveX = matrix[3];
  const perspectiveY = matrix[7];
  const translation = [
    matrix[12] / matrix[15],
    matrix[13] / matrix[15],
    matrix[14] / matrix[15],
  ];
  const frameMatrix = [
    (matrix[0] - perspectiveX * translation[0]) / rasterScale,
    (matrix[1] - perspectiveX * translation[1]) / rasterScale,
    (matrix[2] - perspectiveX * translation[2]) / rasterScale,
    0,
    (matrix[4] - perspectiveY * translation[0]) / rasterScale,
    (matrix[5] - perspectiveY * translation[1]) / rasterScale,
    (matrix[6] - perspectiveY * translation[2]) / rasterScale,
    0,
    matrix[8], matrix[9], matrix[10], 0,
    translation[0], translation[1], translation[2], 1,
  ];
  const textureMatrix = [
    1, 0, 0, perspectiveX / rasterScale,
    0, 1, 0, perspectiveY / rasterScale,
    0, 0, 1, 0,
    0, 0, 0, matrix[15],
  ];
  return Object.freeze({
    schema: PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA,
    rasterScale,
    frameMatrix: serializeFiniteMatrix(frameMatrix),
    textureMatrix: serializeFiniteMatrix(textureMatrix),
  });
}

function serializeFiniteMatrix(matrix) {
  return matrix.map((value) => Object.is(value, -0) ? "0" : String(value))
    .join(",");
}

export function fitProjectiveTextureGeometryToStableLayout(
  geometry,
  maximumSize = MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE,
) {
  if (!geometry || geometry.projection !== "projective" ||
      !Number.isFinite(geometry.leafWidth) || geometry.leafWidth <= 0 ||
      !Number.isFinite(geometry.leafHeight) || geometry.leafHeight <= 0 ||
      !Number.isFinite(maximumSize) || maximumSize <= 0 ||
      !Array.isArray(geometry.backgroundPosition) ||
      !Array.isArray(geometry.backgroundSize) ||
      geometry.backgroundPosition.length !== 2 ||
      geometry.backgroundSize.length !== 2 ||
      [...geometry.backgroundPosition, ...geometry.backgroundSize].some(
        (value) => !Number.isFinite(value),
      )) {
    throw new TypeError("Projective texture geometry is invalid.");
  }
  const layoutScale = Math.min(
    1,
    maximumSize / geometry.leafWidth,
    maximumSize / geometry.leafHeight,
  );
  if (layoutScale === 1) return geometry;
  const matrix = String(geometry.matrix).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new TypeError("Projective texture matrix is invalid.");
  }
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) {
    matrix[index] /= layoutScale;
  }
  return Object.freeze({
    ...geometry,
    matrix: matrix.map((value) => Number(value.toFixed(9))).join(","),
    leafWidth: geometry.leafWidth * layoutScale,
    leafHeight: geometry.leafHeight * layoutScale,
    backgroundPosition: Object.freeze(geometry.backgroundPosition.map(
      (value) => value * layoutScale,
    )),
    backgroundSize: Object.freeze(geometry.backgroundSize.map(
      (value) => value * layoutScale,
    )),
  });
}

export function createProjectiveSurfaceRasterLayout({
  width,
  height,
  bandCount,
  bands,
  gutter,
}) {
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");
  assertPositiveInteger(gutter, "gutter");
  let normalizedBands;
  if (bands) {
    if (!Array.isArray(bands) || bands.length === 0) {
      throw new RangeError("bands must contain at least one source row range.");
    }
    normalizedBands = bands.map(({ y, height: bandHeight }, index) => {
      if (!Number.isInteger(y) || y < 0 || !Number.isInteger(bandHeight) ||
          bandHeight <= 0 || y + bandHeight > height) {
        throw new RangeError(`band ${index} is outside the source raster.`);
      }
      return { y, height: bandHeight };
    });
    bandCount = normalizedBands.length;
  } else {
    assertPositiveInteger(bandCount, "bandCount");
    if (height % bandCount !== 0) {
      throw new RangeError("height must divide evenly into latitude bands.");
    }
    const bandHeight = height / bandCount;
    normalizedBands = Array.from({ length: bandCount }, (_, index) => ({
      y: index * bandHeight,
      height: bandHeight,
    }));
  }
  let packedY = 0;
  const packedBands = Object.freeze(normalizedBands.map((band) => {
    const packed = Object.freeze({
      ...band,
      packedY: packedY + gutter,
    });
    packedY += band.height + gutter * 2;
    return packed;
  }));
  const uniformBandHeight = packedBands.every(
    (band) => band.height === packedBands[0].height,
  ) ? packedBands[0].height : null;
  return Object.freeze({
    width,
    height,
    bandCount,
    bandHeight: uniformBandHeight,
    bands: packedBands,
    gutter,
    bandStride: uniformBandHeight === null
      ? null
      : uniformBandHeight + gutter * 2,
    packedWidth: width + gutter * 2,
    packedHeight: packedY,
  });
}

export function packProjectiveSurfaceRaster(
  source,
  { width, height, channels = 4, bandCount, bands, gutter },
) {
  const layout = createProjectiveSurfaceRasterLayout({
    width,
    height,
    bandCount,
    bands,
    gutter,
  });
  assertPositiveInteger(channels, "channels");
  if (source.length !== width * height * channels) {
    throw new RangeError("source byte length does not match its dimensions.");
  }

  const output = Buffer.alloc(
    layout.packedWidth * layout.packedHeight * channels,
  );
  for (const band of layout.bands) {
    for (
      let localY = -gutter;
      localY < band.height + gutter;
      localY += 1
    ) {
      const sourceY = Math.max(0, Math.min(
        height - 1,
        band.y + band.height - 1 - localY,
      ));
      const outputY = band.packedY + localY;
      for (let outputX = 0; outputX < layout.packedWidth; outputX += 1) {
        const sourceX = (outputX - gutter + width) % width;
        const sourceOffset = (sourceY * width + sourceX) * channels;
        const outputOffset = (
          outputY * layout.packedWidth + outputX
        ) * channels;
        source.copy(
          output,
          outputOffset,
          sourceOffset,
          sourceOffset + channels,
        );
      }
    }
  }

  return Object.freeze({ data: output, ...layout });
}

export function createProjectiveSurfaceRasterPresentation({
  sourceWidth,
  sourceHeight,
  sourceRect,
  addressSourceWidth = sourceWidth,
  addressSourceHeight = sourceHeight,
  addressSourceRect = sourceRect,
  backgroundPosition,
  backgroundSize,
  leafWidth,
  leafHeight,
  bandCount,
  bands,
  gutter,
  overscan = 1,
}) {
  const layout = createProjectiveSurfaceRasterLayout({
    width: sourceWidth,
    height: sourceHeight,
    bandCount,
    bands,
    gutter,
  });
  if (!Number.isFinite(overscan) || overscan < 0 || overscan > gutter) {
    throw new RangeError("overscan must be non-negative and no larger than gutter.");
  }
  assertPositiveInteger(addressSourceWidth, "addressSourceWidth");
  assertPositiveInteger(addressSourceHeight, "addressSourceHeight");
  for (const [name, value] of Object.entries({
    sourceX: sourceRect.x,
    sourceY: sourceRect.y,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} is invalid.`);
    }
  }
  for (const [name, value] of Object.entries({
    addressX: addressSourceRect.x,
    addressY: addressSourceRect.y,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} is invalid.`);
    }
  }
  for (const [name, value] of Object.entries({
    addressWidth: addressSourceRect.width,
    addressHeight: addressSourceRect.height,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} is invalid.`);
    }
  }
  if (!Array.isArray(backgroundPosition) ||
      !Array.isArray(backgroundSize) ||
      backgroundPosition.length !== 2 || backgroundSize.length !== 2 ||
      [...backgroundPosition, ...backgroundSize].some((value) =>
        !Number.isFinite(value)) ||
      backgroundSize.some((value) => value <= 0)) {
    throw new RangeError("background address is invalid.");
  }
  for (const [name, value] of Object.entries({
    sourceWidth: sourceRect.width,
    sourceHeight: sourceRect.height,
    leafWidth,
    leafHeight,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} is invalid.`);
    }
  }
  const sourceBand = layout.bands.find((band) =>
    Math.abs(band.y - sourceRect.y) <= 0.5 &&
    Math.abs(band.height - sourceRect.height) <= 1);
  if (!sourceBand) {
    throw new RangeError("sourceRect must identify one complete latitude band cell.");
  }

  const addressScaleX = backgroundSize[0] / addressSourceWidth;
  const addressScaleY = backgroundSize[1] / addressSourceHeight;
  const sourceToRasterX = sourceRect.width / addressSourceRect.width;
  const sourceToRasterY = sourceRect.height / addressSourceRect.height;
  const rasterOriginX = sourceRect.x +
    (-backgroundPosition[0] / addressScaleX - addressSourceRect.x) *
      sourceToRasterX;
  const rasterOriginY = sourceRect.y +
    (-backgroundPosition[1] / addressScaleY - addressSourceRect.y) *
      sourceToRasterY;
  const rasterSpanX = leafWidth / addressScaleX * sourceToRasterX;
  const rasterSpanY = leafHeight / addressScaleY * sourceToRasterY;
  const packedRect = Object.freeze({
    x: rasterOriginX + gutter,
    y: rasterOriginY + sourceBand.packedY - sourceBand.y,
    width: rasterSpanX,
    height: rasterSpanY,
  });
  const scaleX = leafWidth / (packedRect.width + overscan * 2);
  const scaleY = leafHeight / (packedRect.height + overscan * 2);
  return Object.freeze({
    backgroundPosition: Object.freeze([
      -(packedRect.x - overscan) * scaleX,
      -(packedRect.y - overscan) * scaleY,
    ]),
    backgroundSize: Object.freeze([
      layout.packedWidth * scaleX,
      layout.packedHeight * scaleY,
    ]),
    packedRect,
    layout,
    overscan,
  });
}

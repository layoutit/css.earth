import { isArray } from '@cssearth/core';
export interface ProjectiveGeometry { projection: string; matrix: string; leafWidth: number; leafHeight: number; backgroundPosition: readonly number[]; backgroundSize: readonly number[]; }
export interface RasterBand { y: number; height: number; }
export interface RasterLayoutOptions { width: number; height: number; bandCount?: number; bands?: readonly RasterBand[]; gutter: number; }
export interface RasterRect { x: number; y: number; width: number; height: number; }
export interface RasterPresentationOptions { sourceWidth: number; sourceHeight: number; sourceRect: RasterRect; addressSourceWidth?: number; addressSourceHeight?: number; addressSourceRect?: RasterRect; backgroundPosition: readonly number[]; backgroundSize: readonly number[]; leafWidth: number; leafHeight: number; bandCount?: number; bands?: readonly RasterBand[]; gutter: number; overscan?: number; }
function assertPositiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

export const MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE = 32;

export const PREPARED_PROJECTIVE_TEXTURE_LAYER_SCHEMA =
  "polycss-prepared-projective-texture-layer@1";

/** Image texels per CSS pixel of every raster leaf: the @2x convention, one backing pixel per texel at DPR 2. WebKit backs a
 * composited leaf at its box size times the device pixel ratio and ignores its transform, so a larger box costs memory and
 * adds no detail: Itokawa's 794 faces held 486 MB of layers on a DPR 3 iPhone at one texel per CSS pixel and 173 MB at two
 * (739 of 3.16 million screen pixels changed at rest), and each of Earth's caps 36 MB at raster scale 4 and 2.3 MB at 1. */
export const TEXELS_PER_CSS_PIXEL = 2;

/** The raster scale that shows a leaf's widest image at TEXELS_PER_CSS_PIXEL. `imagePixels` is the pixel width of the widest
 * image the leaf can show, over every lens, texture level and page; `backgroundWidth` is its background-size width in CSS
 * pixels at scale 1. The ceiling keeps a leaf that already holds more texels than that at its box: the recipe's raster
 * scale for a projective leaf, 1 for a plain leaf whose box only ever shrinks. */
export function leafRasterScale(imagePixels: number, backgroundWidth: number, ceiling: number): number {
  if (!(imagePixels > 0) || !(backgroundWidth > 0) || !(ceiling > 0)) {
    throw new RangeError(`Raster leaf scale needs a positive image width (${imagePixels} px), background width (${backgroundWidth} px) and ceiling (${ceiling}).`);
  }
  return Math.min(ceiling, imagePixels / backgroundWidth / TEXELS_PER_CSS_PIXEL);
}

export function prepareProjectiveTextureLayer(matrixValue: string | readonly number[], rasterScale = 1) {
  const matrix = String(matrixValue).split(",").map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value)) ||
      matrix[15] === 0) {
    throw new TypeError("Projective texture matrix is invalid.");
  }
  if (!Number.isFinite(rasterScale) || rasterScale <= 0) {
    throw new RangeError(`Projective texture raster scale must be positive, not ${rasterScale}.`);
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

function serializeFiniteMatrix(matrix: readonly number[]) {
  return matrix.map((value) => Object.is(value, -0) ? "0" : String(value))
    .join(",");
}

export function fitProjectiveTextureGeometryToStableLayout<T extends ProjectiveGeometry>(
  geometry: T,
) {
  if (!geometry || geometry.projection !== "projective" ||
      !Number.isFinite(geometry.leafWidth) || geometry.leafWidth <= 0 ||
      !Number.isFinite(geometry.leafHeight) || geometry.leafHeight <= 0 ||
      !isArray(geometry.backgroundPosition) ||
      !isArray(geometry.backgroundSize) ||
      geometry.backgroundPosition.length !== 2 ||
      geometry.backgroundSize.length !== 2 ||
      [...geometry.backgroundPosition, ...geometry.backgroundSize].some(
        (value) => !Number.isFinite(value),
      )) {
    throw new TypeError("Projective texture geometry is invalid.");
  }
  const layoutScale = Math.min(
    1,
    MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE / geometry.leafWidth,
    MAX_PROJECTIVE_TEXTURE_LEAF_LAYOUT_SIZE / geometry.leafHeight,
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
}: RasterLayoutOptions) {
  assertPositiveInteger(width, "width");
  assertPositiveInteger(height, "height");
  assertPositiveInteger(gutter, "gutter");
  let normalizedBands;
  if (bands) {
    if (!isArray(bands) || bands.length === 0) {
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
  source: Buffer,
  { width, height, channels = 4, bandCount, bands, gutter }: RasterLayoutOptions & { channels?: number },
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
}: RasterPresentationOptions) {
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
  // A patch's overlap may start its rect inside the packed gutter, never beyond it.
  for (const [name, value] of Object.entries({
    sourceX: sourceRect.x,
    sourceY: sourceRect.y,
  })) {
    if (!Number.isFinite(value) || value < -gutter) {
      throw new RangeError(`${name} is invalid: ${value} is outside the ${gutter}-pixel gutter.`);
    }
  }
  for (const [name, value] of Object.entries({
    addressX: addressSourceRect.x,
    addressY: addressSourceRect.y,
  })) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name} is invalid: ${value}.`);
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
  if (!isArray(backgroundPosition) ||
      !isArray(backgroundSize) ||
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
  // The rect is one band cell, grown by at most its gutter on each side for the patch overlap.
  const sourceBand = layout.bands.find((band) =>
    sourceRect.y >= band.y - gutter && sourceRect.y <= band.y + 0.5 &&
    sourceRect.y + sourceRect.height >= band.y + band.height - 0.5 &&
    sourceRect.y + sourceRect.height <= band.y + band.height + gutter);
  if (!sourceBand) {
    throw new RangeError(`sourceRect (y ${sourceRect.y}, height ${sourceRect.height}) must cover one complete latitude band cell, grown by at most the ${gutter}-pixel gutter.`);
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
  // The fitted address carries the renderer's rounding of each leaf's texture size, thousandths of a texel that
  // accumulate across a band atlas (half a texel by its last column). A leaf that samples its own source rect within
  // half a texel takes the rect exactly, so every band and column of the atlas lines up.
  const snaps = [rasterOriginX - sourceRect.x, rasterOriginY - sourceRect.y, rasterSpanX - sourceRect.width, rasterSpanY - sourceRect.height]
    .every((difference) => Math.abs(difference) < 0.5);
  const packedRect = Object.freeze({
    x: (snaps ? sourceRect.x : rasterOriginX) + gutter,
    y: (snaps ? sourceRect.y : rasterOriginY) + sourceBand.packedY - sourceBand.y,
    width: snaps ? sourceRect.width : rasterSpanX,
    height: snaps ? sourceRect.height : rasterSpanY,
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

type TextureCoordinates = Pick<ProjectiveGeometry, 'matrix' | 'leafWidth' | 'leafHeight' | 'backgroundPosition' | 'backgroundSize'>;
/** Rescale a texture leaf without changing its source coordinates. */
export function fitTextureGeometry<T extends TextureCoordinates>(geometry: T, leafWidth: number, leafHeight: number): Omit<T,keyof TextureCoordinates> & TextureCoordinates {
  const matrix = String(geometry.matrix).split(',').map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error('Prepared texture matrix is invalid.');
  }
  const matrixScaleX = geometry.leafWidth / leafWidth;
  const matrixScaleY = geometry.leafHeight / leafHeight;
  for (const index of [0, 1, 2, 3]) matrix[index] *= matrixScaleX;
  for (const index of [4, 5, 6, 7]) matrix[index] *= matrixScaleY;
  const rasterScaleX = leafWidth / geometry.leafWidth;
  const rasterScaleY = leafHeight / geometry.leafHeight;
  return {
    ...geometry,
    matrix: matrix.map((value) => Number(value.toFixed(6))).join(','),
    leafWidth,
    leafHeight,
    backgroundPosition: [geometry.backgroundPosition[0] * rasterScaleX,
      geometry.backgroundPosition[1] * rasterScaleY],
    backgroundSize: [geometry.backgroundSize[0] * rasterScaleX,
      geometry.backgroundSize[1] * rasterScaleY],
  };
}

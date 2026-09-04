import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectiveSurfaceRasterLayout,
  createProjectiveSurfaceRasterPresentation,
  fitProjectiveTextureGeometryToStableLayout,
  packProjectiveSurfaceRaster,
  prepareProjectiveTextureLayer,
} from "./projective-surface-raster.mjs";

test("prepares an affine face and flattened homography that compose to the source projection", () => {
  const source = [
    2, 3, 4, 0.01,
    5, 6, 7, -0.02,
    8, 9, 10, 0,
    11, 12, 13, 1,
  ];
  const prepared = prepareProjectiveTextureLayer(source.join(","));
  const frame = prepared.frameMatrix.split(",").map(Number);
  const texture = prepared.textureMatrix.split(",").map(Number);
  assert.deepEqual([frame[3], frame[7], frame[11], frame[15]], [0, 0, 0, 1]);

  for (const [x, y] of [[0, 0], [32, 0], [32, 24], [0, 24]]) {
    const texturePoint = multiplyMatrixPoint(texture, [x, y, 0, 1]);
    const composedPoint = multiplyMatrixPoint(frame, texturePoint);
    const sourcePoint = multiplyMatrixPoint(source, [x, y, 0, 1]);
    for (let index = 0; index < 4; index += 1) {
      assert.ok(Math.abs(composedPoint[index] - sourcePoint[index]) < 1e-9);
    }
  }
});

test("preserves the source projection at a higher prepared raster density", () => {
  const source = [
    2, 3, 4, 0.01,
    5, 6, 7, -0.02,
    8, 9, 10, 0,
    11, 12, 13, 1,
  ];
  const rasterScale = 8.125;
  const prepared = prepareProjectiveTextureLayer(
    source.join(","),
    rasterScale,
  );
  const frame = prepared.frameMatrix.split(",").map(Number);
  const texture = prepared.textureMatrix.split(",").map(Number);
  assert.equal(prepared.rasterScale, rasterScale);

  for (const [x, y] of [[0, 0], [32, 0], [32, 24], [0, 24]]) {
    const texturePoint = multiplyMatrixPoint(
      texture,
      [x * rasterScale, y * rasterScale, 0, 1],
    );
    const composedPoint = multiplyMatrixPoint(frame, texturePoint);
    const sourcePoint = multiplyMatrixPoint(source, [x, y, 0, 1]);
    for (let index = 0; index < 4; index += 1) {
      assert.ok(Math.abs(composedPoint[index] - sourcePoint[index]) < 1e-9);
    }
  }
});

function multiplyMatrixPoint(matrix, point) {
  return Array.from({ length: 4 }, (_, row) =>
    matrix[row] * point[0] + matrix[row + 4] * point[1] +
    matrix[row + 8] * point[2] + matrix[row + 12] * point[3]);
}

test("fits projective texture geometry to a stable layout without changing its projection", () => {
  const geometry = Object.freeze({
    projection: "projective",
    matrix: "2,3,4,0.01,5,6,7,-0.02,8,9,10,0,11,12,13,1",
    leafWidth: 64,
    leafHeight: 48,
    backgroundPosition: Object.freeze([-320, -144]),
    backgroundSize: Object.freeze([2048, 1536]),
  });
  const fitted = fitProjectiveTextureGeometryToStableLayout(geometry);
  assert.equal(fitted.leafWidth, 32);
  assert.equal(fitted.leafHeight, 24);
  assert.deepEqual(fitted.backgroundPosition, [-160, -72]);
  assert.deepEqual(fitted.backgroundSize, [1024, 768]);

  const sourceMatrix = geometry.matrix.split(",").map(Number);
  const fittedMatrix = fitted.matrix.split(",").map(Number);
  for (const [sourceX, sourceY] of [[0, 0], [64, 0], [64, 48], [0, 48]]) {
    const fittedX = sourceX / 2;
    const fittedY = sourceY / 2;
    for (let row = 0; row < 4; row += 1) {
      const sourceValue = sourceMatrix[row] * sourceX +
        sourceMatrix[row + 4] * sourceY + sourceMatrix[row + 12];
      const fittedValue = fittedMatrix[row] * fittedX +
        fittedMatrix[row + 4] * fittedY + fittedMatrix[row + 12];
      assert.ok(Math.abs(sourceValue - fittedValue) < 1e-9);
    }
  }
});

test("packs flipped latitude bands with wrapped horizontal and adjacent vertical texels", () => {
  const source = Buffer.from([
    0, 1, 2, 3,
    10, 11, 12, 13,
    20, 21, 22, 23,
    30, 31, 32, 33,
  ]);
  const packed = packProjectiveSurfaceRaster(source, {
    width: 4,
    height: 4,
    channels: 1,
    bandCount: 2,
    gutter: 1,
  });
  const row = (index) => Array.from(packed.data.subarray(
    index * packed.packedWidth,
    (index + 1) * packed.packedWidth,
  ));

  assert.deepEqual(row(1), [13, 10, 11, 12, 13, 10]);
  assert.deepEqual(row(2), [3, 0, 1, 2, 3, 0]);
  assert.deepEqual(row(3), [3, 0, 1, 2, 3, 0]);
  assert.deepEqual(row(4), [33, 30, 31, 32, 33, 30]);
});

test("keeps content-cell geometry outside the packed raster contract", () => {
  const layout = createProjectiveSurfaceRasterLayout({
    width: 2048,
    height: 1024,
    bandCount: 16,
    gutter: 16,
  });
  const presentation = createProjectiveSurfaceRasterPresentation({
    sourceWidth: 2048,
    sourceHeight: 1024,
    sourceRect: { x: 128, y: 256, width: 64, height: 64 },
    backgroundPosition: [-128, -256],
    backgroundSize: [2048, 1024],
    leafWidth: 64,
    leafHeight: 64,
    bandCount: 16,
    gutter: 16,
    overscan: 1,
  });

  assert.equal(layout.packedWidth, 2080);
  assert.equal(layout.packedHeight, 1536);
  assert.deepEqual(presentation.packedRect, {
    x: 144,
    y: 400,
    width: 64,
    height: 64,
  });
  assert.deepEqual(
    presentation.backgroundPosition,
    [-143 * 64 / 66, -399 * 64 / 66],
  );
  assert.deepEqual(
    presentation.backgroundSize,
    [2080 * 64 / 66, 1536 * 64 / 66],
  );
  assert.equal("matrix" in presentation, false);
  assert.equal("vertices" in presentation, false);
});

test("packs explicit unequal latitude bands without normalizing their geometry", () => {
  const source = Buffer.from([0, 1, 2, 3, 4, 5]);
  const bands = [{ y: 1, height: 2 }, { y: 3, height: 3 }];
  const packed = packProjectiveSurfaceRaster(source, {
    width: 1,
    height: 6,
    channels: 1,
    bands,
    gutter: 1,
  });
  assert.equal(packed.packedHeight, 9);
  assert.equal(packed.bandHeight, null);
  const presentation = createProjectiveSurfaceRasterPresentation({
    sourceWidth: 1,
    sourceHeight: 6,
    sourceRect: { x: 0, y: 3, width: 1, height: 3 },
    backgroundPosition: [0, -3],
    backgroundSize: [1, 6],
    leafWidth: 1,
    leafHeight: 3,
    bands,
    gutter: 1,
    overscan: 1,
  });
  assert.equal(presentation.packedRect.y, 5);
  assert.equal("matrix" in presentation, false);
});

test("preserves a projective crop while remapping a differently sized source", () => {
  const addressScale = 64 / 93;
  const presentation = createProjectiveSurfaceRasterPresentation({
    sourceWidth: 2048,
    sourceHeight: 1024,
    sourceRect: { x: 64, y: 128, width: 64, height: 64 },
    addressSourceWidth: 2880,
    addressSourceHeight: 1440,
    addressSourceRect: { x: 90, y: 180, width: 90, height: 90 },
    backgroundPosition: [-88.5 * addressScale, -178.5 * addressScale],
    backgroundSize: [2880 * addressScale, 1440 * addressScale],
    leafWidth: 64,
    leafHeight: 64,
    bandCount: 16,
    gutter: 16,
    overscan: 1,
  });
  const rasterOrigin = 64 - 1.5 * 64 / 90;
  const rasterSpan = 93 * 64 / 90;
  const scale = 64 / (rasterSpan + 2);
  assert.ok(Math.abs(presentation.backgroundPosition[0] -
    -(rasterOrigin + 15) * scale) < 1e-9);
  assert.ok(Math.abs(presentation.backgroundSize[0] - 2080 * scale) < 1e-9);
});

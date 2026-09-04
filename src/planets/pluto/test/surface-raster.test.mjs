import assert from "node:assert/strict";
import test from "node:test";
import { bakeSurfaceRaster, prepareSurfaceRasterCell, PLUTO_SURFACE_ATLAS } from "../tools/surface-raster.mjs";

const geometry = {
  matrix: "1,0,0,0,0,1,0,-0.01,0,0,1,0,0,0,0,1",
  leafWidth: 16, leafHeight: 16,
  backgroundPosition: [0, 0], backgroundSize: [16, 16],
};

test("prepares affine frames with already-corrected texture pixels", () => {
  const cell = prepareSurfaceRasterCell(geometry, 0);
  assert.equal(cell.layer.textureMatrix, "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1");
  const m = cell.layer.frameMatrix.split(",").map(Number);
  assert.deepEqual([m[3], m[7], m[11], m[15]], [0, 0, 0, 1]);
  assert.ok(cell.width > geometry.leafWidth);
  assert.equal(cell.source.width, geometry.leafWidth);
  assert.equal(cell.x, PLUTO_SURFACE_ATLAS.gutter);
  assert.throws(() => prepareSurfaceRasterCell({ ...geometry, matrix: "1,0,0,0,0,1,0,-1,0,0,1,0,0,0,0,1" }, 0), /infinity/);
});

test("inverse sampling preserves imagery and leaves outside-quad wedges transparent", () => {
  const cell = prepareSurfaceRasterCell(geometry, 0);
  const source = Buffer.alloc(16 * 16 * 3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) source.set([x * 8, 77, 99], (y * 16 + x) * 3);
  const raster = bakeSurfaceRaster(source, { width: 16, height: 16, channels: 3 }, [cell], 2);
  const pixel = (x, y) => [...raster.data.subarray(((cell.y * 2 + y) * raster.width + cell.x * 2 + x) * 4, ((cell.y * 2 + y) * raster.width + cell.x * 2 + x) * 4 + 4)];
  // The bounding rectangle contains a trapezoid, not stretched edge texels.
  assert.deepEqual(pixel(36, 1), [0, 0, 0, 0]);
  assert.deepEqual(pixel(20, 12).slice(1), [77, 99, 255]);
  const inverseU = 20.5 / (1 + 0.005 * 12.5) / 2;
  assert.ok(Math.abs(pixel(20, 12)[0] - (inverseU - 0.5) * 8) <= 1);
  assert.equal(raster.data[3], 0, "The atlas gutter stays transparent.");
  assert.deepEqual(raster.data, bakeSurfaceRaster(source, { width: 16, height: 16, channels: 3 }, [cell], 2).data);
});

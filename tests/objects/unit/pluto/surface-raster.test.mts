import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { prepareBandSurfaceScene } from "../../../../tools/objects/static-surface/band-scene.mts";
import { bakeSurfaceRaster, prepareSurfaceRasterCell, PLUTO_SURFACE_ATLAS } from "./preparation-fixture.mts";

const geometry:Parameters<typeof prepareSurfaceRasterCell>[0] = {
  projection:'projective', matrix: "1,0,0,0,0,1,0,-0.01,0,0,1,0,0,0,0,1",
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
  assert.equal(cell.x, 0);
  assert.equal(cell.source.padding, PLUTO_SURFACE_ATLAS.gutter);
  assert.equal(m[12], -PLUTO_SURFACE_ATLAS.gutter);
  assert.equal(m[13], -PLUTO_SURFACE_ATLAS.gutter);
  assert.throws(() => prepareSurfaceRasterCell({ ...geometry, projection:'projective', matrix: "1,0,0,0,0,1,0,-1,0,0,1,0,0,0,0,1" }, 0), /infinity/);
});

test("inverse sampling preserves imagery and leaves outside-quad wedges transparent", () => {
  const cell = prepareSurfaceRasterCell(geometry, 0);
  const source = Buffer.alloc(16 * 16 * 3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) source.set([x * 8, 77, 99], (y * 16 + x) * 3);
  const raster = bakeSurfaceRaster(source, { width: 16, height: 16, channels: 3 }, [cell], 2);
  const pixel = (x: number, y: number) => [...raster.data.subarray(((cell.y * 2 + y) * raster.width + cell.x * 2 + x) * 4, ((cell.y * 2 + y) * raster.width + cell.x * 2 + x) * 4 + 4)];
  // The bounding rectangle contains a trapezoid, not stretched edge texels.
  assert.deepEqual(pixel(39, 2), [0, 0, 0, 0]);
  assert.deepEqual(pixel(20, 12).slice(1), [77, 99, 255]);
  const inverseU = 18.5 / (1 + 0.005 * 10.5) / 2;
  assert.ok(Math.abs(pixel(20, 12)[0] - (inverseU - 0.5) * 8) <= 1);
  assert.equal(pixel(2, 12)[3], 255, "The original face edge lies inside the opaque source-sampled apron.");
  assert.deepEqual(raster.data, bakeSurfaceRaster(source, { width: 16, height: 16, channels: 3 }, [cell], 2).data);
});

test("overlapping globe faces retain the corresponding source coordinates", async () => {
  const profile = JSON.parse((await readFile(new URL("../../../../src/planets/pluto/source/preparation/geometry.json", import.meta.url))).toString('utf8'));
  const { surfaceRasterCells } = prepareBandSurfaceScene(profile);
  const { longitudeSegments, latitudeSegments, surfaceOverlap } = profile.parameters;
  for (const [index, { source }] of surfaceRasterCells.entries()) {
    const longitude = index % longitudeSegments, latitude = Math.floor(index / longitudeSegments) + 1;
    const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-10, `${a} differs from ${b}`);
    close(-source.backgroundPosition[0] / source.backgroundSize[0], (longitude - surfaceOverlap) / longitudeSegments);
    close((source.width - source.backgroundPosition[0]) / source.backgroundSize[0], (longitude + 1 + surfaceOverlap) / longitudeSegments);
    close(-source.backgroundPosition[1] / source.backgroundSize[1], (latitudeSegments - 1 - latitude - surfaceOverlap) / latitudeSegments);
  }
});

test("nominal warped edges remain opaque at both prepared densities", () => {
  const cell = prepareSurfaceRasterCell(geometry, 0);
  const source = Buffer.alloc(16 * 16 * 3, 177);
  for (const density of [1, 2]) {
    const raster = bakeSurfaceRaster(source, { width: 16, height: 16, channels: 3 }, [cell], density);
    for (let edge = 0; edge < 4; edge++) for (const t of [.1, .3, .5, .7, .9]) {
      const [ax, ay] = cell.source.boundary[edge], [bx, by] = cell.source.boundary[(edge + 1) % 4];
      const x = Math.floor((ax + (bx - ax) * t + cell.source.padding) * density);
      const y = Math.floor((ay + (by - ay) * t + cell.source.padding) * density);
      const offset = ((cell.y * density + y) * raster.width + cell.x * density + x) * 4;
      assert.deepEqual([...raster.data.subarray(offset, offset + 4)], [177, 177, 177, 255]);
    }
  }
});

// The positive warp places the last covered subpixel within half a source
// texel of the north edge at both resolutions, so that boundary is exercised.
for (const density of [1, 2]) for (const perspectiveY of [0, -0.007, 0.0061]) {
  test(`samples continuous source latitude across all band edges (density ${density}, perspective ${perspectiveY})`, () => {
    const bandCount = 16, bandHeight = 32 * density;
    const width = 32 * density, height = bandCount * bandHeight;
    const data = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Latitude ramp plus a high-contrast row signal: the latter also rejects
      // clamping within each band, even when ramp rounding hides that error.
      data.set([Math.round(y / (height - 1) * 255), y % 2 * 255, x % 2 * 255], (y * width + x) * 3);
    }
    const cells = Array.from({ length: bandCount }, (_, band) => prepareSurfaceRasterCell({
      projection:'projective', matrix: `1,0,0,0,0,1,0,${perspectiveY},0,0,1,0,0,0,0,1`,
      leafWidth: 32, leafHeight: 32,
      backgroundPosition: [0, -band * 32], backgroundSize: [32, 512],
    }, band));
    const raster = bakeSurfaceRaster(data, { width, height, channels: 3 }, cells, density);
    // Independent source-space oracle: latitude runs north-to-south, whereas
    // each retained face runs south-to-north. Interpolate original global rows.
    const sourcePixel = (x: number, y: number, channel: number) => data[(Math.max(0, Math.min(height - 1, y)) * width + (x + width) % width) * 3 + channel];
    const sample = (x: number, y: number, channel: number) => {
      let value = 0;
      for (const row of [Math.floor(y), Math.floor(y) + 1]) for (const column of [Math.floor(x), Math.floor(x) + 1]) {
        value += sourcePixel(column, row, channel) * (1 - Math.abs(row - y)) * (1 - Math.abs(column - x));
      }
      return value;
    };
    for (const [band, cell] of cells.entries()) {
      let compared = 0;
      for (let y = 0; y < Math.ceil(cell.height * density); y++) for (let x = 0; x < Math.ceil(cell.width * density); x++) {
        const samples: number[][] = [];
        for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) {
          // Solve y' = v / (1 + perspectiveY * v) in leaf units.
          const projectedY = (y + dy) / density - cell.source.padding;
          const v = projectedY / (1 - perspectiveY * projectedY);
          const u = ((x + dx) / density - cell.source.padding) * (1 + perspectiveY * v);
          if (u < 0 || v < 0 || u > 32 || v > 32) continue;
          const sourceX = u / 32 * width - 0.5;
          const sourceY = (band + 1 - v / 32) * bandHeight - 0.5;
          samples.push([0, 1, 2].map(channel => sample(sourceX, sourceY, channel)));
        }
        // Boundary padding is checked separately. The original quad's interior
        // must still reproduce the independently interpolated global source.
        if (samples.length !== 4) continue;
        const start = ((cell.y * density + y) * raster.width + cell.x * density + x) * 4;
        const actual = [...raster.data.subarray(start, start + 4)];
        const expected = samples.length ? [0, 1, 2].map(channel => Math.round(samples.reduce((sum, rgb) => sum + rgb[channel], 0) / samples.length)).concat(Math.round(samples.length / 4 * 255)) : [0, 0, 0, 0];
        assert.deepEqual(actual, expected, `band ${band}, pixel ${x},${y}`);
        compared++;
      }
      assert.ok(compared > 300, `interior of band ${band} was sampled`);
    }
  });
}

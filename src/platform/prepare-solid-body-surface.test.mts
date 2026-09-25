import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareSolidBodySurface, reprojectSolidBodySurfaceRaster, prepareSolidBodyPoleRaster } from "./prepare-solid-body-surface.mts";

// An independently readable coordinate image: red encodes longitude and green
// encodes latitude. Check its prepared texels against actual CSS vertex mapping.
const width = 1024, height = 512;
const source = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  source.set([Math.round(x / (width - 1) * 255), Math.round(y / (height - 1) * 255), 0, 255], (y * width + x) * 4);
}
// The widths of a 2048 × 1024 map packed with its gutters (2080 px) and its two 256-px pole tiles (512 px).
const leaves = prepareSolidBodySurface({ id: "fixture", mapUrl: "/scenes/fixture/map.webp", polesUrl: "/scenes/fixture/poles.webp",
  mapPixelWidth: 2080, polesPixelWidth: 512 });
function matched(style: string, pattern: RegExp): RegExpMatchArray {
  const result = style.match(pattern);
  assert.ok(result, `Prepared style matches ${pattern}`);
  return result;
}
function coordinatesAt(leaf: typeof leaves[number] | undefined, u: number, v: number) {
  assert.ok(leaf);
  const m = matched(leaf.style, /matrix3d\(([^)]+)/)[1].split(",").map(Number);
  const x = u * Number(matched(leaf.style, /atlas-width:([\d.]+)/)[1]);
  const y = v * Number(matched(leaf.style, /atlas-height:([\d.]+)/)[1]);
  const p = [0, 1, 2].map(i => (m[i] * x + m[i + 4] * y + m[i + 12]) / (m[3] * x + m[7] * y + m[15]));
  return { latitude: Math.atan2(p[2], Math.hypot(p[0], p[1])),
    longitude: (Math.atan2(p[0], p[1]) / (2 * Math.PI) + 1) % 1 };
}
const longitudeByte = (longitude: number) => (longitude * width - 0.5) / (width - 1) * 255;
const latitudeByte = (latitude: number) => ((0.5 - latitude / Math.PI) * height - 0.5) / (height - 1) * 255;

test("texture bands address the latitude of the prepared surface, including both polar boundaries", () => {
  const raster = reprojectSolidBodySurfaceRaster(source, { width, height });
  for (const band of [1, 2, 7, 8, 13, 14]) for (const row of [1, 8, 16, 24, 30]) for (const column of [1, 16, 30]) {
    const u = (column + 0.5) / 32, v = 1 - (row + 0.5) / 32;
    const leaf = leaves[1 + (14 - band) * 32];
    const actual = raster[((band * 32 + row) * width + column) * 4 + 1];
    const coordinate = coordinatesAt(leaf, u, v);
    const expected = latitudeByte(coordinate.latitude);
    const red = raster[((band * 32 + row) * width + column) * 4];
    assert.ok(Math.abs(red - longitudeByte(coordinate.longitude)) < 1);
    assert.ok(Math.abs(actual - expected) < 1, `band ${band}, row ${row}, column ${column}: ${actual} vs ${expected}`);
  }
});

test("polar textures use the same projection as their flat caps", () => {
  const tileSize = 128;
  const raster = prepareSolidBodyPoleRaster(source, { width, height, tileSize });
  for (const pole of ["north", "south"]) for (const [x, y] of [[64, 64], [24, 64], [90, 24], [64, 120]]) {
    const leaf = leaves.find(leaf => leaf.className === `fixture-polar fixture-polar-${pole}`);
    const actual = raster[(y * tileSize * 2 + (pole === "north" ? 0 : tileSize) + x) * 4 + 1];
    const coordinate = coordinatesAt(leaf, (x + 0.5) / tileSize, (y + 0.5) / tileSize);
    const expected = latitudeByte(coordinate.latitude);
    const red = raster[(y * tileSize * 2 + (pole === "north" ? 0 : tileSize) + x) * 4];
    assert.ok(Math.abs(red - longitudeByte(coordinate.longitude)) < 1, `${pole} longitude ${x},${y}`);
    assert.ok(Math.abs(actual - expected) < 1, `${pole} ${x},${y}: ${actual} vs ${expected}`);
  }
});

test("CSS UVs sample the actual atlas when HD padding is not a quarter-band", async () => {
  const { packProjectiveSurfaceRaster } = await import('./projective-surface-raster.mts');
  // Like Charon and Triton, the packed gutter is independent of image density.
  const gutter = 6;
  const packed = packProjectiveSurfaceRaster(reprojectSolidBodySurfaceRaster(source, { width, height }),
    { width, height, bandCount: 16, gutter });
  const geometry = prepareSolidBodySurface({ id: 'fixture', mapUrl: '/map.webp', polesUrl: '/poles.webp',
    sourceWidth: width, sourceHeight: height, gutter, mapPixelWidth: packed.packedWidth, polesPixelWidth: 512 });
  for (const band of [1, 7, 14]) for (const longitude of [1, 8, 23, 30]) {
    const leaf = geometry[1 + (14 - band) * 32 + longitude];
    const cssSize = ['width', 'height'].map(key => Number(matched(leaf.style, new RegExp(`atlas-${key}:([\\d.]+)`))[1]));
    const position = matched(leaf.style, /background-position:([^;]+)/)[1].split(' ').map(parseFloat);
    const size = matched(leaf.style, /background-size:([^;]+)/)[1].split(' ').map(parseFloat);
    for (const u of [.08, .5, .92]) for (const v of [.08, .5, .92]) {
      const x = Math.floor((u * cssSize[0] - position[0]) * packed.packedWidth / size[0]);
      const y = Math.floor((v * cssSize[1] - position[1]) * packed.packedHeight / size[1]);
      const actual = packed.data.subarray((y * packed.packedWidth + x) * 4, (y * packed.packedWidth + x) * 4 + 2);
      const coordinate = coordinatesAt(leaf, u, v);
      assert.ok(Math.abs(actual[0] - longitudeByte(coordinate.longitude)) < 2, `longitude at band ${band}, face ${longitude}`);
      assert.ok(Math.abs(actual[1] - latitudeByte(coordinate.latitude)) < 2, `latitude at band ${band}, face ${longitude}`);
    }
  }
});

test("band and cap leaves hold their widest image at two texels per CSS pixel, never above the former scale 4", () => {
  const texelsPerCssPixel = (leaf: typeof leaves[number], imagePixels: number) =>
    imagePixels / (Number.parseFloat(matched(leaf.style, /background-size:([^;]+)/)[1]) * leaf.projectiveTextureLayer.rasterScale);
  for (const [mapPixelWidth, polesPixelWidth] of [[2080, 512], [4160, 1024], [1040, 256]]) {
    const prepared = prepareSolidBodySurface({ id: "fixture", mapUrl: "/map.webp", polesUrl: "/poles.webp", mapPixelWidth, polesPixelWidth });
    for (const leaf of prepared) {
      const texels = texelsPerCssPixel(leaf, leaf.polar ? polesPixelWidth : mapPixelWidth);
      assert.ok(Math.abs(texels - 2) < 1e-12, `${leaf.polar ?? "band"} leaf shows ${texels} texels per CSS pixel`);
    }
  }
  // A map denser than two texels per CSS pixel at scale 4 keeps scale 4, as every leaf had before the rule.
  const dense = prepareSolidBodySurface({ id: "fixture", mapUrl: "/map.webp", polesUrl: "/poles.webp", mapPixelWidth: 16640, polesPixelWidth: 8192 });
  assert.deepEqual([...new Set(dense.map(leaf => leaf.projectiveTextureLayer.rasterScale))], [4]);
  // The scale only sizes the box: geometry and texture addresses are the same leaves.
  const fine = prepareSolidBodySurface({ id: "fixture", mapUrl: "/scenes/fixture/map.webp", polesUrl: "/scenes/fixture/poles.webp", mapPixelWidth: 4160, polesPixelWidth: 1024 });
  assert.deepEqual(fine.map(leaf => leaf.style), leaves.map(leaf => leaf.style));
});

test("solid-body leaves refuse a missing image width and name the body", () => {
  for (const widths of [{ mapPixelWidth: 0, polesPixelWidth: 512 }, { mapPixelWidth: 2080, polesPixelWidth: Number.NaN }]) {
    assert.throws(() => prepareSolidBodySurface({ id: "fixture", mapUrl: "/map.webp", polesUrl: "/poles.webp", ...widths }),
      /fixture: solid-body leaves need the measured pixel widths/);
  }
});

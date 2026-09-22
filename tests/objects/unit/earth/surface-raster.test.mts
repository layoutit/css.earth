import {choice} from "../../../../tools/objects/terrestrial-layers/source-records.mts";
import {required} from "../../../../tools/contract/test-values.mts";
import {hasErrorCode} from "../../../../tools/sources/source-values.mts";
import {shape,array,number,boolean,text} from "../../../../tools/objects/paged-ellipsoid/geographic/source-records.mts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('earth');
import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mts";
import {
  EARTH_SURFACE_ATLAS,
  bakeEarthSurfaceRaster,
  createEarthSurfaceRasterPlan,
} from "../../unit/earth/prepared-fixture.mts";
import type { PagedSurfaceRasterCell } from "../../../../tools/objects/paged-ellipsoid/surface-raster.mts";

type EarthLeaf=(typeof PREPARED_EARTH_SCENE.body.bands)[number]["leaves"][number];
const parseRasterCell=shape({index:number,size:number,density:number,reversed:boolean,perspectiveY:number,page:number,x:number,y:number,
  source:shape({x:number,southY:number,width:number,height:number}),layer:shape({schema:choice("polycss-prepared-projective-texture-layer@1"),rasterScale:number,frameMatrix:text,textureMatrix:text})});
const parseStaging=shape({atlas:shape({pageSize:number,density:number,gutter:number,sourceWidth:number}),pages:array(shape({width:number,height:number})),cells:array(parseRasterCell)});
const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

function geometry(perspectiveY = 0) {
  return {
    leafWidth: 32, leafHeight: 32,
    matrix: [1.25, 0.2, -0.3, 0, -0.4, 0.9, 0.35, perspectiveY,
      0.1, -0.2, 1, 0, 17, -23, 41, 1].join(","),
  };
}

function presentation() {
  return {
    packedRect: { x: 4, y: 100, width: 64, height: 64 },
    layout: { gutter: 4, bands: [{ y: 64, height: 64, packedY: 100 }] },
    overscan: 2,
  };
}

// A direct homogeneous point multiply, independent of the production frame
// factorization and its northern-coordinate normalization.
function project(matrix: number[], x: number, y: number) {
  const homogeneous = [x, y, 0, 1];
  const values = Array.from({ length: 4 }, (_, row) =>
    homogeneous.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
  return values.slice(0, 3).map((value) => value / values[3]);
}

for (const perspectiveY of [0, -0.012, 0.012, -0.027, 0.06]) {
  test(`Earth baked affine frame preserves its original projective cell (${perspectiveY})`, () => {
    const input = geometry(perspectiveY);
    const before = input.matrix.split(",").map(Number);
    const cell = Reflect.apply(createEarthSurfaceRasterPlan().prepare,undefined,[input,presentation(),0]);
    assert.equal(input.matrix, before.join(","), "planning must not mutate source geometry");
    assert.equal(cell.reversed, perspectiveY > 0);
    assert.ok(cell.perspectiveY <= 0);
    assert.ok(1 + cell.perspectiveY * 32 > 0);
    assert.equal(cell.layer.textureMatrix, IDENTITY, "runtime texture child must be affine");
    const frame = cell.layer.frameMatrix.split(",").map(Number);
    assert.deepEqual([frame[3], frame[7], frame[11], frame[15]], [0, 0, 0, 1]);
    for (const [u, v] of [[0, 0], [32, 0], [32, 32], [0, 32], [16, 16],
      [1.125, 30.875], [27.625, 6.375], [8, 24]]) {
      const x = cell.reversed ? 32 - u : u;
      const y = cell.reversed ? 32 - v : v;
      const denominator = 1 + cell.perspectiveY * y;
      const cssScale = cell.density / EARTH_SURFACE_ATLAS.density;
      const actual = project(frame, x / denominator * cssScale, y / denominator * cssScale);
      const expected = project(before, u, v);
      for (let axis = 0; axis < 3; axis++) assert.ok(
        Math.abs(actual[axis] - expected[axis]) < 1e-9,
        `cell coordinate ${u},${v}, axis ${axis}: ${actual[axis]} != ${expected[axis]}`,
      );
      assert.ok(x / denominator * cell.density <= cell.size + 1e-9);
      assert.ok(y / denominator * cell.density <= cell.size + 1e-9);
    }
    assertSourceStepBound(cell);
  });
}

function assertSourceStepBound(cell: PagedSurfaceRasterCell) {
  const sourcePoint = (x: number, y: number) => {
    const w = 1 - cell.perspectiveY * y;
    return [x / w * cell.source.width / 32 * 4,
      y / w * cell.source.height / 32 * 4];
  };
  let smallerDensityWouldUndersample = false;
  for (const [u, v] of [[0, 0], [32, 0], [32, 32], [0, 32], [16, 16]]) {
    const w = 1 + cell.perspectiveY * v;
    const point = [u / w, v / w];
    const before = sourcePoint(point[0],point[1]);
    for (let angle = 0; angle < 64; angle++) {
      const direction = [Math.cos(angle * Math.PI / 32), Math.sin(angle * Math.PI / 32)];
      const epsilon = 0.001;
      const shifted=point.map((value,index)=>value+direction[index]*epsilon/cell.density);
      const after = sourcePoint(shifted[0],shifted[1]);
      const sourcePixelsPerAtlasPixel = Math.hypot(after[0] - before[0], after[1] - before[1]) / epsilon;
      assert.ok(sourcePixelsPerAtlasPixel <= 1 + 1e-5,
        `cell ${cell.index} density ${cell.density} undersamples direction ${angle} at ${u},${v}`);
      smallerDensityWouldUndersample ||= sourcePixelsPerAtlasPixel * cell.density / (cell.density - 1) > 1;
    }
  }
  assert.equal(smallerDensityWouldUndersample, true, "the next lower integer density must fail the source-step bound");
}

function sourceCellIndex(leaf:EarthLeaf) {
  const { x, y, width, height } = required(leaf.sourceRect);
  assert.deepEqual([width, height], [90, 90]);
  assert.ok(Number.isInteger(x / 90) && Number.isInteger(y / 90));
  return (14 - y / 90) * 32 + x / 90;
}

function preparedCell(leaf:EarthLeaf) {
  const properties = Object.fromEntries(leaf.style.split(";").map((property: string) => {
    const separator = property.indexOf(":");
    return [property.slice(0, separator), property.slice(separator + 1)];
  }));
  const [width, height] = properties["background-size"].split(" ");
  const [left, top] = properties["background-position"].split(" ").map(parseFloat);
  const density = EARTH_SURFACE_ATLAS.density;
  assert.equal(width, `${EARTH_SURFACE_ATLAS.pageSize / density}px`);
  assert.equal(height, "auto", "each page preserves its natural trimmed-height aspect ratio");
  const pageMatch = /^var\(--earth-surface-page-(\d+)\)$/.exec(properties["background-image"]);
  assert.ok(pageMatch, "surface leaves must select one prepared page");
  assert.equal(leaf.leafWidth, leaf.leafHeight);
  return { index: sourceCellIndex(leaf), page: Number(pageMatch[1]), x: Math.round(-left * density),
    y: Math.round(-top * density), size: Math.round(leaf.leafWidth * density) };
}

test("Earth's production atlas packs 448 unique exterior cells and reuses exactly 308 cutaway cells", async () => {
  const surface = (bands:typeof PREPARED_EARTH_SCENE.body.bands) => bands.flatMap(({ leaves }) => leaves)
    .filter(({ className }) => className === "earth-surface-leaf");
  const body = surface(PREPARED_EARTH_SCENE.body.bands);
  const cutaway = surface(PREPARED_EARTH_SCENE.interior.outerBodyBands);
  assert.equal(body.length, 448);
  assert.equal(cutaway.length, 308);
  const byIndex = new Map(body.map((leaf) => [sourceCellIndex(leaf), leaf]));
  assert.equal(byIndex.size, 448);
  assert.deepEqual([...byIndex.keys()].sort((a, b) => a - b), Array.from({ length: 448 }, (_, i) => i));
  const cells = body.map(preparedCell);
  const { gutter } = EARTH_SURFACE_ATLAS;
  const pages = PREPARED_EARTH_SCENE.body.assets.surface.pages;
  assert.equal(pages.length, 7);
  assert.equal(PREPARED_EARTH_SCENE.body.assets.surface.urls.length, pages.length);
  assert.equal(new Set(PREPARED_EARTH_SCENE.body.assets.surface.urls).size, pages.length);
  assert.deepEqual([...new Set(cells.map(({ page }) => page))], pages.map((_, index) => index));
  for (const [page, dimensions] of pages.entries()) {
    assert.equal(dimensions.width, EARTH_SURFACE_ATLAS.pageSize);
    assert.ok(Number.isInteger(dimensions.height) && dimensions.height > 0 &&
      dimensions.height <= EARTH_SURFACE_ATLAS.pageSize && dimensions.height % 4 === 0);
    const occupiedBottom = Math.max(...cells.filter((cell: { page: number; }) => cell.page === page)
      .map((cell) => cell.y + cell.size + gutter));
    assert.ok(dimensions.height >= occupiedBottom && dimensions.height - occupiedBottom < 4,
      `page ${page} must be trimmed to occupied rows, preserving four-pixel alignment`);
  }
  for (const cell of cells) {
    const { width, height } = pages[cell.page];
    assert.ok(cell.x >= gutter && cell.y >= gutter);
    assert.ok(cell.x + cell.size + gutter <= width);
    assert.ok(cell.y + cell.size + gutter <= height);
    const leaf = required(byIndex.get(cell.index));
    assert.equal(required(leaf.projectiveTextureLayer).textureMatrix, IDENTITY);
    assert.equal(required(leaf.projectiveTextureLayer).rasterScale, 1);
    const matrix = required(leaf.projectiveTextureLayer).frameMatrix.split(",").map(Number);
    assert.deepEqual([matrix[3], matrix[7], matrix[11], matrix[15]], [0, 0, 0, 1]);
  }
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j];
    if (a.page !== b.page) continue;
    assert.ok(a.x + a.size + gutter * 2 <= b.x || b.x + b.size + gutter * 2 <= a.x ||
      a.y + a.size + gutter * 2 <= b.y || b.y + b.size + gutter * 2 <= a.y,
    `cells ${a.index} and ${b.index} must not overlap, including gutters`);
  }
  assert.equal(new Set(cutaway.map(sourceCellIndex)).size, 308);
  for (const leaf of cutaway) {
    const exterior = byIndex.get(sourceCellIndex(leaf));
    assert.ok(exterior);
    assert.deepEqual(leaf, exterior, "cutaway must reuse exactly the exterior geometry and atlas address");
  }
  // Preparation staging is intentionally local, not a runtime dependency. When
  // available, also cross-check the baker's exact input against the checked-in
  // leaf-derived proof above; that proof always runs in a clean checkout.
  let staging:ReturnType<typeof parseStaging>|undefined;
  try {
    staging = parseStaging(JSON.parse(await readFile(new URL("../../../../src/objects/earth/prepared/surface-raster-plan.json", import.meta.url), "utf8")));
  } catch (error) { if (!hasErrorCode(error,"ENOENT")) throw error; }
  if (staging) {
    assert.deepEqual(staging.atlas, EARTH_SURFACE_ATLAS);
    assert.deepEqual(staging.pages, pages);
    assert.equal(staging.cells.length, 448);
    for (const cell of staging.cells) {
      const leaf = required(byIndex.get(cell.index));
      assert.deepEqual(preparedCell(leaf),
        { index: cell.index, page: cell.page, x: cell.x, y: cell.y, size: cell.size });
      assert.deepEqual(leaf.projectiveTextureLayer, cell.layer);
      const expectedSource = {
        x: required(leaf.sourceRect).x * 2048 / 2880 - 0.512,
        southY: (required(leaf.sourceRect).y + required(leaf.sourceRect).height) * 1024 / 1440 + 0.512,
        width: required(leaf.sourceRect).width * 2048 / 2880 + 1.024,
        height: required(leaf.sourceRect).height * 1024 / 1440 + 1.024,
      };
      for (const key of ["x","southY","width","height"] as const) assert.ok(
        Math.abs(cell.source[key] - expectedSource[key]) < 1e-9,
        `cell ${cell.index} must preserve original continuous ${key}`);
      if (cell.index % 32 === 0) assertSourceStepBound(cell);
    }
  }
});

test("Earth raster planning rejects malformed geometry, addresses, and inconsistent reuse", () => {
  const invalidGeometry = [
    null, { ...geometry(), matrix: "1,2,3" },
    { ...geometry(), matrix: geometry().matrix.replace("1.25", "NaN") },
    { ...geometry(), leafWidth: 31 }, { ...geometry(), leafHeight: 0 },
    geometry(-1 / 32), geometry(-0.04),
  ];
  for (const index of [3, 15]) {
    const matrix = geometry().matrix.split(",").map(Number);
    matrix[index] = 0.5;
    invalidGeometry.push({ ...geometry(), matrix: matrix.join(",") });
  }
  for (const input of invalidGeometry) assert.throws(() =>
    Reflect.apply(createEarthSurfaceRasterPlan().prepare,undefined,[input,presentation(),0]));
  for (const index of [-1, 0.5, 1, 448, NaN]) assert.throws(() =>
    createEarthSurfaceRasterPlan().prepare(geometry(), presentation(), index));
  const invalidPresentations = [
    { ...presentation(), overscan: NaN },
    { ...presentation(), overscan: -1 },
    { ...presentation(), overscan: 5 },
    ...[NaN, 0, -1].map((width) => ({ ...presentation(),
      packedRect: { ...presentation().packedRect, width } })),
    { ...presentation(), packedRect: { ...presentation().packedRect, y: 500 } },
    { ...presentation(), layout: { ...presentation().layout,
      bands: [{ y: NaN, height: 64, packedY: 100 }] } },
  ];
  for (const input of invalidPresentations) assert.throws(() =>
    createEarthSurfaceRasterPlan().prepare(geometry(), input, 0));
  const plan = createEarthSurfaceRasterPlan();
  const cell = plan.prepare(geometry(), presentation(), 0);
  assert.equal(plan.prepare(geometry(), presentation(), 0), cell);
  const changed = presentation();
  changed.packedRect.x += 1;
  assert.throws(() => plan.prepare(geometry(), changed, 0), /diverged/);
  assert.equal(plan.cells.length, 1);
});

test("Earth raster planner starts each page with independent shelves and leaves reuse allocation-free", () => {
  const plan = createEarthSurfaceRasterPlan();
  const pages = plan.pages;
  assert.deepEqual(pages, []);
  assert.throws(() => plan.prepare(geometry(-0.031), presentation(), 0), /exceeds its page/);
  assert.deepEqual(plan.cells, [], "an oversized cell must not consume an index");
  assert.deepEqual(pages, [], "an oversized cell must not allocate a page");
  const first = plan.prepare(geometry(), presentation(), 0);
  const { gutter, pageSize } = EARTH_SURFACE_ATLAS;
  const stride = first.size + 2 * gutter;
  const columns = Math.floor(pageSize / stride);
  const perPage = columns ** 2;
  assert.ok(perPage > 1 && perPage < 448, "the fixture must exercise both row and page rollover");
  for (let index = 1; index <= perPage; index++) {
    const cell = plan.prepare(geometry(), presentation(), index);
    const localIndex = index % perPage;
    assert.deepEqual([cell.page, cell.x, cell.y], [Math.floor(index / perPage),
      gutter + (localIndex % columns) * stride,
      gutter + Math.floor(localIndex / columns) * stride]);
  }
  assert.equal(plan.pages, pages, "consumers retain a live page list while preparing");
  assert.deepEqual(pages, [
    { width: pageSize, height: Math.ceil(columns * stride / 4) * 4 },
    { width: pageSize, height: Math.ceil(stride / 4) * 4 },
  ]);
  const allocation = JSON.stringify({ cells: plan.cells, pages });
  assert.equal(plan.prepare(geometry(), presentation(), 0), first);
  assert.equal(JSON.stringify({ cells: plan.cells, pages }), allocation,
    "reusing a cell from an earlier page must not advance the current shelf");
  const next = plan.prepare(geometry(), presentation(), perPage + 1);
  assert.deepEqual([next.page, next.x, next.y], [1, gutter + stride, gutter]);
});

// Test source pixels have separately observable longitude, latitude, and mixed
// signals; expected samples are evaluated directly, not read back from the bake.
function sourcePixel(x: number, y: number, channel: number, width: number, height: number) {
  x = ((x % width) + width) % width;
  y = Math.max(0, Math.min(height - 1, y));
  return channel === 0 ? (x % 127) * 2
    : channel === 1 ? (y % 97) * 2 : (x * 17 + y * 31) % 251;
}

function bilinearSource(x: number, y: number, channel: number, width: number, height: number) {
  const left = Math.floor(x), top = Math.floor(y);
  const fractionX = x - left, fractionY = y - top;
  return [[left, top, (1 - fractionX) * (1 - fractionY)],
    [left + 1, top, fractionX * (1 - fractionY)],
    [left, top + 1, (1 - fractionX) * fractionY],
    [left + 1, top + 1, fractionX * fractionY]].reduce(
    (sum, [sx, sy, weight]) => sum + sourcePixel(sx, sy, channel, width, height) * weight, 0);
}

function expectedPixel(cell:PagedSurfaceRasterCell, x: number, y: number, density: number, width: number, height: number) {
  const ratio = density / EARTH_SURFACE_ATLAS.density;
  const cellDensity = cell.density * ratio;
  const samples: number[][] = [];
  for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    const point = [(x + dx - cell.x * ratio) / cellDensity,
      (y + dy - cell.y * ratio) / cellDensity];
    // Solve the inverse homography's homogeneous coordinates, then undo the
    // north-cell rotation to recover original source UVs.
    const w = 1 - cell.perspectiveY * point[1];
    const original = point.map((value) => value / w);
    if (original.some((value) => value < 0 || value > 32)) continue;
    const [u, v] = cell.reversed ? original.map((value) => 32 - value) : original;
    samples.push([(cell.source.x + u * cell.source.width / 32) * width / 2048 - 0.5,
      (cell.source.southY - v * cell.source.height / 32) * height / 1024 - 0.5]);
  }
  return {
    samples,
    rgba: samples.length ? [0, 1, 2].map((channel) => samples.reduce(
      (sum, [sx, sy]) => sum + bilinearSource(sx, sy, channel, width, height), 0) / samples.length)
      .concat(Math.round(samples.length * 255 / 4)) : [0, 0, 0, 0],
  };
}

test("Earth bake preserves continuous original coordinates, northern reversal, wrap, alpha, gutters, and determinism", () => {
  // A 2048x1024 synthetic source and four tiny cells keep this unit test away
  // from the production 8K source/atlas allocation and full-image bake cost.
  const density = 2, width = 2048, height = 1024, channels = 3;
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < channels; channel++) {
      data[(y * width + x) * channels + channel] = sourcePixel(x, y, channel, width, height);
    }
  }
  const plan = createEarthSurfaceRasterPlan();
  const cells = [-0.012, 0.012, 0, -0.012].map((perspective, index) => {
    const address = presentation();
    if (index === 3) address.packedRect.x += 1984;
    const cell = plan.prepare(geometry(perspective), address, index);
    return { ...cell, page: Math.floor(index / 2), x: 16 + (index % 2) * 1024, y: 16 };
  });
  const sourceHash = createHash("sha256").update(data).digest("hex");
  const coverage = { transparent: 0, partial: 0, opaque: 0,
    westWrapped: 0, eastWrapped: 0, northernAdjacent: 0, southernAdjacent: 0 };
  const pageHashes = [];
  for (const page of [0, 1]) {
    const output = bakeEarthSurfaceRaster(data, { width, height, channels }, cells, density, page);
    const pageCells = cells.filter((cell) => cell.page === page);
    const occupiedBottom = Math.max(...pageCells.map((cell) => cell.y + cell.size + EARTH_SURFACE_ATLAS.gutter));
    assert.deepEqual([output.width, output.height, output.channels],
      [EARTH_SURFACE_ATLAS.pageSize / 4, Math.ceil(occupiedBottom / 4), 4]);
    assert.equal(output.data.length, output.width * output.height * 4);
    pageHashes.push(createHash("sha256").update(output.data).digest("hex"));
    for (const cell of pageCells) {
      const left = Math.floor(cell.x / 4), top = Math.floor(cell.y / 4);
      const right = Math.ceil((cell.x + cell.size) / 4), bottom = Math.ceil((cell.y + cell.size) / 4);
      for (let y = top - 2; y < Math.min(bottom + 2, output.height); y++) for (let x = left - 2; x < right + 2; x++) {
        const offset = (y * output.width + x) * 4;
        const actual = [...output.data.subarray(offset, offset + 4)];
        if (x < left || x >= right || y < top || y >= bottom) {
          assert.deepEqual(actual, [0, 0, 0, 0], `transparent gutter at ${x},${y}`);
          continue;
        }
        const expected = expectedPixel(cell, x, y, density, width, height);
        assert.equal(actual[3], expected.rgba[3], `cell ${cell.index} alpha at ${x},${y}`);
        for (let channel = 0; channel < 3; channel++) {
          // The independently ordered bilinear arithmetic can straddle a byte's
          // exact half-integer by an ULP. Only nearest-byte rounding is allowed;
          // this is not a general one-byte tolerance around rounded expectations.
          assert.ok(Math.abs(actual[channel] - expected.rgba[channel]) <= 0.5 + 1e-10,
            `cell ${cell.index} channel ${channel} at ${x},${y}: ${actual[channel]} vs ${expected.rgba[channel]}`);
        }
        coverage[actual[3] === 0 ? "transparent" : actual[3] === 255 ? "opaque" : "partial"]++;
        coverage.westWrapped += expected.samples.filter(([sx]) => sx < 0).length;
        coverage.eastWrapped += expected.samples.filter(([sx]) => sx >= width - 1).length;
        coverage.northernAdjacent += expected.samples.filter(([, sy]) => sy < 64).length;
        coverage.southernAdjacent += expected.samples.filter(([, sy]) => sy >= 128).length;
      }
    }
  }
  for (const [name, count] of Object.entries(coverage)) assert.ok(count > 0, `${name} must be exercised`);
  assert.equal(createHash("sha256").update(data).digest("hex"), sourceHash, "baking leaves the source bytes untouched");
  const unrelatedPage = { ...cells[0], page: 3, get source():PagedSurfaceRasterCell["source"] { throw new Error("unselected page was accessed"); },
    get size():number { throw new Error("unselected page affected allocation"); } };
  const repeated = bakeEarthSurfaceRaster(data, { width, height, channels }, [...cells, unrelatedPage], density, 0);
  assert.equal(createHash("sha256").update(repeated.data).digest("hex"), pageHashes[0]);
  assert.notEqual(pageHashes[0], pageHashes[1], "distinct pages preserve their own source cells");
  for (const page of [-1, 0.5, NaN, 2]) assert.throws(() =>
    bakeEarthSurfaceRaster(data, { width, height, channels }, cells, density, page), /page/);
});

test("Earth raster bake rejects malformed source dimensions, channels, and density", () => {
  for (const [data, info, density] of [
    [Buffer.alloc(0), { width: 2048, height: 1024, channels: 3 }, 2],
    [Buffer.alloc(3), { width: 1, height: 1, channels: 3 }, 2],
    [Buffer.alloc(0), { width: 0, height: 0, channels: 3 }, 2],
    [Buffer.alloc(0), { width: 2048, height: 1024, channels: 4 }, 2],
    [Buffer.alloc(0), { width: 1024, height: 512, channels: 3 }, 1],
    [Buffer.alloc(0), { width: 8192, height: 4096, channels: 3 }, NaN],
  ]) assert.throws(() => Reflect.apply(bakeEarthSurfaceRaster,undefined,[data,info,[],density]), /dimensions/);
});

test("Earth raster bake rejects malformed selected cells before allocating their page", () => {
  const info = { width: 2048, height: 1024, channels: 3 as const };
  const data = Buffer.alloc(info.width * info.height * info.channels);
  const cell = createEarthSurfaceRasterPlan().prepare(geometry(), presentation(), 0);
  for (const changes of [
    { x: NaN }, { x: 0 }, { x: 4096 }, { y: -1 }, { y: 4096 },
    { size: 0 }, { size: 0.5 }, { size: Infinity },
    { density: 0 }, { density: NaN }, { density: Infinity },
    { perspectiveY: 0.01 }, { perspectiveY: -1 / 32 }, { perspectiveY: NaN },
    { reversed: 1 }, { source: null },
    { source: { ...cell.source, x: Infinity } },
    { source: { ...cell.source, southY: NaN } },
    { source: { ...cell.source, width: 0 } },
    { source: { ...cell.source, height: -1 } },
  ]) assert.throws(() => Reflect.apply(bakeEarthSurfaceRaster,undefined,[data,info,[{...cell,...changes}],2]), /cells are invalid/);
  for (const cells of [null, {}, "cells"]) assert.throws(() =>
    Reflect.apply(bakeEarthSurfaceRaster,undefined,[data,info,cells,2]), /cells are invalid/);
});

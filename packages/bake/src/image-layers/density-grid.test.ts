import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImageLayerRecipe } from './config.ts';
import { parseImageLayerRecipe } from './config.ts';
import { densityGrid, imageLayerDensityModel } from './density-grid.ts';

type Density = NonNullable<ImageLayerRecipe['geometry']['densityGrid']>;

const CELLS = 21, MIDDLE = 10;
/** A grid file's text from a density at each cell: the first axis outermost, the third fastest. */
const file = (density: (i: number, j: number, k: number) => number, cells = CELLS): string => { const rows: string[] = [];
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) for (let k = 0; k < cells; k++) rows.push(`${i - (cells - 1) / 2}e16 ${j - (cells - 1) / 2}e16 ${k - (cells - 1) / 2}e16 ${density(i, j, k)}`);
  return rows.join('\n') + '\n'; };
/** A grid of one-arcsecond cells: its second axis to the north, its third to the east. */
const placed = (more: Partial<Density> = {}): Density => ({ source: 'fixture', basis: 'fixture', path: 'grid.dat', cells: CELLS, cellArcsec: 1, toward: 'high', secondAxisPaDeg: 0, thirdAxisPaDeg: 90, smoothPixels: 4, ...more });
const ball = (i: number, j: number, k: number) => Math.hypot(i - MIDDLE, j - MIDDLE, k - MIDDLE) <= 8 ? 100 : 0;

test('a density grid is read in its file\'s order, and a file that is not one is refused by name', () => {
  const grid = densityGrid(file((i, j, k) => i * 100 + j * 10 + k, 3), 3, 'grid.dat');
  assert.deepEqual([...grid.slice(0, 4)], [0, 1, 2, 10]); assert.equal(grid[26], 222);
  assert.throws(() => densityGrid(file(() => 1, 3), 4, 'grid.dat'), /grid\.dat holds 27 rows; a grid of 4 cells a side \(geometry\.densityGrid\.cells\) has 64/u);
  assert.throws(() => densityGrid(file(() => 1, 3).replace('1\n', 'gas\n'), 3, 'grid.dat'), /grid\.dat: row 1 has no density in its fourth column/u);
  // The same cells written with the first axis fastest: not this format.
  const turned: string[] = []; for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) turned.push(`${i}e16 ${j}e16 ${k}e16 1`);
  assert.throws(() => densityGrid(turned.join('\n'), 3, 'grid.dat'), /grid\.dat: its rows do not run with the third axis fastest/u);
});

test('each sight line\'s walls are the middles of the nearer and the farther half of its emission', () => {
  // A ball of even gas, 8 cells in radius: through the star the gas fills 17 cells. Each half of its light is eight
  // cells and half of the middle one: 36 cell-depths over 8.5 cells of light.
  const model = imageLayerDensityModel(placed(), densityGrid(file(ball), CELLS, 'grid.dat')), through = model.walls(0, 0)!;
  assert.ok(Math.abs(through.near + 36 / 8.5) < 1e-5 && Math.abs(through.far - 36 / 8.5) < 1e-5, `through the star: ${through.near} and ${through.far}`);
  assert.ok(model.reach >= 4.2 && model.reach < 8);
  // Two sheets of gas, the nearer one four times as dense: sixteen times the light, so both halves' middles are near it.
  const sheets = imageLayerDensityModel(placed(), densityGrid(file((i, j, k) => Math.hypot(j - MIDDLE, k - MIDDLE) > 8 ? 0 : i === MIDDLE + 5 ? 400 : i === MIDDLE - 5 ? 100 : 0), CELLS, 'grid.dat')), split = sheets.walls(0, 0)!;
  // Of 17 parts of light, the nearer 8.5 are all the near sheet's; the farther 8.5 are 7.5 of the near sheet and 1 of the far.
  assert.ok(Math.abs(split.near + 5) < 1e-5 && Math.abs(split.far - (7.5 * -5 + 1 * 5) / 8.5) < 1e-5, `two sheets: ${split.near} and ${split.far}`);
});

test('the grid is placed on the sky by its axes\' position angles, its end toward the Sun and its middle', () => {
  // A ball of gas, 4 cells in radius, 2 cells north of the star and 5 toward the high end of the sight-line axis.
  const lump = (i: number, j: number, k: number) => Math.hypot(i - (MIDDLE + 5), j - (MIDDLE + 2), k - MIDDLE) <= 4 ? 100 : 0, grid = densityGrid(file(lump), CELLS, 'grid.dat');
  const asIs = imageLayerDensityModel(placed(), grid);
  assert.ok(asIs.walls(0, 0)!.far < -1, 'the high end is toward the Sun: the gas is in front of the star'); assert.ok(asIs.walls(0, 4) !== null); assert.equal(asIs.walls(0, -4), null); assert.equal(asIs.walls(5, 0), null);
  assert.ok(imageLayerDensityModel(placed({ toward: 'low' }), grid).walls(0, 0)!.near > 1, 'the low end toward the Sun: the same gas is behind the star');
  // A quarter turn of both axes puts the gas east of the star; a shift of the grid's middle moves the gas with it.
  const turned = imageLayerDensityModel(placed({ secondAxisPaDeg: 90, thirdAxisPaDeg: 180 }), grid); assert.ok(turned.walls(4, 0) !== null); assert.equal(turned.walls(0, 5), null);
  const moved = imageLayerDensityModel(placed({ centreArcsec: [0, -2] }), grid); assert.equal(asIs.walls(0, -4), null); assert.ok(moved.walls(0, -3) !== null); assert.equal(moved.walls(0, 5.5), null);
  assert.throws(() => imageLayerDensityModel(placed({ centreArcsec: [0, 9] }), grid), /the grid holds no gas on the star's own sight line/u);
});

test('toward the gas\'s outline the walls are led onto the picture\'s plane, and the star\'s own light stays at the star', () => {
  const grid = densityGrid(file(ball), CELLS, 'grid.dat'), model = imageLayerDensityModel(placed(), grid), half = model.walls(4, 0)!, rim = model.walls(8.4, 0)!;
  // Half way out the walls are the gas's own; near the outline they are close to the plane.
  assert.ok(Math.abs(half.near) > 3 && Math.abs(half.near + half.far) < 1e-6); assert.ok(Math.abs(rim.near) < 0.5 && Math.abs(rim.far) < 0.5, `at the outline: ${rim.near} and ${rim.far}`); assert.equal(model.walls(9.5, 0), null);
  assert.equal(model.between, false); assert.deepEqual(model.detail(0, 0, -4, 4), { near: 1, far: 0, mid: 0, at: 0, walls: 1 });
  const star = imageLayerDensityModel(placed({ starRadiusArcsec: 1.5 }), grid); assert.equal(star.between, true);
  assert.deepEqual(star.detail(0.5, 0.5, -4, 4), { near: 0, far: 0, mid: 1, at: 0, walls: 1 }); assert.equal(star.detail(3, 0, -4, 4).mid, 0);
  const part = star.detail(2.25, 0, -4, 4); assert.ok(part.mid > 0.4 && part.mid < 0.6 && Math.abs(part.near + part.mid - 1) < 1e-9);
  // Where both walls are in front of the star, its light stays between them.
  assert.equal(star.detail(0, 0, -6, -2).at, -2);
});

test('a recipe\'s density grid is checked', () => {
  const recipe = (density: unknown, flat = true) => ({ schema: 'cssearth-image-layer-recipe@1', id: 'fixture-layers', source: { path: 'source.jpg', dimensions: [10, 10], originalDimensions: [10, 10], publisherUrl: 'https://example.org/', downloadUrl: 'https://example.org/a.jpg', credit: 'x', license: 'CC-BY-4.0' },
    observation: { centerRaDeg: 0, centerDecDeg: 0, fieldOfViewDeg: [0.01, 0.01], northClockwiseDeg: 0 }, target: { centerRaDeg: 0, centerDecDeg: 0, distancePc: 100 },
    geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, depthWeights: [0.25, 0.5, 0.25], supportRadiusKpc: 1e-4, supportTaperFraction: 0.9, depthScales: [1, 1, 1], unit: 'pc', densityGrid: density },
    bake: { maxFacePixels: 10, diffuseFacePixels: 8, crossAxisSlices: 4, crossAxisAlongPixels: 8, crossAxisDepthPixels: 9, backgroundFloor: 0.03, edgeTaperFraction: 0.04, diffuseFraction: 0.65, diffuseSigmaPixels: 2, flat, encoding: { format: 'webp', quality: 70, alphaQuality: 80 }, bulgeSlices: 8, bulgeFacePixels: 8, bulgeCrossSlices: 8 }, provenance: { path: 'provenance.json' } });
  const parsed = parseImageLayerRecipe(recipe(placed({ centreArcsec: [-1, 0.5], starRadiusArcsec: 1.6 })));
  assert.deepEqual(parsed.geometry.densityGrid, placed({ centreArcsec: [-1, 0.5], starRadiusArcsec: 1.6 })); assert.equal(parsed.bake.bulgeSlices, 8);
  assert.throws(() => parseImageLayerRecipe(recipe(placed({ thirdAxisPaDeg: 45 }))), /geometry\.densityGrid\.thirdAxisPaDeg is a quarter turn from secondAxisPaDeg \(0\); got 45/u);
  assert.throws(() => parseImageLayerRecipe(recipe({ ...placed(), toward: 'up' })), /geometry\.densityGrid\.toward says which end of the grid's first axis is toward the Sun/u);
  assert.throws(() => parseImageLayerRecipe(recipe(placed(), false)), /geometry\.densityGrid is for a flat bank/u);
});

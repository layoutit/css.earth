import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFigure, parseFigureMapRecipe } from './clean-figure-map.mts';

const recipe = parseFigureMapRecipe({
  schema: 'cssearth-figure-map-clean@1', source: 'figure.tif', output: 'figure-map.png',
  crop: { left: 1, top: 1, width: 8, height: 8 },
  rectangles: [
    { left: 0, top: 4, width: 10, height: 1, reason: 'grid line' },
    { left: 6, top: 6, width: 2, height: 2, reason: 'symbol' },
  ],
  background: { maximumChannel: 19 },
  grid: { centerLongitude: 0, pixelsPerDegree: 8 / 180, sampleOffset: 3.5, lineOffset: 3.5 },
});

test('annotation rectangles and background become exact black; data pixels, however pale, are kept unchanged', () => {
  const width = 10, height = 10, rgb = new Uint8Array(width * height * 3);
  const set = (x: number, y: number, c: number[]) => rgb.set(c, (y * width + x) * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, [200, 100, 20]);
  set(2, 2, [255, 253, 220]);   // the palest data color is not an annotation
  set(4, 8, [10, 0, 19]);       // background halo
  set(4, 7, [0, 0, 20]);        // darkest data color survives
  const { rgb: out, report } = cleanFigure(rgb, width, height, recipe);
  const at = (x: number, y: number) => [...out.subarray((y * 8 + x) * 3, (y * 8 + x) * 3 + 3)];
  assert.deepEqual(at(0, 3), [0, 0, 0], 'grid line row');
  assert.deepEqual(at(5, 5), [0, 0, 0], 'symbol rectangle');
  assert.deepEqual(at(3, 7), [0, 0, 0], 'background halo');
  assert.deepEqual(at(3, 6), [0, 0, 20]);
  assert.deepEqual(at(1, 1), [255, 253, 220]);
  assert.deepEqual(at(2, 2), [200, 100, 20]);
  assert.equal(report.rectanglePixels, 8 + 4);
  assert.equal(report.backgroundPixels, 1);
  assert.equal(report.keptPixels, 64 - 12 - 1);
  assert.ok(report.keptSphereFraction > 0 && report.keptSphereFraction < 1);
});

test('a whole kept grid covers the whole sphere', () => {
  const width = 8, height = 4, rgb = new Uint8Array(width * height * 3).fill(100);
  const whole = parseFigureMapRecipe({ ...recipe, crop: { left: 0, top: 0, width, height }, rectangles: [],
    grid: { centerLongitude: 180, pixelsPerDegree: 8 / 360, sampleOffset: 3.5, lineOffset: 1.5 } });
  assert.ok(Math.abs(cleanFigure(rgb, width, height, whole).report.keptSphereFraction - 1) < 1e-12);
});

test('recipes that leave their directory or lack a reason are refused with the value', () => {
  assert.throws(() => parseFigureMapRecipe({ ...recipe, source: '../elsewhere.tif' }), /inside the recipe directory, got "..\/elsewhere.tif"/);
  assert.throws(() => parseFigureMapRecipe({ ...recipe, rectangles: [{ left: 0, top: 0, width: 1, height: 1 }] }), /rectangles\[0\].reason must be non-empty text, got undefined/);
  assert.throws(() => parseFigureMapRecipe({ ...recipe, background: { maximumChannel: 255 } }), /below 255, got 255/);
  assert.throws(() => parseFigureMapRecipe({ ...recipe, schema: 'other' }), /schema/);
});

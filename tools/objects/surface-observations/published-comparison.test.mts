import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COMPARISON_SPEC_FILE, axisDifferenceDegrees, belowTopLines, bestImageTurnDegrees, columnCells, figureBands, figureCells, outlineOverlap, panelAxisDegrees, panelDisc, parseComparisonSpec, type Mask, type Raster } from './published-comparison.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
const DEGREE = Math.PI / 180;

/** A figure as the survey prints one: a white page, a dark band of 2 rows by 4 panels, a grey body in each panel with a
 * white label beside it, a red spin axis drawn through the bottom row's bodies and out past their limbs, and a black
 * caption mark on the page outside the band. */
function syntheticFigure() {
  const width = 400, height = 300, data = new Uint8Array(width * height * 3).fill(255);
  const paint = (x: number, y: number, rgb: readonly number[]) => { if (x >= 0 && y >= 0 && x < width && y < height) data.set(rgb, (y * width + x) * 3); };
  for (let y = 40; y < 260; y++) for (let x = 40; x < 360; x++) paint(x, y, [0, 0, 0]);
  for (let y = 5; y < 20; y++) for (let x = 5; x < 30; x++) paint(x, y, [0, 0, 0]);
  const centres: [number, number][][] = [0, 1].map(row => [0, 1, 2, 3].map(column => [40 + 80 * column + 40, 40 + 110 * row + 55]));
  for (const row of centres) for (const [cx, cy] of row) {
    for (let y = cy - 25; y <= cy + 25; y++) for (let x = cx - 25; x <= cx + 25; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 25 ** 2) paint(x, y, [180, 180, 180]);
    for (let y = cy - 50; y < cy - 45; y++) for (let x = cx - 35; x < cx - 25; x++) paint(x, y, [255, 255, 255]);
  }
  // The axis at 20° counter-clockwise from image right: from the centre out through the left limb, and out past the right limb.
  const axis = 20 * DEGREE;
  for (const [cx, cy] of centres[1]) for (let t = -36; t <= 36; t += 0.25) {
    if (t > 0 && t < 26) continue;
    for (let w = -1; w <= 1; w++) paint(Math.round(cx + t * Math.cos(axis) - w * Math.sin(axis)), Math.round(cy - t * Math.sin(axis) - w * Math.cos(axis)), [230, 40, 30]);
  }
  return { figure: { width, height, channels: 3, data } as Raster, centres };
}
const area = (mask: Mask) => mask.data.reduce((sum, value) => sum + value, 0);
function ellipse(a: number, b: number, size = 120): Mask {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = +(((x - size / 2) / a) ** 2 + ((y - size / 2) / b) ** 2 <= 1);
  return { width: size, height: size, data };
}

test('the panels are the largest dark band split evenly, not a dark mark elsewhere on the page', () => {
  const { figure } = syntheticFigure(), cells = figureCells(figure, 2, 4);
  assert.equal(cells.length, 2); assert.equal(cells[0].length, 4);
  assert.deepEqual(cells[0][0], { x0: 40, x1: 120, y0: 40, y1: 150 });
  assert.deepEqual(cells[1][3], { x0: 280, x1: 360, y0: 150, y1: 260 });
  assert.throws(() => figureCells(figure, 20, 4), /no dark band large enough/);
});

test('a figure that continues its epochs in a second band is read band by band', () => {
  const width = 300, height = 320, data = new Uint8Array(width * height * 3).fill(255);
  const dark = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * width + x) * 3, (y * width + x) * 3 + 3); };
  dark(20, 180, 260, 300); dark(20, 10, 180, 130); dark(280, 10, 295, 20);
  const figure: Raster = { width, height, channels: 3, data };
  assert.deepEqual(figureBands(figure), [{ x0: 20, x1: 180, y0: 10, y1: 130 }, { x0: 20, x1: 260, y0: 180, y1: 300 }], 'top band first; the small mark is no band');
  const columns = [0, 0, 1, 1, 1].map((band, index) => ({ label: `c${index}`, frame: null, band }));
  const cell = columnCells(figure, { rows: { image: 0, model: 1, count: 2, labelLines: 0 }, columns });
  assert.deepEqual(cell(1, 1), { x0: 100, x1: 180, y0: 70, y1: 130 }, 'second column of the top band, model row');
  assert.deepEqual(cell(0, 4), { x0: 180, x1: 260, y0: 180, y1: 240 }, 'third column of the bottom band, photograph row');
  assert.throws(() => figureCells(figure, 2, 2, 2), /2 dark bands; band 2 does not exist/);
});

test('a panel’s body is its largest bright region, without the axis arrow outside the limb and without the gap it leaves inside', () => {
  const { figure, centres } = syntheticFigure(), cells = figureCells(figure, 2, 4);
  const plain = panelDisc(figure, cells[0][1]), drawn = panelDisc(figure, cells[1][1]), disc = Math.PI * 25 ** 2;
  assert.ok(Math.abs(area(plain) - disc) / disc < 0.05, `plain body ${area(plain)} px against ${disc.toFixed(0)}`);
  assert.ok(Math.abs(area(drawn) - area(plain)) / area(plain) < 0.005, `the arrow moves the body's area by ${area(drawn) - area(plain)} px`);
  const [cx, cy] = centres[1][1], box = cells[1][1], at = (x: number, y: number) => drawn.data[(y - box.y0) * drawn.width + (x - box.x0)];
  assert.equal(at(Math.round(cx + 32 * Math.cos(20 * DEGREE)), Math.round(cy - 32 * Math.sin(20 * DEGREE))), 0, 'the arrow past the limb is not body');
  assert.equal(at(Math.round(cx - 12 * Math.cos(20 * DEGREE)), Math.round(cy + 12 * Math.sin(20 * DEGREE))), 1, 'the arrow across the body is');
});

test('a photograph panel\'s printed label lines stay out of the body even when the closing would join them', () => {
  // Two white text lines at the top of a black panel, and a grey body starting two rows under the second.
  const width = 120, height = 120, data = new Uint8Array(width * height * 3);
  const paint = (x0: number, y0: number, x1: number, y1: number, value: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(value, (y * width + x) * 3, (y * width + x) * 3 + 3); };
  paint(20, 6, 100, 18, 255); paint(30, 22, 90, 34, 255);
  for (let y = 36; y < 110; y++) for (let x = 10; x < 110; x++) if ((x - 60) ** 2 + (y - 72) ** 2 <= 36 ** 2) paint(x, y, x + 1, y + 1, 170);
  const figure: Raster = { width, height, channels: 3, data }, box = { x0: 0, y0: 0, x1: width, y1: height };
  const top = (mask: Mask) => { for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if (mask.data[y * mask.width + x]) return y; return -1; };
  assert.ok(top(panelDisc(figure, box)) < 34, 'without it the second line joins the body');
  assert.equal(top(panelDisc(figure, box, 40, 2)), 36);
  assert.equal(belowTopLines(figure, box, 2), 34);
  const tallData = new Uint8Array(data), tall: Raster = { width, height, channels: 3, data: tallData };
  for (let y = 18; y < 36; y++) for (let x = 55; x < 65; x++) tallData.fill(255, (y * width + x) * 3, (y * width + x) * 3 + 3);
  assert.equal(belowTopLines(tall, box, 2), 6, 'a run of ink taller than a line of text is not skipped');
});

test('the drawn spin axis is read as an angle on the image, and folded differences stay within a quarter turn', () => {
  const { figure } = syntheticFigure(), cells = figureCells(figure, 2, 4);
  assert.ok(Math.abs(panelAxisDegrees(figure, cells[1][2])! - 20) < 1);
  assert.equal(panelAxisDegrees(figure, cells[0][2]), null, 'a panel without an arrow states no axis');
  assert.equal(axisDifferenceDegrees(179, 1), -2);
  assert.equal(axisDifferenceDegrees(1, 179), 2);
  assert.equal(axisDifferenceDegrees(100, 10), 90);
});

test('outline overlap ignores scale and position but not shape', () => {
  assert.equal(outlineOverlap(ellipse(30, 20), ellipse(30, 20)), 1);
  const smaller = outlineOverlap(ellipse(30, 20), ellipse(24, 16, 100));
  assert.ok(smaller > 0.96 && smaller < 1, `the same shape at 0.8 of the size scores ${smaller}: high, but its pixels keep it below 1, so the tool reports that ceiling`);
  assert.ok(outlineOverlap(ellipse(30, 20), ellipse(20, 30)) < 0.8, 'the same shape turned a quarter');
  assert.throws(() => outlineOverlap(ellipse(30, 20), { width: 4, height: 4, data: new Uint8Array(16) }), /empty outline/);
});

test('the image turn that best lays one outline on another is found in half degrees, counter-clockwise as seen', () => {
  // A bar level in one picture and raised at its right end in the other; picture rows grow downward.
  const bar = (degrees: number): Mask => {
    const size = 120, data = new Uint8Array(size * size), turn = degrees * DEGREE;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x - 60, v = y - 60;
      data[y * size + x] = +(Math.abs(u * Math.cos(turn) - v * Math.sin(turn)) < 30 && Math.abs(u * Math.sin(turn) + v * Math.cos(turn)) < 8);
    }
    return { width: size, height: size, data };
  };
  assert.equal(bestImageTurnDegrees(bar(0), bar(5)), 5);
  assert.equal(bestImageTurnDegrees(bar(3), bar(0)), -3);
  assert.ok(outlineOverlap(bar(0), bar(5), 5) > outlineOverlap(bar(0), bar(5)));
});

test('the comparison record names its paper, figure pixels, rows and frames', async () => {
  const iris = JSON.parse(await readFile(resolve(ROOT, 'src/objects/iris/source', COMPARISON_SPEC_FILE), 'utf8'));
  const spec = parseComparisonSpec(iris);
  assert.equal(spec.lensId, 'zimpol'); assert.equal(spec.columns.filter(column => column.frame).length, 4);
  for (const [change, message] of [
    [{ schema: 'other' }, /schema/], [{ source: 'https://example.org/paper' }, /DOI/],
    [{ rows: { image: 1, model: 1, count: 3 } }, /distinct rows/],
    [{ columns: iris.columns.map((column: object) => ({ ...column, frame: null })) }, /At least one figure column/],
    [{ columns: iris.columns.map((column: object, index: number) => ({ ...column, band: index === 0 ? 1 : 0 })) }, /band by band/],
    [{ columns: iris.columns.map((column: object) => ({ ...column, band: -1 })) }, /whole number/],
  ] as const) assert.throws(() => parseComparisonSpec({ ...iris, ...change }), message);
  assert.ok(spec.columns.every(column => column.band === 0), 'a figure with one band need not say so');
});

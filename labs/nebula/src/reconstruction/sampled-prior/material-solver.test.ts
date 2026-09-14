import test from 'node:test';
import assert from 'node:assert/strict';
import { fitMaterialColors, type MaterialColumn } from './material-solver';

type Rgb = [number, number, number];
function fixture() {
  const count = 35 * 28, fixed = new Float32Array(count * 3), target = new Float32Array(count * 3), covered = new Uint8Array(count).fill(1);
  const centers = [[-1.1, -.3], [.7, .4], [.1, -1.2]], colors: Rgb[] = [[.9, .13, .07], [.08, .3, .88], [.2, .72, .24]];
  const weights: number[][] = centers.map(() => []), indices: number[][] = centers.map(() => []);
  for (let pixel = 0; pixel < count; pixel++) {
    const x = ((pixel % 35) + .5) / 35 * 6 - 3, y = (Math.floor(pixel / 35) + .5) / 28 * 5 - 2.5;
    let transmission = 1;
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i]!, opticalDepth = .65 * Math.exp(-((x - center[0]!) ** 2 / 2.2 + (y - center[1]!) ** 2 / 1.6));
      const value = transmission * (1 - Math.exp(-opticalDepth)); transmission *= Math.exp(-opticalDepth);
      indices[i]!.push(pixel); weights[i]!.push(value);
    }
    for (let c = 0; c < 3; c++) fixed[pixel * 3 + c] = .025 * transmission;
  }
  const columns = indices.map((rows, i) => ({ indices: Uint32Array.from(rows), values: Float32Array.from(weights[i]!) }));
  target.set(fixed);
  columns.forEach((column, i) => column.indices.forEach((pixel, j) => {
    for (let c = 0; c < 3; c++) target[pixel * 3 + c] += column.values[j]! * colors[i]![c]!;
  }));
  return { columns, target, fixed, covered, colors, initial: colors.map(() => [.5, .5, .5] as Rgb) };
}
function heldOutError(f: ReturnType<typeof fixture>, colors: readonly Rgb[]) {
  const projected = Float64Array.from(f.fixed);
  f.columns.forEach((column, i) => column.indices.forEach((pixel, j) => {
    for (let c = 0; c < 3; c++) projected[pixel * 3 + c] += column.values[j]! * colors[i]![c]!;
  }));
  let sum = 0, count = 0;
  for (let pixel = 0; pixel < f.covered.length; pixel++) if (f.covered[pixel] && pixel % 7 === 0) {
    count++; for (let c = 0; c < 3; c++) sum += (projected[pixel * 3 + c]! - f.target[pixel * 3 + c]!) ** 2;
  }
  return Math.sqrt(sum / (3 * count));
}

test('fixed overlapping depth-transmission columns recover RGB and improve independent withheld pixels', () => {
  const f = fixture(), before = structuredClone(f);
  const fitted = fitMaterialColors(f.columns, f.target, f.fixed, f.covered, f.initial, { iterations: 500, regularization: .001 });
  function accept(colors: readonly Rgb[]) {
    assert.ok(heldOutError(f, colors) < heldOutError(f, f.initial) * .05, 'Withheld material error must improve at least 95%.');
  }
  accept(fitted.colors);
  assert.throws(() => accept(f.initial), /Withheld material error/);
  const averaged: Rgb = [0, 1, 2].map(c => f.colors.reduce((sum, rgb) => sum + rgb[c]!, 0) / f.colors.length) as Rgb;
  assert.throws(() => accept(f.colors.map(() => [...averaged] as Rgb)), /Withheld material error/);
  assert.ok(fitted.afterRmse < fitted.beforeRmse * .05); assert.ok(fitted.validationAfterRmse < fitted.validationBeforeRmse * .05);
  assert.ok(Math.abs(fitted.validationAfterRmse - heldOutError(f, fitted.colors)) < 1e-14);
  assert.ok(fitted.colors.every(rgb => rgb.every(channel => channel >= 0 && channel <= 1)));
  for (let i = 0; i < f.colors.length; i++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(fitted.colors[i]![c]! - f.colors[i]![c]!) < .025);
  assert.deepEqual(f, before, 'Fitting must never alter geometry/transmission, target, coverage or initial colors.');
});

test('holdout pixels never enter gradients and repeated columns retain their unresolved ambiguity', () => {
  const f = fixture(), altered = f.target.slice();
  for (let pixel = 0; pixel < f.covered.length; pixel++) if (pixel % 7 === 0) altered.fill(0, pixel * 3, pixel * 3 + 3);
  const options = { iterations: 100, regularization: .01 };
  const a = fitMaterialColors(f.columns, f.target, f.fixed, f.covered, f.initial, options);
  const b = fitMaterialColors(f.columns, altered, f.fixed, f.covered, f.initial, options);
  assert.deepEqual(a.colors, b.colors); assert.equal(a.afterRmse, b.afterRmse);
  assert.notEqual(a.validationAfterRmse, b.validationAfterRmse);
  const duplicated = [f.columns[0]!, f.columns[0]!];
  const ambiguous = fitMaterialColors(duplicated, f.target, f.fixed, f.covered, [[.5, .5, .5], [.5, .5, .5]], options);
  assert.deepEqual(ambiguous.colors[0], ambiguous.colors[1], 'An underdetermined operator cannot manufacture different depth colors.');
  const validationOnly: MaterialColumn = { indices: new Uint32Array([0]), values: new Float32Array([.25]) };
  const unsupported = fitMaterialColors([validationOnly], f.target, f.fixed, f.covered, [[.1, .2, .3]], options);
  assert.deepEqual(unsupported.colors, [[.1, .2, .3]], 'No training support must retain the initial color.');
});

test('solver validates shapes, positive operator, bounded options, RGB ranges and training/validation coverage', () => {
  const f = fixture(), options = { iterations: 10, regularization: .01 };
  assert.throws(() => fitMaterialColors(f.columns, f.target.slice(1), f.fixed, f.covered, f.initial, options), /matching shape/);
  assert.throws(() => fitMaterialColors(f.columns, f.target, f.fixed, f.covered, [], options), /initial color/);
  for (const bad of [NaN, Infinity, -1, 1.01]) {
    const target = f.target.slice(); target[0] = bad;
    assert.throws(() => fitMaterialColors(f.columns, target, f.fixed, f.covered, f.initial, options), /unit RGB/);
    const initial: Rgb[] = f.initial.map(rgb => [...rgb]); initial[0]![0] = bad;
    assert.throws(() => fitMaterialColors(f.columns, f.target, f.fixed, f.covered, initial, options), /unit RGB initial/);
  }
  for (const invalid of [
    { indices: new Uint32Array([0]), values: new Float32Array() },
    { indices: new Uint32Array([f.covered.length]), values: new Float32Array([1]) },
    { indices: new Uint32Array([0]), values: new Float32Array([-1]) },
    { indices: new Uint32Array([0, 0]), values: new Float32Array([.1, .2]) },
  ]) assert.throws(() => fitMaterialColors([invalid], f.target, f.fixed, f.covered, [[.5, .5, .5]], options), /operator/);
  for (const invalid of [{ iterations: 0, regularization: 0 }, { iterations: 2001, regularization: 0 },
    { iterations: 1.5, regularization: 0 }, { iterations: 5, regularization: -1 }])
    assert.throws(() => fitMaterialColors(f.columns, f.target, f.fixed, f.covered, f.initial, invalid), /bounded iterations/);
  for (const onlyValidation of [true, false]) {
    const coverage = Uint8Array.from(f.covered, (_n, pixel) => Number((pixel % 7 === 0) === onlyValidation));
    assert.throws(() => fitMaterialColors(f.columns, f.target, f.fixed, coverage, f.initial, options), /training and validation/);
  }
  assert.throws(() => fitMaterialColors(f.columns, f.target, f.fixed, f.covered, f.initial, options, AbortSignal.abort(new Error('cancel-fit'))), /cancel-fit/);
});

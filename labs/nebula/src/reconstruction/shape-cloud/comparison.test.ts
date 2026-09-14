import test from 'node:test';
import assert from 'node:assert/strict';
import { compareShapeSignal, comparisonPixels, registeredNeutralProjection, type NeutralProjection } from './comparison.js';

const width = 40, height = 32;
const bounds = { min: [-5, -4, -1] as [number, number, number], max: [5, 4, 1] as [number, number, number] };
function fixture() {
  const rgb = new Uint8Array(width * height * 3), alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = x >= 5 && x < 16 && y >= 9 && y < 21 ? 80 : 0, p = y * width + x;
    rgb.fill(value, p * 3, p * 3 + 3); alpha[p] = value / 255 / 2;
  }
  return { rgb, projection: { width, height, alpha, bounds } };
}
test('source registration maps the complete baked neutral projection with the original Y direction', () => {
  const { projection } = fixture(), mapped = registeredNeutralProjection(projection, width, height);
  assert.deepEqual(mapped, projection.alpha);
  assert.ok(Math.abs(mapped[10 * width + 6]! - 80 / 510) < 1e-7);
  assert.equal(mapped[2 * width + 6], 0);
  const smaller: NeutralProjection = { width: 4, height: 4, alpha: new Float32Array(16).fill(.5),
    bounds: { min: [1, 1, -1], max: [2, 2, 1] } };
  const shifted = registeredNeutralProjection(smaller, width, height);
  assert.equal(shifted[9 * width + 25], .5, 'An off-center physical projection must remain off-center in the source raster.');
  assert.equal(shifted[20 * width + 15], 0);
});
test('comparison fits only one global brightness factor and detects a moved shape', () => {
  const { rgb, projection } = fixture(), same = compareShapeSignal(rgb, width, height, projection);
  assert.ok(Math.abs(same.brightnessScale - 2) < 1e-6);
  assert.ok(same.metrics.normalizedRmse < 1e-6);
  const moved = compareShapeSignal(rgb, width, height, { ...projection, bounds: { min: [-4, -4, -1], max: [6, 4, 1] } });
  assert.ok(moved.metrics.missingFraction > .25 && moved.metrics.excessFraction > .1);
  assert.ok(moved.metrics.normalizedRmse > .5, 'A per-pixel photo fit would hide this geometry mismatch.');
  for (const gain of [1, 2, 4, 8]) {
    assert.deepEqual(comparisonPixels(same.source, same.whiteLevel, gain), comparisonPixels(same.model, same.whiteLevel, gain));
    assert.ok(comparisonPixels(same.difference, same.whiteLevel, gain, true).every(value => value === 128));
  }
});
test('faint outer source signal remains in the residual beyond every modeled component', () => {
  const { rgb, projection } = fixture();
  for (let y = 2; y < 30; y++) {
    const p = y * width + 34; rgb.fill(3, p * 3, p * 3 + 3);
  }
  const result = compareShapeSignal(rgb, width, height, projection), p = 12 * width + 34;
  assert.ok(result.source[p]! > 0 && result.difference[p]! > 0); assert.equal(result.model[p], 0);
  assert.ok(result.metrics.missingFraction > 0);
  assert.ok(comparisonPixels(result.difference, result.whiteLevel, 8, true)[p]! > comparisonPixels(result.difference, result.whiteLevel, 1, true)[p]!);
  assert.ok(result.sourceEdges.some(value => value > 0));
});
test('empty models retain the whole missing signal and black inputs do not manufacture a fit', () => {
  const { rgb } = fixture(), empty = compareShapeSignal(rgb, width, height);
  assert.equal(empty.brightnessScale, 0); assert.equal(empty.metrics.missingFraction, 1); assert.equal(empty.metrics.normalizedRmse, 1);
  const black = compareShapeSignal(new Uint8Array(rgb.length), width, height);
  assert.deepEqual(black.metrics, { missingFraction: 0, excessFraction: 0, normalizedRmse: 0 });
  assert.throws(() => registeredNeutralProjection({ ...fixture().projection, alpha: Float32Array.of(NaN) }, width, height));
  assert.throws(() => comparisonPixels(Float32Array.of(1), 0, 1));
});

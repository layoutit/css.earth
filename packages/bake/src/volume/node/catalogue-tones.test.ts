import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCatalogueSizeBy, toneCataloguePalette } from './catalogue-tones.ts';

const toneBy = { brightMagnitude: -22, faintMagnitude: -18, faintTone: 0.5, steps: 3, band: 'B', basis: 'test' };
const sizeBy = { shells: 1, tiers: [{ brightestShare: 0.25, radiusPx: 1 }, { brightestShare: 0.75, radiusPx: 0.7 }], radiusPx: 0.5, basis: 'test' };

test('a toned palette pairs each color with its tone, in order of first use', () => {
  const toned = toneCataloguePalette({ basePalette: ['#ff0000', '#0000ff'], baseIndices: [0, 0, 1, 0], magnitudes: [-22, -18, -22, null], toneBy });
  assert.deepEqual(toned, { palette: ['#ff0000', '#ff0000', '#0000ff'], paletteTone: [1, 0.5, 1], indices: [0, 1, 2, 1] });
});

test('sizes rank each dot within its shell, and a dot without a magnitude is the smallest', () => {
  const sized = toneCataloguePalette({ basePalette: ['#ffffff'], baseIndices: [0, 0, 0, 0], magnitudes: [-20, -21, null, -19],
    distances: [1, 2, 3, 4], toneBy: { ...toneBy, steps: 2 }, sizeBy });
  // Ranks: -21 brightest (share 0), -20 (0.25), -19 (0.5), then the dot without a magnitude.
  assert.deepEqual(sized.indices.map(index => sized.paletteRadiusPx![index]), [0.7, 1, 0.5, 0.7]);
});

test('every distance shell has the same mix of sizes, however bright its dots are', () => {
  // The far pair is far brighter than the near pair, as a survey that reaches only luminous objects far away finds them.
  const sized = toneCataloguePalette({ basePalette: ['#ffffff'], baseIndices: [0, 0, 0, 0], magnitudes: [-18, -19, -23, -24],
    distances: [1, 2, 30, 40], toneBy, sizeBy: { ...sizeBy, shells: 2, tiers: [{ brightestShare: 0.5, radiusPx: 1 }] } });
  assert.deepEqual(sized.indices.map(index => sized.paletteRadiusPx![index]), [0.5, 1, 0.5, 1]);
});

test('size tiers must run brightest first and larger than the faintest', () => {
  assert.throws(() => checkCatalogueSizeBy({ ...sizeBy, tiers: [...sizeBy.tiers].reverse() }, toneBy, 'sizeBy'), /brightest first/u);
  assert.throws(() => checkCatalogueSizeBy({ ...sizeBy, radiusPx: 0.8 }, toneBy, 'sizeBy'), /brightest first/u);
  assert.throws(() => checkCatalogueSizeBy({ ...sizeBy, shells: 0 }, toneBy, 'sizeBy'), /shells/u);
  assert.throws(() => checkCatalogueSizeBy(sizeBy, undefined, 'sizeBy'), /toneBy/u);
  assert.doesNotThrow(() => checkCatalogueSizeBy(sizeBy, toneBy, 'sizeBy'));
});

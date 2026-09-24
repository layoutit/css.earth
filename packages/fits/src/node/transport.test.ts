import assert from 'node:assert/strict';
import { test } from 'vitest';
import { decodeFits } from '../index.js';
import { imageFixture, card } from '../test-support/fixtures.js';
import { encodeFits } from './index.js';

test('FITS transport reverses DOM rows exactly once and preserves signed samples', () => {
  const samples = new Float32Array([1, 2, 3, -4, .125, 0]);
  const fits = encodeFits(samples, 3, 2, { BUNIT: 'MJy/sr', OBJECT: "Tarantula's / display", CDELT1: 1e-8 });
  assert.equal(fits.readFloatBE(2880), -4);
  assert.deepEqual(decodeFits(fits).values, samples);
  assert.equal(decodeFits(fits).header.BUNIT, 'MJy/sr');
  assert.equal(decodeFits(fits).header.CDELT1, 1e-8);
  assert.equal(decodeFits(fits).header.OBJECT, "Tarantula's / display");
  assert.throws(() => decodeFits(fits.subarray(0, 2884)), /Truncated/);
  assert.throws(() => encodeFits(new Float32Array([NaN]), 1, 1, {}), /Nonfinite/);
});

test('transport rejects missing pixels, float32 overflow and structural metadata overrides', () => {
  assert.throws(() => decodeFits(imageFixture(16, [-2, 0], [card('BLANK', '-2')])), /Nonfinite/);
  assert.throws(() => decodeFits(imageFixture(-64, [1e100, 0])), /Nonfinite/);
  assert.throws(() => decodeFits(imageFixture(16, [1, 2], [card('BSCALE', '')])), /scaling/);
  for (const key of ['BITPIX', 'NAXIS1', 'BSCALE', 'BLANK', 'ZIMAGE', 'CONTINUE', 'HIERARCH'])
    assert.throws(() => encodeFits(new Float32Array([1]), 1, 1, { [key]: 1 }), /override/);
  assert.throws(() => encodeFits(new Float32Array([1]), 1, 1, { OBJECT: '非ASCII' }), /Invalid/);
});

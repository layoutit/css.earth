import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFits, encodeFits } from './getsf-fits.js';

test('FITS transport reverses DOM rows exactly once and preserves signed samples', () => {
  const samples = new Float32Array([1, 2, 3, -4, .125, 0]);
  const fits = encodeFits(samples, 3, 2, { BUNIT: 'MJy/sr', OBJECT: "Tarantula's / display" });
  assert.equal(fits.readFloatBE(2880), -4);
  assert.deepEqual(decodeFits(fits).values, samples);
  assert.equal(decodeFits(fits).header.BUNIT, 'MJy/sr');
  assert.equal(decodeFits(fits).header.OBJECT, "Tarantula's / display");
  assert.throws(() => decodeFits(fits.subarray(0, 2884)), /Truncated/);
  assert.throws(() => encodeFits(new Float32Array([NaN]), 1, 1, {}), /Nonfinite/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { missingSourceReason } from './source-test.mts';

test('only absent inputs skip: coverage that finds an undeclared file fails', () => {
  assert.equal(missingSourceReason(new Error('Fixture source manifest coverage failed. Undeclared: stray.txt. Missing: none.')), null);
  assert.equal(missingSourceReason(new Error('Fixture source coverage failed. Undeclared: stray.txt. Missing: raw/a.fits.')), null);
  assert.match(missingSourceReason(new Error('Fixture source manifest coverage failed. Undeclared: none. Missing: raw/a.fits.')) ?? '', /Missing: raw\/a\.fits/u);
  assert.equal(missingSourceReason(new Error('an ordinary assertion')), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { plainStarDotBank } from './plain-star-dots.ts';

const PARSEC_M = 3.0856775814913673e16;
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0] };

test('the plain-dot stars of one object become a dot bank: each star once, in its color, in the smallest unit that reaches them all', () => {
  const near = plainStarDotBank([
    { id: 'near', positionM: [10 * PARSEC_M, 0, -2.5 * PARSEC_M], color: '#ffeedd' },
    { id: 'near-twin', positionM: [0, 20 * PARSEC_M, 0], color: '#ffeedd' },
  ], frame)!;
  assert.deepEqual([near.id, near.frame.metersPerUnit, near.points], ['plain-stars', PARSEC_M, [[10, 0, -2.5, 0], [0, 20, 0, 0]]]);
  assert.deepEqual(near.appearance.palette, ['#ffeedd']);
  // Catalogued stars are never thinned inside their bank's reach.
  assert.equal(near.appearance.fullDetailUnits, 20);
  // A galaxy past the parsec's reach is in kiloparsecs, every star of it.
  const far = plainStarDotBank([
    { id: 'andromeda-cepheid', positionM: [780_000 * PARSEC_M, 0, 0], color: '#aabbcc' },
    { id: 'andromeda-twin', positionM: [0, 100_000 * PARSEC_M, 0], color: '#aabbcc' },
  ], frame)!;
  assert.deepEqual([far.frame.metersPerUnit, far.points], [PARSEC_M * 1e3, [[780, 0, 0, 0], [0, 100, 0, 0]]]);
});

test('an object without such stars has no bank, and a star past every unit or with no color is refused by name', () => {
  assert.equal(plainStarDotBank([], frame), null);
  assert.throws(() => plainStarDotBank([{ id: 'too-far', positionM: [3e8 * 1e3 * PARSEC_M, 0, 0], color: '#ffffff' }], frame), /too-far is .* pc from the world's origin/u);
  assert.throws(() => plainStarDotBank([{ id: 'grey', positionM: [PARSEC_M, 0, 0], color: 'grey' }], frame), /grey: a plain dot's color is #rrggbb/u);
});

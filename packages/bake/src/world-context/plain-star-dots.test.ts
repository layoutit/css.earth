import assert from 'node:assert/strict';
import test from 'node:test';
import { plainStarDotBanks } from './plain-star-dots.ts';

const PARSEC_M = 3.0856775814913673e16;
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0] };

test('plain-dot stars become dot banks: each star once, in its color, in the smallest unit that reaches it', () => {
  const banks = plainStarDotBanks([
    { id: 'near', positionM: [10 * PARSEC_M, 0, -2.5 * PARSEC_M], color: '#ffeedd' },
    { id: 'andromeda-cepheid', positionM: [780_000 * PARSEC_M, 0, 0], color: '#aabbcc' },
    { id: 'near-twin', positionM: [0, 20 * PARSEC_M, 0], color: '#ffeedd' },
  ], frame);
  assert.deepEqual(banks.map(bank => [bank.id, bank.points.length, bank.frame.metersPerUnit]), [['plain-stars', 2, PARSEC_M], ['plain-stars-far', 1, PARSEC_M * 1e3]]);
  assert.deepEqual(banks[0]!.points, [[10, 0, -2.5, 0], [0, 20, 0, 0]]);
  assert.deepEqual(banks[0]!.appearance.palette, ['#ffeedd']);
  assert.deepEqual(banks[1]!.points, [[780, 0, 0, 0]]);
  // Catalogued stars are never thinned inside their bank's reach.
  assert.equal(banks[0]!.appearance.fullDetailUnits, 20);
});

test('a world without such stars writes no bank, and a star past every unit or with no color is refused by name', () => {
  assert.deepEqual(plainStarDotBanks([], frame), []);
  assert.throws(() => plainStarDotBanks([{ id: 'too-far', positionM: [3e8 * 1e3 * PARSEC_M, 0, 0], color: '#ffffff' }], frame), /too-far is .* pc from the world's origin/u);
  assert.throws(() => plainStarDotBanks([{ id: 'grey', positionM: [PARSEC_M, 0, 0], color: 'grey' }], frame), /grey: a plain dot's color is #rrggbb/u);
});

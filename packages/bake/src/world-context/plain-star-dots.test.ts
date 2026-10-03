import assert from 'node:assert/strict';
import test from 'node:test';
import { plainStarDotBank } from './plain-star-dots.ts';

const PARSEC_M = 3.0856775814913673e16;
// The centre of the object the stars are inside, 780 kpc from the world's origin.
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [780_000 * PARSEC_M, 0, 0] };

test('the plain-dot stars inside an object become its dot bank: each star once, in its color, about the object\'s centre', () => {
  const bank = plainStarDotBank('m31', [
    { id: 'cepheid', positionM: [780_010 * PARSEC_M, 0, -2.5 * PARSEC_M], color: '#ffeedd' },
    { id: 'blue', positionM: [780_000 * PARSEC_M, 20 * PARSEC_M, 0], color: '#aabbcc' },
    { id: 'cepheid-twin', positionM: [779_990 * PARSEC_M, 0, 0], color: '#ffeedd' },
  ], frame)!;
  assert.deepEqual([bank.id, bank.points.length, bank.frame.metersPerUnit, bank.frame.originM], ['plain-stars', 3, PARSEC_M, frame.originM]);
  assert.deepEqual(bank.points, [[10, 0, -2.5, 1], [0, 20, 0, 0], [-10, 0, 0, 1]]);
  assert.deepEqual(bank.appearance.palette, ['#aabbcc', '#ffeedd']);
  // Catalogued stars are never thinned inside their bank's reach.
  assert.equal(bank.appearance.fullDetailUnits, 20);
  assert.match(bank.source, /inside m31/u);
});

test('an object without such stars has no bank, and a star past the reach or with no color is refused by name', () => {
  assert.equal(plainStarDotBank('m31', [], frame), null);
  assert.throws(() => plainStarDotBank('m31', [{ id: 'too-far', positionM: [0, 0, 0], color: '#ffffff' }], frame), /too-far is 780000 pc from the centre of m31, the object it is inside/u);
  assert.throws(() => plainStarDotBank('m31', [{ id: 'grey', positionM: [780_001 * PARSEC_M, 0, 0], color: 'grey' }], frame), /grey: a plain dot's color is #rrggbb/u);
});

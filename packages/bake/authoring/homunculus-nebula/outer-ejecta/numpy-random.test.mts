import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultRng, fma } from './numpy-random.mts';

// Literals from NumPy 2.5.4: np.random.default_rng(seed) and the draws named in each test.
test('seeding gives the bit generator state NumPy reports', () => {
  assert.equal(defaultRng(1).state.state, 0x9c5b484bfedb756c2a6e7d6f320fbc7en);
  assert.equal(defaultRng(1).state.inc, 0x922af2da2645f895a19857b95740937bn);
  assert.equal(defaultRng(5).state.state, 0xe500c1d129ce9183d973b921e554efeen);
  assert.equal(defaultRng(5).state.inc, 0xaf6f7b8c936ab4a44f020b7b2d10234dn);
});

test('choice, normal and uniform interleave as gas_from_images.py draws them', () => {
  const rng = defaultRng(5), depths = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5], got: number[] = [];
  for (let k = 0; k < 4; k++) got.push(rng.choice(depths), rng.normal(0, 1.0), rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(1, 4));
  assert.deepEqual(got, [5.5, -1.324358995628145, 0.009195336625285199, -0.12851917194711504, 1.1617921071449693, 5.5, 0.10970639932180819, -0.05491607674800081,
    -0.27283488365853287, 1.1462731321815043, 1.5, 0.27276877584472176, -0.15929387899810563, -0.03903146866491478, 3.9225585797777662,
    6.5, 0.2028824405086084, 0.20653862256524458, -0.0645572013991331, 2.479069056195228]);
});

test('vector draws consume the stream as NumPy does', () => {
  const rng = defaultRng(1);
  assert.deepEqual(Array.from(rng.random(5)), [0.5118216247002567, 0.9504636963259353, 0.14415961271963373, 0.9486494471372439, 0.31183145201048545]);
  assert.deepEqual(rng.choiceIndices(2, 7).map(i => [-1, 1][i]), [1, -1, -1, 1, -1, -1, 1]);
  const dens = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233].map(v => v / 607), total = dens.reduce((a, b) => a + b, 0);
  assert.deepEqual(rng.choiceIndices(10, 8, dens.map(v => v / total)), [3, 9, 8, 7, 9, 7, 8, 5]);
  assert.deepEqual(Array.from({ length: 5 }, () => rng.integers(0, 1000)), [549, 383, 403, 903, 203]);
  assert.deepEqual(Array.from({ length: 3 }, () => rng.integers(0, 10 ** 12)), [262313340441, 750364672630, 280408757986]);
  const normals = Array.from({ length: 2000 }, () => rng.standardNormal());
  assert.deepEqual(normals.slice(-3), [0.4468066117404053, -0.281596026440881, 0.02079235295293288]);
});

test('a 32-bit range near 2^32 rejects draws as Lemire\'s method does', () => {
  const rng = defaultRng(2);
  assert.deepEqual(Array.from({ length: 12 }, () => rng.integers(0, 3000000000)),
    [2512726441, 327916393, 1241440972, 2442677221, 1004649072, 1800301577, 2439567877, 2185681579, 2978575777, 563703219, 165439881, 1674677686]);
});

test('the ziggurat tail and wedges match NumPy over 200,000 normals', () => {
  const rng = defaultRng(1), x = Array.from({ length: 200000 }, () => rng.standardNormal());
  const tail = x.map((v, i) => [i, v] as const).filter(([, v]) => Math.abs(v) > 3.6541528853610088).slice(0, 4);
  assert.deepEqual(tail, [[860, 3.7516349672663583], [3284, 3.717640457214948], [4912, 3.931777880377655], [9176, -3.6642496010783234]]);
  assert.equal(x[199999], -0.04415526720711728);
  assert.equal(rng.random(), 0.6021926666499507);
});

test('bad arguments are refused', () => {
  const rng = defaultRng(0);
  assert.throws(() => rng.integers(3, 3), RangeError);
  assert.throws(() => rng.choice([]), RangeError);
  assert.throws(() => rng.choiceIndices(3, 2, [0.5, 0.6, 0.1]), RangeError);
  assert.throws(() => defaultRng(-1), RangeError);
});

test('fma rounds once, as the C library fma does', () => {
  // Literals from C fma on macOS arm64.
  assert.equal(fma(0.1, 10, -1), 5.5511151231257827e-17);
  assert.equal(fma(1 / 3, 3, -1), -5.5511151231257827e-17);
  assert.equal(fma(1e16 + 2, 1 - 2 ** -53, -1e16), 0.88977697537484324);
  assert.equal(fma(-2.5, 0.6, 0.7), -0.80000000000000004);
  assert.equal(fma(2 ** -500, 2 ** -500, 2 ** -1000), 1.8665272370064378e-301);
  assert.equal(fma(123.456, -7.89, 1e-300), -974.06783999999993);
});

test('without fused multiply-adds, uniform rounds twice as an x86-64 build does', () => {
  const rng = defaultRng(5, { fusedMultiplyAdd: false });
  rng.choice([0, 1, 2, 3, 4, 5]); rng.normal(0, 1);
  assert.equal(rng.uniform(-0.3, 0.3), 0.009195336625285211);
});

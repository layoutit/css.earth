import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meanChannelNoise } from './channel-noise.mts';

const NOISE: Record<string, number> = { a: 3e-5, b: 4e-5, c: 1.2e-4, d: 7e-6, e: 2.5e-5, f: 9e-5 };
const noiseOf = (band: string) => NOISE[band]!;
/** The sum the author used before a band could count once: every channel an independent reading. */
const independent = (channels: readonly (readonly string[])[]) =>
  Math.sqrt(channels.reduce((total, bands) => total + bands.reduce((sum, band) => sum + noiseOf(band) ** 2, 0) / bands.length ** 2, 0)) / 3;

test('an image of one band keeps its own noise in the mean of the three channels it fills', () => {
  assert.equal(meanChannelNoise([['a'], ['a'], ['a']], noiseOf), NOISE.a);
  assert.ok(Math.abs(independent([['a'], ['a'], ['a']]) * Math.sqrt(3) - NOISE.a!) < 1e-18, 'the earlier sum was this noise over the square root of three');
});

test('channels that share no band keep the earlier sum to the last bit', () => {
  for (const channels of [[['a'], ['b'], ['c']], [['a', 'b'], ['c', 'd'], ['e', 'f']]])
    assert.equal(meanChannelNoise(channels, noiseOf), independent(channels));
});

test('a band two channels share counts once, for its whole share of the mean', () => {
  // red a, green the mean of a and b, blue b: the mean of the three is half of a plus half of b.
  const mean = meanChannelNoise([['a'], ['a', 'b'], ['b']], noiseOf);
  assert.ok(Math.abs(mean - 0.5 * Math.hypot(NOISE.a!, NOISE.b!)) < 1e-18);
  assert.ok(mean > independent([['a'], ['a', 'b'], ['b']]));
});

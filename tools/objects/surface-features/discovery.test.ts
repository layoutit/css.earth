import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { featureDiscoveryZoomShare } from './catalog.js';
const test = sourceTest();

test('a sparse catalogue reveals its names while the whole body fits on screen', () => {
  // The same 400 px body framing for a metre-scale asteroid or a large moon.
  const share = Math.log((400 / 460 * 1.1) / .42) / Math.log(4 / .42);
  for (const count of [1, 2, 4, 5]) {
    for (let rank = 0; rank < count; rank++) {
      assert.ok(featureDiscoveryZoomShare(rank, count) <= share, `${count} names, rank ${rank}`);
    }
  }
  // Adding a small third name cannot make the first two harder to discover.
  assert.equal(featureDiscoveryZoomShare(1, 2), featureDiscoveryZoomShare(1, 3));
});

test('sparse catalogues still reveal additional names as the camera approaches', () => {
  const tiers = Array.from({ length: 100 }, (_, rank) => featureDiscoveryZoomShare(rank, 100));
  assert.equal(tiers[0], 0);
  assert.equal(tiers.filter(share => share <= .43).length, 9);
  assert.ok(tiers[99]! > .8);
  assert.ok(tiers.every((share, rank) => rank === 0 || share > tiers[rank - 1]!));
  assert.ok(featureDiscoveryZoomShare(20, 100, true) < featureDiscoveryZoomShare(20, 100));
});

test('dense catalogues retain their established discovery tiers', () => {
  for (const count of [200, 574, 1941, 9167]) {
    for (const rank of [0, 1, 10, count - 1]) {
      for (const noted of [false, true]) {
        const previous = Math.min(1, Math.log10(1 + (noted ? rank / 4 : rank)) / Math.log10(count));
        assert.equal(featureDiscoveryZoomShare(rank, count, noted), previous);
      }
    }
  }
});

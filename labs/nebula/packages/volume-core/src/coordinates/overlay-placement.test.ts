import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultOverlayPlacement, overlayPlacementTransform, updateOverlayPlacement } from '@cssearth/volume-core/coordinates/overlay-placement';

test('manual placement rejects invalid controls without changing accepted state', () => {
  const prior = defaultOverlayPlacement();
  for (const patch of [{ scale: 0 }, { scale: -1 }, { x: NaN }, { rotationY: Infinity }, { toString: 2 }]) {
    assert.throws(() => updateOverlayPlacement(prior, patch as never), /placement needs/);
    assert.deepEqual(prior, defaultOverlayPlacement());
  }
  assert.deepEqual(updateOverlayPlacement(prior, { x: 3, scale: 2 }), { ...prior, x: 3, scale: 2 });
});

test('reset restores the exact prepared projective transform', () => {
  const base = 'matrix3d(1,0,0,.001,0,1,0,0,0,0,1,0,20,30,0,1)';
  const edited = updateOverlayPlacement(defaultOverlayPlacement(), { x: 2, rotationZ: 30, scale: 1.3 });
  assert.notEqual(overlayPlacementTransform(base, [12, 20, 0], edited, 50), base);
  const reset = updateOverlayPlacement(edited, defaultOverlayPlacement());
  assert.equal(overlayPlacementTransform(base, [12, 20, 0], reset, 50), base);
});

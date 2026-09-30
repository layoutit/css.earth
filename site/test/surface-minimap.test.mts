import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceMapViewport } from '../minimap/surface-map-context.mts';

test('surface consumers use the published clipped viewport without measuring the scene', () => {
  const scene = { closest() { throw new Error('Unexpected layout read'); } };
  assert.deepEqual(surfaceMapViewport(scene as unknown as HTMLElement, { focalPixels: 800, framingRadiusPixels: 400, detailHandoffDiameterPixels: 320, principalOffsetPixels: [40, -20],
    visibleRect: { left: -600, right: 400, top: -300, bottom: 300 } }),
  { left: -.8, right: .45, top: -.35, bottom: .4 });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupportAtlases } from '@cssearth/nebula-reconstruction/evidence/support-atlas';
import { workingRasterToFrame } from './structure-inspection.ts';
import { applyAffine, type Affine } from '@cssearth/nebula-reconstruction/registration/affine';
import type { StructureRegion } from '@cssearth/nebula-reconstruction/evidence/wavelets';

test('highlight sprites contain actual disconnected support, never filled bounding rectangles', () => {
  const width = 8, height = 6;
  const region: StructureRegion = { id: 'cross', scale: 1, morphology: 'compact', support: Uint32Array.from([10, 17, 18, 19, 26]),
    bounds: { minX: 1, minY: 1, maxX: 3, maxY: 3 }, centroid: [2, 2], axisLengths: [2, 1], orientationDeg: 0, peakCoefficient: .3, integratedCoefficient: .8 };
  const result = createSupportAtlases([region], width, height, 16), sprite = result.regions[0]!, page = result.pages[sprite.atlas.index]!;
  const alpha = (x: number, y: number) => page.pixels[((sprite.atlas.y + y) * page.width + sprite.atlas.x + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0, 'A bounding-box corner is not part of the detected structure.');
  assert.equal(alpha(1, 0), 210, 'Detected support boundary is visible.');
  assert.equal(alpha(1, 1), 56, 'Interior is translucent, not a solid rectangle.');
  assert.equal(Array.from(page.pixels).filter((_, i) => i % 4 === 3).filter(Boolean).length, region.support.length);
  assert.deepEqual(sprite.centroid, [2.5, 2.5]);
  assert.deepEqual(sprite.bounds, { x: 1, y: 1, width: 3, height: 3 });
});

test('resized support preserves the exact full native image edges and registration', () => {
  const native: Affine = [.1, -.003, .003, .1, 15, 60], width = 768, height = 534, nw = 6850, nh = 4759;
  const working = workingRasterToFrame(native, nw, nh, width, height);
  for (const point of [[0, 0], [width, height], [width, 0], [0, height], [251.5, 201.5]] as [number, number][]) {
    const expected = applyAffine(native, [point[0] * nw / width, point[1] * nh / height]);
    const actual = applyAffine(working, point);
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-10);
  }
});

test('atlas packing rejects support outside the real source footprint', () => {
  const region: StructureRegion = { id: 'invalid', scale: 0, morphology: 'compact', support: Uint32Array.from([999]),
    bounds: { minX: 1, minY: 1, maxX: 3, maxY: 3 }, centroid: [2, 2], axisLengths: [2, 1], orientationDeg: 0, peakCoefficient: .3, integratedCoefficient: .8 };
  assert.throws(() => createSupportAtlases([region], 8, 6, 16), /leaves its actual raster bounds/);
});

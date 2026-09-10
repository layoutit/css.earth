import { expect, test } from 'vitest';
import { imageLayerAxisWeights } from './prepared-image-layer-runtime.js';
import type { PreparedImageLayerView } from './loader.js';

const views: readonly PreparedImageLayerView[] = [
  { axis: 'x', normalUnits: [1, 0, 0], samplingStepUnits: 1 },
  { axis: 'y', normalUnits: [0, 1, 0], samplingStepUnits: 1 },
  { axis: 'z', normalUnits: [0, 0, 1], samplingStepUnits: 1 },
];

test('image banks keep an active, normalized non-edge-on projection through a complete turn', () => {
  for (let degrees = 0; degrees <= 360; degrees++) {
    const angle = degrees * Math.PI / 360;
    const weights = imageLayerAxisWeights([Math.sin(angle), 0, 0, Math.cos(angle)], views);
    expect(weights.x + weights.y + weights.z).toBeCloseTo(1, 12);
    expect(Math.max(weights.x, weights.y, weights.z)).toBeGreaterThanOrEqual(.5);
  }
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], views)).toEqual({ x: 0, y: 1, z: 0 });
});
test('selection follows baked plane normals and sample density instead of bank names', () => {
  const tilted = views.map(view => view.axis === 'z' ? { ...view, normalUnits: [0, 1, 0] as const } : view);
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], tilted).z).toBeGreaterThan(0);
  const dense = tilted.map(view => view.axis === 'z' ? { ...view, samplingStepUnits: .1 } : view);
  expect(imageLayerAxisWeights([Math.SQRT1_2, 0, 0, Math.SQRT1_2], dense)).toEqual({ x: 0, y: 0, z: 1 });
});

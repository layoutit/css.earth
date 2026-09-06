import { expect, it } from 'vitest';
import { levelOfDetailFor } from './perspective-dolly.js';

  it('crossfades geometry, billboard and marker without hiding the finer stage early', () => {
    const lod = { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20,
      billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 };
    const samples = [40, 17, 13, 7, 4].map(diameter => levelOfDetailFor(lod, diameter));
    expect(samples.map(sample => sample.stage)).toEqual(['geometry', 'crossfade', 'billboard', 'billboard', 'marker']);
    expect(samples[1].billboardOpacity).toBe(.5);
    for (const sample of samples) if (sample.markerOpacity > 0) expect(sample.billboardOpacity).toBe(1);
  });
